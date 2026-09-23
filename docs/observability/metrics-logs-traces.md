# Metrics, Logs, Traces

> **Context:** This file is the deep dive on the three pillars: what each is good at, how they complement, and the concrete patterns to use them well. At lead level, you set the standards for what gets measured, logged, and traced across teams.

## The Three Pillars, Compared

| Pillar | Nature | Cost | Best for |
|---|---|---|---|
| **Metrics** | Aggregatable numbers | Low storage, high cardinality risk | Trends, alerts, dashboards |
| **Logs** | Discrete events | High storage, high context | Debugging specific issues |
| **Traces** | Causal chains | Medium storage | Cross-service latency, causality |

```d2
direction: right

m: Metrics\nWhat is happening?
l: Logs\nWhat happened in this instance?
t: Traces\nWhere did time go?

m -> l
l -> t
```

**Rule:** use the pillar that matches the question.

| Question | Pillar |
|---|---|
| Is the error rate up? | Metrics |
| Why did this request fail? | Logs + Traces |
| Where is the latency? | Traces |
| Is this systemic or individual? | Metrics |
| What was the request payload? | Logs |
| Which service called which? | Traces |

## Metrics: Deep Dive

### Metric types

| Type | Example | Aggregation |
|---|---|---|
| Counter | `requests.total` | Sum, rate |
| Gauge | `connections.active` | Min, max, avg |
| Histogram | `request.duration` | Quantiles, avg |
| Summary | (client-side quantiles) | Not aggregatable |

### Prometheus model

- **Counter:** monotonically increasing.
- **Gauge:** up/down.
- **Histogram:** bucketed distribution; use `histogram_quantile(0.99, ...)`.
- **Summary:** client-side quantiles; can't aggregate across instances.

**Rule:** prefer histograms. Summaries look simpler but break under scale.

### PromQL examples

```promql
# Request rate per service
sum(rate(http_server_requests_seconds_count[5m])) by (service)

# p99 latency
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket[5m])) by (le, service)
)

# Error rate
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) by (service)
  /
sum(rate(http_server_requests_seconds_count[5m])) by (service)
```

### SLO burn rate

```promql
# 1-hour burn rate (consuming error budget 14.4x too fast for 30-day SLO)
(1 - (sum(rate(http_server_requests_seconds_count{status!~"5.."}[1h]))
      / sum(rate(http_server_requests_seconds_count[1h]))))
  / (1 - 0.999)
```

**Rule:** alert on burn rate, not raw error rate. It encodes the SLO in the alert.

### Cardinality discipline

| Tag | OK? |
|---|---|
| `service` | ✅ |
| `endpoint` | ✅ (bounded) |
| `method` | ✅ |
| `status_code` | ✅ |
| `user_id` | ❌ |
| `order_id` | ❌ |
| `request_id` | ❌ |

**Rule:** if the tag has unbounded values, it belongs in logs or traces, not metrics.

### Application metrics every service should have

- **RED:** rate, errors, duration per endpoint.
- **JVM:** heap, GC pauses, threads, class loading.
- **Connection pools:** active, idle, waiting.
- **HTTP clients:** request rate, error rate, latency per downstream.
- **Business metrics:** orders/sec, signups/sec, revenue/min.

## Logs: Deep Dive

### Structured logging

Every log line is a JSON object with a stable schema:

```json
{
  "timestamp": "2026-06-14T10:23:45.123Z",
  "level": "INFO",
  "service": "orders",
  "env": "prod",
  "version": "1.4.2",
  "correlationId": "abc-123",
  "traceId": "4bf92f35...",
  "spanId": "00f067aa...",
  "userId": "u-42",
  "message": "order created",
  "orderId": "o-9001",
  "durationMs": 45
}
```

**Rules:**
- **Fixed schema across all services.** Queryable, joinable.
- **Never log PII or secrets.** Scrub at the framework level.
- **Log at boundaries:** inbound request, outbound call, DB write, error.
- **Include correlation/trace IDs on every line.**

### What to log

| Event | Level | Content |
|---|---|---|
| Inbound request | INFO | method, path, user, correlationId |
| Outbound call | DEBUG/INFO | target, duration, status |
| DB write | DEBUG | table, rows, duration |
| Business event | INFO | "order created", orderId |
| Error | ERROR | exception, context, correlationId |
| Security event | WARN/ERROR | auth failures, authorization denials |

**Rule:** log the *decision*, not every step. Logs are for humans, not stack traces.

### Log levels

| Level | When |
|---|---|
| ERROR | Something failed; may be actionable |
| WARN | Degraded; investigate |
| INFO | Business event; normal |
| DEBUG | Detailed; dev only |
| TRACE | Very detailed; rarely |

**Rule:** in prod, INFO and above. DEBUG behind a flag.

### Log aggregation

- **Collect:** Fluent Bit, Promtail, Filebeat.
- **Ship:** Kafka or direct.
- **Store:** Elasticsearch, OpenSearch, Loki.
- **Query:** Kibana, Grafana.
- **Retention:** 7–30 days hot, longer cold.

**Rule:** standardize the schema. Queries across services require consistent field names.

### Anti-patterns

- Logging in loops (log the summary).
- Logging full request bodies.
- Logging PII / tokens.
- String concatenation instead of structured fields.
- No correlation ID.
- Log levels misused (ERROR for warnings).

## Traces: Deep Dive

### Anatomy

- **Trace:** a single request across services.
- **Span:** a unit of work; has start, duration, parent.
- **Context:** propagated via headers (`traceparent`, `tracestate`).

```d2
direction: right

root: "Root Span\\n(POST /orders)"
db: DB Span
http: "HTTP Span\\n(POST /payments)"
pdb: "DB Span\\n(payments)"

root -> db
root -> http
http -> pdb
```

### Propagation

- **HTTP:** W3C Trace Context (`traceparent` header).
- **Kafka:** record headers.
- **Thread pools:** context propagation wrappers.
- **Reactor:** Micrometer context propagation.

**Rule:** propagation must be automatic. Use libraries that do it; don't hand-roll.

### Sampling

| Strategy | When |
|---|---|
| **Head-based** | Always-on or percentage; cheap |
| **Tail-based** | Decision at trace end; keeps errors/slow |
| **Adaptive** | Rate-based per service |

**Rule:** sample 1–10% in prod; **always sample errors and slow traces** via tail-based sampling at the collector.

### What to instrument

- **Inbound HTTP requests** (framework auto).
- **Outbound HTTP calls** (framework auto).
- **DB queries** (driver instrumentation).
- **Kafka produce/consume** (client instrumentation).
- **Business operations** (manual spans).

**Rule:** automatic where possible; manual spans for business-meaningful operations.

### Trace attributes

Add attributes that help debugging:
- `user.id`, `tenant.id`
- `order.id`, `payment.id`
- `feature.flag`
- `deployment.version`

**Rule:** attributes are the trace's log. Add the context you'd want at 3am.

## Correlating the Three

```d2
direction: right

metric: "Metric spike\\n(error rate up)"
trace: "Trace\\n(find slow span)"
log: "Log\\n(find the error)"

metric -> trace
trace -> log
```

**Example workflow:**



1. **Alert:** error rate spike in `orders` (metrics).
2. **Drill in:** traces for `orders` show 500s originating from `payments` call.
3. **Investigate:** logs for `payments` with the same `traceId` show `ConnectionTimeout`.
4. **Fix:** increase timeout or scale `payments`.

**Rule:** the workflow requires the three pillars to share **correlation IDs and trace IDs**.

## Spring Boot 3 Setup

```yaml
management:
  endpoints.web.exposure.include: health,info,prometheus,metrics
  metrics:
    tags:
      application: ${spring.application.name}
      env: ${ENV:dev}
    distribution:
      percentiles-histogram:
        http.server.requests: true
  tracing:
    sampling:
      probability: 0.1
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
```

```xml
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
  <groupId>io.opentelemetry</groupId>
  <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

## Dashboard Standards

Every service should have:



1. **RED dashboard** — rate, errors, duration per endpoint.
2. **JVM dashboard** — heap, GC, threads.
3. **Dependencies dashboard** — HTTP clients, DB, Kafka.
4. **Business dashboard** — domain-specific KPIs.

**Rule:** dashboards are code. Store them in git (Grafana JSON, Terraform).

## Alert Standards

| Alert | Trigger | Runbook |
|---|---|---|
| SLO burn rate | 14.4x budget consumption / 1h | Yes |
| Error rate | > 1% for 5 min | Yes |
| Latency p99 | > SLO for 10 min | Yes |
| Consumer lag | > threshold for 10 min | Yes |
| DLQ depth | > 0 | Yes |
| Pod restart loop | > 3 restarts / 10 min | Yes |

**Rule:** every alert has a runbook. No runbook, no alert.

## Cost Discipline

| Lever | Effect |
|---|---|
| Metric cardinality | 10–50x savings |
| Log level | 50–80% |
| Trace sampling | 90%+ |
| Retention policies | Variable |
| Collector aggregation | Reduces backend load |
| Prune unused dashboards/alerts | Non-trivial |

**Rule:** observability is a product. Track cost per signal and per service.

## Tricky Corners ⚠️

- **MDC leaks across threads.** `MDC.clear()` is mandatory.
- **MDC doesn't cross `@Async` or Reactor boundaries.** Use `TaskDecorator` or context propagation.
- **High-cardinality metric tags kill Prometheus.**
- **Summaries can't be aggregated.** Use histograms.
- **Sampling must be consistent across services** or traces are incomplete.
- **Tail-based sampling requires the collector** to see full traces.
- **Logs without correlation IDs are useless.**
- **Alerts without runbooks are noise.**
- **Dashboards without owners go stale.**
- **Observability costs scale with traffic** — budget accordingly.
- **PII in logs is a compliance risk.**

## Common Pitfalls

- No correlation ID.
- MDC not cleared.
- High-cardinality tags.
- 100% tracing in prod.
- Logging PII.
- Alerts on CPU/memory instead of signals.
- Dashboards nobody owns.
- No runbooks.
- Summaries used instead of histograms.
- Sampling inconsistent across services.

## Key Interview Tips

- Lead with **"metrics tell you what, logs tell you why, traces tell you where; correlation IDs tie them together."**
- For "how do you debug a slow request?", answer **"trace to find the slow span, logs with the same traceId to find why, metrics to see if it's systemic."**
- For "how do you control observability cost?", answer **"cardinality discipline, log level discipline, trace sampling with tail-based error retention."**
- For "what do you alert on?", answer **"SLO burn rate, RED metrics, saturation, DLQ depth — with runbooks."**
- For "how do you set up tracing?", answer **"OpenTelemetry + Micrometer Tracing, W3C context propagation, tail-based sampling."**
- Always mention **MDC.clear()**, **histograms over summaries**, and **cardinality discipline**.
- Always connect observability to **incident response** — that's the point.

## Related

- [Observability index](index.md)
- [Observability](observability.md)
- [Microservices Patterns → Observability](../microservices-patterns/observability.md)
- [Kubernetes Production Essentials](../kubernetes/production-essentials.md)
- [Leadership → Incident Command](../leadership/incident-command.md)