# System Design Depth

> **Context:** The 57 system design problems in the main section cover the *what* — the boxes, arrows, and data flows. This nested section covers the *how well* — the depth you're expected to show at 13 YOE: non-functional requirements, failure modes, evolution over years, capacity math, and rollout strategy. This is where you separate from senior candidates.

## Mental Model

A senior system design answer describes a system. A **lead** system design answer describes a system **and its trajectory**: how it behaves under stress, how it fails, how it grows, and how it changes.

```d2
direction: right

sd: System Design
basic: "Basic {\\n  requirements\\n  high-level design\\n  APIs\\n  data model"
depth: "Depth {\\n  NFRs\\n  failure modes\\n  evolution\\n  capacity\\n  rollout"

basic -> depth
```

The five depth files:

| File | What it adds |
|---|---|
| `non-functional-requirements.md` | Latency, availability, consistency, cost, security — elicited and prioritized |
| `failure-modes.md` | Cascading failures, partial failures, timeouts, recovery, chaos engineering |
| `evolution-stories.md` | "How would you evolve X over 2 years?" |
| `capacity-planning.md` | Back-of-envelope at production scale, growth modeling |
| `rollout-strategies.md` | Feature flags, canary, blue-green, dark launch, A/B testing |

## What "Depth" Looks Like in an Interview

The interviewer is probing for one thing: **can you reason about a system you can't fully see?**

| Shallow answer | Deep answer |
|---|---|
| "We'll use Kafka." | "We'll use Kafka with 24 partitions, RF 3, min ISR 2, acks=all, keyed by orderId for per-order ordering; lag SLO 30s; DLQ + retry topics." |
| "We'll use a cache." | "Redis with a 60s TTL, cache-aside, stampede protection via single-flight, and invalidation on write." |
| "We'll scale horizontally." | "Stateless services behind an ALB; DB is the bottleneck — we'll shard by tenant once writes exceed 5k/s." |
| "We'll handle failures with retries." | "Retries with exponential backoff + jitter, capped at 3, only on idempotent operations; circuit breaker per downstream." |
| "We'll monitor it." | "RED metrics per endpoint, distributed traces with tail-based error sampling, DLQ depth alerts, consumer lag SLO." |

**Rule:** in every answer, add the **quantity**, the **failure mode**, or the **trade-off**.

## The Depth Checklist

For any system design question, walk through these at the end:

```d2
direction: right

nfr: "NFRs {\\n  latency target?\\n  availability target?\\n  consistency model?\\n  cost ceiling?\\n  security/compliance?"
fail: "Failure {\\n  what fails first?\\n  partial failure?\\n  cascading?\\n  recovery?"
evolve: "Evolution {\\n  10x load?\\n  new region?\\n  new feature?\\n  team grows?"
cap: "Capacity {\\n  QPS?\\n  storage?\\n  bandwidth?\\n  brokers/servers?"
roll: "Rollout {\\n  deploy strategy?\\n  flags?\\n  canary?\\n  rollback?"

nfr -> fail
fail -> evolve
evolve -> cap
cap -> roll
```

## How to Use This Section

- **During interview prep:** read `non-functional-requirements.md` and `failure-modes.md` before any system design mock.
- **During a mock:** use `capacity-planning.md` for the numbers, `evolution-stories.md` for the "what if it grows" question.
- **For real work:** `rollout-strategies.md` is the day-to-day playbook.

## The Lead's Framing

At 13 YOE, the interviewer is not testing whether you can design a URL shortener. They are testing whether you can:



1. **Elicit** the right requirements (not assume them).
2. **Quantify** trade-offs.
3. **Reason about failure** without panicking.
4. **Plan for evolution** beyond the initial version.
5. **Communicate** decisions clearly.

Every file in this section reinforces one of those.

## Related

- [Non-Functional Requirements](non-functional-requirements.md)
- [Failure Modes](failure-modes.md)
- [Evolution Stories](evolution-stories.md)
- [Capacity Planning](capacity-planning.md)
- [Rollout Strategies](rollout-strategies.md)
- [System Design → 57 problems](../system-design/index.md)
- [Architecture → Trade-off Analysis](../architecture/trade-off-analysis.md)