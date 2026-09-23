# Observability

> **Spring context:** Spring Boot 3.x Actuator + Micrometer + OpenTelemetry. `micrometer-tracing-bridge-otel` for tracing, `micrometer-registry-prometheus` for metrics, Logback with MDC for correlation IDs. Spring Cloud Sleuth is deprecated — use Micrometer Tracing.

## Mental Model

Observability is not monitoring. Monitoring asks "is it up?" Observability asks **"why is it doing that?"** It has three pillars:

```d2
direction: right

obs: Observability
metrics: "Metrics\\n(aggregatable numbers)"
logs: "Logs\\n(discrete events)"
traces: "Traces\\n(causal chains)"

metrics -> logs
logs -> traces
```



- **Metrics** tell you *what* is happening (latency up, error rate up).
- **Logs** tell you *what happened* in a specific instance.
- **Traces** tell you *where* time went across services.

You need all three. Metrics without traces = "something is slow." Traces without logs = "this span is slow but I don't know why." Logs without correlation = "I found a stack trace but can't tie it to a request."

## Correlation ID

The single most valuable observability primitive. Every request gets an ID; every log line, span, and event carries it.

```d2
direction: right

client: "Client\\n(X-Request-ID: abc-123)"
gw: "Gateway\\n(generates/propagates)"
svcA: "Service A\\n(logs with abc-123)"
svcB: "Service B\\n(logs with abc-123)"
kafka: "Kafka Event\\n(headers: X-Request-ID)"

client -> gw
gw -> svcA
svcA -> svcB
svcA -> kafka
```

Implementation:
- Gateway generates `X-Request-ID` if not present.
- Every service propagates it in outgoing calls (HTTP headers, Kafka headers).
- Every log line includes it via MDC.
- Traces use it as a span attribute.

```java
// Servlet filter
@Component
public class CorrelationIdFilter extends OncePerRequestFilter {
    private static final String HEADER = "X-Request-ID";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String id = Optional.ofNullable(req.getHeader(HEADER)).orElse(UUID.randomUUID().toString());
        MDC.put("correlationId", id);
        res.setHeader(HEADER, id);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.clear();
        }
    }
}
```

Logback pattern:
```xml
<pattern>%d{ISO8601} [%thread] %-5level [%X{correlationId}] %logger{36} - %msg%n</pattern>
```

**Rule:** any log line without a correlation ID is nearly useless in a distributed system.

## Distributed Tracing

A trace is a tree of spans. Each span represents a unit of work (HTTP call, DB query, Kafka publish) with a start time, duration, and parent.

```d2
direction: right

root: "Span: POST /orders\\n(duration: 250ms)"
db: "Span: INSERT orders\\n(45ms)"
http: "Span: POST payments\\n(150ms)"
pdb: "Span: INSERT payments\\n(30ms)"
pub: "Span: kafka publish\\n(5ms)"

root -> db
root -> http
http -> pdb
root -> pub
```

Spring Boot 3.x + Micrometer Tracing + OTLP:

```yaml
management:
  tracing:
    sampling:
      probability: 0.1   # 10% in prod, 100% in dev
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
```

```java
@RestController
public class OrderController {
    private final Tracer tracer;
    private final PaymentClient paymentClient;

    @PostMapping("/orders")
    public Order create(@RequestBody OrderRequest req) {
        Span span = tracer.nextSpan().name("create-order").start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            span.tag("order.customer", req.customerId());
            Order o = orderService.create(req);
            paymentClient.charge(o);        // child span auto-created by instrumentation
            return o;
        } finally {
            span.end();
        }
    }
}
```

**Sampling:** 100% in dev, 1–10% in prod, **100% for errors** (tail-based sampling in the collector). Without sampling, tracing is too expensive.

## Metrics

Four golden signals (Google SRE):

| Signal | What | Example |
|---|---|---|
| Latency | Time to serve | `http.server.requests` p99 |
| Traffic | Demand | requests/sec |
| Errors | Rate of failed requests | 5xx rate, exception rate |
| Saturation | Resource usage | CPU, memory, queue depth, connection pool |

Micrometer:

```java
@RestController
public class OrderController {
    private final Counter ordersCreated;
    private final Timer orderLatency;

    public OrderController(MeterRegistry registry) {
        this.ordersCreated = Counter.builder("orders.created")
            .description("Orders created")
            .register(registry);
        this.orderLatency = Timer.builder("orders.latency")
            .description("Order creation latency")
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

**Naming:** use a consistent scheme: `{domain}.{entity}.{action}` (e.g., `orders.created`, `payments.charge.duration`). Never put high-cardinality values (user ID, order ID) in metric names or tags — it explodes cardinality.

**Histograms vs percentiles:** publish percentiles for local visibility; use histograms + Prometheus `histogram_quantile` for aggregatable p99 across instances.

## Structured Logging

Log JSON, not strings. Every field is queryable.

```json
{
  "timestamp": "2026-06-14T10:23:45.123Z",
  "level": "INFO",
  "service": "orders",
  "correlationId": "abc-123",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "userId": "u-42",
  "message": "order created",
  "orderId": "o-9001",
  "durationMs": 45
}
```

Logback + `logstash-logback-encoder`:
```xml
<encoder class="net.logstash.logback.encoder.LogstashEncoder">
  <includeMdcKeyName>correlationId</includeMdcKeyName>
  <includeMdcKeyName>traceId</includeMdcKeyName>
  <includeMdcKeyName>spanId</includeMdcKeyName>
</encoder>
```

**Rules:**
- **Never log PII / secrets.** Scrub emails, tokens, card numbers.
- **Log at boundaries** — inbound request, outbound call, DB write, error.
- **Log the correlation ID, not the whole request.**
- **Level discipline:** ERROR = page-worthy; WARN = investigate; INFO = business events; DEBUG = dev only.

## Health Checks

Three distinct checks in Kubernetes:

| Check | Purpose | Fails when |
|---|---|---|
| **Liveness** | Restart the pod | App is deadlocked/unrecoverable |
| **Readiness** | Remove from load balancer | App can't serve (DB down, warmup) |
| **Startup** | Give slow-starting apps time | App is still initializing |

```yaml
management:
  endpoint.health.probes.enabled: true
  health:
    livenessstate.enabled: true
    readinessstate.enabled: true
```

```java
@Component
public class DownstreamHealthIndicator implements HealthIndicator {
    private final PaymentClient client;
    public Health health() {
        try {
            client.ping();
            return Health.up().build();
        } catch (Exception e) {
            return Health.down().withDetail("error", e.getMessage()).build();
        }
    }
}
```

**Rules:**
- Liveness must be **cheap** and **unconditional**. Never check downstreams in liveness — a downstream outage would restart all your pods.
- Readiness can check critical dependencies.
- Startup should only be used for slow-booting apps (JVM warmup).

## Log Aggregation

Centralize logs from all services. Common stack: **ELK/OpenSearch** or **Loki + Grafana**.

| Layer | Tool |
|---|---|
| Collect | Filebeat, Fluent Bit, Promtail |
| Ship | Kafka, direct |
| Store | Elasticsearch, OpenSearch, Loki |
| Query | Kibana, Grafana |
| Alert | ElastAlert, Grafana alerts |

**Rules:**
- Every log line has `service`, `correlationId`, `traceId`.
- Log retention is bounded (cost).
- Never log to local disk only.
- Standardize the JSON schema across services.

## Metrics Aggregation

Prometheus scrapes `/actuator/prometheus` from each instance. Grafana visualizes. Alertmanager routes alerts.

```yaml
management:
  endpoints.web.exposure.include: health,info,prometheus,metrics
  metrics:
    tags:
      application: ${spring.application.name}
      env: ${ENV:dev}
```

**Key dashboards:**
- RED: Rate, Errors, Duration per endpoint.
- USE: Utilization, Saturation, Errors per resource.
- JVM: heap, GC pauses, thread count, class loading.
- HTTP client: request rate, error rate, latency per downstream.
- Kafka: consumer lag, producer error rate.
- DB: connection pool, query latency, slow queries.

## Audit Logging

Separate from operational logs. Immutable, append-only, retained for compliance.

| Aspect | Operational log | Audit log |
|---|---|---|
| Purpose | Debug | Compliance |
| Retention | Days | Years |
| Mutability | Rotated | Append-only |
| Content | Errors, traces | Who did what, when |
| Access | Everyone | Restricted |

Audit events: authentication, authorization failures, data access for sensitive resources, admin actions, config changes.

## Putting It Together

```d2
direction: right

app: Service
mdc: "MDC (correlationId)"
metrics: Micrometer
trace: Micrometer Tracing
collector: OTel Collector
backends: Backends
prom: Prometheus
loki: Loki / ES
tempo: Tempo / Jaeger
dash: Grafana
alerts: Alertmanager

mdc -> collector
metrics -> collector
trace -> collector
collector -> prom
collector -> loki
collector -> tempo
prom -> dash
loki -> dash
tempo -> dash
dash -> alerts
```

## Tricky Corners ⚠️

- **High-cardinality tags kill Prometheus.** Never tag with user ID, order ID, or request ID.
- **100% tracing in prod is expensive.** Sample, but always sample errors.
- **Liveness checking downstreams = cascading restarts.**
- **Readiness that's too strict = pods removed during a blip.**
- **Correlation ID must be propagated across async boundaries** (Kafka headers, thread pools). MDC is thread-local — clear it or you leak.
- **MDC doesn't propagate to `@Async` or reactive threads** without explicit context propagation.
- **Logs without correlation IDs are nearly useless** in microservices.
- **Metrics without labels** are hard to aggregate; too many labels are worse.
- **Trace sampling must be consistent** across services — use the same sampler, or propagate the sampling decision.
- **Audit logs and operational logs have different retention** — don't mix them.

## Common Pitfalls

- No correlation ID.
- Correlation ID in HTTP but not in Kafka headers.
- MDC leaked across requests (missing `MDC.clear()`).
- Logging PII/secrets.
- Metrics with high-cardinality tags.
- Tracing 100% in prod, blowing the budget.
- Liveness checks that depend on downstreams.
- No alerting on consumer lag / error rate / p99 latency.
- Logs only to stdout with no aggregation.
- Different JSON schemas per service, making queries painful.

## Key Interview Tips

- Lead with **"three pillars: metrics, logs, traces — and correlation IDs tie them together."**
- For "how do you debug a slow request?", answer **"trace to find the slow span, logs to find why, metrics to see if it's systemic."**
- For "how do you set up tracing?", answer **"OpenTelemetry + Micrometer Tracing, sampling with error-based tail sampling."**
- For "how do you correlate logs across services?", answer **"correlation ID propagated via headers and MDC, plus traceId/spanId."**
- For "what's the difference between liveness and readiness?", answer **"liveness = restart the pod; readiness = remove from LB. Never check downstreams in liveness."**
- For "what do you alert on?", answer **"RED metrics, saturation, consumer lag, error rate, p99 latency — not CPU."**
- Always mention **PII scrubbing** and **cardinality discipline**.

## Related

- [Microservices Patterns index](index.md)
- [Reliability](reliability.md)
- [Deployment](deployment.md)
- [Kafka → Operations & Scenarios](../kafka/operations-and-scenarios.md)
- [Observability → Metrics, Logs, Traces](../observability/metrics-logs-traces.md)
- [Kubernetes → Production Essentials](../kubernetes/production-essentials.md)