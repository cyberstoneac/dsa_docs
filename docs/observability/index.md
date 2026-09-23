# Observability

> **Context:** At lead level, observability is not "add logs." It is the ability to ask arbitrary questions about your system without shipping new code. This section covers the practical stack: metrics, logs, traces, and how they work together.

## Mental Model

Observability = **metrics + logs + traces**, tied together by **correlation IDs**, with **alerts** on the signals that matter.

```d2
direction: right

obs: Observability
metrics: "Metrics\\n(aggregatable numbers)"
logs: "Logs\\n(discrete events)"
traces: "Traces\\n(causal chains)"
corr: "Correlation ID\\n(ties them together)"

metrics -> logs
logs -> traces
traces -> corr
```

**Rule:** metrics tell you *what*, logs tell you *why*, traces tell you *where*. Correlation IDs tie them together.

## The Four Golden Signals

Google SRE's framework:

| Signal | What | Example |
|---|---|---|
| **Latency** | Time to serve | `http.server.requests` p99 |
| **Traffic** | Demand | requests/sec |
| **Errors** | Failed requests | 5xx rate, exception rate |
| **Saturation** | Resource usage | CPU, memory, queue depth |

**Rule:** if you alert on anything, alert on these four.

## The RED and USE Methods

- **RED** (for services): **R**ate, **E**rrors, **D**uration.
- **USE** (for resources): **U**tilization, **S**aturation, **E**rrors.

Both are quick dashboards you can build for any service or resource.

## Metrics

### Types

| Type | Use |
|---|---|
| **Counter** | Monotonic increasing (requests, errors) |
| **Gauge** | Current value (memory, connections) |
| **Histogram** | Distribution (latency) |
| **Summary** | Quantiles (client-side) |

**Rule:** use histograms for latency; counters for totals; gauges for current state.

### Cardinality

**The cardinality trap:** adding high-cardinality tags (user ID, order ID) explodes metric count and kills Prometheus.

| Tag | Cardinality risk |
|---|---|
| `service` | Low (good) |
| `endpoint` | Medium (ok) |
| `status_code` | Low (good) |
| `user_id` | Very high (never) |
| `order_id` | Very high (never) |
| `request_id` | Infinite (never) |

**Rule:** metric tags must be **bounded**. Anything unbounded goes in logs or traces, not metrics.

### Naming

Consistent scheme: `{domain}.{entity}.{action}`.

Examples:
- `orders.created` (counter)
- `orders.creation.duration` (histogram)
- `payments.charge.errors` (counter)
- `db.connections.active` (gauge)

### Spring Boot + Micrometer

```java
@RestController
public class OrderController {
    private final Counter ordersCreated;
    private final Timer orderLatency;

    public OrderController(MeterRegistry registry) {
        this.ordersCreated = Counter.builder("orders.created")
            .description("Orders created")
            .tag("service", "orders")
            .register(registry);
        this.orderLatency = Timer.builder("orders.creation.duration")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);
    }

    @PostMapping("/orders")
    public Order create(@RequestBody OrderRequest req) {
        return orderLatency.record(() -> {
            Order o = orderService.create(req);
            ordersCreated.increment();
            return o;
        });
    }
}
```

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
```

**Rule:** `percentiles-histogram` enables aggregation across instances. Percentiles published directly can't be aggregated.

## Logs

### Structured logging

```json
{
  "timestamp": "2026-06-14T10:23:45.123Z",
  "level": "INFO",
  "service": "orders",
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
- **JSON, not strings.** Every field queryable.
- **Consistent schema across services.**
- **Never log PII / secrets.** Scrub at the framework level.
- **Log at boundaries:** inbound, outbound, DB, error.
- **Correlation ID + trace ID + span ID on every line.**

### Log levels

| Level | Meaning | Action |
|---|---|---|
| ERROR | Something failed | Page if it's actionable |
| WARN | Degraded | Investigate |
| INFO | Business event | Normal ops |
| DEBUG | Detailed | Dev only |
| TRACE | Very detailed | Rarely used |

**Rule:** if a log line doesn't lead to an action or a business event, question it.

### Log aggregation

| Layer | Tool |
|---|---|
| Collect | Fluent Bit, Filebeat, Promtail |
| Ship | Kafka, direct |
| Store | Elasticsearch, OpenSearch, Loki |
| Query | Kibana, Grafana |
| Alert | ElastAlert, Grafana |

**Rules:**
- Centralize. Local logs are useless.
- Retention is bounded (cost).
- Standardize JSON schema.
- Index the fields you query.

## Traces

### Anatomy

A trace is a tree of spans. Each span:
- Has a start, duration, and parent.
- Represents a unit of work (HTTP call, DB query, Kafka publish).
- Carries attributes (tags).

```d2
direction: right

root: "POST /orders\\n(250ms)"
db: "INSERT orders\\n(45ms)"
http: "POST payments\\n(150ms)"
pdb: "INSERT payments\\n(30ms)"
pub: "kafka publish\\n(5ms)"

root -> db
root -> http
http -> pdb
root -> pub
```

### Sampling

| Type | When |
|---|---|
| **Head-based** | Decision made at trace start; cheap, may miss errors |
| **Tail-based** | Decision made after the trace completes; keeps errors/slow traces |

**Rule:** sample in prod (1–10%), but **always sample errors and slow requests** (tail-based).

### Spring Boot + OpenTelemetry

```yaml
management:
  tracing:
    sampling:
      probability: 0.1
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
```

```java
@RestController
public class OrderController {
    private final Tracer tracer;

    @PostMapping("/orders")
    public Order create(@RequestBody OrderRequest req) {
        Span span = tracer.nextSpan().name("create-order").start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            span.tag("order.customer", req.customerId());
            return orderService.create(req);
        } finally {
            span.end();
        }
    }
}
```

**Rule:** instrumentation should be automatic where possible (Micrometer, OTel agents). Manual spans for business-specific operations.

## Correlation IDs

The single most valuable observability primitive.



- Gateway generates `X-Request-ID` if not present.
- Every service propagates it (HTTP headers, Kafka headers, thread pools).
- Every log line includes it via MDC.
- Traces use it as a span attribute.

```java
@Component
public class CorrelationIdFilter extends OncePerRequestFilter {
    private static final String HEADER = "X-Request-ID";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String id = Optional.ofNullable(req.getHeader(HEADER))
            .orElse(UUID.randomUUID().toString());
        MDC.put("correlationId", id);
        res.setHeader(HEADER, id);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.clear();   // CRITICAL
        }
    }
}
```

**Rule:** `MDC.clear()` is mandatory. Thread pools reuse threads; stale MDC leaks across requests.

**Propagation across async:**
- HTTP: header.
- Kafka: record headers.
- Thread pools: `TaskDecorator` to copy MDC.
- Reactor: `Hooks.onOperatorDebug`, context propagation.

## Health Checks

| Probe | Purpose |
|---|---|
| **Liveness** | Restart the pod |
| **Readiness** | Remove from LB |
| **Startup** | Slow-boot protection |

```yaml
management:
  endpoint.health.probes.enabled: true
```

**Rules:**
- Liveness must be cheap and unconditional.
- Readiness can check critical dependencies.
- Never check downstreams in liveness.

## Alerts

### What to alert on

- **SLO burn rate** — how fast you're consuming error budget.
- **RED metrics** — error rate, latency p99.
- **Saturation** — queue depth, connection pool, CPU.
- **Business metrics** — orders/min, revenue.

### What not to alert on

- Raw CPU (unless sustained).
- Memory (unless near limit).
- Every 5xx (alert on rate, not individual).
- Every log error (alert on patterns).

### Alert quality

A good alert:
- Is **actionable** — there's a runbook.
- Is **specific** — you know what's wrong.
- Is **timely** — early enough to act.
- Is **not noisy** — every page has signal.

**Rule:** every alert has a runbook. If it doesn't, it's not an alert — it's a dashboard panel.

## The Stack

```d2
direction: right

app: Services
otel: OTel Collector
prom: Prometheus
loki: Loki
tempo: Tempo
graf: Grafana
alert: Alertmanager

app -> otel
otel -> prom
otel -> loki
otel -> tempo
prom -> graf
loki -> graf
tempo -> graf
graf -> alert
```

**Rule:** one collector (OTel), three backends (Prometheus, Loki, Tempo), one UI (Grafana). This is the modern default.

## Cost

Observability is expensive at scale.

| Lever | Savings |
|---|---|
| Sampling | 90%+ on traces |
| Metric cardinality discipline | 10–50x |
| Log level discipline | 50–80% |
| Retention policies | Variable |
| Tail-based sampling | Keeps errors, drops noise |
| Aggregation at the collector | Reduces backend load |

**Rule:** track **cost per signal** and per service. Kill dashboards and alerts nobody uses.

## Tricky Corners ⚠️

- **MDC leaks across threads.** Always `MDC.clear()`.
- **MDC doesn't propagate to `@Async` or Reactor.** Use `TaskDecorator` or context propagation.
- **High-cardinality tags kill Prometheus.** Never tag with user ID.
- **Percentiles can't be aggregated** across instances. Use histograms + `histogram_quantile`.
- **100% tracing in prod is expensive.** Sample, but always sample errors.
- **Correlation ID must cross async boundaries** (Kafka headers, thread pools).
- **Logs without correlation IDs are nearly useless.**
- **Liveness checking downstreams = cascading restarts.**
- **Alerts without runbooks are noise.**
- **Dashboard sprawl is a real cost.** Prune quarterly.
- **Sampling must be consistent** across services — use the same sampler.

## Common Pitfalls

- No correlation ID.
- MDC not cleared.
- High-cardinality metric tags.
- 100% tracing in prod.
- Alerts on CPU/memory instead of signals.
- Logging PII/secrets.
- Logs without structure.
- No tracing on critical paths.
- Dashboard sprawl.
- No runbooks.

## Key Interview Tips

- Lead with **"metrics, logs, traces — tied by correlation IDs."**
- For "how do you debug a slow request?", answer **"trace to find the slow span, logs to find why, metrics to see if it's systemic."**
- For "how do you set up tracing?", answer **"OpenTelemetry + Micrometer Tracing, sampling with tail-based error retention."**
- For "how do you correlate logs across services?", answer **"correlation ID propagated via headers and MDC, plus traceId/spanId."**
- For "liveness vs readiness?", answer **"restart vs remove from LB; never check downstreams in liveness."**
- For "what do you alert on?", answer **"RED metrics, saturation, SLO burn rate — not CPU."**
- For "how do you control cost?", answer **"sampling, cardinality discipline, log level discipline, retention policies."**
- Always mention **PII scrubbing** and **MDC.clear()**.

## Related

- [Observability index](index.md)
- [Metrics, Logs, Traces](metrics-logs-traces.md)
- [Microservices Patterns → Observability](../microservices-patterns/observability.md)
- [Kubernetes Production Essentials](../kubernetes/production-essentials.md)
- [Leadership → Incident Command](../leadership/incident-command.md)