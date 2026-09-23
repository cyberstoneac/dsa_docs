# Deadlock & Liveness

> **JDK context:** Thread dump tooling has existed since early JDKs.
> `jstack` (Java 5) and `jcmd` (Java 7) are the standard tools. Java 21
> virtual threads add new thread dump semantics.

## Mental Model

A **liveness** problem means the program is stuck — not because of a bug in
logic, but because threads are waiting on each other in a cycle.

Four classic liveness failures:

```d2
direction: down

problems: "Liveness Failures" {
  style.fill: "#ffcdd2"

  deadlock: "Deadlock\nThreads wait on each other\n(cycle)" {
    style.fill: "#ef9a9a"
  }
  livelock: "Livelock\nThreads keep changing state\nbut make no progress" {
    style.fill: "#ef9a9a"
  }
  starvation: "Starvation\nA thread never gets resources" {
    style.fill: "#ef9a9a"
  }
  missed: "Missed Signal\nnotify happens before wait" {
    style.fill: "#ef9a9a"
  }
}
```

**Deadlock** is the most famous and the most testable.

---

## Deadlock — Anatomy

Four conditions must hold simultaneously (Coffman conditions):

1. **Mutual exclusion** — a resource can only be held by one thread
2. **Hold and wait** — a thread holds one resource while waiting for another
3. **No preemption** — resources cannot be forcibly taken
4. **Circular wait** — a cycle of threads waiting on each other

Break any one and deadlock is impossible.

### The classic example

```java
public class Deadlock {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();

    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            synchronized (lockA) {
                System.out.println("t1: holding A");
                sleep(100);
                synchronized (lockB) {
                    System.out.println("t1: holding A and B");
                }
            }
        });

        Thread t2 = new Thread(() -> {
            synchronized (lockB) {
                System.out.println("t2: holding B");
                sleep(100);
                synchronized (lockA) {
                    System.out.println("t2: holding A and B");
                }
            }
        });

        t1.start();
        t2.start();
    }
}
```

**Output:**

```text
t1: holding A
t2: holding B
(hang — neither proceeds)
```

### Visualizing the cycle

```d2
direction: right

t1: "Thread 1\nholds A,\nwants B" {
  style.fill: "#bbdefb"
}
t2: "Thread 2\nholds B,\nwants A" {
  style.fill: "#c8e6c9"
}

t1.t2 -> t2: "waits for B"
t2.t1 -> t1: "waits for A"
```

---

## Detecting Deadlock

### 1. Thread dump via `jstack`

```bash
jstack <pid> > thread-dump.txt
```

Look for:

```text
Found one Java-level deadlock:
=============================
"Thread-0":
  waiting to lock monitor 0x00007f8c... (object 0x000000076ab..., a java.lang.Object),
  which is held by "Thread-1"
"Thread-1":
  waiting to lock monitor 0x00007f8c... (object 0x000000076abc..., a java.lang.Object),
  which is held by "Thread-0"

Java stack information for the threads listed above:
===================================================
"Thread-0":
    at Deadlock.lambda$main$0(Deadlock.java:12)
    - waiting to lock <0x000000076abc...> (a java.lang.Object)
    - locked <0x000000076abc...> (a java.lang.Object)
```

The JVM detects deadlocks automatically in thread dumps — the "Found one
Java-level deadlock" section is highlighted.

### 2. Thread dump via `jcmd`

```bash
jcmd <pid> Thread.print > thread-dump.txt
```

Same output. `jcmd` is the modern tool (`jstack` still works).

### 3. Programmatic deadlock detection

`ThreadMXBean` can find deadlocks in-process:

```java
ThreadMXBean bean = ManagementFactory.getThreadMXBean();
long[] deadlockedThreads = bean.findDeadlockedThreads();

if (deadlockedThreads != null) {
    ThreadInfo[] infos = bean.getThreadInfo(deadlockedThreads, true, true);
    for (ThreadInfo info : infos) {
        System.err.println(info);
    }
}
```

Useful for health-check endpoints.

### 4. Thread dump on Windows

**Same tools.** Java is platform-independent:

```cmd
jps                          :: list Java processes and PIDs
jstack <pid> > dump.txt
jcmd <pid> Thread.print
```

Or from the terminal:

```cmd
jcmd <pid> Thread.print > dump.txt
```

`jps` (JVM Process Status) is a lightweight `ps` for Java — running it in
Windows CMD shows all JVMs with PIDs.

**Tip:** `jcmd <pid> Thread.print -l` includes lock information for
`java.util.concurrent` locks too.

### 5. `kill -3 <pid>` on Unix

Sends `SIGQUIT` — the JVM prints a thread dump to standard output.

### 6. `Ctrl+Break` on Windows

Sends the same signal to the console.

---

## Preventing Deadlock

### 1. Global lock ordering

Always acquire locks in the same order.

```java
// Both threads lock A then B — no deadlock
public void transfer(Account from, Account to, int amount) {
    Account first  = from.id() < to.id() ? from : to;
    Account second = from.id() < to.id() ? to : from;

    synchronized (first) {
        synchronized (second) {
            // transfer
        }
    }
}
```

This breaks the **circular wait** condition.

### 2. Lock timeouts (`tryLock`)

```java
ReentrantLock lockA = new ReentrantLock();
ReentrantLock lockB = new ReentrantLock();

boolean success = false;
try {
    if (lockA.tryLock(1, TimeUnit.SECONDS)) {
        try {
            if (lockB.tryLock(1, TimeUnit.SECONDS)) {
                try {
                    // both acquired
                    success = true;
                } finally {
                    lockB.unlock();
                }
            }
        } finally {
            lockA.unlock();
        }
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}

if (!success) {
    // retry, log, or fail fast
}
```

The lock can time out instead of waiting forever.

### 3. Single lock

If you can express the operation with one lock, do so. Deadlock requires two
or more locks in a cycle.

### 4. Avoid nested locks

Acquire only what you need, release quickly.

```java
// BAD — nested locks
synchronized (a) {
    synchronized (b) {
        // ...
    }
}

// GOOD — separate critical sections
synchronized (a) { /* update a */ }
synchronized (b) { /* update b */ }
```

Not always possible, but always check.

### 5. Use higher-level concurrency utilities

`ConcurrentHashMap`, `BlockingQueue`, and `ConcurrentLinkedQueue` are designed
to avoid deadlock. Prefer them over hand-rolled locks.

---

## Livelock

Threads are active but make no progress — usually because they keep retrying
and undoing each other's work.

### Example

Two threads try to `tryLock` two locks. Both fail. Both release and retry.
Repeat forever.

```java
while (true) {
    if (lockA.tryLock()) {
        try {
            if (lockB.tryLock()) {
                try {
                    // work
                    break;
                } finally { lockB.unlock(); }
            }
        } finally { lockA.unlock(); }
    }
    // If lockB was taken, we released lockA and will retry
    // Other thread does the same — both keep cycling
}
```

**Fix:** random backoff, or global lock ordering, or a single lock.

```java
Thread.sleep(ThreadLocalRandom.current().nextInt(10, 100));
```

Random delays break the symmetry.

---

## Starvation

A thread never gets CPU or lock access because other threads dominate.

Causes:
- **Priority inversion** — low-priority thread holds a lock high-priority wants
- **Unfair locks** — same thread always wins the lock race
- **Continuous higher-priority work** — infinite producers, starved consumers

### Fixes

- **Fair locks** — `new ReentrantLock(true)`, `new Semaphore(n, true)`
- **Bounded queues** — force producers to slow down
- **Priorities** — but they're unreliable across OSes

Fair locks reduce starvation at the cost of throughput — a trade-off.

---

## Missed Signal (Lost Wakeup)

A `notify` that fires before the corresponding `wait` is lost forever.

```java
// BAD
synchronized (lock) {
    if (!condition) {
        lock.wait();      // if notify happens between check and wait, it's lost
    }
}
```

**Why it happens:** The check and the `wait` must be atomic with respect to
the notifier. If the notifier runs between the check and the `wait`, the
signal is lost.

### Correct pattern

```java
synchronized (lock) {
    while (!condition) {   // loop, not if
        lock.wait();
    }
    // condition is true
}
```

The `while` loop:
1. Rechecks the condition after waking
2. Handles spurious wakeups
3. Handles the case where the notifier reset the condition

**Rule:** always wait in a loop.

---

## Thread Dump — Reading It

```text
"Thread-0" #12 prio=5 os_prio=0 tid=0x00007f8c0c0a8000 nid=0x5e0a waiting for monitor entry [0x00007f8c0f5e5000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.example.MyClass.method(MyClass.java:42)
        - waiting to lock <0x000000076ab...> (a java.lang.Object)
        - locked <0x000000076abc...> (a java.lang.Object)
```

### Key fields

| Field | Meaning |
|---|---|
| Thread name | Set via `new Thread(task, "name")` |
| `nid` | Native thread ID (matches OS tools like `top -H`) |
| `State` | `RUNNABLE`, `BLOCKED`, `WAITING`, `TIMED_WAITING` |
| `at ...` | The stack frame where the thread is |
| `- waiting to lock <...>` | The lock this thread wants |
| `- locked <...>` | The lock this thread holds |

### Common thread states in dumps

- **RUNNABLE** — actively executing or ready (could be CPU-bound)
- **BLOCKED** — waiting on a monitor lock
- **WAITING** — waiting on `wait()`, `join()`, `park()`
- **TIMED_WAITING** — with a timeout

**Production tip:** if 50 threads are BLOCKED on the same lock, you've found
a bottleneck. If a thread pool's threads are all RUNNABLE at high CPU, you've
found a hotspot.

---

## After Deadlock Occurs — Can You Recover?

**No clean way, but:**

1. **Detect via `ThreadMXBean`** — a watchdog thread can call
   `findDeadlockedThreads()` and log.
2. **Interrupt one thread** — if the deadlock is on interruptible locks
   (`ReentrantLock`), `interrupt()` may break it. `synchronized` locks are
   **not** interruptible.
3. **Restart the JVM** — the pragmatic option in production.
4. **Kill one thread** — `Thread.stop()` is deprecated and dangerous. Not
   recommended.

**Best practice:** prevent deadlock. Recovery from a real deadlock is
essentially always a restart.

---

## Tricky Corners ⚠️

**`synchronized` locks are not interruptible.** `ReentrantLock.lockInterruptibly()`
is. If you need interruptible waits, use `Lock`.

**Deadlock can involve more than two threads.** The cycle can be long:
A→B→C→A.

**`tryLock` without a timeout returns immediately** — you may busy-spin.
Add a small sleep or a timeout.

**`notify()` can wake the wrong thread.** Always use `notifyAll()` unless
you're certain only one waiter exists and any of them can proceed.

**Spurious wakeups are real** — the JVM can wake a `wait()` without a
`notify()`. Always wait in a loop.

**Thread dumps include `java.util.concurrent` locks** if you use `jcmd -l`.
Otherwise, `ReentrantLock` waiters appear as `WAITING (parking)`.

**Livelock looks like activity but isn't progress.** Watch CPU (high) with
no throughput increase.

**Fair locks reduce throughput significantly.** Use only when starvation
is a real problem.

---

## Common Pitfalls

- Acquiring locks in different orders across threads.
- Using `if` instead of `while` around `wait()`.
- Using `notify()` when `notifyAll()` is needed.
- Nested locks without a consistent order.
- Assuming `tryLock` will eventually succeed under contention.
- Not naming threads — thread dumps become useless.
- Ignoring `TIMED_WAITING` threads in dumps — they may be blocked on
  long timeouts.

---

## Key Interview Tips

- Recite the **four Coffman conditions**.
- Explain that deadlock requires a **cycle** — break it and deadlock is
  impossible.
- Name `jstack`, `jcmd`, and `ThreadMXBean` as detection tools.
- Describe the `tryLock` timeout approach.
- Mention global lock ordering as the primary prevention.
- Know that `synchronized` locks are not interruptible — `ReentrantLock` is.

---

## Related

- [Threads Basics](threads-basics.md) — thread lifecycle, interrupt
- [Synchronization](synchronization.md) — locks, `wait`/`notify`
- [Concurrency Utilities](concurrency-utilities.md) — semaphores, atomics
- [Executors & Futures](executors-and-futures.md) — thread pools
- [Virtual Threads](virtual-threads.md) — pinning and deadlock in virtual threads