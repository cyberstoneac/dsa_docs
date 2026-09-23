# Stakeholder Management

> **Context:** At lead level, half your job is managing the humans around the work: upward (your manager, director), sideways (PM, design, other leads, architects), and downward (your team). Stakeholder management is not politics — it is **alignment, transparency, and trust**.

## Mental Model

A stakeholder is anyone who is **affected by** or **affects** your team's work. Your job is not to please them. It is to:



1. **Understand** what they care about.
2. **Align** your team's work with their priorities.
3. **Communicate** honestly and predictably.
4. **Escalate** when decisions exceed your authority.

```d2
direction: right

lead: "You (Lead)"
up: "Up {\\n  manager: Manager\\n  director: Director"
side: "Sideways {\\n  pm: PM\\n  design: Design\\n  leads: Peer Leads\\n  arch: Architects"
down: "Down {\\n  team: Your Team"

up -> side
side -> down
```

Every stakeholder has a **currency**: what they optimize for. Your influence comes from aligning with their currency, not from arguing against it.

| Stakeholder | Currency |
|---|---|
| Product manager | User value, roadmap, delivery dates |
| Engineering manager | Team health, delivery, growth |
| Director | Business outcomes, risk, predictability |
| Peer lead | Their team's commitments, no surprises |
| Architect | Coherence, standards, long-term sustainability |
| Designer | User experience, quality |
| Support / Sales | Customer satisfaction, promises kept |

## Managing Up

Managing up is not flattery. It is making your manager effective at supporting you.

### What your manager needs from you

- **No surprises.** Bad news early, not at the deadline.
- **Options, not problems.** "Here are three paths, here's my recommendation."
- **Context, not just status.** Why it matters, what's at risk.
- **Alignment on priorities.** What you're saying no to and why.
- **A clear ask.** "I need X by Y" beats vague escalation.

### The weekly update

A short, consistent written update beats ad-hoc conversation:

```
Team: Orders
Status: On track for Q3 goal.
Shipped: checkout-v2 to 25% of users.
Risks: payment-service latency p99 up 30% — investigating.
Needs: decision on API versioning by Friday.
Next: canary to 50%, then full rollout.
```

**Rules:**

- Lead with **status** in one line.
- **Risks** with a mitigation, not just a complaint.
- **Asks** with a deadline.
- **Consistent cadence** beats long reports.

### Escalation

Escalate when:
- A decision exceeds your authority.
- Cross-team conflict is blocking.
- A risk threatens a commitment.
- A policy or compliance issue is at stake.

Escalate **early**, with:
- The **situation** (facts).
- The **impact** (what's at stake).
- The **options** (with recommendation).
- The **ask** (who decides, by when).

Do not escalate:
- To force your preferred outcome.
- Without trying to resolve it at your level first.
- Without a clear ask.

## Managing Sideways

Peer relationships are the hardest and most important. You don't manage them — you **invest** in them.

### Principles

- **No surprises.** Tell peer leads about changes affecting their teams before they hear from elsewhere.
- **Reciprocity.** Their problems are your problems when they affect shared outcomes.
- **Written agreements.** API contracts, shared libraries, shared services — document them.
- **Direct communication.** Don't route through managers unnecessarily.
- **Credit generously.** Share wins; own failures.

### Cross-team dependencies

Dependencies are where delivery goes to die. Manage them explicitly:

| Step | Practice |
|---|---|
| Identify | List every external dependency per project |
| Owner | Name a person on the other team |
| Date | Agreed delivery date |
| Risk | Likelihood + impact if late |
| Contingency | What you do if it slips |
| Review | Weekly status on dependencies |

**Rule:** if a dependency is not written down with an owner and a date, it does not exist.

### Conflict with peers

Conflict is normal. Handle it directly:



1. **Private conversation** first — no audience.
2. **Assume good intent** — most conflict is misalignment, not malice.
3. **Focus on the shared outcome**, not the specific solution.
4. **Escalate together** if you can't agree — don't escalate against each other.
5. **Document the decision** and the rationale.

## Managing Down

Your team is your most important stakeholder group. They need:

| Need | How you provide it |
|---|---|
| Clarity | Vision, goals, priorities |
| Context | Why the work matters |
| Protection | Shield from thrash, scope creep |
| Voice | Input into decisions that affect them |
| Growth | Opportunities, feedback, sponsorship |
| Safety | Blameless culture, honest communication |

**Rules:**

- **Communicate first, filter rarely.** Treat them like adults.
- **Share bad news with the team before it leaks.**
- **Give context for decisions, not just the decision.**
- **Defend the team publicly; correct privately.**

## Saying No

The lead's most important skill. Say no without burning the relationship.

### Framework

1. **Acknowledge** the request and the intent.
2. **Explain** the constraint (capacity, priorities, dependencies).
3. **Offer** an alternative (later, smaller, different owner).
4. **Commit** to what you can do.

Example:

> "I hear you — this is important. We're fully committed to the checkout migration through Q3, so we can't take it on now. Options: (a) we slot it for Q4, (b) another team picks it up with our help, or (c) we deliver a smaller version in 2 weeks. Which works best?"

### What NOT to do

- Say yes and silently drop something else.
- Say no without an alternative.
- Blame "the team" or "leadership" as if you have no agency.
- Promise to "see what we can do" and then avoid the conversation.

## Communication Styles

Match the format to the stakeholder:

| Stakeholder | Prefers |
|---|---|
| Director | 1-line status + risk + ask |
| PM | Detail on scope, dates, trade-offs |
| Engineer | Technical detail, design docs |
| Support | Impact, timeline, workaround |
| Exec | Business outcome, risk, cost |

**Rule:** lead with the conclusion, then the supporting detail. Busy people read the first sentence.

## Building Trust

Trust is built in small moments:



- **Do what you said you'd do.**
- **Communicate proactively** when things change.
- **Own mistakes** publicly and fix them.
- **Give credit** generously and specifically.
- **Be consistent** across audiences — no back-channel stories.
- **Say no** clearly rather than commit and fail.

Trust is lost in one moment. Rebuilding it takes far longer.

## Tricky Corners ⚠️

- **You cannot please everyone.** Pick priorities, communicate clearly, and accept disagreement.
- **Silence is interpreted as agreement — or as hiding.** Communicate proactively.
- **Surprises erode trust faster than bad news.** Deliver bad news early.
- **Peer relationships are long.** Don't win a battle at the cost of the relationship.
- **Don't route around peers** through their managers unless escalation is warranted.
- **Executives want outcomes, not activities.** Frame work in business terms.
- **PM and Eng lead are a team.** Align before presenting to stakeholders.
- **Escalation is not failure.** It's a tool. Failing to escalate is the failure.
- **Your team hears your tone first.** Venting about stakeholders in front of the team poisons the well.
- **"We" beats "I" when reporting team success. "I" beats "the team" when owning failure.**
- **You can't unring a bell** — think before you send that email.

## Common Pitfalls

- Only communicating status, never risks.
- Escalating without trying to resolve first.
- Committing on behalf of the team without their input.
- Saying yes to everyone, then underdelivering.
- Letting peer leads hear about changes secondhand.
- Sharing sensitive information with the wrong audience.
- Treating PM as an adversary instead of a partner.
- Ignoring the exec's framing (business outcomes).
- Over-communicating (noise) or under-communicating (surprises).
- Avoiding conflict, then escalating as a surprise.

## Key Interview Tips

- Lead with **"stakeholder management is alignment, transparency, and trust — not politics."**
- For "how do you handle a stakeholder who keeps adding scope?", answer **"make the trade-off explicit: yes, if we cut X; otherwise, here's the impact on the date."**
- For "how do you handle conflict with a peer lead?", answer **"private conversation first, focus on the shared outcome, escalate together if needed."**
- For "how do you manage up?", answer **"no surprises, options not problems, clear asks, consistent cadence."**
- For "how do you say no?", answer **"acknowledge, explain the constraint, offer an alternative, commit to what you can do."**
- For "how do you handle a stakeholder who goes around you?", answer **"address it directly, understand the concern, and establish a shared communication channel."**
- Always name a **concrete example** and a **clear outcome**.

## Related

- [Leadership index](index.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Technical Debt](technical-debt.md)
- [Incident Command](incident-command.md)
- [Behavioral Interviews](behavioral-interviews.md)