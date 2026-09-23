# Circular Dependencies

> **Spring context:** Spring Boot 2.6+ disables circular references by default
> (`spring.main.allow-circular-references=false`). Previous versions resolved
> some cases silently. This file explains what actually happens.

## Mental Model

A **circular dependency** occurs when two (or more) beans need each other to
be constructed.

```d2
direction: right

a: "A" {
  style.fill: "#bbdefb"
}
b: "B" {
  style.fill: "#c8e6c9"
}
c: "C" {
  style.fill: "#fff9c4"
}

a.b -> b: "needs"
b.c -> c: "needs"
c.a -> a: "needs"
```

Classic cases:

- **Direct cycle:** A → B → A
- **Indirect cycle:** A → B → C → A
- **Self-injection:** A → A (rare, but used for proxy workarounds)

---

## The Problem — Constructor Injection

```java
@Service
public class A {
    private final B b;
    public A(B b) { this.b = b; }
}

@Service
public class B {
    private final A a;
    public B(A a) { this.a = a; }
}
```

**Result:** `BeanCurrentlyInCreationException`.

**Why:** Spring can't create A without B, and can't create B without A.
Deadlock at startup.

```text
Error creating bean with name 'a':
Requested bean is currently in creation: Is there an unresolvable circular reference?
```

---

## The (Partial) Solution — Setter Injection

If you use **setter injection** for one side of the cycle, Spring can break
it:

```java
@Service
public class A {
    private final B b;
    public A(B b) { this.b = b; }   // constructor — needs B now
}

@Service
public class B {
    private A a;

    @Autowired
    public void setA(A a) { this.a = a; }   // setter — can be filled later
}
```

**Sequence:**

1. Spring creates B first (or A — order is definition-based)
2. To create B, it needs A
3. Creating A needs B — but B is *being created* (early reference available)
4. Spring injects the early B into A
5. A completes
6. Spring calls `setA(A)` on B, completing B

This works because Spring can hand out a **partially initialized** B to A.

**But — Spring 2.6+ disallows this by default.** You must explicitly opt in:

```properties
spring.main.allow-circular-references=true
```

**Interview line:** *"Setter injection can break a circular dependency because
Spring can give the caller an early reference. Constructor injection cannot,
because the object isn't usable until its constructor completes."*

---

## The Three-Level Cache

This is how Spring **actually resolves** circular setter/field injections.

Spring stores partially-created singletons in three maps:

| Cache | Type | Contains |
|---|---|---|
| **`singletonObjects`** | `Map<String, Object>` | Fully initialized singletons |
| **`earlySingletonObjects`** | `Map<String, Object>` | Early references (no proxy yet) |
| **`singletonFactories`** | `Map<String, ObjectFactory<?>>` | Factories that can produce early references (with proxies) |

```d2
direction: down

request: "getBean(A)" {
  style.fill: "#e3f2fd"
}
l1: "1. singletonObjects\n(fully initialized?)" {
  style.fill: "#c8e6c9"
}
l2: "2. earlySingletonObjects\n(early reference?)" {
  style.fill: "#fff9c4"
}
l3: "3. singletonFactories\n(can create early ref\nwith proxy)" {
  style.fill: "#ffe0b2"
}
create: "Create new bean\n(registration as factory)" {
  style.fill: "#f8bbd0"
}

request.l1 -> l1: "lookup"
request.l1.l2 -> l2: "miss"
l2.l3 -> l3: "miss"
l3.create -> create: "miss"
```

### Flow

1. Spring asks for a bean → check `singletonObjects` (fully initialized)
2. Miss → check `earlySingletonObjects` (already-produced early ref)
3. Miss → check `singletonFactories` (a factory that can produce the early
   reference, potentially wrapping it in an AOP proxy)
4. Miss → create the bean, register an `ObjectFactory` in
   `singletonFactories`, and continue construction

**Why three levels?** The factory cache (**level 3**) is the key — it allows
Spring to create an **AOP proxy** for the bean, if needed, before the bean is
fully initialized. Once a bean is looked up via its factory, Spring moves the
result into level 2 to avoid creating the proxy twice.

**Interview line:** *"The three caches let Spring hand out an early reference
to a partially-created bean — and create the AOP proxy on demand at the right
moment."*

### Why not just two caches?

Because Spring needs to defer **proxy creation** until it's actually needed.
`singletonFactories` holds `ObjectFactory` instances that will call
`getEarlyBeanReference(...)` on all `SmartInstantiationAwareBeanPostProcessor`s
(including the AOP proxy creator) if requested.

Without level 3, Spring would have to create the proxy eagerly for every bean —
expensive and wrong for beans that are never self-referenced.

---

## Why Constructor Injection Cannot Be Resolved

Even with three caches, Spring can't resolve constructor cycles:

- To call `new A(b)`, Spring needs a fully-usable B
- B doesn't exist yet (B's constructor needs A)
- Spring has no partial B to hand out — B has no fields set

**Setter/field injection works** because the object exists (constructor
completed) even if its fields aren't populated.

**Interview line:** *"Three-level cache resolves setter/field cycles, not
constructor cycles. Constructor cycles are a design smell — fix them by
refactoring."*

---

## The Fix — Refactor

The proper fix is a design change, not a Spring workaround.

### 1. Extract a shared dependency

```java
// Before: A → B → A
// After: A → C, B → C

@Service
public class C { /* shared logic */ }

@Service
public class A {
    private final C c;
    public A(C c) { this.c = c; }
}

@Service
public class B {
    private final C c;
    public B(C c) { this.c = c; }
}
```

### 2. Introduce an interface / event

```java
// A publishes an event; B listens
@Service
public class A {
    private final ApplicationEventPublisher events;
    public A(ApplicationEventPublisher events) { this.events = events; }

    public void doSomething() {
        events.publishEvent(new AEvent(...));
    }
}

@Service
public class B {
    @EventListener
    public void onAEvent(AEvent e) { ... }
}
```

No direct reference — the dependency becomes asynchronous.

### 3. Use `ApplicationContext` lookup

```java
@Service
public class A {
    private final ApplicationContext ctx;

    public A(ApplicationContext ctx) { this.ctx = ctx; }

    public void doSomething() {
        B b = ctx.getBean(B.class);   // resolved at call time
    }
}
```

**Rarely the right answer** — hides the dependency.

---

## The Workaround — `@Lazy`

If you can't refactor immediately, `@Lazy` breaks the cycle:

```java
@Service
public class A {
    private final B b;
    public A(@Lazy B b) { this.b = b; }   // inject a proxy, not the real B
}

@Service
public class B {
    private final A a;
    public B(A a) { this.a = a; }
}
```

**What `@Lazy` does:** Spring injects a **proxy** for B instead of the real
bean. When A first calls a method on B, the proxy resolves B on demand.

**Downsides:**

- Hides the cyclic dependency
- Delays failure to first use
- Makes debugging harder

**Use `@Lazy` only as a temporary fix.** Refactor when possible.

### `@Lazy` on `@Bean` methods

```java
@Configuration
public class Config {
    @Bean
    @Lazy
    public B b(A a) { return new B(a); }

    @Bean
    public A a(B b) { return new A(b); }
}
```

The `@Lazy` on `b()` defers its creation until first use.

---

## Self-Injection

Sometimes a bean needs a reference to **its own proxy** — for
`@Transactional`/`@Async` method calls that would otherwise bypass the proxy.

```java
@Service
public class OrderService {
    @Autowired
    @Lazy
    private OrderService self;

    public void placeOrder() {
        self.saveOrder();   // goes through the proxy
    }

    @Transactional
    public void saveOrder() { ... }
}
```

**Why `@Lazy`?** Without it, Spring would try to inject the bean into itself
during creation → circular reference. `@Lazy` injects a proxy that resolves
later.

**Alternative:** `AopContext.currentProxy()` — requires
`@EnableAspectJAutoProxy(exposeProxy = true)`.

**Covered in detail in [AOP & Proxies](../aop/aop-and-proxies.md).**

---

## Spring Boot 2.6+ Changes

Since Spring Boot 2.6, circular references are **disabled by default**:

```properties
# Default since 2.6
spring.main.allow-circular-references=false
```

If you need to enable it (short-term migration aid):

```properties
spring.main.allow-circular-references=true
```

**Why the change?** Circular dependencies are almost always design problems.
Forcing developers to fix them improves code quality.

**Interview line:** *"Boot 2.6 flipped the default to disallow circular
references — a deliberate choice to surface design smells."*

---

## Detecting Cycles at Startup

Spring reports the cycle in the exception message:

```text
┌─────┐
|  a defined in file [...]
↑     ↓
|  b defined in file [...]
└─────┘
```

The diagram shows the cycle visually.

**Common sources of unintended cycles:**

- Two services that both use each other's logic
- A service and its listener
- A repository and its entity listener
- A config class and a bean that depends on it

---

## Tricky Corners ⚠️

**Constructor cycles cannot be resolved** by the three-level cache. Refactor
or use `@Lazy`.

**`@Lazy` on a constructor parameter injects a proxy**, not the real bean.
Method calls trigger real resolution.

**`@Lazy` + `@Autowired` on a field works the same way** — proxy injected.

**Even with `allow-circular-references=true`, constructor cycles still fail.**
The flag only re-enables setter/field cycles.

**`@PostConstruct` runs on the early reference** if the bean is injected
before init. This can cause subtle bugs — the injected bean may not be
fully initialized when used.

**Self-injection with `@Lazy` is the standard workaround** for
`@Transactional`/`@Async` self-calls.

**AOP proxies + cycles = more complex cache interactions.** The
`singletonFactories` cache exists specifically to defer proxy creation
until it's needed.

**Circular dependencies can hide infinite loops in application logic.**
Sometimes the "circular dependency" is really a symptom of tangled
responsibilities.

**Testing circular dependencies is painful.** The refactor to fix them
usually improves testability too.

---

## Common Pitfalls

- Using `@Lazy` as a permanent fix instead of refactoring.
- Assuming `allow-circular-references=true` fixes constructor cycles — it
  doesn't.
- Injecting `ApplicationContext` to break a cycle — hides the design problem.
- Missing the cycle diagram in the exception message and only reading the
  top line.
- Using self-injection when `AopContext.currentProxy()` would be cleaner.
- Ignoring cycles until they break at startup in production.

---

## Key Interview Tips

- Say **"constructor injection cannot resolve cycles; setter/field injection
  can."**
- Explain the **three-level cache** in one sentence: `singletonObjects`,
  `earlySingletonObjects`, `singletonFactories`.
- Explain why **three** levels are needed: to defer AOP proxy creation.
- Mention **Boot 2.6+ disables circular refs by default.**
- List the fixes: **refactor > event-driven > `@Lazy` > `ApplicationContext`.**
- Describe self-injection + `@Lazy` as the way to fix `@Transactional`
  self-calls.

---

## Related

- [IoC & Dependency Injection](ioc-and-di.md) — how beans get wired
- [Bean Lifecycle](bean-lifecycle.md) — when caching and proxies happen
- [AOP & Proxies](../aop/aop-and-proxies.md) — why self-injection matters
- [Transaction Management](../transactions/transaction-management.md) — the
  self-invocation trap