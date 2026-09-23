# Leadership

> **Context:** At 13 YOE as a tech lead managing two teams, the interview is no longer "can you code?" It's "can you multiply a team?" This section covers the patterns of engineering leadership: how to review, mentor, plan, negotiate, manage stakeholders, pay down debt, run incidents, and tell the story in a behavioral interview.

## Mental Model

An IC's job is to produce work. A lead's job is to **produce the conditions for work**. The output is no longer your code — it's the team's throughput, quality, and growth. Everything else follows from that shift.

```d2
direction: right

ic: IC
i1: writes code
i2: owns features
i3: measured by output
lead: Tech Lead
l1: sets direction
l2: unblocks others
l3: grows people
l4: manages stakeholders
l5: measured by team output

ic -> lead
```

Three tensions every lead navigates:

| Tension | Pull A | Pull B |
|---|---|---|
| Time | Ship now | Invest in quality |
| Scope | Say yes to stakeholders | Protect the team |
| People | Push for growth | Protect from burnout |

There is no formula. The skill is reading the situation and choosing deliberately.

## What Changes at Lead Level

| Dimension | IC | Lead |
|---|---|---|
| Success metric | Personal output | Team output + growth |
| Time horizon | Sprint | Quarter / year |
| Primary skill | Technical depth | Judgment + communication |
| Failure mode | Missed feature | Team burnout, wrong direction, silent attrition |
| Code time | 80% | 20–40% (and shrinking as team grows) |
| Meetings | Few | Many, but curated |
| Influence | Through code | Through people, docs, decisions |
| Feedback | Receives | Gives, and receives upward |

**The hardest transition:** letting go of being the best coder in the room. Your value is now in making others effective.

## The Lead's Operating System

```d2
direction: right

directionArea: "Direction\nteam vision\nquarterly goals\nwhat we say no to"
peopleArea: "People\nhiring bar\n1:1s\ngrowth plans\nperformance"
deliveryArea: "Delivery\nplanning\nexecution / unblocking\nquality bar\nincidents"
stakeholdersArea: "Stakeholders\nmanaging up\ncross-team\nteam comms"

directionArea -> peopleArea
peopleArea -> deliveryArea
deliveryArea -> stakeholdersArea
```

Every file in this section maps to one of these quadrants:

| File | Quadrant |
|---|---|
| `code-reviews.md` | Delivery + People |
| `mentoring-and-coaching.md` | People |
| `delivery-and-planning.md` | Delivery |
| `stakeholder-management.md` | Stakeholders |
| `technical-debt.md` | Direction + Delivery |
| `incident-command.md` | Delivery + Stakeholders |
| `behavioral-interviews.md` | All |

## Anti-Patterns of New Leads

| Anti-pattern | Symptom | Fix |
|---|---|---|
| **Hero coder** | Still writing the hardest tickets | Delegate, review, pair |
| **Bottleneck** | Every PR waits for you | Set standards, trust the team |
| **People pleaser** | Says yes to every stakeholder | Prioritize; say no with reasons |
| **Absent lead** | "I trust the team" but no visibility | Structured 1:1s, metrics, reviews |
| **Micro-manager** | Reviews every line, attends every meeting | Define outcomes, delegate the how |
| **Status reporter** | Only relays status up | Bring options and recommendations |
| **Conflict avoider** | Doesn't address underperformance | Direct, kind, early conversations |

## Your First 90 Days as a Lead

| Phase | Focus | Output |
|---|---|---|
| Days 1–30 | Listen, observe | Map of people, systems, stakeholders |
| Days 31–60 | Small wins, 1:1 rhythm | Trust, one visible improvement |
| Days 61–90 | Direction, priorities | Team vision, quarterly goals, working agreements |

Don't reorganize in the first month. You don't know enough yet.

## Decision Rights

One of the most useful tools: be explicit about **who decides what**.

| Decision | Owner |
|---|---|
| Team vision, quarterly goals | Lead (with team input) |
| Sprint scope | Team + PM |
| Architecture within team's domain | Team's senior engineers |
| Cross-team API contracts | Leads of both teams |
| Hiring bar | Lead |
| Tech stack changes | Lead + architects |
| On-call rotation | Lead + team |

Write these down. Most team dysfunction comes from unclear decision rights, not bad decisions.

## Communication Cadence

| Cadence | Audience | Purpose |
|---|---|---|
| Daily standup | Team | Unblock, sync (keep it short) |
| Weekly 1:1 | Each report | Growth, feedback, coaching |
| Biweekly team sync | Team | Direction, cross-team context |
| Monthly stakeholder update | Up + sideways | Status, risks, asks |
| Quarterly planning | Team + stakeholders | Goals, scope, commitments |
| Ad-hoc escalation | As needed | Unblock, decide, de-risk |

**Rule:** if you're in a meeting that doesn't fit one of these, ask if it should exist.

## Metrics for a Lead

You are measured by:



- **Delivery:** predictability, quality, cycle time.
- **People:** retention, growth, engagement, promotion readiness.
- **Direction:** clarity of goals, alignment with business.
- **Health:** on-call load, incident rate, tech debt trend.

Not by:
- Lines of code you wrote.
- Number of PRs you reviewed.
- Meetings attended.

## The Lead's Reading List (Mental, Not Literal)

The best leads have internalized a small number of frameworks and can deploy them fluidly:



- **Situation vs. problem vs. solution** — separate them before reacting.
- **Options, not ultimatums** — present 2–3 paths with trade-offs.
- **Direct + kind** — clarity is a kindness.
- **Disagree and commit** — after the decision, align.
- **Blameless postmortems** — systems fail, not people.
- **Trust but verify** — autonomy with visibility.
- **Say no with reasons** — protect the team's focus.

## Tricky Corners ⚠️

- **You cannot be everyone's friend and their manager.** Warmth + standards, not warmth instead of standards.
- **"I'll just do it myself" is a trap.** It's faster today, slower forever.
- **Silence is not agreement.** Ask explicitly.
- **Feedback delayed is feedback denied.** Give it within 48 hours.
- **Promotions are earned over quarters, not sprints.** Set expectations early.
- **Your mood sets the room.** Anxiety and frustration are contagious.
- **1:1s are for the report, not for you.** Their agenda, their growth.
- **You will be the last to know about problems.** Make it safe to surface them.
- **Delegation is not dumping.** Hand off outcomes, not tasks.

## Common Pitfalls

- Staying in the code as a comfort zone.
- Avoiding difficult conversations.
- Optimizing for being liked.
- Confusing activity with progress.
- Not protecting the team from scope creep.
- Skipping 1:1s when busy (exactly when they matter most).
- Over-committing to stakeholders.
- Ignoring underperformance until review season.
- Treating all tech debt as equal.
- Running incidents from the keyboard instead of the comms channel.

## Key Interview Tips

- Lead with **"my job is to multiply the team, not to be the best coder."**
- For "how do you handle underperformance?", answer **"direct, early, specific, documented, with a growth plan and a clear timeline."**
- For "how do you prioritize?", answer **"business impact + risk + effort, and explicitly what we say no to."**
- For "how do you handle conflict?", answer **"surface it early, separate the problem from the person, drive to a decision, then align."**
- For "how do you grow engineers?", answer **"individual growth plans, stretch assignments, and sponsorship — not just mentorship."**
- For behavioral questions, use **STAR** with a clear **result** and a **reflection**.
- Always name a **concrete example** from your own experience, not a generic answer.

## Related

- [Code Reviews](code-reviews.md)
- [Mentoring & Coaching](mentoring-and-coaching.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Stakeholder Management](stakeholder-management.md)
- [Technical Debt](technical-debt.md)
- [Incident Command](incident-command.md)
- [Behavioral Interviews](behavioral-interviews.md)