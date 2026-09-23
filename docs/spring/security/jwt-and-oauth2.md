# JWT & OAuth2

> **Spring context:** Spring Boot 3.x with Spring Security 6.x. Focus is on
> JWT internals, OAuth2 flows, and resource-server configuration — the common
> patterns in modern APIs.

## Mental Model

Two distinct concepts, often conflated:

```d2
direction: right

jwt: "JWT" {
  style.fill: "#bbdefb"
  desc: "A token format:\nBase64-encoded JSON with signature.\nStateless, self-contained."
}
oauth: "OAuth2" {
  style.fill: "#c8e6c9"
  desc: "An authorization framework:\n'How can an app get access\nto a user's resources?'"
}
oidc: "OIDC" {
  style.fill: "#fff9c4"
  desc: "OAuth2 + identity:\nAdds ID token and user info."
}

jwt.oauth -> oauth: "often used with"
oauth.oidc -> oidc: "extension"
```

**JWT is a token format. OAuth2 is an authorization framework.** JWTs are
commonly used *as* the access tokens in OAuth2 flows — but you can have
either without the other.

---

## Part 1 — JWT

### Structure

A JWT has three dot-separated parts:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiJhbGljZSIsInJvbGVzIjpbIlVTRVIiXSwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

| Part | Content |
|---|---|
| Header | Algorithm + type (Base64URL encoded JSON) |
| Payload | Claims (Base64URL encoded JSON) |
| Signature | HMAC or RSA signature over header + payload |

### Decoded

**Header:**

```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload:**

```json
{
  "sub": "alice",
  "roles": ["USER"],
  "iat": 1700000000,
  "exp": 1700003600
}
```

**Signature:** base64url(HS256(base64url(header) + "." + base64url(payload),
secret))

### Standard claims

| Claim | Meaning |
|---|---|
| `sub` | Subject (user ID) |
| `iss` | Issuer |
| `aud` | Audience |
| `exp` | Expiration time (Unix seconds) |
| `nbf` | Not before |
| `iat` | Issued at |
| `jti` | JWT ID (unique) |

**Custom claims** like `roles`, `tenantId`, `email` are added on top.

### JWT is NOT encrypted

**The payload is Base64URL-encoded, not encrypted.** Anyone can decode it.

**Do not put secrets in a JWT.** Emails and role claims are fine — they're
meant to be read by the client.

**Interview line:** *"JWT is signed, not encrypted. Don't put sensitive data
in the payload."*

### Signing algorithms

| Algorithm | Type | Use |
|---|---|---|
| `HS256` | HMAC-SHA256 | Symmetric — same secret to sign and verify |
| `RS256` | RSA-SHA256 | Asymmetric — private key signs, public key verifies |
| `ES256` | ECDSA-SHA256 | Asymmetric, smaller keys than RSA |
| `none` | No signature | **Never use.** Attackers can craft tokens |

**HMAC (`HS256`)** is simpler — one shared secret. Good for monolithic apps.

**RSA/ECDSA (`RS256`/`ES256`)** allow public-key verification — good for
multiple services that share a public key but not the private one.

**Interview line:** *"Use RS256 when multiple services need to verify tokens
without sharing the signing key."*

### Why JWT is stateless

The server doesn't store sessions. All state is in the token, verified by
signature.

**Pros:**

- No server-side session storage
- Scales horizontally
- Works across microservices

**Cons:**

- **Cannot be revoked** easily (logout doesn't invalidate the token)
- Tokens are valid until expiration
- Payload size grows with claims

**Interview line:** *"JWTs are stateless — you can't revoke them without a
blocklist or short expirations."*

---

## Building JWT Auth in Spring

### Dependencies

```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
```

Or use **Nimbus** (`spring-security-oauth2-jose`) — Spring's default for
resource servers.

### JWT service — signing

```java
@Service
public class JwtService {
    private final SecretKey key;

    public JwtService(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(UserDetails user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(1, ChronoUnit.HOURS);

        return Jwts.builder()
                .subject(user.getUsername())
                .claim("roles", user.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .toList())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
```

### JWT filter

```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtService jwtService,
                                   UserDetailsService uds) {
        this.jwtService = jwtService;
        this.userDetailsService = uds;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");

        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(req, res);
            return;
        }

        String token = header.substring(7);

        try {
            Claims claims = jwtService.parseToken(token);
            String username = claims.getSubject();

            if (username != null
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails user = userDetailsService.loadUserByUsername(username);
                var auth = new UsernamePasswordAuthenticationToken(
                        user, null, user.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        } catch (JwtException e) {
            // invalid token — leave the context empty
            // ExceptionTranslationFilter will produce a 401
        }

        chain.doFilter(req, res);
    }
}
```

### Register the filter

```java
http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
```

### Login endpoint

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authManager;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authManager,
                          JwtService jwtService) {
        this.authManager = authManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public TokenResponse login(@RequestBody LoginRequest req) {
        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        req.username(), req.password()));

        String token = jwtService.generateToken(
                (UserDetails) auth.getPrincipal());

        return new TokenResponse(token, "Bearer", 3600);
    }
}
```

### Refresh tokens

Access tokens should be short-lived (15 min – 1 hour). Refresh tokens are
longer-lived (days – weeks) and used to get new access tokens.

```java
@PostMapping("/refresh")
public TokenResponse refresh(@RequestBody RefreshRequest req) {
    RefreshToken rt = refreshTokenRepo.findByToken(req.token())
            .orElseThrow(() -> new InvalidTokenException());

    if (rt.isExpired() || rt.isRevoked()) {
        throw new InvalidTokenException();
    }

    String newAccess = jwtService.generateToken(rt.getUser());
    return new TokenResponse(newAccess, "Bearer", 3600);
}
```

**Refresh tokens are stored server-side** — that's the point. They give you
revocation.

**Interview line:** *"Refresh tokens are stateful — stored on the server so
you can revoke them. Access tokens stay stateless."*

---

## Part 2 — OAuth2

### The problem OAuth2 solves

You want your app to access a user's Google Calendar **without** asking for
their Google password.

**OAuth2** gives you a **token** that grants limited access to a user's
resources.

### The four roles

| Role | Meaning |
|---|---|
| **Resource Owner** | The user |
| **Client** | Your app |
| **Authorization Server** | Issues tokens (Google, Keycloak, Auth0) |
| **Resource Server** | Hosts the resources (Google Calendar API) |

### The four grant types (flows)

| Grant | Use case |
|---|---|
| **Authorization Code** | Web apps (server-side) — the recommended flow |
| **Authorization Code + PKCE** | Mobile / SPA — modern replacement for implicit |
| **Client Credentials** | Service-to-service (no user) |
| **Refresh Token** | Get new access tokens |

**Deprecated:** Implicit flow, Resource Owner Password Credentials.

### Authorization Code flow

```d2
direction: right

user: "User" {
  style.fill: "#e3f2fd"
}
app: "Your App\n(Client)" {
  style.fill: "#c8e6c9"
}
authServer: "Auth Server\n(Keycloak)" {
  style.fill: "#fff9c4"
}
api: "Resource Server\n(API)" {
  style.fill: "#ffe0b2"
}

user.app -> app: "1. Click 'Login'"
app.authServer -> authServer: "2. Redirect to /authorize"
authServer.user -> user: "3. User logs in"
user.app -> app: "4. Redirect back with code"
app.authServer -> authServer: "5. Exchange code for token"
authServer.api -> api: "6. Access API with token"
```

**Steps:**

1. App redirects user to the auth server's `/authorize` endpoint
2. User authenticates with the auth server
3. Auth server redirects back to the app with an **authorization code**
4. App exchanges the code for an **access token** (and optionally a refresh
   token) via `/token`
5. App uses the access token to call the resource server

**Why the intermediate code?** Prevents the access token from being exposed
in the browser's URL bar, history, or referrer headers.

### Client Credentials flow

For service-to-service (no user):

```java
// Request
POST /token
Content-Type: application/x-www-form-urlencoded
grant_type=client_credentials
&client_id=my-service
&client_secret=secret

// Response
{
    "access_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 3600
}
```

**Interview line:** *"Client Credentials is for services — no user involved."*

### PKCE

**Proof Key for Code Exchange.** Prevents authorization code interception in
public clients (mobile, SPA).

1. Client generates a random `code_verifier`
2. Client sends `code_challenge = SHA256(code_verifier)` in the auth request
3. On token exchange, client sends `code_verifier`
4. Auth server verifies `SHA256(code_verifier) == code_challenge`

**Interview line:** *"PKCE protects public clients — mobile and SPAs — from
authorization code interception."*

### OpenID Connect (OIDC)

OIDC is **OAuth2 for authentication**. It adds:

- **ID Token** — a JWT with user identity (name, email, etc.)
- **UserInfo endpoint** — `/userinfo` for profile data
- **Standard scopes** — `openid`, `profile`, `email`

**Key difference:**

- **OAuth2** = authorization ("access my resources")
- **OIDC** = authentication ("who is the user?")

**Interview line:** *"OIDC = OAuth2 + identity. ID tokens are for login;
access tokens are for API calls."*

### Setting up a resource server in Spring

If your API only needs to **verify** JWTs (not issue them), use Spring's
resource server support.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
```

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com/realms/myrealm
          # or jwk-set-uri: https://auth.example.com/.well-known/jwks.json
```

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }

    private Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<String> roles = jwt.getClaimAsStringList("roles");
            return roles.stream()
                    .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                    .toList();
        });
        return converter;
    }
}
```

**What this gives you:**

- Spring fetches the JWKS (public keys) from the issuer at startup
- Every request with a `Bearer` token is validated automatically
- `SecurityContextHolder` gets the `JwtAuthenticationToken`
- `@PreAuthorize("hasRole('ADMIN')")` works

**Interview line:** *"Resource server mode: Spring validates JWTs signed by
an external issuer — no code needed beyond config."*

### Setting up a client (OAuth2 login)

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_CLIENT_SECRET}
            scope: openid,profile,email
```

```java
http.oauth2Login(Customizer.withDefaults());
```

Spring handles the entire authorization code flow.

---

## Stateful vs Stateless — The Trade-off

| | Session (cookies) | JWT |
|---|---|---|
| Server storage | Required | None |
| Revocation | Easy (delete session) | Hard (need blocklist) |
| Scaling | Requires sticky sessions or shared store | Horizontally scalable |
| Size | Small cookie | Larger header |
| Cross-service | Needs SSO | Natural |
| Logout | Server-side | Client drops token (still valid until exp) |

**When to choose:**

- **Session** — single server, or shared session store (Redis); need
  immediate revocation
- **JWT** — stateless APIs, multiple services, mobile clients, cross-domain

**Hybrid:** short-lived JWTs + refresh tokens stored server-side. Best of
both.

---

## JWT Revocation

JWTs are valid until expiry — you can't invalidate them without help.

**Solutions:**

1. **Short expirations** (5–15 min) + refresh tokens
2. **Token blocklist** — check a Redis set on every request
3. **Token version** in user record — increment on logout, include in claim
4. **Rotate signing keys** — invalidates all tokens (nuclear option)

**Most common:** short-lived access tokens + refresh tokens.

**Interview line:** *"You can't revoke a JWT — you shorten its life and
revoke the refresh token instead."*

---

## Tricky Corners ⚠️

**JWT payload is not encrypted.** Anyone can decode it. Never put secrets in
claims.

**Never accept `alg: none`.** Some JWT libraries used to allow it — a
critical vulnerability. Modern libraries default to rejecting it.

**Verify the signature on every request.** Skipping verification (e.g., just
decoding) allows anyone to forge tokens.

**Use `exp` claim and validate it.** A JWT without expiration is valid
forever.

**`HS256` shares a single secret.** If the secret leaks, all tokens are
compromised. `RS256` limits blast radius to the private key.

**Refresh tokens should be one-time-use.** Each refresh issues a new refresh
token; the old one is invalidated.

**Store refresh tokens securely** — httpOnly cookie, not localStorage.

**Never put JWTs in localStorage if XSS is a concern.** Cookies with
`httpOnly`, `Secure`, and `SameSite=Strict` are safer.

**Beware of JWT in URL parameters.** They end up in server logs, browser
history, referrer headers.

**JWKS caching.** Resource servers should cache the public keys from the
issuer — not fetch on every request.

**Key rotation** requires overlap: keep old keys published in JWKS until all
outstanding tokens expire.

**Clock skew** can cause valid tokens to appear expired. Allow a small
leeway (e.g., 60 seconds).

**OIDC ID tokens are NOT for API access.** Use the access token for that.

**`scope` vs `authorities`:** OAuth2 scopes map to authorities by default
(`SCOPE_read` for scope `read`). Customize with a `JwtAuthenticationConverter`.

**The `aud` claim must match your expected audience.** Missing this check
means a token issued for another service is accepted by yours.

---

## Common Pitfalls

- Putting sensitive data in JWT claims.
- Not validating `exp`, `iss`, `aud`.
- Using `HS256` and leaking the secret.
- Long-lived access tokens (days/weeks).
- Storing JWTs in localStorage with no XSS defense.
- Not revoking refresh tokens on logout.
- Accepting tokens without signature verification.
- Ignoring JWKS caching — fetching on every request.
- Using OIDC ID tokens for API access.
- Confusing OAuth2 (authorization) with OIDC (authentication).

---

## Key Interview Tips

- Say **"JWT is signed, not encrypted."**
- Explain **access token vs refresh token** — short-lived vs long-lived +
  server-stored.
- Say **"you can't revoke a JWT — you shorten its life and revoke the
  refresh token."**
- Explain **Authorization Code flow** in 4 steps.
- Say **"Client Credentials is for service-to-service."**
- Explain **PKCE** as "protection for public clients."
- Say **"OIDC = OAuth2 + identity."**
- Mention **resource server mode** as the standard for validating JWTs in
  Spring.
- Know **`RS256` vs `HS256`** — asymmetric vs symmetric.

---

## Related

- [Security Basics](spring-security-basics.md) — filter chain and
  `SecurityContextHolder`
- [Method Security](method-security.md) — `@PreAuthorize` with roles from JWT
- [Spring MVC](../mvc/spring-mvc.md) — controller integration
- [Configuration](../boot/configuration.md) — OAuth2 properties