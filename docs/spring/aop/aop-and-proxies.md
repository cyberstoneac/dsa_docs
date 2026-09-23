# AOP & Proxies

> **Spring context:** Spring AOP is proxy-based. It's not full AspectJ — but
> it covers 95% of use cases and integrates with `@Transactional`, `@Async`,
> `@Cacheable`, and `@Retryable`.

## Mental Model

**Aspect-Oriented Programming (AOP)** lets you apply behavior to many methods
without modifying them. Cross-cutting concerns like logging, transactions,
security, and metrics get separated from business logic.

```d2
direction: right

client: "Client" {
  style.fill: "#e3f2fd"
}
proxy: "Proxy" {
  style.fill: "#fff9c4"
  desc: "wraps target"
}
target: "Target\n(business logic)" {
  style.fill: "#c8e6c9"
}
aspect: "Aspect\n(@Transactional,\n@Async, @Cacheable)" {
  style.fill: "#ffe0b2"
}

client.proxy -> proxy: "call"
proxy.aspect -> aspect: "applies advice"
proxy.target -> target: "delegates"
```

**The key fact:** when Spring injects a bean that has any AOP advice, you
receive the **proxy**, not the raw object. Every method call on the proxy
passes through the advice chain.

---

## Why AOP Exists

Consider logging every service method:

```java
// Without AOP — cross-cutting concern pollutes every method
public Order placeOrder(Request req) {
    log.info("Entering placeOrder");
    long start = System.nanoTime();
    try {
        Order order = doPlaceOrder(req);
        log.info("Exiting placeOrder");
        return order;
    } catch (Exception e) {
        log.error("Error in placeOrder", e);
        throw e;
    } finally {
        metrics.record("placeOrder", System.nanoTime() - start);
    }
}
```

Multiply by 50 methods. Now change the log format. **Welcome to pain.**

**With AOP:**

```java
@LogExecution
@Timed
public Order placeOrder(Request req) {
    return doPlaceOrder(req);
}
```

The aspect handles the cross-cutting logic once.

---

## AOP Terminology

| Term | Meaning |
|---|---|
| **Aspect** | A module of cross-cutting concern (`@Aspect`) |
| **Join point** | A point in execution where advice can apply (method call, etc.) |
| **Advice** | Action taken at a join point (`@Before`, `@After`, `@Around`) |
| **Pointcut** | A predicate that selects join points (`@Pointcut`) |
| **Weaving** | Linking aspects with target objects (Spring: at runtime via proxy) |
| **Target** | The object being advised |
| **Proxy** | The object that intercepts calls and applies advice |

**In Spring AOP, join points are always method executions.** Full AspectJ
supports field access, constructor calls, etc.

---

## JDK Dynamic Proxy vs CGLIB

Spring picks the proxy type based on the target class.

### JDK Dynamic Proxy

- Works only for classes that **implement at least one interface**
- The proxy implements the same interfaces
- The class itself is not subclassed
- `java.lang.reflect.Proxy` under the hood

```java
public interface OrderService {
    void placeOrder();
}

@Service
public class OrderServiceImpl implements OrderService {
    @Transactional
    public void placeOrder() { ... }
}

// Bean injected is a Proxy implementing OrderService
OrderService svc = ctx.getBean(OrderService.class);
System.out.println(svc.getClass());   // com.sun.proxy.$Proxy42
```

### CGLIB Proxy

- Works for **classes without interfaces**
- Generates a **subclass** at runtime
- Cannot proxy `final` classes or `final` methods
- Cannot proxy `private` methods
- Requires a no-arg constructor? No — Spring uses Objenesis to bypass

```java
@Service
public class OrderService {   // no interface
    @Transactional
    public void placeOrder() { ... }
}

// Bean injected is a CGLIB-enhanced subclass
OrderService svc = ctx.getBean(OrderService.class);
System.out.println(svc.getClass());   // OrderService$$SpringCGLIB$$0
```

### Comparison

| | JDK Dynamic Proxy | CGLIB |
|---|---|---|
| Requires interface | ✅ | ❌ |
| Subclasses target | ❌ | ✅ |
| `final` class | ✅ | ❌ |
| `final` method | ✅ | ❌ |
| Performance (invocation) | Slight overhead | Slight overhead |
| Proxy creation speed | Faster | Slower |
| Spring Boot default | When interfaces exist | When no interfaces |

### Since Spring Boot 2.x

Spring Boot 2.x defaults `spring.aop.proxy-target-class=true`, forcing CGLIB
even when interfaces exist. Reasons:

- Injecting concrete classes works
- Consistent proxy behavior
- Modern Spring favors CGLIB

Override:

```properties
spring.aop.proxy-target-class=false
```

---

## Advice Types

| Advice | Annotation | Runs |
|---|---|---|
| Before | `@Before` | Before the method |
| After returning | `@AfterReturning` | After successful return |
| After throwing | `@AfterThrowing` | After exception |
| After (finally) | `@After` | Always after method |
| Around | `@Around` | Wraps the method |

### `@Around` — the most powerful

`@Around` can:

- Do work before and after
- Modify arguments
- Modify the return value
- Skip the method entirely
- Catch and handle exceptions
- Measure timing

```java
@Aspect
@Component
public class LoggingAspect {

    @Around("@annotation(LogExecution)")
    public Object log(ProceedingJoinPoint pjp) throws Throwable {
        String method = pjp.getSignature().toShortString();
        long start = System.nanoTime();
        try {
            Object result = pjp.proceed();
            return result;
        } finally {
            long elapsed = System.nanoTime() - start;
            System.out.printf("%s took %,d ns%n", method, elapsed);
        }
    }
}
```

**Always call `pjp.proceed()`** unless you intentionally short-circuit.
Forgetting it means the target method never runs.

### Custom annotation example

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogExecution { }

@Aspect
@Component
public class LoggingAspect {
    @Around("@annotation(com.example.LogExecution)")
    public Object log(ProceedingJoinPoint pjp) throws Throwable {
        // ...
        return pjp.proceed();
    }
}
```

### Pointcut expressions

| Expression | Matches |
|---|---|
| `execution(* com.example.service.*.*(..))` | Any method in `service` package |
| `@annotation(com.example.Timed)` | Methods annotated with `@Timed` |
| `within(com.example.service..*)` | Any bean in `service` and subpackages |
| `bean(orderService)` | Methods on the bean named `orderService` |
| `args(String, ..)` | First arg is a String |

Combine with `&&`, `||`, `!`:

```java
@Around("execution(* com.example.service.*.*(..)) && @annotation(org.springframework.transaction.annotation.Transactional)")
```

---

## How Spring AOP Works Internally

### The proxy chain

1. Spring creates the target bean
2. In `postProcessAfterInitialization`, `AnnotationAwareAspectJAutoProxyCreator`
   checks if any aspect matches the bean
3. If yes, it wraps the target in a proxy
4. The proxy holds a chain of interceptors (one per advice)
5. Method calls go: proxy → interceptor 1 → interceptor 2 → ... → target

```d2
direction: right

client: "Client" {
  style.fill: "#e3f2fd"
}
proxy: "Proxy" {
  style.fill: "#fff9c4"
  a1: "Interceptor:\n@Transactional" {
    style.fill: "#ffe0b2"
  }
  a2: "Interceptor:\n@Async" {
    style.fill: "#ffcc80"
  }
  a3: "Interceptor:\n@LogExecution" {
    style.fill: "#ffb74d"
  }
}
target: "Target method" {
  style.fill: "#c8e6c9"
}

client.proxy -> proxy: "call"
proxy.a1 -> proxy.a2: "→"
proxy.a2 -> proxy.a3: "→"
proxy.a3 -> target: "→"
```

### Order matters

Interceptors run in a defined order. `@Transactional` and `@Async` have
specific orderings defined by Spring. Custom aspects can implement `Ordered`
or use `@Order`.

---

## The Self-Invocation Trap ⚠️

**The single most-asked Spring AOP interview question.**

```java
@Service
public class OrderService {

    public void placeOrder() {
        saveOrder();   // ❌ @Transactional IGNORED
    }

    @Transactional
    public void saveOrder() {
        // database operations
    }
}
```

### Why it fails

1. Spring injects a **proxy** for `OrderService`
2. When an external caller calls `placeOrder()`, they call the proxy
3. The proxy delegates to the target's `placeOrder()`
4. Inside `placeOrder()`, `saveOrder()` is a call on `this` — the **raw target**,
   not the proxy
5. The proxy interceptor never sees the `saveOrder()` call
6. `@Transactional` doesn't fire

**Interview line:** *"Self-invocation bypasses the proxy — the internal
`this.saveOrder()` call never reaches the transactional advice."*

### Fixes

#### 1. Move the method to a different bean (best)

```java
@Service
public class OrderService {
    private final OrderPersistence persistence;

    public void placeOrder() {
        persistence.saveOrder();   // goes through the proxy
    }
}

@Service
public class OrderPersistence {
    @Transactional
    public void saveOrder() { ... }
}
```

Cleanest. Separates orchestration from transaction boundaries.

#### 2. Inject self

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

Works. Feels a bit hacky.

#### 3. Use `AopContext.currentProxy()`

```java
@Service
@EnableAspectJAutoProxy(exposeProxy = true)
public class OrderService {
    public void placeOrder() {
        ((OrderService) AopContext.currentProxy()).saveOrder();
    }

    @Transactional
    public void saveOrder() { ... }
}
```

Requires `exposeProxy = true`. Uses a `ThreadLocal` under the hood.

**Not recommended** — brittle and hard to test.

#### 4. `TransactionTemplate`

```java
@Service
public class OrderService {
    private final TransactionTemplate txTemplate;

    public OrderService(PlatformTransactionManager txManager) {
        this.txTemplate = new TransactionTemplate(txManager);
    }

    public void placeOrder() {
        txTemplate.execute(status -> {
            saveOrder();
            return null;
        });
    }

    private void saveOrder() { ... }
}
```

Programmatic transaction. Explicit and works with self-invocation.

### Which fix to recommend?

| Fix | Recommended when |
|---|---|
| Move to a different bean | Always the best — clean design |
| Self-injection | Pragmatic when refactoring isn't feasible |
| `AopContext.currentProxy()` | Rarely |
| `TransactionTemplate` | Programmatic control needed |

---

## Other AOP Pitfalls

### `final` methods can't be proxied

CGLIB subclasses the target, but `final` methods can't be overridden — so
Spring can't intercept them.

```java
@Service
public class OrderService {
    @Transactional
    public final void placeOrder() { ... }   // ❌ advice never fires
}
```

**Fix:** remove `final`, or use JDK proxy (interface-based).

### `private` methods can't be proxied

Same reason — Spring can't override them.

### `static` methods can't be proxied

Same reason.

### Internal method calls always bypass the proxy

Any call from within a bean to another method on the same bean is a self-call,
regardless of visibility.

### Beans created outside Spring don't get AOP

```java
OrderService svc = new OrderService();   // no proxy
svc.saveOrder();                          // no @Transactional
```

**Always `@Autowired` the bean, never `new` it.**

---

## AOP in the Wild

### `@Transactional`

Implemented via `TransactionInterceptor` (advice) and
`BeanFactoryTransactionAttributeSourceAdvisor`.

### `@Async`

`AsyncExecutionInterceptor` wraps the method and submits to an executor.

### `@Cacheable`, `@CacheEvict`

`CacheInterceptor` handles cache lookup/store around the method call.

### `@Retryable` (Spring Retry)

`RetryOperationsInterceptor` wraps calls with retry logic.

### `@PreAuthorize` (Spring Security)

`MethodSecurityInterceptor` enforces security before the method runs.

### `@Validated` on method parameters

`MethodValidationPostProcessor` provides method-level validation.

**All of these are AOP** — they depend on the proxy existing. Self-invocation
breaks every one of them.

---

## `@EnableAspectJAutoProxy`

Required to enable `@Aspect` support in plain Spring. Spring Boot enables it
automatically.

```java
@Configuration
@EnableAspectJAutoProxy
public class AopConfig { }
```

### `exposeProxy = true`

Makes the current proxy available via `AopContext.currentProxy()`.

```java
@EnableAspectJAutoProxy(exposeProxy = true)
```

**Trade-off:** slight overhead (ThreadLocal per call).

### `proxyTargetClass = true`

Force CGLIB proxies (default in Spring Boot 2+).

---

## Custom Aspect Example — Method Metrics

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Timed {
    String value() default "";
}

@Aspect
@Component
public class TimedAspect {
    private final MeterRegistry registry;

    public TimedAspect(MeterRegistry registry) {
        this.registry = registry;
    }

    @Around("@annotation(timed)")
    public Object time(ProceedingJoinPoint pjp, Timed timed) throws Throwable {
        String name = timed.value().isEmpty()
                ? pjp.getSignature().toShortString()
                : timed.value();

        return registry.timer(name).record(() -> {
            try {
                return pjp.proceed();
            } catch (Throwable t) {
                throw new RuntimeException(t);
            }
        });
    }
}

// Usage
@Service
public class OrderService {
    @Timed("order.place")
    public Order placeOrder(Request req) { ... }
}
```

---

## Tricky Corners ⚠️

**Self-invocation always bypasses the proxy.** The #1 trap.

**`final` methods can't be advised** (CGLIB can't override them).

**`private` and `static` methods can't be advised.**

**`@Transactional` on a `private` method silently does nothing.**

**AOP proxy hides the target class** — `getClass()` returns `$Proxy` or
`$$SpringCGLIB$$`.

**Constructor injection is fine with proxies**, but field access to
`this.getClass()` may differ.

**Aspects are ordered.** `@Transactional` typically runs outermost; `@Async`
too. Custom aspects should implement `Ordered` if they care.

**`@Async` methods must return `void`, `Future`, or `CompletableFuture`.**
Others throw at runtime.

**`@Async` also fails on self-invocation** — same proxy reason.

**`AopContext.currentProxy()` requires `exposeProxy = true`.** Forgetting it
throws `IllegalStateException`.

**Testing proxied beans is different.** `@SpyBean` and `@MockBean` wrap the
proxy, not the target.

**Multiple `@Transactional` methods calling each other** compound the trap —
each self-call is bypassed.

---

## Common Pitfalls

- Calling `@Transactional` or `@Async` methods from within the same bean.
- Marking a method `final` and expecting advice.
- Injecting `ApplicationContext` and `getBean`-ing the raw target class.
- Using `new Service()` and expecting AOP to work.
- Overusing aspects — they make control flow implicit.
- Not knowing whether your bean is JDK-proxied or CGLIB-proxied when debugging.
- Expecting `@Async` to return a value when it returns `void`.

---

## Key Interview Tips

- Explain AOP in one sentence: *"apply cross-cutting behavior to many methods
  without modifying them."*
- Know **JDK Dynamic Proxy vs CGLIB** — interface vs subclass.
- **Self-invocation breaks `@Transactional`, `@Async`, `@Cacheable`,
  `@PreAuthorize`** — same reason.
- Give the fixes: **move to another bean > self-injection > `AopContext` >
  `TransactionTemplate`.**
- Explain that **AOP proxies are created in `postProcessAfterInitialization`.**
- Know that **`final`/`private`/`static` methods can't be advised.**
- Mention Spring Boot 2+ forces CGLIB by default (`proxy-target-class=true`).

---

## Related

- [Bean Lifecycle](../core/bean-lifecycle.md) — where the proxy is created
- [Transaction Management](../transactions/transaction-management.md) — the
  biggest AOP use case
- [Circular Dependencies](../core/circular-dependencies.md) — self-injection
  workaround
- [Patterns in Java](../../java/design-patterns-java/patterns-in-java.md) —
  Proxy pattern background