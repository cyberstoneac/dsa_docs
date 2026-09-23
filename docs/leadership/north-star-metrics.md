# North Star Metrics

> **Context:** Product and engineering leadership. This file is about *choosing and using* metrics, not about analytics tooling.

## Mental Model

A **north star metric** is a single measure that best captures the value your product delivers to customers. It should:
- Move when customers get value.
- Be influenced by the whole team, not just one function.
- Be leading (predictive of future success), not just lagging.
- Be simple enough that everyone remembers it.

The north star is a **compass, not a dashboard**. It points the direction; the team uses other metrics to steer.

```d2
direction: down

northStar: "North Star\ncustomer value delivered"
inputs: "Input Metrics\nteam-influenced drivers"
outputs: "Output Metrics\noutcomes (revenue, growth)"
guardrails: "Guardrails\nquality, cost, safety"

northStar -> inputs: "decomposed into"
inputs -> outputs: "leads to"
northStar -> guardrails: "constrained by"
```

**Key insight:** the north star is a *strategic choice*. Two companies in the same space can legitimately pick different north stars, because they reflect different bets about what drives long-term success.

## The Four Properties of a Good North Star

| Property | Meaning | Bad example | Good example |
|---|---|---|---|
| **Customer value** | Measures value delivered, not captured | Revenue per user | Weekly orders delivered |
| **Leading** | Predicts future success | Quarterly revenue | Weekly active creators |
| **Team-influenced** | Whole team can move it | Stock price | Daily active users |
| **Simple** | Everyone remembers it | A composite score with 12 weights | "Nights booked" |

**Frameworks** (Airbnb, Facebook, Spotify) all agree on these properties; they differ only in the specific metric.

## Classic Examples

| Company | North star | Why |
|---|---|---|
| **Airbnb** | Nights booked | Direct measure of value (host earns, guest stays) |
| **Spotify** | Time spent listening | Proxy for engagement + content value |
| **Facebook (early)** | Monthly active users | Growth as proxy for network value |
| **Facebook (later)** | Daily active users / meaningful social interactions | Shifted as the network matured |
| **Netflix** | Hours streamed | Engagement predicts retention |
| **Uber** | Rides completed | Direct value delivered |
| **Slack** | Messages sent within a team | Collaboration value delivered |
| **Amplitude** | Weekly Qualified Active Users (WQAU) | Balance of engagement and quality |

Notice how the metric **evolves** as the company matures. North stars are not permanent.

## OKRs vs KPIs vs North Star

Frequently conflated. They serve different purposes.

| Concept | Scope | Time horizon | Purpose |
|---|---|---|---|
| **North star** | Company or product line | Long-term (years) | Direction |
| **OKRs** | Team or individual | Quarterly | Focus and alignment |
| **KPIs** | Function or process | Continuous | Health monitoring |
| **Input metrics** | Team-influenced drivers | Weekly/monthly | Levers |
| **Guardrails** | Constraints | Continuous | Prevent harm |

**Example**

- **North star:** Nights booked.
- **Q1 OKR:** Increase repeat bookings from 40% to 45%.
- **KPI:** Booking conversion rate, cancellation rate.
- **Input metric:** Search-to-book rate, host response time.
- **Guardrail:** Support ticket rate, safety incidents.

The OKR is *in service of* the north star. The KPIs tell you if the system is healthy. The guardrails stop you from winning at the expense of something important.

## Input vs Output Metrics

- **Output metrics** are outcomes: revenue, bookings, active users.
- **Input metrics** are drivers the team can directly influence: page load time, onboarding completion, feature adoption.

**You manage inputs; outputs follow.** A team that tries to directly move revenue will make short-term, harmful choices. A team that moves inputs — retention, activation, satisfaction — moves revenue durably.

```d2
direction: right

inputs: "Inputs\n(team controls)\nonboarding completion\nsearch latency\nfeature adoption"
outputs: "Outputs\n(emergent)\nretention\nrevenue\nNPS"

inputs -> outputs: "drive"
```

**Rule:** every OKR should target an **input** metric, not an output metric. Outputs are the score, not the play.

## Leading vs Lagging Indicators

- **Lagging:** revenue, churn, NPS — measure the past.
- **Leading:** signups, activation rate, feature usage — predict the future.

North stars are usually leading (they predict future revenue). Lagging metrics are what the business ultimately cares about, but they're too slow to steer by.

**The trap:** lagging metrics feel comfortable because they're familiar. Leading metrics feel uncertain because you're betting on a hypothesis. Do it anyway — you can't steer by the rearview mirror.

## Designing a North Star

A lightweight process:

1. **Define the value.** What does the customer get when they use the product well?
2. **Find a measure of that value.** Frequency? Depth? Completion? Time-to-value?
3. **Test the metric against the four properties** (customer value, leading, team-influenced, simple).
4. **Decompose into inputs.** What 3–5 things drive the north star?
5. **Identify guardrails.** What must not get worse while we push the north star?
6. **Set targets.** Quarterly OKR on one or two inputs.
7. **Instrument.** If you can't measure it weekly, you can't manage it.
8. **Review quarterly.** Is the metric still measuring value, or has it become a game?

## Common North Star Shapes

| Shape | Definition | Best for | Example |
|---|---|---|---|
| **Frequency** | "X actions per user per period" | Habitual products | Messages sent per week |
| **Depth** | "X items consumed/created per user" | Content platforms | Videos watched per week |
| **Breadth** | "X users doing the key action" | Marketplaces | Monthly buyers |
| **Time** | "X minutes per user per week" | Attention-based products | Hours streamed |
| **Completion** | "X journeys completed successfully" | Transactional products | Orders delivered |
| **Quality-weighted** | "X actions × quality score" | Products with bad actors | Meaningful social interactions |

**Rule:** choose the shape that matches how your product delivers value. A ride-hailing app's value is completion, not time in app. A music app's value is time (and repetition), not completion.

## Good vs Bad Metrics

**Good metric characteristics**
- Moves with customer value (correlated, ideally causal).
- Team-influenced within a quarter.
- Hard to game without harming the product.
- Measurable weekly or daily.
- Understandable without explanation.

**Bad metric characteristics**
- **Vanity metrics** — cumulative totals (total signups, total downloads) that always go up.
- **Output-only metrics** — revenue, stock price; not directly influenceable.
- **Easily gamed metrics** — page views (clickbait), time-in-app (dark patterns), tickets closed (skipped work).
- **Composite black boxes** — 15-weighted score nobody understands.
- **Multi-purpose metrics** — used for both OKRs and bonuses, leading to manipulation.

**Examples**

| Bad metric | Why | Better alternative |
|---|---|---|
| Total registered users | Cumulative, always up | Weekly active users |
| Page views | Clickbait-prone | Qualified sessions |
| Time in app | Rewards dark patterns | Meaningful interactions |
| Tickets closed | Rewards fast, shallow work | Tickets closed without reopening |
| Code coverage | Gameable | Change failure rate |
| Story points delivered | Gameable, not customer value | Cycle time |

## Metric Anti-Patterns

- **Goodhart's Law:** when a measure becomes a target, it ceases to be a good measure. Applies to every metric on this list. Guardrails exist to catch the damage.
- **Metric theatre:** the metric exists; nobody uses it in decisions.
- **Metric sprawl:** 20 metrics on the dashboard, none of them driving behaviour.
- **Tunnel vision:** optimising the north star at the expense of everything else.
- **Gaming:** the team finds a way to move the metric without delivering value.
- **Proxy drift:** the metric stops being a good proxy for value as the product evolves.
- **Retroactive target-setting:** changing the metric definition when the number goes the wrong way.

**Mitigations**
- **Pair with guardrails** so gaming harms a visible secondary metric.
- **Review quarterly** — retire or change metrics when they stop being useful.
- **Communicate inputs, not just outputs.** Tell the team *how* to move the metric.
- **Rotate dashboards.** If nobody's looked at a metric in a month, delete it.
- **Use metrics for learning**, not judgement. The moment a metric becomes a bonus input, it becomes unreliable.

## Engineering Metrics (DORA + Others)

For engineering teams, the north star is a **product** metric. Engineering-specific metrics guide *how* the team delivers.

**DORA metrics**
- **Deployment frequency** — how often you ship.
- **Lead time for changes** — commit to production.
- **Change failure rate** — % of deploys causing incidents.
- **Mean time to restore (MTTR)** — how fast you recover.

**Additional**
- **Cycle time** — work start to finish.
- **WIP (Work In Progress)** — what's in flight; lower is usually better.
- **Escaped defects** — bugs found in prod vs caught pre-prod.
- **Review latency** — PR open to first review.
- **On-call load** — pages per shift.

**Rule:** engineering metrics are **diagnostic**, not targets. Optimising "deployment frequency" by shipping trivial PRs is a classic Goodhart failure. Use them to spot friction, not to score teams.

## Decomposing the North Star

A well-designed north star **decomposes into a tree** the team can act on.

```d2
direction: down

north: "Nights booked"
demand: "Demand\nsearches, hosts, quality"
supply: "Supply\nlistings, availability, price"
conversion: "Conversion\nsearch-to-book, checkout"
retention: "Repeat\nhost rating, guest rating"

north -> demand
north -> supply
north -> conversion
north -> retention
```

Each branch becomes a candidate for team ownership. **One team, one input metric** — this is how OKRs stay crisp.

**Example decomposition for a SaaS product (Weekly Active Teams):**

- **Acquisition:** new team signups → team inviter → first invite accepted.
- **Activation:** invited members → joined → completed first action.
- **Engagement:** messages sent per team per week → files shared per team per week.
- **Retention:** week-over-week return rate → seat expansion.

Each input is measurable, team-influenceable, and leading.

## Tricky Corners ⚠️

- **North star ≠ OKR.** The north star is directional and long-term; OKRs are quarterly and specific.
- **One north star per product.** Multiple north stars means no north star.
- **Metrics change as the product matures.** Facebook's early MAU → later meaningful interactions is the canonical example. Be willing to update.
- **Cumulative metrics are vanity.** "Total users" always goes up. Use periodic-actives instead.
- **Time-in-app rewards dark patterns.** Weight quality; don't ship infinite scroll just to move the number.
- **Proxy metrics drift.** A metric that was a good proxy last year may not be this year.
- **Guardrails must be real.** If the guardrail never triggers, either the metric is safe or the guardrail isn't measured.
- **Bonus-linked metrics get gamed.** Separate the metrics you *report* from the metrics you *reward*, or be prepared for Goodhart.
- **DORA metrics are diagnostic.** Don't target "deploy frequency" without a guardrail on change failure rate.

## Common Pitfalls

- Choosing revenue as a north star — an output, not a lever.
- Multiple north stars — signals fuzzy strategy.
- Vanity metrics (total users, downloads) that always go up.
- No guardrails — optimising the metric until something else breaks.
- Metrics that no team can influence — the team disengages.
- Never revisiting the metric as the product evolves.
- Metrics that reward the wrong behaviour (page views → clickbait).
- Dashboards with 30 metrics nobody looks at.
- Confusing OKRs (quarterly targets) with KPIs (health monitoring) with the north star (direction).
- No decomposition — team knows the north star but not their part in it.

## Key Interview Tips

- **Define the north star as a strategic choice**, not a dashboard metric.
- **The four properties** — customer value, leading, team-influenced, simple. Recite them.
- **Distinguish north star, OKR, KPI, input, output.** Interviewers ask this.
- **Airbnb's "nights booked"** — know at least one canonical example.
- **OKRs target inputs, not outputs.** This is the senior signal.
- **Goodhart's Law** — mention guardrails as the mitigation.
- **Vanity metrics** — call out cumulative totals.
- **DORA metrics** for engineering health. Name all four.
- **Decomposition** — show a north star broken into team-level inputs.
- **Willingness to change** — the metric evolves as the product matures.

## Related

- [Agile Ceremonies](agile-ceremonies.md)
- [SAFe & Scaling Agile](safe-and-scaling-agile.md)
- [SDLC Lifecycle](sdlc-lifecycle.md)
- [Delivery & Planning](delivery-and-planning.md)
- [Stakeholder Management](stakeholder-management.md)