# Security Foundations

> **JDK context:** Java 17+ — Jakarta Security, Spring Security 6, JCA/JCE, `java.security`, TLS 1.3. This file covers *strategy and posture*. Deep auth flows live in `authentication-and-authorization.md`; attack classes live in `owasp-and-appsec.md`.

## Mental Model

Security is **risk management**, not a checklist. Every system has an attack surface; every control costs time, money, latency, or user friction. The goal is to reduce risk to an acceptable level for the value of the asset — not to eliminate it.

Three questions drive every security decision:

1. **What are we protecting?** (asset)
2. **Who would attack it, and how?** (threat model)
3. **What control reduces that risk at a cost we can afford?** (mitigation)

| Concept | What it means | Where it shows up |
|---|---|---|
| **Threat model** | Structured reasoning about who attacks what, and why | Design reviews, ADRs |
| **Defense in depth** | Multiple independent layers; no single point of failure | Network, app, data, monitoring |
| **Least privilege** | Every actor gets the minimum access needed | IAM, DB roles, service accounts |
| **Attack surface** | Every place an attacker can interact with the system | Endpoints, ports, deps, humans |
| **Trust boundary** | A line where trust level changes | Browser ↔ API, API ↔ DB, service ↔ service |
| **Assume breach** | Design as if an attacker is already inside | Segmentation, detection, least privilege |
| **Fail secure** | On failure, deny rather than allow | Auth checks, firewalls |

**Guiding principle:** *Reduce the value of the target, increase the cost of the attack, and detect the attack when it happens.*

## Defense in Depth

```d2
direction: down

perimeter: "Perimeter\nWAF, DDoS protection, TLS termination"
network: "Network\nVPC segmentation, security groups, mTLS between services"
app: "Application\nauthN, authZ, input validation, rate limiting"
data: "Data\nencryption at rest, column-level encryption, tokenization"
identity: "Identity\nMFA, short-lived credentials, least privilege"
monitoring: "Monitoring\nlogging, anomaly detection, alerting"

perimeter -> network: "attacker must pass multiple"
network -> app: "no single control\nis sufficient"
app -> data: "compromise of one\nlayer is not fatal"
data -> identity: "secrets are\nisolated"
identity -> monitoring: "misuse is\ndetected"
```

If your only defense against a SQL injection is input validation, you are one missed parameter away from a breach. Layer: parameterized queries **and** least-privilege DB accounts **and** WAF rules **and** query anomaly detection.

## Threat Modeling

The most valuable 90 minutes you can spend on a new system. The goal is not a comprehensive catalogue — it is to surface the *top three* things that would hurt most if compromised.

**STRIDE** (Microsoft) — six threat classes to walk through for each component:

| Threat | Meaning | Example |
|---|---|---|
| **S**poofing | Impersonating an identity | Stolen JWT, forged session cookie |
| **T**ampering | Modifying data in transit or at rest | Changing a price in a request body |
| **R**epudiation | Denying an action | Missing audit logs for a payment |
| **I**nformation disclosure | Exposing data | Verbose error stack traces in prod |
| **D**enial of service | Making the system unavailable | Unbounded query, credential stuffing |
| **E**levation of privilege | Gaining unauthorized access | IDOR: reading another user's order |

**Process (lightweight)**

1. Draw the system: components, data stores, trust boundaries, external actors.
2. For each trust boundary, list assets and actors.
3. Walk STRIDE at each boundary; write down the top risks.
4. For each risk, decide: **mitigate**, **accept**, **transfer** (insurance/partner), or **avoid** (don't build it).
5. Track the decisions as ADRs; revisit when the system changes.

**Threat modelling artifacts to keep:**
- Data flow diagram (with trust boundaries)
- Risk register (asset, threat, likelihood, impact, mitigation, owner)
- Link from each mitigation to a code location or config

## Least Privilege

Every actor — human, service, database user, IAM role — should have the *minimum* permissions required to do its job, for the *shortest* time necessary.

**Concrete rules**

- **Databases:** app uses a role with `SELECT, INSERT, UPDATE, DELETE` on specific tables, **not** `SUPERUSER`. Migrations use a separate role with DDL rights, used only at deploy time.
- **Cloud IAM:** no `*:*` policies. Scope by resource ARN, condition keys, and tags.
- **Service-to-service:** separate identities per service, not a shared "backend" user.
- **Human access:** just-in-time elevation (e.g. break-glass), not standing admin.
- **Secrets:** short-lived tokens > long-lived keys. Rotate. Never share.
- **Tokens:** scoped to the minimum claims and audience, with the shortest TTL that still works.

**Anti-patterns**

- One service account for all services.
- `root`/`sa` for app connections.
- Long-lived API keys checked into repos.
- "Admin for everyone, we trust the team" — insider risk and breach blast radius.

## Attack Surface

**The attack surface is everything an attacker can touch.** Reducing it is cheaper than defending it.

**Inventory your surface**

- Public HTTP endpoints (and versions still alive)
- Public TCP/UDP ports and services
- Dependencies (direct + transitive), including the JDK itself
- Open-source libraries with CVEs
- Public cloud resources (buckets, queues, functions)
- Internal services reachable from the internet by mistake
- CI/CD pipelines (supply chain)
- Employees and contractors (phishing surface)
- Third-party integrations

**Reduce it**

- Delete unused endpoints, decommission old API versions, close ports.
- Remove unused dependencies — every library is a liability.
- Turn off verbose error modes in prod.
- Restrict egress from services (they shouldn't be able to reach arbitrary hosts).
- Segment networks; default-deny firewalls.
- Kill inactive accounts and rotate off old credentials.
- Consolidate services instead of sprawling microservices.

## Security Checklist (per service)

Use this as a lightweight review aid — not a substitute for threat modelling.

**Identity & Access**
- [ ] AuthN at the edge (gateway/ingress), not per-service from scratch
- [ ] AuthZ enforced server-side, never trusted from the client
- [ ] Least-privilege DB role; no shared admin credentials
- [ ] Short-lived tokens, rotated secrets
- [ ] MFA for human admin access
- [ ] Service identities are distinct per service, not shared

**Input & Output**
- [ ] All input validated at the boundary (size, type, format, range)
- [ ] Parameterized queries / prepared statements everywhere
- [ ] Output encoded for its context (HTML, JSON, URL)
- [ ] No verbose stack traces or internal IDs in prod errors

**Data**
- [ ] Encryption in transit (TLS 1.2+ enforced)
- [ ] Encryption at rest for PII and secrets
- [ ] Secrets in a secret manager, never in code or config files in git
- [ ] PII classified, minimized, retention policy enforced
- [ ] Backups encrypted, tested, and access-controlled

**Transport & Network**
- [ ] TLS everywhere, HSTS enabled
- [ ] mTLS between internal services where appropriate
- [ ] Egress restricted; services can't dial arbitrary hosts
- [ ] Default-deny network policies
- [ ] No debug/admin ports exposed publicly

**Logging & Monitoring**
- [ ] Auth failures and authZ denials logged (with actor, action, resource)
- [ ] Sensitive data excluded from logs (passwords, tokens, PII)
- [ ] Alerts on anomalous patterns (login spikes, error spikes, unusual egress)
- [ ] Audit trail for admin actions
- [ ] Retention policy meets compliance needs

**Dependencies & Build**
- [ ] Dependency vulnerability scanning in CI (Snyk, Trivy, OWASP Dependency-Check)
- [ ] SBOM generated and retained per release
- [ ] Base images pinned by digest, not tag
- [ ] Build runs in an isolated environment with limited credentials
- [ ] Signed artefacts; verify before deploy

**Runtime**
- [ ] Rate limiting and quotas on public endpoints
- [ ] Circuit breakers on outbound calls
- [ ] Resource limits (CPU, memory, connections) set
- [ ] Health endpoints don't leak internals
- [ ] Graceful degradation under attack (fail secure)

## Common Security Anti-Patterns

- **Security as a final step** — bolted on at the end instead of designed in.
- **Checklist-driven security** — every box ticked, no threat model.
- **Trusting the client** — validation only in the browser or mobile app.
- **"We're behind a VPN, so we're safe"** — flat internal networks are a breach amplifier.
- **One giant admin role** for humans and services.
- **Secrets in git** — even in a private repo, even in a deleted commit.
- **Log-and-forget** — logs are collected, never inspected.
- **Shared credentials** between environments.
- **Custom crypto** — rolling your own instead of using vetted libraries.
- **Treating compliance as security** — PCI/HIPAA/SOC2 certify a snapshot; they don't guarantee security.

## Key Interview Tips

- **Lead with threat modelling.** It signals senior thinking; "we do OWASP" does not.
- **Name the trust boundaries** in the system you're describing — browser ↔ API, API ↔ DB, service ↔ service.
- **Defense in depth, with a concrete example.** Two or three independent controls on the same risk.
- **Least privilege with a DB role example.** "App can't drop tables" is memorable.
- **Attack surface reduction** — mention decommissioning old API versions and dependency pruning.
- **Assume breach.** Explain segmentation, audit logs, and least privilege as containment.
- **Link to shift-left.** Security belongs in the pipeline, not in a pre-release audit.
- **Know the difference between authentication and authorization** at a sentence level before going deep into flows.
- **Mention compliance as a floor, not a ceiling.**

## Related

- [Authentication & Authorization](authentication-and-authorization.md)
- [OWASP & AppSec](owasp-and-appsec.md)
- [Shift-Left](../leadership/shift-left.md)
- [Microservices Security](../microservices-patterns/security.md)
- [Observability](../observability/index.md)