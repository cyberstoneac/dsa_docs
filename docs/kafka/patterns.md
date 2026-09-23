# Kafka Patterns

> **Spring context:** Spring Kafka provides `@KafkaListener`, `KafkaTemplate`, `@DltHandler`, `RetryTopicConfiguration`, and `DeadLetterPublishingRecoverer` out of the box. Most patterns below map to a small set of Spring beans plus topic conventions.

## Mental Model

Kafka is a primitive: a partitioned, replicated, replayable log. Every "pattern" is a convention layered on top of that primitive. The patterns fall into four families:

```d2
direction: right

root: Kafka Patterns
messaging: Messaging
m1: Request-Reply
m2: Retry Topic
m3: Dead Letter Queue
data: Data
d1: Transactional Outbox
d2: CDC
d3: Event Sourcing
d4: CQRS
coord: Coordination
c1: "Saga (choreography)"
c2: "Saga (orchestration)"
stream: Streaming
s1: Kafka Streams basics
s2: Windowing / joins

messaging -> data
data -> coord
coord -> stream
```

## Retry Topics and Dead Letter Queue

**Problem:** a consumer fails on a record. Retrying in place blocks the partition. Dropping it loses data. You need bounded retries + a place for the failures.

**Pattern:** a chain of retry topics with increasing delay, ending in a DLQ.

```d2
direction: right

main: orders
r1: "orders-retry-1\\n(1s delay)"
r2: "orders-retry-2\\n(10s delay)"
r3: "orders-retry-3\\n(1m delay)"
dlq: orders-dlq

main -> r1
r1 -> r2
r2 -> r3
r3 -> dlq
```

Spring Kafka's `@RetryableTopic` implements this natively:

```java
@RetryableTopic(
    attempts = "4",
    backoff = @Backoff(delay = 1000, multiplier = 4.0),
    autoCreateTopics = "true",
    topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE
)
@KafkaListener(topics = "orders", groupId = "orders-svc")
public void onOrder(OrderEvent event) {
    orderService.process(event); // throws on failure
}

@DltHandler
public void onDlt(OrderEvent event, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
    log.error("DLQ from {}: {}", topic, event);
    dlqStore.save(event);
}
```

Design rules:
- **Non-retryable exceptions** (validation, schema errors) should skip retry and go straight to DLQ. Mark them with `@NonRetryable` or a custom classifier.
- **DLQ topics need monitoring** — they are not a trash can.
- **Retry delays should be exponential with jitter** to avoid synchronized retries.
- **Each retry topic is a real topic** — partition counts should match the main topic to preserve ordering.

## Request-Reply over Kafka

Kafka is not RPC, but sometimes you need it (e.g., a service only speaks Kafka). Pattern: reply topic + correlation ID.

```d2
direction: right

client: Client
req: "send(correlationId, replyTopic)"
wait: wait for reply
svc: Service
cons: consume request
prod: produce reply
reply: Reply Topic

req -> cons
prod -> reply
reply -> wait
```

```java
// Client
String correlationId = UUID.randomUUID().toString();
String replyTopic = "replies-" + correlationId;
// subscribe to replyTopic, then:
producer.send(new ProducerRecord<>("requests", correlationId, payload));

// Service
@KafkaListener(topics = "requests")
public void handle(ConsumerRecord<String, String> r) {
    String replyTopic = "replies-" + r.key();
    String result = process(r.value());
    producer.send(new ProducerRecord<>(replyTopic, r.key(), result));
}
```

Caveats:
- Per-request reply topics are expensive — prefer a single reply topic + correlation ID + client-side filter.
- Timeouts must be enforced client-side.
- You are rebuilding RPC over a log. Prefer REST/gRPC unless there's a reason.

## Transactional Outbox (recap)

Detailed in [`delivery-semantics.md`](delivery-semantics.md). The pattern:



1. Business write + outbox row in one DB transaction.
2. Relay (polling or Debezium) publishes to Kafka.
3. Consumer is idempotent.

## Change Data Capture (CDC)

Debezium reads the DB's binlog/WAL and publishes row-level changes to Kafka. The DB becomes the source of truth; Kafka becomes a derived stream.

| Use case | Why CDC wins |
|---|---|
| Keep search index in sync | No dual-write; DB is truth |
| Feed analytics | No app code changes |
| Outbox relay | No custom poller |
| Cache invalidation | Event-driven instead of TTL |

Watch for: schema evolution, snapshot vs streaming phase, at-least-once delivery (Debezium is not EOS), and tombstone handling for deletes.

## Event Sourcing

State is derived from an ordered sequence of events. Kafka is a natural fit because partitions are ordered logs and retention/compaction preserve history.

```d2
direction: right

cmd: Command
agg: Aggregate
validate: validate
emit: emit events
log: "Event Log\\n(Kafka topic, per aggregate key)"
proj: Projection
apply: apply events
state: read model

cmd -> validate
validate -> emit
emit -> log
log -> apply
apply -> state
```

Key rules:
- **Partition by aggregate ID** so an aggregate's events are strictly ordered.
- **Optimistic concurrency** via expected version in the command; reject if the log has advanced.
- **Snapshots** to avoid replaying millions of events on every read.
- **Schema versioning** is mandatory — events are forever.
- **Compaction is wrong here** — you want retention, not compaction (unless you snapshot into a compacted topic).

## CQRS

Command Query Responsibility Segregation: write model and read model are separate, synchronized via events.

```d2
direction: right

cmd: Command API
write: "Write Model\\n(Postgres, normalized)"
bus: "Event Bus\\n(Kafka)"
proj: Projector
read: "Read Model\\n(Mongo / ES / Redis)"
qry: Query API

cmd -> write
write -> bus
bus -> proj
proj -> read
qry -> read
```

Benefits: independent scaling, read models tailored per query, no complex joins on the write side.
Costs: eventual consistency, projection lag, more moving parts, dual schema evolution.

**Interview answer for "why CQRS?":** when read and write patterns are radically different (write: small, transactional; read: large, denormalized, multi-entity). Not a default architecture.

## Saga

Long-running business transactions across services. Two styles:

### Choreography

Services react to each other's events. No central coordinator.

```d2
direction: right

order: Order Service
create: create order
cancel: cancel order
payment: Payment Service
charge: charge
refund: refund
stock: Stock Service
reserve: reserve
release: release
ship: Shipping Service
ship0: ship

create -> charge
charge -> reserve
reserve -> ship0
ship0 -> cancel
reserve -> refund
```

Pros: simple, decoupled. Cons: hard to see the whole flow, hard to debug, cyclic dependencies emerge.

### Orchestration

A central orchestrator drives the saga, calls participants, and issues compensations.

```d2
direction: right

orch: Saga Orchestrator
step1: call payment
step2: call stock
step3: call shipping
comp: compensate on failure
payment: Payment
stock: Stock
ship: Shipping

step1 -> payment
step2 -> stock
step3 -> ship
comp -> payment
comp -> stock
```

Pros: explicit flow, easy to reason about, centralized timeouts. Cons: orchestrator is a new service to build and operate; risk of god-service.

**Compensations are not rollbacks.** They are new forward actions that semantically undo (refund, release reservation, cancel shipment). They must be **idempotent** and **commutative enough** to survive retries.

Full details in [`microservices-patterns/data-management.md`](../microservices-patterns/data-management.md).

## Kafka Streams Basics

A library for stateful stream processing on top of Kafka. No separate cluster.

Core abstractions:

| Concept | Meaning |
|---|---|
| `KStream` | Unbounded stream of records (insert-only) |
| `KTable` | Changelog — latest value per key (upsert) |
| `GlobalKTable` | Replicated to every instance; for joins with small dims |
| `KGroupedStream` | Result of `groupByKey`/`groupBy`; input to aggregations |
| State store | RocksDB-backed local state; changelog topic for recovery |
| Window | Tumbling, hopping, sliding, session |

```java
StreamsBuilder builder = new StreamsBuilder();

KStream<String, Order> orders = builder.stream("orders");

KTable<Windowed<String>, Long> counts = orders
    .groupByKey()
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))
    .count(Materialized.as("orders-per-customer-5m"));

counts.toStream().to("order-counts");

KafkaStreams streams = new KafkaStreams(builder.build(), props);
streams.start();
```

EOS: set `processing.guarantee=exactly_once_v2`. State stores are backed by changelog topics so a rebalance restores state on the new owner.

## Pattern Selection Table

| Problem | Pattern |
|---|---|
| Consumer failures need bounded retries | Retry topics + DLQ |
| Service only speaks Kafka but needs sync call | Request-reply with correlation ID |
| DB write + Kafka publish must be atomic | Transactional outbox (or CDC) |
| Sync search index with DB | CDC |
| Need full audit + temporal queries | Event sourcing |
| Read and write patterns diverge wildly | CQRS |
| Multi-service long transaction | Saga (choreography or orchestration) |
| Stateful stream processing without a cluster | Kafka Streams |

## Tricky Corners ⚠️

- **Retry topics double your topic count.** Budget for it operationally.
- **DLQ without alerting = data loss.** Treat DLQ depth as an SLO.
- **Request-reply with per-request topics explodes topic count.** Use one reply topic + correlation ID.
- **Outbox relay can publish duplicates** — consumer must be idempotent.
- **CDC is at-least-once** — Debezium re-delivers on restart.
- **Event sourcing schema changes are permanent.** Version events from day one.
- **Saga compensations can fail.** You need compensations for compensations, or manual intervention paths.
- **CQRS projection lag is user-visible.** Design UIs for eventual consistency.
- **Kafka Streams state stores are local.** Rebalance = restore from changelog = time.
- **`GlobalKTable` costs memory on every instance.** Only for tiny dims.

## Common Pitfalls

- Using DLQ as a "parking lot" with no replay tooling.
- Mixing choreography and orchestration for the same saga.
- Assuming saga is a distributed transaction — it is not, it is eventual consistency with compensations.
- Event-sourcing an aggregate without versioning.
- Building CQRS when a single Postgres read replica would do.
- Ignoring Kafka Streams changelog topic sizing (they retain full state history).
- Letting retry topics inherit the wrong `retention.ms` (too short and you lose retries).
- Using request-reply for high-throughput paths.

## Key Interview Tips

- For "how do you handle failures?", lead with **retry topics + DLQ + idempotent consumer**.
- For "how do you keep DB and Kafka in sync?", lead with **transactional outbox or CDC**, then mention the consumer idempotency requirement.
- For "how do you model long transactions?", lead with **saga**, then explicitly say **"it is not 2PC; compensations are forward actions."**
- For "why event sourcing?", answer with **audit + temporal + projections**, and name the costs (schema evolution, replay, snapshots).
- For "when CQRS?", answer with **divergent read/write patterns**, not "for scale."
- For Streams, mention **changelog-backed state stores** and `exactly_once_v2`.

## Related

- [Kafka index](index.md)
- [Fundamentals](fundamentals.md)
- [Producer & Consumer](producer-consumer.md)
- [Delivery Semantics](delivery-semantics.md)
- [Operations & Scenarios](operations-and-scenarios.md)
- [Microservices Patterns → Data Management](../microservices-patterns/data-management.md)
- [Microservices Patterns → Reliability](../microservices-patterns/reliability.md)