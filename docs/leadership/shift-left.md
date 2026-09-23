# Shift-Left

> **Context:** Delivery and quality leadership. This file is about moving quality, security, and observability activities *earlier* — where the cost of fixing problems is lowest.

## Mental Model

The cost of fixing a defect grows by roughly an **order of magnitude per phase**. A requirement misunderstanding caught in refinement costs minutes; the same misunderstanding shipped to production costs weeks of incident response, hotfixes, and trust repair.

**Shift-left** means moving detection and prevention activities to earlier stages — where they're cheap, fast, and don't require production to be affected.

```d2
direction: right

req: "Requirements\ncost: 1x"
design: "Design\ncost: 3-5x"
build: "Build\ncost: 10x"
test: "Test\ncost: 15-40x"
prod: "Production\ncost: 100-1000x"

req -> design: "shift-left target"
design -> build: "shift-left target"
build -> test: "shift-left target"
test -> prod: "shift-left target"
```

**Key idea:** shift-left is not "do more testing". It's *move the detection earlier* so you can fix cheap. The activities themselves change shape — a security review becomes a scanning gate; a load test becomes a perf budget in CI.

## The Cost Curve

Why shift-left matters, quantitatively:

| Defect found in | Typical relative cost | Why |
|---|---|---|
| Requirements | 1× | A conversation, a document edit |
| Design | 3–5× | Rework design, adjust plans |
| Build | 10× | Rewrite code, re-review, re-test |
| Test / QA | 15–40× | Re-test, re-verify, investigate failures |
| Production | 100–1000× | Incident, on-call, hotfix, customer impact, trust |

The ratios are approximate but directionally correct. Every organisation that measures this finds the same shape.

**Implication:** investing in earlier detection almost always pays. Static analysis, code review, unit tests, contract tests, and threat modelling are cheap compared to production incidents.

## What Shifts

### Testing shifts left

- **From:** QA phase before release.
- **To:** developers write tests as they code; unit + integration + contract tests in CI on every commit.
- **Tools:** JUnit, Testcontainers, WireMock, Pact, mutation testing.
- **Signal:** cycle time goes down; escaped defects go down.

### Security shifts left (DevSecOps)

- **From:** pre-release security audit.
- **To:** threat modelling at design; SAST/DAST/dependency scanning on every PR; secrets scanning in pre-commit.
- **Tools:** Semgrep, CodeQL, Snyk, Trivy, gitleaks, OWASP Dependency-Check.
- **Signal:** critical CVEs caught before merge; secrets never reach main.

### Quality shifts left

- **From:** "test at the end".
- **To:** linting, static analysis, code review, pair programming, TDD.
- **Tools:** SpotBugs, Error Prone, Sonar, Checkstyle, formatter-as-CI-gate.
- **Signal:** review comments are about design, not style.

### Observability shifts left

- **From:** "we'll add logging when it breaks".
- **To:** structured logs, metrics, and traces from day one; SLOs defined before launch; dashboards built with the service.
- **Tools:** OpenTelemetry, Micrometer, structured logging.
- **Signal:** new services have dashboards and alerts before the first incident, not after.

### Performance shifts left

- **From:** load test before release.
- **To:** performance budgets in CI; micro-benchmarks on hot paths; regression tests for known-sensitive code.
- **Tools:** JMH, Gatling, k6, `@Benchmark` in CI.
- **Signal:** performance regressions are caught by CI, not users.

### Compliance shifts left

- **From:** evidence gathering before an audit.
- **To:** evidence generated automatically by CI/CD (deploy logs, test reports, access reviews).
- **Tools:** pipeline artefacts, signed builds, SBOMs.
- **Signal:** audit preparation is a report generation, not a project.

## DevSecOps

DevSecOps is shift-left applied to security. The idea: security is not a gate at the end — it's embedded in every stage.

```d2
direction: right

plan: "Plan\nthreat model\nsecurity requirements"
code: "Code\nsecrets scan\nSAST pre-commit"
build: "Build\ndependency scan\nSBOM"
test: "Test\nDAST\ncontract tests"
release: "Release\nsigned artefacts\npolicy as code"
deploy: "Deploy\nruntime security\nconfig scan"
operate: "Operate\nSIEM\nanomaly detection"
monitor: "Monitor\nfeedback into\nthreat model"

plan -> code: "shift-left"
code -> build: "shift-left"
build -> test: "shift-left"
test -> release: "shift-left"
release -> deploy: "shift-left"
deploy -> operate: "shift-left"
operate -> monitor: "feedback"
monitor -> plan: "iterate"
```

**DevSecOps in practice**
- **Pre-commit:** secrets scanning (gitleaks), formatting.
- **PR CI:** SAST (Semgrep, CodeQL), dependency scanning (Snyk, Trivy), IaC scanning (Checkov, tfsec).
- **Build:** SBOM generation (CycloneDX), image scanning.
- **Deploy:** policy as code (OPA, Kyverno), signed images (cosign).
- **Runtime:** WAF, runtime security (Falco), anomaly detection.
- **Operate:** SIEM, threat intelligence.

**Rules**
- **Never block on every finding.** Prioritise: critical/high block; medium/low warn.
- **Automate the boring parts.** Secrets scanning, dependency updates, SBOM.
- **Keep humans in the loop for judgement calls.** Threat modelling, incident response, business-logic abuse.
- **Measure security the same way you measure delivery** — MTTR for vulnerabilities, % of CVEs patched within SLA.

## CI Gates

Shift-left in practice is largely about **CI gates** — automated checkpoints that block bad changes from progressing.

| Stage | Gate | Blocks on |
|---|---|---|
| Pre-commit | Format, secrets scan | Formatting violations, detected secrets |
| PR | Unit tests, SAST, dependency scan | Test failure, new high CVEs |
| PR | Code review approval | Missing approval |
| Merge to main | Full build, integration tests, contract tests | Any failure |
| Pre-deploy | Image scan, policy check, SBOM | Critical CVEs, policy violations |
| Deploy | Canary / blue-green | Error rate / latency regression |
| Post-deploy | Smoke tests | Critical journey failure |

**Rules for gates**
- **Fast gates first.** A gate that takes 30 minutes kills developer flow.
- **Fail loud, fail early.** A failed gate should be visible immediately.
- **Actionable messages.** "Test X failed at line Y" beats "build failed".
- **Allow overrides with justification.** Sometimes a gate is wrong; a documented override is fine.
- **Never bypass a gate "just this once"** without recording it — that's how shortcuts become culture.
- **Keep gates green.** A red gate that stays red is ignored.

## TDD as Shift-Left

**TDD is the purest form of shift-left testing.** The test is written *before* the code — so verification is built into the act of writing the code, not a separate phase.

See `testing/tdd-bdd-atdd.md` for depth. The shift-left angle:

- **Defect prevention > defect detection.** Writing the test first forces you to define correctness before implementation.
- **Feedback in seconds.** Failures are caught at the developer's desk, not in QA or prod.
- **Design pressure.** The interface gets designed from the caller's perspective.
- **Refactor safety.** Enables continuous improvement without regressions.

## Cultural Shift

Shift-left is a **cultural change**, not a tool change. It requires:

- **Developers own quality.** Not "QA will find it".
- **Developers own security.** Not "security team will audit it".
- **Developers own observability.** Not "SRE will add the dashboard".
- **Failing gates are normal.** Not embarrassing.
- **Fast feedback is a priority.** Not a nice-to-have.
- **Blameless culture.** Incidents are systems problems, not people problems.

**Anti-signals (shift-left is failing)**
- "QA will catch it."
- "That's the security team's job."
- "We don't have time for tests."
- "Just bypass the gate this once."
- "It works on my machine."
- Separate "dev" and "ops" teams with handoffs.

## Measuring Shift-Left

You can't manage what you don't measure. Metrics that show shift-left working:

| Metric | Direction | Why |
|---|---|---|
| Escaped defect rate | ↓ | Bugs found in prod vs pre-prod |
| Change failure rate | ↓ | DORA — % of deploys causing incidents |
| MTTR | ↓ | DORA — recovery speed |
| Lead time for changes | ↓ | DORA — commit to prod |
| % of CVEs patched within SLA | ↑ | Security responsiveness |
| Mean time to patch critical CVE | ↓ | Security health |
| Test execution time in CI | ↓ | Developer feedback speed |
| Cost of fixing a defect (avg) | ↓ | Cheaper fixes over time |

**The pattern:** shift-left reduces the *number* of expensive fixes by catching problems earlier, and it reduces the *cost per fix* because fixes happen at the developer's desk.

## Tricky Corners ⚠️

- **Shift-left ≠ do more work.** It's a *rebalancing* — more testing earlier, less firefighting later. Net effort often drops.
- **Shift-left ≠ no security team.** Specialists still exist; their job shifts from finding bugs to enabling developers.
- **Shift-left ≠ no QA.** QA's role shifts from manual testing to test strategy, exploratory testing, tooling, and coaching.
- **Gates that block everything** destroy shift-left adoption. Prioritise ruthlessly.
- **Shift-left can be weaponised.** Used to justify layoffs of QA or security staff, it fails. The skill is *redistributed*, not removed.
- **Not all activities shift equally.** Threat modelling and exploratory testing don't automate; they still need humans. Their *timing* shifts left, not their nature.
- **CI speed matters.** A 45-minute CI is not shift-left — it's a bottleneck. Aim for under 10 minutes for the fast gate.
- **Flaky tests kill gate credibility.** A flaky gate is worse than no gate (see `testing/index.md` on quarantine policy).
- **Culture eats tooling.** Buying Snyk doesn't shift security left if developers don't act on findings.
- **Observability shift-left is often forgotten.** Dashboards built with the service, not after the first incident.
- **SBOM and provenance** are increasingly required (SLSA, EO 14028). Plan for them.

## Common Pitfalls

- Buying tools before changing culture.
- Blocking PRs on low-severity findings — kills adoption.
- No fast gate — developers wait 30+ minutes for feedback.
- Flaky tests in the required pipeline.
- Gates that can be bypassed silently.
- Red gates that stay red.
- "QA will catch it" mindset.
- Security as an afterthought — pen test before launch finds dozens of criticals.
- No observability until the first incident.
- Skipping retro / post-incident learning.
- Assuming shift-left means "no specialists". It means *more* specialists, doing higher-leverage work.

## Key Interview Tips

- **Lead with the cost curve.** Defect cost grows ~10× per phase; that's the whole justification.
- **Shift-left is a culture change** — say this explicitly.
- **DevSecOps is shift-left for security.** Mention the pipeline stages: pre-commit, PR, build, deploy, runtime.
- **TDD is the purest shift-left testing.** Reference it.
- **Gates must be fast and prioritised.** "Block on critical only" is a senior signal.
- **Flaky tests kill gate credibility.** Mention the quarantine policy.
- **QA and security roles shift, not disappear.** Distributed responsibility doesn't mean no specialists.
- **Measure with DORA + security metrics.** Shift-left should move MTTR, change failure rate, and CVE patch times.
- **CI speed is a first-class concern.** A 45-minute gate isn't shift-left.
- **Observability shift-left** is often forgotten — mention structured logs and SLOs defined before launch.
- **Link to SDLC** for the lifecycle context.

## Related

- [SDLC Lifecycle](sdlc-lifecycle.md)
- [Agile Ceremonies](agile-ceremonies.md)
- [North Star Metrics](north-star-metrics.md)
- [Testing Strategy](../testing/index.md)
- [OWASP & AppSec](../security/owasp-and-appsec.md)