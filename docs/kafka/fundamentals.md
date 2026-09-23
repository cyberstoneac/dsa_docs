# Kafka Fundamentals

> **JDK context:** Java 17 baseline. Client library `org.apache.kafka:kafka-clients:3.7.x`. Spring Boot 3.x uses `spring-kafka:3.2.x` on top of the same clients. KRaft (ZooKeeper removal) is production-ready since Kafka 3.3 and default from 4.0.

## Mental Model

A Kafka cluster is a set of brokers. Each **topic** is a logical stream, split into **partitions**. Each partition is an **ordered, immutable, append-only log** stored as **segment files** on disk. Every record in a partition has a monotonically increasing **offset**.

Replication is per-partition: one broker is the **leader**, the rest are **followers**. Followers fetch from the leader. The set of replicas that are caught up is the **ISR (In-Sync Replicas)**. Only the leader serves reads/writes; if it dies, a new leader is elected from the ISR.

```d2
direction: right

p0: "Partition 0\nleader B1\nISR B1, B2"
p1: "Partition 1\nleader B2\nISR B2, B3"
p2: "Partition 2\nleader B3\nISR B3, B1"
b1: "Broker 1"
b2: "Broker 2"
b3: "Broker 3"

p0 -> b1
p1 -> b2
p2 -> b3
b1 -> b2
b2 -> b3
b3 -> b1
```

Key invariant: **within a partition, order is total. Across partitions, there is no order.**

## Topics, Partitions, Offsets

| Concept | What it is | Why it matters |
|---|---|---|
| Topic | Named logical stream | Unit of config (retention, cleanup.policy) |
| Partition | Physical shard of a topic | Unit of parallelism, ordering, replication |
| Offset | Position of a record in a partition | Unit of consumer progress |
| Log segment | File on disk holding a range of offsets | Unit of retention/compaction enforcement |
| Leader | Broker owning reads/writes for a partition | Single writer; bottleneck if hot |
| Follower | Replica fetching from leader | Failover candidate |
| ISR | Replicas caught up to leader | Only ISR members are eligible leaders |

### Partition count: the decision you cannot easily undo

- **Increasing partitions is possible; decreasing is not** (without recreating the topic).
- Increasing partitions **breaks key→partition stability**: `hash(key) % partitions` changes, so the same key may land elsewhere. This **breaks per-key ordering guarantees across the resharding boundary**.
- Practical starting point: `max(target_throughput / per_partition_throughput, target_consumer_parallelism)`. Round up. Don't start at 1 "to save resources" — you'll pay it back during a hot-key incident.

```java
// Creating a topic programmatically (admin client)
import org.apache.kafka.clients.admin.*;
import java.util.*;

public class TopicCreate {
    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");

        try (AdminClient admin = AdminClient.create(props)) {
            NewTopic topic = new NewTopic("orders", 6, (short) 3)
                .configs(Map.of(
                    "cleanup.policy", "delete",
                    "retention.ms", "604800000",       // 7 days
                    "min.insync.replicas", "2"
                ));
            admin.createTopics(List.of(topic)).all().get();
            System.out.println("topic created"); // topic created
        }
    }
}
```

## Replication, ISR, and Leader Election

Replication factor (RF) determines durability. `min.insync.replicas` (min ISR) determines the **write acknowledgment threshold**.

With `RF=3` and `min.insync.replicas=2`:
- Producer `acks=all` succeeds if the leader + at least 1 follower have the record.
- If only 1 replica is in ISR and `acks=all`, the producer gets `NotEnoughReplicasException`.
- This is the **correct** failure mode: better to fail writes than silently lose data.

```d2
direction: right

prod: Producer\nacks=all
leader: "Leader B1\\n(offset 42)"
f1: "Follower B2\\n(offset 42, in ISR)"
f2: "Follower B3\\n(offset 40, lagging)"
isr: "ISR = {B1, B2}\\nmin.insync.replicas = 2"

prod -> leader
leader -> f1
leader -> f2
leader -> isr
```

### Unclean leader election — the trade-off

`unclean.leader.election.enable=true` allows a **non-ISR** replica to become leader. This restores availability at the cost of **data loss** (the new leader is behind, so committed records vanish). Default in modern Kafka is `false`. For financial/order data, keep it `false`. For metrics/logs where availability > durability, `true` is defensible.

| Setting | Availability | Durability | Use when |
|---|---|---|---|
| `unclean=false`, `min.isr=2`, `acks=all` | Lower | Highest | Payments, orders, ledgers |
| `unclean=false`, `min.isr=1`, `acks=all` | Medium | High | General microservice events |
| `unclean=true`, `min.isr=1`, `acks=1` | Highest | Lowest | Metrics, logs, telemetry |

## Log Segments, Retention, Compaction

A partition's log is a sequence of **segments** (`.log` data, `.index` offset index, `.timeindex`). Only the **active segment** is written to. Retention is enforced per segment, not per record.

```d2
direction: right

log: Partition 0 log
s1: "segment 00000000000000000000.log\\n(offsets 0–999)"
s2: "segment 00000000000000001000.log\\n(offsets 1000–1999)"
s3: "segment 00000000000000002000.log\\n(active, offsets 2000+)"

s1 -> s2
s2 -> s3
```

### Cleanup policies

| Policy | Behavior | Use for |
|---|---|---|
| `delete` | Drop segments older than `retention.ms` or beyond `retention.bytes` | Event streams, logs |
| `compact` | Keep only the latest record per key; tombstone (null value) deletes | Changelogs, state, "latest state per entity" |
| `compact,delete` | Both | Bounded-size compacted topics |

Compaction does **not** guarantee immediate removal. It runs in the background and only touches **inactive** segments (by default). The head of the log (active segment) is not compacted until it rolls.

```properties
# Compacted topic example
cleanup.policy=compact
min.cleanable.dirty.ratio=0.5
segment.ms=3600000
delete.retention.ms=86400000
```

## KRaft vs ZooKeeper

| Aspect | ZooKeeper mode | KRaft mode |
|---|---|---|
| Metadata store | External ZK ensemble | Internal Raft quorum (controllers) |
| Operational surface | Two systems to run | One system |
| Scalability | Limited by ZK write throughput | Better; supports more partitions |
| Status | Removed in Kafka 4.0 | Default since 3.3, required in 4.0 |
| Migration | — | `kafka-metadata-quorum` + staged upgrade |

For interviews at 13 YOE: know **why** KRaft exists (metadata scalability, single-system ops) and that **controller quorum** is the new brain. You do not need Raft internals.

## Replication Protocol (high level)

1. Producer writes to leader with `acks`.
2. Leader appends to its log, assigns offset.
3. Followers fetch in batches; leader tracks their `log end offset` (LEO) and `high watermark` (HW).
4. A follower is in ISR if its LEO is within `replica.lag.time.max.ms` of the leader's LEO.
5. Consumers can only read up to the **high watermark** — committed, replicated data.

That last point is subtle and interview-favorite: **you cannot read uncommitted records from a leader**, even though they exist on disk, because HW gates reads.

## Tricky Corners ⚠️

- **High watermark gates reads.** A record with offset 100 may exist on the leader but be invisible to consumers until HW ≥ 100. This is why `acks=1` writes can be "written" then lost on leader failover.
- **Rebalancing does not move data, it moves ownership.** Partitions stay put; consumers change who owns them.
- **`retention.ms` is per-topic, not per-message.** If you need per-message TTL, encode it and filter in the consumer, or use a different store.
- **Compaction only cleans inactive segments** by default. The active segment can grow unboundedly until `segment.ms`/`segment.bytes` rolls it.
- **Increasing partitions breaks key ordering across the reshard point.** Plan partition counts for the lifetime of the topic.
- **`min.insync.replicas` is enforced at write time only when `acks=all`.** With `acks=1`, it does nothing.
- **Topic deletion is asynchronous.** `delete.topic.enable=true` starts a background cleanup; recreate with the same name quickly and you may race.
- **Auto topic creation (`auto.create.topics.enable=true`) is a footgun** in production — mis-typed topic names silently create 1-partition topics with default retention.

## Common Pitfalls

- Starting with 1 partition "to save resources," then needing to rekey everything to scale.
- Setting `acks=1` for "speed" on data you cannot lose.
- Using `cleanup.policy=compact` and expecting prompt deletion of old keys.
- Relying on `auto.create.topics.enable` in prod.
- Confusing **replication factor** (durability) with **partition count** (throughput/parallelism).
- Forgetting that **consumer group rebalance pauses the world** for that group (until cooperative rebalancing — see `producer-consumer.md`).
- Treating `retention.bytes` as a hard cap when a single huge record can exceed it.

## Key Interview Tips

- Lead with **"Kafka is a partitioned replicated log, not a queue"** — it reframes every follow-up.
- Always separate **ordering (per-partition)** from **parallelism (partition count)**.
- For durability questions, name the trio: `acks`, `min.insync.replicas`, `unclean.leader.election.enable`.
- For retention questions, distinguish **delete** vs **compact** vs **compact,delete**.
- For modern ops, mention **KRaft** and **controller quorum** without going deep.
- If asked "how many partitions?", answer with the throughput + consumer parallelism formula, then note **you can't easily shrink**.

## Related

- [Kafka index](index.md)
- [Producer & Consumer](producer-consumer.md)
- [Delivery Semantics](delivery-semantics.md)
- [Operations & Scenarios](operations-and-scenarios.md)
- [Microservices Patterns → Data Management](../microservices-patterns/data-management.md)