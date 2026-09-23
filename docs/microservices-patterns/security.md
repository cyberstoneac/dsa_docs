# Security

> **Spring context:** Spring Security 6.x (Jakarta namespace, `SecurityFilterChain` DSL, no more `WebSecurityConfigurerAdapter`). Spring Authorization Server for OAuth2/OIDC. Spring Cloud Gateway for token relay. Vault / AWS Secrets Manager / K8s secrets for credentials. mTLS via Istio/Linkerd or app-level.

## Mental Model

Security in microservices is about **trust boundaries**. Every service boundary is a place where trust must be established and verified. The old model — "inside the perimeter is trusted" — is dead. Zero Trust assumes the network is hostile and every call must be authenticated and authorized.

Two layers:



- **North-south:** client → gateway → services. Handled by OAuth2/OIDC, access tokens, API gateway.
- **East-west:** service → service. Handled by mTLS, service identity, token relay.

```d2
direction: right

client: Client
gw: "API Gateway {\\n  auth: OAuth2 / OIDC\\n  rate: Rate Limit\\n  tls: TLS"
svcA: Service A
svcB: Service B
idp: "Identity Provider\\n(Keycloak / Auth0 / Okta)"

client -> tls
auth -> idp
auth -> svcA
svcA -> svcB
```

**Rule:** every call is authenticated and authorized. No implicit trust.

## Access Tokens

OAuth2 / OIDC is the standard. Three main flows:

| Flow | When | Notes |
|---|---|---|
| Authorization Code + PKCE | User-facing apps | Preferred for all user logins |
| Client Credentials | Service-to-service | Machine identity, no user |
| Refresh Token | Long-lived sessions | Rotate refresh tokens |

**Never use:**
- Implicit flow (deprecated).
- Resource Owner Password flow (deprecated; only for legacy migration).
- Long-lived tokens without refresh/rotation.

### Token structure

JWT is the common format. Claims:
- `sub` — subject (user/service ID)
- `iss` — issuer
- `aud` — audience (which API this token is for)
- `exp`, `iat` — expiry/issued at
- `scope` / `roles` — authorization
- `tenant` — multi-tenancy

**Rules:**
- **Validate signature, issuer, audience, expiry** on every request.
- **Short-lived access tokens** (5–15 min), refresh tokens rotated.
- **Never store tokens in localStorage** — use httpOnly, secure, SameSite cookies for browsers.
- **Never log tokens.**

```java
@Bean
SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health/**").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        )
        .oauth2ResourceServer(oauth2 -> oauth2
            .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter()))
        );
    return http.build();
}
```

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com/realms/prod
```

## API Gateway Auth

The gateway terminates auth: validates the token, extracts identity, forwards to downstream services.

```d2
direction: right

client: "Client\\n(Bearer token)"
gw: "API Gateway {\\n  validate: validate JWT\\n  claims: extract claims\\n  relay: relay identity"
svc: "Downstream Service\\n(trusts gateway)"

client -> validate
claims -> relay
relay -> svc
```

Two patterns:

| Pattern | How | Trade-off |
|---|---|---|
| **Token relay** | Gateway forwards the original JWT | Downstream validates independently; more CPU |
| **Identity headers** | Gateway extracts claims into headers (`X-User-Id`, `X-Roles`) | Fast; downstream trusts gateway; requires network-level trust |

**Token relay is safer** (defense in depth). Identity headers are faster but require strict network isolation.

## Zero Trust

Assume the network is hostile. Every request must be authenticated, authorized, and encrypted — even inside the cluster.

Principles:
1. **Verify explicitly** — always authenticate and authorize.
2. **Least privilege** — minimum permissions for each service.
3. **Assume breach** — design for detection and blast-radius containment.
4. **Encrypt everywhere** — mTLS east-west, TLS north-south.

Spring angle:
- Every endpoint requires auth by default (`anyRequest().authenticated()`).
- Actuator endpoints secured or on a separate management port.
- Health checks exposed without auth (K8s needs them), everything else secured.

## mTLS (Mutual TLS)

Both client and server present certificates. Establishes service identity at the transport layer.

```d2
direction: right

svcA: "Service A {\\n  cert: client cert\\n}"
svcB: "Service B {\\n  cert: server cert\\n  ca: verify client cert"

cert -> ca
```

Where to implement:
- **Service mesh (Istio/Linkerd):** automatic, no app changes. Preferred.
- **App-level:** configure the HTTP client with client certs. More work, more control.

Benefits:
- Encrypted in transit.
- Service identity (not just IP).
- Enables zero-trust east-west.

Costs:
- Certificate lifecycle management (rotation, expiry).
- Debugging is harder (cert errors).
- CPU overhead (small).

## Secrets Management

Never put secrets in:
- Source code.
- Container images.
- Environment variables committed to git.
- ConfigMaps (unencrypted).

Use:
- **HashiCorp Vault** — dynamic secrets, leasing, rotation.
- **AWS Secrets Manager / GCP Secret Manager / Azure Key Vault.**
- **Kubernetes Secrets** — base64 is not encryption; enable etcd encryption at rest.
- **External Secrets Operator** — sync from Vault/cloud to K8s.

Spring angle:
```yaml
spring:
  config:
    import: vault://
  cloud:
    vault:
      uri: https://vault.example.com
      authentication: KUBERNETES
      kubernetes:
        role: orders-service
```

**Rules:**
- Secrets are **scoped** per service (least privilege).
- Secrets are **rotated** (dynamic secrets in Vault are ideal).
- Secrets are **audited** (who read what, when).
- Secrets are **never logged** — scrub in logging filters.
- Use **short-lived credentials** where possible (IAM roles, workload identity).

## Authorization

Authentication = who you are. Authorization = what you can do.

| Model | Use case |
|---|---|
| RBAC (Role-Based) | Most apps; roles → permissions |
| ABAC (Attribute-Based) | Fine-grained; attributes drive decisions |
| ReBAC (Relationship-Based) | Google Zanzibar-style; hierarchical |
| Policy-as-code (OPA) | Centralized, auditable policy |

Spring:
```java
@PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
public Order getOrder(String userId, String orderId) { ... }
```

**Rules:**
- Authorize at the **service**, not just the gateway.
- Check **resource ownership**, not just role.
- Deny by default.
- Log authorization failures (they're security-relevant).

## Common Attack Vectors

| Attack | Defense |
|---|---|
| Token theft | Short-lived tokens, httpOnly cookies, token binding |
| Token replay | `jti` claim, short expiry, one-time tokens |
| Injection (SQL, NoSQL, LDAP) | Parameterized queries, input validation, ORM |
| SSRF | Allowlist outbound hosts, no user-controlled URLs |
| Deserialization | Avoid Java serialization, validate JSON schemas |
| Log injection | Structured logging, escape newlines |
| Dependency vulnerabilities | SCA (Dependabot, Snyk), pin versions, SBOM |
| Broken access control | Authorize at the resource, not just the route |
| Secrets in logs | Scrub filters, no token logging |
| Container escape | Non-root, read-only FS, seccomp, no privileged |

## Spring Security 6.x Essentials

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())            // stateless API
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    JwtAuthenticationConverter jwtAuthConverter() {
        JwtGrantedAuthoritiesConverter g = new JwtGrantedAuthoritiesConverter();
        g.setAuthoritiesClaimName("roles");
        g.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter c = new JwtAuthenticationConverter();
        c.setJwtGrantedAuthoritiesConverter(g);
        return c;
    }
}
```

## Service-to-Service Auth Patterns

| Pattern | Mechanism | Trust |
|---|---|---|
| mTLS + service mesh | Certificates | Transport-level |
| Client credentials OAuth2 | Service gets its own token | App-level |
| Token relay | Pass user's token downstream | User context preserved |
| Signed request (HMAC) | Shared secret, request signature | Simple, no IdP |
| SPIFFE/SPIRE | Workload identity | Advanced, mesh-native |

**Rule:** use mTLS for transport + client credentials for app-level authorization. Token relay only when downstream needs the user's identity.

## Tricky Corners ⚠️

- **Base64 is not encryption.** K8s Secrets are base64 by default; enable etcd encryption.
- **JWT is not encrypted, only signed.** Anyone can read claims. Never put secrets in claims.
- **`aud` claim must be validated** — otherwise a token for service A works on service B.
- **`iss` must be validated** — otherwise tokens from a rogue issuer are accepted.
- **Token expiry must be short** and refresh tokens rotated.
- **CORS is not a security control** — it's a browser policy. Server-side auth is still required.
- **CSRF is not needed for stateless JWT APIs** (no cookies), but is required for cookie-based sessions.
- **Authorization at the gateway only** is a common hole — services must authorize too.
- **`/actuator/**` exposed without auth leaks env, beans, config.**
- **Error messages leaking internals** — never return stack traces to clients.
- **Dependency vulnerabilities** — most breaches come from unpatched libraries, not clever attacks.
- **Non-root containers** — a compromised container running as root is a bigger blast radius.

## Common Pitfalls

- Secrets in git, even in private repos.
- Long-lived tokens with no rotation.
- `anyRequest().permitAll()` in prod by accident.
- Actuator fully exposed.
- JWT signature not validated (accepting unsigned tokens).
- `aud`/`iss` not checked.
- Authorization only at the gateway.
- Logging full request bodies (with tokens, PII).
- Admin endpoints on the public port.
- No dependency scanning.
- Containers running as root.
- mTLS without certificate rotation.

## Key Interview Tips

- Lead with **"zero trust: every call is authenticated and authorized, even inside the cluster."**
- For "how do you secure service-to-service?", answer **"mTLS for transport identity + client credentials for app-level auth."**
- For "how do you secure user-facing APIs?", answer **"OAuth2/OIDC, Authorization Code + PKCE, short-lived access tokens, refresh token rotation, validated at the gateway and again at the service."**
- For "how do you manage secrets?", answer **"Vault or cloud secret manager, scoped per service, rotated, never in code or images."**
- For "what do you validate on a JWT?", answer **"signature, issuer, audience, expiry, and then authorize at the resource."**
- For "what's the biggest risk?", answer **"broken access control and unpatched dependencies — not exotic attacks."**
- Always mention **least privilege**, **short-lived credentials**, and **defense in depth**.

## Related

- [Microservices Patterns index](index.md)
- [Communication](communication.md)
- [Reliability](reliability.md)
- [Observability](observability.md)
- [Deployment](deployment.md)
- [Kubernetes → Production Essentials](../kubernetes/production-essentials.md)