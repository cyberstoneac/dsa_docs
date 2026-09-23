# Dockerfile & JVM

> **Context:** This file is the JVM-specific deep dive on Docker: memory, GC, startup, native images, and the Dockerfile patterns that work in production. At lead level, you should be able to reason about why a JVM container OOMs, why startup takes 20 seconds, and when native image is worth the trade.

## The JVM + Container Mental Model

The JVM sees two memory numbers:



1. **Physical host memory** — the actual machine.
2. **Container memory limit** — the cgroup limit.

Since JDK 10, `-XX:+UseContainerSupport` (default) makes the JVM respect cgroup limits. **But only if you configure heap sizing correctly.**

```d2
direction: right

limit: "Container Limit\\n(1 GiB)"
heap: "Java Heap\\n(750 MiB with 75%)"
overhead: "JVM Overhead\\n(metaspace, threads, code cache, direct buffers)\\n(~250 MiB)"
container: "Container RSS\\n(= heap + overhead)"

limit -> heap
limit -> overhead
heap -> container
overhead -> container
```

**Rule:** container memory = heap + JVM overhead. Plan for 25–40% overhead.

## Heap Sizing

| Approach | Example | When |
|---|---|---|
| `-Xmx512m` | Fixed heap | Bare metal, known workloads |
| `-XX:MaxRAMPercentage=75` | 75% of container memory | Containers |
| `-XX:InitialRAMPercentage=50` | Initial heap | Faster startup |
| `-XshowSettings:vm` | Print effective settings | Debugging |

**Rules:**

- **Never use `-Xmx` in containers.** It doesn't adjust when the container size changes.
- **Use `-XX:MaxRAMPercentage=75`** — leaves 25% for overhead.
- For memory-constrained environments, 75% is aggressive; 60–70% is safer.
- For large heaps (>4 GB), 75% is usually fine.

```dockerfile
ENTRYPOINT ["java", \
  "-XX:MaxRAMPercentage=75", \
  "-XX:InitialRAMPercentage=50", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-XX:+HeapDumpOnOutOfMemoryError", \
  "-XX:HeapDumpPath=/dumps", \
  "-jar", "app.jar"]
```

**Rule:** `-XX:+ExitOnOutOfMemoryError` causes the container to exit cleanly instead of limping.

## JVM Overhead

Non-heap memory can be substantial:

| Region | Typical size |
|---|---|
| Metaspace | 50–200 MB |
| Thread stacks | ~1 MB per thread (10k threads = 10 GB!) |
| Code cache | 50–250 MB |
| Direct buffers (NIO) | Depends on usage |
| GC structures | Proportional to heap |

**Rule:** if your container OOMs but the heap looks fine, you're hitting non-heap memory. Check thread count and direct buffers.

## GC Choice

| GC | Best for | Latency |
|---|---|---|
| **Serial** | Small heaps, single-core | High pause |
| **Parallel** | Throughput, batch | Higher pause |
| **G1** (default) | Balanced, most workloads | Predictable |
| **ZGC** | Low-latency, large heaps | <1ms pauses |
| **Shenandoah** | Low-latency alternative | <10ms pauses |

**Rules:**

- **Default to G1.** It's the default for a reason.
- **ZGC for p99-sensitive services.** Available in production since JDK 15, generational in 21.
- **Parallel for batch/throughput.**
- Always measure before tuning.

```dockerfile
ENTRYPOINT ["java", \
  "-XX:MaxRAMPercentage=75", \
  "-XX:+UseZGC", \
  "-XX:+ZGenerational", \
  "-jar", "app.jar"]
```

## Startup Time

JVM startup involves:
1. JVM boot (~100ms)
2. Class loading (~1–3s for Spring Boot)
3. Spring context init (~1–5s)
4. JIT warmup (seconds to minutes for peak throughput)

**Total cold start:** 2–10s for a typical Spring Boot app.

### Reducing startup

| Technique | Effect |
|---|---|
| AppCDS (Application Class Data Sharing) | -20–40% startup |
| Spring Boot lazy init | -20–30% startup |
| Remove unused dependencies | Smaller classpath |
| jlink custom runtime | Smaller image |
| GraalVM native image | ~50ms startup |
| CRaC (Coordinated Restore at Checkpoint) | ~100ms restore |

**Rule:** for K8s, startup should be under the readiness probe threshold; for serverless, native image is often required.

## Native Image (GraalVM)

Compile the JVM app to a native binary.

| Aspect | JVM | Native |
|---|---|---|
| Startup | 2–10s | ~50ms |
| Memory | 200–500 MB | 20–100 MB |
| Peak throughput | High (JIT) | Lower initially |
| Build time | Fast | Slow (minutes) |
| Reflection | Free | Must configure |
| Dynamic proxies | Free | Must configure |
| Libraries | Any | Must be native-compatible |
| Debugging | Mature | Harder |

**Spring Boot 3 + GraalVM:** `native-maven-plugin` or `bootBuildImage` with `BP_NATIVE_IMAGE=true`. Many Spring libraries are supported; some (dynamic proxies, reflection-heavy) require hints.

**When to use:** serverless, CLI tools, short-lived containers, aggressive scale-to-zero.

**When not to use:** CPU-bound long-running services (JIT wins), libraries without native support.

## Dockerfile Patterns

### Pattern 1: Layered Spring Boot (best for JVM)

```dockerfile
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --chown=app:app build/libs/app.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+UseZGC", "-jar", "app.jar"]
```

Spring Boot's layered JAR lets you cache dependencies separately:

```dockerfile
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
COPY --chown=app:app build/libs/app.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract
USER app
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

Better: use Spring Boot's built-in layering via `bootBuildImage` (Buildpacks) or `jib`.

### Pattern 2: Buildpacks (no Dockerfile)

```bash
./gradlew bootBuildImage --imageName=registry/orders:1.4.2
```

Buildpacks detect the app type and build a layered image. Good defaults, less control.

### Pattern 3: Jib (no Docker daemon)

Jib builds images from Gradle/Maven without a Dockerfile or daemon. Reproducible, fast.

```groovy
jib {
  from { image = 'eclipse-temurin:21-jre' }
  to { image = 'registry/orders' }
  container {
    jvmFlags = ['-XX:MaxRAMPercentage=75', '-XX:+UseZGC']
    mainClass = 'com.example.Application'
    user = '1000'
  }
}
```

### Pattern 4: Multi-stage (any language)

```dockerfile
FROM gradle:8-jdk21 AS build
WORKDIR /src
COPY build.gradle settings.gradle ./
COPY src ./src
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /src/build/libs/app.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

## Signals and Shutdown

```dockerfile
# BAD — shell form; SIGTERM goes to shell, not java
CMD java -jar app.jar

# GOOD — exec form; SIGTERM goes to java
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Spring Boot graceful shutdown:

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

K8s:

```yaml
terminationGracePeriodSeconds: 60
```

**Rule:** `terminationGracePeriodSeconds` > longest in-flight request + shutdown hook time.

## Debugging JVM Containers

| Task | Command |
|---|---|
| JVM effective memory | `java -XshowSettings:vm -version` |
| Heap dump on OOM | `-XX:+HeapDumpOnOutOfMemoryError` |
| Thread dump | `jstack <pid>` |
| Live heap | `jcmd <pid> GC.heap_info` |
| GC logs | `-Xlog:gc*:file=/logs/gc.log` |
| JMX remote | `-Dcom.sun.management.jmxremote` (careful) |

**Rules:**

- Don't bake debug flags into prod images.
- Use sidecars or ephemeral containers for debugging.
- Enable GC logs in prod (low overhead, high value).

## Tricky Corners ⚠️

- **`-Xmx` in containers doesn't adapt.** Use `MaxRAMPercentage`.
- **JVM overhead is 25–40%** of heap, not 10%.
- **Thread stacks add up.** 1 MB × 10k threads = 10 GB.
- **Direct buffers don't show in heap** — they show in RSS.
- **`ExitOnOutOfMemoryError` exits cleanly** — good for K8s restarts.
- **Shell form ENTRYPOINT breaks SIGTERM.**
- **Native images break on reflection-heavy libraries** unless hints are added.
- **ZGC is generational only in JDK 21+.** Non-generational has higher memory overhead.
- **AppCDS is underrated** — 20–40% startup improvement for free.
- **CRaC is promising but ecosystem support is still growing.**
- **GC logs are cheap and invaluable.** Enable them.
- **`jcmd` needs the same JVM version as the running process** — use the container's JDK.

## Common Pitfalls

- `-Xmx` in containers.
- `MaxRAMPercentage` at 90% (OOM risk).
- Ignoring thread stacks.
- Shell form ENTRYPOINT.
- No heap dump on OOM.
- No GC logs.
- Full JDK in runtime.
- Root user.
- Native image for CPU-bound services.
- No graceful shutdown.

## Key Interview Tips

- Lead with **"container memory = heap + JVM overhead; plan for 25–40% overhead."**
- For "how do you configure JVM memory?", answer **"MaxRAMPercentage=75, never -Xmx in containers, leave 25% for overhead."**
- For "how do you reduce startup?", answer **"AppCDS, lazy init, smaller classpath, or native image for serverless."**
- For "when native image?", answer **"serverless/CLI/short-lived containers; not CPU-bound long-running services."**
- For "how do you handle graceful shutdown?", answer **"exec form ENTRYPOINT + SIGTERM + Spring graceful shutdown + terminationGracePeriodSeconds."**
- For "how do you debug an OOMKilled JVM?", answer **"heap dump on OOM, GC logs, check thread count and direct buffers for non-heap memory."**
- Always mention **ZGC for latency** and **G1 as default**.
- Always mention **signal handling** — it's the most-missed JVM-in-container detail.

## Related

- [Docker index](index.md)
- [Docker](docker.md)
- [Kubernetes](../kubernetes/index.md)
- [Kubernetes Production Essentials](../kubernetes/production-essentials.md)