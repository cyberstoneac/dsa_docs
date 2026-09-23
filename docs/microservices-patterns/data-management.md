# Data Management

> **Spring context:** Spring Data JPA / Spring Data MongoDB for per-service persistence, Spring Kafka + `@Transactional` + `KafkaTransactionManager` for outbox/CDC, Debezium for CDC, Spring Cloud Stream for event-driven sagas. Spring Modulith publishes domain events in-process and can externalize them via `@Externalized`.

## Mental Model

In a monolith, you get ACID across everything. In microservices, **each service owns its data**, and cross-service consistency becomes **eventual** via events, sagas, and idempotent consumers.

Three rules:



1. **Database per service.** No shared schemas. No cross-service joins.
2. **Aggregates define transaction boundaries.** One transaction, one aggregate.
3. **Cross-service consistency is eventual.** Compensations, not rollbacks.

```d2
direction: right

order: Order Service
odb: Orders DB
pay: Payment Service
pdb: Payments DB
stock: Inventory Service
sdb: Inventory DB
bus: "Event Bus (Kafka)"

odb -> bus
pdb -> bus
sdb -> bus
```

## Database per Service

Each service owns its schema and its lifecycle. Other services access it only via the service's API or events.

| Approach | Coupling | Consistency | When |
|---|---|---|---|
| DB per service | Low | Eventual | Default for microservices |
| Shared DB (anti-pattern) | High | ACID | Only during migration, briefly |
| Shared schema, separate tables | Medium | ACID on shared tx | Never in prod |
| Read replica for reporting | Low | Slight lag | Analytics, dashboards |

**Shared database is the #1 microservices anti-pattern.** It couples services at the schema level: any migration breaks all consumers, and you lose independent deployability.

## Saga

A saga is a long-running business transaction implemented as a sequence of local transactions, each with a **compensating action** for failure.

### Choreography

Services publish events; other services react.

```d2
direction: right

order: Order Service
create: "create order (PENDING)"
confirm: confirm order
cancel: cancel order
pay: Payment Service
charge: charge card
refund: refund
stock: Inventory Service
reserve: reserve stock
release: release stock

create -> charge
charge -> reserve
reserve -> confirm
reserve -> refund
charge -> cancel
```

**Pros:** decoupled, no central coordinator.
**Cons:** hard to see end-to-end, cyclic dependencies, hard to add timeouts.

### Orchestration

A central orchestrator drives the saga.

```d2
direction: right

orch: Order Saga Orchestrator
s1: 1. charge payment
s2: 2. reserve stock
s3: 3. confirm order
c1: "compensate: refund"
c2: "compensate: release stock"
pay: Payment Service
stock: Inventory Service
order: Order Service

s1 -> pay
s2 -> stock
s3 -> order
c1 -> pay
c2 -> stock
```

**Pros:** explicit flow, easy timeouts, easy compensation.
**Cons:** orchestrator is a new service, risk of god-service.

### Saga Design Rules

- **Each step is idempotent.** Compensations may run multiple times.
- **Compensations are forward actions, not rollbacks.** Refund is a new payment; release is a new inventory action.
- **Order steps to minimize compensation cost.** Charge last if refunds are expensive.
- **Persist saga state** (in a DB, not in memory) so it survives crashes.
- **Timeouts on every step.** Otherwise the saga hangs forever.
- **Semantic locks** (e.g., `PENDING` order status) to prevent conflicting concurrent operations.
- **Compensations can fail.** Have a manual intervention path and alerting.

### Choreography vs Orchestration

| Aspect | Choreography | Orchestration |
|---|---|---|
| Coordinator | None | Central |
| Coupling | Loose | Orchestrator knows all |
| Visibility | Hard | Easy |
| Complexity | Grows with steps | Grows with orchestration logic |
| Best for | 2–3 step flows | 4+ step flows with compensation |
| Debugging | Event tracing | Orchestrator logs |
| Risk | Cyclic deps, event soup | God-service |

## API Composition

For read queries that span services, compose results in a dedicated layer (BFF or a query service) rather than joining across DBs.

```d2
direction: right

client: Client
comp: API Composer
order: Order Service
user: User Service
pay: Payment Service

client -> comp
comp -> order
comp -> user
comp -> pay
```

Rules:
- Composer is **read-only**, no business logic.
- Parallelize the calls (CompletableFuture / reactive).
- Apply per-call timeouts; degrade gracefully if one source is slow.
- Cache where safe.
- If composition gets complex, consider CQRS with a materialized read model.

## CQRS

Separate write model from read model; sync via events.

```d2
direction: right

cmdApi: Command API
write: "Write Model (Postgres)"
bus: Event Bus
proj: Projector
read: "Read Model (Mongo/ES/Redis)"
qryApi: Query API

cmdApi -> write
write -> bus
bus -> proj
proj -> read
qryApi -> read
```

When CQRS:
- Read and write patterns diverge wildly (e.g., many small writes, complex multi-entity reads).
- Read scaling differs from write scaling.
- You need multiple read models for different clients.

Costs:
- Eventual consistency (projection lag).
- Dual schema evolution.
- More moving parts.
- Projector failure handling.

Not a default. Most systems do fine with a single model + read replicas.

## Event Sourcing

State is derived from an ordered sequence of events. The log is the source of truth.

```d2
direction: right

cmd: Command
agg: Aggregate
log: "Event Log (Kafka)"
proj: Projection
state: Read Model

cmd -> agg
agg -> log
log -> proj
proj -> state
```

Rules:
- **Partition by aggregate ID** for per-aggregate ordering.
- **Optimistic concurrency** via expected version.
- **Snapshots** for aggregates with many events.
- **Version events from day one.** They are permanent.
- **Compaction is wrong here** (use retention, or snapshot into a compacted topic).

When event sourcing:
- Audit trail is a first-class requirement.
- Temporal queries ("what did this look like last Tuesday?") are needed.
- Multiple projections of the same events are needed.

Costs:
- Schema evolution is hard.
- Replay time grows.
- Debugging is different (replay, not inspect row).
- Team must understand the pattern.

## Transactional Outbox

Publish to Kafka and write to DB atomically **without 2PC**.

```d2
direction: right

svc: Service
tx: DB transaction
biz: write business row
out: write outbox row
relay: "Relay (poll / CDC)"
kafka: Kafka

tx -> relay
relay -> kafka
```

Steps:
1. Business row + outbox row in one DB transaction.
2. Relay polls outbox (or Debezium streams it) and publishes to Kafka.
3. Relay marks row published (or Debezium just streams).
4. Consumer is idempotent (relay may publish duplicates on crash).

Table:
```sql
CREATE TABLE outbox (
  id UUID PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
```

Spring angle: `@TransactionalEventListener(phase = AFTER_COMMIT)` for in-process, plus a poller or Debezium for external.

## Change Data Capture (CDC)

Read the DB's WAL/binlog and publish changes to Kafka.

| Use case | Why CDC |
|---|---|
| Search index sync | No dual-write |
| Analytics feed | No app code changes |
| Outbox relay | No custom poller |
| Cache invalidation | Event-driven |

Rules:
- CDC is **at-least-once**; consumers must be idempotent.
- **Schema evolution** matters — the DB schema becomes an implicit contract.
- **Snapshot phase** matters on first start (can be huge).
- **Tombstones** for deletes.
- Prefer **outbox + CDC** for cross-service events; **raw CDC** for analytics/cache.

## Comparing the Patterns

| Pattern | Problem it solves | Cost |
|---|---|---|
| DB per service | Coupling through schema | Eventual consistency |
| Saga | Multi-service transactions | Compensations, idempotency |
| API Composition | Cross-service reads | N+1 risk, latency |
| CQRS | Divergent read/write patterns | Projection lag, more services |
| Event Sourcing | Audit + temporal + projections | Schema evolution, replay |
| Outbox | DB + Kafka atomicity | Relay, idempotent consumer |
| CDC | Sync DB to downstreams | At-least-once, schema coupling |

## Tricky Corners ⚠️

- **Saga is not 2PC.** Compensations are forward actions; they can fail.
- **Outbox relay can publish duplicates.** Consumer must be idempotent.
- **CDC is at-least-once.** Same caveat.
- **Event sourcing without versioning is a time bomb.**
- **Projection lag is user-visible.** Design UIs for eventual consistency.
- **Semantic locks** (PENDING states) are necessary to prevent concurrent conflicting operations.
- **Shared DB is the #1 anti-pattern.** Name it explicitly.
- **API composition can become a distributed join.** Watch N+1.
- **CQRS without a real divergence is over-engineering.**
- **Kafka transactions do not cover DB writes.** Outbox or idempotent consumer required.
- **Cross-aggregate consistency is always eventual.** Don't pretend otherwise.

## Common Pitfalls

- "We'll share the DB for now" — it becomes permanent.
- Saga without compensations for every step.
- Non-idempotent compensations.
- Outbox without a relay monitoring/alerting.
- CDC without schema-evolution strategy.
- Event sourcing for CRUD.
- CQRS when a read replica would do.
- API composer with business logic.
- Projections that aren't idempotent (replay breaks them).
- Saga state in memory (lost on crash).

## Key Interview Tips

- Lead with **"database per service, no shared schemas, cross-service consistency is eventual."**
- For "how do you do a distributed transaction?", answer **"you don't; you use a saga with compensations."**
- For "how do you publish to Kafka and write to DB atomically?", answer **"transactional outbox, optionally with CDC relay."**
- For "how do you read across services?", answer **"API composition, or CQRS with a materialized read model."**
- For "when event sourcing?", answer **"audit + temporal + multiple projections"**, and name the costs.
- For "when CQRS?", answer **"when read/write patterns diverge,"** not "for scale."
- Always name the anti-pattern: **shared database.**
- Always mention **idempotency** for sagas, outbox, CDC, and projections.

## Related

- [Microservices Patterns index](index.md)
- [Decomposition](decomposition.md)
- [Communication](communication.md)
- [Reliability](reliability.md)
- [Kafka → Patterns](../kafka/patterns.md)
- [Kafka → Delivery Semantics](../kafka/delivery-semantics.md)
- [Architecture → Evolution & Migration](../architecture/evolution-and-migration.md)