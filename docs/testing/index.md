# Testing Strategy

> **JDK context:** Java 17+ — JUnit 5, Mockito, Testcontainers, Spring Boot Test, AssertJ. This file covers strategy, trade-offs, and structure — not framework syntax.

## Mental Model

Testing is **risk management**, not coverage theatre. Every test you write buys confidence at a cost — writing time, run time, maintenance time. The goal is maximum *useful* confidence per unit of cost, not 100% line coverage.

| Layer | Scope | Speed | Cost to maintain | Confidence | Typical share |
|---|---|---|---|---|---|
| Unit | One class or function | Milliseconds | Low | Low (isolated) | 60–70% |
| Integration | Module + real infra (DB, queue, HTTP) | Seconds | Medium | Medium | 20–30% |
| Contract | Consumer ↔ provider API shape | Seconds | Medium | High for API | 5–10% |
| End-to-End | Whole system, one user journey | Minutes | High | High but brittle | 5–10% |
| Exploratory | Human judgement, edge discovery | Hours | High | Catches UX/logic gaps | As needed |

The pyramid is a heuristic, not a law. A pure library has almost no integration tests. A microservice platform may legitimately have more integration than unit tests. What matters is that each layer exists for a *reason you can state out loud*.

## The Testing Pyramid

```d2
direction: up

unit: "Unit Tests\nfast, isolated, many"
integration: "Integration Tests\nslower, real deps, fewer"
e2e: "End-to-End Tests\nslowest, brittle, fewest"

unit -> integration: "broader scope"
integration -> e2e: "broader scope"
```

### Why the shape matters

- **Wide base (unit).** Cheap to write, cheap to run, pinpoint failure location. Gives fast feedback during development.
- **Narrow middle (integration).** Verifies the wiring that units deliberately mock away — transactions, serialization, SQL, HTTP contracts.
- **Thin top (E2E).** Only for critical user journeys. Slowest and most brittle because every dependency is real.

An **ice-cream cone** (many E2E, few unit tests) is the classic anti-pattern: slow CI, flaky failures, high maintenance, low debugging signal.

A **testing trophy** (Kent C. Dodds) leans heavier on integration and is popular in frontend/Node — the principle still applies: *test where the confidence-per-cost ratio is highest for your system*.

## What to Test at Each Level

### Unit tests

**Test**
- Pure logic: calculations, parsers, validators, state machines
- Edge cases: null, empty, boundary values, overflow, unicode
- Error paths: exceptions, fallbacks, defensive branches

**Don't test**
- Getters, setters, trivial delegation
- Framework wiring (Spring does that)
- Anything requiring the whole application to boot

```java
// Example: a discount calculator has clear unit boundaries
class DiscountCalculatorTest {

    private final DiscountCalculator calc = new DiscountCalculator();

    @Test
    void appliesNoDiscountBelowThreshold() {
        assertEquals(100.0, calc.apply(100.0, CustomerTier.REGULAR));
        // Expected: 100.0 (below 500 threshold)
    }

    @Test
    void appliesTenPercentForRegularAboveThreshold() {
        assertEquals(540.0, calc.apply(600.0, CustomerTier.REGULAR));
        // Expected: 540.0 (10% off 600)
    }

    @Test
    void rejectsNegativeAmount() {
        assertThrows(IllegalArgumentException.class,
                () -> calc.apply(-1.0, CustomerTier.REGULAR));
        // Expected: IllegalArgumentException
    }
}
```

### Integration tests

**Test**
- Repository queries against a real database (Testcontainers)
- HTTP clients against WireMock or a real downstream
- Message producer/consumer against an embedded broker or Testcontainers
- Transaction boundaries, rollback, isolation levels
- Serialization/deserialization round-trips (JSON, Avro, Protobuf)

```java
@DataJpaTest
@Testcontainers
class OrderRepositoryIT {

    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
    }

    @Autowired OrderRepository repo;

    @Test
    void findsOrdersByStatusAndWindow() {
        repo.save(new Order("A", OrderStatus.PAID, Instant.now()));
        var result = repo.findByStatus(OrderStatus.PAID);
        assertEquals(1, result.size());
        // Expected: 1 (only the PAID order returned)
    }
}
```

### Contract tests

Consumer-driven contracts (Pact, Spring Cloud Contract) verify that a consumer's expectations match the provider's actual response — without running both in the same pipeline. Covered in depth in `microservices-patterns/contract-testing.md`.

### End-to-end tests

**Keep to a minimum**
- Signup → login → first action
- Checkout → payment → confirmation
- Deploy smoke test: hit `/health`, hit one critical endpoint

**Avoid**
- Using E2E to test business logic (that's a unit test)
- Using E2E as the only regression net (too slow, too flaky)

### Exploratory testing

Not automated. A human with domain knowledge pokes at the system looking for the cases nobody thought to write down. Cheap to run, high signal for UX and unusual inputs. Pairs well with **session-based test management** (time-boxed charters).

## Test Doubles

| Double | What it does | When to use |
|---|---|---|
| **Dummy** | Passed but never used | Fill required constructor params |
| **Stub** | Returns canned answers | Force a code path (e.g. `findById → Optional.empty()`) |
| **Spy** | Records calls, real behaviour | Verify an interaction occurred without replacing logic |
| **Mock** | Pre-programmed expectations | Verify interaction with strict expectations |
| **Fake** | Working simplified implementation | In-memory repository, fake clock, fake queue |

**Prefer fakes over mocks** when the real collaborator is complex. A single in-memory `OrderRepository` beats ten `when(repo.findById(...))` setups — it survives refactors and reads like production code.

```java
// Fake clock — deterministic tests for time-dependent code
public class FakeClock extends Clock {
    private Instant now = Instant.parse("2024-01-01T00:00:00Z");

    @Override public ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(ZoneId zone) { return this; }
    @Override public Instant instant() { return now; }

    public void advance(Duration d) { now = now.plus(d); }
}

// Usage
FakeClock clock = new FakeClock();
TokenService service = new TokenService(clock);
String token = service.issue("user-1");
clock.advance(Duration.ofHours(2));
assertThat(service.isExpired(token)).isTrue();
// Expected: true (token TTL is 1 hour)
```

## Quality Gates

Quality gates are automated checkpoints that block progression. They live in CI, not in a wiki page nobody reads.

| Gate | Runs on | Blocks on | Typical tool |
|---|---|---|---|
| Compile + static analysis | Every push | Errors, high-severity warnings | `mvn verify`, SpotBugs, Error Prone |
| Unit tests | Every push | Any failure | JUnit 5 + Surefire |
| Integration tests | Every PR | Any failure | Failsafe + Testcontainers |
| Coverage threshold | Every PR | Below configured % on *changed* lines | JaCoCo |
| Contract tests | Every PR (consumer + provider) | Breaking change without version bump | Pact, Spring Cloud Contract |
| Security scan | Every PR | Critical CVEs, secret leaks | Snyk, Trivy, gitleaks |
| E2E smoke | Post-deploy to staging | Failing critical journey | Playwright, Cypress |
| Performance budget | Nightly / pre-release | p95 regression beyond threshold | Gatling, k6 |

**Coverage rule of thumb:** 70–80% line coverage on *business logic* is a reasonable target. 100% is a vanity metric — you end up testing getters and generated code. Better to gate on **changed-lines coverage** than global.

## Test Data

Three failure modes, all common:

1. **Shared mutable fixtures** — one test mutates data another test depends on. Tests pass in isolation, fail in a suite.
2. **Production data copies** — PII leaks into CI logs, and the shape drifts from code.
3. **Hand-rolled per-test data** — verbose, duplicated, and hides intent behind boilerplate.

**Rules**

- **Fresh state per test.** Use `@Transactional` on integration tests, or recreate schema with Flyway/Liquibase between classes.
- **Builders, not constructors.** `anOrder().withStatus(PAID).build()` reads better than a 9-arg constructor.
- **Synthetic, deterministic data.** Never copy production. Use libraries like `Instancio`, `EasyRandom`, or hand-written builders.
- **Freeze time.** Inject `Clock`, not `Instant.now()`.

```java
// Test data builder — readable intent
class AnOrder {
    private String id = "ord-1";
    private OrderStatus status = OrderStatus.PENDING;
    private Instant createdAt = Instant.parse("2024-01-01T00:00:00Z");

    static AnOrder order() { return new AnOrder(); }
    AnOrder withStatus(OrderStatus s) { this.status = s; return this; }
    AnOrder createdAt(Instant t) { this.createdAt = t; return this; }
    Order build() { return new Order(id, status, createdAt); }
}

// Usage — intent is obvious
Order paid = AnOrder.order().withStatus(OrderStatus.PAID).build();
// Expected: Order[id=ord-1, status=PAID, createdAt=2024-01-01T00:00:00Z]
```

## Flaky Tests

A flaky test is worse than no test — it erodes trust in the suite and hides real regressions behind "just rerun it".

**Root causes, ranked by frequency**

1. **Time** — `Instant.now()`, `System.currentTimeMillis()`, `Thread.sleep()` for ordering.
2. **Concurrency** — real threads racing; shared state between tests.
3. **External dependencies** — network, DNS, third-party APIs.
4. **Order dependence** — test B assumes test A ran first.
5. **Port/resource conflicts** — fixed ports, fixed temp paths.
6. **Non-deterministic collections** — iterating a `HashSet` and asserting order.

**Fixes**

| Cause | Fix |
|---|---|
| Time | Inject `Clock`; freeze time |
| Sleep | Awaitility with `await().until(...)`, not `Thread.sleep` |
| Shared state | `@DirtiesContext`, fresh schema per class, unique test data |
| Order dependence | Randomize test order in CI (JUnit 5 `MethodOrderer.Random`) |
| Ports | Use `0` for random port; Testcontainers assigns ports |
| External calls | WireMock, Testcontainers, fakes |
| Random order | Sort collections or assert as set |

**Policy:** a flaky test must be **quarantined** (tagged `@Tag("flaky")` and excluded from the required CI gate) within one day, and **fixed or deleted** within a week. Never merge a "retry" annotation to paper over flakiness.

```java
// Correct: wait for condition, don't sleep
await().atMost(Duration.ofSeconds(5))
       .pollInterval(Duration.ofMillis(50))
       .until(() -> orderRepo.findById(id).map(Order::status)
                                  .orElse(null) == OrderStatus.PAID);
// Expected: returns when PAID is observed, or throws after 5s
```

## Tricky Corners ⚠️

- **`@Transactional` on tests rolls back by default** — good for isolation, bad if you want to assert on data written by another thread/connection.
- **`@SpringBootTest` boots the whole context** — slow. Prefer `@DataJpaTest`, `@WebMvcTest`, `@JsonTest` where possible.
- **`@MockBean` replaces the bean in the context** — multiple `@MockBean` for the same type silently collapse into one.
- **Testcontainers reuse** — set `testcontainers.reuse.enable=true` in `~/.testcontainers.properties` for much faster local runs; leave it off in CI.
- **Surefire vs Failsafe** — `*Test` runs in Surefire (unit), `*IT` runs in Failsafe (integration). Mixing them up means your integration tests never run in `mvn test`.
- **Parallel execution** — JUnit 5 can parallelize, but shared `static` state or `@Transactional` rollback semantics often break. Enable only when your tests are truly isolated.
- **AssertJ vs JUnit assertions** — AssertJ produces better failure messages and reads fluently. Pick one and stick to it.
- **Coverage on changed lines ≠ coverage on behaviour** — a green coverage bar can still miss every edge case. Coverage is a smell detector, not proof of correctness.

## Common Pitfalls

- Testing implementation, not behaviour — assertions on private methods, internal call order, or log lines.
- One assertion per test as a religious rule — sometimes asserting a coherent outcome requires three assertions.
- Mocking everything, including value objects — mocks on `String`, `Instant`, or DTOs are pure noise.
- Using `Thread.sleep()` to wait for async work.
- Sharing mutable fixtures across tests via `static` fields.
- Skipping integration tests because "unit tests cover it" — they don't; they cover logic, not wiring.
- Copying production data into CI.
- Treating coverage as a goal instead of a signal.
- Letting flaky tests sit in the main pipeline with `@Retry` instead of fixing them.

## Key Interview Tips

- **Lead with the pyramid, then qualify it.** "The pyramid is the default; here's when I'd deviate" signals seniority.
- **Talk about confidence per cost**, not "we need 100% coverage".
- **Name the failure modes you've seen** — flaky time-based tests, order-dependent suites, E2E-as-regression-net.
- **Explain a real trade-off**: "We dropped E2E from 200 to 20 by adding contract tests; CI time went from 45 min to 12 min, and flake rate dropped from 8% to <1%."
- **Know where you'd put a bug fix test**: reproduce at the lowest level that can catch it, then rely on integration/E2E to cover the wiring.
- **Mention Testcontainers by name** — it's the modern default for JVM integration testing and interviewers notice.
- **Shift-left is a testing theme too** — link it to `leadership/shift-left.md`.

## Related

- [TDD, BDD & ATDD](tdd-bdd-atdd.md)
- [Contract Testing](../microservices-patterns/contract-testing.md)
- [Shift-Left](../leadership/shift-left.md)
- [SDLC Lifecycle](../leadership/sdlc-lifecycle.md)
- [Observability](../observability/index.md)