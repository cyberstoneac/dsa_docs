# Decision Frameworks

> **Context:** At lead level, your primary output is decisions — made, defended, communicated, and revisited. This file gives you frameworks for making technical decisions under uncertainty and defending them to engineers, product, and executives.

## Mental Model

A decision is a choice among alternatives, made under constraints, with imperfect information. Most technical decisions are **two-way doors** (reversible); a few are **one-way doors** (irreversible). The framework you use should match the door.

```d2
direction: right

door: Decision
two: "Two-way door\\n(reversible, cheap)"
one: "One-way door\\n(irreversible, expensive)"

two -> one
```

| Door | Examples | Process |
|---|---|---|
| Two-way | Library choice, config default, API response shape | Decide fast, delegate, revisit |
| One-way | Data model, service boundary, auth model, database engine | Slow down, consult, document |

**Rule:** match the decision's weight to the decision's size. Over-processing a two-way door slows the team. Under-processing a one-way door causes years of pain.

## The Decision Process

```d2
direction: right

frame: 1. Frame
options: 2. Options
trade: 3. Trade-offs
decide: 4. Decide
document: 5. Document
revisit: 6. Revisit

frame -> options
options -> trade
trade -> decide
decide -> document
document -> revisit
```

### 1. Frame the problem

- What is the actual problem? (not the solution someone already proposed)
- Who is affected? (users, teams, ops, finance)
- What are the constraints? (time, team, budget, compliance, existing systems)
- What does success look like? (measurable)

**Anti-pattern:** jumping to solutions. "Should we use Kafka or RabbitMQ?" is a solution question, not a problem. The problem might be "how do we decouple order processing from the checkout API?"

### 2. Enumerate options

- **At least 3.** Two is a binary; three forces real consideration.
- Include **"do nothing"** as an option.
- Include **"do the simplest thing"** — it's often right.

**Rule:** if you can't name 3 options, you don't understand the problem well enough.

### 3. Analyze trade-offs

For each option, evaluate against the criteria that matter for **this** decision:

| Criterion | Question |
|---|---|
| Correctness | Does it solve the problem? |
| Simplicity | How much complexity does it add? |
| Reversibility | How hard to change later? |
| Team fit | Does the team know this tech? |
| Operational cost | Who runs it? |
| Cost | Infrastructure, licensing, dev time |
| Time | How long to implement? |
| Risk | What could go wrong? |
| Scalability | Does it fit 2-year projections? |
| Compliance | Does it meet regulatory needs? |

**Rule:** criteria should be **specific to the decision**, not a generic checklist. A decision about a database weights durability and query patterns heavily; a decision about logging weights operational cost.

### 4. Decide

- **Name the decision owner.** One person, not a committee.
- **Make the call, don't defer.**
- **State the rationale** — the "why" is more important than the "what."
- **Note the confidence level** — high / medium / low.

### 5. Document

- Write an **ADR** (Architecture Decision Record).
- Include context, decision, alternatives, consequences.
- Commit it to the repo, near the code it affects.

See [`adrs-and-documentation.md`](adrs-and-documentation.md).

### 6. Revisit

- Set a **review date** or **trigger** ("revisit when X").
- Update or supersede the ADR if the decision changes.
- Never delete old ADRs — they're history.

## Frameworks

### 1. Trade-off Matrix

Simple, visual, decisive.

| Option | Correctness | Simplicity | Time | Team fit | Ops cost | Total |
|---|---|---|---|---|---|---|
| Option A | 5 | 4 | 3 | 5 | 4 | 21 |
| Option B | 4 | 5 | 4 | 4 | 5 | 22 |
| Option C | 5 | 3 | 2 | 3 | 3 | 16 |

**Caveat:** scores are subjective. The value is in the **conversation**, not the numbers. If two options are within 10%, the decision is close — pick on reversibility or team fit.

### 2. Cost of Delay / WSJF

For prioritization decisions.

```
WSJF = Cost of Delay / Job Size
```

Cost of Delay = user value + time value + risk reduction + opportunity enablement.

High WSJF = do it first. Low WSJF = defer.

### 3. The Reversibility Test

| Question | Yes | No |
|---|---|---|
| Can we undo this in a sprint? | Two-way door — decide fast | One-way door — slow down |
| Is the cost to change < 1 week? | Delegate to team | Own it yourself |
| Does it affect only our team? | Team decides | Cross-team consultation |

### 4. The "Second-Order Effects" Test

Ask: if we do X, what happens next? And then what?

Example:
- "We'll add a cache." → cache invalidation, consistency issues, operational surface.
- "We'll add a service." → deploy pipeline, observability, on-call, contract.
- "We'll adopt Kubernetes." → training, tooling, cluster ops, networking.

**Rule:** name at least two second-order effects for any non-trivial decision.

### 5. The "What Would Break First?" Test

Under load, failure, or growth, what fails first?



- Under 10x load?
- If a region goes down?
- If the team doubles?
- If a key dependency fails?

If you can't answer, you don't understand the option well enough.

### 6. The "Do Nothing" Baseline

Always compare against "do nothing." Sometimes the right answer is to wait.

**When do nothing is right:**
- Problem is not urgent.
- More information will arrive soon.
- Cost of change is high and benefit is speculative.
- Team has higher-priority work.

## Defending a Decision

Once made, you must defend it — to engineers, product, and executives. Each audience needs a different framing.

### To engineers

- **Technical rationale:** why this over alternatives.
- **Consequences:** what it enables, what it constrains.
- **Reversibility:** how we'd change it if wrong.
- **Reference:** ADR, benchmark, or precedent.

### To product

- **Business outcome:** what this unlocks.
- **Time and cost:** what it takes to build.
- **Risk:** what could go wrong.
- **Trade-offs:** what we're not doing.

### To executives

- **One-line summary:** what we're doing and why.
- **Business impact:** cost, revenue, risk, speed.
- **Alternatives:** what we considered.
- **Ask:** what we need (budget, headcount, time).

**Rule:** lead with the **conclusion**, then the **rationale**, then the **alternatives**. Executives read the first sentence.

## Disagreeing with a Decision

You will disagree with decisions made above you. Handle it well:



1. **Understand the context.** Ask why before pushing back.
2. **State your concern** with evidence, not opinion.
3. **Propose an alternative** with trade-offs.
4. **Make your case once, clearly.**
5. **If overruled, disagree and commit.** No passive resistance.
6. **Document your dissent** if the decision is significant.

**Rule:** disagree in the room, commit outside it. Passive resistance is corrosive.

## When to Delegate a Decision

| Delegate when | Own it yourself when |
|---|---|
| Reversible | Irreversible |
| Low blast radius | High blast radius |
| Team has context | Cross-team impact |
| Within existing patterns | Breaks a pattern |
| Time-sensitive | Strategic |

**Rule:** delegate decisions to grow engineers. Own decisions that shape the system.

## Tricky Corners ⚠️

- **Analysis paralysis is a decision.** Not deciding is deciding to drift.
- **Bikeshedding:** time spent on a decision should be proportional to its impact.
- **HiPPO** (Highest Paid Person's Opinion) kills good decisions — use frameworks.
- **Sunk cost fallacy:** "we already built X" is not a reason to continue.
- **Decision fatigue:** reduce the number of decisions by codifying standards.
- **Reversibility is not free.** Two-way doors become one-way if you build on top of them.
- **The framework doesn't decide.** It clarifies. The human decides.
- **Confidence ≠ correctness.** A confident wrong decision is worse than a hesitant right one.
- **Second-order effects dominate long-term outcomes.**
- **Documented decisions can be revisited. Undocumented decisions get re-debated forever.**

## Common Pitfalls

- Jumping to a solution before framing the problem.
- Considering only one option.
- Ignoring the "do nothing" baseline.
- Deciding by consensus (slow, lowest-common-denominator).
- Deciding by authority (HiPPO).
- Not documenting decisions → repeated debate.
- Not revisiting decisions → outdated architecture.
- Over-processing reversible decisions.
- Under-processing irreversible decisions.
- Ignoring second-order effects.

## Key Interview Tips

- Lead with **"decisions are two-way or one-way doors — match the process to the weight."**
- For "how do you make a technical decision?", walk the 6-step process: **frame → options → trade-offs → decide → document → revisit.**
- For "how do you defend a decision?", answer with **audience-specific framing: engineers (rationale), product (business outcome), exec (one-liner + ask).**
- For "what if you're overruled?", answer **"disagree and commit; document the dissent if it's significant."**
- For "how do you involve the team?", answer **"delegate reversible decisions, own irreversible ones, use RFCs and ADRs to make decisions visible."**
- Name a **framework** (trade-off matrix, WSJF, reversibility test) to show rigor.
- Always name **second-order effects** to show you think beyond the immediate.

## Related

- [Architecture index](index.md)
- [Trade-off Analysis](trade-off-analysis.md)
- [Evolution & Migration](evolution-and-migration.md)
- [ADRs & Documentation](adrs-and-documentation.md)
- [Leadership → Technical Debt](../leadership/technical-debt.md)