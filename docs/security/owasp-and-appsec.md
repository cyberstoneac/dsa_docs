# OWASP & AppSec

> **JDK context:** Java 17+ — Spring Boot 3, Jakarta Validation, Hibernate, Jackson, OWASP Dependency-Check, Java security libraries. This file is about the *attacks and their mitigations*, not about running a security program.

## Mental Model

The **OWASP Top 10** is a periodic ranking of the most critical web application security risks. It is not a checklist to tick once — it is a lens for reviewing design, code, dependencies, and deployment. Every entry has a family of attacks underneath it; the top-level category is the entry point for reasoning.

| # | Risk | Root cause | Primary mitigations |
|---|---|---|---|
| A01 | Broken Access Control | Missing or wrong authZ checks | Deny by default, server-side checks, ownership validation |
| A02 | Cryptographic Failures | Weak or missing crypto | TLS everywhere, strong hashing, proper key management |
| A03 | Injection | Untrusted input reaches an interpreter | Parameterized queries, output encoding, allowlists |
| A04 | Insecure Design | Missing threat model / unsafe assumptions | Threat modelling, secure design patterns, business-logic tests |
| A05 | Security Misconfiguration | Defaults, debug, verbose errors | Hardening, disable defaults, minimal surface |
| A06 | Vulnerable & Outdated Components | Unpatched dependencies | SBOM, scanning, patch SLAs |
| A07 | Identification & Authentication Failures | Weak authN | MFA, rate limits, secure session handling |
| A08 | Software & Data Integrity Failures | Unsigned artefacts, unsafe deserialization | Signing, verification, safe formats |
| A09 | Security Logging & Monitoring Failures | No visibility | Structured logs, detection, alerting |
| A10 | Server-Side Request Forgery (SSRF) | Server fetches untrusted URL | Allowlists, network egress control, metadata endpoint blocks |

**The most important insight:** OWASP categories are **outcomes**, not root causes. Two systems with the same category violated can have wildly different bugs. Read the category, then reason about *your* system.

## A01 — Broken Access Control

The number-one risk. Access control that is missing, wrong, or trivially bypassable.

**Common bugs**

- **IDOR** (Insecure Direct Object Reference): `/orders/{id}` doesn't check ownership.
- **Missing function-level check**: `/admin/users` requires login but not admin role.
- **Force browsing**: guessing URLs, hidden endpoints, alternate HTTP methods.
- **CORS misconfiguration**: `Access-Control-Allow-Origin: *` with credentials.
- **JWT role confusion**: trusting a claim the client can set.
- **Path traversal**: `../../etc/passwd` reaching files outside intended directory.
- **Vertical privilege escalation**: user performing admin actions.
- **Horizontal privilege escalation**: user accessing another user's data.

**Mitigations**

- **Deny by default.** Every endpoint has an explicit policy; unlisted = forbidden.
- **Enforce server-side, per resource.** `@PreAuthorize` per endpoint plus ownership check per object.
- **Centralize authorization.** Policy engine or a single authorization service, not scattered `if` statements.
- **Test negative paths.** For every `can-read` test, write a `cannot-read-someone-elses` test.
- **Normalize and validate paths.** Reject `..`, absolute paths, and encoded traversal sequences.
- **Do not rely on obscurity.** Random IDs help but never replace a check.

```java
// IDOR-safe: the resource carries its owner, and the check is explicit
@GetMapping("/orders/{id}")
public Order getOrder(@PathVariable String id) {
    Order order = repo.findById(id).orElseThrow(NotFoundException::new);
    if (!order.customerId().equals(currentUser().id()) && !currentUser().isAdmin()) {
        throw new AccessDeniedException("not your order");
    }
    return order;
}
```

## A02 — Cryptographic Failures

Weak or missing crypto, exposing data in transit or at rest.

**Common bugs**

- Plain HTTP in production, or TLS with weak ciphers.
- Passwords hashed with MD5/SHA-1/SHA-256 (fast hashes).
- Sensitive data in logs, error messages, or URLs.
- Hardcoded encryption keys, or keys in the same repo as the data.
- Encrypted with a homegrown algorithm.
- Missing HSTS — downgrade to HTTP possible.

**Mitigations**

- **TLS 1.2+ enforced**, HSTS enabled, redirect HTTP → HTTPS at the edge.
- **Argon2id** for passwords. **AES-256-GCM** or **ChaCha20-Poly1305** for data.
- **Keys in a KMS / HSM / Vault**, never in code. Rotate regularly.
- **Encrypt at rest** for PII, secrets, and backups. Enable disk-level encryption everywhere as a floor.
- **Never roll your own crypto.** Use vetted libraries (Bouncy Castle, Google Tink).
- **Redact** secrets and PII from logs (password fields, tokens, card numbers).

## A03 — Injection

Untrusted input is interpreted as code or commands by a downstream interpreter.

**Families**

| Injection type | Interpreter | Example |
|---|---|---|
| SQL | Database | `' OR 1=1 --` |
| NoSQL | MongoDB, etc. | `{"$ne": null}` in a JSON query |
| LDAP | Directory server | `*)(uid=*))(|(uid=*` |
| OS command | Shell | `; rm -rf /` |
| Expression language | OGNL, SpEL, MVEL | `${...}` in a template |
| Log injection | Log consumers | Newlines to forge entries |
| XPath / XQuery | XML databases | `' or '1'='1` |
| HTTP header | Downstream services | CRLF injection |

**The universal fix: parameterization and encoding.**

```java
// WRONG — string concatenation
String sql = "SELECT * FROM users WHERE email = '" + email + "'";
// Attack: email = "' OR '1'='1"

// RIGHT — parameterized query (JPA)
@Query("SELECT u FROM User u WHERE u.email = :email")
Optional<User> findByEmail(@Param("email") String email);

// RIGHT — JPA Criteria / Spring Data method names
Optional<User> findByEmail(String email);

// RIGHT — raw JDBC with prepared statement
try (PreparedStatement ps = conn.prepareStatement(
        "SELECT id FROM users WHERE email = ?")) {
    ps.setString(1, email);
    // ...
}
```

```java
// WRONG — SpEL with user input
ExpressionParser parser = new SpelExpressionParser();
parser.parseExpression(userInput).getValue();
// Attack: T(java.lang.Runtime).getRuntime().exec("rm -rf /")

// RIGHT — no user-controlled expression evaluation
// Or a strict allowlist of expression keys mapped to fixed expressions
```

**NoSQL — MongoDB example**

```javascript
// WRONG — user object passed as query
db.users.find({ email: userInput });
// Attack: userInput = { "$ne": null } → returns all users

// RIGHT — cast to string and validate format
const email = String(userInput);
if (!EMAIL_REGEX.test(email)) throw new BadRequest();
db.users.find({ email: email });
```

**Defenses beyond parameterization**

- **Input validation** — reject at the boundary. Format, length, character class, range.
- **Output encoding** — HTML, JS, URL, CSS, JSON, context-specific.
- **Least privilege DB user** — no `DROP`, no `xp_cmdshell`, no cross-schema access.
- **WAF rules** as a *defense in depth*, never the only control.
- **Log sanitization** — strip newlines and control characters before logging user input.

## A04 — Insecure Design

The system was designed without considering abuse. No amount of implementation hardening fixes this.

**Examples**

- Password recovery that emails a reset link without expiry.
- A business rule ("coupon can be used once") implemented client-side.
- Rate limits not designed in, so credential stuffing works.
- No threat model, so trust boundaries aren't drawn.
- Trusting a downstream service without authentication because "it's internal".

**Mitigations**

- **Threat model** new features before coding.
- **Abuse-case testing** — for each feature, "how would I misuse this?"
- **Rate limits, quotas, and cost controls** are design features.
- **Secure defaults** — new endpoints are authenticated, new resources are private, new logs redact secrets.
- **Fail secure** — errors deny access, not grant it.

## A05 — Security Misconfiguration

The system works but is insecure by misconfiguration, not by bug.

**Common bugs**

- Default credentials on admin endpoints, databases, message brokers.
- Debug mode enabled in production (Spring Boot Actuator `env`, `heapdump`).
- Verbose error pages leaking stack traces and internal paths.
- Directory listing enabled.
- Unnecessary features enabled (sample apps, demo endpoints, unused HTTP methods).
- Permissive CORS.
- Default TLS certificates, or self-signed in prod.
- Missing security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options).

**Mitigations**

- **Hardening checklists** per service template.
- **Config as code** — no drift, no manual edits.
- **Disable Actuator endpoints in prod** (or secure them behind a management port + auth).
- **Custom error pages** with correlation IDs, no stack traces.
- **Security headers** set by default at the framework or gateway level.
- **Automated scanning** (Trivy, kube-bench, cloud config scanners) in CI.

```yaml
# Spring Boot prod-safe Actuator config
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      show-details: when-authorized
server:
  error:
    include-stacktrace: never
    include-message: never
    include-binding-errors: never
```

```yaml
# Security headers via Spring Security
http:
  headers:
    content-security-policy: "default-src 'self'; frame-ancestors 'none'"
    frame-options: DENY
    xss-protection: "0"  # rely on CSP, modern browsers ignore this header
    referrer-policy: no-referrer
    strict-transport-security:
      max-age: 31536000
      include-subdomains: true
```

## A06 — Vulnerable & Outdated Components

You are running code with known CVEs.

**Mitigations**

- **SBOM** (Software Bill of Materials) generated per release — CycloneDX or SPDX. Retain for the life of the release.
- **Continuous scanning** — OWASP Dependency-Check, Snyk, Trivy, Grype, `mvn versions:display-dependency-updates`.
- **Patch SLAs by severity:**
  - **Critical:** 24–72 hours (patch or mitigate with WAF/rules)
  - **High:** 1–2 weeks
  - **Medium:** 1 month
  - **Low:** quarterly
- **Pin base images by digest** — `eclipse-temurin:21-jre@sha256:...`, not `:latest`.
- **Rebuild regularly** — base images get CVEs even when your code doesn't change.
- **Dependency review** at PR time — deny new critical CVEs and unmaintained libraries.

```bash
# SBOM + scan in CI
mvn org.cyclonedx:cyclonedx-maven-plugin:makeAggregateBom
grype sbom:target/bom.json --fail-on high
```

## A07 — Identification & Authentication Failures

Weak authentication. Related to but distinct from A01 (access control).

**Common bugs**

- Credential stuffing works because there's no rate limit on login.
- Password reset tokens don't expire, or can be reused.
- Session IDs don't rotate on login (session fixation).
- Weak password policy — or worse, a "password strength" meter that allows `password1`.
- MFA bypasses available (SMS recovery without additional checks).
- Account enumeration via different error messages ("user not found" vs "wrong password").

**Mitigations**

- **MFA** — WebAuthn/passkey for consumers, TOTP as a fallback. SMS only if nothing else is possible.
- **Rate limiting + lockout** on login, password reset, and OTP verification.
- **Uniform error messages** for auth failures — no account enumeration.
- **Rotate session ID** on login and privilege elevation.
- **Short-lived, single-use, high-entropy** password reset tokens.
- **Notification** on password change, email change, and new device login.
- **Breach-password checks** (HaveIBeenPwned k-anonymity API) at signup/change.

## A08 — Software & Data Integrity Failures

Trusting artefacts and data without verification.

**Common bugs**

- **Unsafe deserialization** — `ObjectInputStream`, `readObject()` with untrusted input, SnakeYAML before safety, Jackson default typing enabled.
- **Unsigned artefacts** — pulling container images or jars from a registry without verifying signature/digest.
- **Supply chain attacks** — malicious dependency, typosquatting package names, compromised build.
- **CI/CD tampering** — untrusted PRs run with secrets.
- **Auto-update from unverified source**.

**Mitigations**

- **Never deserialize untrusted Java objects.** Use JSON/Protobuf with typed schemas; disable polymorphic type handling in Jackson.
- **Sign artefacts** (Sigstore/cosign, GPG) and verify before deploy. Pin images by digest.
- **Lockfiles** for dependencies; scan for typosquats and unusual maintainer changes.
- **Isolate build** — build runs with least privilege; secrets not exposed to PR builds.
- **SBOM + provenance** (SLSA) to detect tampering between build and deploy.

```java
// WRONG — ObjectInputStream on untrusted input
ObjectInputStream ois = new ObjectInputStream(untrustedStream);
Object obj = ois.readObject();  // RCE via gadget chains

// RIGHT — Jackson with a known type, no polymorphic typing
ObjectMapper mapper = new ObjectMapper()
    .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
OrderRequest req = mapper.readValue(json, OrderRequest.class);
```

## A09 — Security Logging & Monitoring Failures

Attacks happen silently because nothing is logged, alerted, or investigated.

**What to log (and alert on)**

- Auth successes and failures (with actor, IP, user-agent, MFA used)
- Authorization denials (with actor, action, resource)
- Admin actions (config changes, role changes, data exports)
- Input validation failures — spikes suggest fuzzing/probing
- Rate limit hits — spikes suggest abuse
- Unusual egress — a service talking to unexpected destinations
- Unusual data volumes — mass read/export patterns

**What NOT to log**

- Passwords, tokens, secrets, API keys
- Full PII (mask or hash where audit requires it)
- Full card numbers (PCI requirement)
- Session IDs in plaintext

**Log hygiene**

- **Structured JSON logs** with a consistent schema.
- **Correlation/trace IDs** across services.
- **Redaction at the logging boundary** — never rely on developers to remember.
- **Retention** meets compliance but doesn't hoard PII.
- **Tamper-resistant** — write-once storage for audit logs.

## A10 — Server-Side Request Forgery (SSRF)

The server is tricked into making a request to an attacker-controlled destination.

**Classic exploit**

```
POST /fetch-image
{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"}
```

The server hits the cloud metadata endpoint and returns the instance's IAM credentials to the attacker.

**More variants**

- Internal service discovery — reaching Redis, Kafka, admin panels behind the firewall.
- `file://`, `gopher://`, `dict://` schemes.
- DNS rebinding — a domain resolves to public IP first, then to internal.
- Redirects — an allowed URL redirects to an internal one.

**Mitigations**

- **Allowlist destinations** — by domain and IP range. Reject everything else.
- **Block internal ranges** — RFC 1918, `169.254.0.0/16` (metadata), `::1`, link-local.
- **Disable redirects** or re-validate after each hop.
- **Enforce IMDSv2** on cloud instances — requires a token, blocks naive SSRF.
- **Network egress policy** — services can only reach the destinations they need.
- **Do not fetch URLs based on user input** unless absolutely required. When you must, run the fetch in an isolated egress-only environment.

```java
// Right — allowlist of hosts, block internal ranges, no redirects
private static final Set<String> ALLOWED_HOSTS = Set.of("images.example.com");

public byte[] fetch(String url) throws IOException {
    URI uri = URI.create(url);
    if (!"https".equals(uri.getScheme()) || !ALLOWED_HOSTS.contains(uri.getHost())) {
        throw new IllegalArgumentException("destination not allowed");
    }
    HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    HttpRequest req = HttpRequest.newBuilder(uri).GET().build();
    return client.send(req, HttpResponse.BodyHandlers.ofByteArray()).body();
}
```

## XSS — Cross-Site Scripting

Attacker injects client-side script into a page viewed by another user.

**Three types**

| Type | Where the payload lives | Example |
|---|---|---|
| **Reflected** | In the request, echoed back | `?q=<script>...</script>` |
| **Stored** | In the database, served to many | Comment containing `<script>` |
| **DOM-based** | In client-side JS, no server roundtrip | `location.hash` written to `innerHTML` |

**Mitigations**

- **Output encoding** at the point of rendering — HTML, attribute, JS, URL contexts. Spring's Thymeleaf and JSP taglibs do this by default; raw `${}` does not.
- **Content Security Policy (CSP)** — `default-src 'self'`, no `unsafe-inline`, nonce-based script loading.
- **HttpOnly cookies** — prevents JS from stealing session cookies (mitigates but does not prevent XSS).
- **Sanitize rich HTML** with a vetted library (OWASP Java HTML Sanitizer, DOMPurify on the client).
- **Never** put untrusted input in `<script>`, `on*` handlers, or `innerHTML`.

## CSRF — Cross-Site Request Forgery

Attacker's site causes the victim's browser to send an authenticated request to your site.

**Mitigations**

- **CSRF tokens** — synchronizer token pattern for cookie-authenticated state-changing requests.
- **SameSite cookies** — `Lax` or `Strict` block cross-site cookie sending.
- **Custom header requirement** — APIs that require `X-Requested-With` or a bearer token are naturally CSRF-resistant (the browser won't attach it cross-site without CORS).
- **Origin/Referer checking** — reject mismatched origins as a defense in depth.

**Rules**

- Cookie + state change = CSRF protection required.
- Bearer token in header = CSRF not applicable (the browser doesn't attach it cross-site).
- GET must never change state — that's what makes CSRF via `<img src>` work.

## XXE — XML External Entity

XML parsers that resolve external entities can read local files or make SSRF requests.

**Mitigation**

- **Disable DTDs and external entities** in every XML parser.
- Use JSON/Protobuf where possible.
- Patch libraries — old JDOM, XStream, and some SAX configurations are vulnerable by default.

```java
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setXIncludeAware(false);
dbf.setExpandEntityReferences(false);
```

## Insecure Deserialization

Deserializing untrusted input into Java objects can lead to RCE via gadget chains.

**Danger zones**

- `ObjectInputStream` on untrusted bytes.
- Jackson with `enableDefaultTyping` / `activateDefaultTyping`.
- SnakeYAML without `SafeConstructor`.
- XStream without whitelist.
- `Serializable` classes reachable on the classpath (gadget chains).

**Mitigations**

- **Never deserialize untrusted Java-serialized data.** Use JSON/Protobuf with a typed schema.
- **Jackson:** use `@JsonTypeInfo` with named subtypes, not default typing.
- **SnakeYAML:** `new Yaml(new SafeConstructor(new LoaderOptions()))`.
- **XStream:** `xstream.allowTypes(...)` with an explicit allowlist.
- **Remove unused `Serializable`** implementations from the classpath where possible.
- **JVMSerialFilter** — set a deserialization filter at JVM level as a last resort.

## Secrets Management

Secrets in the wrong place are a top-tier breach enabler.

**Rules**

- **Never** commit secrets to git — even in a private repo, even in a "temporary" commit.
- **Never** bake secrets into container images.
- **Never** log secrets — redact at the logging boundary.
- **Never** share secrets between environments.
- **Rotate** on a schedule and on any suspicion of compromise.

**Where secrets should live**

- **HashiCorp Vault** — dynamic secrets, lease-based, audit-logged. The strongest option.
- **Cloud KMS / Secret Manager** — AWS Secrets Manager, GCP Secret Manager, Azure Key Vault.
- **Kubernetes Secrets** — acceptable *only* with encryption at rest enabled (etcd encryption) and RBAC restricting access. Not encrypted by default.
- **Environment variables** — better than files, but visible in `/proc` and process listings. Fine for non-secret config; acceptable for secrets in well-isolated containers.

**Application-side pattern (Vault + Spring)**

```yaml
spring:
  config:
    import: vault://
  cloud:
    vault:
      uri: https://vault.internal:8200
      authentication: KUBERNETES
      kubernetes:
        role: orders-api
      kv:
        backend: secret
        default-context: orders
```

The app authenticates to Vault with its Kubernetes service account; secrets are fetched at startup and cached with a TTL. No secret ever appears in a config file, environment listing, or container image.

## Secure Coding Practices

A short list to review code against:

- **Validate input at the boundary** — length, format, range, character class.
- **Parameterize everything** that talks to an interpreter.
- **Encode output** for its context.
- **Deny by default** in authZ.
- **Fail secure** — errors deny access, don't bypass it.
- **Use vetted libraries** — no homegrown crypto, no homegrown parsers.
- **Store the minimum PII** — retention and minimization are security controls.
- **Redact logs.**
- **Rotate secrets.**
- **Review dependencies** at PR time.
- **Test the negative paths** — for every "can", a "cannot".

## Tricky Corners ⚠️

- **OWASP categories are outcomes.** A "SQL injection" is A03; the same query running with an admin DB user might also be A01. Fix the root cause, not the label.
- **WAF is not a fix.** It's a defense in depth. Attackers craft bypasses; the app must be safe without it.
- **CSP reporting is different from CSP enforcement.** Start in report-only, then enforce.
- **CORS does not protect server-side calls.** It's a browser policy. curl ignores it.
- **`X-XSS-Protection: 1` is harmful.** It enables a broken legacy filter. Use CSP; set the header to `0` or omit.
- **`X-Frame-Options` vs `frame-ancestors`** — the CSP directive is newer; set both for compatibility.
- **Log injection via newlines** — sanitize user input before logging.
- **Metadata endpoints** — `169.254.169.254` on AWS/GCP/Azure is a top SSRF target. Enforce IMDSv2, block the range.
- **SSRF via DNS rebinding** — allowlist by resolved IP, not just hostname. Re-resolve and re-check after redirects.
- **Deserialization gadgets** — even a "safe" library can be exploited if the classpath contains the wrong classes. Keep dependencies minimal.
- **Secret scanning** — pre-commit hooks (gitleaks, trufflehog) catch what code review misses.

## Common Pitfalls

- Treating the OWASP Top 10 as a one-time checklist instead of a review lens.
- Adding input validation but skipping output encoding.
- Adding authentication but not authorization (the number-one real bug).
- Trusting the client for anything security-relevant.
- Self-signed certificates in production.
- Missing rate limits on login, password reset, and OTP.
- Debug endpoints left enabled in prod.
- Secrets in environment variables *and* in the container image.
- Relying on a WAF to fix application bugs.
- Logging without monitoring — logs nobody reads aren't a control.
- Ignoring transitive dependencies — the CVE is usually in a library you didn't know you had.

## Key Interview Tips

- **Know the OWASP Top 10 by number and one-liner.** Don't memorise the long descriptions.
- **A01 is Broken Access Control** — the modern number one. Lead with it.
- **Distinguish A01 (authZ) from A07 (authN).** Common interview trap.
- **Injection is fixed by parameterization**, not by input validation alone. Say this explicitly.
- **A08 relates to deserialization and supply chain** — don't reduce it to "sign your images".
- **A10 is SSRF** — mention the metadata endpoint and IMDSv2.
- **Secrets management** — name Vault and cloud KMS by name; env vars are the fallback, not the target.
- **Give one mitigation per category** and one real incident you've seen. Stories stick.
- **Link to shift-left** — SAST, DAST, dependency scanning, secrets scanning in CI.
- **OWASP has more than the Top 10** — mention the ASVS (Application Security Verification Standard) as the deeper reference.

## Related

- [Security Foundations](index.md)
- [Authentication & Authorization](authentication-and-authorization.md)
- [Shift-Left](../leadership/shift-left.md)
- [Microservices Security](../microservices-patterns/security.md)
- [HTTP Methods](../architecture/http-methods.md)