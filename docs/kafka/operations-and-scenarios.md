# Kafka Operations & Scenarios

> **Spring context:** Spring Boot 3.x Actuator exposes `KafkaListenerEndpointRegistry` and Micrometer `kafka.consumer.*` / `kafka.producer.*` metrics. For lag, use `kafka-consumer-groups.sh` or Burrow/`kafka_exporter`. JMX is still the ground truth for broker metrics.

## Mental Model

Every Kafka production incident falls into one of five buckets:

```d2
direction: right

incidents: Kafka Incidents
lag: Consumer Lag
hot: Hot Partition
reb: Rebalance Storm
dup: Duplicates / Loss
size: Message Size / Throughput

lag -> hot
hot -> reb
reb -> dup
dup -> size
```

Diagnose in this order: **lag → partition skew → rebalance → duplicates/loss → size**. Most "Kafka is slow" tickets are lag, and most lag tickets are hot partitions or rebalance storms.

## Scenario 1: Priority Messages (Urgent vs Bulk)

**Problem:** one topic carries both time-sensitive alerts and bulk analytics. Bulk backpressure delays alerts.

**Solutions (in order of preference):**



1. **Separate topics.** `orders-priority` (small, low latency, more partitions) vs `orders-bulk` (large, high throughput). Separate consumer groups, separate SLOs. This is the correct answer.
2. **Separate partitions with key-based routing + separate consumer groups.** Works but couples the two workloads to one topic's config.
3. **Two consumer groups on the same topic, one with a filter.** Filtering is client-side; both still fetch. Wastes bandwidth.
4. **Priority queues inside the consumer** (in-memory `PriorityBlockingQueue`). Only if you truly cannot split topics.

```d2
direction: right

prod: Producer
pri: "orders-priority\\n(3 partitions, 5s retention)"
bulk: "orders-bulk\\n(24 partitions, 7d retention)"
priC: "Priority Consumer Group\\n(low latency, more replicas)"
bulkC: "Bulk Consumer Group\\n(batch, fewer replicas)"

prod -> pri
prod -> bulk
pri -> priC
bulk -> bulkC
```

**Interview line:** "I'd split the topics — priority is a different SLO, different retention, different consumer topology. Same topic means one config compromises both."

## Scenario 2: Backlog Management (1,000 Messages Pending)

First, **quantify**: 1,000 messages over what window? 1,000/s for 10 minutes = 600k. Lag is only a problem if it's growing and violates an SLO.

Decision tree:

| Situation | Action |
|---|---|
| Lag is stable, small | Do nothing; it's normal buffer |
| Lag growing, consumers at CPU cap | Scale consumers **up to partition count**; then add partitions |
| Lag growing, consumers idle | Check for rebalance storm, slow downstream, or `max.poll.interval.ms` |
| Lag growing, downstream is the bottleneck | Rate-limit producers, or scale downstream (DB, HTTP target) |
| Lag from a poison message | Move to DLQ, resume |
| Lag from a consumer bug | Roll back consumer; lag will drain |

**Scale-out ceiling:** consumers > partitions ⇒ idle consumers. If you're at the ceiling and still behind, **add partitions** (accepting the key-reordering caveat) or **increase throughput per consumer** (batch size, compression, async processing).

**Emergency levers:**
- Increase `max.poll.records` (careful: poll interval).
- Increase `fetch.min.bytes` / `fetch.max.wait.ms` for throughput.
- Parallelize per-record processing with a bounded thread pool + `pause()`/`resume()`.
- Temporarily reduce producer rate (backpressure).
- Skip non-critical records (only if business allows).

## Scenario 3: Consumer Lag Growing — Troubleshooting

Diagnostic sequence:

```d2
direction: right

start: Lag growing
s1: Is it one partition or all?
s2: Are consumers healthy?
s3: Is downstream slow?
s4: Is rebalancing happening?
s5: Is producer rate spiking?

start -> s1
s1 -> s2
s2 -> s3
s3 -> s4
s4 -> s5
```

| Symptom | Likely cause | Fix |
|---|---|---|
| One partition lags | Hot key / skewed key | Rekey, custom partitioner, or split entity |
| All partitions lag, consumers CPU-bound | Insufficient parallelism | Add partitions + consumers |
| All partitions lag, consumers idle | Rebalance storm, network, or downstream stall | Static membership, cooperative assignor, check downstream |
| Lag spikes periodically | Batch job, downstream maintenance | Schedule, or scale down producer during window |
| Lag grows slowly forever | Consumer throughput < producer throughput | Capacity math: `produced rate / per-consumer rate` |
| Lag resets to zero suddenly | Consumer committed out of order (async commit bug) | Use sync commit or batch-commit |

**Tuning checklist:**

| Knob | Effect |
|---|---|
| `max.poll.records` | More per poll = more work per loop; watch poll interval |
| `fetch.min.bytes` | Higher = fewer round trips, more latency |
| `fetch.max.wait.ms` | Higher = more batching, more latency |
| `max.partition.fetch.bytes` | Per-partition fetch cap |
| `session.timeout.ms` / `heartbeat.interval.ms` | Faster failure detection vs more false positives |
| `max.poll.interval.ms` | Must exceed worst-case processing time per poll |
| Consumer parallelism | ≤ partition count |
| Compression | Producer-side; reduces network + disk |

## Scenario 4: Partitioning Strategy

**How many partitions?**

```
partitions = max(
  ceil(target_throughput / per_partition_throughput),
  target_consumer_parallelism
)
```

Then round up to a power of 2 (optional, but eases future doubling) and commit. **You cannot easily reduce partitions later**, and increasing them breaks key→partition stability.

**Key choice:**

| Key | Ordering | Skew risk |
|---|---|---|
| `null` | None (sticky batching) | Random, balanced |
| User ID | Per-user | High if few heavy users |
| Order ID | Per-order | Low if order IDs are random |
| Tenant ID | Per-tenant | High if tenants are uneven |
| Country | Per-country | Very high |

**Hot partition detection:**
- Per-partition lag in `kafka-consumer-groups.sh --describe`.
- Broker metrics: bytes-in per partition (`kafka.server:type=BrokerTopicMetrics`).
- Application metrics: keys per second per partition.

**Fixes for hot partitions:**
1. **Salt the key**: `key + "-" + (hash % N)` for N sub-partitions, then re-aggregate downstream.
2. **Custom partitioner** that spreads by a secondary attribute.
3. **Split the entity** (e.g., per-tenant topics for the top tenants).
4. **Switch to a composite key** with higher cardinality.

Trade-off: salting breaks per-key ordering. You must re-aggregate or accept out-of-order.

## Scenario 5: Ordering Guarantees

**What Kafka guarantees:** total order within a partition.
**What it does not guarantee:** order across partitions, order after key rehash, order with `max.in.flight > 1` without idempotence.

| Requirement | Solution |
|---|---|
| Per-entity order | Partition by entity ID |
| Global order | Single partition (throughput ceiling) or sequence numbers + downstream reorder |
| Order + high throughput | Partition per entity; accept cross-entity disorder |
| Order after consumer retry | Retry topic must preserve key partition; consumer must process in order or use per-key single-threaded processing |
| Order with EOS | Transactions + `read_committed` + idempotent producer |

**Producer-side ordering trap:** without `enable.idempotence=true`, retries with `max.in.flight > 1` can reorder. With idempotence, up to 5 in-flight are safe.

**Consumer-side ordering trap:** parallelizing per-record processing breaks order unless you key-partition your thread pool.

## Scenario 6: Duplicate Handling

**Sources:** producer retries, consumer rebalance, consumer crash, CDC re-delivery, outbox relay re-publish.

**Fix: idempotent consumer.**

```java
@Transactional
public void handle(ConsumerRecord<String, OrderEvent> r) {
    UUID id = UUID.fromString(r.key());
    if (dedupeRepo.existsById(id)) return;
    dedupeRepo.save(new ProcessedMessage(id));
    orderService.apply(r.value());
}
```

Rules:
- Dedupe key must be **stable and unique per logical message** — usually a business ID, not the Kafka offset.
- Dedupe store must be in the **same transaction** as the side effect.
- Dedupe table needs a **retention policy** — you cannot keep every ID forever. Keep longer than the max retry window.

See [`delivery-semantics.md`](delivery-semantics.md) for full patterns.

## Scenario 7: Large Messages

Kafka's default `max.message.bytes` is 1 MB. Larger messages hurt throughput and memory.

| Approach | When |
|---|---|
| Compression (`lz4`, `zstd`) | First lever; JSON often compresses 10x |
| Increase `max.message.bytes` | Only up to a few MB; broker + client + consumer must all agree |
| **Claim-check pattern** | Store payload in S3/DB, send the pointer in Kafka. Best for >1 MB |
| Chunking | Split one logical message into N Kafka records with a chunk index; consumer reassembles. Avoid if possible |

**Claim-check is the production answer** for large payloads. Kafka is a transport, not a blob store.

```d2
direction: right

prod: Producer
s3: "Object Store\\n(S3 / GCS)"
kafka: "Kafka\\n(pointer + metadata)"
cons: Consumer

prod -> s3
prod -> kafka
kafka -> cons
cons -> s3
```

## Scenario 8: Consumer Rebalancing Storms

**Symptom:** consumers repeatedly leave/join the group; lag grows; logs show `Rebalance` every few seconds.

**Causes:**
- Pod restarts (K8s rolling deploys, OOM kills).
- `max.poll.interval.ms` exceeded by slow processing.
- Long GC pauses.
- Network partitions.
- Eager assignor + frequent membership changes.

**Fixes (in order):**
1. **Static membership:** set `group.instance.id` per pod. Rejoining within `session.timeout.ms` skips the rebalance.
2. **Cooperative sticky assignor:** `partition.assignment.strategy=CooperativeStickyAssignor`.
3. **Reduce processing time per poll:** lower `max.poll.records`, async offload, batch DB writes.
4. **Increase `session.timeout.ms`** only if GC/network is the cause.
5. **Increase `max.poll.interval.ms`** only if processing is legitimately long.

```properties
# Consumer config for K8s
group.instance.id=orders-svc-${HOSTNAME}
session.timeout.ms=45000
heartbeat.interval.ms=3000
max.poll.interval.ms=300000
max.poll.records=200
partition.assignment.strategy=org.apache.kafka.clients.consumer.CooperativeStickyAssignor
```

## Scenario 9: Monitoring

**Consumer lag** is the #1 SLO metric.

| Signal | Source | Alert threshold |
|---|---|---|
| Consumer lag per group/partition | `kafka-consumer-groups.sh`, Burrow, `kafka_exporter` | Lag > N for > M minutes |
| Under-replicated partitions | Broker JMX `kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions` | > 0 for > 1 min |
| Offline partitions | Broker JMX `OfflinePartitionsCount` | > 0 immediately |
| ISR shrinks/expands | Broker JMX `IsrShrinksPerSec`, `IsrExpandsPerSec` | Sustained > 0 |
| Request handler idle | Broker JMX `RequestHandlerAvgIdlePercent` | < 30% |
| Produce/fetch p99 latency | Broker JMX `Produce`/`Fetch` `TotalTimeMs` | SLO-based |
| Disk usage per broker | Node exporter | > 70% warn, > 85% page |
| Network in/out | Node exporter | Baseline deviation |
| Active controller count | Broker JMX `ActiveControllerCount` | Should be exactly 1 |
| DLQ depth | Custom producer metric on DLQ topic | > 0 |
| Producer retries/errors | Client JMX `record-error-rate`, `record-retry-rate` | > 0 sustained |
| Transaction abort rate | Client JMX | > baseline |

**Spring Boot + Micrometer:** `management.metrics.tags.application` and `spring.kafka` auto-config expose `kafka.consumer.fetch.manager.records.lag.max` etc. For real lag, scrape the consumer group offset vs broker end offset.

## Scenario 10: Security (Awareness Level)

| Layer | Mechanism |
|---|---|
| Transport | TLS (`security.protocol=SSL` or `SASL_SSL`) |
| Authentication | SASL/SCRAM, SASL/GSSAPI (Kerberos), mTLS, OAuth |
| Authorization | ACLs on topics, groups, transactional IDs |
| Encryption at rest | Broker disk encryption (OS-level) |
| Secrets | Vault / K8s secrets for SASL credentials |

**ACL example:**
```bash
kafka-acls --add --allow-principal User:orders-svc \
  --operation Read --topic orders \
  --group orders-svc
```

Rules: no plaintext in prod, least-privilege ACLs per service, rotate SCRAM credentials, audit ACL changes.

## Scenario 11: Tuning Cheat Sheet

### Producer (throughput priority)
```properties
batch.size=262144
linger.ms=20
compression.type=lz4
acks=all
enable.idempotence=true
max.in.flight.requests.per.connection=5
buffer.memory=67108864
```

### Producer (latency priority)
```properties
batch.size=16384
linger.ms=0
compression.type=lz4
acks=1
enable.idempotence=true
```

### Consumer (throughput)
```properties
fetch.min.bytes=1048576
fetch.max.wait.ms=500
max.partition.fetch.bytes=1048576
max.poll.records=1000
```

### Consumer (latency)
```properties
fetch.min.bytes=1
fetch.max.wait.ms=10
max.poll.records=50
```

### Broker (throughput)
```properties
num.network.threads=8
num.io.threads=16
socket.send.buffer.bytes=1048576
socket.receive.buffer.bytes=1048576
log.segment.bytes=1073741824
num.replica.fetchers=4
```

## Scenario 12: Capacity Math (Back of Envelope)

For 100k events/s at 1 KB each:
- Raw bytes/s = 100k × 1 KB = 100 MB/s.
- Replication factor 3 ⇒ 300 MB/s cluster-wide disk + network.
- Consumer reads: assume 1x ⇒ another 100 MB/s out.
- Partitions: if a partition sustains ~10 MB/s, need ≥ 10 partitions; round to 16–32 for headroom.
- Retention 7 days ⇒ 100 MB/s × 86400 × 7 ≈ 60 TB raw; ×3 replication = 180 TB.
- Brokers: if each broker handles 50 MB/s safely, need ≥ 6 brokers; add 1 for failover ⇒ 7.

Always show the math, then sanity-check against known Kafka benchmarks and your own cluster's history.

## Tricky Corners ⚠️

- **Lag can be zero and the system still broken** (consumer stuck in a loop, DLQ filling).
- **`kafka-consumer-groups.sh --describe` is the ground truth**, but it's slow on large groups; use Burrow or `kafka_exporter` for continuous monitoring.
- **Adding consumers beyond partition count does nothing** except increase rebalance churn.
- **Increasing partitions breaks key ordering** across the reshard boundary.
- **DLQ without replay tooling is silent data loss.**
- **`auto.offset.reset=latest`** means a new consumer group skips all history; `earliest` reprocesses everything. Neither is universally right.
- **Retention deletion is per segment**, so disk usage can spike before a segment rolls.
- **Replication factor 3 with `min.insync.replicas=1`** gives you no durability benefit on `acks=all` — always set min ISR ≥ 2.
- **Broker `log.segment.bytes` too large** delays retention; too small creates many files.
- **`unclean.leader.election.enable=true`** can silently lose committed data on failover.

## Common Pitfalls

- Scaling consumers past partition count and wondering why throughput doesn't improve.
- Auto-commit enabled in prod → duplicates or loss on crash.
- `acks=1` for "speed" on data that must not be lost.
- No DLQ monitoring → failures invisible.
- No lag alert → discovered by users.
- Partition count chosen for today's load, not projected.
- `max.poll.interval.ms` default (5 min) and slow per-record processing → rebalance loop.
- Static membership not configured on K8s → rebalance on every pod restart.
- Overriding `retention.ms` on retry topics to something shorter than the retry window.

## Key Interview Tips

- For any scenario, first **quantify**: rate, lag, SLO, partition count, consumer count.
- For lag, lead with **"is it one partition or all?"** — it splits hot-key from capacity problems.
- For priority, answer **"separate topics, separate SLOs"** first.
- For backlogs, answer **"scale consumers up to partition count, then add partitions, then optimize per-consumer throughput."**
- For duplicates, answer **"idempotent consumer with a unique key in the same DB transaction as the side effect."**
- For large messages, answer **"claim-check, not bigger max.message.bytes."**
- For rebalance storms, answer **"static membership + cooperative sticky + reduce max.poll.records."**
- Always mention **monitoring lag, under-replicated partitions, and DLQ depth** as the baseline.
- Close with **capacity math** rather than hand-waving.

## Related

- [Kafka index](index.md)
- [Fundamentals](fundamentals.md)
- [Producer & Consumer](producer-consumer.md)
- [Delivery Semantics](delivery-semantics.md)
- [Patterns](patterns.md)
- [Observability → Metrics, Logs, Traces](../observability/metrics-logs-traces.md)
- [Microservices Patterns → Reliability](../microservices-patterns/reliability.md)