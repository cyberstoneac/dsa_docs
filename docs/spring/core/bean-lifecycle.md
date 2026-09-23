# Bean Lifecycle

> **Spring context:** Spring Boot 3.x baseline. Focus is on the full lifecycle
> sequence, `BeanPostProcessor` internals, `Aware` interfaces, and scopes.

## Mental Model

A Spring bean goes through a **predictable sequence** from creation to
destruction. Every phase has a hook.

```d2
direction: down

start: "Bean definition loaded" {
  style.fill: "#e3f2fd"
}
instantiate: "1. Instantiate\n(constructor)" {
  style.fill: "#bbdefb"
}
populate: "2. Populate properties\n(setter / field injection)" {
  style.fill: "#c8e6c9"
}
aware: "3. Aware callbacks\n(BeanNameAware, BeanFactoryAware, ApplicationContextAware)" {
  style.fill: "#fff9c4"
}
bppBefore: "4. BeanPostProcessor\npostProcessBeforeInitialization" {
  style.fill: "#ffe0b2"
}
postConstruct: "5. @PostConstruct" {
  style.fill: "#ffcc80"
}
afterProps: "6. InitializingBean.afterPropertiesSet" {
  style.fill: "#ffb74d"
}
initMethod: "7. Custom init-method" {
  style.fill: "#ffa726"
}
bppAfter: "8. BeanPostProcessor\npostProcessAfterInitialization\n(AOP proxy wraps here)" {
  style.fill: "#f8bbd0"
}
ready: "9. Bean ready for use" {
  style.fill: "#a5d6a7"
}
destroy: "10. On shutdown:\n@PreDestroy → DisposableBean.destroy\n→ custom destroy-method" {
  style.fill: "#ef9a9a"
}

start.instantiate -> instantiate: ""
instantiate.populate -> populate: ""
populate.aware -> aware: ""
aware.bppBefore -> bppBefore: ""
bppBefore.postConstruct -> postConstruct: ""
postConstruct.afterProps -> afterProps: ""
afterProps.initMethod -> initMethod: ""
initMethod.bppAfter -> bppAfter: ""
bppAfter.ready -> ready: ""
ready.destroy -> destroy: ""
```

Steps 1–8 happen at bean creation. Step 9 is the bean's normal life. Step 10
happens only at application shutdown (and only for beans the container
manages destruction for).

---

## Step-by-Step Breakdown

### 1. Instantiation

The container calls the **constructor** (or the `@Bean` factory method).

Constructor injection resolves and injects dependencies here.

### 2. Populate properties

After construction, the container injects:

- **Setter-injected** dependencies
- **Field-injected** dependencies

Constructor-injected dependencies were already set in step 1.

### 3. Aware callbacks

If the bean implements any `Aware` interface, Spring calls the corresponding
method:

| Interface | Method | Provides |
|---|---|---|
| `BeanNameAware` | `setBeanName(String)` | The bean's id |
| `BeanClassLoaderAware` | `setBeanClassLoader(ClassLoader)` | The classloader |
| `BeanFactoryAware` | `setBeanFactory(BeanFactory)` | The container |
| `ApplicationContextAware` | `setApplicationContext(ApplicationContext)` | The context |
| `EnvironmentAware` | `setEnvironment(Environment)` | Environment config |
| `ResourceLoaderAware` | `setResourceLoader(ResourceLoader)` | Resource access |
| `ApplicationEventPublisherAware` | `setApplicationEventPublisher(...)` | Event publishing |

```java
@Component
public class MyBean implements BeanNameAware, ApplicationContextAware {
    private String name;
    private ApplicationContext ctx;

    @Override
    public void setBeanName(String name) { this.name = name; }

    @Override
    public void setApplicationContext(ApplicationContext ctx) {
        this.ctx = ctx;
    }
}
```

**Rarely needed** — prefer `@Autowired` on the specific dependency instead of
grabbing the whole context.

### 4. `BeanPostProcessor.postProcessBeforeInitialization`

`BeanPostProcessor`s are container-wide hooks. This phase runs **before**
init methods.

```java
@Component
public class AuditPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        System.out.println("Before init: " + beanName);
        return bean;   // return a wrapper if you want
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        System.out.println("After init: " + beanName);
        return bean;
    }
}
```

**AOP proxies are created here** — during `postProcessAfterInitialization`
(step 8) — by `AnnotationAwareAspectJAutoProxyCreator`.

### 5. `@PostConstruct`

```java
@Component
public class CacheLoader {
    private final CacheService cache;

    public CacheLoader(CacheService cache) { this.cache = cache; }

    @PostConstruct
    public void init() {
        cache.preload();
    }
}
```

Called after dependency injection. **Preferred init hook** in modern Spring.

`@PostConstruct` is in **`jakarta.annotation`** (Spring Boot 3.x) — it was
`javax.annotation` in Spring Boot 2.x.

### 6. `InitializingBean.afterPropertiesSet`

```java
@Component
public class CacheLoader implements InitializingBean {
    @Override
    public void afterPropertiesSet() {
        // same idea as @PostConstruct
    }
}
```

Legacy alternative. **Prefer `@PostConstruct`** — it's not tied to Spring's API.

### 7. Custom `init-method`

Via `@Bean(initMethod = "start")` or XML. Rare in modern code.

**Order:** `@PostConstruct` → `afterPropertiesSet` → custom init-method.

### 8. `BeanPostProcessor.postProcessAfterInitialization`

Runs **after** init methods. **The AOP proxy is created here.**

If the bean has `@Transactional`, `@Async`, `@Cacheable`, or is advised by
any aspect, the object returned here is the **proxy**, not the raw instance.

**Interview trap:** if you `getBean()` a service that has `@Transactional`, you
get the proxy. Autowiring the same bean into itself gets the proxy. Direct
method calls on `this` bypass the proxy.

### 9. Bean ready

The bean is stored in the singleton cache and available for use.

### 10. Destruction

On application shutdown:

1. `@PreDestroy` (preferred)
2. `DisposableBean.destroy`
3. Custom destroy-method

**Only singletons are destroyed by the container.** Prototype-scoped beans
are the caller's responsibility.

```java
@Component
public class CacheLoader {
    @PreDestroy
    public void shutdown() {
        cache.flush();
    }
}
```

`@PreDestroy` is in `jakarta.annotation`.

---

## The Lifecycle in Code

```java
@Component
public class LifecycleDemo implements BeanNameAware, InitializingBean, DisposableBean {

    public LifecycleDemo() {
        System.out.println("1. Constructor");
    }

    @Autowired
    public void setDep(SomeDep dep) {
        System.out.println("2. Setter injection");
    }

    @Override
    public void setBeanName(String name) {
        System.out.println("3. BeanNameAware: " + name);
    }

    @PostConstruct
    public void postConstruct() {
        System.out.println("5. @PostConstruct");
    }

    @Override
    public void afterPropertiesSet() {
        System.out.println("6. afterPropertiesSet");
    }

    @PreDestroy
    public void preDestroy() {
        System.out.println("10a. @PreDestroy");
    }

    @Override
    public void destroy() {
        System.out.println("10b. destroy");
    }
}
```

**Expected output (at startup):**

```text
1. Constructor
2. Setter injection
3. BeanNameAware: lifecycleDemo
5. @PostConstruct
6. afterPropertiesSet
```

**Expected output (at shutdown):**

```text
10a. @PreDestroy
10b. destroy
```

---

## Bean Scopes

| Scope | Instances | Typical use |
|---|---|---|
| **singleton** (default) | One per container | Stateless services, repos |
| **prototype** | New per request | Stateful short-lived objects |
| **request** | One per HTTP request | Per-request state |
| **session** | One per HTTP session | User session state |
| **application** | One per `ServletContext` | App-wide state (rare) |
| **websocket** | One per WebSocket session | Per-connection state |

### Specifying scope

```java
@Component
@Scope("prototype")
public class ShoppingCart { }

// Or with Scope constants
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
```

### Singleton vs prototype — the trap

```java
@Service             // singleton
public class OrderProcessor {
    @Autowired
    private ShoppingCart cart;   // ❌ injected ONCE — same cart for all orders
}
```

**Prototype injection into a singleton gives you a single instance** because
the singleton is created once.

### Fix 1 — `ObjectProvider`

```java
@Service
public class OrderProcessor {
    private final ObjectProvider<ShoppingCart> cartProvider;

    public OrderProcessor(ObjectProvider<ShoppingCart> cartProvider) {
        this.cartProvider = cartProvider;
    }

    public void process() {
        ShoppingCart cart = cartProvider.getObject();   // new instance
    }
}
```

### Fix 2 — `@Lookup`

```java
@Service
public abstract class OrderProcessor {
    public void process() {
        ShoppingCart cart = createCart();   // abstract method — Spring implements
    }

    @Lookup
    protected abstract ShoppingCart createCart();
}
```

### Fix 3 — Inject `ApplicationContext` and get bean per use (rare)

### Destruction of prototypes

**Spring does NOT call `@PreDestroy` on prototype beans.** You must handle
cleanup manually — either `try-with-resources`, an explicit `close()`, or by
using `DisposableBean` with your own tracking.

---

## `BeanPostProcessor` — The Extension Point

`BeanPostProcessor` is how Spring itself implements much of its magic.

```java
public interface BeanPostProcessor {
    default Object postProcessBeforeInitialization(Object bean, String name) {
        return bean;
    }
    default Object postProcessAfterInitialization(Object bean, String name) {
        return bean;
    }
}
```

### What uses `BeanPostProcessor`?

| Processor | Purpose |
|---|---|
| `AutowiredAnnotationBeanPostProcessor` | Handles `@Autowired` |
| `CommonAnnotationBeanPostProcessor` | Handles `@PostConstruct`, `@PreDestroy`, `@Resource` |
| `PersistenceAnnotationBeanPostProcessor` | Handles `@PersistenceContext` |
| `AnnotationAwareAspectJAutoProxyCreator` | Creates AOP proxies |
| `RequiredAnnotationBeanPostProcessor` | Handles `@Required` (legacy) |

### Custom `BeanPostProcessor` example

```java
@Component
public class MetricsPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (bean.getClass().isAnnotationPresent(Measured.class)) {
            return wrapWithMetrics(bean);
        }
        return bean;
    }

    private Object wrapWithMetrics(Object bean) {
        return Proxy.newProxyInstance(
                bean.getClass().getClassLoader(),
                bean.getClass().getInterfaces(),
                (proxy, method, args) -> {
                    long start = System.nanoTime();
                    try {
                        return method.invoke(bean, args);
                    } finally {
                        record(bean, method, System.nanoTime() - start);
                    }
                });
    }
}
```

**Note:** `BeanPostProcessor`s are instantiated **before** other beans.
Don't inject normal beans into them — you'll get a circular dependency or
an unexpected empty bean.

### `BeanFactoryPostProcessor` vs `BeanPostProcessor`

| | `BeanFactoryPostProcessor` | `BeanPostProcessor` |
|---|---|---|
| Runs on | **Bean definitions** (metadata) | **Bean instances** |
| When | Before beans are created | During bean creation |
| Example | `PropertySourcesPlaceholderConfigurer` | AOP proxy creator |

Use `BeanFactoryPostProcessor` to modify definitions; `BeanPostProcessor` to
modify instances.

---

## Ordering

When multiple hooks exist, this is the order:

1. `@PostConstruct`
2. `InitializingBean.afterPropertiesSet()`
3. Custom `init-method` (from `@Bean(initMethod = "...")` or XML)

For destroy:

1. `@PreDestroy`
2. `DisposableBean.destroy()`
3. Custom `destroy-method`

Multiple `BeanPostProcessor`s run in `@Order` or `Ordered` order.

---

## Tricky Corners ⚠️

**Prototype beans are NOT destroyed by the container.** No `@PreDestroy` call.
You must close them explicitly.

**Prototype injection into a singleton gives you one instance.** Use
`ObjectProvider` or `@Lookup`.

**`@PostConstruct` is in `jakarta.annotation`** in Spring Boot 3.x. In 2.x it
was `javax.annotation`. Migration matters.

**`ApplicationContextAware` gives you the whole context** — use sparingly.
Prefer specific injections.

**`BeanPostProcessor`s are created before regular beans.** You can't inject a
regular bean into one without care.

**AOP proxies are created in `postProcessAfterInitialization`.** So the
singleton cache holds the proxy, not the raw instance.

**`@Autowired` on a constructor with multiple constructors requires the
annotation** on the one to use. Single-constructor classes infer it.

**Circular dependencies** — Spring 4.3+ tries harder, but still fails for
constructor injection. See [Circular Dependencies](circular-dependencies.md).

**`@Lookup` doesn't work on private methods.** Must be `protected` or `public`
and (typically) `abstract`.

**`@Scope("prototype")` on a `@Bean` method returns a new instance each call**
— even within the same `@Configuration` class.

**`@Bean` methods in `@Configuration` are proxied.** Set
`proxyBeanMethods = false` for raw behavior if you don't need inter-bean
method calls.

**Eager singletons are created at startup** by default. Use `@Lazy` to defer.

**`@Lazy` on a `@Bean` method defers creation** until first use.

---

## Common Pitfalls

- Injecting a prototype bean into a singleton and expecting fresh instances.
- Forgetting that `@PreDestroy` doesn't run for prototypes.
- Assuming `@PostConstruct` will run after all dependencies are injected
  — it does, but only after field/setter injection, not after other beans'
  `@PostConstruct`s.
- Adding a `BeanPostProcessor` that swallows exceptions silently.
- Using `ApplicationContextAware` when `@Autowired` would suffice.
- Mixing `@PostConstruct` and `InitializingBean` unnecessarily.
- Using `@Lazy` on `@Bean` methods and expecting eager initialization.

---

## Key Interview Tips

- Recite the **full lifecycle** in order: constructor → populate → Aware →
  `BeanPostProcessor` before → `@PostConstruct` → `InitializingBean` →
  custom init → `BeanPostProcessor` after (proxy created) → ready.
- Explain that **AOP proxies are created in `postProcessAfterInitialization`**.
- Say **"Spring does not call `@PreDestroy` on prototype beans."**
- Explain the **prototype-into-singleton trap** and how `ObjectProvider`
  fixes it.
- Know that **`@PostConstruct` is now `jakarta.annotation`** in Boot 3.
- Distinguish `BeanPostProcessor` (instances) from `BeanFactoryPostProcessor`
  (definitions).

---

## Related

- [IoC & Dependency Injection](ioc-and-di.md) — how beans get wired
- [Circular Dependencies](circular-dependencies.md) — what happens when two
  beans need each other
- [AOP & Proxies](../aop/aop-and-proxies.md) — where the proxy is created in
  the lifecycle
- [Auto-Configuration](../boot/auto-configuration.md) — how Boot registers
  beans automatically