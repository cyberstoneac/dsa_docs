# Feign & Distributed Tracing

> **Spring context:** OpenFeign for declarative REST clients.
> Micrometer Tracing (Spring Boot 3.x) replaces Spring Cloud Sleuth for
> distributed tracing. Tracing backends: Zipkin, Jaeger, OTLP.

## Mental Model

Two related but distinct concerns:

```d2
direction: right

feign: "Feign" {
  style.fill: "#bbdefb"
  desc: "Declarative HTTP client.\nWrite an interface, get\na client implementation."
}
tracing: "Tracing" {
  style.fill: "#c8e6c9"
  desc: "Follow a request\nacross services via\ntrace and span IDs."
}
```

**Feign** removes HTTP boilerplate for service-to-service calls.
**Tracing** lets you follow a request through 10+ services to find the slow
one.

Both are essential in a microservices architecture.

---

# Part 1 — OpenFeign

## Why Feign?

**Without Feign:**

```java
@Service
public class UserService {
    private final RestTemplate restTemplate;

    public User getUser(long id) {
        String url = "http://user-service/users/" + id;
        ResponseEntity<User> response = restTemplate.getForEntity(url, User.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new ServiceException("user-service failed");
        }
        return response.getBody();
    }
}
```

**With Feign:**

```java
@FeignClient(name = "user-service")
public interface UserClient {

    @GetMapping("/users/{id}")
    User getUser(@PathVariable long id);
}
```

**Interview line:** *"Feign turns a REST call into a typed method —
declarative HTTP clients."*

---

## Setting Up Feign

### Dependencies

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
```

### Enable Feign

```java
@SpringBootApplication
@EnableFeignClients
public class Application { }
```

### Basic client

```java
@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/users/{id}")
    User getUser(@PathVariable long id);

    @PostMapping("/users")
    User create(@RequestBody CreateUserRequest req);

    @DeleteMapping("/users/{id}")
    void delete(@PathVariable long id);
}
```

Inject and use like any Spring bean:

```java
@Service
public class OrderService {
    private final UserClient userClient;

    public OrderService(UserClient userClient) {
        this.userClient = userClient;
    }

    public Order place(long userId) {
        User user = userClient.getUser(userId);
        return new Order(user);
    }
}
```

Feign generates the implementation, integrates with discovery (`name =
"user-service"` → resolve via Eureka), and applies load balancing.

---

## `@FeignClient` Attributes

| Attribute | Purpose |
|---|---|
| `name` / `value` | Service name for discovery, or a logical name |
| `url` | Direct URL (bypasses discovery) |
| `path` | Prefix for all methods |
| `configuration` | Custom config class |
| `fallback` | Fallback class implementing the interface |
| `fallbackFactory` | Factory that can inspect the cause |
| `decode404` | Return null on 404 instead of throwing |

### `url` for local or direct calls

```java
@FeignClient(name = "user-service", url = "${user.service.url}")
public interface UserClient { ... }
```

**Useful for:**
- Third-party APIs (no discovery)
- Testing against a local instance
- Integration tests with WireMock

### `path` prefix

```java
@FeignClient(name = "user-service", path = "/api/v1")
public interface UserClient {
    @GetMapping("/users/{id}")   // → GET /api/v1/users/{id}
    User getUser(@PathVariable long id);
}
```

---

## Custom Configuration

```java
@Configuration
public class UserClientConfig {

    @Bean
    public Logger.Level feignLoggerLevel() {
        return Logger.Level.FULL;
    }

    @Bean
    public RequestInterceptor requestInterceptor() {
        return template -> template.header("X-Client", "order-service");
    }
}
```

### Per-client config

```java
@FeignClient(name = "user-service", configuration = UserClientConfig.class)
public interface UserClient { ... }
```

**Important:** the config class must **not** be annotated with
`@Configuration` if it's in a component-scanned package — otherwise it
becomes global.

**Fix:** put it in a package outside the main scan, or omit `@Configuration`.

**Interview line:** *"Feign config classes shouldn't be in the component-scan
path unless you want them global."*

---

## Interceptors — Adding Headers

```java
@Bean
public RequestInterceptor authInterceptor() {
    return template -> {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() instanceof String token) {
            template.header("Authorization", "Bearer " + token);
        }
    };
}
```

**Common use:** propagate the caller's JWT to downstream services. This
maintains the authenticated user throughout the call chain.

**Interview line:** *"Feign interceptors propagate headers — auth tokens,
trace IDs, tenant IDs — to downstream calls."*

---

## Error Handling

### `ErrorDecoder`

```java
public class CustomErrorDecoder implements ErrorDecoder {

    private final ErrorDecoder defaultDecoder = new Default();

    @Override
    public Exception decode(String methodKey, Response response) {
        if (response.status() == 404) {
            return new ResourceNotFoundException(methodKey);
        }
        if (response.status() >= 500) {
            return new DownstreamServiceException(methodKey);
        }
        return defaultDecoder.decode(methodKey, response);
    }
}
```

Register it in `FeignClient` config:

```java
@Bean
public ErrorDecoder errorDecoder() {
    return new CustomErrorDecoder();
}
```

### Feign's default behavior

- **Non-2xx responses** → `FeignException` (subclass)
- **404** → `FeignException.NotFound` (unless `decode404 = true`)
- **Timeouts** → `feign.RetryableException`

**Interview line:** *"Feign throws on non-2xx — customize with `ErrorDecoder`
for domain-specific exceptions."*

---

## Feign + Circuit Breaker

```java
@FeignClient(
    name = "user-service",
    fallbackFactory = UserClientFallbackFactory.class
)
public interface UserClient {
    @GetMapping("/users/{id}")
    User getUser(@PathVariable long id);
}
```

```java
@Component
public class UserClientFallbackFactory implements FallbackFactory<UserClient> {

    @Override
    public UserClient create(Throwable cause) {
        return id -> {
            log.warn("user-service failed for id={}", id, cause);
            return User.UNKNOWN;
        };
    }
}
```

Enable circuit breaker for Feign:

```yaml
feign:
  circuitbreaker:
    enabled: true
```

**`fallback`** — a single instance returned for all failures (can't see the
cause).

**`fallbackFactory`** — a factory that receives the `Throwable`, so the
fallback can log or branch.

**Interview line:** *"`fallbackFactory` is preferred over `fallback` — it
gives access to the cause."*

---

## Timeouts

```yaml
feign:
  client:
    config:
      default:
        connectTimeout: 2000
        readTimeout: 5000
      user-service:
        connectTimeout: 1000
        readTimeout: 3000
```

Or in Java config:

```java
@Bean
public Request.Options requestOptions() {
    return new Request.Options(
            Duration.ofSeconds(2),
            Duration.ofSeconds(5),
            true);
}
```

**Always set timeouts.** Feign's default is infinite — a hung downstream
service can block your threads forever.

**Interview line:** *"Feign has infinite default timeouts — always override."*

---

## Logging

```yaml
logging:
  level:
    com.example.clients.UserClient: DEBUG
```

```java
@Bean
public Logger.Level feignLoggerLevel() {
    return Logger.Level.FULL;   // BASIC, HEADERS, FULL
}
```

**WARNING:** `Logger.Level.FULL` logs request and response bodies — including
sensitive data. **Never in production.**

**Interview line:** *"`FULL` logging includes bodies — dev only."*

---

# Part 2 — Distributed Tracing

## Why Tracing?

A request in a microservice architecture touches 5–20 services. When it's
slow, **which service is the bottleneck?**

Tracing gives you a **trace ID** shared by every service that handled the
request, plus **span IDs** for each unit of work.

```d2
direction: right

client: "Client" {
  style.fill: "#e3f2fd"
}
gw: "Gateway\nspan 1" {
  style.fill: "#c8e6c9"
}
order: "order-service\nspan 2" {
  style.fill: "#fff9c4"
}
user: "user-service\nspan 3" {
  style.fill: "#ffe0b2"
}
payment: "payment-service\nspan 4" {
  style.fill: "#ffcc80"
}
db: "user-db\nspan 5" {
  style.fill: "#f8bbd0"
}

client.gw -> gw: ""
gw.order -> order: ""
order.user -> user: ""
order.payment -> payment: ""
user.db -> db: ""
```

**All spans share the same trace ID.** You can see where time is spent.

**Interview line:** *"A trace follows a request across services; a span is
one unit of work within it."*

---

## Trace vs Span

| | Trace | Span |
|---|---|---|
| Scope | Entire request | One operation |
| Identifier | `traceId` | `spanId` |
| Relationship | Container | Belongs to a trace, has a parent |
| Duration | Total | Single operation |

**Key hierarchy:** spans form a tree. The root span is the entry point; child
spans are nested operations (DB calls, HTTP calls, method executions).

---

## Micrometer Tracing (Boot 3.x)

Spring Cloud Sleuth is **deprecated**. Its replacement is **Micrometer
Tracing**, integrated natively into Spring Boot 3.

### Dependencies

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
<dependency>
    <groupId>io.zipkin.reporter2</groupId>
    <artifactId>zipkin-reporter-brave</artifactId>
</dependency>
```

Or for OpenTelemetry:

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-zipkin</artifactId>
</dependency>
```

### Configuration

```yaml
management:
  tracing:
    sampling:
      probability: 1.0    # 100% in dev; 0.1 in prod

  zipkin:
    tracing:
      endpoint: http://localhost:9411/api/v2/spans
```

### Automatic instrumentation

Micrometer Tracing instruments:

- **Spring MVC** — incoming requests
- **WebClient / RestTemplate** — outgoing calls
- **Feign** — outgoing calls
- **JDBC / R2DBC** — DB calls
- **Kafka / RabbitMQ** — messaging
- **@Scheduled** — scheduled jobs
- **@Async** — async calls

**You get trace propagation for free** once the dependencies are in place.

**Interview line:** *"Micrometer Tracing instruments HTTP, JDBC, messaging,
and async — trace IDs propagate automatically."*

---

## Propagating Trace IDs

The `traceId` and `spanId` are propagated via **W3C Trace Context** headers:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

Older: B3 (`X-B3-TraceId`, `X-B3-SpanId`).

**Feign propagates these automatically** if tracing is on the classpath.

**Interview line:** *"W3C `traceparent` header is the modern standard."*

---

## Correlating Logs

Add trace and span IDs to log lines:

```yaml
logging:
  pattern:
    level: "%5p [${spring.application.name:},%X{traceId:-},%X{spanId:-}]"
```

**Output:**

```
INFO [order-service,4bf92f3577b34da6a3ce929d0e0e4736,00f067aa0ba902b7] - Order placed
```

Now you can grep for a `traceId` across all services' logs.

**Interview line:** *"MDC carries the traceId so it appears in every log line
— grep once, see the whole request."*

### Accessing trace IDs programmatically

```java
@Autowired
private Tracer tracer;

public void doWork() {
    String traceId = tracer.currentSpan().context().traceId();
    // ...
}
```

---

## Viewing Traces

### Zipkin

```bash
docker run -d -p 9411:9411 openzipkin/zipkin
```

UI at `http://localhost:9411`. Search by service, trace ID, duration.

### Jaeger

```bash
docker run -d -p 16686:16686 -p 6831:6831/udp jaegertracing/all-in-one
```

UI at `http://localhost:16686`.

### OpenTelemetry Collector

For OTLP-based pipelines:

```yaml
management:
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
```

The collector forwards to a backend of your choice (Jaeger, Tempo, Datadog,
Honeycomb).

**Interview line:** *"OTLP is the modern, vendor-neutral protocol — Spring
Boot 3 sends spans via OTLP."*

---

## Sampling

**100% tracing in production is expensive.** Sample instead.

```yaml
management:
  tracing:
    sampling:
      probability: 0.1    # 10% of requests
```

**Sampling strategies:**

| Strategy | Behavior |
|---|---|
| **Probability** | Random fraction |
| **Rate limiting** | N traces per second |
| **Adaptive** | Increase on errors, decrease otherwise |

**Interview line:** *"Sample 100% in dev; 1–10% in prod — always sample
errors."*

### Always sample errors

Micrometer Tracing supports custom samplers. For critical paths, sample 100%.

---

## Context Propagation in Async

By default, `traceId` doesn't propagate to **new threads** (thread pools,
`CompletableFuture.supplyAsync`).

### Fix 1 — `ContextExecutorService`

```java
@Configuration
public class AsyncConfig {
    @Bean
    public Executor asyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.initialize();
        return ContextExecutorService.wrap(
                executor.getThreadPoolExecutor(),
                ContextSnapshot::captureAll
        );
    }
}
```

### Fix 2 — `@Async` with tracing-aware executor

Spring Boot 3's default `@Async` executor is traced automatically.

### Fix 3 — MDC propagation

MDC (used for `traceId` in logs) uses a `ThreadLocal` — same problem as
`SecurityContextHolder`. Wrapping the executor copies it.

**Interview line:** *"Trace context doesn't cross threads automatically —
wrap executors with `ContextExecutorService`."*

---

## Comparing Tracing Libraries

| | Spring Cloud Sleuth | Micrometer Tracing |
|---|---|---|
| Status | Deprecated (Boot 3) | Active |
| Backends | Zipkin, Brave | Brave, OTel, Zipkin, Jaeger, OTLP |
| API | Sleuth-specific | Micrometer (vendor-neutral) |
| Spring Boot 3 | ❌ | ✅ |

**Interview line:** *"Sleuth is dead; Micrometer Tracing is the modern
replacement."*

---

## Feign + Tracing Together

With Micrometer Tracing on the classpath:

1. Feign clients automatically add `traceparent` / `X-B3-*` headers
2. Downstream services extract the IDs and continue the trace
3. Trace IDs appear in logs on both sides
4. Zipkin/Jaeger shows the full chain

**No extra code** — just dependencies and config.

**Interview line:** *"Feign and Micrometer Tracing work together
transparently."*

---

## Tricky Corners ⚠️

**Feign `@FeignClient` `name` requires discovery.** Without a registry, use
`url` instead.

**Feign config classes in the scanned package become global.** Put them
outside or omit `@Configuration`.

**Feign's default timeout is infinite.** Always set `connectTimeout` and
`readTimeout`.

**`Logger.Level.FULL` logs bodies** — sensitive data. Dev only.

**Fallback methods hide failures.** Log them and monitor fallback rates.

**`fallbackFactory` is preferred over `fallback`** — access to the cause.

**`decode404 = true`** returns null instead of throwing on 404. Use carefully.

**Spring Cloud Sleuth is deprecated.** Use Micrometer Tracing in Boot 3.

**`traceparent` is the W3C standard.** `X-B3-*` is legacy.

**MDC uses `ThreadLocal`** — same async propagation problem as
`SecurityContextHolder`.

**Sampling at 100% in production** is expensive. Sample 1–10%.

**Trace IDs in logs require a custom log pattern.** Default pattern doesn't
include them.

**Zipkin needs a storage backend** for production (in-memory default is
lossy).

**Async operations lose trace context** unless the executor is wrapped.

**OpenTelemetry Collector** is more flexible than direct Zipkin export — it
can route to any backend.

**Feign's `RequestInterceptor` runs on every request** — keep it fast.

**Tracing does not replace logging.** You need both — spans show structure,
logs show detail.

**Feign is synchronous by default.** For reactive, use `WebClient` with
`WebClient`-based declarative clients.

**Circuit breaker + tracing + retry + bulkhead** can produce deep nesting.
Monitor span depth.

---

## Common Pitfalls

- Using Feign without a discovery registry and without `url`.
- Setting Feign timeouts too high or leaving them infinite.
- Logging `FULL` in production.
- Global Feign config accidentally.
- Fallback returning success silently (callers think it worked).
- Expecting trace IDs in logs without a pattern change.
- Assuming async calls keep trace context.
- Sampling 100% in production.
- Using Sleuth in Boot 3.
- Not configuring a tracing backend — spans vanish.

---

## Key Interview Tips

- Say **"Feign is a declarative HTTP client."**
- Explain **`fallback` vs `fallbackFactory`** — the factory sees the cause.
- Say **"Feign defaults to infinite timeouts — always override."**
- Explain **`ErrorDecoder`** for custom exceptions.
- Say **"Micrometer Tracing replaced Sleuth in Boot 3."**
- Explain **trace vs span** — trace is the whole request, span is one
  operation.
- Say **"W3C `traceparent` header propagates trace context."**
- Mention **MDC and log pattern** for correlating logs.
- Say **"trace context doesn't cross threads automatically."**
- Know **Zipkin, Jaeger, OTLP** as backends.

---

## Related

- [Service Discovery](service-discovery.md) — Feign resolves names via the
  registry
- [Circuit Breaker](circuit-breaker.md) — fallback integration with Feign
- [API Gateway](api-gateway.md) — gateway-side tracing
- [Config Server](config-server.md) — centralizing Feign/tracing config
- [Virtual Threads](../../java/concurrency/virtual-threads.md) — modern async
  alternative