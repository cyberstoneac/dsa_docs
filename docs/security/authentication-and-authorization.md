# Authentication & Authorization

> **JDK context:** Java 17+ — Jakarta Security, Spring Security 6, JWT (RFC 7519), OAuth 2.1, OIDC. This file covers the *protocol landscape* and *design trade-offs*. Spring-specific wiring lives in `spring/security/jwt-and-oauth2.md`.

## Mental Model

Two distinct questions that are constantly conflated:

- **Authentication (AuthN)** — *Who are you?*
- **Authorization (AuthZ)** — *What are you allowed to do?*

Getting AuthN right is a precondition for AuthZ. Getting AuthZ right is where most breaches happen.

```d2
direction: right

user: "User\n(principal)"
idp: "Identity Provider\n(IdP)"
app: "Application\n(resource server)"
resource: "Protected Resource\n(data, action)"

user -> idp: "1. authenticate\n(credentials / SSO)"
idp -> user: "2. token\n(identity assertion)"
user -> app: "3. present token"
app -> app: "4. verify signature\n+ claims"
app -> resource: "5. authorize\n+ act"
```

**Key ideas**

- **Identity is asserted**, not discovered. The IdP vouches; the app trusts the assertion.
- **Trust is transitive** and needs explicit scope — the app trusts the IdP, not everyone the IdP trusts.
- **Authorization is local** to each resource. The app decides, using claims from the token and its own policy.

## Authentication Methods

| Method | Strength | Phishing-resistance | Complexity | Notes |
|---|---|---|---|---|
| Password only | Low | No | Low | Legacy default; needs MFA |
| Password + MFA (TOTP/SMS) | Medium | Partial | Medium | SMS is weak; TOTP better |
| Password + MFA (WebAuthn/passkey) | High | Yes | Medium | Origin-bound; best consumer option |
| Mutual TLS (mTLS) | Very High | Yes | High | Client certs; ideal for machine-to-machine |
| Kerberos | Very High | Yes | High | Enterprise SSO; ticket-based |
| SAML 2.0 | High | N/A | High | Browser SSO for enterprise |
| OIDC (over OAuth 2.0) | High | Depends on method | Medium | Modern SSO for web/mobile |
| API keys | Low | N/A | Low | Machine-only; no identity semantics |
| Session cookies | High | N/A | Low | Stateful; server-side state |

**Rule of thumb for consumer web:** OIDC + password + WebAuthn MFA.
**Rule of thumb for enterprise:** SAML or OIDC via the corporate IdP.
**Rule of thumb for machine-to-machine:** mTLS or OAuth 2.0 client credentials.

## Password Storage

If you *must* store passwords (i.e. you're the IdP):

- **Never** plaintext, never reversible, never MD5/SHA-1.
- Use a **memory-hard** password hash: **Argon2id** (preferred), **bcrypt**, or **scrypt**.
- **Salt** every hash with a unique random salt (16+ bytes).
- **Pepper** — a server-wide secret appended before hashing — adds a layer against DB leaks.
- **Cost parameter** should be tuned so a single hash takes 50–100 ms on your hardware.

```java
// Argon2id via Bouncy Castle — tune iterations/memory for your hardware
int iterations = 3;        // time cost
int memoryKib = 65536;     // 64 MiB
int parallelism = 4;
byte[] salt = new byte[16];
new SecureRandom().nextBytes(salt);

Argon2Parameters params = new Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
        .withSalt(salt)
        .withIterations(iterations)
        .withMemoryAsKB(memoryKib)
        .withParallelism(parallelism)
        .build();

Argon2BytesGenerator gen = new Argon2BytesGenerator();
gen.init(params);
byte[] hash = new byte[32];
gen.generateBytes(password.toCharArray(), hash);
// Expected: 32-byte digest; salt stored alongside; verify with constant-time comparison
```

**Verification must be constant-time** — `MessageDigest.isEqual(a, b)`, not `Arrays.equals`.

## OAuth 2.0 — Authorization Framework

OAuth 2.0 is an **authorization** framework. It lets a user grant a client limited access to their resources on another server — *without sharing the password*. It is **not** an authentication protocol; OIDC is the identity layer built on top of it.

**Roles**

- **Resource Owner** — the user.
- **Client** — the app requesting access.
- **Authorization Server** — issues tokens (the IdP for AuthZ purposes).
- **Resource Server** — the API holding the protected resource.

**Tokens**

- **Access token** — short-lived (5–60 min), presented to the resource server.
- **Refresh token** — long-lived, used to obtain new access tokens; stored securely.
- **ID token** (OIDC only) — a signed JWT containing identity claims.

### Flows (choose one; stop using deprecated ones)

| Flow | Use case | Client type | Refresh token | Notes |
|---|---|---|---|---|
| **Authorization Code + PKCE** | Web apps, SPAs, mobile, desktop | Public or confidential | Yes (if confidential) | **The default for everything user-facing** |
| **Client Credentials** | Service-to-service | Confidential | No | No user; uses client ID + secret |
| **Device Authorization** | TVs, CLI, IoT | Public | Yes | User code on another device |
| **Implicit** | *Deprecated* | SPA | No | Replaced by Auth Code + PKCE |
| **Resource Owner Password (ROPC)** | *Deprecated* | Any | Yes | Only for legacy migrations |

### Authorization Code + PKCE (the default)

```d2
direction: right

client: "Client\n(browser / app)"
authz: "Authorization Server"
user: "User\n(resource owner)"
api: "Resource Server\n(API)"

client -> authz: "1. /authorize\n+ code_challenge"
authz -> user: "2. login +\nconsent"
user -> authz: "3. credentials"
authz -> client: "4. redirect\n+ authorization code"
client -> authz: "5. /token\n+ code + verifier"
authz -> client: "6. access +\nrefresh token"
client -> api: "7. Bearer token"
api -> client: "8. protected\nresource"
```

**Why PKCE matters:** the authorization code can leak (browser history, referrer, logs). PKCE binds the code to the client via a `code_verifier` whose hash was sent in step 1. Without the verifier, the code is useless.

```http
# Step 1 — client generates verifier + challenge
code_verifier  = base64url(random(32 bytes))
code_challenge = base64url(SHA256(code_verifier))

GET /authorize?
  response_type=code&
  client_id=my-app&
  redirect_uri=https://app.example.com/cb&
  scope=openid profile orders.read&
  state=<csrf-nonce>&
  code_challenge=<challenge>&
  code_challenge_method=S256

# Step 4 — redirect back
HTTP/1.1 302 Found
Location: https://app.example.com/cb?code=abc123&state=<csrf-nonce>

# Step 5 — exchange code + verifier for tokens
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=abc123&
redirect_uri=https://app.example.com/cb&
client_id=my-app&
code_verifier=<verifier>

# Response
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "def456",
  "id_token": "eyJ...",
  "scope": "openid profile orders.read"
}
```

**Rules**

- **Always use PKCE**, even for confidential clients.
- **Always send `state`** and verify it on return — CSRF protection.
- **Always validate `redirect_uri`** server-side; do not allow arbitrary redirects.
- **Never** send tokens in URL fragments or query strings.

### Client Credentials (service-to-service)

```http
POST /token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic <base64(client_id:client_secret)>

grant_type=client_credentials&scope=orders.read
```

The token represents the **client**, not a user. Use mTLS + client credentials for high-assurance machine-to-machine auth (OAuth 2.0 mTLS client authentication, RFC 8705).

### Refresh tokens

- Long-lived (days to months), stored in secure storage (not `localStorage`).
- **Rotate on every use** — old refresh token invalidated when a new one is issued.
- **Detect reuse** — if an old refresh token is presented, treat it as theft: revoke the entire token family.
- **Sender-constrained** where possible (DPoP, mTLS) to bind the token to the client's key.

## OpenID Connect (OIDC)

OIDC is OAuth 2.0 **plus identity**. It adds:

- **ID token** — a JWT with identity claims (`sub`, `iss`, `aud`, `exp`, `iat`, and standard claims like `email`, `name`).
- **`/userinfo` endpoint** — returns claims about the authenticated user.
- **Discovery** — `/.well-known/openid-configuration` publishes endpoints and key locations.
- **JWKS** — `/.well-known/jwks.json` publishes public keys for token verification.

**OIDC vs OAuth in one line:** OAuth grants *access to a resource*; OIDC tells you *who the user is*.

**When to use OIDC directly:**

- You need the user's identity at the resource server (name, email, roles).
- You control both the IdP and the app.
- You want a well-defined token format (JWT) rather than SAML assertions.

## SAML 2.0

Enterprise SSO protocol. The IdP issues a **signed XML assertion** to the Service Provider (SP). Common in B2B and enterprise SSO.

**SAML vs OIDC**

| Aspect | SAML 2.0 | OIDC |
|---|---|---|
| Format | XML | JSON / JWT |
| Transport | HTTP POST/Redirect | HTTP Redirect + JSON |
| Verbosity | High | Low |
| Mobile-friendly | Awkward | Yes |
| Enterprise adoption | Very high (legacy + current) | Growing |
| Token size | Large (KB) | Small (hundreds of bytes) |
| Signing | XML Signature (complex) | JWS (simpler) |

**Use SAML** when integrating with enterprise customers whose IdP only speaks SAML. Use **OIDC** for everything new.

## Kerberos

Ticket-based authentication for on-prem enterprise environments and OS-level SSO.

- **KDC** (Key Distribution Center) issues **tickets** (TGT, service tickets).
- The user authenticates once; subsequent service access uses tickets.
- **SPNEGO** bridges Kerberos to HTTP — a browser on a domain-joined machine automatically presents a Kerberos ticket to a web server.

**Still relevant for:** Windows domain SSO, Hadoop/Spark clusters, some legacy corporate web apps. Not typical for cloud-native services.

## JSON Web Tokens (JWT)

A compact, URL-safe way to represent claims. Three parts, dot-separated:

```
header.payload.signature
```

**Header** — algorithm and type:

```json
{ "alg": "RS256", "typ": "JWT", "kid": "2024-key-1" }
```

**Payload** — claims. Registered claims (`iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`) plus custom ones (`roles`, `tenant`, `scope`):

```json
{
  "iss": "https://idp.example.com",
  "sub": "user-123",
  "aud": "orders-api",
  "exp": 1735689600,
  "iat": 1735686000,
  "jti": "8f2a...",
  "scope": "orders.read orders.write",
  "roles": ["customer"],
  "tenant": "acme"
}
```

**Signature** — HMAC (`HS256`) for shared-secret, or RSA/ECDSA (`RS256`, `ES256`) for asymmetric. **Prefer asymmetric** — resource servers verify with a public key and never hold a signing secret.

**JWT validation checklist (server-side)**

- [ ] Verify the **signature** using the key identified by `kid` from the IdP's JWKS.
- [ ] Verify **`iss`** matches the expected issuer exactly.
- [ ] Verify **`aud`** includes this service's identifier.
- [ ] Verify **`exp`** is in the future (allow a small clock skew, e.g. 60s).
- [ ] Verify **`nbf`** (if present) is in the past.
- [ ] Reject **`alg: none`** and any algorithm not on an allowlist — never trust the header.
- [ ] Check **`scope`/`roles`** for the specific operation being performed.
- [ ] Consider **`jti`** for revocation lists where needed.

**Common JWT mistakes**

- Trusting the header's `alg` — algorithm confusion attacks (`HS256` accepted when the server expects `RS256`).
- Skipping `aud`/`iss` checks — a token from another service is accepted.
- Long expiry (hours/days) with no revocation.
- Storing JWTs in `localStorage` — XSS steals them.
- Putting PII in the payload — the payload is **base64url, not encrypted**. Anyone with the token can read it.
- Using JWT for sessions when a session cookie would do — JWTs are not a default; they're a tool for stateless, cross-service identity.

**JWT is not encryption.** JWS (signed) is the common form. JWE (encrypted) exists but is rare. Treat any JWT payload as public.

## Mutual TLS (mTLS)

Both client and server present X.509 certificates; each verifies the other. The strongest common authentication for machine-to-machine.

**Uses**

- Service mesh (Istio, Linkerd) — transparent mTLS between services.
- High-assurance APIs (finance, healthcare).
- Zero-trust internal networks.
- Device identity.

**Benefits**

- Cryptographic identity, no shared secrets.
- Certificate rotation possible without code changes.
- Identity is bound to the key, not bearer-token-shaped.

**Costs**

- Certificate lifecycle (issuance, rotation, revocation).
- TLS termination complexity (proxies, load balancers).
- Debugging is harder than with a bearer token.

## Session vs Token Authentication

| Aspect | Server-side session | Stateless JWT |
|---|---|---|
| State | Stored server-side (memory/Redis) | Contained in the token |
| Revocation | Immediate (delete session) | Hard (needs denylist or short TTL) |
| Scalability | Needs shared store | Naturally scalable |
| Cross-service | Needs SSO or session sharing | Bearer token works across services |
| CSRF risk | Yes — cookie-based | Low (if not in cookies) |
| XSS risk | Low (HttpOnly cookie) | High if stored in JS-accessible storage |
| Size | Small cookie | Larger header |

**Rules**

- **Web apps with a backend:** use **HttpOnly, Secure, SameSite=Lax cookies** with server-side sessions. Add CSRF tokens where cookies authenticate state-changing requests.
- **SPAs + separate APIs:** Auth Code + PKCE → access token (short) in memory, refresh token in HttpOnly cookie.
- **Service-to-service:** OAuth 2.0 client credentials or mTLS.
- **Never** put access tokens in `localStorage` if you can avoid it.

## Authorization Models

### RBAC — Role-Based Access Control

Users → roles → permissions. Simple, auditable, widely understood.

```d2
direction: right

alice: "alice"
bob: "bob"
admin: "ROLE_ADMIN"
user: "ROLE_USER"
read: "orders:read"
write: "orders:write"
delete: "orders:delete"

alice -> admin
bob -> user
admin -> read
admin -> write
admin -> delete
user -> read
```

**Pros:** simple, easy to reason about, well-supported by frameworks.
**Cons:** role explosion (hundreds of roles), coarse-grained, doesn't express "own resource only".

### ABAC — Attribute-Based Access Control

Policy evaluated from attributes of subject, resource, action, and environment.

```
ALLOW if
  subject.department == resource.department
  AND action IN [read, update]
  AND environment.time BETWEEN 09:00 AND 18:00
```

**Pros:** fine-grained, expressive, no role explosion.
**Cons:** complex policies, harder to audit, needs a policy engine (OPA, Cedar, XACML).

### ReBAC — Relationship-Based Access Control

Permissions derived from relationships in a graph (Google Zanzibar model). E.g. "you can view a document if you are a member of a team that owns it".

**Pros:** natural for social/sharing models, scales to billions of relations.
**Cons:** infrastructure (needs a relationship store), unfamiliar to most teams.

### Choosing

| Need | Model |
|---|---|
| Simple roles (admin/user) | RBAC |
| Own-resource-only rules | RBAC + ownership checks |
| Multi-tenant with per-tenant roles | RBAC scoped by tenant |
| Fine-grained, context-aware policy | ABAC (OPA/Cedar) |
| Sharing/collaboration graphs | ReBAC |
| Hybrid | RBAC for coarse, ABAC for edge cases |

**Rule:** start with RBAC. Introduce ABAC only where RBAC breaks.

## Authorization Enforcement Rules

- **Server-side always.** Client-side checks are UX, not security.
- **Deny by default.** Explicit allow lists, not blocklists.
- **Enforce per resource, not per endpoint.** `/orders/{id}` must check ownership, not just "user is logged in".
- **Protect against IDOR (Insecure Direct Object Reference).** Every request: `if (order.ownerId != currentUser.id) throw Forbidden`.
- **Centralize the check** in a policy layer, not scattered `if` statements.
- **Log every denial** — with actor, action, resource, reason. Denials are the strongest signal of attack.

```java
// Wrong — endpoint-level check only
@PreAuthorize("isAuthenticated()")
public Order getOrder(String id) { return repo.findById(id).orElseThrow(); }

// Right — resource-level authorization
@PreAuthorize("isAuthenticated()")
public Order getOrder(String id) {
    Order order = repo.findById(id).orElseThrow();
    if (!order.getCustomerId().equals(currentUser().getId())) {
        throw new AccessDeniedException("not your order");
    }
    return order;
}
```

## Tricky Corners ⚠️

- **OAuth is not authentication.** Using OAuth access tokens as proof of identity is a category error. Use OIDC.
- **Implicit flow is deprecated.** Everything new uses Auth Code + PKCE.
- **ROPC exists for migration.** Don't start a new project with it.
- **`state` and `nonce` are not optional.** They protect against CSRF and replay respectively.
- **JWTs are not encrypted.** Payload is public. Never put secrets or PII there.
- **Algorithm confusion attacks** — never trust `alg` from the header. Validate against an allowlist.
- **Logout with JWT** — the token is valid until expiry unless you maintain a denylist. Short TTLs + refresh tokens mitigate.
- **Refresh token reuse detection** — must revoke the entire family, not just the reused token.
- **SAML signature wrapping** — old but still exploitable. Validate the assertion signature against the correct XML element (use a hardened library).
- **mTLS termination** — if you terminate at a load balancer, the app doesn't see the client cert. Forward it via a signed header, or terminate in the app.
- **`Authorization: Bearer` in logs** — redact headers in access logs.
- **CORS is not authorization.** It's a browser policy. It doesn't stop server-side calls.
- **`SameSite=Lax` vs `Strict`** — `Strict` breaks OIDC redirects; `Lax` is the pragmatic default.
- **Session fixation** — rotate the session ID on login.

## Common Pitfalls

- Building your own auth instead of using a proven IdP (Keycloak, Auth0, Okta, Cognito, Entra ID).
- Storing passwords with SHA-256 (or worse).
- Long-lived JWTs with no revocation path.
- Role checks in the UI but not the API.
- Authorization based on "is logged in" instead of "can access *this* resource".
- Secrets in git, in CI logs, or in container images.
- Overly broad OAuth scopes (`*`).
- Missing `state` / `nonce` in OIDC flows.
- Refresh tokens in `localStorage`.
- Trusting internal networks — flat networks turn any foothold into a breach.
- Ignoring token expiry and clock skew — tokens fail for no apparent reason or remain valid too long.
- Forgetting to rotate keys / certs / secrets.

## Key Interview Tips

- **State the AuthN vs AuthZ distinction up front.** It's the vocabulary every follow-up builds on.
- **Recommend Auth Code + PKCE** as the default for anything user-facing. Know why (code leakage, PKCE binding).
- **OIDC vs OAuth** — one sentence each: OAuth = delegated access, OIDC = identity on top.
- **JWT validation checklist** — signature, `iss`, `aud`, `exp`, `nbf`, `alg` allowlist. This is where junior answers collapse.
- **JWTs are not encrypted.** Mention it. Interviewers love catching candidates who assume otherwise.
- **Session vs token** — state the trade-off, not a preference. Cookies for web apps, tokens for APIs and cross-service.
- **RBAC vs ABAC** — pick RBAC by default; ABAC when RBAC breaks.
- **IDOR is the number-one authZ bug** in modern APIs. Show you check resource ownership server-side.
- **mTLS for machine-to-machine.** Mention service mesh termination (Istio/Linkerd) as the practical implementation.
- **SAML for enterprise**, OIDC for everything else. Don't pretend SAML is dead.
- **Link to OWASP Top 10** — A01 (Broken Access Control) is where most of this file's content lands in practice.

## Related

- [Security Foundations](index.md)
- [OWASP & AppSec](owasp-and-appsec.md)
- [Spring Security — JWT & OAuth2](../spring/security/jwt-and-oauth2.md)
- [Microservices Security](../microservices-patterns/security.md)
- [System Design — Authentication & Authorization](../system-design/problems/55-authentication-authorization.md)