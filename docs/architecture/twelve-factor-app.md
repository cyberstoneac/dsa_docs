# Twelve-Factor App

> **Spring context:** Spring Boot 3.x, Jakarta namespace, externalized configuration, actuator, containerized deployment. This file maps each factor to concrete Spring Boot practice.

## Mental Model

The Twelve-Factor App (Adam Wiggins, Heroku, 2011) is a **methodology for building software-as-a-service** that is portable, observable, and scalable. It emerged from watching hundreds of apps fail to move cleanly from laptop → staging → production, and from VM → container.

The factors are not laws. They are **heuristics for eliminating friction** between code and operations. Each factor fixes a specific class of pain: config drift, environment leaks, sticky state, log chaos, and process leaks.

```d2
direction: down

codebase: "I. Codebase\none repo, many deploys"
deps: "II. Dependencies\nexplicit and isolated"
config: "III. Config\nin the environment"
backing: "IV. Backing Services\nattached resources"
build: "V. Build, Release, Run\nstrict separation"
processes: "VI. Processes\nstateless"
port: "VII. Port Binding\nself-contained"
concurrency: "VIII. Concurrency\nscale out via processes"
disposability: "IX. Disposability\nfast start, graceful stop"
parity: "X. Dev/Prod Parity\nkeep them similar"
logs: "XI. Logs\ntreat as event streams"
admin: "XII. Admin Processes\none-off in the same env"
```

## I. Codebase — One codebase tracked in revision control, many deploys

**Factor:** One repo per app. Multiple deploys (dev, staging, prod) come from the *same* codebase at *different* commits.

**Rules**

- One repo per deployable app. Not one repo for the whole platform, not a repo per environment.
- Branches (or tags) distinguish versions, not environments.
- Monorepos are compatible if each app has its own root and build.

**Anti-patterns**

- Copying the repo for a "prod version" — divergence guaranteed.
- Environment-specific branches (`prod`, `staging` branches) — merge hell.
- Multiple apps sharing one repo without clear boundaries.

**Spring Boot practice**

- One `pom.xml` / `build.gradle.kts` per application.
- Environment differences live in config (Factor III), not in code branches.
- Monorepo is fine if each app has its own directory and CI pipeline.

## II. Dependencies — Explicitly declare and isolate dependencies

**Factor:** Never rely on system-wide packages. Every dependency is declared in a manifest and installed deterministically.

**Rules**

- Manifest declares **direct** dependencies; lockfile pins **transitive** versions.
- The app never assumes `java`, `mvn`, or any tool is present system-wide — build with a wrapper or a container.
- No "sneak in" dependencies via `CLASSPATH`.

**Anti-patterns**

- Relying on a system-installed `curl` or `ImageMagick` without declaring it.
- Depending on a developer's local `~/.m2` containing an unpublished artifact.
- `latest` version ranges instead of pinned versions.

**Spring Boot practice**

- Maven: `mvnw` wrapper + `pom.xml`. Gradle: `gradlew` + `libs.versions.toml` + lockfile.
- Spring Boot BOM pins transitive versions; don't override without reason.
- Reproducible builds: pin plugin versions, use `maven-enforcer-plugin` to ban duplicate classes.

```xml
<!-- Maven wrapper enforces the exact Maven version -->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <executions>
    <execution>
      <id>enforce-java</id>
      <goals><goal>enforce</goal></goals>
      <configuration>
        <rules>
          <requireJavaVersion><version>[17,)</version></requireJavaVersion>
          <banDuplicatePomDependencyVersions/>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
```

## III. Config — Store configuration in the environment

**Factor:** Anything that varies between deploys (credentials, hostnames, feature flags) lives in **environment variables**, not in code or in bundled files checked into the repo.

**Rules**

- Config is externalized — env vars, a config server, or a secret manager.
- The same artifact runs in every environment with different config.
- Config must not be a "logical constant" of the code (e.g. an `environment: prod` flag scattered across classes).

**Anti-patterns**

- `application-prod.yml` checked into the repo with real credentials.
- Environment checks in code: `if (System.getenv("ENV").equals("prod"))`.
- Config bundled into the deploy artifact (immutable jar carrying secrets).

**Spring Boot practice**

- `application.yml` holds **defaults only** (safe, non-secret values).
- Environment-specific values come from:
  - **Environment variables** — `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_PASSWORD`.
  - **Spring Cloud Config Server** — centralized, versioned config.
  - **Vault / AWS Secrets Manager / GCP Secret Manager** — for secrets.
- **Relaxed binding** maps env vars to properties: `SPRING_DATASOURCE_URL` → `spring.datasource.url`.

```yaml
# application.yml — safe defaults only, no secrets
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
```

```bash
# Environment supplies the real values
export DB_URL=jdbc:postgresql://db.internal:5432/orders
export DB_USER=orders_app
export DB_PASSWORD="$(vault read -field=password secret/orders/db)"
java -jar orders.jar
```

**Rule:** if the same artifact could be shipped to staging and prod without any code change — just env — Factor III is satisfied.

## IV. Backing Services — Treat backing services as attached resources

**Factor:** A database, cache, queue, or SMTP server is a **resource** attached via config. Swapping a local Postgres for a managed Postgres should require only a config change.

**Rules**

- No code distinguishes "local" from "remote" backing service.
- Attaching and detaching resources is a config operation.
- Failure of a backing service is handled gracefully (retries, circuit breakers).

**Anti-patterns**

- Hardcoded `localhost:5432`.
- Special code paths for "the prod DB".
- Tightly coupled migrations that assume a specific hosting topology.

**Spring Boot practice**

- `spring.datasource.url` from env — same code, different URL.
- `spring.data.redis.host`, `spring.kafka.bootstrap-servers` — env-driven.
- Use `@ConfigurationProperties` for typed, validated config.

```java
@ConfigurationProperties(prefix = "orders.messaging")
@Validated
public record MessagingProperties(
        @NotBlank String bootstrapServers,
        @NotBlank String ordersTopic,
        @Min(1) int maxRetries
) {}
```

## V. Build, Release, Run — Strictly separate build and run stages

**Factor:** Three distinct stages:

- **Build** — turn source into an executable artifact. No config.
- **Release** — combine artifact with environment config. Versioned, immutable.
- **Run** — execute the release in the environment.

**Rules**

- Build produces an immutable artifact (jar, container image) identified by a version (git SHA, semver).
- Release combines artifact + config → a **release ID** (e.g. `v1.4.2+config-42`).
- Every release is immutable; rollback = deploy an older release.
- Nothing is compiled at run time.

**Anti-patterns**

- Editing files on a running server.
- `apt-get install` at container start to add a dependency.
- Rebuilding the artifact with different code for each environment.

**Spring Boot practice**

- **Build:** `./mvnw -DskipTests package` produces `app.jar`. CI builds a container image tagged with git SHA.
- **Release:** Kubernetes Deployment references an image tag + a ConfigMap/Secret version. ArgoCD/Flux can pin the release.
- **Run:** `java -jar app.jar` or the container entrypoint.
- Rollback = `kubectl rollout undo` or re-point to the previous release.

```dockerfile
# Build stage — produces the artifact
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY . .
RUN ./mvnw -B -DskipTests package

# Run stage — same artifact, no rebuild
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/app.jar app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

## VI. Processes — Execute the app as one or more stateless processes

**Factor:** The app runs as **stateless processes** that share nothing. Any state that must persist lives in a backing service.

**Rules**

- No sticky sessions (or if you must, push session state to Redis).
- No in-memory caches that must agree across instances — use a shared cache.
- No writing to the local filesystem for persistent data.
- Processes can be killed and restarted at any time.

**Anti-patterns**

- Local `HashMap` caches that go stale across instances.
- File uploads saved to the container's local disk.
- Scheduled jobs that run on every instance → duplicate execution. Use leader election or a scheduled-job framework.

**Spring Boot practice**

- Spring Session + Redis for HTTP sessions when multiple instances.
- Shared cache: Redis / Hazelcast. Not Caffeine alone, unless per-instance caching is acceptable.
- Files: S3/GCS/Azure Blob, not `/tmp` or `/var/app`.
- Schedulers: use **ShedLock** or a leader-election mechanism so only one instance runs the job.

```java
@Scheduled(cron = "0 0 * * * *")
@SchedulerLock(name = "hourlyReport", lockAtMostFor = "PT10M")
public void generateHourlyReport() {
    // only one instance executes this
}
```

## VII. Port Binding — Export services via port binding

**Factor:** The app is **self-contained** — it binds to a port and serves requests. It does not rely on an external web server to host it.

**Rules**

- The app includes its own HTTP server (embedded Tomcat, Jetty, Undertow, Netty).
- No deploying a WAR into a shared application server.
- The port is configurable via env (`SERVER_PORT`, `PORT`).

**Anti-patterns**

- A single shared Tomcat with dozens of WARs — deployment coupling.
- Assuming port 8080 is always free — make it configurable.

**Spring Boot practice**

- Embedded Tomcat by default. `server.port=${PORT:8080}`.
- Health on a separate management port (`management.server.port`) for operational isolation.

```yaml
server:
  port: ${PORT:8080}
management:
  server:
    port: ${MANAGEMENT_PORT:8081}
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
```

## VIII. Concurrency — Scale out via the process model

**Factor:** Scale by adding more **processes**, not by making one process bigger.

**Rules**

- Horizontal scaling is the default; vertical scaling is the exception.
- Processes are independent and interchangeable — the "share nothing" model from Factor VI.
- Work can be distributed via a queue (for background jobs) or a load balancer (for HTTP).

**Anti-patterns**

- Thread pools so large one process eats the whole machine.
- In-memory queues that can't grow beyond one instance.
- Making a single instance "the leader" for everything.

**Spring Boot practice**

- **HTTP:** stateless pods behind a load balancer / Kubernetes Service.
- **Background work:** consume from Kafka/RabbitMQ/SQS; scale consumer group members.
- **Virtual threads (Java 21):** `spring.threads.virtual.enabled=true` — massive concurrency without proportional threads.
- **Autoscale** on CPU, latency, or queue depth.

```yaml
# Kubernetes HPA — scale on CPU
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orders
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## IX. Disposability — Maximize robustness with fast startup and graceful shutdown

**Factor:** Processes start quickly and shut down gracefully.

**Startup**

- Fast boot (< 10s for typical services) enables rapid scaling and rolling deploys.
- Avoid blocking startup on external dependencies unless strictly necessary.
- Readiness probe flips only when the app can serve traffic.

**Shutdown**

- Handle `SIGTERM`: stop accepting new work, finish in-flight requests, close resources.
- Drain time bounded by Kubernetes' `terminationGracePeriodSeconds`.
- Don't exit on in-flight requests — that's a user-visible 5xx.

**Anti-patterns**

- Long migration scripts run at every startup, blocking readiness.
- Ignoring `SIGTERM` and being killed hard after the grace period.
- Fire-and-forget writes that lose data on shutdown.

**Spring Boot practice**

- Graceful shutdown built in: `server.shutdown=graceful`.
- `spring.lifecycle.timeout-per-shutdown-phase` bounds the drain.
- Readiness probe uses `/actuator/health/readiness` (Spring Boot 3).

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

```yaml
# Kubernetes — give the app time to drain
terminationGracePeriodSeconds: 40
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 5"]  # let LB deregister first
```

## X. Dev/Prod Parity — Keep development, staging, and production as similar as possible

**Factor:** Minimize the gap between environments.

Three gaps to close:

- **Time gap** — developer writes code, ops deploys it months later. Fix: continuous deployment.
- **Personnel gap** — developer writes, ops deploys. Fix: DevOps culture.
- **Tools gap** — Postgres in prod, H2 in dev; Redis in prod, in-memory cache in dev. Fix: run the same tools locally (Docker Compose, Testcontainers).

**Rules**

- Same OS, same DB engine, same message broker, same JDK across environments.
- Use containers or Testcontainers to run production-like infra locally.
- Feature flags (not divergent code branches) gate unfinished work.

**Anti-patterns**

- H2 in tests, PostgreSQL in prod. SQL behaves differently; bugs slip through.
- SQLite locally, PostgreSQL in prod — same class of problem.
- "It works on my machine" — signal that parity is broken.

**Spring Boot practice**

- Docker Compose for local dev with Postgres, Redis, Kafka, and any other dependency.
- Testcontainers for tests — same image, same version, same behaviour.

```yaml
# docker-compose.yml — the developer's local stack mirrors prod
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    ports: ["9092:9092"]
```

## XI. Logs — Treat logs as event streams

**Factor:** The app writes logs to **stdout/stderr** and does not manage log files, rotation, or shipping. The execution environment collects and routes them.

**Rules**

- Log to stdout/stderr, unbuffered.
- No writing to `/var/log/myapp.log` from the app.
- Structured logging (JSON) where the environment can parse it.
- Include correlation/trace IDs — logs are one third of observability.

**Anti-patterns**

- Log files rotated by the app's own `logback.xml`.
- Multiple log files per process based on severity.
- Unstructured logs that break parsing pipelines.
- PII or secrets in logs.

**Spring Boot practice**

- Default `logback-spring.xml` writes to console.
- Structured JSON via `logstash-logback-encoder` or Boot 3.4+ built-in JSON logging (`logging.structured.format.console=ecs`).
- MDC + Micrometer Tracing to inject `traceId`, `spanId` into every line.

```xml
<!-- logback-spring.xml — console only, JSON when profile=prod -->
<configuration>
  <springProfile name="!prod">
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
      <encoder>
        <pattern>%d{HH:mm:ss.SSS} %-5level [%X{traceId:-}] %logger{36} - %msg%n</pattern>
      </encoder>
    </appender>
    <root level="INFO"><appender-ref ref="CONSOLE"/></root>
  </springProfile>

  <springProfile name="prod">
    <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
      <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
    </appender>
    <root level="INFO"><appender-ref ref="JSON"/></root>
  </springProfile>
</configuration>
```

## XII. Admin Processes — Run admin/management tasks as one-off processes

**Factor:** Admin tasks (migrations, one-off scripts, consoles) run as **one-off processes** in the same environment, using the same code and config as the running app.

**Rules**

- Migrations, backfills, and ad-hoc scripts run in the same image with the same config.
- Never hand-run SQL against prod.
- Repeated admin tasks become scripts, then scheduled jobs, then first-class features.

**Anti-patterns**

- SSH into the prod server to run a script from a developer laptop.
- Running migrations from an ad-hoc container built separately from the app image.
- Long-running admin processes blocking deploy.

**Spring Boot practice**

- Flyway / Liquibase migrations run at startup (with a controlled flag) or as a one-off container running the same image with a different command.
- Spring Shell or CLI runners for admin tasks.

```java
@Component
public class BackfillOrdersRunner implements CommandLineRunner {

    private final OrderBackfill backfill;

    public BackfillOrdersRunner(OrderBackfill backfill) { this.backfill = backfill; }

    @Override public void run(String... args) {
        if (args.length > 0 && args[0].equals("backfill-orders")) {
            backfill.run();
        }
    }
}
```

```bash
# Run the admin process in the same image as production
kubectl run orders-backfill \
  --image=registry/orders:1.4.2 \
  --restart=Never \
  --env-from=configmap/orders-config \
  --env-from=secret/orders-secrets \
  -- backfill-orders
```

## Summary Table

| # | Factor | Core rule | Common violation |
|---|---|---|---|
| I | Codebase | One repo, many deploys | Env-specific branches |
| II | Dependencies | Declared + isolated | System-wide packages |
| III | Config | In the environment | Bundled `application-prod.yml` with secrets |
| IV | Backing Services | Attached resources | Hardcoded `localhost:5432` |
| V | Build / Release / Run | Strict separation | Editing files on prod |
| VI | Processes | Stateless | Local filesystem as DB |
| VII | Port Binding | Self-contained | WAR into shared Tomcat |
| VIII | Concurrency | Scale out | Huge thread pools |
| IX | Disposability | Fast start, graceful stop | Ignoring `SIGTERM` |
| X | Dev / Prod Parity | Same tools everywhere | H2 in tests, Postgres in prod |
| XI | Logs | Event streams to stdout | Log files rotated in-app |
| XII | Admin Processes | One-off in same env | SSH + local scripts |

## Tricky Corners ⚠️

- **Factor III is often confused with "use a config file".** The point is *external to the artifact*, not *in a separate file inside the jar*.
- **Factor VI does not mean "no state anywhere"** — it means no state *inside the process*. State belongs in backing services.
- **Factor VIII ≠ Kubernetes.** You can satisfy it with a plain autoscaling group. Kubernetes just makes it easier.
- **Factor IX and readiness probes are linked.** A readiness probe that never flips green is the same as a startup failure.
- **Factor X and Testcontainers** are how you actually close the tools gap. Don't hand-wave "we use Docker".
- **Factor XI means stdout, not stdout *and* a file.** Pick one stream.
- **Factor XII and migrations** — running migrations as a startup hook is fine if it's fast and idempotent. If it's slow, run as a separate job before the rollout.
- **Twelve-Factor is not a security framework.** It says nothing about auth, secrets at rest, or network policies. Combine with `security/index.md` for a complete picture.

## Common Pitfalls

- Treating the factors as a checklist rather than a lens on operational pain.
- Enforcing Factor III but shipping secrets in a ConfigMap that lives in git.
- Confusing "containerized" with "twelve-factor". Containers help; they don't guarantee any of the factors.
- Skipping Factor X because "we use Testcontainers" — parity includes JDK, OS, and config, not just infra.
- Running admin processes from developer laptops against production.
- Writing logs to files, then wondering why aggregation is broken.
- Scaling vertically to fix concurrency and calling it scaling.
- Ignoring graceful shutdown, then blaming the load balancer for 502s.

## Key Interview Tips

- **Say the twelve factors quickly** — one phrase each — then go deep on two or three.
- **Pair Factor III with Vault/KMS.** "Config in env" must be paired with "secrets in a secret manager".
- **Factor VI → Spring Session + Redis.** Concrete and memorable.
- **Factor IX → graceful shutdown config.** Mention `server.shutdown=graceful`.
- **Factor X → Testcontainers.** The most direct answer.
- **Factor XI → JSON structured logs.** Mention MDC + traceId.
- **Factor XII → admin tasks in the same image.** Not a laptop script.
- **Tie the factors to Kubernetes** — readiness, liveness, HPA, `terminationGracePeriodSeconds`, ConfigMaps/Secrets. Interviewers love the mapping.
- **Note when to deviate:** stateful workloads (databases, message brokers) do not follow all twelve factors. That's fine — they're not apps in this sense.

## Related

- [API-First Design](api-first.md)
- [HTTP Methods](http-methods.md)
- [Domain-Driven Design](domain-driven-design.md)
- [Cloud Service Models](../cloud/service-models.md)
- [Observability](../observability/index.md)