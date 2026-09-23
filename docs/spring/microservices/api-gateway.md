# API Gateway

> **Spring context:** Spring Cloud Gateway (reactive, Spring WebFlux-based).
> Zuul 1 is deprecated; Zuul 2 was never fully integrated into Spring Cloud.
> Gateway is the modern choice.

## Mental Model

An API Gateway is a **single entry point** for all client requests. It routes
to the right backend service, and adds cross-cutting concerns in one place.

```d2
direction: right

clients: "Clients" {
  style.fill: "#e3f2fd"
  web: "Web App" {
    style.fill: "#bbdefb"
  }
  mobile: "Mobile App" {
    style.fill: "#bbdefb"
  }
}
gw: "API Gateway\n(Spring Cloud Gateway)" {
  style.fill: "#fff9c4"
  desc: "Routing, auth,\nrate limit, CORS,\ncircuit breaker,\nrequest/response transform"
}
svcA: "user-service" {
  style.fill: "#c8e6c9"
}
svcB: "order-service" {
  style.fill: "#a5d6a7"
}
svcC: "payment-service" {
  style.fill: "#81c784"
}

clients.web -> gw: ""
clients.mobile -> gw: ""
gw.svcA -> svcA: "/api/users/**"
gw.svcB -> svcB: "/api/orders/**"
gw.svcC -> svcC: "/api/payments/**"
```

**What the gateway handles:**

- **Routing** — URL pattern → service
- **Authentication** — validate JWT once, forward identity downstream
- **Rate limiting** — protect backends from abuse
- **CORS** — centralized
- **Circuit breaking** — resilience4j integration
- **Request/response transformation** — headers, bodies
- **Logging & tracing** — one place to capture all traffic

**Interview line:** *"The gateway is the single ingress for all client
traffic — cross-cutting concerns live there so services stay focused."*

---

## Why a Gateway?

Without a gateway:

- Every client needs to know every service's URL
- CORS, auth, rate limiting duplicated per service
- No central place for cross-cutting logic
- Clients must handle service discovery

With a gateway:

- One URL for clients
- Cross-cutting concerns centralized
- Backend services stay simple
- Easy to swap/add services

**Interview line:** *"Without a gateway, cross-cutting concerns are
duplicated in every service."*

---

## Spring Cloud Gateway Basics

### Dependencies

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
```

**Important:** Gateway is **WebFlux-based** — do not add `spring-boot-starter-web`,
or the app will fail to start.

### Minimal config

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service        # lb:// uses service discovery
          predicates:
            - Path=/api/users/**
          filters:
            - StripPrefix=1             # /api/users/1 → /users/1
```

### Route components

| Component | Purpose |
|---|---|
| `id` | Unique route identifier |
| `uri` | Target (`http://`, `https://`, `lb://` for discovery) |
| `predicates` | Conditions for the route to match |
| `filters` | Request/response transformations |

---

## Predicates

Predicates decide whether a route matches.

| Predicate | Example |
|---|---|
| `Path` | `/api/users/**` |
| `Method` | `GET`, `POST` |
| `Host` | `**.example.com` |
| `Header` | `X-Api-Version=2` |
| `Query` | `debug=true` |
| `Cookie` | `session=abc` |
| `After` | `2025-01-01T00:00:00Z` |
| `Before` | `2026-01-01T00:00:00Z` |
| `Between` | time window |
| `RemoteAddr` | `192.168.1.0/24` |
| `Weight` | `group=canary, weight=10` |
| `XForwardedRemoteAddr` | trusted proxy IPs |

### Combine predicates

```yaml
predicates:
  - Path=/api/users/**
  - Method=GET,POST
  - Header=X-Api-Version, v\d+
```

All predicates must match for the route to trigger (AND).

### Weight-based (canary) example

```yaml
routes:
  - id: users-v1
    uri: lb://user-service-v1
    predicates:
      - Path=/api/users/**
      - Weight=users, 90
  - id: users-v2
    uri: lb://user-service-v2
    predicates:
      - Path=/api/users/**
      - Weight=users, 10
```

**10% of traffic goes to v2** — canary deployment.

---

## Filters

Filters transform requests or responses.

### Common built-in filters

| Filter | Effect |
|---|---|
| `StripPrefix=N` | Removes first N path segments |
| `PrefixPath` | Adds a path prefix |
| `RewritePath` | Regex-based path rewrite |
| `AddRequestHeader` | Adds a request header |
| `AddResponseHeader` | Adds a response header |
| `RemoveRequestHeader` | Removes a request header |
| `SetPath` | Replaces the whole path |
| `RedirectTo` | Redirects |
| `Retry` | Retries on failure |
| `CircuitBreaker` | Wraps with circuit breaker |
| `RequestRateLimiter` | Rate limiting |
| `SaveSession` | Session persistence |

### StripPrefix example

Request: `/api/users/1`
Filter: `StripPrefix=1`
Forwarded: `/users/1`

**Use it when the gateway prefix shouldn't reach the service.**

### RewritePath example

```yaml
- RewritePath=/api/users/(?<segment>.*), /users/$\{segment}
```

Regex captures `segment`, replaces the path.

### Custom filter

```java
@Component
public class AddRequestIdFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String requestId = UUID.randomUUID().toString();
        ServerHttpRequest request = exchange.getRequest()
                .mutate()
                .header("X-Request-Id", requestId)
                .build();

        return chain.filter(exchange.mutate().request(request).build());
    }

    @Override
    public int getOrder() {
        return -1;   // runs before other filters
    }
}
```

**Global filters** run for every request. **Gateway filters** are per-route.

### Filter order

Gateway filters run in a defined order. Global filters use `Ordered`.
Path filters run in the order declared in config.

**Interview line:** *"Global filters run for every route; per-route filters
only for their route."*

---

## Cross-Cutting Concerns at the Gateway

### JWT validation

Validate JWTs at the gateway, forward `X-User-Id` and `X-Roles` to
downstream services.

```java
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // skip public paths
        if (path.startsWith("/public")) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders()
                .getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return unauthorized(exchange);
        }

        try {
            Claims claims = jwtService.parse(authHeader.substring(7));
            ServerHttpRequest request = exchange.getRequest().mutate()
                    .header("X-User-Id", claims.getSubject())
                    .header("X-User-Roles", String.join(",",
                            claims.get("roles", List.class)))
                    .build();
            return chain.filter(exchange.mutate().request(request).build());
        } catch (Exception e) {
            return unauthorized(exchange);
        }
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
```

**Benefits:**

- JWT parsed once
- Backend services trust `X-User-Id` / `X-Roles` headers
- No JWT library or secret in every service

**Security caveat:** backends must be reachable only from the gateway (network
policy). Otherwise, a client can forge headers.

### CORS

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOrigins: "https://app.example.com"
            allowedMethods: [GET, POST, PUT, DELETE]
            allowedHeaders: "*"
            allowCredentials: true
```

**Centralized CORS.** Backends don't need CORS config.

### Rate limiting

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200
                key-resolver: "#{@userKeyResolver}"
```

```java
@Configuration
public class RateLimiterConfig {
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> Mono.just(
                exchange.getRequest().getHeaders().getFirst("X-User-Id"));
    }
}
```

**Requires Redis.** Uses token-bucket algorithm.

**Interview line:** *"Rate limiting at the gateway protects every downstream
service from abuse."*

---

## Gateway vs Traditional Reverse Proxy

| | Spring Cloud Gateway | Nginx / HAProxy |
|---|---|---|
| Config | YAML / Java DSL | Config files |
| Dynamic routes | ✅ (via discovery) | Reload needed |
| Custom logic | Java filters | Lua / plugins |
| Reactive | ✅ | Event-driven (not Java) |
| Kubernetes-native | Via Ingress | ✅ |

**When to use Gateway:**

- Spring Cloud stack
- You need Java-based filters
- Dynamic routes from service discovery

**When to use Nginx/HAProxy:**

- Pure load balancing
- High performance, low custom logic

**Interview line:** *"Gateway is Java-native; Nginx is a general-purpose
proxy."*

---

## Gateway + Service Discovery

`lb://user-service` uses Spring Cloud LoadBalancer to resolve the service
from the registry (Eureka, Consul).

### Config

```yaml
spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: true      # auto-create routes for every discovered service
          lower-case-service-id: true
```

**Auto-locator** creates a route per service:
`/user-service/**` → `lb://user-service`.

**Manual routes are preferred** — auto-locator exposes everything, including
internal services you didn't mean to publish.

---

## Observability

### Logging

```yaml
logging:
  level:
    org.springframework.cloud.gateway: DEBUG
    reactor.netty.http.client: DEBUG
```

### Tracing

Add Sleuth or Micrometer Tracing:

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
```

Gateway propagates trace IDs to downstream services. See
[Feign & Tracing](feign-and-tracing.md).

### Metrics

Actuator + Micrometer expose gateway metrics:

- Requests per route
- Latency per route
- Error rates

---

## Error Handling

### Fallback on circuit breaker

```yaml
filters:
  - name: CircuitBreaker
    args:
      name: userServiceCB
      fallbackUri: forward:/fallback/user-service
```

```java
@RestController
public class FallbackController {

    @GetMapping("/fallback/user-service")
    public ResponseEntity<ErrorResponse> userServiceFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse("USER_SERVICE_DOWN",
                        "User service is temporarily unavailable"));
    }
}
```

### Custom error response

```java
@Component
public class CustomErrorWebExceptionHandler implements ErrorWebExceptionHandler {
    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        // build custom error response
    }
}
```

---

## Tricky Corners ⚠️

**Gateway is reactive (WebFlux).** Don't add `spring-boot-starter-web` —
they're mutually exclusive.

**`lb://` requires service discovery.** Without a registry, use `http://`.

**Order matters for filters.** Global filters use `Ordered`; route filters
run in declared order.

**StripPrefix changes the path** — verify your backend routes match.

**JWT validation at the gateway doesn't secure services** if they're directly
reachable. Use network policies or mutual TLS.

**Weight-based routing is per-request**, not sticky. Sessions may flip
between versions.

**Rate limiter requires Redis** (or another `RateLimiter` implementation).
Without it, the filter fails.

**`Path` predicate matches by Ant patterns** — `/**` matches any depth.

**Auto-locator exposes all services** — often too broad. Use manual routes
for production.

**Headers added by the gateway can be spoofed** if the gateway doesn't
remove incoming versions. Always `RemoveRequestHeader` for sensitive headers
before adding your own.

**`ServerWebExchange.mutate()` creates a new exchange** — don't hold a
reference to the old one.

**Reactive code needs reactive operators.** Blocking calls (JDBC, blocking
HTTP) can starve the event loop. Use reactive alternatives (R2DBC,
`WebClient`).

**Gateway routes are matched in order** — first match wins. Put more specific
predicates first.

**Global error handling requires an `ErrorWebExceptionHandler`.** `@ControllerAdvice`
doesn't apply to gateway.

**Spring Cloud Gateway runs on Netty**, not Tomcat. Thread behavior differs.

---

## Common Pitfalls

- Adding `spring-boot-starter-web` and breaking the app.
- Using `lb://` without a discovery registry.
- Exposing internal services via auto-locator.
- Not removing spoofable headers.
- Blocking calls in a global filter.
- Assuming the gateway is a security boundary without network policies.
- Not handling gateway errors with a custom exception handler.
- Forgetting to propagate trace IDs downstream.

---

## Key Interview Tips

- Say **"the gateway is the single entry point for clients."**
- List what it handles: **routing, auth, rate limit, CORS, circuit breaking,
  tracing**.
- Explain **predicates vs filters** — match condition vs transform.
- Say **"gateway is WebFlux-based, not servlet."**
- Explain **JWT validation at the gateway** — parse once, forward headers.
- Mention **weight-based routing for canary** deployments.
- Say **"auto-locator is often too broad — prefer manual routes."**
- Know **rate limiting requires Redis**.

---

## Related

- [Service Discovery](service-discovery.md) — the `lb://` scheme
- [Circuit Breaker](circuit-breaker.md) — resilience for downstream calls
- [Feign & Tracing](feign-and-tracing.md) — tracing propagation
- [Security Basics](../security/spring-security-basics.md) — JWT basics