# Docker

> **Context:** At lead level, Docker knowledge is awareness-level: you understand images, layers, and the JVM in containers. This section covers the mental model, key concepts, and the JVM-specific concerns that matter in interviews and production.

## Mental Model

A Docker image is a **stack of immutable layers**, built from a Dockerfile. A container is a **running instance** of that image, isolated by namespaces and cgroups.

```d2
direction: right

dockerfile: "Dockerfile"
base: "base image\n(e.g. eclipse-temurin)"
deps: "dependencies"
app: "app code"
image: "Image\n(immutable, layered)"
container: "Container\n(running instance)"

dockerfile -> base
base -> deps
deps -> app
app -> image
image -> container
```

**Rule:** layers are cached and shared. Order them so the most stable layers come first.

## Image, Container, Registry

| Term | Meaning |
|---|---|
| **Image** | Immutable, layered filesystem + metadata |
| **Container** | Running instance of an image (writable layer on top) |
| **Registry** | Stores images (Docker Hub, ECR, GCR, Harbor) |
| **Tag** | Human-readable version (e.g., `1.4.2`) |
| **Digest** | Content hash (`sha256:...`), immutable |

**Rules:**
- **Tag for humans, digest for reproducibility.**
- Never use `latest` in production.
- Pin base images by digest in critical pipelines.

## Dockerfile Anatomy

```dockerfile
# 1. Base image
FROM eclipse-temurin:21-jre-alpine

# 2. Metadata
LABEL org.opencontainers.image.source="https://github.com/org/orders"

# 3. Working directory
WORKDIR /app

# 4. Non-root user (create early, use later)
RUN addgroup -S app && adduser -S app -G app

# 5. Copy dependencies first (cache-friendly)
COPY --chown=app:app build/libs/dependencies/ ./

# 6. Copy application code
COPY --chown=app:app build/libs/application/ ./

# 7. Switch to non-root
USER app

# 8. Expose port
EXPOSE 8080

# 9. Entry point
ENTRYPOINT ["java", \
  "-XX:MaxRAMPercentage=75", \
  "-XX:+UseZGC", \
  "-jar", "app.jar"]
```

**Rules:**
- Order instructions from least to most frequently changing.
- Combine `RUN` commands to reduce layers.
- Always use a non-root user in production.
- Pin base images to specific versions.
- Use `.dockerignore` to exclude unnecessary files.

## Layer Caching

Docker caches each layer. When a layer changes, all subsequent layers rebuild.

```d2
direction: right

l1: "Layer 1: base\\n(cached)"
l2: "Layer 2: deps\\n(cached)"
l3: "Layer 3: app code\\n(changes)"
l4: "Layer 4: config\\n(rebuilds)"

l1 -> l2
l2 -> l3
l3 -> l4
```

**Rule:** copy dependency manifests first, run install, then copy source. This keeps dependency layers cached across code changes.

## Multi-Stage Builds

```dockerfile
# Stage 1: build
FROM gradle:8-jdk21 AS build
WORKDIR /src
COPY build.gradle settings.gradle ./
COPY src ./src
RUN gradle bootJar --no-daemon

# Stage 2: runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /src/build/libs/app.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

**Benefits:**
- Final image contains only the JRE and app jar.
- Build tools (Gradle, JDK) not shipped.
- Smaller image → faster pulls, smaller attack surface.

## Image Size

| Approach | Size |
|---|---|
| `openjdk:21` (full) | ~500 MB |
| `eclipse-temurin:21-jre` | ~250 MB |
| `eclipse-temurin:21-jre-alpine` | ~180 MB |
| Distroless (JRE) | ~120 MB |
| Custom jlink runtime | ~60–80 MB |
| Native image (GraalVM) | ~50 MB (startup ~50ms) |

**Rules:**
- Prefer `-jre` over `-jdk` in runtime images.
- Alpine is small but uses musl; occasionally causes issues with native libs.
- Distroless is the smallest and most secure but has no shell (harder to debug).
- `jlink` custom runtime is the best JVM trade-off.
- Native images are for specific cases (CLI, serverless, fast startup).

## JVM in Containers

The JVM reads container memory limits only if configured correctly.

| Flag | Effect |
|---|---|
| `-XX:MaxRAMPercentage=75` | Heap = 75% of container memory |
| `-XX:InitialRAMPercentage=50` | Initial heap |
| `-XX:+UseContainerSupport` | Default since JDK 10; reads cgroup limits |
| `-XX:+UseZGC` | Low-latency GC (JDK 15+) |
| `-XX:+UseG1GC` | Default GC |
| `-XshowSettings:vm` | Print effective memory settings |

**Rules:**
- **Never set `-Xmx` in containers** — use `-XX:MaxRAMPercentage`.
- **Leave 25–40% of container memory** for JVM overhead (metaspace, threads, direct buffers, code cache).
- Set container memory limit → JVM computes heap from it.
- For latency-sensitive: ZGC (Java 15+) or G1 with tuning.
- For throughput: G1 or Parallel GC.
- For serverless: consider native image.

```yaml
# K8s pod spec
resources:
  requests: { memory: 1Gi, cpu: 500m }
  limits:   { memory: 1Gi }
env:
  - name: JAVA_TOOL_OPTIONS
    value: "-XX:MaxRAMPercentage=75 -XX:+UseZGC"
```

## Signals and Graceful Shutdown

| Signal | Meaning |
|---|---|
| `SIGTERM` | Please stop; finish in-flight work |
| `SIGKILL` | Stop now (can't be caught) |
| `SIGINT` | Ctrl-C |

**JVM behavior:**
- Java installs a shutdown hook for SIGTERM by default (runs shutdown hooks).
- Spring Boot's `server.shutdown=graceful` waits for in-flight requests to finish.
- Set `terminationGracePeriodSeconds` > max request duration.

```yaml
spec:
  terminationGracePeriodSeconds: 60
```

**Rule:** if `ENTRYPOINT` uses shell form (`CMD java -jar app.jar`), the shell may not forward SIGTERM. Use **exec form** (`ENTRYPOINT ["java", "-jar", "app.jar"]`).

## Health Checks in Containers

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health/liveness || exit 1
```

**Rules:**
- Docker `HEALTHCHECK` is different from K8s probes. K8s probes are preferred.
- In K8s, use `httpGet` probes, not shell commands.
- Startup probe for slow-booting apps.

## .dockerignore

```
.git
.gradle
build/
*.iml
.idea
target/
node_modules/
*.md
*.log
```

**Rule:** smaller context = faster build, smaller image.

## Security

- **Non-root user** (`USER app`).
- **Read-only root filesystem** where possible (`readOnlyRootFilesystem: true`).
- **No secrets in image** — use env vars from K8s secrets or Vault.
- **Pin base image versions** (not `latest`).
- **Scan images** in CI (Trivy, Snyk, Grype).
- **Minimal base images** (distroless, alpine, jlink).
- **No build tools in runtime image** (multi-stage).
- **Drop capabilities** (`--cap-drop=ALL`).
- **No privileged mode.**

## Registries

| Registry | Notes |
|---|---|
| Docker Hub | Public, rate-limited |
| ECR / GCR / ACR | Cloud-native, IAM integration |
| Harbor | Self-hosted, scanning, RBAC |
| GHCR | GitHub-native |

**Rules:**
- Use private registries for private code.
- Enable image scanning.
- Set retention policies for old images.
- Use image pull secrets in K8s.

## Anti-Patterns

- `latest` tags in production.
- Root user in container.
- Running as PID 1 without a proper init (`tini`, `dumb-init`).
- Secrets in Dockerfile.
- Full JDK in runtime image.
- `-Xmx` in containers (use `MaxRAMPercentage`).
- Shell form `ENTRYPOINT` that doesn't forward SIGTERM.
- Huge images (no multi-stage, no `.dockerignore`).

## Tricky Corners ⚠️

- **Container memory limits ≠ JVM heap.** JVM reads cgroup limits; set `MaxRAMPercentage`.
- **`-Xmx` in containers breaks on resizing.** Use percentages.
- **Shell form ENTRYPOINT breaks signal handling.** Use exec form.
- **Layers are cached by instruction order.** Put changing things last.
- **`latest` tags break reproducibility.**
- **Alpine musl can break native libs.** Test.
- **Distroless has no shell** — harder to debug.
- **PID 1 signal handling** — use `tini` if your app isn't signal-aware.
- **JVM warmup matters.** JIT, class loading take seconds. Spring Boot starts slower than native.
- **Native images have limitations** — reflection, dynamic proxies, some libraries don't work.
- **Image pull failures block pods.** Registry HA + pull secrets.

## Common Pitfalls

- Full JDK in production runtime.
- `-Xmx` in containers.
- Root user.
- Secrets in image.
- `latest` tag.
- No `.dockerignore`.
- No multi-stage build.
- Shell ENTRYPOINT.
- No health check.
- Ignoring JVM overhead in memory limits.

## Key Interview Tips

- Lead with **"images are layers; containers are instances; order layers for cache efficiency."**
- For "how do you make a small JVM image?", answer **"multi-stage build, `-jre` or distroless or jlink, non-root, `.dockerignore`."**
- For "how do you configure JVM in containers?", answer **"never `-Xmx`; use `MaxRAMPercentage`; leave 25–40% for JVM overhead; prefer ZGC for latency."**
- For "how do you handle graceful shutdown?", answer **"exec form ENTRYPOINT, `terminationGracePeriodSeconds`, Spring `server.shutdown=graceful`."**
- For "how do you secure images?", answer **"non-root, minimal base, no secrets, pin versions, scan in CI."**
- For "when native image?", answer **"serverless, CLI, fast startup — but reflection and library compatibility are constraints."**
- Always mention **signal handling** and **JVM memory** — these are the JVM-in-container essentials.

## Related

- [Docker index](index.md)
- [Dockerfile & JVM](dockerfile-and-jvm.md)
- [Kubernetes](../kubernetes/index.md)
- [Kubernetes Production Essentials](../kubernetes/production-essentials.md)