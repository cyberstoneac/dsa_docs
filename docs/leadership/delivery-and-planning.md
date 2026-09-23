# Delivery & Planning

> **Context:** At 13 YOE as a tech lead, delivery is no longer "did I finish my ticket?" It's "did the team deliver the right thing, predictably, without burning out?" Planning is the mechanism. Estimation, scope negotiation, sprint cadence, prioritization, and deadline management are the levers.

## Mental Model

Delivery is a **throughput + predictability + sustainability** problem. You optimize for all three, not just speed.

```d2
direction: right

delivery: Delivery
throughput: "Throughput\\n(shipping value)"
predictability: "Predictability\\n(forecasting reliably)"
sustainability: "Sustainability\\n(no burnout)"

throughput -> predictability
predictability -> sustainability
```

Speed without predictability = chaos. Predictability without sustainability = burnout. All three together = a team that ships and lasts.

Three questions every planning cycle answers:



1. **What matters most?** (prioritization)
2. **How long will it take?** (estimation)
3. **What are we not doing?** (scope negotiation)

If you can't answer #3, you haven't prioritized — you've just listed.

## Estimation

Estimation is not prediction. It is **communication of uncertainty**. The goal is a shared understanding of size, risk, and unknowns — not a precise number.

| Technique | When | Notes |
|---|---|---|
| Story points | Relative sizing within a team | Good for velocity, bad for cross-team |
| T-shirt sizes | Early, rough | Fast, low precision |
| Ideal days | Concrete, familiar | Anchors to time, often optimistic |
| #NoEstimates | Mature teams with small, similar work | Splits work by size instead |
| Reference stories | Calibration | Anchor new work to past work |

**Rules:**

- **Estimate the work, not the person.**
- **Small stories estimate better** than large ones. If it's > 3 days, split it.
- **Re-estimate when scope changes** — don't silently absorb.
- **Include testing, review, deploy, and unknowns** — not just the happy path.
- **The team estimates, not the lead.** Your job is to facilitate, not to dictate.

### Cone of Uncertainty

Early estimates are wide. Precision only arrives as you learn.

| Stage | Realistic range |
|---|---|
| Idea | 4x |
| Requirements drafted | 2x |
| Design approved | 1.5x |
| Implementation started | 1.25x |
| Half done | 1.1x |
| Done | 1x |

Communicating this to stakeholders prevents false precision.

## Sprint Planning

Structure (for a 2-week sprint):

| Phase | Time | Purpose |
|---|---|---|
| 1. Review goals | 15 min | What's the team's objective this sprint? |
| 2. Capacity check | 15 min | Who's available, PTO, on-call, meetings |
| 3. Backlog review | 60 min | Walk through top items |
| 4. Estimation | 30 min | Size, clarify, split |
| 5. Commitment | 15 min | Team agrees on scope |
| 6. Risks & dependencies | 15 min | Flag anything external |

**Rules:**

- **Capacity, not velocity, drives scope.** Velocity is a lagging indicator; capacity is real.
- **Commit to outcomes, not tickets.** "Ship checkout v2 to 10% of users" beats "complete 12 stories."
- **Leave slack.** 20% buffer for unplanned work, bugs, and support.
- **Team commits; lead does not commit on their behalf.**
- **Every story has a clear "done" definition.**

## Prioritization

The lead's job is to **make the trade-offs explicit**, not to pretend everything fits.

### Frameworks

| Framework | Use |
|---|---|
| RICE (Reach, Impact, Confidence, Effort) | Ranking features |
| WSJF (Weighted Shortest Job First) | Cost of delay / job size |
| MoSCoW (Must, Should, Could, Won't) | Scope cuts |
| Kano (Basic, Performance, Delight) | Product satisfaction |
| Eisenhower (Urgent, Important) | Personal time management |

For engineering work, the lead's version is often simpler:

| Question | If no → |
|---|---|
| Does this move a business metric? | Likely drop or defer |
| Does this reduce risk or unblock others? | Lower priority |
| Can we defer without harm? | Defer |
| Is this a prerequisite for something bigger? | Do first |
| Is someone asking loudly, or is it actually important? | Question the ask |

### The Prioritization Conversation

When you have 10 items and room for 6:



1. **State the constraint.** "We have capacity for 6."
2. **State the criteria.** Business impact, risk, dependencies.
3. **Force-rank, don't bucket.** "Everything is P1" means nothing is P1.
4. **Make the cuts visible.** Write the "not doing" list.
5. **Confirm with stakeholders.** They may reorder; that's fine.
6. **Commit and communicate.**

## Scope Negotiation

Deadlines are fixed. Scope is the variable. **Trade scope, not quality.**

| Lever | Effect |
|---|---|
| Reduce scope | Ship less, ship on time |
| Extend deadline | Ship same, later |
| Add people | Rarely helps short-term (Brooks's Law) |
| Reduce quality | Ship on time with bugs (avoid) |
| Cut testing | Ship on time, discover issues in prod (avoid) |
| Phase the work | Ship v1 now, v2 later |

**Rule:** when asked "can you do X by date Y?", respond with:
> "Yes, if we scope it to A. Full scope B needs Z. Which do you want?"

This makes the trade-off explicit instead of silently overcommitting.

### The Iron Triangle

```d2
direction: right

tri: Iron Triangle
scope: Scope
time: Time
quality: Quality

scope -> time
time -> quality
quality -> scope
```

You can fix two. The third must flex. In software, **quality should not be the one that flexes** — scope or time must.

## Handling Deadlines

| Situation | Response |
|---|---|
| Deadline is hard, scope is soft | Cut scope, ship on time |
| Deadline is soft, scope is hard | Extend deadline |
| Both are hard | Escalate: something must give |
| Deadline is artificial | Challenge the assumption |
| Deadline is regulatory/compliance | Non-negotiable; plan backward |

**Lead's job:** surface the trade-off **early**, not at the deadline. A slip discovered in week 1 is a conversation; a slip discovered in week 4 is a crisis.

### Early Warning Signals

- Burn-up chart diverging from plan.
- A "small" story taking 3x longer.
- Dependencies not resolving.
- Unplanned work spiking.
- Team morale dropping.
- Review queue growing.

Act on signals at the first sign, not the last.

## Delivery Cadence

| Cadence | Practice |
|---|---|
| Daily | Standup (15 min, blockers only) |
| Weekly | 1:1s, demo/review |
| Biweekly | Sprint boundary, retro |
| Monthly | Stakeholder update |
| Quarterly | Planning, goals, roadmap |
| Annually | Strategy, comp, growth |

**Rule:** if a meeting doesn't fit the cadence, question why it exists.

## Retrospectives

The retro is where the team improves. Structure:



1. **Set the stage** — safety, tone.
2. **Gather data** — what happened.
3. **Generate insights** — why.
4. **Decide actions** — 1–3 improvements.
5. **Close** — commitment.

**Rules:**

- **Blameless.** Systems fail, not people.
- **Action-oriented.** Insights without actions are just talk.
- **Follow up.** Review last retro's actions first.
- **Rotate facilitation.** Don't let it become the lead's meeting.
- **Vary the format.** Same retro every time goes stale.

## Metrics That Matter

| Metric | What it tells you |
|---|---|
| Lead time | Idea → production |
| Cycle time | Start → done |
| Deployment frequency | How often you ship |
| Change failure rate | % of deploys causing incidents |
| MTTR | Mean time to restore |
| WIP | Work in progress (lower is better) |
| Escaped defects | Bugs found in prod |
| Unplanned work % | Time not on the plan |

**Anti-metrics:** velocity as a target, story points compared across teams, individual output.

## The Lead's Role in Delivery

You are not the project manager. You are the **unblocker, decision-maker, and shield**.

| Activity | Lead does | Lead does NOT |
|---|---|---|
| Planning | Facilitate, set context | Assign tickets |
| Estimation | Coach, calibrate | Dictate numbers |
| Execution | Unblock, decide, escalate | Micromanage |
| Scope | Negotiate with stakeholders | Absorb silently |
| Quality | Set bar, review critical paths | Rubber-stamp |
| Morale | Notice, act | Ignore until exit |

## Tricky Corners ⚠️

- **Velocity is a planning tool, not a performance metric.** Never use it to compare people or teams.
- **Story points don't convert across teams.** Don't try.
- **A "small" story that takes a week is a signal** — split better next time, or investigate why.
- **Committed does not mean guaranteed.** Communicate uncertainty early.
- **100% utilization = zero slack = delays compound.** Plan for 80%.
- **Brooks's Law is real.** Adding people to a late project makes it later.
- **Deadlines are often negotiable; quality is not.**
- **Unplanned work is real work.** Track it; don't hide it.
- **Retros without follow-through erode trust.** Do fewer actions, but finish them.
- **Skipping demos loses stakeholder trust.** Show progress, even partial.

## Common Pitfalls

- Overcommitting without scope negotiation.
- Treating estimates as commitments.
- Using velocity as a target.
- Ignoring unplanned work in capacity.
- Not leaving slack.
- Skipping retros when busy.
- Retros without actions.
- Hiding risks until they become incidents.
- Doing the team's planning for them.
- Saying yes to every stakeholder request.

## Key Interview Tips

- Lead with **"delivery is throughput + predictability + sustainability — not just speed."**
- For "how do you handle a missed deadline?", answer **"surface it early, explain the cause, and present scope/time options — never absorb silently."**
- For "how do you prioritize?", answer **"business impact + risk + dependency, force-ranked, with the 'not doing' list made explicit."**
- For "how do you estimate?", answer **"small stories, team-owned, relative sizing, and communicating the cone of uncertainty."**
- For "how do you handle stakeholder pressure to add scope?", answer **"make the trade-off explicit: yes, if we cut X; otherwise, here's the new date."**
- For "how do you keep the team sustainable?", answer **"capacity-based planning, 20% slack, protect from thrash, watch morale signals."**
- For "how do you improve delivery?", answer **"retros with actions, DORA metrics, and reducing WIP before adding people."**

## Related

- [Leadership index](index.md)
- [Code Reviews](code-reviews.md)
- [Mentoring & Coaching](mentoring-and-coaching.md)
- [Stakeholder Management](stakeholder-management.md)
- [Technical Debt](technical-debt.md)
- [Incident Command](incident-command.md)