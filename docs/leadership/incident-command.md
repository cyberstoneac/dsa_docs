# Incident Command

> **Context:** At lead level, you are not the person fixing the bug — you are the person running the response. Incident command is a role, not a title. A trained IC reduces MTTR, prevents thrash, and protects the responders. This file covers how to run incidents, communicate, and learn from them.

## Mental Model

An incident has two parallel tracks:



1. **The technical track** — what is broken, who is fixing it.
2. **The coordination track** — who is doing what, who needs to know, when to escalate.

The lead's job is the **second track**. If you're typing commands in the terminal, you're not running the incident.

```d2
direction: right

incident: Incident
tech: Technical Track
responders: Responders
diagnose: Diagnose
fix: Fix
verify: Verify
coord: Coordination Track
ic: Incident Commander
comms: Comms Lead
scribe: Scribe
stakeholders: Stakeholders

tech -> coord
```

**Rule:** one person fixes, one person coordinates. Never both.

## Roles

| Role | Owns | Doesn't own |
|---|---|---|
| **Incident Commander (IC)** | Coordination, decisions, comms | Fixing |
| **Tech Lead / Responder** | Diagnosis and fix | Comms |
| **Comms Lead** | Stakeholder updates, status page | Technical decisions |
| **Scribe** | Timeline, actions, decisions | Anything else |
| **Subject Matter Expert** | Domain knowledge | Coordination |

In small incidents, one person may hold multiple roles. In large incidents, they must be separate. The IC's first decision is often **"do I need more people?"**

## Incident Severity

Define severity before you need it.

| Sev | Impact | Response |
|---|---|---|
| **Sev1** | Total outage, data loss, security breach | All hands, exec comms, war room |
| **Sev2** | Major feature down, significant user impact | IC + responders, stakeholder comms |
| **Sev3** | Minor impact, workaround exists | Responder on-call, async updates |
| **Sev4** | Cosmetic, no user impact | Normal ticket |

**Rules:**
- **Err on the side of higher severity.** You can downgrade; you can't un-delay comms.
- **Declare early.** A declared incident with no impact is cheap. An undeclared incident with impact is expensive.
- **Anyone can declare.** No permission needed to call an incident.

## The Incident Lifecycle

```d2
direction: right

declare: 1. Declare
assess: 2. Assess
stabilize: 3. Stabilize
communicate: 4. Communicate
resolve: 5. Resolve
postmortem: 6. Postmortem

declare -> assess
assess -> stabilize
stabilize -> communicate
communicate -> resolve
resolve -> postmortem
```

### 1. Declare

- Create the incident channel (Slack, Teams).
- Assign IC (usually the on-call lead, or you).
- State severity, impact, and known facts.
- Page additional responders if needed.

Template:
```
:rotating_light: INCIDENT DECLARED
Severity: Sev2
Impact: Checkout failing for ~15% of users
Started: 14:23 UTC
IC: @you
Channel: #inc-2026-06-14-checkout
Status: Investigating
```

### 2. Assess

- What is the impact? Who is affected? How many?
- What is the blast radius? Is it growing?
- What changed recently? (deploys, config, traffic)
- What's the fastest mitigation, not the root cause?

**Rule:** stop the bleeding before diagnosing the wound.

### 3. Stabilize

- **Rollback** if a recent deploy is suspect.
- **Failover** if a zone/region is down.
- **Scale up** if capacity.
- **Disable feature flag** if a feature is the cause.
- **Rate limit** to protect downstreams.

**Rule:** mitigation first, root cause later.

### 4. Communicate

- **Status page** for customers.
- **Stakeholder updates** every 15–30 min for Sev1/2.
- **Internal channel** for responders.
- **Exec summary** if Sev1.

Communication cadence:
| Severity | Update cadence |
|---|---|
| Sev1 | Every 15 min |
| Sev2 | Every 30 min |
| Sev3 | Every 2 hours |
| Sev4 | On resolution |

Template:
```
UPDATE 14:45 UTC
Status: Mitigating
Impact: Checkout error rate down from 15% to 4%
Action: Rolled back checkout-service v2.3.1
Next update: 15:00 UTC
Owner: @you
```

**Rules:**
- Even "no update" is an update.
- State facts, not speculation.
- State the next update time explicitly.

### 5. Resolve

- Confirm metrics return to normal.
- Confirm with stakeholders.
- Remove temporary mitigations (carefully).
- Declare resolved.
- Capture timeline from the channel.

### 6. Postmortem

- Schedule within 5 business days.
- Blameless.
- Focus on **systems**, not people.
- Produce concrete action items with owners and dates.

## Incident Command Behaviors

### Do

- **Stay calm.** Your tone sets the room.
- **Delegate.** "You, check the DB. You, check the deploy."
- **Timebox.** "Give me an update in 10 minutes."
- **Ask for options.** "What are 2–3 things we could try?"
- **Decide.** When there's disagreement, decide and move.
- **Protect responders.** No blame during the incident.
- **Rotate people out.** Tired responders make mistakes.

### Don't

- **Don't fix.** You're the IC.
- **Don't narrate.** Let the responders talk.
- **Don't speculate publicly.** "I think it might be X" becomes "it's X" in the stakeholder update.
- **Don't skip comms.** Silence is interpreted as chaos.
- **Don't blame.** Blame during an incident destroys trust and delays resolution.
- **Don't run past 2 hours without relief.** Handoff explicitly.

## Handoff

When the IC changes:

```
IC HANDOFF 15:30 UTC
Outgoing IC: @you
Incoming IC: @alex
Current status: Mitigating, error rate 2%
Open threads: rollback verification, customer comms drafted
Next update: 15:45 UTC
```

Handoff must be **explicit**. Never assume.

## Postmortems

The single most important learning mechanism. **Blameless** is non-negotiable.

### Structure

1. **Summary** — what happened, impact, duration.
2. **Timeline** — factual, timestamped.
3. **Root cause** — technical + contributing factors.
4. **Detection** — how did we find out? Could we have found out sooner?
5. **Response** — what went well, what didn't.
6. **Action items** — specific, owned, dated.
7. **Lessons** — patterns to apply elsewhere.

### Blameless language

| Instead of | Say |
|---|---|
| "Alex deployed a bad config." | "A config change was deployed without validation in CI." |
| "Sam missed the alert." | "The alert was buried in a noisy channel." |
| "The team forgot to test." | "The test plan didn't include this failure mode." |
| "Human error." | "The system allowed an error to reach production." |

**Rule:** humans are unreliable; systems must assume it. Fix the system.

### Action items

Bad:
- "Be more careful."
- "Improve testing."
- "Add monitoring."

Good:
- "Add config schema validation to CI by 2026-07-01 — owner: @alex."
- "Add integration test for rollback path — owner: @sam, by 2026-07-15."
- "Add alert for checkout error rate > 1% for 5 min — owner: @you, by 2026-06-30."

Action items must be:
- **Specific** (what exactly).
- **Owned** (one person).
- **Dated** (a real date).
- **Trackable** (visible until done).

**Rule:** action items that don't close are worse than none — they teach the team that postmortems are theater.

## On-Call

On-call is a **team health** concern as much as an operational one.

| Practice | Why |
|---|---|
| Clear rotation | Predictability |
| Fair distribution | No hero culture |
| Comp for off-hours | Respect |
| Rotation length ≤ 1 week | Sustainability |
| Handoff notes | Continuity |
| Alert hygiene | Reduces fatigue |
| Post-incident rest | Recovery |
| Escalation path | No heroics |

**Rules:**
- **Noisy alerts get fixed or deleted.** Every false page erodes trust.
- **Every page must be actionable.** If it can't be acted on, it's a dashboard, not an alert.
- **No hero culture.** One person solving everything is a systemic failure.
- **On-call feedback loops into reliability work.**

## Metrics

| Metric | What it tells you |
|---|---|
| MTTD | Mean time to detect |
| MTTA | Mean time to acknowledge |
| MTTM | Mean time to mitigate |
| MTTR | Mean time to resolve |
| Incident frequency | By severity |
| Repeat incidents | Root cause not fixed |
| Postmortem completion | Action item closure rate |
| On-call page load | Fatigue risk |

**Rule:** MTTD and MTTM matter more than MTTR. Detecting and mitigating fast beats diagnosing fast.

## Tricky Corners ⚠️

- **IC is not the fixer.** If you're typing, you're not coordinating.
- **Declare early.** A false alarm costs minutes; an undeclared incident costs hours.
- **Mitigate before diagnosing.** Users don't care about root cause; they care that it works.
- **Stakeholder silence = chaos.** Communicate even when there's nothing new.
- **Blameless is not "no accountability."** It's "fix the system, not the person."
- **Postmortem without action items is theater.**
- **Action items without dates and owners don't happen.**
- **On-call burnout causes incidents.** Watch page load and rotation health.
- **Handoffs must be explicit.** Assumed continuity causes dropped threads.
- **The IC role rotates.** No one person should carry all incidents.
- **Severity inflation** (everything is Sev1) erodes response. **Severity deflation** (nothing is Sev1) delays it.

## Common Pitfalls

- No IC assigned.
- IC also trying to fix.
- No incident channel.
- No stakeholder updates.
- Speculating in comms.
- Blame during the incident.
- Postmortem with no follow-through.
- Alerts that page but aren't actionable.
- Hero culture — one person on every incident.
- No post-incident rest.
- Same incident recurring because action items never closed.

## Key Interview Tips

- Lead with **"incident command is a role — the IC coordinates, doesn't fix."**
- For "how do you run an incident?", answer with the lifecycle: **declare → assess → stabilize → communicate → resolve → postmortem.**
- For "how do you handle blame?", answer **"blameless postmortems — humans are unreliable, systems must assume it."**
- For "what do you communicate?", answer **"status, impact, action, next update time — on a fixed cadence, even with nothing new."**
- For "how do you prevent repeat incidents?", answer **"action items with owners and dates, tracked to closure."**
- For "how do you protect responders?", answer **"rotate roles, enforce rest, fix noisy alerts, no hero culture."**
- Always name a **concrete incident** you ran and the **outcome**.

## Related

- [Leadership index](index.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Stakeholder Management](stakeholder-management.md)
- [Observability → Metrics, Logs, Traces](../observability/metrics-logs-traces.md)
- [Microservices Patterns → Reliability](../microservices-patterns/reliability.md)
- [System Design Depth → Failure Modes](../system-design-depth/failure-modes.md)