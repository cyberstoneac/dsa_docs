# Failure Modes

> **Context:** At lead level, "how does this fail?" is a more important question than "how does this work?" Every distributed system fails — the question is whether it fails gracefully or catastrophically. This file covers the failure taxonomy, cascading failure prevention, and chaos engineering.

## Mental Model

Distributed systems fail along four axes:

```d2
direction: right

fail: Failure Types
crash: "Crash\\n(fail-stop)"
slow: "Slow\\n(gray failure)"
partial: "Partial\\n(some requests fail)"
byzantine: "Byzantine\\n(corrupt, wrong answers)"

crash -> slow
slow -> partial
partial -> byzantine
```

| Type | Example | Detection |
|---|---|---|
| Crash | Process dies, node dies | Health check, connection refused |
| Slow | p99 up 10x, timeouts | Latency metrics |
| Partial | 5% of requests fail | Error rate |
| Byzantine | Silent data corruption | Checksums, reconciliation |

**Slow is the worst.** Crash is obvious; slow looks like "working" until your thread pool is exhausted and the whole system is down.

## Failure Taxonomy

| Layer | Common failures |
|---|---|
| Network | Partitions, packet loss, DNS failures, slow links |
| Compute | Node crashes, OOM, CPU starvation, disk full |
| Storage | Disk failure, write amplification, replication lag |
| Application | Memory leaks, deadlocks, thread exhaustion, slow queries |
| Dependency | Third-party outage, rate limits, schema changes |
| Data | Corruption, inconsistent replicas, lost writes |
| Human | Bad config, wrong deploy, missing migration |

**Rule:** assume every one of these will happen. Design for it.

## Cascading Failures

The #1 cause of major outages. One slow dependency exhausts a resource, which fails the caller, which fails the caller's callers, and so on.

```d2
direction: right

svcA: "Service A\\n(shared thread pool)"
svcB: "Service B\\n(slow)"
svcC: Service C

svcA -> svcB
svcA -> svcC
```

If `svcA` has a shared thread pool and `svcB` is slow, all threads are consumed waiting on `svcB`, and `svcC` also fails because there are no threads left.

### Prevention

| Pattern | Prevents |
|---|---|
| **Timeouts** | Infinite waits exhausting threads |
| **Circuit breakers** | Calling a dead dependency |
| **Bulkheads** | One dependency consuming all threads |
| **Rate limiting** | Overload from a flood |
| **Backpressure** | Queues growing unbounded |
| **Load shedding** | Accepting more than you can handle |
| **Graceful degradation** | Full outage when a feature fails |
| **Retry with jitter** | Retry storms |
| **Idempotency** | Duplicate side effects on retry |

See [`microservices-patterns/reliability.md`](../microservices-patterns/reliability.md).

## Partial Failures

One part of the system fails while the rest is healthy. Common in multi-region, multi-AZ, and microservices.

### Handling

- **Fallback to degraded mode** — show cached data, hide non-essential features.
- **Fail-fast for non-critical paths** — return errors quickly instead of timing out.
- **Isolate blast radius** — bulkheads per dependency, per tenant.
- **Retry with backoff** — for transient failures on idempotent operations.
- **Route around** — failover to healthy region/AZ.

**Rule:** "healthy but partially broken" is the normal state of a large system. Design for it.

## Timeouts

The single most important failure-prevention mechanism.

```d2
direction: right

call: Remote Call
timeout: "Timeout\\n(bound wait)"

call -> timeout
```

Rules:
- **Every remote call has a timeout.**
- **Timeout < caller's timeout.** Otherwise the caller waits forever.
- **Timeouts should be based on p99**, not averages.
- **Different timeouts for different dependencies.**
- **Retry budget must fit inside the timeout.**

**Anti-pattern:** infinite timeout. This is the #1 cause of thread pool exhaustion.

## Retry Storms

Retries during an incident can amplify load and prevent recovery.

```d2
direction: right

before: "Healthy: 1000 rps"
during: "Dependency slows: retries cause 3000 rps"
after: Dependency can't recover

before -> during
during -> after
```

### Prevention

- **Retry budget:** cap total retries (e.g., 10% of requests).
- **Jittered backoff:** avoid synchronized retries.
- **Circuit breaker:** stop retrying against a dead dependency.
- **Retry only idempotent operations.**
- **Retry at one layer only** — not both caller and callee.

## Recovery

How do you get back to normal?

| Phase | Action |
|---|---|
| **Detect** | Alerts, SLOs, synthetic probes |
| **Mitigate** | Rollback, failover, rate limit, disable feature |
| **Diagnose** | Traces, logs, metrics |
| **Fix** | Deploy fix, restore data, re-enable |
| **Verify** | SLOs back to normal |
| **Learn** | Postmortem, action items |

**Rule:** mitigate before diagnosing. Users care that it works, not why it broke.

## Recovery Time Objectives

| Metric | Meaning |
|---|---|
| **RTO** (Recovery Time Objective) | Max acceptable downtime |
| **RPO** (Recovery Point Objective) | Max acceptable data loss |
| **MTTR** | Mean time to restore |
| **MTTD** | Mean time to detect |

**Rule:** RTO/RPO are business decisions, not engineering ones. Make them explicit.

## Backup and Restore

- **Backups are only as good as the last restore test.** Test quarterly.
- **Backups are not HA.** They're for data loss, not outage.
- **Cross-region backups** protect against region failure.
- **Point-in-time recovery** (PITR) for databases.
- **Immutable backups** protect against ransomware.

**Rule:** a backup you've never restored is not a backup.

## Chaos Engineering

Deliberately inject failures to validate resilience.

| Experiment | Tests |
|---|---|
| Kill a pod | Restart behavior, graceful shutdown |
| Kill a node | Failover, partition rebalance |
| Network partition | Split-brain behavior |
| Slow a dependency | Timeouts, circuit breakers |
| Fill a disk | Disk-full handling |
| Add latency | Latency budgets |
| Delete a DB replica | Failover, read consistency |

Tools: Chaos Monkey, Litmus, Gremlin, Chaos Mesh.

**Rules:**
- **Start in staging.** Move to prod only after building confidence.
- **Have a hypothesis.** "If X fails, Y should happen."
- **Minimize blast radius.** Small scope first.
- **Have a rollback.** Stop the experiment if it goes wrong.
- **Run in business hours.** You want people available.

## Game Days

Structured incident-response practice.



- **Scenario:** e.g., "DB primary fails."
- **Team:** on-call + lead + comms.
- **Objectives:** test detection, response, communication.
- **Output:** findings, improvements, runbook updates.

**Rule:** game days reveal gaps that dashboards don't.

## Observability for Failures

You can't fix what you can't see. See [`microservices-patterns/observability.md`](../microservices-patterns/observability.md).

Minimum for failure detection:
- **RED metrics** per endpoint (Rate, Errors, Duration).
- **USE metrics** per resource (Utilization, Saturation, Errors).
- **Distributed tracing** with error tags.
- **Structured logs** with correlation IDs.
- **SLO burn rate alerts.**

## Failure Mode Analysis (FMEA)

A structured way to reason about failure.

For each component, ask:
1. **What could fail?**
2. **How likely?** (frequency)
3. **How bad?** (severity)
4. **How detectable?** (detection)
5. **Risk = f(likelihood, severity, detectability)**
6. **Mitigation.**

Example:

| Component | Failure | Likelihood | Impact | Detection | Mitigation |
|---|---|---|---|---|---|
| DB primary | Crash | Low | High | Fast | Auto-failover to replica |
| Cache | Eviction | High | Low | Fast | Fallback to DB |
| Payment provider | Timeout | Medium | High | Medium | Circuit breaker + retry + fallback |
| Kafka broker | Down | Low | Medium | Fast | RF 3, auto-leader election |
| DNS | Failure | Low | High | Fast | Caching, multiple resolvers |

## The Lead's Role in Failure

- **Design for failure** from day one, not after the incident.
- **Define SLOs** and error budgets.
- **Invest in observability** before you need it.
- **Run game days** and chaos experiments.
- **Blameless postmortems** with action items.
- **On-call health** — protect responders.
- **Failure mode review** in design reviews.

## Tricky Corners ⚠️

- **Slow is worse than down.** Down is obvious; slow looks like "fine" until it isn't.
- **Cascading failures come from shared resources.** Thread pools, connection pools, CPU.
- **Retries amplify failure.** Cap them.
- **Timeouts must be shorter than the caller's.** Otherwise you stall.
- **Circuit breakers need fallbacks.** Otherwise they just fail fast.
- **Backups are useless if never restored.**
- **HA ≠ durability.** You can be up and lose data.
- **RPO/RTO are business decisions.** Get them from the business.
- **Chaos engineering requires a hypothesis and a rollback.**
- **Postmortem action items must close.** Otherwise the same incident recurs.
- **The blast radius of a bug scales with coupling.** Reduce coupling.
- **Correlated failures are the worst.** Multi-AZ doesn't help if the failure is account-wide.

## Common Pitfalls

- No timeouts.
- Retries without idempotency.
- Retries without jitter.
- Shared thread pool across dependencies.
- No circuit breakers.
- No fallbacks.
- Backups never tested.
- No chaos engineering.
- No game days.
- Postmortems without action items.
- Assuming "HA" means "no data loss."
- Not measuring RTO/RPO.
- Ignoring the slow failure mode.

## Key Interview Tips

- Lead with **"assume everything fails; design for graceful degradation."**
- For "how do you prevent cascading failures?", answer **"timeouts + circuit breakers + bulkheads + retries with jitter + rate limiting + graceful degradation."**
- For "how do you handle a slow dependency?", answer **"timeout, circuit breaker, bulkhead, fallback; never let it consume shared resources."**
- For "how do you recover from failures?", answer **"detect → mitigate → diagnose → fix → verify → learn; mitigate before diagnosing."**
- For "how do you test resilience?", answer **"chaos engineering with a hypothesis and rollback; game days for practice."**
- For "what's the difference between HA and durability?", answer **"HA is uptime; durability is data survival. You can have HA and lose data."**
- For "how do you set RTO/RPO?", answer **"with the business — they're business decisions with costs."**
- Always name the **slow failure mode** — it's the one candidates miss.

## Related

- [System Design Depth index](index.md)
- [Non-Functional Requirements](non-functional-requirements.md)
- [Evolution Stories](evolution-stories.md)
- [Capacity Planning](capacity-planning.md)
- [Rollout Strategies](rollout-strategies.md)
- [Microservices Patterns → Reliability](../microservices-patterns/reliability.md)
- [Leadership → Incident Command](../leadership/incident-command.md)