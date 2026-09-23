# Rollout Strategies

> **Context:** At lead level, shipping is not the end — it's the beginning of learning. Rollout strategies de-risk change: feature flags, canary, blue-green, dark launch, A/B testing. This file is the day-to-day playbook.

## Mental Model

A rollout has two questions:



1. **When does new code get traffic?** (deploy strategy)
2. **When does new behavior turn on?** (release strategy)

These are independent. You can deploy a service with a feature flag off, then turn it on gradually.

```d2
direction: right

deploy: "Deploy\\n(new code running)"
release: "Release\\n(new behavior on)"
learn: "Learn\\n(measure, compare)"
rollback: "Rollback\\n(if needed)"

deploy -> release
release -> learn
learn -> rollback
```

**Rule:** decouple deploy from release. Deploy is a technical event; release is a business event.

## Rollout Decision Matrix

| Risk | Blast radius | Strategy |
|---|---|---|
| Low | Small | Rolling update |
| Low | Large | Rolling + feature flag |
| Medium | Small | Canary |
| Medium | Large | Canary + feature flag |
| High | Any | Blue-green + feature flag + canary |
| Unknown | Any | Shadow + parallel run |

## Rolling Update

Default in Kubernetes.



- Replace pods one at a time (or a batch).
- Traffic gradually shifts to new version.
- No extra capacity required.
- Rollback = redeploy old version.

**Requirements:**
- Backward/forward-compatible APIs and schema (both versions run).
- Graceful shutdown.
- Readiness probes.

**When to use:** routine deploys, low risk, backward-compatible changes.

## Blue-Green

Two full environments. Route all traffic to blue or green.



- **Blue** = current (live)
- **Green** = new (idle until cutover)

**Flow:**
1. Deploy to green.
2. Smoke test green.
3. Flip router to green.
4. Monitor.
5. Keep blue warm for rollback window.
6. Decommission blue.

**Pros:** instant rollback (flip router), full test before cutover.
**Cons:** 2x infrastructure, DB schema compatibility.

**When to use:** high-risk changes, need instant rollback.

## Canary

Route a small percentage of traffic to the new version.

**Flow:**
1. Deploy canary (1–10%).
2. Compare metrics: errors, latency, business KPIs.
3. Increase gradually: 10% → 25% → 50% → 100%.
4. Auto-rollback on threshold breach.

**Requirements:**
- Per-version observability.
- Traffic splitting (Istio, Argo Rollouts, gateway weights).
- Automated metric comparison.

**When to use:** high-traffic services, when you want to validate with real traffic but limit blast radius.

## Feature Flags

Runtime toggles that decouple deploy from release.

**Types:**
- **Release flags:** hide incomplete features (short-lived).
- **Experiment flags:** A/B tests (temporary).
- **Ops flags:** kill switches, degradation controls (permanent).
- **Permission flags:** entitlements (long-lived).

**Rules:**

- Every flag has an **owner** and **expiry**.
- Default must be **safe** (old behavior on flag-service failure).
- Flags are **per-user or per-tenant** for gradual rollout.
- Log which path was taken.
- Remove the flag when migration completes.

**Spring angle:** Togglz, Unleash, LaunchDarkly, or `@ConditionalOnProperty` for static.

**When to use:** whenever you want to decouple deploy from release, or you need a kill switch.

## Dark Launch

Ship the code with the behavior off, and mirror traffic to it without affecting users.



- New code receives a copy of production traffic.
- Responses are **discarded** (not returned to users).
- Use to validate performance, correctness, or resource usage at production scale.

**Use cases:**
- Rewrites of read paths.
- New algorithms (compare outputs).
- Capacity testing.

**Rules:**

- **No side effects** — no writes, no emails, no charges.
- Isolate resources so shadow traffic doesn't affect production.
- Compare old and new outputs continuously.
- Alert on divergence.

## A/B Testing

Route users to different variants and measure a business metric.

**Requirements:**
- Random assignment (per user, not per request).
- Sufficient sample size (power analysis).
- One primary metric.
- Run long enough to reach significance.
- Guardrail metrics (latency, errors, crashes).

**Rules:**

- **Don't peek and stop early.** That's p-hacking.
- **One change per test.** Otherwise you can't attribute.
- **Segment carefully** — new users vs returning.
- **Pre-register** the hypothesis and metric.

## Parallel Run

Run old and new systems side-by-side with the same input and compare outputs.



- Old system serves users.
- New system receives the same input.
- Outputs are compared.
- Alerts fire on divergence.
- Cut over only after sustained zero divergence.

**Use cases:**
- Algorithm rewrites.
- Data pipeline migrations.
- High-risk refactors.

**Rules:**

- New system's output must not reach users.
- No side effects from the new system.
- Continuous comparison with alerting.
- Run for at least one full business cycle (e.g., month-end).

## Rollout Sequence (Recommended)

For high-risk changes:

```d2
direction: right

dark: "1. Dark launch\\n(mirror traffic)"
parallel: "2. Parallel run\\n(compare outputs)"
flag: "3. Feature flag\\n(off)"
canary: "4. Canary\\n(1%)"
grow: "5. Gradual rollout\\n(10→50→100%)"
cleanup: "6. Cleanup\\n(remove flag, old path)"

dark -> parallel
parallel -> flag
flag -> canary
canary -> grow
grow -> cleanup
```

Each step has an exit criterion (metrics, time, sign-off).

## Rollback

Every rollout needs a rollback plan.

| Strategy | Rollback mechanism | Speed |
|---|---|---|
| Rolling | Redeploy previous version | Minutes |
| Blue-green | Flip router | Seconds |
| Canary | Remove canary | Seconds |
| Feature flags | Toggle off | Seconds |
| Dark launch | Stop mirroring | Seconds |
| Parallel run | Don't cut over | N/A |

**Rules:**

- **Test the rollback path** before you need it.
- **Rollback is not the same as forward-fix.** Choose based on safety.
- **Data migrations must be reversible** (or forward-compatible).
- **Always have a rollback owner** during the rollout.

## Rollout Metrics

| Metric | Question |
|---|---|
| Error rate | Is the new version more error-prone? |
| Latency (p50, p99) | Is it slower? |
| Throughput | Is it keeping up? |
| Resource usage | CPU, memory, connections |
| Business KPI | Conversion, revenue, retention |
| Downstream impact | Are downstreams affected? |
| Cost | Is it more expensive? |

**Rule:** you must be able to **slice metrics by version**. Otherwise rollouts are blind.

## Communication

Rollouts affect users, support, and other teams.

**Communicate:**
- **What** is shipping.
- **When** it will be rolled out.
- **Expected impact** (user-visible changes).
- **Rollback plan** if something goes wrong.
- **Who** to contact.

**Rule:** support and sales should know before users do.

## Spring Boot Configuration

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
management:
  endpoint.health.probes.enabled: true
  metrics:
    tags:
      version: ${VERSION:unknown}
```

**Rule:** without a version tag, you can't compare rollouts.

## Kubernetes Example (Rolling Update)

```yaml
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 0
  minReadySeconds: 30
```

## Argo Rollouts Canary Example

```yaml
strategy:
  canary:
    steps:
      - setWeight: 10
      - pause: { duration: 5m }
      - setWeight: 25
      - pause: { duration: 10m }
      - setWeight: 50
      - pause: { duration: 15m }
      - setWeight: 100
    analysis:
      templates:
        - templateName: success-rate
```

## Tricky Corners ⚠️

- **Deploy ≠ release.** Separate them.
- **Rolling update requires backward-compatible schema.**
- **Canary requires per-version observability.**
- **Dark launch must not have side effects.**
- **A/B test requires pre-registered metrics and power analysis.**
- **Feature flags need owners and expiry** or they become debt.
- **Flag default must be safe.**
- **Rollback must be tested** before you need it.
- **Data migrations are the hard part.** Expand-contract.
- **Rollback windows are finite.** After the window, forward-fix only.
- **Support and sales need notice.**
- **Metrics without version tags are useless for rollouts.**

## Common Pitfalls

- Deploying and releasing at the same time (no kill switch).
- No feature flag on a risky change.
- Canary without per-version metrics.
- Dark launch with side effects.
- A/B test stopped early.
- Feature flags never removed.
- Rolling update with breaking schema change.
- Blue-green without DB compatibility.
- No rollback plan.
- Not communicating to support.

## Key Interview Tips

- Lead with **"deploy and release are different problems."**
- For "how do you ship a risky change?", answer **"dark launch → parallel run → feature flag → canary → gradual rollout → cleanup."**
- For "how do you roll back?", answer **"blue-green flips the router; canary removes the canary; flags toggle behavior. All tested before needed."**
- For "how do you A/B test?", answer **"random assignment per user, pre-registered metric, power analysis, guardrails."**
- For "how do you decouple deploy from release?", answer **"feature flags with owners, expiry, and safe defaults."**
- Always mention **DB migration compatibility** and **metrics sliced by version**.
- Name the **rollback mechanism** for each strategy.

## Related

- [System Design Depth index](index.md)
- [Non-Functional Requirements](non-functional-requirements.md)
- [Failure Modes](failure-modes.md)
- [Evolution Stories](evolution-stories.md)
- [Capacity Planning](capacity-planning.md)
- [Microservices Patterns → Deployment](../microservices-patterns/deployment.md)
- [Architecture → Evolution & Migration](../architecture/evolution-and-migration.md)