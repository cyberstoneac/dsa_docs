# ADRs & Documentation

> **Context:** At lead level, your decisions outlive your tenure. Documentation is how the next engineer — or the next version of you — understands **why** the system is the way it is. Architecture Decision Records (ADRs) are the highest-leverage documentation you can produce.

## Mental Model

Documentation has three jobs:



1. **Preserve context** — why we did this, not just what we did.
2. **Enable decisions** — help others decide without re-debating.
3. **Onboard people** — reduce time to productivity.

```d2
direction: right

docs: Documentation
adr: "ADRs\\n(decisions + rationale)"
c4: "C4 Diagrams\\n(system structure)"
runbooks: "Runbooks\\n(operational procedures)"
onboarding: "Onboarding Guides\\n(getting started)"
code: "Inline Docs\\n(what the code does)"

adr -> c4
c4 -> runbooks
runbooks -> onboarding
onboarding -> code
```

The most valuable documentation is **decision rationale** — the "why." Code tells you what; tests tell you what should happen; ADRs tell you why it's this way and not another way.

## Architecture Decision Records (ADRs)

An ADR is a short, timestamped document capturing a single decision.

### Template (Michael Nygard)

```markdown
# ADR-0042: Use PostgreSQL as the primary datastore for Order Service

## Status
Accepted (2026-06-14). Supersedes ADR-0017 (MongoDB for orders).

## Context
The Order Service currently uses MongoDB for order documents. We are
experiencing:
- Difficulty enforcing referential integrity across orders and line items.
- Complex application-side joins for reporting.
- Schema drift between environments.

## Decision
We will migrate Order Service to PostgreSQL, with a normalized schema and
foreign keys. Reads that require denormalization will be served by a
materialized read model (CQRS) if needed.

## Consequences
### Positive
- Referential integrity enforced by the database.
- Single query language for transactional and analytical queries.
- Easier migrations via Flyway.
- Team familiarity is high.

### Negative
- Horizontal write scale is harder than MongoDB; we accept this given
  current write volume (~500 writes/sec, well within Postgres capacity).
- Migration cost: ~6 weeks of engineering.
- Short-term dual-write complexity during migration.

## Alternatives considered
- **Stay on MongoDB**: rejected due to referential integrity pain.
- **Use DynamoDB**: rejected due to vendor lock-in and access-pattern rigidity.
- **Use a mix (Postgres + Mongo)**: rejected due to operational complexity.

## References
- Migration plan: `docs/migrations/orders-postgres.md`
- Benchmark: `benchmarks/orders-postgres-2026-05.md`
```

### ADR rules

- **One decision per ADR.** Not a design doc.
- **Short.** One page.
- **Numbered sequentially.** Never reused.
- **Status is explicit.** Proposed / Accepted / Deprecated / Superseded.
- **Supersede, don't delete.** Old ADRs are history.
- **Stored with the code** (`docs/adr/` or `architecture/decisions/`).
- **Linked from the code** they affect where practical.

### When to write an ADR

Write one when:
- The decision is **irreversible or expensive to change**.
- Multiple teams are affected.
- The decision is **likely to be questioned** later.
- You chose **against** the obvious option.

Do **not** write one for:
- Routine library updates.
- Reversible decisions with small blast radius.
- Decisions that follow existing patterns.

## C4 Model

Four levels of diagram, each with a specific audience.

| Level | Audience | Shows |
|---|---|---|
| **Context** | Everyone | System + external actors |
| **Container** | Technical stakeholders | Deployable units (services, DBs, queues) |
| **Component** | Developers | Internal structure of a container |
| **Code** | Developers (rare) | Classes, functions |

```d2
direction: right

ctx: "Level 1: Context {\\n  user: Customer\\n  sys: Order System\\n  ext: Payment Provider"
cont: "Level 2: Container {\\n  api: Order API\\n  db: Orders DB\\n  kafka: Kafka\\n  worker: Order Worker"
comp: "Level 3: Component {\\n  controller: OrderController\\n  service: OrderService\\n  repo: OrderRepository"

sys -> api
api -> controller
```

### C4 rules

- **One diagram per level.** Don't mix levels.
- **Every box has a name and a type.** No anonymous boxes.
- **Every arrow has a label.** What flows, and in which direction.
- **Show external systems explicitly.** Boundaries matter.
- **Level 4 is rarely needed.** Code diagrams go stale; use them sparingly.

## Diagrams as Code

Diagrams should be **versioned, reviewable, and regenerable**, just like code.

| Tool | Best for |
|---|---|
| **D2** | Modern, declarative, good layouts |
| **PlantUML** | Sequence, class, activity diagrams |
| **Mermaid** | Markdown-native, GitHub-friendly |
| **Structurizr** | C4 as code |
| **Excalidraw** | Whiteboarding (not version-controlled well) |

**Rules:**
- Diagrams live in the repo, next to the code they describe.
- Diagrams are **generated in CI** (catch breakage).
- No hand-drawn images committed to git (they can't be diffed).
- Update diagrams when the system changes — same PR.

## Runbooks

Operational procedures for on-call engineers.

A runbook answers:
- **What is this alert?**
- **What does it mean?**
- **How do I verify it?**
- **What are the first 3 things to check?**
- **Who to escalate to?**
- **How to mitigate?**

Example:

```markdown
# Runbook: Checkout Error Rate High

## Alert
`checkout_error_rate > 1% for 5 minutes`

## Meaning
Checkout requests are failing more than normal.

## First checks
1. Is it a deploy? Check `kubectl rollout history checkout-service`.
2. Is a downstream down? Check payment-service and inventory-service dashboards.
3. Is it a DB issue? Check connection pool and slow query dashboard.

## Mitigation
- Recent deploy → rollback.
- Downstream down → enable fallback flag.
- DB overload → scale read replicas.

## Escalation
- IC on-call: `#incidents`
- Payment team: `@payments-oncall`
```

**Rules:**
- Every alert has a runbook.
- Runbooks are **tested** during incidents.
- Runbooks live near the code, version-controlled.

## Onboarding Guides

Reduce time-to-first-PR for new engineers.

Contents:
- **Dev environment setup** (step by step, tested on fresh machine).
- **Architecture overview** (link to C4 diagrams).
- **Key repositories** and their purposes.
- **How to run tests, deploy, and debug.**
- **Who to ask about what.**
- **First-week checklist** (small PRs, shadowing, etc.).

**Rule:** a new engineer should be able to ship a small PR within their first week. If not, the onboarding guide is the bug.

## Inline Documentation

Code comments should explain **why**, not **what**.

| Bad comment | Good comment |
|---|---|
| `// increment i by 1` | `// Skip the first element — it's the header row` |
| `// call the API` | `// Retry because the upstream is flaky during market open` |
| `// null check` | `// Null when the user hasn't set a preference yet; default in caller` |

**Rules:**
- **Names > comments.** A good name replaces most comments.
- **Comment the non-obvious.** Why this hack, why this constant.
- **Delete commented-out code.** Git remembers.
- **Update comments with code.** Stale comments lie.

## Documentation Anti-Patterns

| Anti-pattern | Why it fails |
|---|---|
| **Docs in a separate wiki** | Drifts from code, no PR review |
| **Diagrams as images** | Can't diff, can't review, go stale |
| **No ADRs** | Decisions re-debated forever |
| **ADRs as design docs** | Too long, one decision per ADR |
| **Stale runbooks** | Worse than no runbook |
| **Onboarding guide untested** | New hires flail for weeks |
| **Inline comments that restate code** | Noise |
| **No ownership** | Nobody updates anything |

## Ownership

Every document has an owner:



- **ADRs:** the team that made the decision.
- **C4 diagrams:** the architecture group or team owning the system.
- **Runbooks:** the on-call team.
- **Onboarding:** the team lead.

**Rule:** documentation without an owner is documentation that will rot.

## Tricky Corners ⚠️

- **ADRs are history, not truth.** A superseded ADR is still valuable.
- **Do not delete ADRs.** Mark them superseded.
- **Diagrams are code.** Version them; generate them in CI.
- **"We'll document later" is a lie.** Document at the moment of decision.
- **Runbooks go stale fastest.** Re-test them during incidents.
- **Onboarding guides need testing.** Have a new hire follow them verbatim.
- **Comments rot.** Names + tests are more durable.
- **Documentation is not a deliverable, it's a habit.**
- **ADRs must be findable.** Link from code, PRs, and README.
- **Documentation of a system that no longer exists should be archived, not updated.**

## Common Pitfalls

- No ADRs.
- ADRs written after the fact.
- ADRs treated as design docs.
- Diagrams in a wiki, not in the repo.
- Diagrams as PNGs (can't diff).
- Runbooks outdated.
- Onboarding guides untested.
- Comments that restate code.
- Documentation with no owner.
- "The docs are in Confluence" but no one knows where.

## Key Interview Tips

- Lead with **"the most valuable documentation is the why — ADRs capture decisions and rationale."**
- For "how do you document architecture?", answer **"ADRs for decisions, C4 for structure, diagrams-as-code for versioning, runbooks for operations."**
- For "how do you keep docs from going stale?", answer **"docs live in the repo, owned, reviewed in PRs, and generated in CI."**
- For "how do you onboard engineers?", answer **"tested onboarding guide, first-PR-in-a-week goal, ADRs and C4 as context."**
- For "what do you write down?", answer **"irreversible decisions, cross-team interfaces, operational procedures, and onboarding paths."**
- For "how do you avoid documentation theater?", answer **"one decision per ADR, short, owned, linked from code, generated diagrams."**
- Always mention **ownership** as the key to keeping docs alive.

## Related

- [Architecture index](index.md)
- [Decision Frameworks](decision-frameworks.md)
- [Evolution & Migration](evolution-and-migration.md)
- [Leadership → Technical Debt](../leadership/technical-debt.md)
- [Leadership → Incident Command](../leadership/incident-command.md)