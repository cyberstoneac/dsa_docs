# Config Server

> **Spring context:** Spring Cloud Config provides centralized, versioned
> configuration. `spring-cloud-starter-bootstrap` is required in Spring
> Boot 2.4+ for bootstrap-context features like `@RefreshScope` at startup.

## Mental Model

Instead of every microservice carrying its own `application.yml`, config
lives in **one place** — a Git repository, Vault, or a database — and services
fetch it at startup.

```d2
direction: right

git: "Git Repo\n(application.yml,\nuser-service.yml,\norder-service.yml)" {
  style.fill: "#e3f2fd"
}
config: "Config Server" {
  style.fill: "#c8e6c9"
  desc: "Exposes /{app}/{profile}"
}
svcA: "user-service" {
  style.fill: "#fff9c4"
}
svcB: "order-service" {
  style.fill: "#ffe0b2"
}

git.config -> config: "reads"
config.svcA -> svcA: "1. fetch at startup"
config.svcB -> svcB: "1. fetch at startup"
svcA.config -> config: "2. refresh on /actuator/refresh"
svcB.config -> config: "2. refresh on /actuator/refresh"
```

**Key wins:**

- Single source of truth for config
- Version control (audit trail)
- Runtime refresh without restart
- Per-environment, per-service config
- Secrets can be encrypted at rest

**Interview line:** *"Config Server centralizes and versions configuration —
services fetch it at startup, and can refresh at runtime."*

---

## Why Centralized Config?

Without it:

- 30 microservices × 3 environments = 90 config files to update
- A password change requires 30 deployments
- No audit trail
- Config drifts between environments

With it:

- One place to update config
- Version control
- One push refreshes all services
- Environment-specific overrides

**Interview line:** *"Config Server solves the 'N services × M environments'
problem."*

---

## Config Server Setup

### Dependencies

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-config-server</artifactId>
</dependency>
```

### Server application

```java
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConfigServerApplication.class, args);
    }
}
```

### `application.yml`

```yaml
server:
  port: 8888

spring:
  application:
    name: config-server
  cloud:
    config:
      server:
        git:
          uri: https://github.com/example/config-repo
          default-label: main
          search-paths: '{application}'
          clone-on-start: true
          username: ${GIT_USERNAME}
          password: ${GIT_TOKEN}
```

### Native (filesystem) backend for local dev

```yaml
spring:
  cloud:
    config:
      server:
        native:
          search-locations: file:///path/to/config
  profiles:
    active: native
```

Faster than Git for local development.

---

## Config Repository Structure

A typical Git repo backing Config Server:

```text
config-repo/
├── application.yml                    # all services, all profiles
├── application-dev.yml                # all services, dev profile
├── application-prod.yml               # all services, prod profile
├── user-service.yml                   # user-service only
├── user-service-dev.yml               # user-service, dev
├── user-service-prod.yml              # user-service, prod
├── order-service.yml
└── order-service-prod.yml
```

**Loading order** (last wins):

1. `application.yml` (base for all)
2. `application-{profile}.yml`
3. `{service}.yml`
4. `{service}-{profile}.yml`

### `{application}` search-path convention

```yaml
search-paths: '{application},shared'
```

- `{application}` is resolved to the service name
- Allows per-service subdirectories: `user-service/application.yml`

---

## Config Client Setup

### Dependencies

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-config</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-bootstrap</artifactId>
</dependency>
```

`spring-cloud-starter-bootstrap` is **required since Spring Boot 2.4** for
`bootstrap.yml` support and Config Server integration at startup.

### `bootstrap.yml` (loads before `application.yml`)

```yaml
spring:
  application:
    name: user-service
  profiles:
    active: dev
  cloud:
    config:
      uri: http://localhost:8888
      fail-fast: true
      retry:
        initial-interval: 1000
        max-attempts: 5
```

**Why `bootstrap.yml`?** It's fetched **before** the application context
starts, so config values are available during early initialization.

### Alternative — `spring.config.import` (Boot 2.4+)

```yaml
# application.yml
spring:
  application:
    name: user-service
  config:
    import: "configserver:http://localhost:8888"
```

**Modern replacement** for `bootstrap.yml`. Doesn't require
`spring-cloud-starter-bootstrap`.

**Interview line:** *"`spring.config.import` is the modern replacement for
`bootstrap.yml`."*

---

## Endpoint Reference

Config Server exposes:

```
GET /{application}/{profile}
GET /{application}/{profile}/{label}
```

Examples:

```bash
# Get config for user-service in dev profile
curl http://localhost:8888/user-service/dev

# From a specific branch
curl http://localhost:8888/user-service/prod/v2.1.0

# Default profile
curl http://localhost:8888/user-service/default
```

**Response:**

```json
{
  "name": "user-service",
  "profiles": ["dev"],
  "label": null,
  "version": "abc123",
  "state": null,
  "propertySources": [
    {
      "name": "https://github.com/.../user-service-dev.yml",
      "source": { "server.port": 8081, "db.url": "jdbc:..." }
    },
    {
      "name": "https://github.com/.../application-dev.yml",
      "source": { "logging.level.root": "DEBUG" }
    }
  ]
}
```

**Order matters:** earlier sources override later sources.

---

## Refresh Without Restart

### `@RefreshScope`

```java
@RestController
@RefreshScope
public class FeatureController {

    @Value("${feature.new-checkout.enabled}")
    private boolean newCheckoutEnabled;

    @GetMapping("/checkout")
    public String checkout() {
        return newCheckoutEnabled ? "New" : "Old";
    }
}
```

Trigger refresh:

```bash
curl -X POST http://localhost:8081/actuator/refresh
```

**What happens:**

1. Client calls `/actuator/refresh`
2. Spring fetches the latest config from Config Server
3. `@RefreshScope` beans are **re-created** with new values
4. No restart needed

**Interview line:** *"`@RefreshScope` creates a proxy that re-initializes the
bean when `/actuator/refresh` is called."*

### What `@RefreshScope` does NOT refresh

- `@ConfigurationProperties` beans bound with constructor injection
- Beans without `@RefreshScope`
- Properties read via `Environment.getProperty()` directly (they may update)
- Auto-configured beans that only read config at startup (e.g. `DataSource`)

**Restart still required** for many things — the JVM's connections, thread
pools, etc.

### Bus — refresh all services at once

**Spring Cloud Bus** propagates a refresh event to all services via a
message broker (Kafka, RabbitMQ).

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-bus-amqp</artifactId>
</dependency>
```

```bash
curl -X POST http://config-server/actuator/busrefresh
```

All subscribed services refresh simultaneously.

**Interview line:** *"Spring Cloud Bus refreshes all services via a message
broker — one call, all services updated."*

---

## Secrets and Encryption

### Symmetric encryption

```yaml
encrypt:
  key: ${CONFIG_ENCRYPT_KEY}
```

Encrypt a value:

```bash
curl -X POST http://localhost:8888/encrypt -d "my-secret-password"
# → 682bc583f4641835fa2db009355293665d2647dade3375c0ee201de2a49f7bda
```

Use it in config:

```yaml
db:
  password: '{cipher}682bc583f4641835fa2db009355293665d2647dade3375c0ee201de2a49f7bda'
```

**The `{cipher}` prefix tells Config Server to decrypt.**

### Asymmetric (RSA)

More secure. Generate a keystore:

```bash
keytool -genkeypair -alias config-server-key \
  -keyalg RSA -keysize 4096 \
  -keystore config-server.jks
```

```yaml
encrypt:
  key-store:
    location: classpath:config-server.jks
    password: ${KEYSTORE_PASSWORD}
    alias: config-server-key
```

**Interview line:** *"Config Server can encrypt properties at rest — the
`{cipher}` prefix triggers decryption on read."*

### Better for real secrets

**Vault / AWS Secrets Manager / Kubernetes Secrets** are preferred over
encrypted Git for production. Config Server can integrate with Vault as a
backend.

**Interview line:** *"Config Server + Git for regular config; Vault for
secrets."*

---

## Fail Fast vs Fail Silent

By default, a service that can't reach Config Server **fails silently** with
fallback to local config.

### Fail fast

```yaml
spring:
  cloud:
    config:
      fail-fast: true
      retry:
        initial-interval: 1000
        max-attempts: 5
        multiplier: 2
```

**Use this in production** — a service running on stale config is worse than
one that fails to start.

**Interview line:** *"`fail-fast: true` in production — running on stale
config is dangerous."*

---

## Multiple Environments

### By label (Git branch)

```yaml
# dev service bootstrap
spring:
  cloud:
    config:
      label: develop
```

### By profile

```yaml
# prod service bootstrap
spring:
  profiles:
    active: prod
```

Config Server resolves `{app}-{profile}.yml` from the repo.

### Discovery-based Config Server

Instead of hardcoding Config Server URL, discover it via Eureka:

```yaml
spring:
  cloud:
    config:
      discovery:
        enabled: true
        service-id: config-server
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
```

**Bootstrapping order matters:** the client must reach Eureka before Config
Server. Eureka URL must be in `bootstrap.yml`.

---

## Tricky Corners ⚠️

**Since Spring Boot 2.4, `bootstrap.yml` requires
`spring-cloud-starter-bootstrap`.** Without it, the file is ignored.

**Modern alternative: `spring.config.import`** — no bootstrap starter needed.

**`@RefreshScope` doesn't refresh everything.** Beans must be annotated, and
some values (like `DataSource` connections) can't be hot-swapped.

**Refresh only updates the local service.** To refresh all, use Spring Cloud
Bus.

**Encrypted properties use `{cipher}` prefix.** Forget the prefix and you'll
store an encrypted blob as a literal.

**The symmetric encryption key must be shared** between Config Server and any
consumers of encrypted values. It's not in the config repo.

**Config Server has access to all secrets.** Secure it with authentication
(Spring Security on Config Server).

**Config Server cloning Git on every request is slow.** Enable
`clone-on-start: true` and let it cache.

**Fail-fast should be enabled in production.** Silent failures lead to
services running stale config.

**Label + profile interaction** — the resolution order matters. Label is the
branch; profile is the config file suffix.

**Property source order is reversed** in the JSON response — earlier sources
have **higher** priority.

**Config Server uses the client's `spring.application.name`** to determine
which config file to serve. Renaming the app breaks config resolution.

**Config Server is a single point of failure.** Run multiple instances behind
a load balancer, or discover via Eureka.

**Bootstrapping circular dependency:** client needs Config Server; Config
Server might need Eureka; Eureka doesn't need Config Server (usually). Order
matters.

**`@ConfigurationProperties` with constructor binding** is NOT refreshable
by default. Need `@RefreshScope` on a `@Bean` producer.

**Property placeholders in Config Server** are resolved server-side. Client
placeholders are resolved client-side.

**Spring Cloud Config's Git backend caches** — changes may take up to
`spring.cloud.config.server.git.refresh-rate` seconds to appear.

---

## Common Pitfalls

- Forgetting `spring-cloud-starter-bootstrap` in Boot 2.4+.
- Using `@RefreshScope` and expecting all beans to refresh.
- Not enabling fail-fast in production.
- Committing unencrypted secrets to the config repo.
- Forgetting the `{cipher}` prefix on encrypted values.
- Exposing Config Server without authentication.
- Assuming refresh propagates to all services (needs Bus).
- Not pinning a label/branch for production.
- Clone-on-start disabled → slow startup per request.

---

## Key Interview Tips

- Say **"Config Server centralizes config in Git — one source of truth."**
- Explain the **loading order**: `application.yml` → `application-{profile}.yml`
  → `{service}.yml` → `{service}-{profile}.yml`.
- Say **"`bootstrap.yml` loads before `application.yml` — it requires
  `spring-cloud-starter-bootstrap` in Boot 2.4+."**
- Mention **`spring.config.import`** as the modern alternative.
- Explain **`@RefreshScope` + `/actuator/refresh`** for runtime refresh.
- Say **"Spring Cloud Bus refreshes all services via a broker."**
- Explain **`{cipher}` prefix** for encrypted properties.
- Mention **Vault** as the production-grade secrets backend.
- Say **"fail-fast: true in production."**

---

## Related

- [Service Discovery](service-discovery.md) — Config Server can be discovered
- [Configuration](../boot/configuration.md) — Boot property loading
- [API Gateway](api-gateway.md) — gateway config from Config Server
- [Circuit Breaker](circuit-breaker.md) — resilience property tuning