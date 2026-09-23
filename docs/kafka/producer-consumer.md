# Producer & Consumer

> **Spring context:** `KafkaTemplate` (producer) and `@KafkaListener` + `ConcurrentKafkaListenerContainerFactory` (consumer) in Spring Boot 3.x. Both wrap the same `kafka-clients` primitives documented here. Tuning `spring.kafka.producer.*` and `spring.kafka.consumer.*` maps 1:1 to client configs.

## Mental Model

**Producer:** the client accumulates records into per-partition **batches**, sends batches to partition leaders, and waits for the configured `acks` before considering the send durable. The producer's job is to maximize throughput without violating durability/ordering requirements.

**Consumer:** the client **polls** records from assigned partitions, processes them, and commits offsets. It does not get pushed records. Consumer **groups** coordinate partition assignment via a group coordinator broker; membership changes trigger a **rebalance**.

```d2
direction: right

producer: Producer
app: "send(record)"
acc: "RecordAccumulator\\n(batch per partition)"
sender: Sender thread
broker: Broker
leader: Partition Leader
consumer: Consumer
poll: "poll()"
process: "process(records)"
commit: commitSync/Async

app -> acc
acc -> sender
sender -> leader
leader -> poll
poll -> process
process -> commit
```

Producer and consumer are **decoupled**: the producer never knows who reads; the consumer never knows who wrote. The broker is the only shared state.

## Producer Internals

### The send path

1. `send()` serializes key/value, computes partition (explicit, or `hash(key) % partitions`, or sticky for null keys).
2. Record goes into `RecordAccumulator`, appended to the batch for that partition.
3. A **sender thread** drains batches when `batch.size` is reached **or** `linger.ms` elapses.
4. Request sent to partition leader. On `acks` satisfied, the future completes.

### The tunables that matter

| Config | Default | Effect |
|---|---|---|
| `batch.size` | 16 KB | Max batch bytes per partition; larger = better compression/throughput |
| `linger.ms` | 0 | Wait time to fill a batch; a few ms trades latency for throughput |
| `compression.type` | none | `lz4`/`zstd` usually best CPU/ratio; `gzip` slower, higher ratio |
| `acks` | all (3.x) | 0, 1, all — durability knob |
| `enable.idempotence` | true (3.x) | Dedupes producer retries per partition |
| `max.in.flight.requests.per.connection` | 5 | With idempotence, safe up to 5; without, ordering risk on retry |
| `retries` | `Integer.MAX_VALUE` | With idempotence, infinite retries are safe |
| `delivery.timeout.ms` | 120000 | Upper bound on send+retry+ack |
| `buffer.memory` | 32 MB | Total accumulator memory; `send()` blocks when full |

### Ordering vs in-flight requests

Without idempotence: `max.in.flight > 1` + retries ⇒ **reordering possible** (batch 2 succeeds after batch 1 retries). With idempotence: broker assigns producer IDs and sequence numbers, so retries preserve order per partition up to 5 in-flight.

```java
// Producer with idempotence + acks=all + compression
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;
import java.util.Properties;

public class IdempotentProducer {
    public static void main(String[] args) throws Exception {
        Properties p = new Properties();
        p.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        p.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        p.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        p.put(ProducerConfig.ACKS_CONFIG, "all");
        p.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        p.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "lz4");
        p.put(ProducerConfig.LINGER_MS_CONFIG, 5);
        p.put(ProducerConfig.BATCH_SIZE_CONFIG, 32 * 1024);

        try (Producer<String, String> producer = new KafkaProducer<>(p)) {
            RecordMetadata md = producer.send(
                new ProducerRecord<>("orders", "order-42", "{\"id\":42}"),
                (meta, ex) -> {
                    if (ex == null) System.out.println("ok: " + meta.offset());
                    else ex.printStackTrace();
                }
            ).get();
            System.out.println("committed at offset " + md.offset()); // committed at offset 7
        }
    }
}
```

### Transactions (exactly-once producer)

Transactional producers allow **atomic writes across partitions/topics** and **consume-transform-produce** with offset commits in the same transaction.

```java
producer.initTransactions();
try {
    producer.beginTransaction();
    producer.send(new ProducerRecord<>("out", "k", "v"));
    producer.sendOffsetsToTransaction(offsets, "group-id");
    producer.commitTransaction();
} catch (Exception e) {
    producer.abortTransaction();
}
```

Requirements: `transactional.id` set, `acks=all`, `enable.idempotence=true`, `min.insync.replicas ≥ 2` on target topics, and consumers using `isolation.level=read_committed`.

## Consumer Internals

### Poll loop

```java
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.serialization.StringDeserializer;
import java.time.Duration;
import java.util.*;

public class BasicConsumer {
    public static void main(String[] args) {
        Properties p = new Properties();
        p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        p.put(ConsumerConfig.GROUP_ID_CONFIG, "orders-svc");
        p.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        p.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        p.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        p.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500);
        p.put(ConsumerConfig.ISOLATION_LEVEL_CONFIG, "read_committed");

        try (Consumer<String, String> c = new KafkaConsumer<>(p)) {
            c.subscribe(List.of("orders"));
            while (true) {
                ConsumerRecords<String, String> records = c.poll(Duration.ofMillis(500));
                for (ConsumerRecord<String, String> r : records) {
                    System.out.println(r.partition() + "@" + r.offset() + "=" + r.value());
                }
                if (!records.isEmpty()) c.commitSync();
            }
        }
    }
}
```

### Consumer groups & partition assignment

- Each partition is assigned to **exactly one** consumer in a group.
- If consumers > partitions, extras are idle.
- If a consumer dies, its partitions are reassigned (rebalance).
- Different groups are independent — one partition can be read by multiple groups.

Assignment strategies:

| Strategy | Rebalance style | Notes |
|---|---|---|
| `RangeAssignor` | Eager | Contiguous ranges per topic; can imbalance |
| `RoundRobinAssignor` | Eager | Spreads across all topics |
| `StickyAssignor` | Eager | Minimizes movement, but still stop-the-world |
| `CooperativeStickyAssignor` | **Cooperative** | Incremental — only moved partitions revoked |

**Cooperative rebalancing** is the modern default in Spring Boot 3.x (`CooperativeStickyAssignor` via `partition.assignment.strategy`). It avoids the "all consumers stop while everyone rejoins" pattern of eager rebalancing.

```d2
direction: right

eager: Eager Rebalance
s1: All consumers revoke
s2: Rejoin group
s3: Reassign all partitions
coop: Cooperative Rebalance
c1: Only moved partitions revoked
c2: Others keep processing
c3: Moved partitions assigned

s1 -> s2
s2 -> s3
c1 -> c2
c2 -> c3
```

### Static membership

`group.instance.id` lets a consumer rejoin after restart **without triggering a rebalance** (up to `session.timeout.ms`). This is the single biggest fix for **rebalance storms** in Kubernetes where pods restart frequently.

```properties
group.instance.id=orders-svc-pod-0
session.timeout.ms=45000
heartbeat.interval.ms=3000
```

### Offset commit strategies

| Strategy | Behavior | Trade-off |
|---|---|---|
| Auto commit (`enable.auto.commit=true`) | Commits every `auto.commit.interval.ms` during poll | At-least-once; can lose/replay on crash |
| `commitSync()` | Blocks until broker acks | Slow but predictable |
| `commitAsync()` | Fire-and-forget | Fast; no retry on failure by itself |
| Manual batch commit | `commitSync()` after processing a poll batch | Common production pattern |
| `commitAsync` + `commitSync` on close | Best of both | Slightly more code |

Rule: **disable auto-commit and commit after processing succeeds**. This gives at-least-once semantics with a clear commit point.

### `max.poll.interval.ms` — the silent killer

If your `poll()` loop takes longer than `max.poll.interval.ms` (default 5 min) between polls, the broker considers the consumer dead and triggers a rebalance. Long-running per-record processing (slow DB calls, blocking HTTP) causes **rebalance loops**.

Fixes:
- Lower `max.poll.records` so each poll returns less work.
- Offload heavy work to a thread pool and pause/resume partitions.
- Increase `max.poll.interval.ms` only as a last resort — it delays legitimate failure detection.

## Producer–Consumer Interaction: The Offset Contract

- Producer writes → record lands at offset N in partition P.
- Broker advances **HW** when ISR has replicated.
- Consumer can read offsets < HW.
- Consumer commits its **next offset to read** (not the last read) — this is the #1 source of off-by-one confusion.

```d2
direction: right

log: Partition 0
r0: offset 0
r1: offset 1
r2: offset 2
r3: "offset 3 (HW)"
r4: "offset 4 (LEO, uncommitted)"
c: "Consumer committed offset = 3\\n(next poll returns 3)"

r3 -> c
```

## Tricky Corners ⚠️

- **Committed offset = next offset to read.** Committing 3 means "I've processed 0,1,2."
- **`commitAsync` does not retry** — a failed async commit can silently rewind on restart.
- **Rebalance callbacks run on the poll thread.** Blocking inside `onPartitionsRevoked` stalls the group.
- **`max.poll.interval.ms` vs `session.timeout.ms`** are different: session timeout is heartbeat-based (background thread), poll interval is user-thread-based.
- **Auto-commit commits whatever was returned by the last poll, even if you didn't process it.** Silent data loss on crash.
- **Producer `send()` returning a future does not mean it was sent** — you must check the future/callback.
- **`linger.ms=0` still batches** if records arrive faster than the sender drains.
- **Idempotence is per producer session per partition.** A producer restart gets a new PID; dedupe does not survive restart (use transactions or idempotent consumers for that).
- **`read_committed` consumers cannot see records past the LSO (last stable offset)** — aborted transactions create read stalls on that partition.

## Common Pitfalls

- Leaving `enable.auto.commit=true` in production.
- Doing slow work inside `poll()` and hitting `max.poll.interval.ms`.
- Assuming `acks=all` alone gives durability — you also need `min.insync.replicas ≥ 2` and `unclean.leader.election.enable=false`.
- Using `commitAsync` without a final `commitSync` on shutdown.
- Choosing a key with low cardinality (e.g., `country`) → hot partitions.
- Using null keys when you need ordering — null keys use sticky partitioning, so ordering is lost.
- Forgetting that **rebalance is stop-the-world for eager assignors** — always test with pod restarts.
- Setting `max.poll.records` very high to "go faster" and then timing out on poll interval.

## Key Interview Tips

- Always state the **acks + min.insync.replicas + unclean election** trio together for durability.
- For ordering, say **"per-partition, keyed by entity ID"** — never claim global ordering.
- For consumer parallelism, say **"bounded by partition count"** and mention idle consumers.
- For rebalance storms, lead with **static membership (`group.instance.id`)** and **cooperative sticky**.
- For offset commits, say **"disable auto-commit, commit after processing, commit = next offset"**.
- For producer throughput, order the knobs: **compression → batch.size → linger.ms → acks trade-off**.
- For EOS, distinguish **idempotent producer** (per-session dedupe) from **transactions** (atomic across partitions) from **idempotent consumer** (cross-system dedupe).

## Related

- [Kafka index](index.md)
- [Fundamentals](fundamentals.md)
- [Delivery Semantics](delivery-semantics.md)
- [Patterns](patterns.md)
- [Operations & Scenarios](operations-and-scenarios.md)
- [Spring → Kafka](../spring/index.md)