# Cloud-Native Foundations

> **Spring context:** Spring Boot 3.x, Jakarta namespace, containerized deployment, twelve-factor configuration. This file covers *principles and patterns* — not provider-specific services.

## Mental Model

"Cloud-native" is not "runs in the cloud". It is a set of architectural choices that let a system exploit the cloud's core properties: elasticity, automation, and failure as normal.

| Pillar | What it means | Practical signal |
|---|---|---|
| **Elasticity** | Scale up and down automatically with demand | Stateless services, HPA, queue-depth autoscaling |
| **Automation** | Everything reproducible from code | IaC, CI/CD, no manual prod steps |
| **Resilience** | Failure is expected, contained, recovered | Retries, circuit breakers, multi-AZ |
| **Observability** | You can see what's happening inside | Structured logs, metrics, traces, SLOs |
| **Loose coupling** | Services evolve independently | Bounded contexts, async messaging, contract tests |
| **Cost awareness** | Every request has a price | Right-sizing, autoscaling, storage tiers |
| **Security by default** | Zero trust between components | Least privilege, mTLS, secrets management |
| **Portability** | Avoid deep vendor lock-in where it hurts | Open standards, abstraction over provider APIs |

**Twelve-Factor App** (see `architecture/twelve-factor-app.md`) is the operating manual for the application side. **Cloud-native** extends that with infrastructure and operational patterns.

## Cloud-Native Principles

### Design for failure

Everything fails: disks, networks, AZs, regions, deployments. Design so failure is *contained*, not propagated.

- **Bulkheads** — isolate thread pools, connection pools, and instances per downstream so one slow dependency doesn't stall everything.
- **Timeouts** — every outbound call has one. No unbounded waits.
- **Retries with jitter** — exponential backoff + random jitter to avoid thundering herds.
- **Circuit breakers** — stop calling a failing dependency; fail fast; probe for recovery.
- **Graceful degradation** — serve cached data or reduced features when a dependency is down.

### Stateless services, stateful data

Compute is disposable; data is precious.

- Compute (containers, functions) can be killed and restarted at any time.
- State lives in managed services (databases, object stores, queues) designed for durability and replication.
- Sessions move to a shared store (Redis, database) if they must persist.

### Automate everything

If a step requires a human, it is a latent incident.

- Infrastructure as Code (Terraform, Pulumi, CloudFormation).
- CI/CD pipelines with no manual promotion gates.
- Blue/green or canary deploys with automated rollback.
- Configuration in version control — no drift, no manual edits.

### Loose coupling

Services communicate through well-defined contracts; changes don't cascade.

- **Synchronous** (HTTP/gRPC) for request/response.
- **Asynchronous** (queues, events) for decoupling and resilience.
- **Contract tests** to detect breaking changes before deploy (`microservices-patterns/contract-testing.md`).
- **Idempotent consumers** so retries are safe.

### Observability-first

You cannot operate what you cannot see.

- **Structured logs** with correlation/trace IDs.
- **Metrics** — RED (Rate, Errors, Duration) for services; USE (Utilization, Saturation, Errors) for resources.
- **Distributed traces** across service boundaries.
- **SLOs and error budgets** to make reliability decisions quantitative.

### Security as a design property

Zero trust, least privilege, defense in depth. Every service is a potential breach point, every network is hostile, every credential is scoped.

## The AWS Well-Architected Framework (and equivalents)

The Well-Architected Framework (AWS, and analogues from GCP and Azure) organises cloud design into six pillars. It's a useful review checklist and interview vocabulary.

| Pillar | Core question | Example practices |
|---|---|---|
| **Operational Excellence** | Can you run and improve the system continuously? | IaC, runbooks, blameless postmortems, small frequent changes |
| **Security** | Are you protected against and detecting threats? | Least privilege, encryption everywhere, detection & response |
| **Reliability** | Does it recover from failure and meet demand? | Multi-AZ, backups tested, autoscaling, chaos engineering |
| **Performance Efficiency** | Are you using resources efficiently? | Right-sizing, caching, choosing the right data store |
| **Cost Optimization** | Are you spending wisely? | Autoscaling, spot/preemptible, storage lifecycle, tagging |
| **Sustainability** | Are you minimizing environmental impact? | Efficient workloads, region selection, carbon-aware scheduling |

**Tension:** these pillars pull against each other. Multi-region improves reliability and hurts cost. Aggressive autoscaling improves cost and can hurt reliability if not tuned. The architect's job is to make the trade-off explicit, not to max out every pillar.

## Cost Awareness

Cloud cost is an architectural property, not a procurement problem. Every design choice has a price tag.

**Cost drivers**

- **Compute** — instance size, vCPU-hours, serverless invocations + duration.
- **Storage** — GB-months, IOPS, request counts, egress.
- **Data transfer** — especially cross-AZ and cross-region.
- **Managed services** — databases, queues, caches, logging.

**Levers**

- **Right-size** — match instance class to actual workload. Most instances are oversized.
- **Autoscale** — scale on CPU, memory, queue depth, or custom metrics. Scale to zero for spiky or batch workloads.
- **Spot/preemptible** — for fault-tolerant workloads; big discounts for accepting interruption.
- **Storage tiers** — hot / warm / cold / archive. Lifecycle rules to move data as it ages.
- **Reserved capacity / savings plans** — for steady-state baseline.
- **Reduce data transfer** — cache at the edge, colocate chatty services, compress payloads.
- **Trim logs** — verbose logging in prod is a top hidden cost.
- **Delete idle resources** — orphaned volumes, old snapshots, unused load balancers.

**Culture**

- **Tag everything** — cost allocation requires tags (`team`, `env`, `service`, `cost-center`).
- **Per-service budgets** with alerts.
- **Cost review** as a normal part of design review, not a quarterly fire drill.

## Multi-Region Patterns

Multi-region is powerful and expensive. Choose deliberately.

| Pattern | What it gives | Cost & complexity |
|---|---|---|
| **Single region, multi-AZ** | AZ failure tolerance; RTO/RPO in minutes | Low; the default for most systems |
| **Active-passive** | Region failure tolerance; failover in minutes/hours | Medium; data replication + failover automation |
| **Active-active (read-local, write-primary)** | Lower latency reads globally | Medium-high; data model must tolerate replication lag |
| **Active-active (multi-primary writes)** | Full regional availability | Very high; conflict resolution, global consensus needed |
| **Global data plane + regional compute** | Latency + resilience balance | High; complex data architecture |

**Key questions before committing**

- **RTO/RPO requirements.** If you can tolerate 30 minutes of downtime, active-active is overkill.
- **Data residency.** Regulations (GDPR, HIPAA, DPDP) may dictate where data can live.
- **Write conflicts.** Multi-primary writes need a conflict-resolution strategy (CRDT, last-write-wins, application-level).
- **Operational cost.** Every region doubles your runbooks, dashboards, and on-call surface.
- **Cost.** Cross-region data transfer and duplicate infrastructure can triple the bill.

**Rule:** single region with multi-AZ is correct for 90% of systems. Multi-region is for global user bases, hard RTO requirements, or regulatory constraints.

## Cloud-Agnostic Patterns

Vendor lock-in is real, but total portability is a myth. Strategy: *use managed services where they give leverage; keep the escape hatch where lock-in would hurt*.

**Portable-by-default choices**

- **Kubernetes** as the compute substrate — runs on any cloud, on-prem, or hybrid.
- **Containers** as the deployable unit — the same image runs everywhere.
- **Open standards** — OpenTelemetry (observability), OIDC (identity), OpenAPI (APIs), CloudEvents (events), PostgreSQL/MySQL (data).
- **Terraform** for IaC — provider-agnostic workflow, provider-specific resources.
- **Kafka** vs provider-native queues — Kafka is portable; SQS/SNS are not.

**Accept lock-in where it pays**

- Managed databases (RDS, Cloud SQL, Aurora) — cheaper than running your own, but harder to leave.
- Serverless (Lambda, Cloud Functions) — huge operational savings, provider-specific runtime.
- Managed identity (IAM, Entra ID, Cloud IAM) — deeply integrated with the provider's security model.

**Mitigations for lock-in**

- **Hexagonal architecture** — provider-specific code lives in adapters, not in the domain.
- **Abstraction over the raw API** — a `BlobStore` interface with S3/GCS/Azure implementations.
- **Data formats** — Parquet, Avro, Protobuf. Avoid proprietary storage formats.
- **Egress planning** — know the cost and mechanics of moving data out before you need to.

## Cloud Design Checklist

Use this when reviewing a cloud-native service design.

**Compute**
- [ ] Stateless? Sessions externalized if needed.
- [ ] Graceful shutdown implemented.
- [ ] Readiness and liveness probes distinct and correct.
- [ ] Autoscaling configured with the right metric (CPU, queue depth, custom).
- [ ] Resource requests and limits set (CPU, memory).

**Data**
- [ ] Managed store for persistence; no local disk as source of truth.
- [ ] Backups configured, tested, and restorable.
- [ ] Encryption at rest and in transit.
- [ ] Retention and lifecycle policies configured.
- [ ] Schema migrations automated and reversible.

**Networking**
- [ ] TLS everywhere; internal mTLS where warranted.
- [ ] Egress restricted to known destinations.
- [ ] Private subnets for data stores; public only where strictly needed.
- [ ] DNS and service discovery standardized.

**Resilience**
- [ ] Timeouts on every outbound call.
- [ ] Retries with backoff + jitter, and only for idempotent operations.
- [ ] Circuit breakers on critical dependencies.
- [ ] Multi-AZ deployment for stateful and stateless tiers.
- [ ] Failure drills (chaos) periodically.

**Observability**
- [ ] Structured logs with trace IDs.
- [ ] RED metrics for every endpoint.
- [ ] Distributed tracing propagated across services.
- [ ] SLOs defined with error budgets.
- [ ] Alerts tied to symptoms, not causes.

**Security**
- [ ] Least-privilege IAM roles per service.
- [ ] Secrets from a secret manager, rotated.
- [ ] Dependency and image scanning in CI.
- [ ] Network policies default-deny.
- [ ] Audit logs for admin and access events.

**Cost**
- [ ] Tagged for cost allocation.
- [ ] Right-sized instance class.
- [ ] Autoscaling with a defined ceiling.
- [ ] Storage lifecycle configured.
- [ ] Data transfer patterns reviewed.

## Tricky Corners ⚠️

- **"Cloud-native" is not "containerized".** A monolith in a container is still a monolith. The principles matter more than the packaging.
- **Multi-AZ is not multi-region.** AZ failure is common and cheap to tolerate; region failure is rare and expensive.
- **Autoscaling needs the right metric.** CPU scaling fails for queue-driven workloads; scale on queue depth instead.
- **Cross-AZ traffic costs money.** Chatty services spread across AZs can quietly multiply the bill.
- **Managed services are lock-in**, even when they feel neutral. PostgreSQL-compatible is not always PostgreSQL.
- **Serverless cold starts** are real for JVM. Provisioned concurrency or SnapStart mitigates.
- **Egress costs** are the biggest surprise in cloud bills. Cache at the edge; compress; colocate.
- **Multi-region active-active is a data problem**, not a compute problem. Solve conflict resolution first.
- **Cost tags fail silently** if not enforced at resource creation. Use policy-as-code.
- **Disaster recovery is not backup.** Backups restore data; DR restores *service*. Test both.

## Common Pitfalls

- Lifting-and-shifting legacy architectures to the cloud and expecting the cloud's benefits for free.
- Ignoring egress and cross-AZ costs until the first invoice.
- Autoscaling on CPU for I/O-bound or queue-driven workloads.
- "Multi-region" that is really "warm standby in another region we've never tested".
- IaC for the happy path only — manual break-glass steps that become permanent.
- Secrets in environment variables baked into deployment manifests in git.
- No cost tagging until Finance asks where the money went.
- Over-engineering for portability at the cost of losing the cloud's leverage.
- No chaos drills — assuming resilience that has never been tested.
- Treating observability as "we have logs". Logs are one third of the picture.

## Key Interview Tips

- **Define cloud-native** as elasticity + automation + resilience + observability — not just "runs on AWS".
- **Reference twelve-factor** as the app-side manual, then talk about infra-side patterns.
- **Multi-AZ is the default; multi-region needs justification.** Interviewers want to hear that you don't over-engineer.
- **Cost is an architectural concern.** Bring up right-sizing, autoscaling, and egress without being asked.
- **Name the Well-Architected pillars** — it's a shared vocabulary interviewers recognise.
- **Talk about lock-in trade-offs** instead of pretending portability is free.
- **SLOs and error budgets** are senior-level signal. Mention them.
- **Chaos engineering** as a practice, not a buzzword — "we run failure drills" beats "we're resilient".
- **Provider-agnostic abstractions** (OpenTelemetry, Kafka, Terraform) show architectural judgement.
- **Link to twelve-factor and service models** to keep the narrative coherent.

## Related

- [Cloud Service Models](service-models.md)
- [Twelve-Factor App](../architecture/twelve-factor-app.md)
- [Observability](../observability/index.md)
- [Microservices Deployment](../microservices-patterns/deployment.md)
- [Infrastructure — Kubernetes](../kubernetes/index.md)