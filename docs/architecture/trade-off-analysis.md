# Trade-off Analysis

> **Context:** At lead level, you are constantly choosing between architectural styles, data stores, communication patterns, and deployment models. There is no "best" — only "best for these forces." This file covers the recurring trade-offs you'll be asked about in interviews and in real architecture reviews.

## Mental Model

Every architecture decision trades one property for another. The properties you're trading between:

```d2
direction: right

props: Properties
consistency: Consistency
availability: Availability
latency: Latency
throughput: Throughput
cost: Cost
complexity: Complexity
evolvability: Evolvability
operability: Operability

consistency -> availability
availability -> latency
latency -> throughput
throughput -> cost
cost -> complexity
complexity -> evolvability
evolvability -> operability
```

**Rule:** never accept a decision without naming what it trades away. If someone says "this is strictly better," they haven't found the trade-off yet.

## 1. Monolith vs Microservices

| Force | Monolith | Microservices |
|---|---|---|
| Team size | Small (< 10) | Multiple teams |
| Deploy cadence | Weekly/monthly | Per-service, many/day |
| Scaling | Uniform | Per-service, asymmetric |
| Latency | In-process | Network |
| Consistency | ACID | Eventual |
| Ops cost | Low | High |
| Debugging | Stack traces | Distributed tracing |
| Autonomy | Low | High |
| Time to first feature | Fast | Slow (infra) |
| Evolution | Coupled | Independent |

**Decision rule:** microservices are an **organizational** solution. If your team is small and the domain is unclear, a **modular monolith** (Spring Modulith) is the right default. Extract services when a force demands it — team scaling, deploy cadence, asymmetric load.

**Anti-pattern:** "distributed monolith" — services that must deploy together. Worse than a monolith.

See [`microservices-patterns/decomposition.md`](../microservices-patterns/decomposition.md).

## 2. SQL vs NoSQL

| Force | SQL (Postgres) | NoSQL (Mongo, Cassandra, Dynamo) |
|---|---|---|
| Schema | Rigid, enforced | Flexible, per-document |
| Transactions | ACID, multi-row | Limited, per-document |
| Joins | Native | Application-side or denormalized |
| Query flexibility | High (SQL) | Limited, access-pattern-driven |
| Horizontal scale | Harder | Native |
| Consistency | Strong | Tunable |
| Schema evolution | Migrations | Additive |
| Ops | Mature | Varies |
| Best for | Transactional, relational, integrity | High-scale, schema-flexible, key-based access |

**Decision rule:**
- **Default to Postgres.** It handles 95% of workloads, including JSON, time-series, full-text search, and reasonably large scale.
- Choose NoSQL when you have a **specific** reason: massive write scale (Cassandra), document-shaped data (Mongo), or managed global scale (Dynamo).
- Do not choose NoSQL "for scale" unless you've measured that SQL is the bottleneck.

**Anti-pattern:** choosing NoSQL for flexibility and then building an application-layer join engine.

See [`databases/postgresql-essentials.md`](../databases/postgresql-essentials.md) and [`databases/mongodb-essentials.md`](../databases/mongodb-essentials.md).

## 3. Normalized vs Denormalized

| Force | Normalized | Denormalized |
|---|---|---|
| Write cost | Low | High (fan-out) |
| Read cost | High (joins) | Low (single read) |
| Consistency | Easy | Must be managed |
| Storage | Lower | Higher |
| Schema evolution | Easier | Harder |
| Best for | Transactional systems | Read-heavy systems |

**Decision rule:** normalize for writes, denormalize for reads. In a CQRS system, the write model is normalized and the read model is denormalized. In a single model, start normalized and denormalize when reads are the bottleneck.

## 4. Sync vs Async

| Force | Sync (REST/gRPC) | Async (Kafka/queue) |
|---|---|---|
| Caller behavior | Blocks | Doesn't block |
| Latency | Predictable | Higher, non-blocking |
| Failure | Propagates | Absorbed |
| Coupling | Temporal (both up) | Decoupled |
| Consistency | Strong | Eventual |
| Debugging | Stack traces | Traces + events |
| Backpressure | Hard | Natural |
| Best for | Reads, queries, user-facing | State changes, events, fan-out |

**Decision rule:** sync for reads and queries; async for cross-service state changes. Full details in [`microservices-patterns/communication.md`](../microservices-patterns/communication.md).

## 5. Stateful vs Stateless

| Force | Stateless | Stateful |
|---|---|---|
| Scaling | Easy (add instances) | Hard (partition data) |
| Recovery | Restart | Restore state |
| Deploy | Rolling easy | Rolling harder |
| Latency | Depends on external state | Fast local state |
| Complexity | Low | High |
| Best for | Most services | Caches, stream processors, databases |

**Decision rule:** **default to stateless** for services. Externalize state to a database, cache, or Kafka. Use stateful only where the performance gain is essential and the operational cost is justified.

**Interview note:** "stateful vs stateless" often comes up around session management, WebSockets, and stream processing.

## 6. Batch vs Stream

| Force | Batch | Stream |
|---|---|---|
| Latency | Minutes to hours | Milliseconds to seconds |
| Complexity | Low | Higher (state, windows) |
| Cost | Cheaper | Higher (always-on) |
| Reprocessing | Easy (re-run) | Harder (replay) |
| Best for | Analytics, reports, non-urgent | Real-time, reactive, monitoring |

**Decision rule:** batch is simpler and cheaper; stream is faster and more reactive. Choose batch unless the business needs real-time. Modern data stacks often do **both** (Lambda architecture) or **stream-first with batch fallback** (Kappa).

## 7. Caching: Client vs Server vs CDN vs App

| Force | Client | CDN | App (Redis) | DB (materialized views) |
|---|---|---|---|---|
| Latency | Lowest | Low | Low | Medium |
| Freshness | Hard to control | TTL-based | TTL-based | Managed |
| Complexity | Low | Low | Medium | Medium |
| Control | Low | Low | High | High |
| Best for | Static assets, user prefs | Static, public | Session, hot data, computed | Read-heavy queries |

**Decision rule:** cache as close to the consumer as possible, but only when you have a **cache invalidation strategy**. A cache without invalidation is a bug factory.

**Anti-pattern:** caching without TTL, invalidation, or metrics. Silent staleness.

## 8. Orchestration vs Choreography

| Force | Orchestration | Choreography |
|---|---|---|
| Coordinator | Central | None |
| Coupling | Orchestrator knows all | Loose |
| Visibility | High | Low (unless traced) |
| Complexity | Grows with steps | Grows with events |
| Debugging | Orchestrator logs | Distributed tracing |
| Best for | 4+ step sagas | 2–3 step flows |

**Decision rule:** orchestrate when the flow is complex and requires compensation; choreograph when it's simple and event-driven. Full details in [`microservices-patterns/data-management.md`](../microservices-patterns/data-management.md).

## 9. Consistency Models

| Force | Strong | Eventual |
|---|---|---|
| Latency | Higher | Lower |
| Availability | Lower (during partitions) | Higher |
| Complexity | Low for caller | High for system |
| User experience | Predictable | Requires design |
| Best for | Money, inventory, identity | Social feeds, analytics, search |

**Decision rule:** strong consistency where correctness matters; eventual where scale and availability matter more. **Hybrid is the norm** — strong within a bounded context, eventual across contexts.

**CAP framing:** during a partition, you choose consistency or availability. PACELC adds: even without a partition, you trade latency vs consistency.

## 10. Multi-Region: Active-Passive vs Active-Active

| Force | Active-Passive | Active-Active |
|---|---|---|
| Failover time | Seconds to minutes | Seconds |
| Cost | Lower | Higher |
| Complexity | Lower | Much higher |
| Data consistency | Easier (single writer) | Hard (multi-master) |
| Best for | Most apps | Global, latency-sensitive, high availability |

**Decision rule:** active-passive is the default. Active-active only when the business requires it and you have the team to operate it. Most "global" apps can start with regional active-passive and a CDN.

## 11. Containers vs Serverless

| Force | Containers (K8s) | Serverless (Lambda) |
|---|---|---|
| Cold start | None (always warm) | Yes |
| Cost model | Pay for uptime | Pay per invocation |
| Ops | Higher | Lower |
| Scaling | Configurable | Automatic |
| Long-running work | Yes | No (timeouts) |
| Best for | Most services | Bursty, event-driven, glue |

**Decision rule:** containers for services you run continuously; serverless for event-driven, bursty, or rarely-used endpoints. JVM cold starts are a real constraint — use CRaC or snapshots if latency matters.

## Trade-off Cheat Sheet

| You want… | You trade… |
|---|---|
| Strong consistency | Availability during partitions, latency |
| High availability | Consistency during partitions |
| Low latency | Cost (caches, edge, replicas) |
| High throughput | Latency (batching, buffering) |
| Simplicity | Features, flexibility |
| Flexibility | Simplicity, safety |
| Independent deployability | Operational complexity |
| Fast first delivery | Long-term evolvability |
| Low cost | Resilience, redundancy |
| Zero-downtime deploys | Migration complexity |

## How to Present a Trade-off in an Interview

1. **Name the forces** — what matters for this problem?
2. **Name 2–3 options.**
3. **Name what each option trades.**
4. **State your recommendation** with a rationale.
5. **Name what would change your mind** — the trigger for revisiting.

Example:
> "For order processing, I'd start with a modular monolith and Postgres. That trades independent deployability for operational simplicity, which is the right call for a small team. I'd extract the payment service first if payments need a different compliance or deploy cadence. If the team grows past 15 engineers or deploy frequency becomes a bottleneck, I'd reconsider the service boundaries."

## Tricky Corners ⚠️

- **"It depends" is not an answer.** It's the beginning of an answer. Follow it with the criteria.
- **Every option has a downside.** If you can't name it, you haven't looked hard enough.
- **Scale is not the default justification.** Fit-for-purpose beats theoretical scale.
- **CAP is about partitions, not general trade-offs.** PACELC is the fuller picture.
- **Consistency is a spectrum, not a binary.** Bounded staleness, read-your-writes, monotonic reads.
- **Microservices don't automatically scale better.** They scale *differently*.
- **NoSQL doesn't automatically scale better.** It scales *differently*.
- **Caching without invalidation is a bug.**
- **Async isn't free.** It trades latency for complexity and eventual consistency.
- **Stateful services are hard to operate** — justify the cost.

## Common Pitfalls

- Choosing technology for resume value.
- Choosing NoSQL "for scale" without measuring.
- Choosing microservices for a 5-person team.
- Caching without invalidation strategy.
- Strong consistency everywhere (kills availability).
- Eventual consistency everywhere (breaks user trust).
- Active-active multi-region without operational maturity.
- Serverless for long-running JVM workloads.
- Ignoring operational cost (who runs it at 3am?).
- Optimizing for the wrong thing (throughput when latency matters, or vice versa).

## Key Interview Tips

- Lead with **"there's no best, only best-for-these-forces."**
- For any trade-off question, name **forces → options → trade-offs → recommendation → revisit trigger**.
- For "SQL vs NoSQL?", answer **"default to Postgres; choose NoSQL only for a specific reason — massive write scale, document shape, or managed global scale."**
- For "monolith vs microservices?", answer **"microservices are an org solution; start modular, extract when a force demands it."**
- For "sync vs async?", answer **"sync for reads, async for state changes; async trades latency for complexity and eventual consistency."**
- For "CAP?", answer **"during a partition you choose C or A; PACELC adds latency vs consistency even without a partition."**
- Always name the **cost** of your recommendation, not just the benefit.

## Related

- [Architecture index](index.md)
- [Decision Frameworks](decision-frameworks.md)
- [Evolution & Migration](evolution-and-migration.md)
- [Microservices Patterns](../microservices-patterns/index.md)
- [System Design Depth](../system-design-depth/index.md)
- [Databases → PostgreSQL Essentials](../databases/postgresql-essentials.md)
- [Databases → MongoDB Essentials](../databases/mongodb-essentials.md)