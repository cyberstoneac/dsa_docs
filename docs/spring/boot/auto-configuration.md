# Auto-Configuration

> **Spring context:** Spring Boot 3.x. Auto-configuration internals changed in
> Boot 2.7 (new `AutoConfiguration.imports` file) and Boot 3 (Jakarta
> namespace, Java 17+). Focus is on the mechanism, not the boilerplate.

## Mental Model

Auto-configuration is Spring Boot's answer to: *"How do I stop writing the
same 200 lines of config for every app?"*

The mechanism:

1. Boot's `@SpringBootApplication` triggers a component scan **and** loads
   auto-configuration classes
2. Each auto-config class is **conditional** — it only activates if certain
   classes, properties, or other beans exist
3. When active, it registers beans with sensible defaults
4. If **you** define a bean of the same type, the auto-config backs off

```d2
direction: right

app: "Your Application" {
  style.fill: "#e3f2fd"
}
bootstrap: "@SpringBootApplication" {
  style.fill: "#bbdefb"
}
loader: "AutoConfigurationImportSelector" {
  style.fill: "#c8e6c9"
}
imports: "AutoConfiguration.imports\n(META-INF/spring/)" {
  style.fill: "#fff9c4"
}
conditionals: "Conditional checks\n(@ConditionalOnClass,\n@ConditionalOnMissingBean...)" {
  style.fill: "#ffe0b2"
}
beans: "Beans registered" {
  style.fill: "#a5d6a7"
}

app.bootstrap -> bootstrap: ""
bootstrap.loader -> loader: ""
loader.imports -> imports: "reads"
imports.conditionals -> conditionals: "evaluates"
conditionals.beans -> beans: "if matched"
```

**Key phrase:** *"Auto-configuration is conditional configuration."*

---

## `@SpringBootApplication` — What It Actually Is

```java
@SpringBootApplication
public class MyApp {
    public static void main(String[] args) {
        SpringApplication.run(MyApp.class, args);
    }
}
```

`@SpringBootApplication` is a **meta-annotation** combining three:

```java
@SpringBootConfiguration              // @Configuration subclass
@EnableAutoConfiguration              // the magic
@ComponentScan                        // scans current package + subpackages
public @interface SpringBootApplication { }
```

### Breakdown

| Annotation | Effect |
|---|---|
| `@SpringBootConfiguration` | Marks this as a config class (a specialization of `@Configuration`) |
| `@EnableAutoConfiguration` | Triggers loading of auto-configuration classes |
| `@ComponentScan` | Scans the current package and subpackages for `@Component` etc. |

**Implication:** put `MyApp` in the **root package** so component scan
covers the whole app.

---

## The Auto-Configuration Loader

`@EnableAutoConfiguration` imports `AutoConfigurationImportSelector`. This
selector:

1. Reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
   from every JAR on the classpath
2. Collects the list of auto-configuration classes
3. **Filters** them by evaluating conditions
4. Returns the surviving classes to be registered

### Old vs new mechanism

| Version | File |
|---|---|
| Boot ≤ 2.6 | `META-INF/spring.factories` (key: `EnableAutoConfiguration`) |
| Boot ≥ 2.7 | `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` |

The new file is a **plain list** — simpler and faster to parse:

```text
com.example.MyAutoConfiguration
com.example.AnotherAutoConfiguration
```

### Why the change?

- **Faster** — no properties parsing
- **Cleaner** — one class per line
- **Discourages** `spring.factories` as a general-purpose file

---

## Conditions — The Heart of Auto-Configuration

Auto-config classes are gated by `@Conditional*` annotations.

### The common ones

| Annotation | Activates when |
|---|---|
| `@ConditionalOnClass` | A class is on the classpath |
| `@ConditionalOnMissingClass` | A class is NOT on the classpath |
| `@ConditionalOnBean` | A bean of the given type exists |
| `@ConditionalOnMissingBean` | No bean of the given type exists |
| `@ConditionalOnProperty` | A property has a specific value |
| `@ConditionalOnResource` | A resource exists |
| `@ConditionalOnWebApplication` | App is a web app |
| `@ConditionalOnNotWebApplication` | App is not web |
| `@ConditionalOnExpression` | SpEL expression is true |
| `@ConditionalOnJava` | Java version range |

### Example — a simplified DataSource auto-config

```java
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(DataSource.class)
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public DataSource dataSource(DataSourceProperties props) {
        return props.initializeDataSourceBuilder().build();
    }
}
```

**Read it as:** *"If DataSource and EmbeddedDatabaseType are on the classpath,
AND no DataSource bean exists yet, then create one using properties from
`spring.datasource.*`."*

### Why `@ConditionalOnMissingBean` matters

This is what makes "just add the starter and it works, but override it if
you need to" possible.

```java
@Configuration
public class MyConfig {
    @Bean
    public DataSource dataSource() {
        // your custom DataSource
    }
}
```

Because your bean exists, Boot's auto-configured DataSource is skipped.

**Interview line:** *"Auto-config backs off if you define your own bean of
the same type — that's the `@ConditionalOnMissingBean` contract."*

### `@ConditionalOnProperty` example

```java
@AutoConfiguration
@ConditionalOnProperty(
    prefix = "app.metrics",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = false
)
public class MetricsAutoConfiguration {
    @Bean
    public MetricsCollector metricsCollector() {
        return new DefaultMetricsCollector();
    }
}
```

Activate via `application.properties`:

```properties
app.metrics.enabled=true
```

---

## `@AutoConfiguration` vs `@Configuration`

Since Boot 2.7:

```java
@AutoConfiguration   // new
public class MyAutoConfiguration { }

@Configuration       // classic
public class MyConfig { }
```

### Differences

| | `@AutoConfiguration` | `@Configuration` |
|---|---|---|
| Purpose | Auto-config classes | User config classes |
| Ordering | `before`/`after` attributes | `@Order` |
| Registration | Via `.imports` file | Via `@ComponentScan` or `@Import` |
| Proxy | `proxyBeanMethods = false` by default | `true` by default |
| Boot recommendation | For libraries | For applications |

**`@AutoConfiguration` runs after user config**, so `@ConditionalOnMissingBean`
works as expected.

### Ordering auto-configs

```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
public class MyRepositoryAutoConfiguration { }
```

Sometimes needed when one auto-config depends on another.

---

## Writing Your Own Starter

A **starter** is a library that brings together dependencies + auto-config
for a specific feature. It's how Boot keeps the "add one dep, get everything"
magic.

### Structure

```text
my-starter/
├── pom.xml
└── src/main/
    ├── java/com/example/starter/
    │   ├── MyService.java
    │   ├── MyProperties.java
    │   └── MyAutoConfiguration.java
    └── resources/META-INF/spring/
        └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

### The `.imports` file

```text
com.example.starter.MyAutoConfiguration
```

### The auto-config class

```java
@AutoConfiguration
@ConditionalOnClass(MyService.class)
@EnableConfigurationProperties(MyProperties.class)
public class MyAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public MyService myService(MyProperties props) {
        return new MyService(props.getEndpoint(), props.getTimeout());
    }
}
```

### The `@ConfigurationProperties` class

```java
@ConfigurationProperties(prefix = "my.service")
public class MyProperties {
    private String endpoint = "default";
    private Duration timeout = Duration.ofSeconds(5);

    // getters, setters
}
```

### Users configure via `application.yml`

```yaml
my:
  service:
    endpoint: https://api.example.com
    timeout: 10s
```

**Interview line:** *"A starter = dependencies + auto-config + properties.
Users just add the dependency and set properties."*

---

## Debugging Auto-Configuration

### `--debug` flag

```bash
java -jar app.jar --debug
```

Or:

```properties
debug=true
```

Prints the **auto-configuration report**:

```text
============================
CONDITIONS EVALUATION REPORT
============================

Positive matches:
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'javax.sql.DataSource', ...
      - @ConditionalOnMissingBean (types: javax.sql.DataSource) did not find any beans

Negative matches:
-----------------
   RedisAutoConfiguration:
      - @ConditionalOnClass did not find required class 'redis.clients.jedis.Jedis'
```

**Positive matches** — auto-configs that activated.
**Negative matches** — auto-configs that were skipped, with reasons.

### Actuator `/actuator/conditions`

If Actuator is on the classpath:

```bash
curl localhost:8080/actuator/conditions
```

Returns the same report as JSON.

### `--debug` for the component scan

```bash
java -jar app.jar --debug
```

Also shows:
- Beans that were registered
- Auto-configs that were excluded

---

## Excluding Auto-Configurations

Sometimes Boot auto-configures something you don't want.

### Method 1 — `@SpringBootApplication` exclude

```java
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
public class MyApp { }
```

### Method 2 — property

```properties
spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
```

### Method 3 — `@EnableAutoConfiguration` exclude

```java
@EnableAutoConfiguration(exclude = { DataSourceAutoConfiguration.class })
```

**Use when:** you want full control over a specific bean, or the auto-config
conflicts with your setup.

---

## Common Auto-Config Examples

| Starter | Auto-configures |
|---|---|
| `spring-boot-starter-web` | Tomcat, `DispatcherServlet`, Jackson, `ObjectMapper`, MVC |
| `spring-boot-starter-data-jpa` | `DataSource`, `EntityManagerFactory`, `TransactionManager`, `JpaRepository` |
| `spring-boot-starter-security` | `SecurityFilterChain`, `PasswordEncoder`, filter chain |
| `spring-boot-starter-actuator` | `/actuator/*` endpoints, health checks, metrics |
| `spring-boot-starter-cache` | `CacheManager`, `@Cacheable` support |
| `spring-boot-starter-validation` | `Validator`, `MethodValidationPostProcessor` |
| `spring-boot-starter-test` | JUnit, Mockito, AssertJ, MockMvc, `@SpringBootTest` |

### How the "just works" magic happens

Adding `spring-boot-starter-web`:

1. Brings in Tomcat, Spring MVC, Jackson
2. `WebMvcAutoConfiguration` sees Tomcat + Spring MVC on classpath
3. Registers `DispatcherServlet`, `RequestMappingHandlerMapping`,
   `JacksonObjectMapper`, etc.
4. Your `@RestController` classes get picked up by component scan
5. App serves HTTP on port 8080

**You wrote zero config.** That's the point.

---

## Tricky Corners ⚠️

**Put your `@SpringBootApplication` class in the root package.** Otherwise
component scan misses parts of the app.

**`@ConditionalOnMissingBean` runs in the order auto-configs are evaluated.**
If your bean is defined in an auto-config that runs later, the earlier
auto-config may already have created its bean. User `@Configuration` classes
always run before auto-configs.

**Auto-configs are evaluated lazily, not all at once.** The `AutoConfigurationImportSelector`
returns the candidates; Spring evaluates conditions during bean creation.

**`spring.factories` still works** for other purposes (e.g., `EnvironmentPostProcessor`)
but is deprecated for auto-config since 2.7.

**`@ConfigurationProperties` requires `@EnableConfigurationProperties` or
`@ConfigurationPropertiesScan`.** The auto-config class usually declares it.

**`@ConditionalOnBean` on a class level evaluates against beans defined so
far.** Order matters.

**Property precedence is complex.** Command-line > env vars >
`application-{profile}.properties` > `application.properties`. See the
[Configuration](configuration.md) file.

**Auto-config exclusions don't cascade.** Excluding `DataSourceAutoConfiguration`
won't automatically exclude `JpaRepositoriesAutoConfiguration` — you may need
to exclude both.

**`--debug` output is verbose.** Pipe to a file and grep for `Negative matches`
or your specific auto-config.

**Tests don't always trigger the same auto-config.** `@WebMvcTest` slices
exclude most auto-configs; `@SpringBootTest` includes them.

**Custom auto-configs need to be registered in `.imports`.** Otherwise
Boot's selector won't see them.

**`@AutoConfiguration` classes need `@Bean` methods marked `static`** if they
use `BeanFactoryPostProcessor`. Rare, but breaks silently when missed.

---

## Common Pitfalls

- Putting the main class outside the root package.
- Defining a bean in a user config that isn't picked up before auto-config.
- Assuming auto-config runs in a fixed order.
- Forgetting to add auto-config to `.imports` file.
- Trying to exclude an auto-config by class name without the full FQN.
- Fighting the framework — sometimes letting auto-config do its thing and
  overriding via properties is cleaner than excluding.
- Not using `--debug` when auto-config isn't doing what you expect.
- Assuming `@ConditionalOnMissingBean` will always see your bean — order
  matters.

---

## Key Interview Tips

- Say **"`@SpringBootApplication` = `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan`."**
- Explain auto-config in one sentence: *"Conditional configuration that
  activates only when the right classes/properties/beans are present."*
- Recite the top conditions: `@ConditionalOnClass`, `@ConditionalOnMissingBean`,
  `@ConditionalOnProperty`.
- Say **"`@ConditionalOnMissingBean` is why your custom beans win."**
- Mention the `.imports` file (Boot 2.7+) replacing `spring.factories`.
- Know `--debug` produces the auto-configuration report.
- Explain how a starter packages dependencies + auto-config + properties.

---

## Related

- [Configuration](configuration.md) — properties, profiles, `@ConfigurationProperties`
- [IoC & Dependency Injection](../core/ioc-and-di.md) — how beans get wired
- [Bean Lifecycle](../core/bean-lifecycle.md) — when auto-config beans get created