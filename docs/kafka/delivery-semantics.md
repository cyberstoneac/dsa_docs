# Kafka Delivery Semantics

> **Spring context:** Spring Kafka exposes `AckMode` (via `ConcurrentKafkaListenerContainerFactory`) as the consumer-side semantic knob. Producer-side semantics come from `enable.idempotence`, `transactional.id`, and `isolation.level` on the consumer. Spring's `@Transactional` on a `@KafkaListener` binds the DB transaction and the Kafka transaction only if a `KafkaTransactionManager` is configured — otherwise they are independent.

## Mental Model

"Delivery semantics" answers one question: **how many times can a record be observed by the downstream side effect?**

| Semantic | Guarantee | Mechanism | Cost |
|---|---|---|---|
| At-most-once | 0 or 1 | Commit offset **before** processing | Data loss on crash |
| At-least-once | 1 or more | Commit offset **after** processing | Duplicates on crash/retry |
| Exactly-once | 1 | Idempotence + transactions, or idempotent consumer | Complexity, coordination |

There is no free exactly-once. You either get it **inside Kafka** (transactions) or **outside Kafka** (idempotent consumer / outbox). Cross-system exactly-once without one of those two is a fairy tale.

```d2
direction: right

source: "Source\\n(DB or Kafka)"
side: "Side Effect\\n(DB write, HTTP call)"
commit: Offset Commit
amo: At-Most-Once
a1: commit first
a2: then process
alo: At-Least-Once
b1: process
b2: then commit
eos: Exactly-Once
c1: "transactional boundary\\n(offset + output atomic)"

a1 -> a2
b1 -> b2
```

## At-Most-Once

Commit offset **before** processing. If the consumer crashes mid-processing, the record is gone. Used only for telemetry where loss is acceptable.

```java
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    consumer.commitSync();                  // commit FIRST
    for (ConsumerRecord<String, String> r : records) {
        process(r);                         // crash here = record lost
    }
}
```

Pattern is rare in production. `enable.auto.commit=true` with a very short `auto.commit.interval.ms` approximates it, which is why auto-commit is dangerous.

## At-Least-Once

The default and most common. Commit **after** processing succeeds. Crash between processing and commit ⇒ the record is reprocessed on restart.

```java
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    for (ConsumerRecord<String, String> r : records) {
        process(r);                         // may run more than once
    }
    consumer.commitSync();                  // commit AFTER
}
```

At-least-once is only safe if `process(r)` is **idempotent** or **deduplicated**. Otherwise you get duplicate emails, double charges, duplicated rows.

### Sources of duplicates

- Consumer crashes between processing and commit.
- Rebalance: partitions revoked after processing but before commit.
- Producer retries without idempotence (broker receives same record twice).
- Network partition: broker wrote the record, ack was lost, producer retried.

## Exactly-Once Inside Kafka (Transactions)

Kafka transactions make **produce + offset commit** atomic across partitions/topics. Combined with `read_committed`, downstream consumers see either all or none of a transactional batch.

```d2
direction: right

in: "Input Topic\\n(orders)"
proc: "Consumer + Producer\\n(transactional)"
out: "Output Topic\\n(orders-enriched)"
db: "DB\\n(offsets stored in Kafka, not DB)"

in -> proc
proc -> out
proc -> db
```

### Requirements

- Producer: `transactional.id`, `enable.idempotence=true`, `acks=all`, `retries>0`.
- Broker: `transaction.state.log.replication.factor ≥ 3`, `transaction.state.log.min.isr ≥ 2`.
- Topics: `min.insync.replicas ≥ 2`.
- Consumer: `isolation.level=read_committed`.

### Consume-transform-produce pattern

```java
producer.initTransactions();
consumer.subscribe(List.of("orders"));

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    if (records.isEmpty()) continue;

    producer.beginTransaction();
    try {
        for (ConsumerRecord<String, String> r : records) {
            String enriched = enrich(r.value());
            producer.send(new ProducerRecord<>("orders-enriched", r.key(), enriched));
        }
        // Atomically commit consumer offsets as part of the transaction
        producer.sendOffsetsToTransaction(currentOffsets(records), consumer.groupMetadata());
        producer.commitTransaction();
    } catch (Exception e) {
        producer.abortTransaction();
        // seek to the last committed offsets and retry
    }
}
```

`sendOffsetsToTransaction` is what makes this EOS — it writes the consumer's offsets to the `__consumer_offsets` topic **inside** the same transaction as the produced records.

### `read_committed` semantics

- Consumer only sees records up to the **Last Stable Offset (LSO)**.
- LSO = min of all open transaction start offsets on that partition.
- If a long-running transaction is open on a partition, `read_committed` consumers **stall** on that partition until it commits or aborts.

This is the #1 gotcha with transactions: **a stuck transaction blocks reads on that partition.**

## Exactly-Once Across Systems (The Hard Part)

Kafka transactions do **not** cover writes to Postgres, HTTP calls, or emails. For those, you need one of:



1. **Idempotent consumer** — dedupe by a stable key (message ID) in the target system.
2. **Transactional outbox** — write the side effect and the "message sent" flag in the **same DB transaction**, then a relay publishes.
3. **Two-phase commit** — avoid it; operational nightmare.

### Idempotent consumer

Store processed message IDs in the same DB transaction as the side effect.

```sql
CREATE TABLE processed_messages (
  message_id UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

```java
@Transactional
public void handle(ConsumerRecord<String, OrderEvent> r) {
    UUID id = UUID.fromString(r.key());
    try {
        jdbc.update("INSERT INTO processed_messages(message_id) VALUES (?)", id);
    } catch (DuplicateKeyException dup) {
        return; // already processed
    }
    orderService.apply(r.value());
}
```

The `INSERT` and `orderService.apply` are in one DB transaction. Either both happen or neither. Retries are safe.

### Transactional outbox

The pattern that solves "publish to Kafka AND write to DB atomically" without 2PC.

```d2
direction: right

svc: Service
tx: DB transaction
write: write business row
outbox: write outbox row
relay: Outbox Relay
poll: poll outbox
pub: publish to Kafka
mark: mark published
kafka: Kafka Topic

tx -> poll
pub -> kafka
mark -> tx
```

Steps:
1. Service writes business row + outbox row in **one local DB transaction**.
2. A relay (Debezium CDC, or a polling thread) reads unpublished outbox rows.
3. Relay publishes to Kafka.
4. Relay marks the outbox row published (or Debezium just streams the binlog).

If the relay crashes after publish but before mark, it republishes — **at-least-once**. The consumer must be idempotent. This is the standard production answer.

See [`microservices-patterns/data-management.md`](../microservices-patterns/data-management.md) for the full pattern.

## Comparison

| Approach | Guarantee | Complexity | When to use |
|---|---|---|---|
| At-most-once | ≤1 | Trivial | Metrics, logs, telemetry |
| At-least-once + idempotent consumer | =1 effectively | Low–Medium | Default for microservices |
| Kafka transactions (EOS in Kafka) | =1 in Kafka | Medium | Streams, Kafka-to-Kafka pipelines |
| Outbox + idempotent consumer | =1 across systems | Medium–High | DB + Kafka atomicity needed |
| 2PC / XA | =1 | Very High | Avoid |

## Tricky Corners ⚠️

- **Kafka EOS ≠ cross-system EOS.** `sendOffsetsToTransaction` only covers Kafka offsets, not your Postgres writes.
- **`read_committed` stalls on open transactions.** A hung producer transaction blocks consumers on that partition until `transaction.timeout.ms`.
- **Idempotent producer is per-session.** Producer restart = new PID = dedupe window resets. Use `transactional.id` for cross-restart EOS.
- **Aborted transactions leave markers.** Consumers pay a small read cost skipping them.
- **`isolation.level=read_uncommitted` (default)** sees records from aborted transactions — never use it for EOS pipelines.
- **Outbox relay must be idempotent** because it can publish then crash before marking.
- **Idempotent consumer needs a unique constraint** — application-level "check then insert" races under concurrency.
- **Exactly-once for HTTP side effects is impossible without receiver cooperation.** Use idempotency keys in the API.
- **`transaction.timeout.ms` should be > `max.poll.interval.ms`** or transactions get aborted mid-flight.

## Common Pitfalls

- Claiming "exactly-once" while using at-least-once + non-idempotent side effects.
- Using `@Transactional` on a Spring listener and assuming it spans Kafka offset commit. It does not unless `KafkaTransactionManager` is wired.
- Forgetting `min.insync.replicas=2` on the output topic — transactions can commit but be lost on failover.
- Using producer idempotence alone and believing it survives producer restarts.
- Storing dedupe keys in a separate store (Redis) without atomicity with the side effect — race-prone.
- Long-running transactions blocking `read_committed` consumers.
- Not setting `isolation.level=read_committed` on EOS consumers, silently reading aborted data.

## Key Interview Tips

- Open with the table: **at-most-once, at-least-once, exactly-once** and their mechanisms.
- State clearly: **"Kafka EOS is intra-Kafka. Cross-system EOS requires idempotent consumers or the outbox pattern."**
- For "how do you avoid duplicates?", answer with **idempotent consumer using a unique key + DB transaction**.
- For "how do you publish to Kafka and write to DB atomically?", answer with **transactional outbox (+ CDC relay)**.
- Mention `sendOffsetsToTransaction` as the mechanism for consume-transform-produce EOS.
- Mention `read_committed` and the **LSO stall** as the trade-off.
- Never propose 2PC/XA as the primary answer; call it out as the anti-pattern.

## Related

- [Kafka index](index.md)
- [Fundamentals](fundamentals.md)
- [Producer & Consumer](producer-consumer.md)
- [Patterns](patterns.md)
- [Operations & Scenarios](operations-and-scenarios.md)
- [Microservices Patterns → Data Management](../microservices-patterns/data-management.md)