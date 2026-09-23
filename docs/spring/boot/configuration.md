# Configuration

> **Spring context:** Spring Boot 3.x. Focus is on property sources, profiles,
> `@ConfigurationProperties`, and the loading order — the things interviewers
> actually ask.

## Mental Model

Spring Boot config comes from **multiple sources** merged in a defined order.
The **last source wins** for any given property.

```d2
direction: down

sources: "Property Sources (highest to lowest)" {
  style.fill: "#f5f5f5"

  cli: "1. Command-line args\n(--server.port=8081)" {
    style.fill: "#c8e6c9"
  }
  spEL: "2. SPRING_APPLICATION_JSON" {
    style.fill: "#c8e6c9"
  }
  servlet: "3. ServletConfig / ServletContext" {
    style.fill: "#a5d6a7"
  }
  jndi: "4. JNDI attributes" {
    style.fill: "#81c784"
  }
  sysProps: "5. Java System properties\n(-Dserver.port=8081)" {
    style.fill: "#fff9c4"
  }
  envVars: "6. OS environment variables\n(SERVER_PORT=8081)" {
    style.fill: "#ffe0b2"
  }
  profile: "7. application-{profile}.properties/yml" {
    style.fill: "#ffcc80"
  }
  app: "8. application.properties/yml" {
    style.fill: "#ffb74d"
  }
  default: "9. @PropertySource on @Configuration" {
    style.fill: "#f8bbd0"
  }
  defaults: "10. SpringApplication default properties" {
    style.fill: "#e1bee7"
  }
}
```

**Rule:** the higher the source, the more it wins.

---

## `application.properties` vs `application.yml`

Both are equivalent. YAML is hierarchical, properties is flat.

### Properties

```properties
server.port=8080
spring.datasource.url=jdbc:postgresql://localhost/db
spring.datasource.username=admin
spring.datasource.password=secret
logging.level.com.example=DEBUG
```

### YAML

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://localhost/db
    username: admin
    password: secret

logging:
  level:
    com.example: DEBUG
```

### Which to prefer?

YAML — **hierarchical structure and lists** are cleaner:

```yaml
my:
  servers:
    - server1.example.com
    - server2.example.com
```

vs properties:

```properties
my.servers[0]=server1.example.com
my.servers[1]=server2.example.com
```

**YAML gotcha:** indentation matters. Tabs are not allowed.

### Multiple files

Boot loads both `application.yml` and `application.properties` if present.
**YAML wins** if the same key exists in both — actually, the **last one on the
classpath order wins**, and properties is usually loaded first.

**Recommendation:** pick one. Mixing leads to confusion.

---

## Profiles

Profiles let you activate different config per environment.

### Defining profile-specific files

```text
src/main/resources/
├── application.properties            # always
├── application-dev.properties        # only with dev profile
├── application-prod.properties       # only with prod profile
└── application-test.properties       # only with test profile
```

### Activating a profile

```bash
# Command line
java -jar app.jar --spring.profiles.active=prod

# Environment variable
SPRING_PROFILES_ACTIVE=prod java -jar app.jar

# In application.properties
spring.profiles.active=dev
```

### Multiple active profiles

```bash
--spring.profiles.active=dev,debug
```

Both `application-dev` and `application-debug` files load.

### Profile-specific YAML (multi-document)

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:h2:mem:default

---
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:h2:mem:dev

---
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: jdbc:postgresql://prod-db/app
```

Separated by `---`. Each document can be profile-activated.

### `@Profile` on beans

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @Profile("dev")
    public DataSource devDataSource() {
        return new EmbeddedDatabaseBuilder().build();
    }

    @Bean
    @Profile("prod")
    public DataSource prodDataSource() {
        return DataSourceBuilder.create()
                .url("jdbc:postgresql://prod-db/app")
                .build();
    }
}
```

**Only the bean matching an active profile is created.**

### `spring.profiles.include`

Adds additional profiles without replacing the active one:

```properties
spring.profiles.active=prod
spring.profiles.include=metrics,audit
```

Active: `prod`, `metrics`, `audit`.

### `spring.profiles.default`

```properties
spring.profiles.default=dev
```

If no profile is active, `dev` is used. **Never activate this in production**
— you'd silently use dev config.

---

## `@Value` vs `@ConfigurationProperties`

### `@Value` — single-property injection

```java
@Component
public class EmailService {
    @Value("${mail.host}")
    private String host;

    @Value("${mail.port:587}")   // default value
    private int port;

    @Value("${mail.enabled:true}")
    private boolean enabled;
}
```

### `@ConfigurationProperties` — structured binding

```java
@ConfigurationProperties(prefix = "mail")
public class MailProperties {
    private String host;
    private int port = 587;
    private boolean enabled = true;

    // getters, setters
}

@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class MailConfig {
    @Bean
    public EmailService emailService(MailProperties props) {
        return new EmailService(props.getHost(), props.getPort());
    }
}
```

Config:

```yaml
mail:
  host: smtp.example.com
  port: 465
  enabled: true
```

### Comparison

| | `@Value` | `@ConfigurationProperties` |
|---|---|---|
| Multiple properties | ❌ one at a time | ✅ whole group |
| Type safety | Weak (SpEL parsing) | Strong (typed binding) |
| Default values | Inline `${...:default}` | Field initializers |
| Validation | ❌ | ✅ with `@Validated` |
| Nested objects | ❌ awkward | ✅ natural |
| Lists / Maps | ⚠️ limited | ✅ |
| Relaxed binding | ❌ | ✅ (`mail.host-name` = `mail.hostName`) |
| IDE support | ⚠️ weak | ✅ with metadata |
| Testing | Hard | Easy — bind to a class |

**Rule:** use `@ConfigurationProperties` for anything non-trivial. Use
`@Value` for one-off values in test code or a single property.

### Relaxed binding

`@ConfigurationProperties` accepts multiple formats:

| In properties | In class field |
|---|---|
| `mail.host-name` | `hostName` |
| `mail.hostName` | `hostName` |
| `MAIL_HOSTNAME` | `hostName` |
| `mail.host_name` | `hostName` |

Only `@ConfigurationProperties` supports this.

### `@ConfigurationProperties` + `record`

Java records work great:

```java
@ConfigurationProperties(prefix = "mail")
public record MailProperties(String host, int port, boolean enabled) { }
```

Immutable, concise, no setters needed.

**Requires Boot 2.6+ for constructor binding without `@ConstructorBinding`.**

### Validation

```java
@ConfigurationProperties(prefix = "mail")
@Validated
public class MailProperties {
    @NotBlank
    private String host;

    @Min(1) @Max(65535)
    private int port = 587;

    @NotNull
    private Duration timeout = Duration.ofSeconds(5);
}
```

Invalid config fails fast at startup.

### Type conversion

`@ConfigurationProperties` handles:

- `Duration` — `10s`, `5m`, `1h`
- `DataSize` — `10MB`, `1GB`
- `List<T>`, `Map<K, V>`
- Enums (case-insensitive)

```yaml
mail:
  timeout: 30s
  max-attachment-size: 25MB
  priority: HIGH
```

### Registering `@ConfigurationProperties` beans

**Method 1 — `@EnableConfigurationProperties`:**

```java
@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class MailConfig { }
```

**Method 2 — `@ConfigurationPropertiesScan`:**

```java
@SpringBootApplication
@ConfigurationPropertiesScan
public class MyApp { }
```

Scans for all `@ConfigurationProperties` classes in the package tree.

**Method 3 — `@Component` on the properties class:**

```java
@Component
@ConfigurationProperties(prefix = "mail")
public class MailProperties { ... }
```

Works, but couples the class to Spring. Prefer Method 1 or 2.

---

## `@PropertySource`

Load custom property files:

```java
@Configuration
@PropertySource("classpath:custom.properties")
@PropertySource("classpath:secure.properties")
public class MyConfig { }
```

**Limitations:**

- Doesn't work with YAML out of the box (needs a custom `PropertySourceFactory`)
- Lower precedence than `application.properties`

**Modern alternative:** use profile-specific files
(`application-custom.properties`) instead.

---

## Property Loading Order

Boot loads in this order (highest to lowest priority):

1. Command-line args (`--key=value`)
2. `SPRING_APPLICATION_JSON`
3. `ServletConfig` / `ServletContext` init params
4. JNDI
5. Java System properties (`-Dkey=value`)
6. OS environment variables
7. `application-{profile}.properties/yml`
8. `application.properties/yml`
9. `@PropertySource` annotations
10. `SpringApplication.setDefaultProperties`

**Key implications:**

- Env vars override `application.properties`
- Command-line args override everything
- Profile files override non-profile files
- OS env vars use `UPPERCASE_SNAKE_CASE` (`SERVER_PORT` for `server.port`)

### Example

```properties
# application.properties
server.port=8080
```

```bash
SERVER_PORT=9090 java -jar app.jar
```

→ Port is **9090** (env var wins).

```bash
SERVER_PORT=9090 java -jar app.jar --server.port=7070
```

→ Port is **7070** (command-line wins).

---

## `@Value` with SpEL

`@Value` supports SpEL expressions:

```java
@Value("#{systemProperties['user.home']}")
private String userHome;

@Value("#{2 * 3}")
private int six;

@Value("${mail.timeout:PT30S}")
private Duration timeout;

@Value("#{mailProperties.host}")
private String host;
```

**Common interview trap:** `@Value("${...}")` is a property placeholder;
`@Value("#{...}")` is a SpEL expression. **Different syntaxes.**

---

## Encryption / Secrets

**Never commit secrets to git.**

### Options

| Approach | Notes |
|---|---|
| Environment variables | Simple, works in containers |
| Externalized config | Config server, vault |
| Jasypt | Encrypt properties, decrypt at startup |
| Spring Cloud Vault | HashiCorp Vault integration |
| AWS Secrets Manager | Cloud-native |

### Environment variables

```bash
export DB_PASSWORD=secret
java -jar app.jar
```

```yaml
spring:
  datasource:
    password: ${DB_PASSWORD}
```

**No placeholder fallback** means startup fails if missing — good.

---

## Testing Configuration

### `@SpringBootTest` with properties

```java
@SpringBootTest(properties = {
    "mail.host=test-smtp",
    "mail.port=2525"
})
class MailServiceTest { ... }
```

### `@TestPropertySource`

```java
@SpringBootTest
@TestPropertySource(locations = "classpath:test.properties")
class MailServiceTest { ... }
```

### Binding directly to `@ConfigurationProperties` (no Spring)

```java
@Test
void bindsProperties() {
    ApplicationContextRunner runner = new ApplicationContextRunner()
            .withPropertyValues("mail.host=smtp.test", "mail.port=2525")
            .withUserConfiguration(MailConfig.class);

    runner.run(ctx -> {
        MailProperties props = ctx.getBean(MailProperties.class);
        assertThat(props.getHost()).isEqualTo("smtp.test");
        assertThat(props.getPort()).isEqualTo(2525);
    });
}
```

For a lighter approach, use `@EnableConfigurationProperties` with a manual
binder.

---

## Relaxed Binding Rules

`@ConfigurationProperties` normalizes property names:

| YAML / properties | Field |
|---|---|
| `my-service.host-name` | `hostName` |
| `my-service.hostName` | `hostName` |
| `MY_SERVICE_HOSTNAME` | `hostName` |
| `my-service.host_name` | `hostName` |

**Env var mapping:** dots → underscores, dashes removed, uppercase:

`spring.datasource.url` → `SPRING_DATASOURCE_URL`

**Interview line:** *"Relaxed binding lets the same logical property be
expressed in kebab-case, camelCase, snake_case, or env-var format."*

---

## Tricky Corners ⚠️

**YAML indentation is strict.** Tabs are forbidden; only spaces.

**YAML `on`/`off`/`yes`/`no`** are parsed as booleans by some parsers. Spring's
YAML parser is safer, but escape them as strings if unsure.

**Environment variables can't contain dots.** `server.port` maps to
`SERVER_PORT`. Dashes in `spring.profiles.active` become `SPRING_PROFILES_ACTIVE`.

**`@Value` doesn't support relaxed binding.** `@Value("${mail.hostName}")`
requires exactly that key — not `mail.host-name`.

**`@Value` on a constructor parameter works**, but `@Value` on a field with
`final` doesn't (final fields must be set in the constructor).

**Profile-specific files override the base file entirely** for the same key,
but not the whole file.

**`spring.profiles.active` in `application.properties` can't be changed by
profile files** — it's resolved before profiles load.

**Default values in `@Value`** use `:` — `@Value("${mail.port:587}")`.

**`@ConfigurationProperties` needs `@EnableConfigurationProperties` or
`@ConfigurationPropertiesScan`.** Otherwise the class isn't a bean.

**Constructor binding requires `@ConstructorBinding` in Boot 2.x** for
classes with multiple constructors. Boot 3.x infers it. Records always use
constructor binding.

**`@PropertySource` doesn't support YAML** without a custom
`PropertySourceFactory`. Prefer profile-specific files.

**Sensitive values in `application.properties` are visible in `/actuator/env`
unless masked.** Use `spring.actuator.env.show-values=never` or mask
specific keys.

**Environment variables aren't reloaded at runtime.** Changing them requires
a restart.

**`@RefreshScope` (Spring Cloud) is required for runtime property reload.**
Plain Boot doesn't support hot reload.

**Placeholders can reference other properties:** `@Value("${app.base-url}/api")`
works if `app.base-url` is defined.

**Circular references in properties cause startup failure.** Don't have
`a=${b}` and `b=${a}`.

---

## Common Pitfalls

- Putting secrets in `application.properties` and committing to git.
- Mixing `@Value` and `@ConfigurationProperties` for the same concept.
- Forgetting `@EnableConfigurationProperties` on a `@ConfigurationProperties`
  class.
- Assuming YAML and properties merge the same way.
- Using tabs in YAML.
- Setting `spring.profiles.default=prod`.
- Trying to use `@Value` for lists or nested objects.
- Not knowing that env vars override `application.properties`.
- Ignoring `/actuator/env` leaking secrets.

---

## Key Interview Tips

- Recite the **loading order** — CLI > env > profile files > base file.
- Explain the difference between **`@Value` and `@ConfigurationProperties`**
  and when to use each.
- Say **"relaxed binding is only for `@ConfigurationProperties`."**
- Explain **profiles** and how they override base properties.
- Mention `@ConfigurationPropertiesScan` for bulk registration.
- Know that **env vars override property files** and use `UPPER_SNAKE_CASE`.
- Never commit secrets — env vars, vault, or encrypted values.

---

## Related

- [Auto-Configuration](auto-configuration.md) — how properties drive auto-config
- [IoC & Dependency Injection](../core/ioc-and-di.md) — `@Value` and
  `@ConfigurationProperties` as injection sources
- [Spring Data JPA](../data/spring-data-jpa.md) — `spring.jpa.*` properties
- [Security Basics](../security/spring-security-basics.md) — security-specific
  properties