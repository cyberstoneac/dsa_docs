# Method Security

> **Spring context:** Spring Security 6.x. `@EnableMethodSecurity` replaced
> the older `@EnableGlobalMethodSecurity` in Spring Security 5.6+. Focus is
> on `@PreAuthorize`, SpEL, and the proxy mechanics behind method-level
> authorization.

## Mental Model

HTTP-level authorization (`.requestMatchers("/admin/**").hasRole("ADMIN")`)
protects URLs. **Method security protects method calls** — regardless of
entry point.

```d2
direction: right

entry: "Any entry point" {
  style.fill: "#e3f2fd"
  desc: "HTTP, scheduler,\nmessage listener, direct call"
}
proxy: "AOP Proxy" {
  style.fill: "#fff9c4"
  desc: "MethodSecurityInterceptor\nwraps the method"
}
check: "Authorization check" {
  style.fill: "#ffe0b2"
  desc: "Evaluates @PreAuthorize\nagainst SecurityContext"
}
target: "Target method" {
  style.fill: "#c8e6c9"
}

entry.proxy -> proxy: "call"
proxy.check -> check: "before"
check.target -> target: "if allowed"
```

**Two reasons method security beats URL-based:**

1. **Defense in depth** — a method protected at the method level stays
   protected even if called from a different entry point (message queue,
   scheduler, another service)
2. **Fine-grained** — you can check method arguments, not just the URL

**Interview line:** *"Method security protects the method itself, not the
URL — it works from any entry point."*

---

## Enabling Method Security

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity          // modern, Spring Security 6.x
public class SecurityConfig { }
```

### `@EnableMethodSecurity` options

```java
@EnableMethodSecurity(
    prePostEnabled = true,       // default — @PreAuthorize, @PostAuthorize
    securedEnabled = true,       // @Secured
    jsr250Enabled = true         // @RolesAllowed (JSR-250)
)
```

All three default to `true` when using `@EnableMethodSecurity`. You can turn
them off individually.

### Deprecated alternative

```java
@EnableGlobalMethodSecurity(prePostEnabled = true)   // Spring Security < 5.6
```

Don't use in new code.

---

## The Three Annotation Families

| Family | Annotation | Origin |
|---|---|---|
| **Spring (pre/post)** | `@PreAuthorize`, `@PostAuthorize`, `@PreFilter`, `@PostFilter` | Spring |
| **Spring (secured)** | `@Secured` | Spring |
| **JSR-250** | `@RolesAllowed`, `@PermitAll`, `@DenyAll` | Jakarta EE |

**Recommendation:** prefer `@PreAuthorize` — it supports SpEL, has the most
flexibility, and is the modern default.

---

## `@PreAuthorize`

Checked **before** the method runs.

```java
@PreAuthorize("hasRole('ADMIN')")
public void deleteUser(long userId) { ... }
```

If the check fails, `AccessDeniedException` is thrown. The method never runs.

### SpEL expressions

```java
// Role check
@PreAuthorize("hasRole('ADMIN')")
@PreAuthorize("hasAnyRole('ADMIN', 'MODERATOR')")

// Authority check
@PreAuthorize("hasAuthority('user:write')")
@PreAuthorize("hasAnyAuthority('user:write', 'user:delete')")

// Authenticated
@PreAuthorize("isAuthenticated()")
@PreAuthorize("isAnonymous()")
@PreAuthorize("isRememberMe()")
@PreAuthorize("isFullyAuthenticated()")   // not just remember-me

// Expression on argument
@PreAuthorize("#userId == authentication.principal.id")
public void updateProfile(long userId, Profile profile) { ... }

// Bean reference
@PreAuthorize("@orderSecurity.canAccess(#orderId)")
public Order getOrder(long orderId) { ... }

// Combined
@PreAuthorize("hasRole('USER') and #userId == authentication.principal.id")
public void updateUser(long userId, User user) { ... }
```

### Reference to `authentication`

`authentication` is available in SpEL — it's the current `Authentication`.

```java
@PreAuthorize("#username == authentication.name")
public List<Order> ordersFor(String username) { ... }
```

### Reference to method arguments

```java
@PreAuthorize("#userId == authentication.principal.id or hasRole('ADMIN')")
public User getUser(long userId) { ... }
```

`#userId` refers to the method parameter named `userId`. `#p0` and `#a0`
also work positionally.

### Reference to `principal`

```java
@PreAuthorize("#userId == principal.id")
```

`principal` is a shortcut for `authentication.principal`.

---

## `@PostAuthorize`

Checked **after** the method returns. The result is available as `returnObject`.

```java
@PostAuthorize("returnObject.owner == authentication.name or hasRole('ADMIN')")
public Document getDocument(long id) { ... }
```

**Use when:** you need to load the resource first to know who owns it.

**Downside:** the method **runs** before the check. For expensive operations
(DB writes, external calls), use `@PreAuthorize` with an ownership check that
doesn't need the object.

**Interview line:** *"`@PostAuthorize` runs the method, then checks the
result — use it only for read operations where you can't determine ownership
in advance."*

---

## `@PreFilter` and `@PostFilter`

Filter collections **element by element**.

```java
@PreFilter("filterObject.owner == authentication.name")
public void updateTasks(List<Task> tasks) { ... }

@PostFilter("filterObject.owner == authentication.name or hasRole('ADMIN')")
public List<Order> getOrders() { ... }
```

`filterObject` is the current element being evaluated.

**Performance warning:** these run in memory, per element. Bad for large
collections. **Prefer** database-level filtering (`WHERE owner = ?`).

**Interview line:** *"`@PostFilter` filters in memory — always prefer a query
that filters in the database."*

---

## `@Secured`

Simpler alternative to `@PreAuthorize`. No SpEL.

```java
@Secured("ROLE_ADMIN")
public void deleteUser(long id) { ... }

@Secured({"ROLE_ADMIN", "ROLE_MODERATOR"})
public void moderate(long id) { ... }
```

**Requires `ROLE_` prefix.**

**No expressions** — you can't check method arguments.

**Rule:** use `@Secured` for simple role checks, `@PreAuthorize` for
everything else.

---

## JSR-250 Annotations

```java
@RolesAllowed({"ADMIN", "MODERATOR"})
public void moderate() { ... }

@PermitAll
public void publicMethod() { ... }

@DenyAll
public void neverCall() { ... }
```

**Note:** `@RolesAllowed` doesn't require the `ROLE_` prefix — unlike
`@Secured` and `hasRole()`. It matches authorities directly.

**Interview trap:** `@RolesAllowed("ADMIN")` checks for authority `ADMIN`,
while `@Secured("ROLE_ADMIN")` and `hasRole('ADMIN')` check for `ROLE_ADMIN`.

---

## `hasRole` vs `hasAuthority`

```java
hasRole('ADMIN')                 // checks for ROLE_ADMIN
hasAuthority('ROLE_ADMIN')       // checks for ROLE_ADMIN
hasAuthority('ADMIN')            // checks for ADMIN
```

**`hasRole('X')` automatically prefixes `ROLE_`.** `hasAuthority` doesn't.

**Interview line:** *"`hasRole('ADMIN')` == `hasAuthority('ROLE_ADMIN')`."*

### Why the prefix?

Originally, JSR-250 said roles are named without prefix, but Spring's
`RoleVoter` used `ROLE_` internally. When authorities contain `ROLE_`, they're
treated as roles.

**Best practice:** store authorities as `ROLE_*` and use `hasRole('*')` or
`hasAuthority('ROLE_*')` consistently.

---

## Custom Permission Evaluator

For complex rules that need database access or business logic:

```java
@Component("orderSecurity")
public class OrderSecurityEvaluator {

    private final OrderRepository orders;

    public OrderSecurityEvaluator(OrderRepository orders) {
        this.orders = orders;
    }

    public boolean canAccess(long orderId) {
        String username = SecurityContextHolder.getContext()
                .getAuthentication().getName();
        return orders.findById(orderId)
                .map(o -> o.getCustomer().getUsername().equals(username))
                .orElse(false);
    }
}
```

Usage:

```java
@PreAuthorize("@orderSecurity.canAccess(#orderId)")
public Order getOrder(long orderId) { ... }
```

**Benefits:**

- Complex checks live in testable Java code
- Reusable across methods
- No SpEL gymnastics

**Interview line:** *"For non-trivial rules, extract a bean and reference it
with `@beanName.methodName()` in `@PreAuthorize`."*

---

## How Method Security Actually Works

Like `@Transactional` and `@Cacheable`, method security uses **AOP proxies**.

```d2
direction: right

client: "Caller" {
  style.fill: "#e3f2fd"
}
proxy: "Proxy" {
  style.fill: "#fff9c4"
  interceptor: "MethodSecurityInterceptor" {
    style.fill: "#ffe0b2"
  }
}
target: "Target method" {
  style.fill: "#c8e6c9"
}

client.proxy -> proxy: "call"
proxy.interceptor -> interceptor: "check"
interceptor.target -> target: "if allowed"
```

**The interceptor:**

1. Reads the annotation metadata for the method
2. Builds a `MethodInvocation`
3. Evaluates the SpEL expression against `SecurityContextHolder`
4. Allows or throws `AccessDeniedException`

### The self-invocation trap

**Method security has the same proxy limitation as `@Transactional` and
`@Async`:**

```java
@Service
public class OrderService {

    public void placeOrder() {
        adminOnlyMethod();   // ❌ @PreAuthorize ignored
    }

    @PreAuthorize("hasRole('ADMIN')")
    public void adminOnlyMethod() { ... }
}
```

The internal call bypasses the proxy. **Same fixes** as `@Transactional`:

1. Move the method to another bean
2. Inject self with `@Lazy`
3. `AopContext.currentProxy()`

**Interview line:** *"Self-invocation bypasses method security — same trap as
`@Transactional`."*

---

## Method Security on Interfaces

**Not recommended.** Annotations on interface methods may not be honored
depending on proxy type.

**Rule:** put `@PreAuthorize` on the concrete class, not the interface.

---

## Combining with URL-Based Security

Both are useful:

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
);
```

```java
@RestController
public class AdminController {

    @PreAuthorize("hasRole('ADMIN') and hasAuthority('user:delete')")
    @DeleteMapping("/api/admin/users/{id}")
    public void deleteUser(@PathVariable long id) { ... }
}
```

**URL security** filters at the perimeter. **Method security** enforces at
the business logic.

**Interview line:** *"URL and method security aren't alternatives — they
complement. URL is a fast path; method is authoritative."*

---

## Testing Method Security

### With `@WithMockUser`

```java
@SpringBootTest
class OrderServiceTest {

    @Autowired
    private OrderService orderService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanDelete() {
        assertThatCode(() -> orderService.delete(1L))
                .doesNotThrowAnyException();
    }

    @Test
    @WithMockUser(roles = "USER")
    void userCannotDelete() {
        assertThatThrownBy(() -> orderService.delete(1L))
                .isInstanceOf(AccessDeniedException.class);
    }
}
```

### With a custom principal

```java
@Test
@WithUserDetails("alice")   // loads via UserDetailsService
void aliceCanAccessOwnProfile() { ... }
```

### Manual context setup

```java
@Test
void manualSetup() {
    var auth = new UsernamePasswordAuthenticationToken("alice", null,
            List.of(new SimpleGrantedAuthority("ROLE_USER")));
    SecurityContextHolder.getContext().setAuthentication(auth);

    try {
        // call service
    } finally {
        SecurityContextHolder.clearContext();
    }
}
```

**Always clear the context** after the test.

---

## Common Patterns

### Owner-only access

```java
@PreAuthorize("#userId == principal.id")
public UserProfile getProfile(long userId) { ... }
```

### Admin or owner

```java
@PreAuthorize("#userId == principal.id or hasRole('ADMIN')")
public UserProfile getProfile(long userId) { ... }
```

### Write requires higher role

```java
@PreAuthorize("hasAuthority('order:write')")
public Order updateOrder(Order order) { ... }
```

### Tenant isolation

```java
@PreAuthorize("#tenantId == principal.tenantId")
public List<Data> getData(String tenantId) { ... }
```

### Service-layer enforcement

```java
@Service
@PreAuthorize("hasRole('USER')")   // class-level default
public class UserService {

    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(long id) { ... }   // overrides class-level
}
```

---

## Tricky Corners ⚠️

**Self-invocation bypasses method security.** Same trap as `@Transactional`.

**Method security is proxy-based.** `final`/`private`/`static` methods can't
be advised.

**`@EnableMethodSecurity` is required** — otherwise annotations are ignored.

**`hasRole('ADMIN')` prefixes `ROLE_`.** `hasAuthority('ADMIN')` doesn't.
Pick one convention.

**`@PostAuthorize` runs the method first.** For expensive operations, prefer
`@PreAuthorize`.

**`@PostFilter`/`@PreFilter` run in memory.** Bad for large collections.

**`@Secured` and `@PreAuthorize` on the same method** — behavior is
undefined. Use one.

**Custom permission evaluator beans** must be Spring beans with a name; the
`@PreAuthorize` references them by name.

**Test `@WithMockUser` doesn't load your `UserDetailsService`** unless you
use `@WithUserDetails`.

**`@PreAuthorize` on interfaces** may not work reliably — put it on concrete
classes.

**`AccessDeniedException` propagates as 500 unless handled.** For REST APIs,
configure an `@ExceptionHandler` or `AccessDeniedHandler`.

**Method security and `@Transactional` order matters.** Typically security
runs first — but check your aspect order if you have custom aspects.

**Complex SpEL expressions hurt readability.** Extract to a bean when they
get long.

**`@PreAuthorize("permitAll()")`** returns true for everyone including
anonymous.

**`@PreAuthorize("denyAll()")`** always fails — useful as a default that
must be overridden.

**`@PreAuthorize` doesn't work on `@Controller` methods if they're not
proxied** — but Spring's `DispatcherServlet` doesn't dispatch to proxies for
request mappings. URL-level security covers controllers.

---

## Common Pitfalls

- Forgetting `@EnableMethodSecurity`.
- Self-invoking a `@PreAuthorize` method.
- Mixing `ROLE_` prefix conventions.
- Using `@PostFilter` for large lists.
- Putting `@PreAuthorize` on interfaces.
- Assuming `@PostAuthorize` prevents work — it doesn't.
- Not configuring an `AccessDeniedHandler` for REST APIs.
- Writing complex SpEL that should be a bean.

---

## Key Interview Tips

- Say **"method security is AOP-based"** — same proxy mechanics as
  `@Transactional`.
- Explain **`hasRole` vs `hasAuthority`** with the `ROLE_` prefix.
- Distinguish **`@PreAuthorize` vs `@PostAuthorize`** — before vs after.
- Say **"`@PostFilter` filters in memory — prefer DB filtering."**
- Explain **self-invocation breaks method security** — same as
  `@Transactional`.
- Mention **custom permission evaluator beans** for complex rules.
- Say **"URL and method security complement each other."**

---

## Related

- [Security Basics](spring-security-basics.md) — filter chain and context
- [JWT & OAuth2](jwt-and-oauth2.md) — where roles come from
- [AOP & Proxies](../aop/aop-and-proxies.md) — the proxy mechanics
- [Transaction Management](../transactions/transaction-management.md) — same
  self-invocation trap