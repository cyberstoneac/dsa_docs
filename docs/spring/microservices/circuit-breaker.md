# Circuit Breaker

> **Spring context:** Resilience4j is the modern choice (Hystrix is
> deprecated and in maintenance mode). Spring Cloud Circuit Breaker abstracts
> over Resilience4j, Sentinel, and others. This file focuses on Resilience4j.

## Mental Model

A **circuit breaker** stops calling a failing service after a threshold,
giving it time to recover. Requests fail fast instead of piling up.

Three states:

```d2
direction: right

closed: "CLOSED\n(normal —\ncalls pass through)" {
  style.fill: "#c8e6c9"
}
open: "OPEN\n(fail fast —\nno calls)" {
  style.fill: "#ffcdd2"
}
halfOpen: "HALF_OPEN\n(test recovery —\nlimited calls)" {
  style.fill: "#fff9c4"
}

closed.open -> open: "failure rate exceeds threshold"
open.halfOpen -> halfOpen: "after wait duration"
halfOpen.closed -> closed: "probes succeed"
halfOpen.open -> open: "any probe fails"
```

**Without a circuit breaker:** every request waits for a timeout, thread
pools fill up, and the whole system cascades into failure.

**With a circuit breaker:** failing calls return immediately; the load on the
downstream service drops; recovery is possible.

**Interview line:** *"Circuit breakers fail fast to prevent cascading
failures."*

---

## Why Circuit Breakers Matter

### Without

```text
Service A → Service B (down, hanging)
    ↓
Threads in A block for full timeout
    ↓
Thread pool in A exhausts
    ↓
Service A becomes unavailable too
    ↓
Cascading failure
```

### With

```text
Service A → Circuit breaker → Service B (down)
    ↓
After N failures, breaker opens
    ↓
Subsequent calls fail fast (< 1ms)
    ↓
Fallback response returned
    ↓
Service A remains healthy
```

**Interview line:** *"One slow dependency can take down the whole system
without a circuit breaker."*

---

## Resilience4j — The Modern Choice

### Dependencies

```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.1.0</version>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

### Configuration

```yaml
resilience4j:
  circuitbreaker:
    instances:
      userService:
        registerHealthIndicator: true
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: true
        waitDurationInOpenState: 10s
        failureRateThreshold: 50
        slowCallRateThreshold: 50
        slowCallDurationThreshold: 2s
```

### Usage — annotation

```java
@Service
public class UserService {

    private final UserClient userClient;

    public UserService(UserClient userClient) {
        this.userClient = userClient;
    }

    @CircuitBreaker(name = "userService", fallbackMethod = "fallback")
    public User getUser(long id) {
        return userClient.getUser(id);
    }

    private User fallback(long id, Throwable t) {
        return new User(id, "Unknown", "unknown@example.com");
    }
}
```

**Key point:** the fallback method must have the **same signature plus a
`Throwable`** parameter.

### Fallback signature rules

```java
// Original
public User getUser(long id) { ... }

// Valid fallbacks
public User fallback(long id, Throwable t) { ... }
public User fallback(long id, Exception e) { ... }
public User fallback(long id, CallNotPermittedException e) { ... }

// Also valid: no arguments at all except Throwable
public User fallback(Throwable t) { ... }
```

**Invalid:** different parameter order, or no `Throwable`.

---

## Programmatic API

For more control:

```java
@Service
public class UserService {

    private final CircuitBreaker circuitBreaker;
    private final UserClient userClient;

    public UserService(CircuitBreakerRegistry registry, UserClient userClient) {
        this.circuitBreaker = registry.circuitBreaker("userService");
        this.userClient = userClient;
    }

    public User getUser(long id) {
        Supplier<User> decorated = CircuitBreaker.decorateSupplier(
                circuitBreaker, () -> userClient.getUser(id));

        return Try.ofSupplier(decorated)
                .recover(CallNotPermittedException.class, t -> fallback(id))
                .recover(t -> fallback(id))
                .get();
    }
}
```

### Stacking decorators

```java
Supplier<User> decorated = Decorators.ofSupplier(() -> userClient.getUser(id))
        .withCircuitBreaker(circuitBreaker)
        .withRetry(retry)
        .withBulkhead(bulkhead)
        .withTimeLimiter(timeLimiter)
        .withFallback(List.of(Exception.class), t -> fallback(id))
        .decorate();
```

**Order matters** — decorators wrap in the order they're added.

**Interview line:** *"Decorators stack — circuit breaker wraps the call, retry
wraps the breaker, etc."*

---

## Key Configuration Parameters

| Parameter | Meaning | Typical |
|---|---|---|
| `slidingWindowSize` | Number of calls in the rolling window | 10–100 |
| `slidingWindowType` | `COUNT_BASED` or `TIME_BASED` | COUNT_BASED |
| `minimumNumberOfCalls` | Min calls before evaluating | 5–20 |
| `failureRateThreshold` | % failures to open | 50 |
| `slowCallRateThreshold` | % slow calls to open | 50 |
| `slowCallDurationThreshold` | What counts as "slow" | 2s |
| `waitDurationInOpenState` | Time before HALF_OPEN | 10–60s |
| `permittedNumberOfCallsInHalfOpenState` | Probe count | 3–10 |
| `automaticTransitionFromOpenToHalfOpenEnabled` | Auto-transition | true |

### Sliding window types

- **`COUNT_BASED`** — last N calls
- **`TIME_BASED`** — calls in last N seconds

**COUNT_BASED** is more common; **TIME_BASED** handles variable load better.

### Failure rate vs slow call rate

- **Failure rate** — % of calls that threw
- **Slow call rate** — % of calls that took longer than `slowCallDurationThreshold`

Either crossing the threshold opens the breaker.

**Interview line:** *"Slow calls count as failures too — the breaker opens on
either failure rate or slow call rate."*

---

## Fallback Strategies

### 1. Cached response

```java
private User fallback(long id, Throwable t) {
    return cache.get(id);   // return last known good
}
```

### 2. Default value

```java
private User fallback(long id, Throwable t) {
    return User.UNKNOWN;
}
```

### 3. Degraded response

```java
private List<Order> fallback(long userId, Throwable t) {
    return List.of();   // empty list — UI shows "no orders"
}
```

### 4. Queue for later

```java
private Order fallback(OrderRequest req, Throwable t) {
    retryQueue.add(req);   // process later
    return Order.pending();
}
```

### 5. Throw a meaningful exception

```java
private User fallback(long id, Throwable t) {
    throw new ServiceUnavailableException("user-service", t);
}
```

**Interview line:** *"Fallbacks should be graceful — cache, default, or
queue — never silent failure."*

---

## When to Use a Circuit Breaker

### Good candidates

- **Remote calls** — REST, gRPC, DB (indirectly)
- **Third-party services** — payment gateways, SMS, email
- **Non-critical dependencies** — recommendations, analytics

### Bad candidates

- **In-process calls** — no network, no need
- **Critical path dependencies with no fallback** — the app can't function
  without them; still use a breaker, but the fallback should be meaningful
- **Fast, reliable local services** — overhead without benefit

**Interview line:** *"Circuit breakers are for remote calls — the failure mode
they prevent is network-induced."*

---

## Bulkhead — Related but Different

**Bulkhead** limits concurrent calls to a dependency.

```java
@Bulkhead(name = "userService", type = Bulkhead.Type.SEMAPHORE)
public User getUser(long id) { ... }
```

- **Semaphore-based** — limits concurrent calls; runs on the caller thread
- **Threadpool-based** — uses a separate thread pool

**Why:** if one dependency is slow, it can consume all threads. Bulkheads
limit the damage.

| | Circuit Breaker | Bulkhead |
|---|---|---|
| Purpose | Stop calling a failing service | Limit concurrent calls to a service |
| Trigger | Failure threshold | Concurrency limit |
| Both together | ✅ common | ✅ common |

---

## Retry — The Third Leg

**Retry** automatically re-attempts transient failures.

```java
@Retry(name = "userService", fallbackMethod = "fallback")
public User getUser(long id) { ... }
```

```yaml
resilience4j:
  retry:
    instances:
      userService:
        maxAttempts: 3
        waitDuration: 500ms
        enableExponentialBackoff: true
        exponentialBackoffMultiplier: 2
        retryExceptions:
          - java.io.IOException
          - org.springframework.web.client.ResourceAccessException
        ignoreExceptions:
          - com.example.NotFoundException
```

### Retry + Circuit Breaker together

```java
@Retry(name = "userService")
@CircuitBreaker(name = "userService", fallbackMethod = "fallback")
public User getUser(long id) { ... }
```

**Order of application:** the outer annotation wraps the inner one. `@Retry`
outer, `@CircuitBreaker` inner is common.

**Interview line:** *"Retry for transient failures; circuit breaker for
sustained failures. Combine both."*

### Retry storm risk

Naive retry can amplify load during an outage. Use:

- **Exponential backoff**
- **Jitter** — random delay to spread retries
- **Circuit breaker** to stop retries when the breaker is open

**Interview line:** *"Retries without backoff or a circuit breaker create
retry storms."*

---

## Timeout / TimeLimiter

```java
@TimeLimiter(name = "userService")
public CompletableFuture<User> getUserAsync(long id) { ... }
```

Limits how long a call can take. Requires reactive or async return types.

**Note:** for synchronous calls, use the underlying HTTP client's timeout
(`RestTemplate`, `WebClient`, Feign).

**Interview line:** *"TimeLimiter works with async; for sync, configure HTTP
client timeouts."*

---

## Combining All Four — Resilience4j Stack

```java
@Service
public class UserService {

    @Bulkhead(name = "userService")
    @TimeLimiter(name = "userService")
    @CircuitBreaker(name = "userService", fallbackMethod = "fallback")
    @Retry(name = "userService")
    public CompletableFuture<User> getUserAsync(long id) {
        return CompletableFuture.supplyAsync(() -> userClient.getUser(id));
    }

    private CompletableFuture<User> fallback(long id, Throwable t) {
        return CompletableFuture.completedFuture(User.UNKNOWN);
    }
}
```

**Order (outer → inner):**

1. Bulkhead — concurrency limit first
2. TimeLimiter — timeout
3. CircuitBreaker — fail fast if open
4. Retry — inside, retries individual attempts

**Interview line:** *"Bulkhead → TimeLimiter → CircuitBreaker → Retry is the
canonical order."*

---

## Monitoring

### Actuator endpoints

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,circuitbreakers,circuitbreakerevents,retries
  health:
    circuitbreakers:
      enabled: true
```

```
GET /actuator/circuitbreakers
GET /actuator/circuitbreakerevents/userService
GET /actuator/health
```

### Metrics

Resilience4j exposes Micrometer metrics:

- `resilience4j_circuitbreaker_state`
- `resilience4j_circuitbreaker_calls_total`
- `resilience4j_circuitbreaker_failure_rate`

**Alert on:** state transitions to OPEN, high failure rate, calls to fallback.

**Interview line:** *"If your circuit breaker isn't monitored, you won't
notice when it opens."*

---

## Hystrix vs Resilience4j

| | Hystrix | Resilience4j |
|---|---|---|
| Status | Maintenance (deprecated) | Active |
| Thread model | Thread pool isolation (default) | Semaphore or thread pool |
| Config | Annotations | Annotations + config |
| Metrics | Hystrix Dashboard | Micrometer |
| Extras | Bundled bulkhead, cache | Modular — pick what you need |
| Spring Cloud | Legacy | Modern |

**Interview line:** *"Hystrix is dead; Resilience4j is the replacement."*

---

## Tricky Corners ⚠️

**Fallback method must have the same signature plus `Throwable`.** Otherwise
Spring throws at startup.

**Fallback runs for ANY exception** including programming errors. Don't
silently swallow NPEs — log them.

**Circuit breaker state is per-instance, not per-cluster.** Each service
instance has its own breaker. If one instance has a bad connection to a
dependency, only its breaker opens.

**`slidingWindowSize` with `minimumNumberOfCalls`** means the breaker needs
N calls before it can open. Under low traffic, it may never trip.

**`TimeLimiter` requires async return types.** Synchronous methods ignore it.

**Retry + CircuitBreaker order matters.** Retry outside the breaker means
retries happen even when the breaker would be open. Retry inside the breaker
means retries are counted as one circuit-breaker call.

**Fallback must not throw.** If it throws, the exception propagates.

**Circuit breakers don't protect against all failures** — only network/
remote-call failures. CPU/memory issues need different handling.

**Slow calls count as failures** — set `slowCallDurationThreshold` carefully.

**Open state duration is per breaker.** Coordinating across instances requires
external state (Redis, etc.).

**`@CircuitBreaker` and `@Retry` on the same method** — Spring AOP ordering
must be right. Set `spring.aop.auto=true` and use `@EnableAspectJAutoProxy`.

**Fallback method can't be `private` and used across proxies** in some
setups. Make it `public` or `protected`.

**Testing fallback methods is a separate task.** Mock the underlying client
to throw and assert the fallback behavior.

**Ignore exceptions configuration is essential** — otherwise 4xx errors count
as failures and open the breaker unnecessarily.

---

## Common Pitfalls

- No fallback method — the caller sees the raw exception.
- Fallback throwing — swallows the original problem.
- Setting thresholds too aggressively — breaker opens on normal traffic.
- Not monitoring breaker state — opens silently.
- Retry without backoff — retry storms.
- Using circuit breakers on in-process calls.
- Assuming breaker state is shared across instances.
- Ignoring exception patterns in `ignoreExceptions`.
- Not combining with timeouts.

---

## Key Interview Tips

- Draw the **CLOSED → OPEN → HALF_OPEN** state diagram.
- Say **"circuit breakers fail fast to prevent cascading failures."**
- Know the **key parameters**: failure rate, slow call rate, wait duration,
  sliding window size.
- Say **"slow calls count as failures."**
- Explain **fallback strategies** — cached, default, queue.
- Say **"combine retry + circuit breaker + bulkhead + time limiter."**
- Mention **Hystrix is dead; Resilience4j is the modern choice.**
- Know that **`/actuator/circuitbreakers`** exposes state for monitoring.

---

## Related

- [Service Discovery](service-discovery.md) — where the target services come
  from
- [API Gateway](api-gateway.md) — gateway-level circuit breaker integration
- [Feign & Tracing](feign-and-tracing.md) — circuit breaker on Feign clients
- [Executors & Futures](../../java/concurrency/executors-and-futures.md) —
  thread pool isolation background