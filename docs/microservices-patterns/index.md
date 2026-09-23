# Microservices Patterns

> **Spring context:** Spring Boot 3.x + Spring Cloud 2023.x. The pattern names below come from Chris Richardson's catalog; the implementations are the ones you'll actually wire in a Spring stack (Spring Cloud Gateway, OpenFeign, Resilience4j, Spring Cloud Stream, Spring Modulith).

## Mental Model

A microservices architecture is **not** "many small services." It is a set of **forces** that push you apart (independent deployability, team autonomy, independent scaling, fault isolation) and a set of **costs** that pull you together (network latency, partial failure, distributed data, operational surface).

Every pattern in this section exists to pay one of those costs. If a pattern doesn't map to a cost you actually have, it's cargo cult.

```d2
direction: right

forces: Forces
apart: Push Apart
p1: Independent deploy
p2: Team autonomy
p3: Independent scale
p4: Fault isolation
together: Pull Together
t1: Network latency
t2: Partial failure
t3: Distributed data
t4: Operational surface
patterns: Patterns
decomp: Decomposition
comm: Communication
data: Data Management
rel: Reliability
obs: Observability
dep: Deployment
sec: Security

apart -> decomp
together -> rel
decomp -> comm
comm -> data
```

## When Microservices (and When Not To)

| Signal | Monolith | Microservices |
|---|---|---|
| Team size | < 10 devs | Multiple teams, independent roadmaps |
| Deploy cadence | Weekly/monthly | Per-service, multiple times/day |
| Scaling | Uniform | Per-service, asymmetric |
| Domain clarity | Evolving | Bounded contexts identified |
| Ops maturity | Low | CI/CD, observability, on-call |
| Data model | Shared, transactional | Per-service, eventual consistency |
| Failure tolerance | Whole-app failures | Partial degradation acceptable |

**Default to a modular monolith.** Extract services when you have a concrete force (team scaling, deploy cadence, asymmetric load) — not because microservices are "modern." Spring Modulith is the pragmatic middle: enforce module boundaries in-process, extract later if needed.

## Pattern Map

```d2
direction: right

decomp: Decomposition
d1: Business Capability
d2: DDD Bounded Context
d3: Strangler Fig
d4: Sidecar
comm: Communication
c1: API Gateway
c2: BFF
c3: Service Mesh
c4: Sync vs Async
c5: gRPC vs REST vs GraphQL
data: Data Management
m1: DB per Service
m2: Saga
m3: API Composition
m4: CQRS
m5: Event Sourcing
m6: Outbox
m7: CDC
rel: Reliability
r1: Circuit Breaker
r2: Retry + Backoff
r3: Bulkhead
r4: Timeout
r5: Rate Limit
r6: Fallback
r7: Idempotency
r8: DLQ
obs: Observability
o1: Distributed Tracing
o2: Correlation ID
o3: Health Checks
o4: Log Aggregation
o5: Metrics
o6: Audit
dep: Deployment
p1: Blue-Green
p2: Canary
p3: Feature Flags
p4: Rolling Update
p5: Shadow
p6: Serverless
sec: Security
s1: Access Token
s2: API Gateway Auth
s3: Zero Trust
s4: mTLS
s5: Secrets

decomp -> comm
comm -> data
data -> rel
rel -> obs
obs -> dep
dep -> sec
```

## The Seven Patterns Files

| File | Focus | Key patterns |
|---|---|---|
| `decomposition.md` | How to split | Business capability, DDD, Strangler Fig, Sidecar |
| `communication.md` | How services talk | API Gateway, BFF, Service Mesh, sync/async, gRPC/REST/GraphQL |
| `data-management.md` | How data stays consistent | DB per Service, Saga, API Composition, CQRS, Event Sourcing, Outbox, CDC |
| `reliability.md` | How to survive failure | Circuit Breaker, Retry, Bulkhead, Timeout, Rate Limit, Fallback, Idempotency, DLQ |
| `observability.md` | How to see what's happening | Tracing, Correlation ID, Health Checks, Logs, Metrics, Audit |
| `deployment.md` | How to ship safely | Blue-Green, Canary, Feature Flags, Rolling, Shadow, Serverless |
| `security.md` | How to keep it safe | Access Token, Gateway Auth, Zero Trust, mTLS, Secrets |

## Cross-Cutting Concerns

Three concerns touch every pattern and deserve first-class treatment:



1. **Contracts.** Every sync call is a contract. Version them (URL, header, or schema registry). Breaking changes require consumer-driven contract tests (Pact) or explicit deprecation windows.
2. **Idempotency.** Every retryable operation needs it. This is the single most-skipped pattern and the source of most production duplicates.
3. **Observability.** Every pattern above is undebuggable without correlation IDs, distributed tracing, and structured logs. Build this in from day one, not after the first incident.

## Anti-Patterns to Name in Interviews

- **Distributed monolith** — services that must be deployed together.
- **Shared database** — services coupled through a schema they all write.
- **Nanoservices** — services so small they're RPC calls dressed up as services.
- **Chatty services** — one user action triggers 20 synchronous calls.
- **God gateway** — API gateway with business logic.
- **Saga as distributed transaction** — treating eventual consistency as ACID.
- **Event soup** — no schema, no ownership, no versioning on events.
- **Sync chains** — A→B→C→D synchronous; latency and failure multiply.

## Decision Frameworks

### Monolith vs Microservices

| Factor | Monolith | Microservices |
|---|---|---|
| Team autonomy | Low | High |
| Deploy risk | Whole app | Per service |
| Latency | In-process | Network |
| Data consistency | ACID | Eventual |
| Ops cost | Low | High |
| Debugging | Stack traces | Distributed tracing |
| Scaling | Uniform | Per service |

**Rule:** if you cannot articulate the specific force pushing you to microservices, you don't need them.

### Sync vs Async

| Use sync when | Use async when |
|---|---|
| Caller needs the result to proceed | Caller can proceed without the result |
| Latency budget allows it | Latency budget is tight and work is long |
| Failure should propagate | Failure should be absorbed / retried |
| Simple request-reply | Fan-out, events, streams |

**Default to async for cross-service state changes; sync for reads and user-facing queries.**

### Choreography vs Orchestration

| Choreography | Orchestration |
|---|---|
| No central coordinator | Central orchestrator |
| Loose coupling | Explicit flow |
| Hard to see end-to-end | Easy to reason about |
| Cyclic deps risk | God-service risk |
| Best for simple flows | Best for complex flows with compensation |

## Tricky Corners ⚠️

- **Microservices are an org design choice as much as a technical one.** Conway's Law is not optional.
- **"Independent deployability" is the acid test.** If two services must deploy together, they're one service.
- **Distributed transactions do not exist.** You get eventual consistency + compensations.
- **Network is not reliable, not low-latency, not free.** Design for it.
- **Shared libraries are coupling.** Use them for cross-cutting concerns, not domain logic.
- **Service mesh solves transport, not semantics.** Retries, timeouts, circuit breaking still need app-level config.
- **API gateway is not a service.** No business logic.
- **Event schemas are APIs.** Version them like you version REST.

## Common Pitfalls

- Splitting by technical layer (`user-service`, `order-service`, `notification-service`) instead of business capability.
- Sharing a database "just for now" — it becomes permanent coupling.
- Synchronous chains 4+ deep — latency and failure multiply.
- No idempotency on retryable operations.
- No distributed tracing — debugging becomes archaeology.
- Over-engineering for scale you don't have.
- Treating Kafka as a message queue instead of a log (see `kafka/`).
- Skipping contract tests, then discovering breaking changes in prod.

## Key Interview Tips

- Lead with **"microservices are an org design choice"** — it signals seniority.
- For "how to split?", answer with **business capability + DDD bounded context**, not technical layers.
- For "how to keep data consistent?", answer with **DB per service + saga + outbox**, and explicitly say **"no distributed transactions."**
- For "how do services talk?", answer with **sync for reads/queries, async for state changes**, and name the trade-offs.
- For "how do you debug?", answer with **correlation ID + distributed tracing + structured logs**.
- For "when NOT microservices?", answer with **"when the team is small and the domain is still evolving — a modular monolith is the right default."**
- Always name at least one **anti-pattern** you'd avoid (distributed monolith, shared DB, chatty services).

## Related

- [Decomposition](decomposition.md)
- [Communication](communication.md)
- [Data Management](data-management.md)
- [Reliability](reliability.md)
- [Observability](observability.md)
- [Deployment](deployment.md)
- [Security](security.md)
- [Kafka → Patterns](../kafka/patterns.md)
- [Architecture → Trade-off Analysis](../architecture/trade-off-analysis.md)