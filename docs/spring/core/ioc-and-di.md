# IoC & Dependency Injection

> **Spring context:** Spring Boot 3.x baseline (Jakarta namespace, Java 17+).
> This file assumes you've used Spring before — focus is on internals and
> interview-grade details.

## Mental Model

**Inversion of Control (IoC)** means: you don't create your dependencies —
someone else does, and hands them to you.

**Dependency Injection (DI)** is how IoC is achieved in Spring: the container
wires beans together by injecting dependencies at construction or after.

```d2
direction: right

without: "Without IoC" {
  style.fill: "#ffcdd2"
  a: "OrderService" {
    style.fill: "#ef9a9a"
  }
  b: "creates\nOrderRepository" {
    style.fill: "#ef9a9a"
  }
  c: "creates\nPaymentClient" {
    style.fill: "#ef9a9a"
  }
  a.b -> b: ""
  a.c -> c: ""
}

with: "With IoC" {
  style.fill: "#c8e6c9"
  container: "Spring Container" {
    style.fill: "#a5d6a7"
  }
  service: "OrderService" {
    style.fill: "#81c784"
  }
  repo: "OrderRepository" {
    style.fill: "#81c784"
  }
  client: "PaymentClient" {
    style.fill: "#81c784"
  }
  container.service -> service: "injects"
  container.repo -> repo: "manages"
  container.client -> client: "manages"
}
```

The **container** is the central brain. It:

1. Reads configuration (annotations, Java config, XML)
2. Creates bean instances
3. Resolves dependencies between them
4. Manages their lifecycle
5. Wires them together

---

## `BeanFactory` vs `ApplicationContext`

| | `BeanFactory` | `ApplicationContext` |
|---|---|---|
| Role | Basic IoC container | Full-featured container |
| Lazy initialization | ✅ (default) | ❌ (eager for singletons) |
| Bean post-processors | Manual | Automatic |
| MessageSource (i18n) | ❌ | ✅ |
| ApplicationEventPublisher | ❌ | ✅ |
| ResourceLoader | ❌ | ✅ |
| AOP support | Limited | Full |
| Typical use | Rarely directly | Always in modern Spring |

`ApplicationContext` extends `BeanFactory`. **Use `ApplicationContext`.**

### Common implementations

| Class | Purpose |
|---|---|
| `AnnotationConfigApplicationContext` | Java-based config |
| `ClassPathXmlApplicationContext` | XML config |
| `AnnotationConfigWebApplicationContext` | Web apps |
| `SpringApplication` (Boot) | Boot apps |

---

## The Three DI Types

### 1. Constructor injection ✅ (preferred)

```java
@Service
public class OrderService {
    private final OrderRepository orders;
    private final PaymentClient payments;

    public OrderService(OrderRepository orders, PaymentClient payments) {
        this.orders = orders;
        this.payments = payments;
    }
}
```

**Advantages:**

- Fields can be `final` — object is fully initialized after construction
- Fails fast if dependencies are missing
- Enables easy unit testing (no reflection, no Spring context)
- Dependencies are explicit — you can see what's required
- Avoids circular dependencies by default

**Spring 4.3+:** if the class has a single constructor, `@Autowired` is
**optional** — Spring infers it.

### 2. Setter injection

```java
@Service
public class OrderService {
    private OrderRepository orders;

    @Autowired
    public void setOrders(OrderRepository orders) {
        this.orders = orders;
    }
}
```

**Use when:** the dependency is **optional**, or you need to re-configure
at runtime.

**Downside:** fields can't be `final`; missing dependencies aren't detected
at construction.

### 3. Field injection

```java
@Service
public class OrderService {
    @Autowired
    private OrderRepository orders;
}
```

**Use when:** only in tests or throwaway prototypes.

**Downsides:**

- Cannot be `final`
- Hidden dependencies — you can't see them without reading annotations
- Hard to unit test without Spring context or reflection
- Hides design problems (too many dependencies)

**Interview rule:** *"Constructor injection for required dependencies, setter
injection for optional ones, field injection almost never."*

---

## `@Autowired` vs `@Resource` vs `@Inject`

| Annotation | Origin | Resolution |
|---|---|---|
| `@Autowired` | Spring | **by type**, then by name if ambiguous |
| `@Resource` | JSR-250 (Jakarta) | **by name**, then by type |
| `@Inject` | JSR-330 (Jakarta) | **by type**, like `@Autowired` |

### `@Autowired` resolution order

1. Match by type
2. If multiple candidates, match by `@Qualifier`
3. If no `@Qualifier`, match by field/parameter name

```java
@Component
public class EmailNotifier implements Notifier { }

@Component
public class SmsNotifier implements Notifier { }

@Service
public class Alerts {
    // Ambiguous — multiple Notifier beans
    @Autowired
    private Notifier notifier;   // ❌ NoUniqueBeanDefinitionException

    // Fix 1: @Qualifier
    @Autowired
    @Qualifier("emailNotifier")
    private Notifier email;

    // Fix 2: match by field name (works if bean name matches)
    @Autowired
    private Notifier emailNotifier;   // ✅ matches bean name
}
```

### `@Resource` — by name

```java
@Resource(name = "emailNotifier")
private Notifier notifier;
```

If no `name` given, `@Resource` uses the field name.

### `@Primary` — default when multiple candidates

```java
@Primary
@Component
public class EmailNotifier implements Notifier { }

@Component
public class SmsNotifier implements Notifier { }

// Without @Qualifier, EmailNotifier is chosen
@Autowired
private Notifier notifier;   // gets EmailNotifier
```

### When to use which

| Scenario | Preferred |
|---|---|
| Required dependency | Constructor + `@Autowired` (or implicit) |
| Optional dependency | Setter + `@Autowired(required = false)` or `Optional<T>` |
| Multiple candidates | `@Primary` on the default, `@Qualifier` for others |
| Framework integration | `@Autowired` (Spring-idiomatic) |
| Portability across DI frameworks | `@Inject` + `@Named` |

---

## `@Component` vs `@Service` vs `@Repository` vs `@Controller`

All four register a bean. They're **semantic annotations** over `@Component`.

| Annotation | Layer | Special behavior |
|---|---|---|
| `@Component` | Generic | None |
| `@Service` | Business logic | None (semantic) |
| `@Repository` | Persistence | **Exception translation** — `DataAccessException` |
| `@Controller` | Web | Recognized for MVC handler mapping |
| `@RestController` | Web (REST) | `@Controller` + `@ResponseBody` |

**Interview note:** `@Repository` is not purely semantic — Spring registers
a `PersistenceExceptionTranslationPostProcessor` that translates vendor
exceptions (`SQLException`, `HibernateException`) into Spring's
`DataAccessException` hierarchy.

---

## Java Config vs Annotation Config vs XML

### Java config (modern preference)

```java
@Configuration
public class AppConfig {
    @Bean
    public OrderService orderService(OrderRepository repo) {
        return new OrderService(repo);
    }

    @Bean
    public OrderRepository orderRepository(DataSource ds) {
        return new JpaOrderRepository(ds);
    }
}
```

### Annotation config (Spring Boot convention)

```java
@Service
public class OrderService {
    // dependencies injected via constructor
}
```

### XML config (legacy)

```xml
<bean id="orderService" class="com.example.OrderService">
    <constructor-arg ref="orderRepository"/>
</bean>
```

**Preference order:** Java config or annotation config > XML.

### When to use `@Bean` vs `@Component`

| Use `@Bean` | Use `@Component` |
|---|---|
| Third-party classes (can't annotate) | Your own classes |
| Conditional creation logic | Standard beans |
| Complex initialization | Simple beans |
| Multiple beans of the same type | One bean per class |

---

## Bean Resolution — Under the Hood

When you ask for a bean:

```java
ApplicationContext ctx = ...;
OrderService service = ctx.getBean(OrderService.class);
```

Spring:

1. Checks the **singleton cache** (`singletonObjects`)
2. If not found, creates the bean definition
3. Instantiates the bean (constructor)
4. Populates dependencies
5. Runs `BeanPostProcessor`s
6. Runs init methods
7. Caches the singleton

Full lifecycle covered in [Bean Lifecycle](bean-lifecycle.md).

### How is `@Autowired` resolved?

The `AutowiredAnnotationBeanPostProcessor` handles `@Autowired`:

- On the constructor: called during instantiation
- On fields: after instantiation, before init methods
- On setters: after instantiation

It looks up candidates by type, applies `@Qualifier`, and injects.

---

## Common Dependency Injection Patterns

### Factory bean

```java
@Configuration
public class DataSourceConfig {
    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://localhost/db");
        config.setUsername("user");
        config.setPassword("pass");
        return new HikariDataSource(config);
    }
}
```

### `@ConditionalOn*` for environment-dependent beans

```java
@Bean
@ConditionalOnProperty(name = "feature.email.enabled", havingValue = "true")
public Notifier emailNotifier() {
    return new EmailNotifier();
}

@Bean
@ConditionalOnMissingBean(Notifier.class)
public Notifier noopNotifier() {
    return new NoopNotifier();
}
```

### `ObjectProvider<T>` for lazy or multiple lookups

```java
@Service
public class OrderService {
    private final ObjectProvider<Notifier> notifiers;

    public OrderService(ObjectProvider<Notifier> notifiers) {
        this.notifiers = notifiers;
    }

    public void notify(String message) {
        notifiers.forEach(n -> n.send(message));
    }
}
```

`ObjectProvider` avoids hard dependencies and resolves lazily.

### `@Lazy` — defer initialization

```java
@Service
public class ExpensiveService {
    @Lazy
    @Autowired
    private HeavyDependency heavy;
}
```

The proxy is injected; the real dependency is created on first use. Useful
for breaking circular dependencies.

---

## Self-Injection

Sometimes a bean needs a reference to itself (to go through its own proxy,
e.g., for `@Transactional` or `@Async`):

```java
@Service
public class OrderService {
    @Autowired
    @Lazy
    private OrderService self;

    public void placeOrder() {
        self.saveOrder();   // goes through proxy — @Transactional works
    }

    @Transactional
    public void saveOrder() { ... }
}
```

Covered in [AOP & Proxies](../aop/aop-and-proxies.md).

---

## Testing Implications

Constructor injection makes unit testing trivial:

```java
@Test
void orderService_placesOrder() {
    OrderRepository mockRepo = mock(OrderRepository.class);
    PaymentClient mockClient = mock(PaymentClient.class);

    OrderService service = new OrderService(mockRepo, mockClient);

    // no Spring context needed
    service.placeOrder(...);

    verify(mockRepo).save(any());
}
```

Field injection would require `@SpringBootTest` or reflection.

---

## Tricky Corners ⚠️

**Constructor injection with a single constructor doesn't need `@Autowired`**
since Spring 4.3. Adding it is fine but redundant.

**Field injection hides design smells.** A class with 10 `@Autowired` fields
is doing too much — refactor.

**`@Autowired(required = false)`** on a constructor parameter fails if the
parameter isn't nullable. Use `Optional<T>` instead:

```java
public OrderService(Optional<Notifier> notifier) { ... }
```

**`@Primary` only resolves ambiguity when the injection point uses type.**
If `@Qualifier` is specified, `@Primary` is ignored.

**`@Qualifier` on a field takes precedence over bean name matching.**

**Bean name defaults to the class name** with the first letter lowercased:
`OrderService` → `orderService`. Override with `@Component("myName")`.

**Two beans with the same name override each other** (last one wins by
default). Use `spring.main.allow-bean-definition-overriding=false` in Boot
to fail fast.

**Constructor injection forces acyclic dependencies** unless you use
`@Lazy` on a parameter:

```java
public OrderService(@Lazy PaymentClient payments) { ... }
```

**`@Resource` and `@Inject` require a JSR-330 implementation** on the
classpath. Spring Boot includes both by default.

**`@Bean` methods are `CGLIB`-proxied by default.** Calling `orderRepo()`
inside another `@Bean` method returns the cached singleton, not a new
instance. Set `proxyBeanMethods = false` for lighter behavior when you don't
need inter-bean method calls.

**`@ComponentScan` default base package** is the package of the
`@Configuration` class. Put it at the top of your app package.

---

## Common Pitfalls

- Using field injection and calling it "simpler" — it's harder to test.
- Marking optional dependencies as required — use `Optional<T>` or
  `required = false` on setters.
- Injecting `ApplicationContext` everywhere — it hides dependencies.
- Defining two beans of the same type without `@Primary` or `@Qualifier`.
- Assuming `@Service` adds behavior — it's semantic only.
- Forgetting that `@Repository` translates exceptions.
- Circular dependencies via constructor injection — refactor instead of
  using `@Lazy` everywhere.

---

## Key Interview Tips

- Explain IoC vs DI in one sentence: *"IoC is the principle; DI is how Spring
  implements it — the container injects dependencies instead of the object
  creating them."*
- Say **"constructor injection is preferred"** and give two reasons:
  immutability + testability.
- Know the resolution order for `@Autowired`: type → `@Qualifier` → field name.
- Explain the four stereotype annotations and what `@Repository` actually adds
  (exception translation).
- Mention `@Primary` and `@Qualifier` for ambiguity.
- Say **"single constructor since Spring 4.3 doesn't need `@Autowired`."**
- Know `ObjectProvider` for lazy/multiple lookups.

---

## Related

- [Bean Lifecycle](bean-lifecycle.md) — what happens after creation
- [Circular Dependencies](circular-dependencies.md) — the three-level cache
- [AOP & Proxies](../aop/aop-and-proxies.md) — how `@Transactional` and `@Async` work
- [Auto-Configuration](../boot/auto-configuration.md) — how Boot wires beans automatically