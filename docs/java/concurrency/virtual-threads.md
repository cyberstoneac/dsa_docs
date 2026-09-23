# Virtual Threads

> **JDK context:** Virtual threads were previewed in Java 19 and 20, and
> **standardized in Java 21** (JEP 444). Structured concurrency is still in
> preview. This file assumes Java 21.

## Mental Model

A **virtual thread** is a lightweight thread scheduled by the JVM, not the OS.
The JVM multiplexes many virtual threads onto a small pool of **carrier
threads** (platform threads).

```d2
direction: down

vthreads: "10,000 Virtual Threads" {
  style.fill: "#e3f2fd"
  desc: "Cheap (~few hundred bytes)\nCreated by millions\nBlocked freely"
}

scheduler: "Virtual Thread Scheduler" {
  style.fill: "#c8e6c9"
  desc: "Maps VTs onto carriers\nForkJoinPool-based"
}

carriers: "Carrier Threads (Platform)" {
  style.fill: "#ffe0b2"
  desc: "~Number of CPU cores\nActually run on OS"
}

cpu: "CPU cores" {
  style.fill: "#f8bbd0"
}

vthreads.scheduler -> scheduler: "park/unpark"
scheduler.carriers -> carriers: "mount"
carriers.cpu -> cpu: "run"
```

**Key idea:** platform threads are expensive (1MB stack, OS-managed).
Virtual threads are cheap (KBs, JVM-managed). You can have millions.

---

## Why Virtual Threads Exist

The classic problem: **thread-per-request** servers block on I/O, wasting an
OS thread per connection.

```java
// Traditional server — 1 platform thread per connection
try (ServerSocket server = new ServerSocket(8080)) {
    while (true) {
        Socket client = server.accept();
        new Thread(() -> handle(client)).start();   // ~1MB stack each
    }
}
```

At 10K connections, that's 10GB of stacks. The OS struggles with context
switches.

**Solutions before virtual threads:**

- **Async/reactive** (Netty, Vert.x) — scalable but callback-heavy and hard to debug
- **Larger thread pools** — bounded by hardware

**Virtual threads** give you the simplicity of blocking code with the
scalability of async.

---

## Creating Virtual Threads

### `Thread.ofVirtual()`

```java
Thread vthread = Thread.ofVirtual()
        .name("worker")
        .start(() -> {
            System.out.println("Running on " + Thread.currentThread());
        });

vthread.join();
```

### `Thread.startVirtualThread()` — shortcut

```java
Thread.startVirtualThread(() -> System.out.println("hi"));
```

### `Executors.newVirtualThreadPerTaskExecutor()` — the recommended way

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i -> {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        });
    });
}   // waits for all tasks, shuts down
```

**10,000 concurrent tasks** — the traditional thread-per-task would use 10GB
of stacks; virtual threads use a few MB.

---

## How They Work

### Mount / Unmount

1. Virtual thread is **mounted** on a carrier thread to run
2. When it blocks (I/O, `sleep`, `park`, lock), it's **unmounted** — the
   carrier is free to run another virtual thread
3. When the blocking operation completes, the virtual thread is scheduled
   to a carrier again

```d2
direction: right

v1: "VT 1\nrunning" {
  style.fill: "#c8e6c9"
}
v2: "VT 2\nblocked" {
  style.fill: "#fff9c4"
}
v3: "VT 3\nblocked" {
  style.fill: "#fff9c4"
}

carrier: "Carrier Thread" {
  style.fill: "#bbdefb"
}
cpu: "CPU core" {
  style.fill: "#f8bbd0"
}

v1.carrier -> carrier: "mounted"
carrier.cpu -> cpu: "executes"
```

When VT 1 blocks, the carrier unmounts it and picks another runnable VT.

### Scheduler

The default scheduler is a `ForkJoinPool` with parallelism = number of CPU
cores. You can provide a custom one, but it's rarely needed.

### Memory

- **Platform thread:** ~512KB–1MB stack (reserved)
- **Virtual thread:** a few hundred bytes initially, grows as needed

Virtual thread stacks live on the heap, not the OS. This is why they can
be garbage-collected like any other object.

---

## What About Blocking?

Virtual threads **block cheaply**. When they block on:

- `Thread.sleep`
- `Socket`/`ServerSocket` I/O
- `BlockingQueue` operations
- `Future.get`
- `LockSupport.park`
- `java.net.http.HttpClient`

...the JVM unmounts them from the carrier. The carrier runs other virtual
threads.

### Old blocking APIs work fine

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> {
        // Synchronous, blocking — but "free"
        String html = new URL("https://example.com").openStream()...;
        return parse(html);
    });
}
```

No need for reactive frameworks. Write plain blocking code; the JVM handles
the scaling.

---

## Pinning — The Key Gotcha

A virtual thread is **pinned** to its carrier thread when:

1. It's inside a `synchronized` block that blocks
2. It calls a native method (JNI) that blocks

While pinned, the carrier cannot run other virtual threads — the whole point
is defeated.

### Bad example

```java
// Synchronized + blocking = pinned
synchronized (lock) {
    Thread.sleep(1000);   // blocks the carrier!
}
```

If a `synchronized` block performs a blocking operation, the carrier is stuck.
With many virtual threads hitting the same lock, throughput collapses.

### Good example

```java
// ReentrantLock doesn't pin
lock.lock();
try {
    Thread.sleep(1000);   // carrier is freed
} finally {
    lock.unlock();
}
```

`ReentrantLock` is virtual-thread-friendly. `synchronized` is not (as of
Java 21).

### Detecting pinning

```bash
-Djdk.tracePinnedThreads=full
```

Logs when a virtual thread is pinned. Use during development, not in
production (high overhead).

**Java 24+** plans to remove the `synchronized` pinning limitation — check
your JDK version.

### Rule for virtual threads

- **Avoid `synchronized`** around blocking calls
- **Prefer `ReentrantLock`** where possible
- Audit third-party libraries — old code often uses `synchronized`

---

## When to Use Virtual Threads

| Use case | Virtual threads? |
|---|---|
| HTTP server with many concurrent requests | ✅ Ideal |
| Database queries (JDBC) | ✅ Ideal |
| Blocking I/O (files, sockets) | ✅ Ideal |
| Parallel RPC calls | ✅ Ideal |
| CPU-bound computation | ❌ Use platform threads or parallel streams |
| Very short tasks | ⚠️ Overhead may not pay off |
| Heavy JNI/native calls | ❌ Pinning |

**Rule of thumb:** virtual threads help when tasks spend most of their time
**blocked on I/O**. They don't help CPU-bound work — CPU is already saturated.

### Don't pool virtual threads

Virtual threads are cheap to create and destroy. **Don't pool them** the way
you pool platform threads.

```java
// WRONG — pooling virtual threads
ExecutorService pool = Executors.newFixedThreadPool(100,
        Thread.ofVirtual().factory());

// RIGHT — one virtual thread per task
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
```

### Don't use thread locals heavily

Virtual threads are created per task. `ThreadLocal` values live as long as
the virtual thread. Creating a million virtual threads with a `ThreadLocal`
holding 1KB each = 1GB wasted.

Use **scoped values** (Java 20+ preview) or pass state explicitly.

---

## Scoped Values (Preview)

A modern alternative to `ThreadLocal` for the virtual-thread era:

```java
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.runWhere(CURRENT_USER, user, () -> {
    handleRequest();   // CURRENT_USER.get() returns `user`
});
```

Scoped values:
- Are immutable
- Are automatically inherited by child virtual threads
- Are automatically cleaned up at scope exit
- Are more efficient than `ThreadLocal` (no map per thread)

**Status:** Preview in Java 21, stabilizing in later releases.

---

## Structured Concurrency (Preview)

A way to manage multiple concurrent tasks as a single unit.

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User> userTask = scope.fork(() -> fetchUser(userId));
    Subtask<Order> orderTask = scope.fork(() -> fetchOrder(orderId));

    scope.join();              // wait for both
    scope.throwIfFailed();     // propagate failures

    return new Response(userTask.get(), orderTask.get());
}
// On any failure, remaining tasks are cancelled automatically
```

### Key benefits

- **Cancellation propagation** — if one task fails, siblings are cancelled
- **Clear lifetimes** — child tasks can't outlive the scope
- **Error handling** — exceptions propagate predictably

### `ShutdownOnFailure` vs `ShutdownOnSuccess`

- `ShutdownOnFailure` — cancel all if any fails
- `ShutdownOnSuccess` — cancel all as soon as one succeeds

### Status

Preview in Java 21. API may change.

---

## Migration from Thread Pools

### Before

```java
ExecutorService executor = Executors.newFixedThreadPool(200);

for (Request req : requests) {
    executor.submit(() -> handle(req));
}

executor.shutdown();
```

### After

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Request req : requests) {
        executor.submit(() -> handle(req));
    }
}
```

Two changes:
1. Replace `newFixedThreadPool(200)` with `newVirtualThreadPerTaskExecutor()`
2. Use try-with-resources (the executor is `AutoCloseable` since Java 19)

Everything else stays the same. **This is the killer feature** — no rewrite
to async/reactive required.

---

## Limits and Caveats

### Not faster, just more scalable

A single virtual thread is **slower** than a single platform thread (there's
scheduling overhead). Virtual threads win when you have thousands of
concurrent blocking tasks.

### CPU-bound work

Virtual threads don't help. `parallelStream()`, `ForkJoinPool`, or a
platform thread pool sized to core count is better for CPU-bound tasks.

### Don't replace all thread pools

- **I/O-bound** — virtual threads win
- **CPU-bound** — platform threads + sized pool
- **Existing pools with tuned behavior** — may not benefit

### Blocking carriers via `synchronized`

Covered above — the biggest practical issue. Watch for `synchronized`
libraries.

### Debugging

Stack traces for virtual threads work, but thread dumps are huge if you have
a million threads. `jcmd <pid> Thread.dump_to_file -format=json` produces a
machine-readable dump.

`ThreadMXBean` for virtual threads is different — virtual threads are not
enumerated the same way. Tools are still maturing.

---

## Summary Table

| Aspect | Platform Thread | Virtual Thread |
|---|---|---|
| Created by | OS | JVM |
| Stack | ~1MB | Few hundred bytes |
| Creation cost | ~1ms | ~1µs |
| Max count | Thousands | Millions |
| Blocking | Blocks OS thread | Unmounts from carrier |
| Pooled? | Yes (recommended) | No |
| Good for | CPU-bound | I/O-bound |
| Pinning risk | N/A | `synchronized` + blocking |
| Java version | 1.0 | 21 (standard) |

---

## Tricky Corners ⚠️

**`synchronized` + blocking = pinned.** Prefer `ReentrantLock`.

**Don't pool virtual threads.** Create one per task.

**Virtual threads are not faster for CPU-bound work.** They're for scaling
I/O.

**`ThreadLocal` can bloat memory** if you have millions of virtual threads.

**`Thread.currentThread()` inside a virtual thread returns the virtual
thread**, not the carrier.

**`Thread.ofVirtual().unstarted(r)`** returns an unstarted thread — must
call `start()`.

**Virtual threads inherit `InheritableThreadLocal`** by default, but the
inheritance happens at creation. Mutable state shared this way is a footgun.

**Pinning via native (JNI) calls** also blocks the carrier. Audit any native
code in the hot path.

**Interrupting a virtual thread is the same as for platform threads.**
Cooperative.

**Thread dump size** can explode with millions of virtual threads. Use
filtered or JSON dumps.

**`Thread.getAllStackTraces()`** doesn't include virtual threads. Use
`ThreadMXBean.dumpAllThreads` with the right options.

---

## Common Pitfalls

- Using virtual threads for CPU-bound work.
- Pooling virtual threads.
- Heavy `ThreadLocal` usage in per-task virtual threads.
- `synchronized` + blocking causing pinning.
- Assuming virtual threads are always faster than platform threads.
- Not using structured concurrency for multi-task operations.
- Forgetting that blocking APIs (JDBC, file I/O) work fine with virtual threads — no need for reactive frameworks.

---

## Key Interview Tips

- Explain the mount/unmount mechanism in one sentence.
- Give the pinning example with `synchronized` — it's the #1 gotcha.
- Say "use `ReentrantLock` instead of `synchronized` around blocking calls."
- Recommend `Executors.newVirtualThreadPerTaskExecutor()` as the migration path.
- Know that CPU-bound work doesn't benefit from virtual threads.
- Mention structured concurrency as the future of concurrent task management.
- Don't pool virtual threads — one per task.

---

## Related

- [Threads Basics](threads-basics.md) — the platform thread model
- [Executors & Futures](executors-and-futures.md) — the executor hierarchy
- [Synchronization](synchronization.md) — locks and pinning
- [Streams & Functional](../collections/streams-and-functional.md) — CPU-bound alternative