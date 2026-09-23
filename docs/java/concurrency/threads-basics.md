# Threads Basics

> **JDK context:** `Thread` and `Runnable` date to Java 1.0. `Callable` and
> `Future` arrived in Java 5. `Thread.ofPlatform()` and `Thread.ofVirtual()`
> (Java 19 preview, standard in Java 21) provide a modern builder API.

## Mental Model

A thread is a **unit of execution** with its own call stack, program counter,
and local state, sharing the heap with other threads in the same process.

```d2
direction: down

process: "Process (JVM)" {
  style.fill: "#e3f2fd"

  heap: "Shared Heap\n(objects, statics)" {
    style.fill: "#bbdefb"
  }

  t1: "Thread 1\n(stack, PC, locals)" {
    style.fill: "#c8e6c9"
  }
  t2: "Thread 2\n(stack, PC, locals)" {
    style.fill: "#a5d6a7"
  }
  t3: "Thread 3\n(stack, PC, locals)" {
    style.fill: "#81c784"
  }
}
```

**Key fact:** threads share memory. This is why they're powerful — and
dangerous. Every synchronization primitive exists to manage that sharing.

---

## Creating a Thread — Three Ways

### 1. Extend `Thread`

```java
class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("Running in " + Thread.currentThread().getName());
    }
}

MyThread t = new MyThread();
t.start();
```

**Downside:** you've used your one inheritance slot. Cannot extend anything else.

### 2. Implement `Runnable`

```java
Runnable task = () -> System.out.println("Running in " + Thread.currentThread().getName());

Thread t = new Thread(task);
t.start();
```

**Preferred** — separates the task (what) from the execution mechanism (how).

### 3. Implement `Callable<T>` (returns a value)

```java
Callable<Integer> task = () -> {
    Thread.sleep(1000);
    return 42;
};

ExecutorService executor = Executors.newSingleThreadExecutor();
Future<Integer> future = executor.submit(task);

Integer result = future.get();   // blocks until the callable returns
System.out.println(result);      // 42
executor.shutdown();
```

`Callable` can throw checked exceptions and return a value — `Runnable` cannot.

### Runnable vs Callable vs Thread

| | `Runnable` | `Callable<T>` | `Thread` (extend) |
|---|---|---|---|
| Return value | ❌ | ✅ | ❌ |
| Checked exceptions | ❌ | ✅ | ❌ |
| Reusable | ✅ | ✅ | ❌ |
| Composable | ✅ | ✅ | ❌ |
| Recommended | ✅ | ✅ | ❌ |

**Always prefer `Runnable`/`Callable` over extending `Thread`.**

---

## Thread Lifecycle

```d2
direction: right

states: "Thread States" {
  style.fill: "#f5f5f5"

  new: "NEW\n(start() not called)" {
    style.fill: "#e3f2fd"
  }
  runnable: "RUNNABLE\n(ready or running)" {
    style.fill: "#c8e6c9"
  }
  blocked: "BLOCKED\n(waiting for monitor lock)" {
    style.fill: "#fff9c4"
  }
  waiting: "WAITING\n(wait/join/park)" {
    style.fill: "#ffe0b2"
  }
  timed: "TIMED_WAITING\n(sleep/wait(ms)/join(ms))" {
    style.fill: "#ffcc80"
  }
  terminated: "TERMINATED\n(run() returned)" {
    style.fill: "#ffcdd2"
  }
}
```

### State transitions

```java
Thread t = new Thread(() -> { /* work */ });
// t.getState() == NEW

t.start();
// t.getState() == RUNNABLE (or RUNNING)

// Inside the thread:
Thread.sleep(1000);          // TIMED_WAITING
// anotherThread.join();     // WAITING
// synchronized (lock) {}    // BLOCKED (if lock held)

// After run() returns:
// t.getState() == TERMINATED
```

**Important:** `RUNNABLE` in Java means "ready or running" — the JVM doesn't
distinguish. The OS scheduler decides which RUNNABLE thread gets CPU time.

---

## `start()` vs `run()`

The single most common thread trap.

```java
Thread t = new Thread(() -> System.out.println("in " + Thread.currentThread().getName()));

// WRONG — runs on the current thread, not a new one
t.run();      // prints "in main"

// RIGHT — runs on a new thread
t.start();    // prints "in Thread-0"
```

- `start()` — creates a new OS thread, then calls `run()` on it
- `run()` — just a regular method call

**Interview line:** *"Calling `run()` directly doesn't start a thread — it
executes the method on the current thread."*

---

## `join()`

Wait for another thread to finish.

```java
Thread t1 = new Thread(() -> {
    try { Thread.sleep(1000); } catch (InterruptedException e) {}
    System.out.println("t1 done");
});

t1.start();
System.out.println("before join");
t1.join();                        // blocks until t1 terminates
System.out.println("after join");
```

**Output:**

```text
before join
t1 done
after join
```

### Timed join

```java
t1.join(500);   // wait at most 500ms
```

If the thread hasn't finished, `join` returns and the main thread continues.

### Why `join` is useful

- **Ordering** — ensure a thread finishes before you proceed
- **Fan-out/fan-in** — start many threads, join all before aggregating
- **Testing** — deterministic test outcomes

---

## `sleep()` vs `wait()`

Both pause a thread, but they're fundamentally different.

| | `Thread.sleep(ms)` | `Object.wait()` |
|---|---|---|
| Class | `Thread` (static) | `Object` (instance method) |
| Releases lock? | ❌ | ✅ |
| Requires lock? | ❌ | ✅ (must hold the monitor) |
| Wake up | After timeout | `notify`/`notifyAll` or timeout |
| Throws | `InterruptedException` | `InterruptedException` |

```java
Thread.sleep(1000);   // pauses 1 second, keeps any locks held

synchronized (lock) {
    lock.wait();      // releases `lock`, waits for notification
}
```

**`sleep` is for pausing. `wait` is for waiting for a condition.**

Full details in [Synchronization](synchronization.md).

---

## `interrupt()` — How to Stop a Thread

There's no safe way to forcibly kill a thread (`Thread.stop()` is deprecated
because it can leave objects in inconsistent states).

Instead, use **cooperative interruption**:

```java
Thread worker = new Thread(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        doWork();
    }
    System.out.println("cleanly interrupted");
});

worker.start();
Thread.sleep(500);
worker.interrupt();      // sets the interrupt flag
worker.join();
```

### How interruption works

1. `interrupt()` sets the thread's **interrupt flag**
2. If the thread is blocked in `sleep`, `wait`, `join`, or `BlockingQueue.take`,
   it's woken up and throws `InterruptedException`
3. Otherwise, the thread must check `isInterrupted()` itself

### Best practices

```java
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    // 1. Restore the interrupt flag
    Thread.currentThread().interrupt();
    // 2. Clean up
    // 3. Return or rethrow
    return;
}
```

**Never swallow `InterruptedException`.** Either rethrow, restore the flag,
or handle it explicitly.

### Bad pattern

```java
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    // Ignored! The interrupt flag is now cleared.
}
```

The caller has no idea the thread was interrupted.

---

## Daemon Threads

A **daemon thread** doesn't prevent JVM shutdown. When all non-daemon
threads finish, the JVM exits — killing any running daemon threads.

```java
Thread t = new Thread(() -> {
    while (true) { /* never stops */ }
});
t.setDaemon(true);   // must be set BEFORE start()
t.start();

// When main() exits, this thread is killed automatically
```

### `setDaemon()` rules

- Must be called **before** `start()`
- Throws `IllegalThreadStateException` otherwise

### Common daemon threads

- JVM GC threads
- JIT compiler threads
- `ForkJoinPool.commonPool()` workers
- Finalizer thread

### Use cases

- Background monitoring
- Non-critical housekeeping
- Cache eviction loops

**Rule:** daemon threads can die at any moment. Never use them for critical
work that must complete (writes, transactions, etc.).

---

## Thread Priorities

```java
t.setPriority(Thread.MAX_PRIORITY);    // 10
t.setPriority(Thread.NORM_PRIORITY);   // 5 (default)
t.setPriority(Thread.MIN_PRIORITY);    // 1
```

**They're a hint, not a contract.** The OS may ignore them. Don't rely on
priorities for correctness.

---

## Naming Threads

Always name your threads — it makes thread dumps readable.

```java
Thread t = new Thread(task, "order-processor-1");
```

Or in a factory:

```java
ThreadFactory namedFactory = r -> new Thread(r, "worker-" + counter.incrementAndGet());
```

**Unnamed threads appear as `Thread-0`, `Thread-1` in stack traces** — useless
in production.

---

## Capturing State in a Thread

```java
int count = 10;

Thread t = new Thread(() -> {
    // count must be effectively final
    System.out.println(count);
});
```

Local variables captured by a lambda must be **effectively final** — this
prevents races on stack-allocated values.

To share mutable state, use a holder:

```java
AtomicInteger count = new AtomicInteger(0);

Thread t = new Thread(() -> count.incrementAndGet());
```

---

## Modern Thread API (Java 19+/21)

Java 19 introduced `Thread.ofPlatform()` and `Thread.ofVirtual()`:

```java
Thread t1 = Thread.ofPlatform()
        .name("platform-worker")
        .daemon(false)
        .unstarted(task);
t1.start();

Thread t2 = Thread.ofVirtual()
        .name("virtual-worker")
        .start(task);
```

Clearer than the old constructor + setters. See [Virtual Threads](virtual-threads.md).

---

## Tricky Corners ⚠️

**`run()` vs `start()`** — calling `run()` directly doesn't create a thread.

**`Thread.sleep(0)`** doesn't guarantee any pause. It may return immediately.

**`Thread.sleep(ms, nanos)`** — `nanos` range is 0–999999. Passing more throws
`IllegalArgumentException`.

**`join()` without arguments waits forever** if the thread never terminates.
Use `join(ms)` for a bounded wait.

**`setDaemon()` after `start()` throws `IllegalThreadStateException`.**

**`isInterrupted()` doesn't clear the flag.** `Thread.interrupted()` (static)
does clear the flag.

```java
boolean flag1 = Thread.currentThread().isInterrupted();  // doesn't clear
boolean flag2 = Thread.interrupted();                     // clears
```

**The `InterruptedException` clears the interrupt flag.** When you catch it,
the flag is reset — that's why you should call `Thread.currentThread().interrupt()`
to restore it.

**Thread priority on some OSes is ignored.** Don't build algorithms around it.

**Uncaught exception in a thread doesn't kill the JVM by default.** Use
`Thread.setUncaughtExceptionHandler(...)` or a `ThreadFactory` to log them.

```java
Thread.setDefaultUncaughtExceptionHandler((thread, ex) -> {
    log.error("Uncaught in " + thread.getName(), ex);
});
```

**Daemon threads can be killed mid-operation.** Never use them for I/O,
database writes, or anything requiring a clean shutdown.

---

## Common Pitfalls

- Calling `run()` instead of `start()`.
- Swallowing `InterruptedException`.
- Using `Thread.stop()` — deprecated and unsafe.
- Setting daemon status after `start()`.
- Sharing mutable state without synchronization.
- Creating threads manually instead of using an `ExecutorService`.

---

## Key Interview Tips

- Explain the difference between `Runnable` and `Callable` cold.
- Draw the thread state diagram.
- Explain interruption as **cooperative**, not forcible.
- Know that `sleep` doesn't release locks; `wait` does.
- Mention `ExecutorService` as the correct abstraction over raw threads.

---

## Related

- [Synchronization](synchronization.md) — locks, `volatile`, `wait`/`notify`
- [Executors & Futures](executors-and-futures.md) — the modern way to manage threads
- [Virtual Threads](virtual-threads.md) — Java 21's lightweight threads
- [Concurrency Utilities](concurrency-utilities.md) — Semaphore, Latch, Barrier