# Spring Security Basics

> **Spring context:** Spring Boot 3.x with Spring Security 6.x. This file
> covers the filter chain, `SecurityContextHolder`, authentication vs
> authorization, and password encoding — the foundation for everything else
> in the Security section.

## Mental Model

Spring Security is a **filter chain** that intercepts every HTTP request.
Each filter decides whether to continue, block, or modify the request.

```d2
direction: right

request: "HTTP Request" {
  style.fill: "#e3f2fd"
}
filterChain: "SecurityFilterChain" {
  style.fill: "#fff9c4"
  desc: "Ordered chain of filters"
  f1: "CorsFilter" {
    style.fill: "#fff59d"
  }
  f2: "CsrfFilter" {
    style.fill: "#fff59d"
  }
  f3: "AuthenticationFilter\n(UsernamePassword,\nJwt, Basic)" {
    style.fill: "#fff59d"
  }
  f4: "AuthorizationFilter\n(access checks)" {
    style.fill: "#fff59d"
  }
}
app: "Your Controller" {
  style.fill: "#c8e6c9"
}
db: "Database" {
  style.fill: "#ffe0b2"
}

request.filterChain -> filterChain: ""
filterChain.f1 -> filterChain.f2: "→"
filterChain.f2 -> filterChain.f3: "→"
filterChain.f3 -> filterChain.f4: "→"
filterChain.app -> app: "if allowed"
filterChain.db -> db: "load user"
```

**Key facts:**

1. Security is a **filter chain**, not a servlet or interceptor
2. **Authentication** (who are you?) happens in the filter chain
3. **Authorization** (what can you do?) also happens in the filter chain
4. The **`SecurityContextHolder`** holds the authenticated user for the
   duration of the request
5. Password encoding is separate from authentication logic

---

## Authentication vs Authorization

| | Authentication | Authorization |
|---|---|---|
| Question | Who are you? | What can you do? |
| When | Before authorization | After authentication |
| Data | Credentials (username/password, JWT, session) | Roles, permissions, attributes |
| Failure | 401 Unauthorized | 403 Forbidden |
| Filters | `AuthenticationFilter` | `AuthorizationFilter` |
| Spring | `AuthenticationManager`, `UserDetailsService` | `AccessDecisionManager`, `GrantedAuthority` |

**Interview line:** *"Authentication identifies the user; authorization
decides what they can do."*

---

## The Filter Chain

Spring Security registers a `FilterChainProxy` that delegates to one or more
`SecurityFilterChain` beans.

### Built-in filter order (partial)

| Order | Filter | Purpose |
|---|---|---|
| 1 | `DisableEncodeUrlFilter` | Prevents session ID in URLs |
| 2 | `WebAsyncManagerIntegrationFilter` | Async support |
| 3 | `SecurityContextHolderFilter` | Populates `SecurityContext` |
| 4 | `HeaderWriterFilter` | Security headers (X-Frame-Options, etc.) |
| 5 | `CorsFilter` | CORS handling |
| 6 | `CsrfFilter` | CSRF token validation |
| 7 | `LogoutFilter` | Handles `/logout` |
| 8 | `UsernamePasswordAuthenticationFilter` | Form login |
| 9 | `BasicAuthenticationFilter` | HTTP Basic |
| 10 | `BearerTokenAuthenticationFilter` | JWT (OAuth2 resource server) |
| 11 | `RequestCacheAwareFilter` | Saved request restoration |
| 12 | `AnonymousAuthenticationFilter` | Populates anonymous authentication |
| 13 | `SessionManagementFilter` | Session policies |
| 14 | `ExceptionTranslationFilter` | Converts exceptions to 401/403 |
| 15 | `AuthorizationFilter` | Access control |

**Order matters.** Each filter may short-circuit the chain.

### Configuring the chain

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(Customizer.withDefaults())
            .httpBasic(Customizer.withDefaults());

        return http.build();
    }
}
```

### Modern style (Spring Security 6.x)

- **Lambda DSL** — `http.authorizeHttpRequests(auth -> ...)`
- **`requestMatchers`** — replaces `antMatchers` and `mvcMatchers`
- **`Customizer.withDefaults()`** — for enabling defaults

**Old style is deprecated** — use the lambda DSL.

---

## `SecurityContextHolder`

Holds the currently authenticated user. Uses a **`ThreadLocal`** by default.

```java
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
String username = auth.getName();
Collection<? extends GrantedAuthority> roles = auth.getAuthorities();
```

### Structure

```d2
direction: down

holder: "SecurityContextHolder" {
  style.fill: "#bbdefb"
  ctx: "SecurityContext" {
    style.fill: "#c8e6c9"
    auth: "Authentication" {
      style.fill: "#fff9c4"
      p: "principal — UserDetails or String" {
        style.fill: "#fff59d"
      }
      c: "credentials — password, usually nulled" {
        style.fill: "#fff59d"
      }
      a: "authorities — List<GrantedAuthority>" {
        style.fill: "#fff59d"
      }
      auth2: "authenticated — boolean" {
        style.fill: "#fff59d"
      }
    }
  }
}
```

### Access in controllers

```java
@GetMapping("/me")
public UserInfo getCurrentUser(@AuthenticationPrincipal UserDetails user) {
    return new UserInfo(user.getUsername(), user.getAuthorities());
}
```

`@AuthenticationPrincipal` resolves the principal from the context — cleaner
than `SecurityContextHolder` directly.

### Access in a service

```java
@Service
public class OrderService {
    public List<Order> myOrders() {
        String username = SecurityContextHolder.getContext()
                .getAuthentication().getName();
        return repo.findByCustomerUsername(username);
    }
}
```

### Testing

```java
@Test
void userCanAccessOwnOrders() {
    var auth = new UsernamePasswordAuthenticationToken("alice", null,
            List.of(new SimpleGrantedAuthority("ROLE_USER")));
    SecurityContextHolder.getContext().setAuthentication(auth);

    // test service method

    SecurityContextHolder.clearContext();   // clean up
}
```

**Always clear context in tests** — `ThreadLocal` leaks between tests.

---

## `UserDetailsService` — Loading Users

Spring Security asks your app to load a user by username.

```java
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public CustomUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        return users.findByUsername(username)
                .map(this::toUserDetails)
                .orElseThrow(() -> new UsernameNotFoundException(username));
    }

    private UserDetails toUserDetails(User u) {
        return org.springframework.security.core.userdetails.User
                .withUsername(u.getUsername())
                .password(u.getPasswordHash())
                .authorities(u.getRoles().stream()
                        .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                        .toList())
                .accountLocked(u.isLocked())
                .disabled(!u.isEnabled())
                .build();
    }
}
```

Spring Boot auto-wires this into the `AuthenticationManager`.

### In-memory alternative (dev only)

```java
@Bean
public UserDetailsService users() {
    UserDetails alice = User.withUsername("alice")
            .password(passwordEncoder().encode("password"))
            .roles("USER")
            .build();

    return new InMemoryUserDetailsManager(alice);
}
```

**Never use in production.**

---

## Password Encoding

**Never store plaintext passwords.**

### The `PasswordEncoder` interface

```java
public interface PasswordEncoder {
    String encode(CharSequence rawPassword);
    boolean matches(CharSequence rawPassword, String encodedPassword);
    default boolean upgradeEncoding(String encodedPassword) { return false; }
}
```

### Recommended implementation

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

Or with explicit strength:

```java
new BCryptPasswordEncoder(12);   // default is 10
```

### The encoder family

| Encoder | Notes |
|---|---|
| `BCryptPasswordEncoder` | **Recommended.** Adaptive, salt built-in |
| `Argon2PasswordEncoder` | Modern, memory-hard — winner of the Password Hashing Competition |
| `SCryptPasswordEncoder` | Memory-hard, similar to Argon2 |
| `Pbkdf2PasswordEncoder` | FIPS-compliant, slower |
| `NoOpPasswordEncoder` | **Never use.** Plain text |
| `StandardPasswordEncoder` | **Deprecated** (SHA-256) |
| `MessageDigestPasswordEncoder` | Legacy — avoid |

**Interview line:** *"Use `BCryptPasswordEncoder` or `Argon2PasswordEncoder`.
Never MD5, SHA-1, or plain SHA-256 — they're too fast and vulnerable to
brute-force."*

### Why BCrypt?

- **Adaptive** — you can increase the cost factor as hardware improves
- **Salted** — a random salt is generated per password, stored inline
- **Slow by design** — brute force is expensive

### Delegating encoder — for migration

```java
@Bean
public PasswordEncoder passwordEncoder() {
    String idForEncode = "bcrypt";
    Map<String, PasswordEncoder> encoders = Map.of(
        "bcrypt", new BCryptPasswordEncoder(),
        "pbkdf2", new Pbkdf2PasswordEncoder()
    );
    return new DelegatingPasswordEncoder(idForEncode, encoders);
}
```

Stored passwords get a prefix `{bcrypt}` or `{pbkdf2}`. New passwords use
`bcrypt`; old ones still validate. **Recommended for migrating from an old
scheme.**

### Never decode

`PasswordEncoder.encode()` is **one-way**. There's no `decode`. Compare with
`matches(raw, encoded)`.

**Interview line:** *"Passwords are hashed, not encrypted — you compare
hashes, you never decrypt."*

---

## CSRF Protection

**CSRF** — Cross-Site Request Forgery. An attacker tricks a logged-in user's
browser into making a request.

**When to enable:**

- Session-based auth (cookies) → **enable CSRF**
- Stateless JWT in `Authorization` header → **disable CSRF**

```java
http.csrf(csrf -> csrf.disable());   // for JWT-based APIs
```

**Why:** CSRF relies on cookies being sent automatically. If your auth is
header-based, no cookie is sent, and CSRF is not a threat.

### CSRF with cookies

Spring Security auto-generates a `CSRF-TOKEN` and validates it on every
state-changing request (POST/PUT/DELETE/PATCH).

Include the token in forms via `_csrf` hidden field (Thymeleaf does this
automatically) or in AJAX via the `X-CSRF-TOKEN` header.

---

## CORS

**CORS** — Cross-Origin Resource Sharing. Browser-enforced protection that
only allows requests from permitted origins.

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated());
    return http.build();
}

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://app.example.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

**Trap:** `allowedOrigins("*")` + `allowCredentials(true)` is **rejected** by
browsers. Use `allowedOriginPatterns` if you need wildcards.

**Interview line:** *"CORS is browser-enforced, not server-enforced. A `curl`
request ignores CORS."*

---

## Session Management

### Session-based (default for form login)

```java
http.sessionManagement(session -> session
    .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
    .maximumSessions(1)                  // one session per user
    .maxSessionsPreventsLogin(true)
);
```

### Stateless (for JWT APIs)

```java
http.sessionManagement(session -> session
    .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
);
```

| Policy | Meaning |
|---|---|
| `ALWAYS` | Create a session for every request |
| `IF_REQUIRED` | Create only when needed (default) |
| `NEVER` | Never create, but use if one exists |
| `STATELESS` | Never create or use |

**Interview line:** *"For JWT APIs, use `STATELESS`."*

---

## Exception Handling

`ExceptionTranslationFilter` converts security exceptions:

| Exception | HTTP |
|---|---|
| `AuthenticationException` (subclass) | 401 Unauthorized |
| `AccessDeniedException` | 403 Forbidden |
| `AuthenticationCredentialsNotFoundException` | 401 |

### Custom handlers

```java
http
    .exceptionHandling(ex -> ex
        .authenticationEntryPoint((req, res, e) -> {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"Unauthorized\"}");
        })
        .accessDeniedHandler((req, res, e) -> {
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"Forbidden\"}");
        })
    );
```

**Important for REST APIs** — default handlers redirect to login pages, which
breaks API clients.

---

## Full Config Example — REST API with JWT

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final UserDetailsService users;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter,
                          UserDetailsService users) {
        this.jwtFilter = jwtFilter;
        this.users = users;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new RestAuthenticationEntryPoint())
                .accessDeniedHandler(new RestAccessDeniedHandler())
            );

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg)
            throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

---

## Tricky Corners ⚠️

**`SecurityContextHolder` uses `ThreadLocal`.** In async code or thread
pools, the context doesn't propagate automatically.

**In Spring Security 6, `SecurityContextHolder` uses a `Supplier` strategy**
that can reset after the request. Access it only during request handling.

**`@EnableWebSecurity` is required** in plain Spring. Spring Boot auto-enables
it when Spring Security is on the classpath.

**Order of filters matters.** Register custom filters in the right place —
`addFilterBefore`, `addFilterAfter`, `addFilterAt`.

**`hasRole("ADMIN")`** expects the authority `ROLE_ADMIN`. Either prefix your
authorities or use `hasAuthority("ADMIN")`.

**`permitAll()`** doesn't disable authentication — it just doesn't require it.
`AnonymousAuthenticationFilter` still runs.

**Custom `AuthenticationEntryPoint`** must be configured for REST APIs;
otherwise 401 responses are HTML redirects.

**`SecurityContextHolder.clearContext()` is required in tests** to avoid
`ThreadLocal` leaks.

**`BCryptPasswordEncoder` strength is a trade-off.** Strength 10 (~100ms per
hash) is a good default. Higher = slower logins.

**Never log passwords or password hashes.** They show up in logs, APM tools,
and error trackers.

**`NoOpPasswordEncoder`** is only for tests or demos — never production.

**CSRF tokens are stored in the session by default.** For stateless APIs,
disable CSRF instead of using `CookieCsrfTokenRepository`.

**CORS + Spring Security** requires CORS config on both sides: `WebMvcConfigurer`
and the security filter chain (or use the `.cors()` DSL with a shared source).

**Anonymous authentication is still authentication** — `isAuthenticated()`
returns `true` for the anonymous filter. Check for
`AnonymousAuthenticationToken` if you need real authentication.

**`@AuthenticationPrincipal`** resolves to `UserDetails` or the raw principal
— depends on how it was set during authentication.

**Method security is a separate concern** from HTTP authorization — see
[Method Security](method-security.md).

---

## Common Pitfalls

- Storing passwords with `NoOpPasswordEncoder` or MD5/SHA-1.
- Confusing authentication (401) and authorization (403).
- Assuming `SecurityContextHolder` propagates to async threads.
- Forgetting to disable CSRF for stateless JWT APIs.
- Not configuring CORS on both Spring MVC and Spring Security.
- Letting default exception handlers redirect to login pages on REST APIs.
- Using `hasRole("ADMIN")` without `ROLE_` prefix on authorities.
- Leaking `SecurityContext` between tests.

---

## Key Interview Tips

- Say **"Spring Security is a filter chain."**
- Distinguish **authentication (401) vs authorization (403)**.
- Explain **`SecurityContextHolder`** as a `ThreadLocal`-backed store.
- Say **"use `BCryptPasswordEncoder` or Argon2"** — never MD5/SHA.
- Explain **why CSRF is disabled for JWT APIs**: no cookies involved.
- Mention **`@EnableMethodSecurity`** for method-level auth.
- Know that **CORS is browser-enforced, not server-enforced.**
- Say **"`STATELESS` session policy for JWT."**

---

## Related

- [JWT & OAuth2](jwt-and-oauth2.md) — stateless authentication
- [Method Security](method-security.md) — `@PreAuthorize` and role checks
- [Spring MVC](../mvc/spring-mvc.md) — controller integration
- [Configuration](../boot/configuration.md) — security properties