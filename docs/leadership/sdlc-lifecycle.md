# SDLC Lifecycle

> **Context:** Software delivery leadership. This file covers the *shape of the delivery lifecycle* and how modern practice differs from classical models.

## Mental Model

The **Software Development Life Cycle (SDLC)** describes how software moves from idea to running production service, and back to improvement. Every model is an answer to the same question: *how do we sequence requirements, design, build, test, deploy, and operate?*

The traditional answer was **waterfall** — do each phase once, in order. The modern answer is **iterative and continuous** — small slices, each going through every phase, with feedback driving the next slice.

```d2
direction: down

requirements: "Requirements\nwhat problem?"
design: "Design\nhow will we solve it?"
build: "Build\nwrite the code"
test: "Test\nprove it works"
deploy: "Deploy\nship to users"
operate: "Operate\nrun and observe"
feedback: "Feedback\nlearn and iterate"

requirements -> design: "phase"
design -> build: "phase"
build -> test: "phase"
test -> deploy: "phase"
deploy -> operate: "phase"
operate -> feedback: "learn"
feedback -> requirements: "iterate"
```

**Key insight:** the phases are still there — they haven't disappeared. What changed is **how often each phase runs** and **how small each pass is**. Waterfall runs the whole cycle once per release (months). DevOps runs the whole cycle many times per day (minutes).

## Classical Models

### Waterfall

Sequential. Each phase completes before the next begins. Requirements freeze early.

**Pros**
- Clear contracts between phases.
- Good for fixed-scope, fixed-price contracts.
- Predictable if requirements truly are stable.

**Cons**
- Feedback arrives too late (end of project).
- Change is expensive — a requirements change at month 9 costs orders of magnitude more than at month 1.
- Testing is a phase, not a continuous activity.
- Assumes requirements can be known in advance — usually false.

**When it's still appropriate**
- Construction and civil engineering-style projects (fixed, physical deliverables).
- Highly regulated submissions where change is contractually difficult.
- Short projects with truly stable requirements.

### Iterative / Incremental

Break the work into iterations; each delivers a working slice.

- **Iterative** — repeated passes over the whole system, refining each time.
- **Incremental** — each pass adds a new piece of functionality.
- **Iterative + Incremental** — most modern approaches are both: repeated passes that each add working, refined functionality.

**Pros**
- Feedback arrives earlier.
- Risk is spread across iterations.
- Change is cheaper — you catch misalignment early.

**Cons**
- Requires discipline to actually ship each iteration.
- Architecture can suffer without upfront thinking.

### Agile

A philosophy (Agile Manifesto, 2001) — not a process. Values:

- Individuals and interactions over processes and tools.
- Working software over comprehensive documentation.
- Customer collaboration over contract negotiation.
- Responding to change over following a plan.

**Scrum, Kanban, XP, SAFe, LeSS** are specific implementations. Agile is the "why"; the frameworks are "how".

### DevOps

Cultural and technical movement to **unify development and operations**. The main ideas:

- **You build it, you run it.** The team that writes the code operates it.
- **Automate everything** — CI, CD, IaC, monitoring.
- **Small, frequent changes** are safer than large, infrequent ones.
- **Measure delivery health** — DORA metrics.
- **Blameless culture** — incidents are system failures, not people failures.

DevOps is not a role; it's a way of organizing around delivery.

## The Phases Today

The classical phases still exist, but each looks different in modern practice.

| Phase | Classical | Modern |
|---|---|---|
| **Requirements** | Document signed off before design | Continuous discovery, refined per sprint |
| **Design** | Upfront design document | Emergent design + ADRs + design reviews for critical decisions |
| **Build** | Months of coding | Small PRs, trunk-based development, feature flags |
| **Test** | QA phase before release | Automated tests in CI, shift-left, contract tests |
| **Deploy** | Quarterly release train | Continuous deployment, blue/green, canary |
| **Operate** | Hand-off to ops | Team owns production; SLOs, on-call, runbooks |
| **Feedback** | Post-mortem after a problem | Continuous measurement, retros, user analytics |

The phases are **smaller and parallel** now. A single change might go through requirements (ticket), design (ADR), build (a PR), test (CI), deploy (canary), operate (metrics), and feedback (retro) — all within a day.

## Modern SDLC

A representative modern flow:

```d2
direction: right

idea: "Idea\n+ discovery"
design: "Design\nADR + API spec"
build: "Build\nsmall PRs, tests"
ci: "CI\nunit + integration + contract + security"
cd: "CD\ncanary / blue-green"
observe: "Observe\nmetrics, logs, traces"
learn: "Learn\nretro, iterate"

idea -> design: "clarify"
design -> build: "contract"
build -> ci: "push"
ci -> cd: "green"
cd -> observe: "release"
observe -> learn: "data"
learn -> idea: "next slice"
```

**Key properties**

- **Small batches.** One change at a time.
- **Continuous integration.** Every commit is built and tested.
- **Continuous delivery.** Every green commit is deployable.
- **Feature flags.** Decouple deploy from release.
- **Observability.** SLOs, alerts, dashboards.
- **Automated rollback.** Fast recovery from bad deploys.
- **Blameless postmortems.** Learn from failure.

## Shift-Left in Context

**Shift-left** means moving activities (testing, security, quality, observability) *earlier* in the lifecycle — where problems are cheap to fix. It's covered in depth in `shift-left.md`, but its place in the SDLC is fundamental:

- **Testing** moves from "QA phase" to "developer writes tests as they code".
- **Security** moves from "pre-release audit" to "scanning every PR".
- **Performance** moves from "load test before release" to "perf budgets in CI".
- **Observability** moves from "we'll add logging later" to "structured logs and traces from day one".

The cost of fixing a bug grows by roughly an order of magnitude per phase. Shift-left exploits this.

## Cost of Fixing Bugs by Phase

The most under-invested chart in software delivery:

| Phase found | Relative cost to fix |
|---|---|
| Requirements | 1× |
| Design | 3–5× |
| Build | 10× |
| Test / QA | 15–40× |
| Production | 100–1000× |

**Implication:** the earlier you catch a defect, the cheaper it is. This is why:

- Automated tests run on every commit.
- Static analysis runs before code review.
- Threat modelling happens at design time.
- Contract tests catch API breaks before deploy.
- Canary deploys catch regressions before they hit all users.

## Choosing an SDLC Model

| Context | Model |
|---|---|
| Fixed-scope, fixed-price contract, stable requirements | Waterfall or iterative |
| Product with evolving requirements | Agile (Scrum/Kanban) |
| Multiple teams on one product | Scaled Agile (LeSS, Nexus, SAFe) |
| Continuous deployment to cloud | DevOps + CD + trunk-based |
| Regulated industry with audit requirements | Agile + compliance gates + automated evidence |
| Small team, startup | Kanban + CI/CD + feature flags |

**Rule:** the model should fit the constraints. There is no universal "best" — only best-for-context.

## Delivery Health Metrics

Modern SDLC tracks delivery health via **DORA metrics** (see `north-star-metrics.md`):

- **Deployment frequency** — how often you ship.
- **Lead time for changes** — commit to production.
- **Change failure rate** — % of deploys causing incidents.
- **Mean time to restore (MTTR)** — recovery speed.

**Elite performers** ship multiple times per day, with lead times under an hour, change failure rates under 15%, and MTTR under an hour.

These aren't targets to game — they're **signals of system health**. A team with a slow lead time has a system problem: too much WIP, too many handoffs, too much manual work.

## Tricky Corners ⚠️

- **Waterfall vs Agile is not binary.** Real projects sit on a spectrum. A regulated feature can have waterfall-like gates inside an agile delivery pipeline.
- **"Agile" is often used to describe Scrum.** They're not the same — Agile is the philosophy; Scrum is one implementation.
- **DevOps is not a role.** Naming a "DevOps engineer" often hides an org that hasn't done DevOps.
- **Continuous delivery ≠ continuous deployment.** CD (delivery) means every green commit *can* be deployed; CD (deployment) means every green commit *is* deployed. Both are valid; be precise.
- **Feature flags decouple deploy from release.** Critical distinction for safe continuous delivery.
- **Small batches are safer.** A 500-line PR is harder to review and riskier to deploy than 20 PRs of 25 lines.
- **Trunk-based development** is a precondition for elite delivery. Long-lived feature branches are a bottleneck.
- **You can't fix a slow SDLC with more process.** You fix it by reducing handoffs, WIP, and manual steps.
- **Regulated environments can still be agile.** Auditors care about evidence, not ritual. Automated evidence is *stronger* than paperwork.
- **Retros are not optional** — the "learn" step is what makes the lifecycle improve. Skipping it turns agile into "waterfall in sprints".

## Common Pitfalls

- Adopting a framework (Scrum, SAFe) without understanding the SDLC problem it solves.
- Treating requirements as frozen once a sprint starts — reality changes; the sprint goal is a forecast, not a contract.
- Skipping design because "agile means no design". Emergent design still needs thinking.
- Manual deployment steps — they're the biggest source of delivery pain.
- Long-lived feature branches — they cause merge hell and delay feedback.
- No feature flags — every deploy is a release, every release is risky.
- Testing as a phase, not a continuous activity.
- No rollback plan — every release is a one-way door.
- Skipping retrospectives because "we're too busy" — the moment you most need them.
- Optimising one DORA metric (e.g. deployment frequency) while ignoring others (change failure rate).

## Key Interview Tips

- **Phases still exist; the cadence changed.** Say this to preempt "agile means no design" misconceptions.
- **Waterfall isn't always wrong.** Fixed-scope, stable requirements, regulatory — name the contexts.
- **Agile ≠ Scrum.** Agile is the philosophy; Scrum is a framework. Interviewers notice the distinction.
- **DevOps is a culture, not a role.** "You build it, you run it."
- **Continuous delivery vs continuous deployment.** Precision matters.
- **Small batches are the single biggest lever** for delivery health.
- **DORA metrics** — name all four; they're the standard vocabulary.
- **Cost of defects by phase** — cite the ratio; it justifies shift-left.
- **Trunk-based development + feature flags** — the modern delivery pattern.
- **Regulated environments can still be modern.** Automated evidence beats paperwork.
- **Link to shift-left** for the "when to catch problems" discussion.

## Related

- [Shift-Left](shift-left.md)
- [Agile Ceremonies](agile-ceremonies.md)
- [SAFe & Scaling Agile](safe-and-scaling-agile.md)
- [North Star Metrics](north-star-metrics.md)
- [Testing Strategy](../testing/index.md)