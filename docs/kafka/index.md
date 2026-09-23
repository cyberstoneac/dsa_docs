# Kafka

> **Spring context:** Spring Boot 3.x with `spring-kafka` 3.x — the abstractions (`KafkaTemplate`, `@KafkaListener`, `ConcurrentKafkaListenerContainerFactory`) hide broker details, but production incidents always live at the broker/client boundary. This section builds the mental model you need to reason about those incidents at 13 YOE depth.

## Mental Model

Kafka is **not a queue**. It is a **distributed, partitioned, replicated, append-only commit log** that a handful of client roles (producers, consumers, Streams, Connect) happen to read from and write to. Every "Kafka question" is really a question about the log: where offsets live, who owns a partition, how replication catches up, and how retention/compaction shape what the log keeps.

The single most useful reframing:

| You think you need… | Kafka actually gives you… |
|---|---|
| A queue with N consumers | A partitioned log where **partitions are the unit of parallelism** |
| Message delivery | A **record appended at an offset** in a partition |
| Deletion after read | **Retention** (time/size) or **compaction** (key-based) |
| A broker failover | A **partition leader election** among in-sync replicas |

Two consequences that drive 90% of production behavior:



1. **Ordering is per-partition, not per-topic.** If you need per-entity ordering, the entity's key must hash to one partition.
2. **Parallelism is bounded by partition count.** More consumers than partitions ⇒ idle consumers.

```d2
direction: right

producers: Producers
p1: Producer A
p2: Producer B
cluster: Kafka Cluster
topic: "Topic \"orders\" (3 partitions)"
b1: "Broker 1\\n(leader P0, follower P1)"
b2: "Broker 2\\n(leader P1, follower P2)"
b3: "Broker 3\\n(leader P2, follower P0)"
consumers: Consumer Group "orders-svc"
c1: "Consumer 1\\n(P0, P1)"
c2: "Consumer 2\\n(P2)"

p1 -> topic
p2 -> topic
topic -> c1
topic -> c2
```

## When to Use Kafka (and When Not To)

Kafka is a **streaming platform**, not a general-purpose message broker. Match the tool to the workload.

| Workload | Kafka? | Why |
|---|---|---|
| Event streaming, log aggregation, CDC | ✅ Yes | Built for high-throughput append-only streams |
| Event sourcing / CQRS read-model feeds | ✅ Yes | Log + compaction + replay is native |
| Async decoupling between services | ✅ Yes | Durable buffer, replay, consumer groups |
| Task queue with per-message ack + redelivery | ⚠️ Possible, awkward | RabbitMQ/SQS model fits better |
| Request/reply RPC | ⚠️ Possible, awkward | REST/gRPC fits better |
| Low-volume scheduled jobs | ❌ No | Cron + DB is simpler |
| Per-message TTL (different for each message) | ❌ No | Retention is per-topic, not per-message |

Rule of thumb: **if you need replay, Kafka wins. If you need per-message acknowledgment semantics, a queue wins.**

## Ecosystem Map

Four roles, one log:

```d2
direction: right

core: "Kafka Core\\n(brokers, KRaft, replication, log segments)"
clients: Clients
prod: "Producers\\n(acks, idempotence, transactions)"
cons: "Consumers\\n(groups, offsets, rebalance)"
apis: APIs & Runtimes
streams: "Kafka Streams\\n(stateful, exactly-once)"
connect: "Kafka Connect\\n(source/sink connectors)"
schema: "Schema Registry\\n(Avro/Protobuf/JSON)"
ops: Operations
ui: Kafka UI / AKHQ
mon: "JMX + Prometheus\\n(lag, ISR, under-replicated)"
sec: SASL/SSL + ACLs

core -> clients
core -> apis
core -> ops
```

### Kafka Streams vs Connect vs Plain Clients

| Need | Use | Notes |
|---|---|---|
| Consume, transform, produce | Plain producer/consumer | Most control, most code |
| Stateful joins, windowing, aggregations | Kafka Streams | EOS via `processing.guarantee=exactly_once_v2` |
| Move data in/out of Kafka without code | Kafka Connect | JDBC, S3, Mongo, Debezium connectors |
| Schema evolution | Schema Registry | Enforce compatibility on produce |

## How This Section Is Organized

| File | Focus |
|---|---|
| `fundamentals.md` | Topics, partitions, offsets, brokers, replication, ISR, log segments, retention, compaction, KRaft |
| `producer-consumer.md` | Producer batching/acks/idempotence/transactions; consumer groups, rebalancing, offset commits |
| `delivery-semantics.md` | At-most-once, at-least-once, exactly-once; idempotent consumers; transactions; outbox |
| `patterns.md` | Outbox, saga, event sourcing, CQRS, retry topics, DLQ, request-reply, Streams basics |
| `operations-and-scenarios.md` | The interview scenarios file — lag, backlog, hot partitions, rebalance storms, tuning |

## Related

- [Fundamentals](fundamentals.md)
- [Producer & Consumer](producer-consumer.md)
- [Delivery Semantics](delivery-semantics.md)
- [Patterns](patterns.md)
- [Operations & Scenarios](operations-and-scenarios.md)
- [Microservices Patterns → Data Management](../microservices-patterns/data-management.md)
- [Observability → Metrics, Logs, Traces](../observability/metrics-logs-traces.md)