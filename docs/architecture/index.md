# Architecture

> **Context:** At tech lead level, architecture is not just boxes and arrows — it is the set of **decisions that are expensive to change**. Your job is to make those decisions deliberately, document them, and evolve them without stopping delivery.

## Mental Model

Architecture is the set of **decisions that constrain other decisions**. A choice of database is architecture. A choice of variable name is not. The dividing line is **reversibility**:

```d2
direction: right

decision: Decision
reversible: "Reversible\\n(cheap to change)"
irreversible: "Irreversible\\n(expensive to change)"
arch: "Architecture\\n(the irreversible set)"

reversible -> irreversible
irreversible -> arch
```

| Reversible | Irreversible (or expensive) |
|---|---|
| Framework version | Database engine |
| API response shape | Data model / schema |
| Log format | Auth model |
| Internal module layout | Service boundaries |
| Feature flag default | Deployment topology |

**Rule:** spend your political capital on the irreversible decisions. Let the team move fast on the reversible ones.

## What Changes at Lead Level

| IC architect | Lead architect |
|---|---|
| Designs the solution | Frames the problem and the constraints |
| Optimizes for elegance | Optimizes for evolvability and team throughput |
| Decides | Facilitates decisions and owns the outcome |
| Documents after the fact | Documents before, so others can decide |
| Focus on today's system | Focus on 2-year trajectory |
| One system | Portfolio of systems across teams |

At lead level you are not the architect of one system — you are the **steward of a portfolio** of decisions across teams.

## The Three Questions

Every architecture conversation reduces to three questions:



1. **What problem are we solving?** (the real one, not the stated one)
2. **What are the constraints?** (team, time, money, compliance, existing systems)
3. **What are the trade-offs?** (there are always trade-offs)

If you can't answer #1 and #2, you're not ready to answer #3.

## Domains of Architecture

```d2
direction: right

archStyle: "Style\nmonolith vs microservices\nlayered vs hexagonal\nevent-driven vs request-driven"
data: "Data\nSQL vs NoSQL\nnormalized vs denormalized\nsync vs async consistency"
integration: "Integration\nsync (REST, gRPC)\nasync (Kafka, queues)\nshared-nothing vs shared-data"
deploy: "Deployment\ncontainers vs serverless\nsingle-region vs multi-region\nstateful vs stateless"
cross: "Cross-cutting\nauth model\nobservability\nconfiguration\nmulti-tenancy"

archStyle -> data
data -> integration
integration -> deploy
deploy -> cross
```

## The Architecture Files

| File | Focus |
|---|---|
| `decision-frameworks.md` | How to make and defend technical decisions |
| `trade-off-analysis.md` | Monolith vs microservices, SQL vs NoSQL, sync vs async, stateful vs stateless, batch vs stream |
| `evolution-and-migration.md` | Strangler fig, incremental refactoring, expand-contract, multi-phase migrations |
| `adrs-and-documentation.md` | Architecture Decision Records, C4 diagrams, diagrams-as-code |

## Working with Existing Architecture

At lead level you rarely start from a blank page. You inherit a system. Three modes:

| Mode | When | Practice |
|---|---|---|
| **Steward** | System is healthy | Maintain, evolve, enforce standards |
| **Surgeon** | Specific pain points | Targeted refactoring, not rewrite |
| **Rebuilder** | System is fundamentally unfit | Strangler fig, parallel run, phased migration |

**Rule:** default to steward. Surgeon when necessary. Rebuilder only with executive sponsorship and a multi-quarter plan.

## Architecture Principles

Every organization needs a small set of principles. Not platitudes — principles with teeth.

Example set:



1. **Prefer boring technology.** Innovation tokens are scarce; spend them on the product, not the stack.
2. **Make it reversible.** Prefer decisions you can undo cheaply.
3. **Design for failure.** Every remote call can fail; every dependency is a liability.
4. **Default to async across service boundaries.** Sync only when the caller needs the result.
5. **Data is the hardest thing to change.** Get the data model right before the API.
6. **Observability is a feature.** If you can't see it, you can't operate it.
7. **Document decisions, not just designs.** ADRs are the institutional memory.
8. **Boundaries follow teams.** Conway's Law is a design tool.

**Rule:** fewer than 10 principles. Each one must be falsifiable — you should be able to name a decision that violates it.

## Architecture as a Team Sport

At lead level, architecture is not done to the team. It is done with the team.

| Practice | Why |
|---|---|
| Design reviews | Share context, catch issues early |
| RFCs / ADRs | Document decisions, invite feedback |
| Architecture guild | Cross-team alignment without a central bottleneck |
| Rotation into architecture | Grow senior engineers |
| "Two-way door" delegation | Teams decide reversible things themselves |

**Rule:** the lead sets the guardrails; teams make decisions inside them.

## Anti-Patterns to Name

- **Resume-driven development** — adopting tech because it's exciting.
- **Astronaut architecture** — designing for scale you don't have.
- **Architecture by committee** — no one owns the outcome.
- **Distributed monolith** — microservices that deploy together.
- **God service** — one service that knows everything.
- **Ivory tower architecture** — designed without consulting the teams who build it.
- **Documentation theater** — beautiful diagrams, no actual decisions.
- **Big design up front** — analysis paralysis.

## Tricky Corners ⚠️

- **Architecture is decisions, not diagrams.** Diagrams document decisions; they are not the decision.
- **Trade-offs are unavoidable.** If someone claims a decision has no downside, they haven't found it yet.
- **The best architecture is boring.** Innovation budget goes to the product.
- **Evolvability beats perfection.** Systems that can change outlive systems that are "right."
- **Architecture that ignores teams will fail.** Conway's Law wins.
- **Documenting is not the same as deciding.** Many ADRs, no decisions = drift.
- **You will be wrong sometimes.** Design for reversibility; revisit decisions with ADRs.
- **Scale is not a goal.** Fit-for-purpose is.
- **Big rewrites fail.** Strangler fig wins.

## Common Pitfalls

- Deciding too much too early (over-design).
- Deciding too little too late (drift, rework).
- Ignoring team boundaries when defining services.
- Optimizing for scale you don't have.
- Ignoring operational costs (who runs this at 3am?).
- Not documenting decisions — repeated debates.
- Confusing architecture with tools.
- Confusing architecture with the org chart.
- Treating architecture as one person's job.

## Key Interview Tips

- Lead with **"architecture is the set of decisions that are expensive to change."**
- For "how do you make architecture decisions?", answer **"frame the problem, list constraints, enumerate options, analyze trade-offs, decide, document (ADR), revisit."**
- For "how do you decide between X and Y?", answer **"it depends on the forces: team, time, scale, consistency, operational cost. Here's how I'd reason through it."**
- For "how do you handle existing architecture you disagree with?", answer **"understand the context first, then propose incremental evolution via strangler fig, not a rewrite."**
- For "how do you involve the team?", answer **"design reviews, RFCs, delegation of reversible decisions, and growing architects through rotation."**
- Name at least one **anti-pattern** and how you'd avoid it.
- Always connect architecture to **business outcomes and team throughput**.

## Related

- [Decision Frameworks](decision-frameworks.md)
- [Trade-off Analysis](trade-off-analysis.md)
- [Evolution & Migration](evolution-and-migration.md)
- [ADRs & Documentation](adrs-and-documentation.md)
- [Microservices Patterns](../microservices-patterns/index.md)
- [System Design Depth](../system-design-depth/index.md)