# Metrics / Monitoring System (Prometheus / Datadog / Grafana)

## Problem Statement

Design a metrics collection and monitoring system like Prometheus, Datadog, or Grafana Cloud. Services emit numerical metrics (counters, gauges, histograms), which are aggregated over time, stored in a time-series database, queried for dashboards, and used to trigger alerts. The system must handle millions of metrics, sub-second scrape intervals, long retention, and support real-time alerting.

**Example:**

```
Metrics flow:
  1. Service emits metric: http_requests_total{service="checkout", method="POST", status="200"} 1234
  2. Agent scrapes service every 15 sec (or receives push)
  3. Metric forwarded to collector
  4. Collector validates, deduplicates, enriches (adds host, region)
  5. Metric written to time-series DB (with timestamp)
  6. Query engine fetches for dashboards
  7. Alerting engine evaluates rules (e.g., rate > 1000/sec)
  8. Alert fired to PagerDuty

Metric types:
  - Counter: Monotonic increase (total requests)
  - Gauge: Can go up or down (memory usage)
  - Histogram: Distribution (request latency buckets)
  - Summary: Percentiles (p50, p95, p99)

Scale:
  - 100K services
  - 10M active metrics (unique series)
  - 1B samples/day (~11,574/sec avg, 57,870/sec peak)
  - 15 sec scrape interval
  - 1 year retention
  - 10K queries/sec (peak)
  - 100K alerts evaluated/sec
```

**Real-world systems:** Prometheus, Datadog, Grafana Cloud, InfluxDB, VictoriaMetrics, Thanos, Cortex, Mimir, New Relic.

**Why it's interesting:**

- **Time-series data** — different from logs
- **Cardinality** — number of unique metric series
- **Scrape vs push** — two collection models
- **Compression** — time-series compresses very well
- **Long retention** — 1+ year
- **Fast queries** — sub-second for dashboards
- **Alerting** — real-time rule evaluation
- **Scalability** — millions of series, billions of samples
- **Cost** — storage + query dominate
- **Federation** — multi-cluster aggregation

---

## 1. Requirements Clarification

### Functional Requirements
- **Collect metrics**: Scrape or push
- **Metric types**: Counter, gauge, histogram, summary
- **Store**: Time-series DB
- **Query**: PromQL-like or SQL
- **Dashboards**: Grafana integration
- **Alerts**: Rule-based, on thresholds
- **Retention**: 15 days to 1 year
- **Downsampling**: For long-term
- **Federation**: Multi-cluster
- **Labels**: Multi-dimensional
- **Exemplars**: Link to traces (optional)

### Non-Functional Requirements
- **Scale**: 10M active series, 1B samples/day, 57K samples/sec peak
- **Latency**: Query < 1 sec p99 for recent data
- **Availability**: 99.9% (monitoring is critical)
- **Durability**: Never lose metrics (some loss acceptable)
- **Retention**: 15 days hot, 1 year cold
- **Compression**: 10x typical for time-series
- **Query**: 10K queries/sec peak
- **Alerts**: 100K rules evaluated/sec
- **Cost**: Storage + query dominate

### Out of Scope
- Logs (ELK — separate)
- Traces (Jaeger — separate)
- APM (application monitoring)
- Profiling (continuous profiler)

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Services             = 100,000
  Active series        = 10,000,000
  Samples/day          = 1,000,000,000
  Scrape interval      = 15 sec
  Peak multiplier      = 5x

Average QPS:
  Samples = 1B / 86,400 = ~11,574/sec
  Queries = 5K / 1 = ~5K/sec
  Alerts = 100K / 1 = ~100K/sec

Peak QPS:
  Samples = ~57,870/sec
  Queries = ~10K/sec
  Alerts = ~100K/sec

Samples per scrape:
  Per service: ~100 metrics
  100K services x 100 = ~10M metrics
  10M metrics / 15 sec = ~667K scrapes/sec
```

### Storage

```
Raw samples:
  1B/day x 365 x 1 year = 365B samples
  Per sample: ~1 byte (compressed, delta + gorilla)
  = ~365 GB/year (compressed)

Actually: Prometheus uses ~1.5 bytes/sample
  365B x 1.5 = ~550 GB/year

For 10M series:
  Each series: ~100 samples/day
  = 1B samples/day
  1.5 bytes each = ~1.5 GB/day
  = ~550 GB/year

Index:
  Label index for 10M series
  ~100 bytes per series = ~1 GB

Metadata:
  Metric definitions, labels
  ~10 GB

Downsampled (5-min):
  1 year at 5-min = ~105M samples/series
  For 10M series = ~1T samples
  1.5 bytes = ~1.5 TB

Actually downsampled reduces by 20x:
  ~50 GB/year for downsampled

Total storage:
  Raw: ~550 GB/year
  Downsampled: ~50 GB/year
  Total: ~600 GB/year

Wait, this seems small. Let me recalculate:
  10M series x 100 samples/day = 1B samples/day
  1B x 365 = 365B samples/year
  At 1.5 bytes/sample = 547 GB

Actually, more realistic: Prometheus stores ~1-2 bytes/sample with compression.
For enterprise: 100M+ series is common.
```

### Bandwidth

```
Ingestion:
  57,870 samples/sec x 10 bytes = ~578 KB/sec
  Peak: ~2.9 MB/sec

Query responses:
  10K queries/sec x 10 KB = ~100 MB/sec
  Peak: ~500 MB/sec

Total: ~500 MB/sec peak
```

### Latency Budget

```
Scrape:
  HTTP request:                  ~10 ms
  Parse response:                ~5 ms
  Store:                         ~5 ms
  Total:                         ~20 ms

Query:
  Parse PromQL:                  ~5 ms
  Fetch from TSDB:               ~100-500 ms
  Aggregate:                     ~50 ms
  Response:                      ~50 ms
  Total:                         ~200-600 ms

Alert evaluation:
  Fetch metric:                  ~50 ms
  Evaluate rule:                 ~10 ms
  Fire alert:                    ~20 ms
  Total:                         ~80 ms
```

---

## 3. High-Level Design

```d2
direction: down

service: "Service (metrics endpoint)" {shape: cloud}
agent: "Agent (scraper)" {shape: rectangle}
push: "Push Gateway" {shape: rectangle}

lb: Load Balancer {shape: hexagon}
collector: "Collector" {shape: hexagon}

kafka: Kafka {shape: queue}
ingester: "Ingester" {shape: rectangle}
tsdb: "Time-Series DB" {shape: cylinder}
compactor: "Compactor" {shape: rectangle}
querier: "Querier" {shape: rectangle}
alert: "Alert Engine" {shape: rectangle}
notif: "Notification" {shape: rectangle}
dashboard: "Dashboard (Grafana)" {shape: rectangle}

s3: "S3 (long-term)" {shape: cylinder}
redis: "Redis (cache)" {shape: cylinder}
pdb: "PostgreSQL (config)" {shape: cylinder}

service -> agent : scrape
service -> push : push
agent -> lb
push -> lb
lb -> collector
collector -> kafka
kafka -> ingester
ingester -> tsdb
ingester -> s3
compactor -> tsdb
compactor -> s3

querier -> tsdb
querier -> s3
querier -> redis

alert -> querier
alert -> notif
dashboard -> querier
```

### Component Responsibilities

| Component | Role |
|---|---|
| Service | Emits metrics |
| Agent | Scrapes metrics |
| Push Gateway | Accepts pushed metrics |
| Collector | Receives metrics, routes |
| Kafka | Buffer, decouple |
| Ingester | Writes to TSDB |
| Time-Series DB | Stores samples |
| Compactor | Downsampling, tiering |
| Querier | Query engine |
| Alert Engine | Rule evaluation |
| Notification | Send alerts |
| Dashboard | Grafana |
| S3 | Long-term storage |
| Redis | Query cache |
| PostgreSQL | Config, users |

### Why This Architecture

- **Kafka** decouples ingest from storage
- **TSDB** optimized for time-series (delta + Gorilla)
- **S3** for long-term (cheap)
- **Compactor** for downsampling
- **Querier** with cache

---

## 4. Deep Dive: Metric Collection Models

### Scrape vs Push

**Scrape (Pull):**
- Agent periodically fetches `/metrics`
- Prometheus model
- Pros: Control rate, health check built-in
- Cons: Service must be reachable

**Push:**
- Service sends to gateway
- StatsD model
- Pros: Works for ephemeral jobs
- Cons: No control, may overwhelm

**Hybrid:**
- Scrape for long-running
- Push for jobs, batch

### Scrape Configuration

```yaml
scrape_configs:
  - job_name: 'checkout'
    scrape_interval: 15s
    metrics_path: /metrics
    static_configs:
      - targets: ['checkout-1:9090', 'checkout-2:9090']
```

### Service Discovery

- **Kubernetes**: Auto-discover pods
- **Consul**: Service registry
- **DNS**: SRV records
- **Static**: Config file

**K8s labels:**
```yaml
- job_name: 'kubernetes-pods'
  kubernetes_sd_configs:
    - role: pod
```

### Push Gateway

- **Ephemeral jobs**: Batch, cron
- **Push**: On completion
- **TTL**: Delete after N hours
- **Prometheus scrapes**: Gateway

### Agent

- **Prometheus**: Native scraper
- **Prometheus Agent**: Scrape-only mode
- **OpenTelemetry Collector**: Multi-format

### Collection Scale

```
100K services
~100 metrics per service
10M active series
Scrape interval: 15 sec
~667K scrapes/sec
```

---

## 5. Deep Dive: Time-Series Database

### Time-Series Data Model

```
metric_name{label1="value1", label2="value2"} value timestamp

Example:
http_requests_total{service="checkout", status="200", method="POST"} 1234 1695000000
```

### Storage Layout

**Chunks:**
- Samples grouped by time window (2h typical)
- Compressed (delta + Gorilla)
- Indexed by series + time

**Series index:**
- Inverted index: label → series
- Posting lists
- Fast lookups

**Compression:**
- **Delta encoding**: Timestamps
- **XOR (Gorilla)**: Values
- **Result**: 1-2 bytes/sample (vs 16 raw)

### TSDB Options

- **Prometheus**: Single-node
- **Thanos**: Multi-cluster, S3
- **Cortex / Mimir**: Horizontally scalable
- **VictoriaMetrics**: High-performance
- **InfluxDB**: Full-featured
- **TimescaleDB**: Postgres extension

**Recommendation:** Mimir or VictoriaMetrics.

### Write Path

```
1. Scrape → collector
2. Kafka → ingester
3. Ingester groups by series
4. Append to in-memory chunk
5. Flush to disk (WAL + chunk)
6. Persist to S3 (after time window)
```

### Read Path

```
1. Query → querier
2. Parse PromQL
3. Identify series (index lookup)
4. Fetch chunks
5. Decompress
6. Aggregate
7. Return
```

### Chunk Storage

- **Local**: Recent (hot)
- **S3**: Older (cold)
- **Cache**: Redis for hot queries

### TSDB Scale

```
10M active series
1B samples/day
550 GB/year (compressed)
Query: 10K/sec peak
```

---

## 6. Deep Dive: Cardinality Management

### The Cardinality Problem

**Cardinality** = number of unique metric series.

```
http_requests_total{service, method, status, host, user_id}
= 100 services x 5 methods x 10 statuses x 100 hosts x 1M users
= 500 billion series (!!!)
```

**Each series** = memory + index + chunk.

**High cardinality kills TSDB.**

### Sources of High Cardinality

- **User ID**: Millions of users
- **Trace ID**: Unique per request
- **Session ID**: Unique per session
- **URL**: Infinite
- **Query params**: Infinite

### Rules

- **Don't put high-cardinality in labels**
- **Don't use metric labels for user data**
- **Pre-aggregate** if needed
- **Limit label values**: Alert if too many

### Cardinality Control

**1. Relabeling:**
- Drop high-cardinality labels
- Hash if needed

**2. Aggregation:**
- Record pre-aggregated metrics
- `sum by (service)` at source

**3. Metric budgets:**
- Max series per service
- Alert on exceed

**4. Cardinality analysis:**
- Identify top-N high-card
- Alert
- Review

### Cardinality Metrics

```
prometheus_tsdb_head_series  # Active series
prometheus_tsdb_head_series_created_total  # New per sec
```

### Cardinality Scale

```
Target: 10M active series
High-card threshold: 1M unique values
Alert: > 100K new series/sec
```

---

## 7. Deep Dive: Query Engine

### PromQL

**Metric selectors:**
```
http_requests_total{service="checkout", status="200"}
```

**Functions:**
- `rate(http_requests_total[5m])` — per-second rate
- `sum(rate(http_requests_total[5m])) by (service)` — aggregate
- `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` — p95

**Operators:**
- `+`, `-`, `*`, `/`
- `>`, `<`, `==`

**Subqueries:**
- `avg_over_time(rate(x[5m])[1h:1m])`

### Query Types

**1. Instant query:**
- Value at single timestamp
- `http_requests_total` → current value

**2. Range query:**
- Values over time range
- `http_requests_total[5m]` → 5 min of samples

**3. Aggregation:**
- `sum`, `avg`, `max`, `min`, `count`
- By labels

**4. Rate:**
- `rate(x[5m])` — per-second average
- `increase(x[5m])` — total change

**5. Histogram quantile:**
- `histogram_quantile(0.95, x_bucket)` — p95

### Query Engine

- **Parse** PromQL → AST
- **Optimize** (push down filters, choose shards)
- **Fetch** from TSDB
- **Compute** functions
- **Aggregate** results
- **Return** JSON

### Query Optimization

- **Cache**: Redis for recent queries
- **Downsample**: Use for long ranges
- **Shard**: Query only relevant shards
- **Pushdown**: Filter at storage

### Query Scale

```
10K queries/sec peak
Per query: ~200-600 ms
Querier: ~50 instances
Cache hit ratio: ~40%
```

---

## 8. Deep Dive: Alerting

### Alert Rules

```yaml
groups:
  - name: example
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
```

### Alert Types

- **Threshold**: `>`, `<`, `==`
- **Rate**: Change over time
- **Absence**: Metric missing
- **Composite**: Multiple conditions

### Alert Lifecycle

```
1. Rule evaluated (every 30 sec)
2. Condition met
3. For duration (5 min)
4. Pending → Firing
5. Notify
6. If resolved → Resolved
```

### Alert Routing

- **Group**: By service, severity
- **Route**: To correct team
- **Silence**: Manual or auto
- **Dedup**: Same alert grouped

### Alert Delivery

- **PagerDuty**: On-call
- **Slack**: Team channel
- **Email**: Broadcast
- **Webhook**: Custom

### Alert Scale

```
100K rules evaluated/sec
Each rule: ~1 ms
Alert Engine: ~50 instances
```

### Best Practices

- **Avoid alert fatigue**: Only alert on actionable
- **Runbooks**: Link in alert
- **SLO-based**: Error budget alerts
- **Test**: Regular alert drills

---

## 9. Deep Dive: Long-Term Storage

### Downsampling

**Raw**: Every 15 sec (high precision)
**5-min**: Downsampled (5x fewer samples)
**1-hour**: Downsampled (60x fewer)
**1-day**: Downsampled (1440x fewer)

**Rule:**
- Raw: 15 days
- 5-min: 3 months
- 1-hour: 1 year
- 1-day: 5 years

### Tiering

- **Hot (15 days)**: Local SSD
- **Warm (3 months)**: S3 + cache
- **Cold (1 year)**: S3 Glacier
- **Archive (5 years)**: S3 Deep Archive

### Compaction

- **Merge** small chunks into bigger
- **Downsample** old data
- **Delete** based on retention
- **Run** daily

### Long-Term Storage Options

- **Thanos**: S3 as backend
- **Cortex / Mimir**: Multi-tenant
- **VictoriaMetrics**: Long-term
- **Custom**: S3 + compactor

### Query Long-Term

- **Transparent**: User queries raw, backend fetches from tier
- **Explicit**: User chooses tier (e.g., `long_term` prefix)
- **Downsampled**: Query aggregated for speed

### Cost

- **Hot**: $0.10/GB/month
- **Warm**: $0.02/GB/month
- **Cold**: $0.004/GB/month
- **10x savings** from tiering

---

## 10. Deep Dive: High Availability

### Replication

- **TSDB replicas**: 2-3 per shard
- **Write**: To all replicas
- **Read**: From any
- **Failover**: Automatic

### Sharding

- **By metric**: Hash of metric name
- **By time**: Time-based (historical)
- **By tenant**: Multi-tenant

### Consensus

- **etcd / Consul**: For leader election
- **Raft**: For replication
- **Quorum**: For consistency

### Multi-Region

```d2
direction: down

us: "US Region" {
  shape: cloud
}
eu: "EU Region" {
  shape: cloud
}
apac: "APAC Region" {
  shape: cloud
}

usdb: "US TSDB" {
  shape: cylinder
}
eudb: "EU TSDB" {
  shape: cylinder
}
apacdb: "APAC TSDB" {
  shape: cylinder
}

us -> usdb
eu -> eudb
apac -> apacdb
```

- **Per-region** metrics
- **Global view**: Aggregate
- **Compliance**: Data residency

### Disaster Recovery

- **Backup**: S3 (daily)
- **Restore**: From S3
- **RPO**: 15 min
- **RTO**: 4 hours

### Failover

- **Automatic**: Leader election
- **Manual**: For planned
- **Test**: Regular drills

---

## 11. Deep Dive: Cost Optimization

### Cost Drivers

- **Storage**: ~50%
- **Compute**: ~30%
- **Query**: ~15%
- **Other**: ~5%

### Optimization Strategies

**1. Downsampling:**
- Reduces storage 10-100x
- Query old data at lower resolution

**2. Compression:**
- Gorilla (1-2 bytes/sample)
- Better than raw

**3. Tiering:**
- Hot → warm → cold
- 10x savings

**4. Cardinality control:**
- Drop high-card labels
- Pre-aggregate

**5. Retention:**
- Shorter for noisy metrics
- Longer for critical

**6. Query caching:**
- Redis for frequent queries
- 40% hit ratio

### Cost Estimation

```
Raw samples: 1B/day
After compression: ~1.5 GB/day
After downsampling: ~500 MB/day

1-year storage: ~550 GB (raw compressed)
Downsampled: ~50 GB

Cost:
  Storage: ~$50/month
  Compute: ~$500/month
  Query: ~$200/month
  Total: ~$750/month

For 10M series at scale: ~$5-10K/month
```

### Cost Allocation

- **Per service**: Chargeback
- **Per team**: Budget
- **Per metric**: Expensive flagged

---

## 12. Scaling Considerations

### Read Scaling

- **Querier replicas**: Horizontal
- **Cache**: Redis
- **Downsample**: For long ranges
- **CDN**: For dashboards

### Write Scaling

- **Kafka**: More partitions
- **Ingesters**: More instances
- **TSDB shards**: More
- **S3**: Unlimited

### Sharding

**By metric**: Hash(metric_name) → shard.
**By time**: Recent vs historical.
**By tenant**: Multi-tenant isolation.

### Peak Handling

- **Incidents**: 10x metrics
- **Deploys**: 3x
- **Traffic spikes**: 5x

**Mitigations:**
- Auto-scale
- Sample
- Buffer in Kafka

### Cost Optimization

| Component | Optimization |
|---|---|
| Storage | Downsampling, tiering |
| Compute | Spot instances |
| Query | Cache |
| Cardinality | Control |

---

## 13. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Cardinality | Drop/aggregate | Loss of detail |
| Storage | Downsample, tier | Query latency |
| Query speed | Cache, shard | Staleness |
| Alert fatigue | SLO-based | Complexity |
| Cost | Sampling | Accuracy |
| HA | Replication | Cost |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Collection | Scrape + push | Both models |
| Buffer | Kafka | Durable |
| TSDB | Mimir | Scalable |
| Storage | S3 | Cheap |
| Query | PromQL | Standard |
| Downsampling | 5-min, 1-hour | Balance |
| Alerts | Prometheus rules | Standard |
| Multi-region | Per-region | Compliance |

---

## 14. Failure Scenarios

### Collector Down

**Impact:** Metrics delayed.

**Mitigation:**
- Agent buffer
- Retry
- Auto-restart
- Alert ops

### Kafka Down

**Impact:** Metrics delayed.

**Mitigation:**
- Buffer
- Retry
- Alert ops

### TSDB Down

**Impact:** Query failures.

**Mitigation:**
- Replicas
- Failover
- Alert ops

### Query Slow

**Impact:** Dashboards slow.

**Mitigation:**
- Cache
- Downsample
- More queriers
- Alert ops

### Cardinality Explosion

**Impact:** TSDB overload.

**Mitigation:**
- Drop high-card
- Alert
- Auto-limit

### Alert Storm

**Impact:** Alert fatigue.

**Mitigation:**
- Dedup
- Group
- Silence
- Alert ops

### Data Loss

**Impact:** Metrics missing.

**Mitigation:**
- Kafka retention
- S3 backup
- Restore

### Data Breach

**Impact:** Metrics exposed.

**Mitigation:**
- Encryption
- Access controls
- Incident response

### DDoS

**Impact:** Service unavailable.

**Mitigation:**
- Rate limit
- WAF
- Alert

---

## 15. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Scrape p99 | < 100 ms | > 500 ms |
| Ingest p99 | < 200 ms | > 1 sec |
| Query p99 | < 1 sec | > 3 sec |
| Alert eval p99 | < 100 ms | > 500 ms |
| Active series | baseline | +50% |
| Sample rate | baseline | drop > 30% |
| Ingestion lag | < 15 sec | > 5 min |
| Query success | > 99% | < 95% |
| Storage usage | < 70% | > 90% |
| Alert firing | baseline | spike |

### Dashboards

- **Ingestion**: Samples/sec, lag
- **Query**: QPS, latency, cache hit
- **Alerts**: Firing, resolved
- **Cardinality**: Series, top
- **Storage**: Per tier, growth
- **TSDB**: Shards, health
- **Business**: Per service

### Alerts

- **P0**: Ingestion down, TSDB down
- **P1**: Lag > 5 min, query > 3 sec
- **P2**: Cardinality explosion
- **P3**: Cost anomaly, slow alerts

### Business KPIs

- **Coverage**: % services
- **Freshness**: Lag
- **Query rate**
- **Alert response**
- **Cost per series**

---

## 16. Cost Estimation

Rough monthly cost (AWS, us-east-1) for 10M series:

| Component | Spec | Cost/month |
|---|---|---|
| Collectors | 50 x c6g.large | ~$3,000 |
| Ingesters | 100 x c6g.2xlarge | ~$24,000 |
| Query servers | 50 x c6g.2xlarge | ~$12,000 |
| Kafka (MSK) | 20 brokers | ~$10,000 |
| TSDB (local SSD) | 50 x i3.2xlarge | ~$50,000 |
| Redis | 20 x cache.r6g.2xlarge | ~$10,000 |
| S3 (long-term) | 100 TB | ~$2,300 |
| S3 Glacier | 500 TB | ~$2,000 |
| Alerting | 20 x c6g.large | ~$1,200 |
| Grafana | 5 x c6g.large | ~$300 |
| Monitoring | Datadog | ~$30,000 |
| **Total** | | **~$145,000/month** |

**Per series:** ~$0.015/month.

**Cost breakdown:**
- **TSDB**: ~34%
- **Monitoring**: ~21%
- **Compute**: ~28%
- **Storage**: ~3%
- **Other**: ~14%

**Cost optimization:**
- **Downsampling**: 10x reduction
- **Tiering**: 10x
- **Cardinality control**: Prevent bloat
- **Reserved instances**

---

## 17. Extensions and Follow-ups

### Metrics and Traces Integration

- **Exemplars**: Link metric to trace
- **Correlation**: Same trace_id
- **Unified UI**: Grafana

### Metrics and Logs

- **Log-based metrics**: Derive from logs
- **Structured metrics**: JSON logs

### Anomaly Detection

- **ML**: Baseline, anomalies
- **Auto-alerts**: On deviations

### SLO Tracking

- **Error budgets**
- **Burn rate alerts**
- **Service-level dashboards**

### Distributed Tracing

- **OpenTelemetry**: Unified
- **Spans**: For latency

### Real User Monitoring (RUM)

- **Browser**: Metrics from users
- **Mobile**: App metrics

### Synthetic Monitoring

- **Probes**: From regions
- **Uptime**: Availability
- **Latency**: From user perspective

### Cost Observability

- **Per-service cost**
- **Budget alerts**
- **Optimization recommendations**

### Federated Queries

- **Multi-cluster**
- **Cross-region**
- **Unified view**

### Web3

- **Blockchain metrics**
- **On-chain monitoring**
- **Rare**

---

## 18. Summary

| Aspect | Decision |
|---|---|
| Collection | Scrape + push |
| Buffer | Kafka |
| TSDB | Prometheus / Mimir / VictoriaMetrics |
| Storage | Local SSD + S3 |
| Compression | Gorilla (1-2 bytes/sample) |
| Query | PromQL |
| Downsampling | 5-min, 1-hour |
| Alerting | Prometheus rules |
| Multi-region | Per-region |
| Scale | 10M series, 1B samples/day |
| Latency | Query < 1 sec, ingest < 200 ms |
| Availability | 99.9% |
| Cost | ~$145K/month |

**Key takeaways:**

- **Time-series compression** — Gorilla: 1-2 bytes/sample
- **Cardinality is the enemy** — control it aggressively
- **Kafka as buffer** — decouples ingest from storage
- **Tiering** — hot (local), warm (S3), cold (Glacier)
- **Downsampling** — 10x storage savings
- **PromQL** — standard query language
- **Alert rules** — evaluated every 30 sec
- **Multi-region** — for compliance, latency
- **Cost drivers** — TSDB, compute, monitoring
- **Observability triad** — metrics + logs + traces

### Similar Pattern Problems

- Log Ingestion — similar ingestion, different data
- Distributed Tracing — spans, similar storage
- Notification System — alerts delivery
- Fraud Detection — real-time event processing
- Social Feed — high-volume writes
- Time-Series Databases — the storage layer