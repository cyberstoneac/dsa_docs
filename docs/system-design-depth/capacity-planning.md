# Capacity Planning

> **Context:** At lead level, back-of-envelope math is not optional. Every design review and every system design interview has a "how much?" moment — servers, partitions, storage, bandwidth, cost. This file gives you the numbers and the method.

## Mental Model

Capacity planning is **estimation under uncertainty**. You don't need precision; you need order of magnitude and a growth model.

```d2
direction: right

inputs: "Inputs {\\n  QPS\\n  payload size\\n  retention\\n  replication\\n  growth rate"
calc: "Calculations {\\n  storage\\n  bandwidth\\n  compute\\n  partitions\\n  cost"
output: "Output {\\n  servers\\n  brokers\\n  DB size\\n  monthly cost"

inputs -> calc
calc -> output
```

**Rule:** always state your assumptions. The math is the easy part; the assumptions are the interview.

## Numbers Every Engineer Should Know

| Thing | Value |
|---|---|
| L1 cache | ~1 ns |
| Main memory | ~100 ns |
| SSD random read | ~100 µs |
| HDD random read | ~10 ms |
| Network RTT (same DC) | ~0.5 ms |
| Network RTT (cross-region) | ~50–150 ms |
| Disk throughput (SSD) | ~500 MB/s |
| Network throughput (10 GbE) | ~1.25 GB/s |
| Requests/sec per core (simple) | ~10k |
| Requests/sec per core (DB query) | ~100–1k |
| Kafka throughput per partition | ~10 MB/s |
| Postgres writes per node | ~10k/s |
| Postgres reads per node | ~50k/s |
| Redis ops per node | ~100k/s |

**Rule:** memorize the order of magnitude, not the digits.

## Units Cheat Sheet

| Unit | Value |
|---|---|
| 1 KB | 10^3 bytes |
| 1 MB | 10^6 bytes |
| 1 GB | 10^9 bytes |
| 1 TB | 10^12 bytes |
| 1 PB | 10^15 bytes |
| 1 day | 86,400 s (round to 10^5) |
| 1 month | ~2.6M s (round to 2.5 × 10^6) |
| 1 year | ~31.5M s (round to 3 × 10^7) |

**Rule:** round aggressively. Precision is false comfort.

## The Core Formulas

### Storage

```
storage = records/sec × bytes/record × retention × replication_factor
```

Example: 10k events/sec, 1 KB each, 7-day retention, RF 3:
- 10k × 1 KB = 10 MB/s
- × 86400 s/day × 7 days = ~6 TB raw
- × 3 (RF) = ~18 TB

### Bandwidth

```
bandwidth = requests/sec × bytes/request × 8 (bits)
```

Example: 100k req/s, 5 KB response:
- 100k × 5 KB = 500 MB/s
- × 8 = 4 Gbps

### Compute

```
servers = peak_QPS / per_server_QPS × headroom
```

Example: 100k QPS peak, 5k QPS per server, 1.5x headroom:
- 100k / 5k = 20 servers
- × 1.5 = 30 servers

### Partitions

```
partitions = max(
  ceil(target_throughput / per_partition_throughput),
  target_consumer_parallelism
)
```

Example: 100 MB/s target, 10 MB/s per partition, 12 consumers:
- 100 / 10 = 10 partitions for throughput
- 12 for consumer parallelism
- Round to 16 (power of 2)

### Cache size

```
cache_size = hot_dataset_size × 1.2
```

Example: 5% of 1B records are hot, 1 KB each:
- 50M × 1 KB = 50 GB
- × 1.2 = 60 GB

### Cost

```
monthly_cost = (compute_hours × rate) + (storage_GB × rate) + (egress_GB × rate)
```

Example (rough AWS):
- 30 servers × $0.10/hr × 720 hr = $2,160
- 18 TB storage × $0.10/GB = $1,800
- 100 TB egress × $0.09/GB = $9,000

## Worked Examples

### Example 1: URL Shortener

Assumptions:
- 100M new URLs/day
- 10:1 read:write ratio
- 500 bytes per URL record
- 5-year retention

Writes:
- 100M / 86400 ≈ 1,200 writes/sec
- Peak: 5x = 6,000 writes/sec

Reads:
- 1.2k × 10 = 12k reads/sec
- Peak: 60k reads/sec

Storage:
- 100M/day × 500 B = 50 GB/day
- × 365 × 5 = ~91 TB
- With RF 3 = ~273 TB

Servers:
- Reads: 60k / 5k per server = 12 servers × 1.5 = 18
- Writes: 6k / 5k = 2 servers × 1.5 = 3
- Total ~21 servers + DB cluster

Cache:
- 20% hot: 20M URLs/day × 500 B × 30 days ≈ 300 GB

### Example 2: Chat System

Assumptions:
- 50M DAU
- 20 messages/user/day
- 200 bytes per message
- 5-year retention

Messages:
- 50M × 20 = 1B/day
- 1B / 86400 ≈ 11,600/sec
- Peak 5x = 58,000/sec

Storage:
- 1B × 200 B = 200 GB/day
- × 365 × 5 = 365 TB
- RF 3 = ~1.1 PB

Connections:
- Concurrent users ~10% of DAU = 5M
- Per WebSocket server: 50k connections
- Servers: 5M / 50k = 100 servers × 1.5 = 150

Bandwidth:
- 58k msg/s × 200 B × 2 (fan-out average) = 23 MB/s
- Plus delivery overhead ~2x

### Example 3: Kafka-based Event Pipeline

Assumptions:
- 500k events/sec
- 1 KB per event
- 7-day retention
- RF 3
- 3 consumers per event

Throughput:
- 500k × 1 KB = 500 MB/s

Storage:
- 500 MB/s × 86400 × 7 = ~300 TB raw
- × 3 = ~900 TB

Partitions:
- 500 MB/s / 10 MB/s per partition = 50 partitions
- Round to 64

Brokers:
- 500 MB/s in + 1.5 GB/s out (3 consumers) = 2 GB/s
- Per broker ~500 MB/s → 4–6 brokers minimum
- × 1.5 headroom = 8 brokers

Consumers:
- 500k events/s ÷ 10k events/s per consumer = 50 consumers

### Example 4: Multi-Region Active-Active

Assumptions:
- 1M users globally
- 100 req/user/day
- 5 KB response

Traffic:
- 100M req/day = 1,200 req/s
- Peak 5x = 6,000 req/s
- Split across 3 regions: 2,000 req/s per region

Per region:
- 2,000 req/s / 5k per server = 1 server × 1.5 = 2 servers (min 3 for HA)
- Storage: replication across regions multiplies by 3
- Cross-region bandwidth: inter-region replication traffic

Cost:
- 3 regions × 3 servers = 9 servers minimum
- Storage: 3x replication
- Egress: inter-region traffic (significant)

## Growth Modeling

Plan for growth explicitly:

| Growth | Strategy |
|---|---|
| 2x | Vertical scaling, read replicas |
| 5x | Sharding, caching, async |
| 10x | Multi-region, edge |
| 100x | Rethink architecture |

**Rule:** design for 10x, plan for 100x, and know what 100x requires.

### Growth formula

```
future_capacity = current_capacity × (1 + growth_rate)^years
```

Example: 20% annual growth, 3 years: 1.2^3 = 1.73x. Round to 2x.

## Cost Optimization

| Lever | Typical savings |
|---|---|
| Right-sizing | 20–40% |
| Reserved / committed use | 30–50% |
| Spot instances (stateless) | 60–80% |
| Tiered storage | 50–70% |
| Compression | 30–70% (data) |
| Caching | 50–90% (DB load) |
| Async batching | 30–50% (compute) |
| Autoscaling | 20–40% |

**Rule:** cost is an NFR. Track $/request, not just total spend.

## Back-of-Envelope Template

For any system design:

```
1. Users / DAU
2. Actions per user per day
3. QPS = (users × actions) / 86400
4. Peak QPS = QPS × 5
5. Payload size
6. Bandwidth = peak_QPS × payload
7. Daily storage = actions × payload
8. Total storage = daily × retention × RF
9. Compute = peak_QPS / per_server_QPS × 1.5
10. Cache = hot% × dataset × 1.2
11. Cost = compute + storage + egress
```

## Tricky Corners ⚠️

- **Assumptions are the interview.** State them explicitly.
- **Peak > average.** 5x is a common rule of thumb.
- **Replication multiplies storage and bandwidth.**
- **Egress costs surprise people.** Cross-region and internet egress are expensive.
- **Consumers multiply Kafka bandwidth.** 3 consumers = 3x reads.
- **Cache hit rate matters.** 80% hit rate = 80% load reduction.
- **Storage grows with retention.** Retention is a business decision.
- **Compute needs headroom.** 1.5x is a minimum for HA.
- **p99 ≠ average.** Capacity planning uses peak + headroom.
- **Growth compounds.** 20% annual = 2x in 4 years.
- **Cost scales with everything.** Compute, storage, egress, ops, people.

## Common Pitfalls

- Skipping the math entirely.
- Using averages instead of peaks.
- Forgetting replication.
- Forgetting egress costs.
- Forgetting consumer fan-out.
- Assuming linear scale (real systems don't).
- Ignoring the team's capacity to operate.
- Not modeling growth.
- Optimizing for precision over order of magnitude.
- Not stating assumptions.

## Key Interview Tips

- Lead with **"I'll start with assumptions, then work through the math."**
- For any design, calculate **QPS → bandwidth → storage → compute → cost.**
- For Kafka, calculate **partitions, brokers, consumers** explicitly.
- For multi-region, add **replication and egress** costs.
- For growth, say **"design for 10x, plan for 100x."**
- For cost, say **"track $/request, not just total spend."**
- Always round aggressively and state that **order of magnitude is what matters.**
- Close with **"and we'd need the team to operate this — that's a real constraint."**

## Related

- [System Design Depth index](index.md)
- [Non-Functional Requirements](non-functional-requirements.md)
- [Failure Modes](failure-modes.md)
- [Evolution Stories](evolution-stories.md)
- [Rollout Strategies](rollout-strategies.md)