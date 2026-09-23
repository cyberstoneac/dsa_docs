# Executors & Futures

> **JDK context:** `ExecutorService`, `Future`, and the thread pool executors
> arrived in Java 5. `CompletableFuture` arrived in Java 8.
> `Executors.newVirtualThreadPerTaskExecutor()` arrived in Java 21.

## Mental Model

Spawning raw threads is wasteful — thread creation costs ~1ms and ~1MB of
stack. A thread pool reuses threads, amortizing cost.

```d2
direction: right

client: "Client tasks" {
  style.fill: "#e3f2fd"
}
queue: "Task Queue" {
  style.fill: "#fff9c4"
}
pool: "Worker Pool\n(fixed size)" {
  style.fill: "#c8e6c9"
}
threads: "Threads 1..N" {
  style.fill: "#a5d6a7"
}

client.queue -> queue: "submit()"
queue.pool -> pool: "takes"
pool.threads -> threads: "runs on"
```

**Three core abstractions:**

- **`Executor`** — a thing that runs tasks (the simplest interface)
- **`ExecutorService`** — an Executor with lifecycle + Future support
- **`Future<T>`** — a handle to a result that will be available later

---

## The `Executor` Hierarchy

```d2
direction: right

executor: Executor {
  style.fill: "#e3f2fd"
  desc: "execute(Runnable)"
}
es: ExecutorService {
  style.fill: "#bbdefb"
  desc: "submit, invokeAll, invokeAny,\nshutdown, awaitTermination"
}
ses: ScheduledExecutorService {
  style.fill: "#c8e6c9"
  desc: "schedule, scheduleAtFixedRate"
}

executor.es -> es: "extends"
es.ses -> ses: "extends"
```

---

## The Five Standard Executors

`Executors` provides factory methods for common pools.

### 1. `newFixedThreadPool(n)`

Fixed `n` threads. Unbounded task queue.

```java
ExecutorService executor = Executors.newFixedThreadPool(4);
```

- Threads stay alive (core = max = n)
- Queue is unbounded — can grow until OOM
- Best when you want bounded concurrency with predictable thread count

### 2. `newCachedThreadPool()`

Creates threads on demand, reuses idle ones for 60s.

```java
ExecutorService executor = Executors.newCachedThreadPool();
```

- Unbounded thread count
- Reuses idle threads
- Best for short-lived, bursty tasks
- Risk: unbounded thread creation if tasks keep coming

### 3. `newSingleThreadExecutor()`

One thread. Tasks run sequentially in submission order.

```java
ExecutorService executor = Executors.newSingleThreadExecutor();
```

- Guarantees ordering
- Great for serializing access to a single resource

### 4. `newScheduledThreadPool(n)`

For delayed or periodic tasks.

```java
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

// Run once after 5 seconds
scheduler.schedule(task, 5, TimeUnit.SECONDS);

// Run every 10 seconds, starting after 1 second
scheduler.scheduleAtFixedRate(task, 1, 10, TimeUnit.SECONDS);

// Run with fixed delay between completions
scheduler.scheduleWithFixedDelay(task, 1, 10, TimeUnit.SECONDS);
```

**Difference:**

- **`scheduleAtFixedRate`** — periodic based on start time (may overlap if tasks are slow)
- **`scheduleWithFixedDelay`** — periodic based on end time (never overlaps)

### 5. `newWorkStealingPool()` (Java 8+) and `newVirtualThreadPerTaskExecutor()` (Java 21)

```java
ExecutorService pool = Executors.newWorkStealingPool();
// Uses ForkJoinPool internally — good for CPU-bound recursive tasks

ExecutorService vThreads = Executors.newVirtualThreadPerTaskExecutor();
// One virtual thread per task — for I/O-bound workloads
```

See [Virtual Threads](virtual-threads.md).

### Which to choose?

| Scenario | Executor |
|---|---|
| Bounded concurrency, general use | `newFixedThreadPool(n)` |
| Short-lived bursty tasks | `newCachedThreadPool()` |
| Serialize to one resource | `newSingleThreadExecutor()` |
| Delayed/periodic | `newScheduledThreadPool(n)` |
| CPU-bound recursive | `newWorkStealingPool()` |
| I/O-bound massive concurrency | `newVirtualThreadPerTaskExecutor()` |

**Note:** the standard factory methods use **unbounded queues** (except
`newCachedThreadPool`). For production, prefer a `ThreadPoolExecutor`
constructor with explicit bounds.

---

## The `ThreadPoolExecutor` Constructor

For fine-grained control, skip the factories:

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
        4,                              // corePoolSize
        8,                              // maximumPoolSize
        60L, TimeUnit.SECONDS,          // keepAliveTime
        new ArrayBlockingQueue<>(100),  // workQueue (bounded!)
        new ThreadFactory() {           // thread factory
            private final AtomicInteger n = new AtomicInteger();
            public Thread newThread(Runnable r) {
                Thread t = new Thread(r, "worker-" + n.incrementAndGet());
                t.setDaemon(false);
                return t;
            }
        },
        new ThreadPoolExecutor.CallerRunsPolicy()   // rejection handler
);
```

### Parameters

| Parameter | Meaning |
|---|---|
| `corePoolSize` | Threads kept alive even when idle |
| `maximumPoolSize` | Upper bound on threads |
| `keepAliveTime` | Idle time before non-core threads die |
| `workQueue` | Queue for pending tasks |
| `threadFactory` | How to create threads |
| `rejectionHandler` | What to do when queue + pool are full |

### Rejection policies

| Policy | Behavior |
|---|---|
| `AbortPolicy` (default) | Throw `RejectedExecutionException` |
| `CallerRunsPolicy` | Run the task on the submitting thread |
| `DiscardPolicy` | Silently drop the task |
| `DiscardOldestPolicy` | Drop the oldest task and retry |

`CallerRunsPolicy` provides natural backpressure — if the pool is full, the
caller slows down.

### The pool sizing rule of thumb

- **CPU-bound:** pool size ≈ number of cores (or cores + 1)
- **I/O-bound:** pool size ≈ cores × (1 + wait time / compute time)

For I/O-bound work with mostly waiting, virtual threads (Java 21) or a much
larger pool works better.

---

## `Future` — The Async Result Handle

`Future<T>` represents a result that will be available later.

```java
ExecutorService executor = Executors.newFixedThreadPool(2);

Future<Integer> future = executor.submit(() -> {
    Thread.sleep(1000);
    return 42;
});

// ... do other work ...

Integer result = future.get();   // blocks until ready
System.out.println(result);      // 42
```

### Core methods

| Method | Purpose |
|---|---|
| `get()` | Blocking wait for result |
| `get(timeout, unit)` | Bounded wait, throws `TimeoutException` |
| `isDone()` | Has the task completed? |
| `isCancelled()` | Was it cancelled? |
| `cancel(mayInterrupt)` | Attempt to cancel |

### `get()` throws two checked exceptions

```java
try {
    Integer result = future.get();
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();   // restore flag
} catch (ExecutionException e) {
    Throwable cause = e.getCause();       // the actual exception from the task
    log.error("task failed", cause);
}
```

- **`InterruptedException`** — the calling thread was interrupted while waiting
- **`ExecutionException`** — the task itself threw; unwrap via `getCause()`

### `Future` limitations

- No **composition** — you can't chain futures
- No **callback** — you must poll or block
- No **combination** — combining two futures requires manual coordination
- No **exception propagation** in a chain

These limitations led to `CompletableFuture`.

---

## `CompletableFuture` (Java 8+)

A composable, non-blocking alternative to `Future`.

### Creating

```java
// Already-completed
CompletableFuture<String> done = CompletableFuture.completedFuture("hi");

// Run a task async — no result
CompletableFuture<Void> v = CompletableFuture.runAsync(() -> doWork());

// Supply a result async
CompletableFuture<String> f = CompletableFuture.supplyAsync(() -> fetchUser());
```

By default, async tasks run on `ForkJoinPool.commonPool()`. Pass a custom
executor to control it:

```java
CompletableFuture.supplyAsync(() -> fetchUser(), myExecutor);
```

### Transforming

```java
CompletableFuture<Integer> length = CompletableFuture
        .supplyAsync(() -> "hello")
        .thenApply(String::length);
// length will be 5
```

- `thenApply` — transform the result (like `map`)
- `thenAccept` — consume the result, return `Void`
- `thenRun` — run a `Runnable` after completion, ignore result

### Chaining async operations

```java
CompletableFuture<String> result = CompletableFuture
        .supplyAsync(() -> fetchUserId())          // CompletableFuture<Integer>
        .thenCompose(id -> fetchUserName(id));     // CompletableFuture<String>
```

- `thenCompose` — for functions that return a `CompletableFuture` (like `flatMap`)
- `thenApply` — for functions that return a plain value (like `map`)

### Combining

```java
CompletableFuture<String> user = CompletableFuture.supplyAsync(() -> fetchUser());
CompletableFuture<Integer> score = CompletableFuture.supplyAsync(() -> fetchScore());

CompletableFuture<String> combined = user.thenCombine(score,
        (u, s) -> u + " scored " + s);
```

- `thenCombine` — combine two independent futures
- `thenAcceptBoth` — consume both results
- `runAfterBoth` — run after both complete, ignoring results

### Either

```java
CompletableFuture<String> first = CompletableFuture
        .supplyAsync(() -> fetchFromPrimary())
        .applyToEither(
                CompletableFuture.supplyAsync(() -> fetchFromBackup()),
                x -> x
        );
```

`applyToEither` fires as soon as **either** completes.

### Exception handling

```java
CompletableFuture<Integer> safe = CompletableFuture
        .supplyAsync(() -> {
            if (Math.random() > 0.5) throw new RuntimeException("boom");
            return 42;
        })
        .exceptionally(ex -> {
            log.warn("Failed", ex);
            return 0;   // fallback value
        });
```

- `exceptionally` — provide a fallback value
- `handle` — handle success or failure
- `whenComplete` — observe completion, don't transform

```java
// handle — same shape for both success and failure
future.handle((value, ex) -> {
    if (ex != null) return fallbackValue;
    return value * 2;
});
```

### Timeouts (Java 9+)

```java
CompletableFuture<String> withTimeout = future
        .orTimeout(3, TimeUnit.SECONDS)
        .exceptionally(ex -> "default");
```

Or with a fallback:

```java
future.completeOnTimeout("default", 3, TimeUnit.SECONDS);
```

### Waiting for many

```java
CompletableFuture<?>[] futures = tasks.stream()
        .map(task -> CompletableFuture.runAsync(task))
        .toArray(CompletableFuture[]::new);

CompletableFuture.allOf(futures).join();
// All done
```

```java
CompletableFuture<Object> anyDone = CompletableFuture.anyOf(futures);
// Completes when the first one completes
```

`allOf`/`anyOf` return `CompletableFuture<Void>` or `CompletableFuture<Object>`
respectively — you lose the types. Collect individually if you need results.

---

## `Future` vs `CompletableFuture`

| | `Future` | `CompletableFuture` |
|---|---|---|
| Composition | ❌ | ✅ |
| Callbacks | ❌ | ✅ |
| Chaining | ❌ | ✅ (thenApply, thenCompose) |
| Combining | ❌ | ✅ (thenCombine, allOf) |
| Exception handling | Manual via `ExecutionException` | Built-in (exceptionally, handle) |
| Non-blocking | ❌ (must `get`) | ✅ |
| Since | Java 5 | Java 8 |

---

## Lifecycle — Shutdown

`ExecutorService` must be shut down, or the JVM won't exit (non-daemon threads).

```java
ExecutorService executor = Executors.newFixedThreadPool(4);

// Submit tasks
for (int i = 0; i < 100; i++) {
    executor.submit(task);
}

// Graceful shutdown
executor.shutdown();       // no new tasks accepted; existing tasks finish

try {
    if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
        executor.shutdownNow();       // interrupt running tasks
    }
} catch (InterruptedException e) {
    executor.shutdownNow();
    Thread.currentThread().interrupt();
}
```

### `shutdown()` vs `shutdownNow()`

| | `shutdown()` | `shutdownNow()` |
|---|---|---|
| New tasks | Rejected | Rejected |
| Running tasks | Complete | Interrupted |
| Queued tasks | Complete | Returned as `List<Runnable>` |
| Typical use | Graceful | Forced |

### `Executors` services are `AutoCloseable` (Java 19+)

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 100).forEach(i ->
            executor.submit(() -> doWork(i)));
}   // automatically shutdown + awaitTermination
```

The `close()` method calls `shutdown()`, then `awaitTermination(1 day)`. If
interrupted, calls `shutdownNow()`.

---

## Batching Pattern

Process items in batches using an executor:

```java
List<Item> items = fetchAllItems();
int batchSize = 100;

List<List<Item>> batches = new ArrayList<>();
for (int i = 0; i < items.size(); i += batchSize) {
    batches.add(items.subList(i, Math.min(i + batchSize, items.size())));
}

ExecutorService executor = Executors.newFixedThreadPool(4);

List<Future<BatchResult>> futures = batches.stream()
        .map(batch -> executor.submit(() -> processBatch(batch)))
        .toList();

List<BatchResult> results = new ArrayList<>();
for (Future<BatchResult> f : futures) {
    results.add(f.get());   // blocks per future
}

executor.shutdown();
```

**Better — using `invokeAll`:**

```java
List<Callable<BatchResult>> tasks = batches.stream()
        .map(batch -> (Callable<BatchResult>) () -> processBatch(batch))
        .toList();

List<Future<BatchResult>> futures = executor.invokeAll(tasks);
List<BatchResult> results = futures.stream()
        .map(f -> {
            try { return f.get(); }
            catch (Exception e) { throw new RuntimeException(e); }
        })
        .toList();
```

`invokeAll` blocks until all complete (or timeout). `invokeAny` returns the
first successful result.

### Spring Batch vs manual batching

**Spring Batch** provides chunk-oriented processing (read → process → write)
with transaction boundaries, retry, skip logic. For pure Java batching without
Spring, use:

- `ExecutorService.invokeAll` for parallel batch processing
- `CompletableFuture.allOf` for non-blocking aggregation
- Manual chunk loops with `List.subList`

The JDK gives you the primitives; Spring Batch adds orchestration on top.

---

## Tricky Corners ⚠️

**`ExecutorService` threads are non-daemon by default.** The JVM won't exit
until they're shut down (or you set daemon).

**`newCachedThreadPool()` is dangerous in production** — unbounded threads
under load can OOM.

**`newFixedThreadPool(n)` uses an unbounded queue.** Under sustained load,
it can OOM before rejecting tasks.

**`Future.get()` without timeout can block forever** if the task hangs. Always
use timed `get`.

**`CompletableFuture` on the common pool** shares with parallel streams. Heavy
blocking work can starve both. Use a dedicated executor.

**`CompletableFuture.thenApply` swallows exceptions unless you add a handler.**
Use `exceptionally` or `handle` to observe failures.

**`shutdownNow()` doesn't guarantee termination** — it interrupts threads, but
only cooperative interruptions work. Non-interruptible code ignores it.

**`awaitTermination` returns a boolean.** Ignoring it means you don't know
if shutdown actually finished.

**Interrupted tasks in `shutdownNow` need cleanup.** The interrupt flag is set;
code must handle it properly or the thread may ignore the shutdown.

**`invokeAny` returns the first successful result** — if all fail, it throws
the last exception.

**`ThreadPoolExecutor` with core = max and a `SynchronousQueue`** mimics
`newCachedThreadPool()`.

---

## Common Pitfalls

- Forgetting `shutdown()` — JVM never exits.
- Using `newCachedThreadPool()` for long-running tasks.
- Calling `Future.get()` without a timeout.
- Sharing `ForkJoinPool.commonPool()` with heavy blocking work.
- Ignoring exceptions from `CompletableFuture` chains.
- Using an unbounded queue with `newFixedThreadPool`.
- Not naming threads via a `ThreadFactory`.

---

## Key Interview Tips

- Explain the difference between `Runnable` and `Callable`.
- Draw the `Executor` hierarchy: `Executor → ExecutorService → ScheduledExecutorService`.
- Know the five factory methods and when to use each.
- Explain why `newFixedThreadPool` uses an unbounded queue (and its risk).
- Distinguish `thenApply` (like `map`) from `thenCompose` (like `flatMap`).
- Mention `CompletableFuture.allOf` for waiting on many tasks.
- For "batch processing," describe `invokeAll` and chunked `CompletableFuture`.

---

## Related

- [Threads Basics](threads-basics.md) — thread lifecycle and interruption
- [Synchronization](synchronization.md) — locks, visibility
- [Concurrency Utilities](concurrency-utilities.md) — semaphores, latches
- [Virtual Threads](virtual-threads.md) — the Java 21 executor
- [Streams & Functional](../collections/streams-and-functional.md) — parallel streams use ForkJoinPool