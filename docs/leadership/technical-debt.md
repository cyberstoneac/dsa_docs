# Technical Debt

> **Context:** At lead level, technical debt is not "bad code." It is a **financial metaphor** — a loan taken for speed, with interest paid forever. Your job is to make it visible, prioritize it against features, and negotiate the trade-off with stakeholders in their language.

## Mental Model

Ward Cunningham's original metaphor: shipping a feature on a shaky foundation is like taking a loan. You go faster **now**, but you pay **interest** (slower changes, more bugs, more onboarding time) until you "refactor" (repay the principal).

Not all debt is bad. **Deliberate, prudent debt** is a strategic choice. **Accidental, reckless debt** is a mistake.

```d2
direction: right

debt: Technical Debt
deliberate: Deliberate
accidental: Accidental

deliberate -> accidental
```

| | Prudent | Reckless |
|---|---|---|
| **Deliberate** | "We ship v1 without sharding; revisit at 10k QPS." | "We don't have time for tests." |
| **Accidental** | "We didn't know sharding was needed yet." | "We don't know what a shard is." |

The lead's job: make debt **deliberate and visible** where possible, and reduce **reckless** debt relentlessly.

## The Four Quadrants

| Quadrant | Example | Action |
|---|---|---|
| Deliberate + prudent | Known shortcuts with a plan to revisit | Track, schedule the revisit |
| Deliberate + reckless | Skipping tests, ignoring security | Push back, block |
| Accidental + prudent | Learned as you scaled | Refactor when it bites |
| Accidental + reckless | Poor practices, no standards | Coach, set standards, refactor |

## Types of Debt

Not all debt is code debt. Name it precisely:

| Type | Example | Symptom |
|---|---|---|
| Code debt | Duplicated logic, god classes | Hard to change |
| Architecture debt | Monolith with unclear boundaries | Cross-cutting changes |
| Test debt | Missing tests, flaky tests | Fear of change |
| Documentation debt | Missing ADRs, stale READMEs | Slow onboarding |
| Infrastructure debt | Manual deploys, brittle CI | Toil, incidents |
| Dependency debt | EOL libraries, unpinned versions | Security, breakage |
| Data debt | No schema versioning, no migrations | Data loss risk |
| Observability debt | No tracing, no metrics | Blind during incidents |
| Org debt | Unclear ownership, unclear decision rights | Thrash |
| Process debt | 3-week release cycles, manual QA | Slow delivery |

**Rule:** "we have tech debt" is not useful. Name the type, the location, and the cost.

## Making Debt Visible

You cannot prioritize what you cannot see. The lead's job is to surface debt in a form stakeholders can act on.

### The Debt Register

A living document (a spreadsheet, a Jira epic, a markdown file) with:

| Field | Example |
|---|---|
| ID | DEBT-014 |
| Description | `OrderService` has 3 copies of tax calculation logic |
| Type | Code |
| Location | `OrderService`, `InvoiceService`, `ReportJob` |
| Impact | Bug risk in tax calc; ~2 days per change to keep in sync |
| Likelihood | Medium — changes ~monthly |
| Interest | ~1 day per month of extra work |
| Principal | 5 days to consolidate |
| Payoff | ~6 months |
| Priority | P2 |

This turns debt from "quality" into "cost/benefit."

### Quantifying interest

Make the cost concrete:



- **Velocity tax:** "We spend ~20% of each sprint on rework from flaky tests."
- **Incident tax:** "3 of last 6 incidents traced to this module."
- **Onboarding tax:** "New engineers take 6 weeks to be productive; 3 of those are undocumented config."
- **Opportunity cost:** "We can't ship feature X without first fixing Y."

Stakeholders don't care about "clean code." They care about **slower delivery, more incidents, higher cost**.

## Prioritizing Debt

Use the same frameworks you use for features. Debt competes for the same capacity.

### Prioritization criteria

| Factor | Question |
|---|---|
| Interest rate | How much does this slow us down per sprint? |
| Blast radius | What breaks if this fails? |
| Risk | Security, data loss, compliance? |
| Frequency | How often do we touch this code? |
| Onboarding | Does this affect new hires? |
| Strategic alignment | Does fixing this unblock a roadmap item? |
| Payoff period | How long until the fix pays for itself? |
| Effort | Is it a day, a week, or a quarter? |

**High priority when:** high interest + high blast radius + frequently touched + short payoff period.
**Low priority when:** low interest + rarely touched + long payoff + hard to fix.

### The Debt Budget

Two common patterns:



1. **Fixed percentage:** allocate 10–20% of each sprint to debt reduction. Predictable, sustainable.
2. **Tied to features:** "Every feature includes the debt in its area." Keeps the codebase from rotting around hot paths.

**Rule:** a debt budget only works if it is **protected**. The moment it's raided for a "must-have" feature, it stops working.

### Boy Scout Rule

Small, continuous improvements:

> "Leave the code better than you found it."

Fits naturally into feature work — rename a confusing variable, extract a function, add a missing test. Doesn't need a project.

## The Refactor vs. Rewrite Decision

The most dangerous word in engineering is "rewrite."

| Factor | Refactor | Rewrite |
|---|---|---|
| Scope | Incremental | Big bang |
| Risk | Low | High |
| Time | Continuous | Long, uncertain |
| Business value | Continuous | Delayed |
| Behavior preservation | Explicit | Often lost |
| Team morale | Steady | Roller coaster |
| Success rate | High | Historically low |

**Default to refactor.** Use the **Strangler Fig** pattern (see `architecture/evolution-and-migration.md`) to incrementally replace systems.

Rewrite only when:
- The current system is **truly unmaintainable** and its behavior is well understood.
- You can run old and new in parallel.
- You have leadership support and realistic timelines.
- You can migrate incrementally (not big bang).

**Joel Spolsky's rule:** "The single worst strategic mistake that any software company can make: rewriting from scratch."

## Selling Debt Work to Stakeholders

Stakeholders don't fund "refactoring." They fund **outcomes**.

| Instead of | Say |
|---|---|
| "We need to refactor the order service." | "We can cut checkout change time from 2 weeks to 3 days." |
| "Our tests are flaky." | "We're losing 15% of sprint capacity to CI failures." |
| "We need to upgrade Spring." | "We need to upgrade Spring to stay on a supported security baseline by Q4." |
| "The code is messy." | "This module causes 40% of our bugs and is touched weekly." |
| "We should rewrite it." | "We'll incrementally replace the legacy module with a strangler, keeping behavior identical." |

**Rules:**

- **Frame in their currency:** time, cost, risk, customer impact.
- **Quantify** wherever possible.
- **Propose** a plan, not a complaint.
- **Tie to a business goal** the stakeholder already cares about.
- **Show the payoff period.**

## Managing Debt as a Lead

Your role:

| Activity | Practice |
|---|---|
| **Visibility** | Maintain a debt register; review it quarterly |
| **Prioritization** | Include debt in planning alongside features |
| **Budget** | Protect 10–20% capacity for debt |
| **Advocacy** | Sell debt work in business terms, not technical |
| **Standards** | Prevent new reckless debt via reviews, linters, templates |
| **Celebration** | Recognize teams that pay down debt visibly |

**Rule:** if debt is not on the roadmap, it is not a priority. Saying it's important while not scheduling it is a lie — to your team and to yourself.

## Tricky Corners ⚠️

- **Not all debt is bad.** Deliberate debt is a strategic choice. Saying "we have no debt" usually means you're not shipping.
- **"Rewrite" is a red flag.** Almost always a refactor in disguise.
- **Debt is invisible to stakeholders.** Your job is to make the cost concrete.
- **Interest compounds.** A small issue becomes a large one if ignored.
- **Refactoring without tests is dangerous.** Tests first, then refactor.
- **"We'll fix it later" is a promise you must keep.** If it never comes, you've taught the team debt is ignored.
- **A debt budget that gets raided is a debt budget that doesn't exist.**
- **Debt in cold code may never pay off.** Don't refactor what you don't touch.
- **The worst debt is architectural.** It affects every team, every change.
- **Preventing new debt is cheaper than paying down old debt.** Standards, reviews, templates.

## Common Pitfalls

- Treating all debt as equal.
- Letting the debt register go stale.
- Only fixing debt in a "debt sprint," then ignoring it.
- Rewriting instead of refactoring.
- Selling debt as "quality" instead of "cost."
- Not quantifying interest.
- Skipping tests before refactoring.
- Refactoring cold code that nobody touches.
- Debt budget raided by every "urgent" feature.
- Not celebrating when debt is paid — no reinforcement.

## Key Interview Tips

- Lead with **"technical debt is a financial metaphor: deliberate or accidental, prudent or reckless."**
- For "how do you prioritize debt?", answer **"interest rate, blast radius, frequency of change, payoff period — same frameworks as features."**
- For "how do you sell debt to stakeholders?", answer **"frame in their currency: time saved, incidents avoided, cost reduced — not 'clean code.'"**
- For "when do you rewrite?", answer **"almost never — use strangler fig refactoring, run parallel, migrate incrementally. Rewrites historically fail."**
- For "how do you prevent debt?", answer **"standards, reviews, linters, templates — and a protected debt budget so it doesn't accumulate."**
- For "how do you know when debt is too high?", answer **"when interest (rework, incidents, slow onboarding) exceeds the cost of paying it down, and it's on the critical path."**
- Always name a **concrete example** with a **quantified cost**.

## Related

- [Leadership index](index.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Stakeholder Management](stakeholder-management.md)
- [Architecture → Evolution & Migration](../architecture/evolution-and-migration.md)
- [Architecture → ADRs & Documentation](../architecture/adrs-and-documentation.md)