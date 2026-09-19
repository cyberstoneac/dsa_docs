# Distributed Message Queue

## Problem Statement

Design a distributed message queue where producers send messages that are consumed by workers. Each message is delivered to **exactly one** consumer (unlike pub/sub, where every subscriber gets a copy). The queue must be durable, scalable, and support task-style workloads.

**Example:**
```
Producer -> Queue "email-sends" -> [Worker 1, Worker 2, Worker 3]
Each message goes to exactly ONE worker.
```

**Real-world uses:**
- Background job processing (send email, resize image)
- Task distribution (order fulfillment, invoice generation)
- Workflow orchestration (step 1 -> step 2 -> step 3)
- Rate-limited external API calls
- Retry queues with exponential backoff

**Similar systems:** RabbitMQ, AWS SQS, ActiveMQ, Redis Streams, Celery, Sidekiq, Google Cloud Tasks.

**Contrast with Pub/Sub:**
| Aspect | Message Queue | Pub/Sub |
|---|---|---|
| Delivery | One consumer per message | All subscribers get a copy |
| Model | Work distribution | Event broadcasting |
| Example | Send email to 1 worker | Notify 5 services of an event |
| Retention | Until consumed (or DLQ) | Until retention expires |

---

## 1. Requirements Clarification

### Functional Requirements
- **Enqueue**: Producers push messages to a named queue
- **Dequeue**: Consumers pull messages from a queue
- **Acknowledgment**: Consumer acks message after successful processing
- **Visibility timeout**: Message hidden while being processed; reappears if not acked
- **Dead Letter Queue (DLQ)**: Failed messages go to DLQ after N retries
- **Delayed messages**: Schedule delivery for a future time
- **Priority queues**: Higher-priority messages processed first
- **FIFO per queue**: Ordering within a queue (optional; strict FIFO is expensive)
- **Exactly-once semantics** (best-effort): At-least-once + idempotent consumers
- **Message TTL**: Messages expire after a configurable time

### Non-Functional Requirements
- **Scale**: 1M messages/sec across all queues
- **Latency**: Enqueue -> dequeue under 10 ms at p99 (hot path)
- **Durability**: Messages survive broker restarts (replicated 3x, persisted)
- **Availability**: 99.99% — must not lose messages
- **Ordering**: FIFO within a queue (single-partition queues) or per-key (partitioned)
- **Visibility timeout**: Configurable (default 30s)
- **Retention**: Configurable (default 4 days for SQS-like)
- **Backpressure**: Slow consumers shouldn't crash the system

### Out of Scope
- Event streaming (that's pub/sub / Kafka)
- Complex routing (exchanges, bindings — RabbitMQ-specific)
- Message transformation / enrichment

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Total enqueue rate     = 1,000,000 msg/sec
  Average consumers      = 10 per queue
  Average message size   = 5 KB
  Peak multiplier        = 3x

Operations:
  Enqueue/sec (peak) = 3,000,000
  Dequeue/sec (peak) = 3,000,000
  Acks/sec (peak)    = 3,000,000
  Total ops/sec      = 9,000,000 (peak)
```

### Storage

```
Retention: 4 days (typical)

Storage per day:
  Messages/day = 1M x 86,400 = 8.64 x 10^10
  Bytes/day    = 8.64 x 10^10 x 5 KB = 432 TB/day

Total (4 days):
  432 TB x 4 = ~1.7 PB

With replication factor 3:
  ~5 PB

With compression (~2x):
  ~2.5 PB
```

### Bandwidth

```
Enqueue bandwidth:
  3M msg/sec x 5 KB = ~15 GB/sec = ~120 Gbps

Dequeue bandwidth:
  3M msg/sec x 5 KB = ~15 GB/sec = ~120 Gbps

Total ingress + egress:
  ~240 Gbps peak
```

### Consumer State

```
Active consumers:
  Average 10 consumers per queue
  100,000 queues = 1M consumers

Per consumer state:
  - Current in-flight messages (~10)
  - Visibility timeout deadlines
  - Consumer heartbeat
  Total: ~1 KB per consumer

Total consumer state:
  1M x 1 KB = ~1 GB (small, fits in Redis)
```

### In-Flight Messages

```
Number of messages being processed at any time:
  Throughput x avg processing time
  = 1M msg/sec x 5 sec = 5M in-flight

Tracking state:
  5M x 100 bytes = ~500 MB (fits in memory)
```

---

## 3. High-Level Design

```d2
direction: down

producer: Producer {shape: person}
consumer: Consumer {shape: person}
gw: "API Gateway" {shape: hexagon}
coord: "Queue Coordinator" {shape: rectangle}
qw: "Queue Worker (data plane)" {shape: rectangle}
meta: "Metadata Store (etcd)" {shape: cylinder}
msg: "Message Store (RocksDB/S3)" {shape: cylinder}
inflight: "In-Flight Tracker (Redis)" {shape: cylinder}
dlq: "Dead Letter Queue" {shape: queue}
mon: "Monitoring" {shape: cylinder}

producer -> gw: enqueue
consumer -> gw: dequeue / ack
gw -> coord: route to queue partition
coord -> meta: queue config
coord -> qw: write/read message
qw -> msg: persist
qw -> inflight: track visibility
qw -> dlq: move failed
qw -> mon: metrics
```

### Component Responsibilities

| Component | Role |
|---|---|
| API Gateway | Entry point for producers and consumers |
| Queue Coordinator | Routes to partitions, manages metadata, tracks in-flight |
| Queue Worker (data plane) | Handles enqueue/dequeue/ack, persists messages |
| Metadata Store | Queue configs, partition assignments, quotas |
| Message Store | Durable storage for messages (RocksDB per partition) |
| In-Flight Tracker | Tracks messages currently being processed |
| Dead Letter Queue | Stores messages that failed N times |
| Monitoring | Metrics, alerts, dashboards |

### Architecture Principles

1. **Partition queues by queue name** for parallelism
2. **Separate metadata (small, consensus) from data (large, partitioned)**
3. **Durability via replication** (3x) + disk persistence
4. **In-flight tracking in memory** with TTL-based visibility timeout
5. **Dead letter queue** for poison messages
6. **Idempotent producers/consumers** for at-least-once delivery

---

## 4. API Design

### Enqueue

```http
POST /v1/queues/{queue_name}/messages
Content-Type: application/json

{
  "messages": [
    {
      "id": "msg-uuid-1",
      "payload": {"task": "send_email", "user_id": 12345},
      "delay_seconds": 0,
      "priority": "high",
      "ttl_seconds": 86400
    }
  ]
}
```

**Response 200:**
```json
{
  "message_ids": ["msg-uuid-1"]
}
```

### Dequeue (Poll)

```http
GET /v1/queues/{queue_name}/messages?max=10&visibility_timeout=30
```

**Response 200:**
```json
{
  "messages": [
    {
      "id": "msg-uuid-1",
      "payload": {"task": "send_email"},
      "receipt_handle": "rh-abc123",
      "enqueued_at": "2026-09-17T10:00:00Z",
      "receive_count": 1
    }
  ]
}
```

**Note:** `receipt_handle` is required for ack/delete — prevents double-ack.

### Acknowledge

```http
POST /v1/queues/{queue_name}/messages/{msg_id}/ack
Content-Type: application/json

{
  "receipt_handle": "rh-abc123"
}
```

**Response 200:**
```json
{
  "acked": true
}
```

### Extend Visibility (Long-Running Task)

```http
POST /v1/queues/{queue_name}/messages/{msg_id}/extend
Content-Type: application/json

{
  "receipt_handle": "rh-abc123",
  "additional_seconds": 60
}
```

**Use case:** Task needs more time than the initial visibility timeout.

### Nack (Negative Ack — Retry Immediately)

```http
POST /v1/queues/{queue_name}/messages/{msg_id}/nack
Content-Type: application/json

{
  "receipt_handle": "rh-abc123",
  "requeue": true,
  "delay_seconds": 5
}
```

**Use case:** Processing failed, requeue for retry (with optional delay).

### Batch Operations

For high throughput, batch up to 10 messages per API call. Reduces HTTP overhead.

---

## 5. Storage Design

### Queue Structure

```d2
direction: down

q: "Queue: email-sends" {shape: queue}
p0: "Partition 0" {shape: cylinder}
p1: "Partition 1" {shape: cylinder}
p2: "Partition 2" {shape: cylinder}
note: "Per-partition storage: seg-0000000000000.log | seg-0000000000001.log | index file (id -> position) | metadata (head_offset, tail_offset) | Each segment ~256 MB" {shape: rectangle}

q -> p0
q -> p1
q -> p2
p0 -> note
```

### Message Format

```
| msg_id (16B UUID) | enqueued_at (8B) | ttl (4B) | priority (1B) | receive_count (4B) |
| payload_len (4B) | payload | receipt_handle (16B) |
```

### Partition Strategy

**Option A: Single partition per queue**
- Strict FIFO
- Limited throughput (one consumer at a time)
- Good for: order-sensitive workloads

**Option B: Hash by message key**
- Same key -> same partition (per-key ordering)
- Parallel consumption across partitions
- Good for: user-scoped tasks (all tasks for user X in order)

**Option C: Round-robin**
- Maximum parallelism
- No ordering guarantee
- Good for: independent tasks

**Recommendation:** Round-robin by default; hash-by-key for ordered use cases.

### Dead Letter Queue

```json
{
  "queue_name": "email-sends",
  "dlq_name": "email-sends-dlq",
  "max_receive_count": 5,
  "dlq_retention_days": 14
}
```

After 5 failed receives, message moves to DLQ. Ops review DLQ periodically.

### Delayed Messages

```
Delayed queue: messages with delay_seconds > 0
Stored in a separate structure sorted by deliver_at time
Background scanner moves messages to main queue when due
```

**Storage:** Redis sorted set or RocksDB with time-based index.

### Priority Queues

```
High priority queue     -> processed first
Normal priority queue   -> default
Low priority queue      -> processed when high/normal empty

Implementation: separate queues, single consumer polls in priority order.
```

**Trade-off:** Starvation risk for low-priority queues. Add aging or time-based promotion.

---

## 6. Algorithm Deep Dive: Visibility Timeout

### The Problem

When a consumer dequeues a message, the queue must ensure the message isn't lost if the consumer crashes. Naively, deleting the message on dequeue risks loss.

### The Solution

```
1. Consumer calls dequeue -> message returned with receipt_handle
2. Message is HIDDEN from other consumers for visibility_timeout seconds
3. Consumer processes the message
4a. If success: consumer calls ack -> message deleted
4b. If crash or timeout: message becomes visible again after timeout
```

### State Machine

```d2
direction: down

ready: "Ready" {shape: rectangle}
inflight: "In-Flight" {shape: rectangle}
acked: "Acked" {shape: rectangle}
dlq: "Dead Letter" {shape: rectangle}
start: Start {shape: circle}

start -> ready: enqueue
ready -> inflight: dequeue
inflight -> acked: ack
inflight -> ready: visibility timeout expires
inflight -> ready: nack (requeue)
inflight -> dlq: max receives exceeded
acked -> acked
```

### Visibility Timeout Best Practices

- **Default:** 30 seconds (SQS default)
- **Too short:** Message reappears while still processing → duplicate work
- **Too long:** Slow recovery if consumer crashes
- **Extension:** Consumer can extend visibility for long-running tasks
- **Heartbeat:** Some queues (Kafka-like) auto-extend on consumer heartbeat

### Race Condition: Double Ack

```
Consumer A dequeues msg, starts processing (receipt_handle=rh1)
Visibility timeout expires
Consumer B dequeues same msg (receipt_handle=rh2)
Consumer A finishes, calls ack with rh1 -> REJECTED (stale handle)
Consumer B finishes, calls ack with rh2 -> accepted
```

**Key:** Receipt handles are unique per dequeue. Ack must include current handle.

---

## 7. Deep Dive: Delivery Guarantees

### At-Most-Once

```
1. Dequeue message
2. Delete immediately
3. Process (may fail)
```

**Risk:** Message lost on crash.
**Use case:** Metrics where loss is acceptable.

### At-Least-Once (Default)

```
1. Dequeue with visibility timeout
2. Process
3. Ack (delete) only on success
```

**Risk:** Duplicate processing if ack fails.
**Mitigation:** Idempotent consumers.

### Exactly-Once

```
Requires:
  - At-least-once delivery
  - Idempotent consumer (dedup by message_id)
  - OR transactional processing (ack + side-effect atomically)
```

**Reality:** Exactly-once is at-least-once + idempotency in practice.

### Idempotency Implementation

```java
public void process(Message msg) {
    if (db.exists("processed:" + msg.id)) {
        ack(msg);  // Already done
        return;
    }
    try {
        doWork(msg);
        db.insert("processed:" + msg.id);
        ack(msg);
    } catch (Exception e) {
        nack(msg, delay=5);
    }
}
```

`processed:` table with unique constraint on `message_id`. TTL matches message retention.

### Ordering vs Throughput

```
FIFO strict:
  One partition, one consumer at a time
  Throughput: ~thousands/sec

FIFO per key:
  Hash key -> partition
  Same key = same partition = ordered
  Different keys = parallel
  Throughput: millions/sec

No ordering:
  Round-robin, maximum parallelism
  Throughput: tens of millions/sec
```

**Rule:** Never choose strict FIFO unless you truly need it. Per-key FIFO is usually sufficient.

---

## 8. Deep Dive: Scaling

### Queue-Level Scaling

```d2
direction: down

p: Producer {shape: person}
router: "Queue Router" {shape: hexagon}
p0: "Partition 0 (broker 1)" {shape: cylinder}
p1: "Partition 1 (broker 2)" {shape: cylinder}
p2: "Partition 2 (broker 3)" {shape: cylinder}
c1: "Consumer 1" {shape: rectangle}
c2: "Consumer 2" {shape: rectangle}
c3: "Consumer 3" {shape: rectangle}

p -> router
router -> p0
router -> p1
router -> p2
p0 -> c1
p1 -> c2
p2 -> c3
```

**Each partition is independent.** Add partitions to scale producers/consumers.

**Trade-off:** More partitions = more parallelism but weaker ordering.

### Broker-Level Scaling

- Each broker hosts multiple partitions
- Partitions are distributed for even load
- Adding a broker triggers partition rebalance
- Consistent hashing minimizes data movement

### Consumer Scaling

- Consumers within a consumer group share partitions
- Max parallelism = number of partitions
- If partition count is 10, max 10 parallel consumers per group
- To scale further, add partitions (requires repartitioning)

### Hot Queue Handling

**Problem:** One queue gets 80% of traffic.

**Solutions:**
- More partitions for hot queues
- Dedicated brokers for hot queues
- Producer-side sharding (shard queue into `queue-name-1`, `queue-name-2`)
- Rate limit producers to spread load

### Multi-Region

```d2
direction: down

us: "US Region" {shape: cloud}
eu: "EU Region" {shape: cloud}
apac: "APAC Region" {shape: cloud}

us <-> eu: async replication
eu <-> apac: async replication
apac <-> us: async replication
```

**Options:**
- **Region-local queues**: Each region has its own queues (no cross-region)
- **Global queues**: Replicated across regions (higher latency, complex consistency)
- **Federated**: Producers enqueue to nearest region; consumers process regionally

**Recommendation:** Region-local for 99% of cases.

---

## 9. Deep Dive: Retry and Backoff

### Why Retry?

Failures are transient: network blips, downstream service down, rate limits.

### Retry Strategies

**Immediate retry:**
```
Fail -> nack(requeue=true) -> immediately visible again
```
Bad: thundering herd if downstream is down.

**Fixed delay:**
```
Fail -> nack(requeue=true, delay=5s) -> visible after 5s
```
OK for simple cases.

**Exponential backoff:**
```
Attempt 1: delay 1s
Attempt 2: delay 2s
Attempt 3: delay 4s
Attempt 4: delay 8s
Attempt 5: delay 16s -> move to DLQ
```
Best practice.

**Exponential backoff with jitter:**
```
delay = base * 2^attempt * random(0.5, 1.0)
```
Prevents synchronized retries.

### Dead Letter Queue Flow

```d2
direction: down

q: "Main Queue" {shape: queue}
c: Consumer {shape: rectangle}
r: "Retry Queue (delayed)" {shape: queue}
dlq: "Dead Letter Queue" {shape: queue}
ops: "Ops Dashboard" {shape: rectangle}

q -> c: dequeue
c -> q: ack (success)
c -> r: nack with delay (fail, retry_count < 5)
r -> q: requeue after delay
c -> dlq: fail after 5 retries
dlq -> ops: alert / manual review
```

### Retry Budget

Cap retries to avoid infinite loops:
```
max_receive_count: 5
After 5 receives without ack: move to DLQ
```

### Poison Messages

Messages that always fail (bad schema, unexpected data):
- Detected via high `receive_count`
- Moved to DLQ
- Alert ops for manual review

### Idempotency on Retry

Retries may cause duplicate processing. Consumers must be idempotent:
- Use message_id as idempotency key
- Store processed IDs in DB with unique constraint
- On duplicate: skip work, ack

---

## 10. Deep Dive: Priority and Delayed Messages

### Priority Queues

```d2
direction: down

h: "High Priority Queue" {shape: queue}
n: "Normal Priority Queue" {shape: queue}
l: "Low Priority Queue" {shape: queue}
c: Consumer {shape: rectangle}

c -> h: poll first
c -> n: poll second
c -> l: poll last
```

**Implementation:**
- Three physical queues per logical queue
- Consumer polls in priority order
- If high is empty, poll normal
- If normal is empty, poll low

**Trade-off:** Low-priority messages may starve.

**Mitigation:** Aging — promote old low-priority messages after N seconds.

### Delayed Messages

```d2
direction: down

p: Producer {shape: person}
q: "Main Queue" {shape: queue}
d: "Delay Index (Redis ZSET)" {shape: cylinder}
s: Scheduler {shape: rectangle}

p -> q: enqueue (delay=0)
p -> d: enqueue with score=deliver_at (delay>0)
d -> s: scan due messages
s -> q: move to main queue
```

**Implementation:**
- Delayed messages stored in a time-sorted structure (Redis sorted set)
- Background scanner polls for due messages
- Moves them to the main queue
- Granularity: 1 second (good enough for most use cases)

**Use cases:**
- Scheduled tasks (send reminder in 24 hours)
- Rate limiting (retry after 30s)
- Workflow delays (wait for external event)

---

## 11. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Hot queue | More partitions | Rebalance cost |
| Slow consumer | Add consumers | Partition limit |
| Strict FIFO | Single partition | Throughput bottleneck |
| Duplicate processing | Idempotent consumers | Storage for dedup |
| Large messages | Chunking, S3 offload | Complexity |
| Message loss | Replication 3x + fsync | Latency + cost |
| In-flight state | In-memory with TTL | Redis dependency |
| Delay precision | Sorted set, 1s granularity | Approximate |
| Priority starvation | Aging | Complexity |
| Multi-region | Region-local queues | Cross-region workflows |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Model | Log-based queue (per partition) | Durability, replay |
| Partitioning | Round-robin default, hash-by-key for FIFO | Balance throughput and ordering |
| Delivery | At-least-once | Standard, simple |
| Visibility | Timeout with receipt handle | Prevents double-ack |
| Retry | Exponential backoff + jitter | Reduces thundering herd |
| DLQ | After 5 retries | Prevents poison messages |
| Storage | RocksDB per partition | Fast, durable |
| Metadata | etcd | Consensus for configs |
| In-flight | Redis with TTL | Fast, scalable |
| Multi-region | Region-local | Simplicity |
| Priority | Separate queues | Simple, no starvation prevention |

---

## 12. Failure Scenarios

### Broker Failure

**Impact:** Partitions on that broker become unavailable.

**Recovery:**
- Leader election (~10s)
- Followers promote
- Producers/consumers reconnect
- Messages preserved via replication

**Data loss:** Only if `acks=1` and leader failed before replicating.

### Consumer Crash

**Impact:** In-flight messages become visible again after visibility timeout.

**Recovery:**
- Another consumer picks up the message
- Processing retries
- Possible duplicate processing (consumer must be idempotent)

### Visibility Timeout Race

**Scenario:**
```
T=0:   Consumer A dequeues (30s visibility)
T=25:  Consumer A still processing
T=30:  Message becomes visible
T=31:  Consumer B dequeues
T=32:  Consumer A finishes, acks -> REJECTED (stale handle)
T=33:  Consumer B finishes, acks -> accepted
```

**Mitigation:** Consumer A should extend visibility before timeout if processing takes longer.

### DLQ Overflow

**Impact:** DLQ fills up with poison messages.

**Mitigation:**
- Alert when DLQ size > threshold
- Auto-purge DLQ after retention period
- Ops review and fix root cause

### Slow Consumer

**Impact:** Queue backlog grows unbounded.

**Mitigation:**
- Monitor queue depth and consumer lag
- Add more consumers (up to partition limit)
- Rate limit producers
- Increase partitions

### Thundering Herd

**Impact:** All consumers poll at once when messages arrive.

**Mitigation:**
- Long polling (consumer waits up to 20s for a message)
- Backoff with jitter on empty polls
- Server-side push with backpressure

### Network Partition

**Impact:** Split-brain possible for metadata.

**Mitigation:**
- etcd/consensus store for metadata (CP)
- Data plane continues for accessible partitions
- Minority partitions block writes

---

## 13. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Enqueue p99 latency | < 10 ms | > 50 ms |
| Dequeue p99 latency | < 10 ms | > 50 ms |
| Queue depth | baseline | > 10x normal |
| Consumer lag (age of oldest message) | < 30s | > 5 min |
| DLQ size | 0 | > 100 |
| Message throughput | steady | sudden drop > 50% |
| In-flight count | stable | > 10x normal |
| Visibility timeout rate | < 0.1% | > 1% |

### Dashboards

- **Throughput**: Enqueue, dequeue, ack rates per queue
- **Latency**: p50/p95/p99 for each operation
- **Depth**: Messages waiting per queue
- **Consumer health**: Lag, in-flight, errors
- **DLQ**: Size, growth rate
- **Infrastructure**: Broker CPU, disk, network

### Alerts

- **P0**: Broker down, message loss detected
- **P1**: Queue depth > 10x normal, DLQ growing
- **P2**: Consumer lag > 5 min, high visibility timeout rate
- **P3**: Rebalance activity, high reconnect rate

---

## 14. Cost Estimation

Rough monthly cost (AWS, us-east-1) for 1M msg/sec:

| Component | Spec | Cost/month |
|---|---|---|
| Broker compute | 20 x m6i.4xlarge | ~$30,000 |
| Storage (EBS) | 500 TB gp3 | ~$40,000 |
| Cold storage (S3) | 500 TB | ~$12,000 |
| Redis (in-flight) | 10 x cache.r6g.2xlarge | ~$8,000 |
| Networking | 100 Gbps peak | ~$15,000 |
| Metadata (etcd) | 3 small nodes | ~$500 |
| Monitoring | Prometheus + Grafana | ~$2,000 |
| **Total** | | **~$108,000/month** |

**Cost optimization:**
- Shorter retention (4 days -> 1 day: 75% savings)
- Compression (2x savings)
- Reserved instances (30-40% savings)
- Serverless (AWS SQS) for variable load
- Tiered storage (move old messages to S3)

---

## 15. Extensions and Follow-ups

### AWS SQS vs Self-Hosted

| Aspect | AWS SQS | Self-Hosted (RabbitMQ) |
|---|---|---|
| Managed | Yes | No |
| Scale | Automatic | Manual |
| Cost | Pay-per-use | Fixed infra |
| FIFO | Limited throughput | Full support |
| Visibility timeout | Yes | Yes |
| Best for | Variable load | Predictable, custom |

**Rule:** Start with SQS. Move to self-hosted when scale/cost demands.

### Exactly-Once with Transactions

For critical workflows:
```
BEGIN TRANSACTION
  process(msg)
  UPDATE processed SET id = msg.id
  DELETE FROM queue WHERE id = msg.id
COMMIT
```
All-or-nothing. Prevents duplicate processing.

**Cost:** Higher latency, requires transactional store.

### Streaming Semantics on Queue

Some systems (Kafka) blur the line between queue and stream:
- Kafka topics can be consumed as a queue (consumer group)
- Kafka topics can be consumed as pub/sub (multiple groups)

**Message queue = pub/sub with a single consumer group.**

### Serverless Integration

- **AWS Lambda** triggered by SQS
- **Google Cloud Functions** triggered by Cloud Tasks
- **Azure Functions** triggered by Service Bus

Serverless scales to zero, pays per invocation.

### Workflow Orchestration

For multi-step workflows:
```
Step 1 (order placed) -> Step 2 (payment) -> Step 3 (ship) -> Step 4 (notify)
```

Each step is a queue. State machine (AWS Step Functions, Temporal) orchestrates.

### Rate Limiting via Queue

Use a queue to throttle external API calls:
```
Producer -> Rate-limited queue -> Worker (N workers, N = rate limit)
```

Workers are configured to only make N calls/sec to the external API.

### Batch Processing

Consumers can batch-process messages:
```
Dequeue 100 messages -> process in batch -> ack all 100
```
- Higher throughput
- Lower overhead per message
- Slightly higher latency for the first message in a batch

### Long Polling

Instead of returning immediately on empty dequeue, the server waits up to N seconds:
```http
GET /v1/queues/{name}/messages?wait=20
```
- Reduces empty polls
- Lower cost (fewer API calls)
- Slightly higher latency on idle

### FIFO with Deduplication

SQS FIFO provides:
- Strict ordering per message group
- 5-minute dedup window
- 300 msg/sec per queue (or 3000 with batching)

For high-throughput FIFO, self-host or shard across multiple FIFO queues.

---

## 16. Summary

| Aspect | Decision |
|---|---|
| Model | Log-based per partition |
| Partitioning | Round-robin default, hash-by-key for FIFO |
| Delivery | At-least-once (idempotent consumers) |
| Visibility timeout | 30s default, extendable |
| Ack mechanism | Receipt handle |
| Retry | Exponential backoff + jitter, max 5 retries |
| DLQ | After max retries, 14-day retention |
| Storage | RocksDB per partition + S3 cold |
| Metadata | etcd |
| In-flight tracking | Redis with TTL |
| Priority | Separate queues (high/normal/low) |
| Delayed messages | Sorted set + scheduler |
| Multi-region | Region-local queues |
| Latency | < 10 ms p99 for enqueue/dequeue |
| Scale | 3M msg/sec peak |

**Key takeaways:**

- **Visibility timeout** is the core mechanism — hides messages during processing, auto-recovers on crash
- **Receipt handles** prevent double-ack from stale consumers
- **At-least-once + idempotency** is the pragmatic standard; exactly-once is expensive
- **Partitioning** balances throughput and ordering; strict FIFO is costly
- **Dead letter queues** prevent poison messages from blocking consumers
- **Exponential backoff with jitter** avoids thundering herds
- **Region-local queues** are simpler than global; use global only when needed
- **Long polling** reduces empty polls and cost
- **Message queues distribute work**, while pub/sub broadcasts events — pick the right tool

**Similar Pattern Problems:**

- Pub/Sub System (queue vs log — complementary patterns)
- Distributed Task Scheduler (uses queues for job distribution)
- Log Ingestion System (uses queues for buffering)
- Real-Time Notification System (uses queues for delivery)
- Food Delivery (uses queues for order dispatch)
- E-Commerce Checkout (uses queues for async order processing)