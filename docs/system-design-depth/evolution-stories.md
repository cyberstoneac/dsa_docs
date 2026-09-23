# Evolution Stories

> **Context:** At 13 YOE, interviewers don't just ask "design X." They ask "how would X evolve over two years?" This tests whether you can reason about systems as **trajectories**, not snapshots. This file gives you a framework and a set of ready stories.

## Mental Model

A system design is not a destination; it's a **point on a trajectory**. Evolution stories ask: "given this design today, what happens as the business grows, the team changes, the technology shifts?"

```d2
direction: right

today: "Today\\n(design, scale, team)"
trigger: "Trigger\\n(load, feature, team, cost)"
evolve: "Evolution\\n(incremental, reversible)"
next: Next state

today -> trigger
trigger -> evolve
evolve -> next
```

**Rule:** every evolution is triggered by a **force**. Name the force, name the evolution, name the trade-off.

## The Framework

For any "how would you evolve X?" question:



1. **State the current design** (one sentence).
2. **Identify the trigger** — what force breaks it?
3. **Propose the evolution** — incremental, reversible.
4. **Name the trade-off** — what you give up.
5. **Name the next trigger** — when you'd evolve again.

### Triggers

| Trigger | Typical evolution |
|---|---|
| 10x load | Sharding, caching, async |
| 100x load | Multi-region, edge |
| New region | Replication, data residency |
| New feature | New service, new data model |
| Team grows | Service extraction, ownership split |
| Cost pressure | Right-sizing, spot instances, tiering |
| Compliance | Data isolation, audit, encryption |
| Latency SLO tightening | Edge, caching, colocation |

## Story 1: Monolith → Services

**Current:** Modular monolith, Postgres, single deploy.

**Trigger:** Team grows from 8 to 40. Deploy coordination is painful. One team's hotfix blocks another's release.

**Evolution:**
1. Strangler fig facade in front of the monolith.
2. Extract highest-churn capability (e.g., notifications) first.
3. Extract team-owned capabilities one at a time.
4. Each service gets its own DB (via CDC/outbox).
5. Event bus for cross-service communication.

**Trade-off:** Independent deployability at the cost of operational complexity.

**Next trigger:** Cross-service consistency issues → saga + outbox + idempotent consumers.

## Story 2: SQL → Sharded SQL

**Current:** Single Postgres primary, read replicas.

**Trigger:** Write throughput exceeds single-primary capacity (~10k writes/sec).

**Evolution:**
1. **Vertical first** — bigger instance, faster disk.
2. **Read replicas** for read scaling.
3. **Partition tables** within a single DB.
4. **Shard by tenant/customer** when writes exceed capacity.
5. **Route via a shard-aware proxy** (Vitess, Citus, app-level).

**Trade-off:** Cross-shard queries become hard; transactions across shards require sagas.

**Next trigger:** Cross-shard analytics → data warehouse or CQRS read model.

## Story 3: Single Region → Multi-Region

**Current:** Single region, active-passive standby.

**Trigger:** Latency SLO for global users, or compliance requires in-region data.

**Evolution:**
1. **CDN** for static and cacheable content.
2. **Read replicas in other regions** for latency.
3. **Active-passive with automated failover** for HA.
4. **Active-active** for latency-critical, with conflict resolution.

**Trade-off:** Active-active requires conflict resolution, per-region data residency, and much higher ops complexity.

**Next trigger:** Data residency rules → per-region data isolation.

## Story 4: Sync → Async

**Current:** Synchronous REST calls between services.

**Trigger:** Latency budget, cascading failures, or a slow downstream.

**Evolution:**
1. **Introduce events for state changes** (Kafka).
2. **Idempotent consumers** with dedupe keys.
3. **Outbox pattern** for atomic DB + publish.
4. **Async where the caller doesn't need the result.**
5. **Keep sync for reads and user-facing queries.**

**Trade-off:** Eventual consistency and debugging complexity.

**Next trigger:** Event schema evolution → schema registry + versioned events.

## Story 5: Batch → Stream

**Current:** Nightly batch ETL into the warehouse.

**Trigger:** Business needs real-time dashboards, alerts, or personalization.

**Evolution:**
1. **CDC** from source DBs to Kafka.
2. **Stream processing** (Kafka Streams, Flink) for aggregations.
3. **Streaming sink** into the warehouse (real-time tables).
4. **Keep batch for backfills and reconciliation.**

**Trade-off:** Always-on infrastructure, state management complexity.

**Next trigger:** Complex event processing → Flink or similar.

## Story 6: No Cache → Cache

**Current:** All reads hit the DB.

**Trigger:** p99 latency degrades; DB CPU at 80%.

**Evolution:**
1. **Read replicas** first (cheaper than cache).
2. **App-level cache** (Caffeine) for hot, immutable data.
3. **Distributed cache** (Redis) for shared, larger data.
4. **CDN** for public, cacheable content.
5. **Cache invalidation strategy** — TTL, write-through, or event-based.

**Trade-off:** Staleness, invalidation complexity, cache stampede risk.

**Next trigger:** Cache stampede → single-flight, request coalescing.

## Story 7: Single Team → Multiple Teams

**Current:** One team owns everything.

**Trigger:** Product surface grows; 40 engineers can't coordinate.

**Evolution:**
1. **Clear ownership** — every service has an owning team.
2. **Internal platform team** for shared infra.
3. **API contracts and versioning.**
4. **On-call rotations per team.**
5. **Architecture guild or RFC process** for cross-cutting decisions.

**Trade-off:** Coordination overhead, potential for local optimization over global.

**Next trigger:** Cross-team dependencies become bottlenecks → platform investments, contract testing.

## Story 8: Cost Pressure

**Current:** Overprovisioned infra, everything on-demand.

**Trigger:** Cloud bill grows faster than revenue.

**Evolution:**
1. **Right-size instances** based on utilization.
2. **Autoscale** based on real metrics.
3. **Spot / preemptible instances** for stateless workloads.
4. **Tiered storage** — hot/warm/cold.
5. **Reserved capacity** for steady-state.

**Trade-off:** Some savings require availability trade-offs; spot instances can be evicted.

**Next trigger:** Cost per request still too high → architecture changes (caching, batching, async).

## Story 9: SLO Tightening

**Current:** 99.9% availability, p99 < 500ms.

**Trigger:** Business requires 99.99% and p99 < 200ms.

**Evolution:**
1. **Reduce hops** — collapse services, remove synchronous calls.
2. **Async decoupling** for non-critical paths.
3. **Multi-AZ** for all stateful components.
4. **Graceful degradation** for non-critical features.
5. **Error budgets** with burn-rate alerts.

**Trade-off:** Cost and complexity; engineering effort to reach the next nine.

**Next trigger:** Hitting platform limits → rethink architecture.

## Story 10: Observability Maturity

**Current:** Logs only.

**Trigger:** Can't debug incidents fast enough; MTTR is high.

**Evolution:**
1. **Correlation IDs** across services.
2. **Metrics** (RED, USE) with dashboards.
3. **Distributed tracing** with sampling.
4. **SLOs and burn-rate alerts.**
5. **Runbooks** for every alert.

**Trade-off:** Cost (storage, cardinality) and effort; need discipline to keep signal high.

**Next trigger:** Too much noise → refine alerts, reduce cardinality, add tail-based sampling.

## How to Present an Evolution Story

Template:

> "Today, we have [design]. If [trigger] happens, I'd evolve it by [steps]. The trade-off is [cost]. I'd know it's time when [metric or event]. The next trigger after that would be [next evolution]."

Example:

> "Today we have a modular monolith on Postgres with read replicas. If writes exceed single-primary capacity, I'd shard by tenant using a shard-aware proxy. The trade-off is cross-shard queries and transaction complexity, which we'd handle with CQRS for analytics. I'd know it's time when write throughput consistently exceeds 8k/sec or p99 write latency hits the SLO. After that, the next trigger would be multi-region active-active if latency for global users becomes a business priority."

## Tricky Corners ⚠️

- **Evolution is triggered by forces, not timelines.** "In 2 years" is not a trigger.
- **Every evolution has a trade-off.** Name it.
- **Incremental is safer than big-bang.** Strangler fig, expand-contract.
- **Reversibility matters.** Prefer decisions you can undo.
- **The first evolution is often the simplest** — vertical scaling, read replicas.
- **Don't over-evolve.** Not every system needs multi-region active-active.
- **The team is part of the system.** Evolution must match team capacity.
- **Cost is a trigger.** Not just scale.
- **Compliance is a trigger.** Not just features.
- **Revisit decisions.** What was right 2 years ago may not be now.

## Common Pitfalls

- Not naming the trigger.
- Proposing big-bang rewrites.
- Ignoring the trade-off.
- Over-engineering for scale you don't have.
- Forgetting team and org constraints.
- Ignoring cost.
- Assuming the first design must serve forever.
- Not knowing the next trigger.
- Treating evolution as a one-time event.
- Reusing patterns without checking fit.

## Key Interview Tips

- Lead with **"systems evolve when a force breaks them; name the force, name the evolution, name the trade-off."**
- For "how would you evolve X over 2 years?", answer with the **framework**: today → trigger → evolution → trade-off → next trigger.
- For "how would you handle 10x load?", answer **"vertical first, read replicas, caching, then sharding; shard only when writes exceed capacity."**
- For "how would you handle multi-region?", answer **"CDN → read replicas → active-passive → active-active; each step has a cost."**
- For "how do you know it's time?", answer with a **concrete metric or event**.
- Always name the **trade-off** and the **next trigger**.
- Close with **"and the team must be able to operate it"** — it shows lead-level thinking.

## Related

- [System Design Depth index](index.md)
- [Non-Functional Requirements](non-functional-requirements.md)
- [Failure Modes](failure-modes.md)
- [Capacity Planning](capacity-planning.md)
- [Rollout Strategies](rollout-strategies.md)
- [Architecture → Evolution & Migration](../architecture/evolution-and-migration.md)