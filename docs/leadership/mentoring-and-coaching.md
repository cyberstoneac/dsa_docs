# Mentoring & Coaching

> **Context:** At lead level, growing people is not a side task — it is the job. A team that grows is a team that stays, ships, and scales. This file covers the mechanics: 1:1s, growth plans, mentoring vs coaching, sponsorship, and handling underperformance.

## Mental Model

**Mentoring** is transferring your knowledge. **Coaching** is drawing out theirs. Both are needed; they are not the same.

| | Mentoring | Coaching |
|---|---|---|
| Direction | You → them | Them → themselves |
| Question | "Here's how I'd do it." | "What do you think you should do?" |
| Use when | They lack experience | They have the answer inside |
| Risk | Dependency | Frustration if overused |
| Lead's default | Early career | Mid/senior |

```d2
direction: right

person: Engineer
mentor: "Mentoring\\n(transfer knowledge)"
coach: "Coaching\\n(draw out answers)"
sponsor: "Sponsorship\\n(advocate for them)"

person -> mentor
person -> coach
person -> sponsor
```

**Sponsorship** is the third, least-practiced, highest-impact lever: using your reputation to open doors for someone (recommending them for a project, a promotion, a visible role). Mentoring without sponsorship leaves growth on the table.

## 1:1s

The single most important recurring meeting you have. 30 minutes, weekly (or biweekly for senior folks), **their agenda, not yours**.

### Structure

| Time | Focus |
|---|---|
| 5 min | Check-in (how are you, really?) |
| 15 min | Their topics — blockers, growth, concerns |
| 5 min | Your topics — feedback, context, direction |
| 5 min | Actions and follow-ups |

### Questions that open real conversations

- What's energizing you right now?
- What's draining you?
- What's the thing you've been avoiding?
- Where do you feel stuck?
- What do you want to be doing in a year?
- What feedback do you have for me?
- What's something I should know that I probably don't?

### Anti-patterns

- Status update disguised as a 1:1 (that's what standup is for).
- Cancelling when busy (exactly when it matters).
- Doing all the talking.
- Skipping notes — you will forget what you promised.
- Only discussing problems, never growth.

## Growth Plans

A growth plan is a shared document, not a wish list. It has:

| Element | Example |
|---|---|
| Target | "Senior engineer by Q4" |
| Gap | "Needs to lead design reviews without support" |
| Actions | "Own 2 design docs this quarter, lead 4 reviews" |
| Evidence | "Peer feedback, design doc quality, review outcomes" |
| Timeline | "Review at end of Q2 and Q4" |
| Support | "I'll pair on the first doc, then step back" |

**Rules:**

- Owned by the engineer, supported by the lead.
- Concrete and observable, not vague ("be more senior").
- Reviewed quarterly, adjusted as needed.
- Tied to a real opportunity — not just a plan on paper.

## The Growth Ladder

Most engineers progress through a ladder. The lead's job is to see where they are and what the next step requires.

| Level | What changes |
|---|---|
| Junior → Mid | From "needs direction" to "owns tasks" |
| Mid → Senior | From "owns tasks" to "owns problems and projects" |
| Senior → Staff | From "owns projects" to "owns domains and multiplies others" |
| Staff → Principal | From "domain" to "org-wide technical direction" |

Each transition requires a different kind of support: pairing, scope, visibility, or sponsorship.

## Coaching Conversations

The coaching stance: **ask before telling**. Structure:



1. **Situation** — "Tell me what happened."
2. **Impact** — "What was the effect?"
3. **Options** — "What could you have done differently?"
4. **Choice** — "What will you do next time?"
5. **Support** — "How can I help?"

Example: an engineer shipped a bug that caused an incident.

| Instead of | Try |
|---|---|
| "You should have tested that." | "Walk me through what happened." |
| "Be more careful." | "What would have caught this earlier?" |
| "Let me fix it." | "What's the plan, and what do you need from me?" |

**Goal:** they leave with a clearer mental model and ownership of the fix, not shame.

## Handling Underperformance

Underperformance is the hardest part of the job. Handle it **early, directly, and with a path forward**.

### Step 1: Diagnose

Ask: is it **skill**, **will**, **clarity**, or **circumstance**?

| Cause | Signal | Response |
|---|---|---|
| Skill | Can't do the work | Training, pairing, smaller scope |
| Will | Doesn't engage | Direct conversation, motivation, fit |
| Clarity | Doesn't know what's expected | Explicit goals, written expectations |
| Circumstance | Personal, health, burnout | Time, support, EAP, leave |

Misdiagnosing "will" when it's "clarity" is the most common mistake.

### Step 2: Have the conversation

- **Private, specific, timely.**
- Describe the behavior, not the person.
- State the impact.
- State the expectation.
- Ask for their view.
- Agree on a plan with a timeline.

Example:

> "In the last three sprints, two of your committed stories slipped, and the team had to pick them up. I need to understand what's happening. Where are you stuck?"

### Step 3: Create a plan

- Written, specific, time-bound.
- Clear success criteria.
- Regular check-ins (weekly).
- Documented for HR/performance process if needed.

### Step 4: Follow through

- If improved — acknowledge and reset expectations.
- If not — escalate to formal performance process with HR.
- **Never surprise someone in a review.** They should know before the form.

## Feedback: SBI and SBI-R

Two frameworks:



- **SBI:** Situation, Behavior, Impact.
- **SBI-R:** adds **Request** or **Result**.

Example:

> "In yesterday's design review (S), you interrupted the junior engineer three times (B). It made them hesitate to share their ideas (I). Next time, let them finish before responding (R)."

Rules:
- Specific, not general.
- Behavioral, not characterological.
- Timely, not delayed.
- Balanced — reinforce the good as much as you correct the bad.

## Retention

Retention is not a perk problem; it's a **growth and respect** problem.

| Factor | What it looks like |
|---|---|
| Growth | Visible progress, new challenges |
| Autonomy | Ownership of a domain |
| Mastery | Time to deepen skills |
| Purpose | Connection to business impact |
| Belonging | Trusted team, psychological safety |
| Compensation | Fair, transparent, adjusted |
| Manager | Someone who invests in them |

**Lead's job:** watch for the early signals (disengagement, cynicism, quiet quitting), address them directly, and know when the right move for the person is outside the team.

## Tricky Corners ⚠️

- **Don't promote people into roles they aren't ready for** — it's a disservice.
- **Don't hold people back because you need them** — that's how you lose them.
- **Don't confuse mentoring with friendship** — warmth + standards.
- **Don't give feedback only when it's negative** — reinforce the good.
- **Don't wait for review season** to address performance.
- **Don't assume quiet people are happy.**
- **Don't coach when someone needs mentoring.** Sometimes they need an answer.
- **Don't mentor when someone needs sponsorship.** Sometimes they need an advocate.
- **Don't run 1:1s as status updates.** That's what standups are for.
- **Document everything** in performance conversations — memory is unreliable and fairness requires evidence.

## Common Pitfalls

- Skipping 1:1s when busy.
- Only discussing tasks, never growth.
- Avoiding difficult conversations until forced.
- Assuming underperformance is a will problem.
- Promoting based on tenure, not readiness.
- Keeping someone in a role that's not right for them.
- Mentoring without sponsoring.
- Giving feedback in public when it should be private.
- Not writing anything down — no continuity, no fairness.
- Forgetting to celebrate wins — team morale is a lead's job.

## Key Interview Tips

- Lead with **"growing people is the job — mentoring transfers knowledge, coaching draws it out, sponsorship opens doors."**
- For "how do you handle underperformance?", answer with the diagnosis framework (**skill, will, clarity, circumstance**) and the SBI feedback structure.
- For "how do you run 1:1s?", answer **"their agenda, weekly, growth-focused, not status."**
- For "how do you grow an engineer?", answer **"growth plan with concrete actions, evidence, and sponsorship — not just advice."**
- For "how do you retain people?", answer **"growth, autonomy, mastery, purpose, belonging — and honest conversations before it's too late."**
- For "how do you know when to let someone go?", answer **"when their role and their growth are misaligned and you've given clear feedback and support — then help them find a better fit."**
- Always name a **concrete example** from your own experience.

## Related

- [Leadership index](index.md)
- [Code Reviews](code-reviews.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Stakeholder Management](stakeholder-management.md)
- [Behavioral Interviews](behavioral-interviews.md)