# Code Reviews

> **Context:** At lead level, code review is not just quality control. It is the primary mechanism for **knowledge transfer**, **standard-setting**, and **growing engineers**. Done well, it multiplies the team. Done poorly, it becomes a bottleneck and a source of friction.

## Mental Model

A code review has three jobs, in priority order:



1. **Prevent defects** — catch bugs, edge cases, security issues.
2. **Transfer knowledge** — spread context, teach patterns, align on standards.
3. **Grow the author** — give feedback that makes the next PR better.

Most reviewers optimize only for #1. The best reviewers optimize for all three.

```d2
direction: right

pr: Pull Request
defects: "Prevent Defects\\n(bugs, security, edge cases)"
knowledge: "Transfer Knowledge\\n(context, patterns, standards)"
growth: "Grow the Author\\n(feedback, coaching, trust)"

pr -> defects
pr -> knowledge
pr -> growth
```

## What to Look For (In Priority Order)

| Priority | What | Examples |
|---|---|---|
| 1 | **Correctness** | Logic errors, off-by-one, null handling, race conditions |
| 2 | **Security** | Injection, auth bypass, secrets in code, missing authorization |
| 3 | **Failure modes** | Timeouts, retries, idempotency, error handling, partial failure |
| 4 | **Data integrity** | Migrations, transactions, consistency, schema changes |
| 5 | **Performance** | N+1, unbounded queries, missing indexes, blocking calls |
| 6 | **Readability** | Naming, structure, comments where needed, complexity |
| 7 | **Tests** | Coverage of edge cases, not just happy path |
| 8 | **Observability** | Logging, metrics, tracing on critical paths |
| 9 | **Style** | Enforce via linters, not humans |

**Rule:** style should be automated. If you're commenting on formatting, you've failed to set up linters.

## The Review Mindset

| Instead of | Say |
|---|---|
| "This is wrong." | "This might fail when X — did you consider Y?" |
| "Why did you do it this way?" | "What were the trade-offs you considered here?" |
| "Rewrite this." | "This works, but I'd suggest X for readability because Y." |
| "You missed a test." | "Can we add a test for the case where X?" |
| "I don't like this." | "This doesn't match our pattern for X — can we align?" |

**Principles:**
- **Comment on the code, not the coder.**
- **Explain the why, not just the what.**
- **Distinguish blocking from non-blocking** (`nit:`, `suggestion:`, `blocking:`).
- **Praise good work explicitly** — not just silence on approved PRs.
- **Ask questions instead of making demands** when you're not sure.
- **Assume positive intent.** The author made a choice; understand it before critiquing.

## Blocking vs Non-Blocking Feedback

Use prefixes to make intent clear:

| Prefix | Meaning |
|---|---|
| `blocking:` | Must be addressed before merge |
| `question:` | Needs an answer, may or may not block |
| `suggestion:` | Optional improvement |
| `nit:` | Trivial, author's discretion |
| `praise:` | Positive feedback, keep doing this |

Example:

```
blocking: This query has no LIMIT and will scan the full table. Please add a bounded query.
suggestion: Consider extracting this into a helper — it's used in 3 places now.
nit: `usr` → `user` for consistency with the rest of the file.
praise: The error handling here is exactly the pattern we want. Nice.
```

**Rule:** if it's not `blocking:`, the author can decline. Respect that.

## When to Block

Block when:
- Correctness is at risk (bugs, data loss, security).
- Failure modes are unhandled (no timeout, no retry safety).
- Tests are missing for critical paths.
- The change violates an architectural decision (without discussion).
- The change is too large to review meaningfully.

Do not block for:
- Personal style preferences (use linters).
- "I would have done it differently."
- Minor naming nits.
- Scope creep — file follow-up tickets instead.

## PR Size

The single biggest predictor of review quality is **PR size**. Reviews over ~400 lines lose effectiveness.

| Size | Outcome |
|---|---|
| < 100 lines | Fast, high-quality review |
| 100–400 lines | Good review, reasonable time |
| 400–1000 lines | Reviewer fatigue, missed issues |
| > 1000 lines | Rubber stamp, defects slip through |

**Lead's job:** coach authors to split PRs. Feature flags, refactor-then-behavior, and stacking are your tools.

## Giving Feedback That Lands

Feedback lands when it is:



- **Specific** — "this line" not "the code."
- **Timely** — within hours, not days.
- **Actionable** — says what to do next.
- **Kind** — assumes good intent.
- **Bounded** — focused on the code, not the person.
- **Consistent** — same standards for everyone.

Feedback fails when it is:
- Vague ("this is messy").
- Delayed (a week later, out of context).
- Personal ("you always do this").
- Contradictory (different rules for different people).
- Piled on (20 comments on a 50-line PR).

## Reviewing as a Lead

Your review carries extra weight. Two failure modes:



1. **You review everything** — you become the bottleneck, and the team stops reviewing each other.
2. **You review nothing** — standards drift, and you lose touch with the code.

The right pattern:
- **Review critical paths** — money, auth, data migrations, public APIs.
- **Spot-check** regular PRs.
- **Let senior engineers own reviews** in their domains.
- **Review the reviewers** occasionally — are they giving good feedback?

## The Author's Responsibility

Reviews are a two-way contract. Authors should:



- Keep PRs small.
- Write a clear description: what, why, how to test.
- Self-review before requesting review.
- Respond to every comment (address or explain).
- Not take feedback personally.

Lead's job: model this behavior, and make it explicit in the team's working agreements.

## Review SLAs

| PR type | Target response |
|---|---|
| Small (< 100 lines) | Same day |
| Medium (100–400) | Within 24 hours |
| Large (> 400) | Within 48 hours (or request split) |
| Urgent (incident fix) | Immediate |

**Rule:** if a PR sits for more than 24 hours, the team has a review bottleneck. Fix the process, not the PR.

## Tricky Corners ⚠️

- **Silent approvals teach nothing.** Say what was good.
- **"LGTM" on a 1000-line PR is not a review.**
- **Reviews are asynchronous communication.** Tone is easy to misread — be explicit.
- **The author owns the code after merge**, not you. Don't rewrite silently.
- **Don't review to show you're smart.** Review to make the code and the author better.
- **Don't use reviews for performance feedback.** Use 1:1s.
- **Public reviews are not the place for sensitive feedback.** Move to a DM or 1:1.
- **Consistency matters more than strictness.** A reviewer who blocks on one PR and approves the same issue on another erodes trust.
- **The best reviewers ask "what problem does this solve?"** before diving into lines.

## Common Pitfalls

- Blocking on style while missing correctness.
- Reviewing too late (author has moved on).
- Reviewing too much (bottleneck).
- Reviewing too little (standards drift).
- Overloading the author with 50 comments.
- Not distinguishing blocking from non-blocking.
- Not praising good work.
- Using review as a performance review.
- Letting PRs grow unbounded.
- Assuming the author is wrong before understanding their choice.

## Key Interview Tips

- Lead with **"code review is quality control AND knowledge transfer AND coaching — in that order."**
- For "how do you handle a disagreement in review?", answer **"ask questions first, understand the trade-off, escalate to a design discussion if needed, and agree on a standard going forward."**
- For "how do you keep reviews from becoming a bottleneck?", answer **"small PRs, distributed ownership, review SLAs, and letting senior engineers own their domains."**
- For "how do you give hard feedback?", answer **"specific, timely, kind, actionable, and in private if it's sensitive."**
- For "what do you look for first?", answer **"correctness and security, then failure modes and data integrity, then readability."**
- For "how do you handle a reviewer who blocks on style?", answer **"automate style, reserve review for substance, and align on standards."**
- Mention **prefixes (`blocking:`, `nit:`, `suggestion:`)** to show you've thought about communication clarity.

## Related

- [Leadership index](index.md)
- [Mentoring & Coaching](mentoring-and-coaching.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Technical Debt](technical-debt.md)