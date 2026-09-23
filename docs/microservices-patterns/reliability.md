# Reliability

> **Spring context:** Resilience4j (circuit breaker, retry, bulkhead, rate limiter, time limiter) is the modern replacement for Hystrix. Spring Cloud Circuit Breaker abstracts over Resilience4j. Spring Retry is still used for simpler cases. Timeouts come from the HTTP client (`RestClient`, `WebClient`, Feign) and DB drivers.

## Mental Model

In a distributed system, **failure is normal, not exceptional**. The goal is not to prevent failure — it is to prevent **cascading failure**. Every reliability pattern exists to bound the blast radius of a failure.

The mental model: every remote call can fail in one of five ways:

```d2
direction: right

call: Remote Call
slow: "Slow\\n(timeout)"
err: "Error\\n(5xx, connection refused)"
part: "Partial\\n(some requests fail)"
down: "Down\\n(whole dependency)"
brown: "Brownout\\n(intermittent, degraded)"

call -> slow
call -> err
call -> part
call -> down
call -> brown
```

For each failure mode, you have a pattern:

| Failure | Pattern |
|---|---|
| Slow | Timeout, Circuit Breaker |
| Error | Retry with Backoff |
| Partial | Bulkhead, Fallback |
| Down | Circuit Breaker, Fallback |
| Brownout | Rate Limiting, Load Shedding |

## The Reliability Stack

```d2
direction: right

caller: Caller
timeout: "Timeout\\n(bound wait)"
retry: "Retry\\n(bounded, backoff)"
cb: "Circuit Breaker\\n(stop calling a dead dep)"
bulk: "Bulkhead\\n(isolate resources)"
rate: "Rate Limiter\\n(protect downstream)"
fb: "Fallback\\n(degrade gracefully)"

caller -> timeout
timeout -> retry
retry -> cb
cb -> bulk
bulk -> rate
rate -> fb
```

Order matters: **timeout outermost, fallback innermost.** Retry inside timeout so retries respect the overall budget.

## Timeout

The single most important reliability pattern. **No timeout = infinite wait = thread pool exhaustion = cascading failure.**

Rules:
- Every remote call has a timeout.
- Timeout < caller's timeout. Otherwise the caller waits forever.
- Set at the HTTP client, not at the business layer.
- Different timeouts for different dependencies (fast cache vs slow report).

```java
// Spring RestClient
@Bean
RestClient restClient() {
    var factory = new JdkClientHttpRequestFactory();
    factory.setReadTimeout(Duration.ofSeconds(2));
    return RestClient.builder().requestFactory(factory).build();
}

// WebClient
@Bean
WebClient webClient() {
    var httpClient = HttpClient.create()
        .responseTimeout(Duration.ofSeconds(2));
    return WebClient.builder().clientConnector(new ReactorClientHttpConnector(httpClient)).build();
}
```

**Rule of thumb:** p99 of the downstream + 20% headroom. If you don't know p99, you don't know the timeout.

## Retry with Backoff

Retry transient failures. Do not retry:
- 4xx (except 429)
- Non-idempotent operations (unless idempotency key present)
- Timeouts on non-idempotent writes

Do retry:
- 5xx
- Connection refused/reset
- 429 (with `Retry-After`)
- Timeouts on idempotent operations

```java
RetryConfig config = RetryConfig.custom()
    .maxAttempts(3)
    .waitDuration(Duration.ofMillis(100))
    .intervalFunction(IntervalFunction.ofExponentialBackoff(100, 2.0))
    .retryExceptions(IOException.class, TimeoutException.class)
    .ignoreExceptions(BusinessException.class)
    .build();

Retry retry = Retry.of("payments", config);

Supplier<Payment> decorated = Retry.decorateSupplier(retry, () -> paymentClient.charge(req));
```

**Exponential backoff with jitter** — without jitter, all clients retry in sync and hammer the recovering dependency (thundering herd).

```java
IntervalFunction.ofExponentialRandomBackoff(100, 2.0, 0.5)
```

**Retry budget:** bound total retry attempts across the fleet. Otherwise retries amplify load during incidents.

## Circuit Breaker

Stop calling a dependency that is failing. Three states:

```d2
direction: right

closed: "Closed\\n(normal, calls pass)"
open: "Open\\n(calls fail fast)"
half: "Half-Open\\n(probe with limited calls)"

closed -> open
open -> half
half -> closed
half -> open
```



- **Closed:** normal operation. Counts failures.
- **Open:** threshold exceeded. Calls fail immediately (no network call).
- **Half-Open:** after a wait, allow a few probe calls. Success → Closed; failure → Open.

```java
CircuitBreakerConfig cbConfig = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)
    .slowCallRateThreshold(50)
    .slowCallDurationThreshold(Duration.ofSeconds(2))
    .waitDurationInOpenState(Duration.ofSeconds(30))
    .permittedNumberOfCallsInHalfOpenState(5)
    .slidingWindowSize(20)
    .minimumNumberOfCalls(10)
    .build();

CircuitBreaker cb = CircuitBreaker.of("payments", cbConfig);

Supplier<Payment> decorated = CircuitBreaker.decorateSupplier(cb, () -> paymentClient.charge(req));
```

**Why it matters:** without a circuit breaker, a slow dependency ties up threads, which exhausts the caller's thread pool, which fails the caller's other endpoints, which cascades up the chain. The breaker cuts the call and returns fast, freeing threads.

**Fallback:** every breaker should have a fallback. Cached value, default, or a friendly error. Never let it silently 500.

## Bulkhead

Isolate resources so one slow dependency doesn't consume all threads/connections.

| Bulkhead type | Isolation |
|---|---|
| Thread pool | Each dependency gets its own pool |
| Semaphore | Limit concurrent calls per dependency |
| Connection pool | Per-dependency connection pools |

```java
BulkheadConfig bhConfig = BulkheadConfig.custom()
    .maxConcurrentCalls(20)
    .maxWaitDuration(Duration.ofMillis(10))
    .build();
Bulkhead bulkhead = Bulkhead.of("inventory", bhConfig);
```

Without a bulkhead, one slow dependency can starve all others (shared thread pool). With it, the slow dependency fails fast for its callers, and other endpoints keep working.

Spring angle: WebClient with a dedicated `ConnectionProvider` per downstream, or dedicated `ThreadPoolTaskExecutor` per dependency.

## Rate Limiting

Protect yourself or a downstream from too much traffic.

| Placement | Purpose |
|---|---|
| At the API gateway | Protect all services from abusive clients |
| At the service | Protect a specific downstream |
| Per-tenant / per-user | Fairness |
| Per-endpoint | Protect expensive operations |

Algorithms:
- **Token bucket** — smooth bursts, configurable rate.
- **Leaky bucket** — constant output rate.
- **Fixed window** — simple, bursty at boundaries.
- **Sliding window** — smooth, more state.

```java
RateLimiterConfig rlConfig = RateLimiterConfig.custom()
    .limitForPeriod(100)
    .limitRefreshPeriod(Duration.ofSeconds(1))
    .timeoutDuration(Duration.ZERO) // fail fast
    .build();
RateLimiter rl = RateLimiter.of("orders", rlConfig);
```

**Client-side rate limiting** protects the downstream; **server-side** protects yourself. You often need both.

## Fallback

Every remote call needs a plan B:

| Fallback | Example |
|---|---|
| Cached value | Return last known price |
| Default | Return empty list |
| Degraded feature | Hide recommendations |
| Async retry | Queue and retry later |
| Friendly error | "Please try again" |

```java
Supplier<Recommendations> withFallback = Decorators.ofSupplier(() -> recClient.get(userId))
    .withCircuitBreaker(cb)
    .withFallback(List.of(CallNotPermittedException.class), e -> Recommendations.empty())
    .decorate();
```

**Rule:** a fallback that returns wrong data is worse than an error. Make fallbacks semantically safe.

## Idempotency

Every retryable operation must be idempotent. Otherwise retries create duplicates.

Patterns:
- **Idempotency key** in the request (client-generated UUID). Server stores processed keys.
- **Natural key** — business-unique (order ID, email + date).
- **Conditional writes** — `INSERT ... ON CONFLICT DO NOTHING`.

```java
@PostMapping("/payments")
public Payment create(@RequestHeader("Idempotency-Key") String key, @RequestBody PaymentRequest req) {
    return paymentService.chargeIdempotent(key, req);
}
```

```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Rule:** any operation you retry must be idempotent. Any operation that mutates external state must have an idempotency key.

## Dead Letter Queue

Failed messages after retries go to a DLQ for inspection and replay. Detailed in [`kafka/patterns.md`](../kafka/patterns.md).

Rules:
- DLQ must be **monitored** (depth alert).
- DLQ must have **replay tooling**.
- DLQ must be **bounded** in size.
- Non-retryable errors go straight to DLQ (validation, schema).

## Putting It Together

Full resilience stack for a remote call:

```java
Supplier<Result> decorated = Decorators.ofSupplier(() -> client.call(req))
    .withCircuitBreaker(cb)          // stop calling a dead dep
    .withBulkhead(bulkhead)          // isolate resources
    .withRateLimiter(rateLimiter)    // protect downstream
    .withRetry(retry)                // bounded retries
    .withTimeLimiter(timeLimiter)    // overall budget
    .withFallback(List.of(Exception.class), e -> Result.fallback())
    .decorate();
```

Order (outermost to innermost): **TimeLimiter → Retry → CircuitBreaker → RateLimiter → Bulkhead → call → Fallback**.

## Tricky Corners ⚠️

- **Retries without idempotency = duplicates.** Always pair.
- **Retries without jitter = thundering herd.** Always jitter.
- **Retries without a budget amplify load** during incidents.
- **Circuit breaker without a fallback** turns a slow failure into a fast failure — better, but still a failure.
- **Timeout must be shorter than caller's timeout**, or the caller's thread waits.
- **Bulkhead without monitoring** can silently drop traffic.
- **Rate limiting server-side without client-side** means you drop requests instead of shaping them.
- **Fallback returning stale/wrong data is worse than an error.**
- **Circuit breaker thresholds need calibration** — default 50% over 20 calls is often wrong.
- **Half-open probes must be limited**; otherwise a recovering dependency is hammered.
- **Idempotency keys need a TTL** — otherwise the table grows forever.
- **DLQ without replay is data loss.**

## Common Pitfalls

- No timeouts on HTTP clients (default = infinite).
- Retrying 4xx.
- Retrying non-idempotent operations.
- No jitter on retry backoff.
- Circuit breaker with no fallback.
- Shared thread pool across dependencies (no bulkhead).
- Rate limiting only at the gateway (no per-service protection).
- Idempotency keys in memory (lost on restart).
- DLQ with no monitoring or replay.
- Fallbacks that hide real failures.

## Key Interview Tips

- Lead with **"bound the blast radius of failure."**
- For "how do you handle a slow dependency?", answer **"timeout + circuit breaker + bulkhead + fallback."**
- For "how do you handle transient failures?", answer **"retry with exponential backoff and jitter, on idempotent operations only."**
- For "how do you prevent cascading failure?", answer **"timeouts shorter than caller's, bulkheads per dependency, circuit breakers with fallbacks."**
- For "how do you prevent duplicates?", answer **"idempotency keys + dedupe store in the same transaction as the side effect."**
- For "what's the ordering of resilience patterns?", answer **"timeout → retry → breaker → rate limit → bulkhead → call → fallback."**
- Always name the anti-pattern: **retry without idempotency.**

## Related

- [Microservices Patterns index](index.md)
- [Communication](communication.md)
- [Data Management](data-management.md)
- [Observability](observability.md)
- [Kafka → Delivery Semantics](../kafka/delivery-semantics.md)
- [Kafka → Patterns](../kafka/patterns.md)