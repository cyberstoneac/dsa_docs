# Non-Functional Requirements

> **Context:** At lead level, functional requirements are table stakes. The interview (and the design review, and the production incident) turns on **non-functional requirements** — latency, availability, consistency, durability, cost, security, and operability. This file covers how to elicit, prioritize, and defend them.

## Mental Model

A functional requirement says *what* the system does. A non-functional requirement (NFR) says *how well* it must do it. NFRs are the constraints that shape every architectural decision.

```d2
direction: right

nfr: Non-Functional Requirements
perf: "Performance\\n(latency, throughput)"
avail: "Availability\\n(uptime, redundancy)"
cons: "Consistency\\n(strong, eventual)"
dur: "Durability\\n(data loss tolerance)"
cost: "Cost\\n(infra, ops, dev)"
sec: "Security\\n(auth, compliance)"
ops: "Operability\\n(on-call, debuggability)"
scale: "Scalability\\n(10x, 100x)"

perf -> avail
avail -> cons
cons -> dur
dur -> cost
cost -> sec
sec -> ops
ops -> scale
```

**Rule:** NFRs are the *actual* architecture. The boxes and arrows follow from them.

## The NFR Framework

Every NFR has three parts:



1. **Metric** — what's measured (p99 latency, availability %).
2. **Target** — the number (200ms, 99.9%).
3. **Scope** — under what conditions (at peak, per region, for paid users).

| Bad NFR | Good NFR |
|---|---|
| "It should be fast." | "p99 read latency < 200ms at 10k QPS, in-region." |
| "It should be reliable." | "99.95% monthly availability, excluding scheduled maintenance." |
| "It should handle growth." | "5x current throughput without architectural change." |
| "It should be consistent." | "Read-your-writes for the same user; eventual (≤2s) across users." |
| "It should be secure." | "SOC2, PII encrypted at rest, TLS 1.3 in transit, per-tenant isolation." |

**Rule:** an NFR without a number is a wish.

## Latency

### Percentiles, not averages

Averages hide the pain. Users experience p99, not p50.

| Percentile | What it represents |
|---|---|
| p50 | Typical user |
| p90 | Many users |
| p99 | Slowest users (often your best customers) |
| p99.9 | Tail — often infra hiccups |

**Rule:** design to **p99**, alert on **p99**, and know your **p99.9**.

### Latency budget

Total latency = sum of hops + queueing + processing.

```d2
direction: right

client: Client
cdn: CDN
gw: Gateway
svc: Service
db: DB

client -> cdn
cdn -> gw
gw -> svc
svc -> db
```

Example budget for p99 = 500ms:
- Network + TLS: 50ms
- CDN: 20ms
- Gateway (auth, routing): 30ms
- Service logic: 100ms
- Downstream calls: 200ms
- DB: 80ms
- Serialization: 20ms
- **Total: 500ms**

**Rule:** assign a budget per hop. When one hop is slow, you know which one.

### The tail at scale

p99 at 100 QPS is 1 request/sec. p99 at 100k QPS is 1,000 requests/sec — a constant background of slow requests. Design for it.

## Availability

Availability = uptime / total time. Measured in nines.

| Nines | Downtime / year | Downtime / month |
|---|---|---|
| 99% | 3.65 days | 7.2 hours |
| 99.9% | 8.76 hours | 43.2 minutes |
| 99.95% | 4.38 hours | 21.6 minutes |
| 99.99% | 52.6 minutes | 4.32 minutes |
| 99.999% | 5.26 minutes | 26 seconds |

### Composition

Chains multiply: A calls B calls C, each 99.9% ⇒ end-to-end 99.7%.

```d2
direction: right

a: Service A\n99.9%
b: Service B\n99.9%
c: Service C\n99.9%
total: End-to-end\n99.7%

a -> b
b -> c
c -> total
```

**Rule:** fewer hops, higher availability. Async decoupling and graceful degradation raise end-to-end availability above the naive product.

### Availability strategies

| Strategy | Gains |
|---|---|
| Redundancy (multi-AZ) | Survives zone failures |
| Multi-region | Survives region failures |
| Graceful degradation | Partial functionality during outages |
| Circuit breakers | Prevents cascade |
| Bulkheads | Isolates failures |
| Backpressure | Prevents overload |

## Consistency

Consistency is a spectrum, not a binary.

| Model | Guarantee | Use case |
|---|---|---|
| Strong (linearizable) | All reads see latest write | Money, inventory, identity |
| Read-your-writes | A user sees their own writes | Profile, cart |
| Monotonic reads | A user never sees older data than before | Feeds |
| Causal | Causally related writes are ordered | Comments, messages |
| Eventual | Replicas converge eventually | Analytics, search |

**Rule:** strong consistency within a bounded context; eventual across contexts. **Hybrid is the norm.**

### CAP and PACELC

- **CAP:** during a partition, choose consistency or availability.
- **PACELC:** even without partitions, trade latency vs consistency.

In practice, most systems are **PC/EC** (strong consistency, higher latency) or **PA/EL** (available, lower latency).

## Durability

Durability = probability data survives failures.

| Level | Mechanism |
|---|---|
| No durability | In-memory only |
| Single-node durable | Fsync to one disk |
| Replicated durable | RF 3, min ISR 2 |
| Cross-region durable | Async or sync replication |
| Immutable / WORM | Append-only, tamper-evident |

**Rule:** durability and availability are different. A system can be highly available and lose data (e.g., `acks=1`).

## Cost

Cost is a first-class NFR at lead level.

| Cost dimension | Example |
|---|---|
| Infrastructure | Compute, storage, network |
| Managed services | DB, Kafka, cache |
| Operational | On-call, tooling, SRE time |
| Engineering | Building vs buying |
| Opportunity | What we don't build because we're maintaining this |

**Rule:** every "make it more reliable" has a cost. Name it.

## Security

At minimum:



- **AuthN:** who are you? (OIDC, mTLS)
- **AuthZ:** what can you do? (RBAC, ABAC, resource-level)
- **Encryption:** TLS 1.3 in transit, AES-256 at rest
- **Secrets:** Vault / cloud secret manager; never in code
- **Data classification:** PII, PCI, PHI handling
- **Compliance:** SOC2, GDPR, HIPAA as applicable
- **Audit:** who did what, when

**Rule:** security is not a feature; it is a constraint on every design.

## Operability

Can you run it at 3am?

| Aspect | Question |
|---|---|
| Observability | Metrics, logs, traces with correlation IDs |
| Alerting | Actionable alerts, on-call runbooks |
| Deployability | Zero-downtime deploys, fast rollback |
| Debuggability | Can you reproduce, inspect, and fix? |
| Recoverability | Backup/restore tested, DR plan |

**Rule:** if you can't operate it, it isn't done.

## Scalability

| Scale | Strategy |
|---|---|
| 10x current | Vertical + read replicas |
| 100x | Sharding, partitioning, async |
| 1000x | Multi-region, edge, dedicated infra |

**Rule:** don't design for 1000x on day one. Design for 10x, plan for 100x, and know what 1000x requires.

## Eliciting NFRs in an Interview

Ask the interviewer:



- "What's the latency target for the critical path?"
- "What availability do we need? What's acceptable downtime?"
- "How consistent does this need to be — is eventual acceptable?"
- "Can we lose any data? What's the RPO?"
- "What's the scale today, and where do you want it in 2 years?"
- "What's the cost ceiling?"
- "Any compliance constraints?"
- "Who's on-call for this?"

**Rule:** if the interviewer doesn't know, state your assumption and move on.

## Prioritizing NFRs

You can't optimize all of them. Force-rank:

```d2
direction: right

pri: Priority
p1: Must-have
p2: Should-have
p3: Nice-to-have

p1 -> p2
p2 -> p3
```

Example (payments system):
- Must: strong consistency, 99.99% availability, p99 < 300ms, PCI.
- Should: 5x scale headroom.
- Nice: p50 < 50ms, multi-region active-active.

**Rule:** the top 3 NFRs drive the architecture. The rest are trade-offs.

## Documenting NFRs

Use an SLO document (per service):

```markdown
# SLO: Checkout API

## SLIs
- Availability: % of successful requests (2xx/3xx) / total
- Latency: p99 request duration
- Error rate: 5xx + timeouts / total

## SLOs
- Availability: 99.95% monthly
- Latency: p99 < 500ms monthly
- Error rate: < 0.1% monthly

## Error budget
- 0.05% of monthly requests = 21.6 minutes of downtime

## Exclusions
- Scheduled maintenance windows
- Client errors (4xx)
```

**Rule:** an SLO without an error budget is just a target. The budget is what changes behavior.

## Tricky Corners ⚠️

- **Averages lie.** Use percentiles.
- **Chains multiply.** 5 hops at 99.9% = 99.5%.
- **Availability and durability are different.** High availability can still lose data.
- **Consistency is a spectrum.** "Strong vs eventual" is a false binary.
- **Cost is an NFR.** Ignoring it in a design review is career-limiting.
- **Every "make it more reliable" has a cost.** Name it.
- **NFRs without numbers are wishes.**
- **NFRs change as the product matures.** Revisit quarterly.
- **The tail matters at scale.** p99 at 100k QPS is a lot of slow requests.
- **SLOs need an error budget** to be meaningful.
- **You can't optimize everything.** Force-rank the top 3.

## Common Pitfalls

- Designing without asking for NFRs.
- Assuming p50 = user experience.
- Ignoring the tail at scale.
- Confusing availability with durability.
- Treating consistency as a binary.
- Ignoring cost and operability in design.
- SLOs without error budgets.
- Not documenting NFRs.
- Optimizing for scale you don't have.
- Never revisiting NFRs as the product grows.

## Key Interview Tips

- Lead with **"NFRs are the architecture; functional requirements are table stakes."**
- For any design, ask for **latency, availability, consistency, durability, cost** targets before drawing boxes.
- For "how do you set an SLO?", answer **"SLI → SLO → error budget → alert on burn rate."**
- For "how available is your system?", answer with **the composition math** (fewer hops, async decoupling, graceful degradation).
- For "strong or eventual consistency?", answer **"strong within a bounded context, eventual across; hybrid is the norm."**
- For "how do you trade off reliability vs cost?", answer **"with an explicit error budget — 99.9% is a business decision, not a default."**
- Always name the **top 3 NFRs** and how they shape the design.

## Related

- [System Design Depth index](index.md)
- [Failure Modes](failure-modes.md)
- [Evolution Stories](evolution-stories.md)
- [Capacity Planning](capacity-planning.md)
- [Rollout Strategies](rollout-strategies.md)
- [Architecture → Trade-off Analysis](../architecture/trade-off-analysis.md)