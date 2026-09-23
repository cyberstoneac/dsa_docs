# Deployment

> **Spring context:** Spring Boot 3.x supports graceful shutdown (`server.shutdown=graceful`), readiness/liveness probes, and externalized config. Deployment strategies are implemented at the Kubernetes / CI level, but the app must cooperate (health endpoints, graceful shutdown, feature flags via Spring Cloud Config / LaunchDarkly / Unleash).

## Mental Model

Deployment is a risk management problem. Every strategy is a trade-off between **speed**, **blast radius**, and **cost**.

```d2
direction: right

strategies: Deployment Strategies
rolling: "Rolling Update\\n(default)"
bg: "Blue-Green\\n(two full envs)"
canary: "Canary\\n(partial rollout)"
shadow: "Shadow\\n(mirror traffic)"
flags: "Feature Flags\\n(runtime toggle)"
serverless: "Serverless\\n(event-driven)"

rolling -> bg
bg -> canary
canary -> shadow
shadow -> flags
flags -> serverless
```

Two orthogonal axes:
- **When does new code get traffic?** (rolling, blue-green, canary)
- **When does new behavior turn on?** (feature flags)

These are independent. You can canary a deploy with the feature flag still off.

## Rolling Update

Default in Kubernetes. Replace pods one (or a few) at a time.

```d2
direction: right

svc: Service
old1: Pod v1
old2: Pod v1
new1: Pod v2

svc -> old1
svc -> old2
svc -> new1
```

Pros: no extra capacity, simple.
Cons: mixed versions during rollout, hard to roll back fast, no traffic control.

Requirements:
- **Backward/forward compatible** between versions (API, DB schema, message format).
- **Graceful shutdown** — finish in-flight requests.
- **Readiness probes** so traffic only goes to ready pods.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

`maxUnavailable: 0` ensures capacity never drops. `maxSurge: 1` limits extra capacity.

## Blue-Green

Two full environments. Route all traffic to blue (current) or green (new).

```d2
direction: right

router: Router / LB
blue: "Blue\\n(v1, live)"
green: "Green\\n(v2, idle)"

router -> blue
router -> green
```

Pros: instant rollback (flip the router), full environment test before cutover.
Cons: double the infrastructure, DB schema must be compatible with both.

Cutover steps:
1. Deploy green.
2. Run smoke tests against green.
3. Flip router to green.
4. Monitor.
5. Keep blue warm for rollback window, then decommission.

**DB migrations must be compatible with both versions.** Use expand-contract (see `architecture/evolution-and-migration.md`).

## Canary

Route a small percentage of traffic to the new version, gradually increase.

```d2
direction: right

router: "Router (weighted)"
stable: "Stable (v1, 90%)"
canary: "Canary (v2, 10%)"

router -> stable
router -> canary
```

Pros: real traffic, small blast radius, gradual confidence.
Cons: needs traffic splitting, metrics per version, longer rollout.

Steps:
1. Deploy canary (10%).
2. Compare metrics: error rate, latency, business KPIs.
3. Increase to 25%, 50%, 100% if healthy.
4. Auto-rollback if error rate or latency exceeds threshold.

Tools: Istio VirtualService weights, Argo Rollouts, Flagger, Spring Cloud Gateway weights.

**Requires observability per version** — you must be able to slice metrics by version label.

## Shadow Deployment

Mirror production traffic to the new version; the new version's responses are **discarded**.

```d2
direction: right

prod: "Production (v1)"
shadow: "Shadow (v2)"
real: Real User
discard: Responses discarded

real -> prod
prod -> shadow
shadow -> discard
```

Pros: real traffic, no user impact, test performance at scale.
Cons: **side effects** — the shadow must not write to shared DBs, send emails, or charge cards. Requires careful isolation.

Use cases: testing a rewrite, load testing at production scale, validating a new algorithm.

## Feature Flags

Runtime toggles that decouple deploy from release.

```d2
direction: right

app: "App\\n(reads flag)"
flags: "Flag Service\\n(LaunchDarkly / Unleash / Config)"
on: Flag on → new code path
off: Flag off → old code path

app -> flags
flags -> on
flags -> off
```

```java
if (featureFlags.isEnabled("new-checkout-flow", user)) {
    return newCheckout(req);
} else {
    return legacyCheckout(req);
}
```

Types:
- **Release flags** — short-lived, hide incomplete features.
- **Experiment flags** — A/B tests, temporary.
- **Ops flags** — kill switches, circuit breakers.
- **Permission flags** — entitlements, long-lived.

**Rules:**

- Every flag has an **owner** and an **expiry date**.
- Stale flags are technical debt — clean them up.
- Flag evaluation must be **fast** and **fail-safe** (default to old behavior on error).
- Don't nest flags.

Spring angle: `@ConditionalOnProperty` for static, Togglz/Unleash/LaunchDarkly for dynamic.

## Serverless

Event-driven, scale-to-zero, pay-per-invocation. Good fit for:
- Bursty, unpredictable traffic.
- Glue code (webhooks, scheduled jobs).
- Rarely used endpoints.

Bad fit for:
- Long-running, stateful workloads.
- Latency-sensitive, always-on APIs (cold starts).
- Heavy JVM apps without snapshots/CRaC.

Spring angle: Spring Cloud Function + AWS Lambda adapter. Cold start is the main trade-off.

## Strategy Comparison

| Strategy | Rollback speed | Extra infra | Traffic control | DB compat needed |
|---|---|---|---|---|
| Rolling | Slow (redeploy) | None | None | Yes (both versions run) |
| Blue-Green | Instant (router flip) | 2x | Full | Yes (both run) |
| Canary | Fast (remove canary) | ~10-50% | Partial | Yes |
| Shadow | N/A (no user traffic) | 2x | None | Strict (no writes) |
| Feature Flags | Instant (toggle) | None | Per-user | Code must handle both |
| Serverless | Fast (deploy) | None | Platform | Yes |

## Choosing a Strategy

| Situation | Strategy |
|---|---|
| Simple stateless service, low risk | Rolling |
| High-risk change, need instant rollback | Blue-Green |
| Can't test in staging, need real traffic | Canary |
| Rewrite, need to validate at scale | Shadow (with side-effect isolation) |
| Long-lived branches, dark launches | Feature flags |
| Bursty, event-driven workloads | Serverless |

**Default:** rolling + feature flags. Add canary when you have observability per version. Add blue-green when rollback speed is critical.

## App-Level Requirements

For any of these to work, the app must cooperate:

| Requirement | Spring config |
|---|---|
| Graceful shutdown | `server.shutdown=graceful`, `spring.lifecycle.timeout-per-shutdown-phase=30s` |
| Readiness probe | `management.endpoint.health.probes.enabled=true` |
| Liveness probe | `management.endpoint.health.probes.enabled=true` |
| Version label | `management.metrics.tags.version=${VERSION}` |
| Externalized config | `spring.config.import=configserver:` or env vars |
| Zero-downtime DB migrations | Flyway/Liquibase with expand-contract |
| Feature flags | Togglz/Unleash/LaunchDarkly SDK |

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
management:
  endpoint.health.probes.enabled: true
  metrics.tags:
    version: ${VERSION:unknown}
```

## Tricky Corners ⚠️

- **Rolling update requires bidirectional compatibility.** Old and new versions run simultaneously.
- **Blue-Green requires DB compatibility across both versions** during the rollback window.
- **Canary requires per-version observability** — otherwise you can't tell if the canary is bad.
- **Shadow traffic must not have side effects.** Mirroring writes = corruption.
- **Feature flags need an owner and expiry**, or they become permanent debt.
- **Graceful shutdown must be longer than the longest in-flight request.**
- **Readiness probes must fail during shutdown** so the LB stops sending traffic.
- **DB migrations must be backward-compatible** with the previous app version (expand-contract).
- **Feature flag defaults must be safe.** If the flag service is down, default to old behavior.
- **Serverless cold starts kill latency SLOs** for JVM apps unless you use snapshots/CRaC.

## Common Pitfalls

- Rolling update with a breaking DB migration — old version crashes.
- Blue-green without a rollback window — DB already migrated forward.
- Canary without per-version metrics — no signal, just slower rollout.
- Shadow deployment with writes — data corruption.
- Feature flags without cleanup — hundreds of stale flags.
- No graceful shutdown — requests dropped during rollout.
- Readiness probe doesn't fail during shutdown — LB keeps sending traffic to dying pods.
- Version label not in metrics — can't slice by version.
- Feature flag default = new behavior — outage if flag service is down.

## Key Interview Tips

- Lead with **"deploy and release are different problems: strategies control traffic, flags control behavior."**
- For "how do you roll back?", answer **"blue-green flips the router instantly; canary removes the canary; flags toggle behavior."**
- For "how do you do zero-downtime deploys?", answer **"rolling update + graceful shutdown + readiness probe + backward-compatible schema."**
- For "when canary vs blue-green?", answer **"canary for partial real traffic validation, blue-green for full cutover with instant rollback."**
- For "when shadow?", answer **"for rewrites or algorithm changes where you want production traffic without user impact — but side effects must be isolated."**
- For "how do you decouple deploy from release?", answer **"feature flags with owners, expiry dates, and safe defaults."**
- Always mention **DB migration compatibility (expand-contract)** as the constraint nobody thinks about until it bites.

## Related

- [Microservices Patterns index](index.md)
- [Reliability](reliability.md)
- [Observability](observability.md)
- [Security](security.md)
- [Kubernetes → Production Essentials](../kubernetes/production-essentials.md)
- [System Design Depth → Rollout Strategies](../system-design-depth/rollout-strategies.md)
- [Architecture → Evolution & Migration](../architecture/evolution-and-migration.md)