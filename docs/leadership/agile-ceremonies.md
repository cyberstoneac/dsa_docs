# Agile Ceremonies

> **Context:** Team leadership and delivery. This file is about *how to run ceremonies well* and *when to change or drop them*.

## Mental Model

Agile ceremonies are **structured conversations** that create feedback loops and alignment. They exist to solve specific problems:

| Problem | Ceremony that solves it |
|---|---|
| The team doesn't know what's happening | Daily standup |
| The team doesn't know what to build next | Sprint planning |
| The team builds the wrong thing | Backlog refinement + Review |
| The team can't get better | Retrospective |
| The team misunderstands requirements | Refinement + Three Amigos |

**Rule:** every ceremony must have a **purpose you can state in one sentence**. If you can't, it's theatre. Ceremonies are not rituals; they're tools. Keep the ones that work, drop or reshape the ones that don't.

```d2
direction: down

plan: "Sprint Planning\nwhat + how"
daily: "Daily Standup\nsync + unblock"
refine: "Refinement\nclarify + estimate"
review: "Sprint Review\nshow + feedback"
retro: "Retrospective\nimprove"

plan -> daily: "commit"
daily -> refine: "discover gaps"
refine -> review: "deliverable work"
review -> retro: "learn what worked"
retro -> plan: "improve next sprint"
```

## Daily Standup

**Purpose:** synchronize the team on progress and surface blockers. Not a status report to the manager.

**Time-box:** 15 minutes. If you're regularly over, the format is wrong.

**Classic format (three questions)**
- What did I do yesterday?
- What will I do today?
- What's blocking me?

**Better format (walk the board)**
- Walk through tickets right-to-left (finish work before starting new work).
- Each ticket gets a quick update: what's needed to move it forward?
- Blockers get parked and handled offline.

**Signs it's working**
- 10–15 minutes, consistent.
- Blockers surfaced and resolved within the day.
- People talk about *work*, not *activities*.
- Remote/async team gets the same value.

**Signs it's broken**
- 30+ minutes, people zone out.
- Status reporting to the manager.
- Nothing changes day-to-day.
- Remote team members are invisible.

**Async option**

For distributed teams, a written standup in Slack/Teams works:
- Post updates by a set time.
- Blockers tagged with `@` mentions for the people who can help.
- A live sync only for blockers, not for reports.

**Rules**
- **Start on time**, even if people are missing.
- **End on time** — protect the team's focus time.
- **Take discussions offline.** Deep dives are for after, not during.
- **Rotate the facilitator** — avoid one person being the perpetual MC.
- **The board is the source of truth.** If it's not on the board, it doesn't exist.

## Sprint Planning

**Purpose:** decide what the team will accomplish in the sprint and how.

**Time-box:** 2 hours for a 2-week sprint (or less).

**Agenda**
1. **Review the sprint goal.** What outcome does the team commit to? (Product owner)
2. **Review top backlog items.** Clarify intent, dependencies, risks. (PO + team)
3. **Team estimates and pulls work.** Team selects items it can commit to.
4. **Identify risks and dependencies.** Note them explicitly.
5. **Confirm the sprint goal.** One sentence the team can rally around.

**Output:** a sprint goal + a sprint backlog.

**Anti-patterns**
- PO assigns tickets to individuals — undermines team ownership.
- Manager dictates the sprint goal.
- Velocity pressure — "you did 40 last time, do 45."
- Estimating in hours — team should estimate effort/size, not time.
- No sprint goal — just a list of tickets.
- Planning a full two weeks without buffer.

**Rules**
- **The team commits, not the manager.** Commitment is the team's, and it's a forecast, not a guarantee.
- **Capacity matters.** Subtract PTO, holidays, on-call, meetings.
- **One sprint goal.** Multiple goals = no goals.
- **Leave slack.** 20% buffer for incidents and the unexpected.

## Backlog Refinement

**Purpose:** make upcoming work ready to plan. Clarify, size, split, and de-risk items before planning.

**Time-box:** 1 hour per week, or 5% of sprint capacity.

**Agenda**
- Walk the top 2–3 sprints' worth of items.
- Clarify acceptance criteria.
- Split items that are too large.
- Estimate items that are ready.
- Flag dependencies and risks.

**Signs it's working**
- Planning is fast (30 minutes, not 2 hours).
- Tickets are well-understood before the sprint.
- Fewer "this is more complex than we thought" surprises.

**Signs it's broken**
- Nothing is refined until planning.
- Estimation dominates refinement.
- Refinement becomes design sessions.

**Rules**
- **Do not over-refine.** Only the next 2–3 sprints' worth. Further out is waste.
- **Definition of Ready** — the checklist an item must pass before planning.
- **Three Amigos** for complex items — dev, QA, PO align on intent.
- **Refinement is not planning.** Don't commit to work in refinement.

## Sprint Review

**Purpose:** show working software to stakeholders and collect feedback.

**Time-box:** 1 hour for a 2-week sprint.

**Agenda**
1. **State the sprint goal.** Did we meet it?
2. **Demo working software.** Not slides. Not planned work — actual work.
3. **Discuss what didn't ship and why.**
4. **Collect stakeholder feedback.**
5. **Update the backlog** based on feedback.

**Anti-patterns**
- Slide deck instead of demo.
- Demoing work that isn't done.
- No stakeholders present.
- Demo becomes a status meeting.
- Feedback is not acted upon.

**Rules**
- **Demo working software.** Every time.
- **Multiple team members present**, not just the PO.
- **Stakeholders give feedback**, not sign off.
- **The point is feedback, not approval.**
- **Backlog updates** from feedback are visible.

## Retrospective

**Purpose:** reflect and improve. The single most important ceremony for team health.

**Time-box:** 1 hour for a 2-week sprint.

**Classic format**
- What went well?
- What didn't go well?
- What will we change?

**Better format**
1. **Set the stage.** Safety check, energiser, or a quick check-in.
2. **Gather data.** What happened this sprint? (Timeline, metrics, sticky notes)
3. **Generate insights.** Why did it happen?
4. **Decide what to do.** 1–2 concrete actions with owners.
5. **Close.** Appreciate, commit to actions.

**Common formats**
- **Start/Stop/Continue** — simple, works for most teams.
- **Mad/Sad/Glad** — emotional check-in.
- **4Ls** — Liked, Learned, Lacked, Longed for.
- **Sailboat** — anchors, wind, rocks, destination.
- **Starfish** — Start, Stop, Continue, More of, Less of.

**Rules**
- **Safety first.** No blame, no hierarchy, no managers evaluating performance in the room.
- **Vegas rule** — what's said in retro stays in retro (unless it's a safety issue).
- **1–2 actions max.** More than that and none get done.
- **Actions have owners and deadlines.**
- **Review last retro's actions.** Otherwise the ceremony loses credibility.
- **Rotate the facilitator.** Avoid the Scrum Master being the only voice.
- **Async option** for distributed teams — a shared doc plus a follow-up call.

**Signs it's working**
- People speak candidly.
- Actions from previous retros are visibly completed.
- The team identifies issues before the manager does.
- Improvements compound sprint over sprint.

**Signs it's broken**
- Silence, or only one person talking.
- Same issues every retro, no action.
- Manager dominates or takes notes visibly.
- Actions from last retro weren't addressed.
- Skipping retro because "we're too busy" — that's when you need it most.

**Anti-patterns**
- Retro as complaint session, no action.
- Retro as a status update.
- Manager reads the retro notes for performance reviews.
- Actions without owners.
- Same action three sprints in a row — signals it's not the real problem.

## Backlog Grooming

A synonym for refinement in many teams. Same purpose. See "Backlog Refinement" above.

## Ceremonies at Different Cadences

| Cadence | Ceremony | Purpose |
|---|---|---|
| **Daily** | Standup | Sync |
| **Weekly** | Refinement | Prepare |
| **Per sprint** | Planning, Review, Retro | Commit, demo, improve |
| **Quarterly** | Big-room planning / PI planning | Align across teams |
| **Ad-hoc** | Three Amigos, Spike, Design review | Specific problems |

## Remote and Async Options

Distributed teams need different formats, not lower standards.

| Ceremony | Synchronous | Asynchronous |
|---|---|---|
| **Standup** | Video call, 15 min | Written updates in Slack/Teams, read by 10 AM |
| **Planning** | Video call, 2h | Async doc + 30-min Q&A call |
| **Refinement** | Video call, 1h | Shared doc with comments |
| **Review** | Video call with demo | Recorded demo + written Q&A |
| **Retro** | Video call, 1h | Shared doc with anonymous comments + 30-min call |

**Rules**
- **Written artefacts** for every ceremony, so people in other time zones can contribute.
- **Rotate meeting times** so the same people aren't always inconvenienced.
- **Cameras optional** — enforce presence, not video.
- **Fewer, better meetings.** Async by default; sync only when interaction matters.
- **Over-communicate.** Async needs more context, not less.

## When to Change or Drop a Ceremony

Ceremonies are tools. Retire them when they stop serving their purpose.

**Signs a ceremony should change**
- Regular overrun of the time-box.
- Low engagement (silence, camera off, absence).
- Output is not acted upon.
- Same issues recurring without progress.
- Team does it out of habit.

**Signs a ceremony should be dropped**
- Its purpose is served by another ceremony.
- The team consistently derives no value.
- It exists only because "we're Agile".

**Rule:** replacing a ceremony with nothing is fine. Replacing it with a **better-fitting alternative** is better.

## Tricky Corners ⚠️

- **Ceremonies are not the process.** The Agile Manifesto doesn't mention standups, planning, or retros. They're common practices, not doctrine.
- **Managers in the retro** change the conversation. Either don't attend, or attend explicitly to listen without speaking.
- **The daily standup is not a status report.** If a manager needs a status, they can read the board.
- **Sprint planning pressure kills forecasts.** Teams under pressure pad estimates; forecasts become worthless.
- **Refinement without acceptance criteria** produces half-defined work that becomes tech debt.
- **Review without stakeholders** is theatre.
- **Retro without action** is theatre.
- **Skipping retro when busy** is the moment it's most needed.
- **Async retros** need anonymity for honesty, or a culture where safety is established.
- **Ceremonies are team-specific.** What works for one team may not work for another. Copying another team's format usually doesn't work.

## Common Pitfalls

- Running ceremonies because "we're Agile", not because they solve a problem.
- Standup as a status report to the manager.
- Planning without a sprint goal.
- Refinement as design sessions.
- Review without a demo.
- Retro without actions, or with actions that never get done.
- Never reviewing previous retro actions.
- Ceremony overrun — 1-hour meetings that consistently run to 90 minutes.
- No async options for distributed teams.
- Same format for years without revisiting.

## Key Interview Tips

- **Name the purpose of each ceremony.** Interviewers listen for whether you know *why* the ceremony exists.
- **The standup is for the team, not the manager.** Say this explicitly.
- **Retro is the highest-leverage ceremony.** Say it and mean it.
- **Actions from retros must be visible and reviewed.** Otherwise the ceremony loses credibility.
- **Time-boxing is a discipline.** Say "15 minutes and overruns mean the format is wrong".
- **Async options** show seniority in distributed-team leadership.
- **Ceremony ≠ process.** Mentioning that Agile doesn't mandate these practices is a senior signal.
- **Drop or reshape ceremonies** when they stop working. Anti-pattern: running them out of habit.
- **Sprint goal, not a list of tickets.** The goal creates focus and meaning.
- **Link to metrics** — retros and reviews should track improvement against the north star.

## Related

- [SAFe & Scaling Agile](safe-and-scaling-agile.md)
- [SDLC Lifecycle](sdlc-lifecycle.md)
- [North Star Metrics](north-star-metrics.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Shift-Left](shift-left.md)