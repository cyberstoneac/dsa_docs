# Synchronization

> **JDK context:** `synchronized` and `volatile` are as old as Java itself.
> `ReentrantLock` and `java.util.concurrent` arrived in Java 5, providing
> more flexible alternatives.

## Mental Model

Multithreading problems come in two flavors:

1. **Race conditions** — two threads modifying shared state, causing lost updates
2. **Visibility issues** — one thread's write isn't seen by another

Java provides two mechanisms to fix them:

- **`synchronized`** — mutual exclusion + visibility (heavyweight)
- **`volatile`** — visibility only (lightweight)

```d2
direction: right

problems: "Concurrency Problems" {
  style.fill: "#ffcdd2"

  race: "Race Condition\n(counter++)" {
    style.fill: "#ef9a9a"
  }
  visibility: "Visibility\n(stale cache)" {
    style.fill: "#ef9a9a"
  }
}

fixes: "Fixes" {
  style.fill: "#c8e6c9"

  sync: "synchronized\n(both problems)" {
    style.fill: "#a5d6a7"
  }
  vol: "volatile\n(visibility only)" {
    style.fill: "#81c784"
  }
  atomic: "Atomics\n(CAS-based)" {
    style.fill: "#66bb6a"
  }
}

problems.race -> fixes.sync: "mutual exclusion"
problems.visibility -> fixes.vol: "visibility"
```

---

## The Race Condition — A Demonstration

```java
class Counter {
    private int count = 0;

    public void increment() {
        count++;   // NOT atomic — read, increment, write
    }

    public int getCount() { return count; }
}

Counter counter = new Counter();

Runnable task = () -> {
    for (int i = 0; i < 100_000; i++) {
        counter.increment();
    }
};

Thread t1 = new Thread(task);
Thread t2 = new Thread(task);
t1.start(); t2.start();
t1.join(); t2.join();

System.out.println(counter.getCount());   // Often less than 200_000!
```

**Why?** `count++` compiles to three operations:
1. Read `count` from memory into a register
2. Increment the register
3. Write back to memory

Between step 1 and step 3, another thread can read the same original value.
Both write the same result — one increment is lost.

### Typical output

```text
142356
```

Or 156789, or 198234 — variable. Never reliably 200,000.

---

## `synchronized` — The Lock

`synchronized` uses an object's **monitor** (intrinsic lock). Only one thread
can hold it at a time.

### Synchronized method

```java
class Counter {
    private int count = 0;

    public synchronized void increment() {
        count++;
    }

    public synchronized int getCount() {
        return count;
    }
}
```

### Synchronized block

```java
class Counter {
    private int count = 0;
    private final Object lock = new Object();

    public void increment() {
        synchronized (lock) {
            count++;
        }
    }
}
```

**Result:** guaranteed 200,000. The lock serializes increments.

### Which object is passed?

In `synchronized (obj)`, the monitor of `obj` is acquired. **Not a copy — the
actual reference.**

For **synchronized methods**:

| Method type | Monitor acquired |
|---|---|
| Instance method | `this` — the object the method is called on |
| Static method | The `Class` object — e.g. `Counter.class` |

```java
public synchronized void a() { ... }       // locks on `this`
public static synchronized void b() { ... }  // locks on Counter.class
```

**Important:** these lock on **different** monitors. `a()` and `b()` can run
concurrently.

### What `synchronized` guarantees

- **Mutual exclusion** — only one thread in the block
- **Visibility** — writes before unlock are visible to any thread that
  subsequently locks the same monitor
- **Happens-before** — unlock happens-before the next lock

### Reentrancy

`synchronized` is **reentrant** — a thread can re-enter a monitor it already
holds.

```java
public synchronized void a() {
    b();   // OK — same thread already holds the monitor
}

public synchronized void b() { ... }
```

This is essential for method composition.

### Deadlock risk

Locks held while waiting for another lock can deadlock:

```java
class Account {
    public synchronized void transfer(Account to, int amount) {
        synchronized (to) {
            // deadlock if another thread does `to.transfer(this, ...)`
        }
    }
}
```

See [Deadlock & Liveness](deadlock-and-liveness.md).

---

## Synchronized Block vs Synchronized Method

| | Method | Block |
|---|---|---|
| Granularity | Whole method | Explicit scope |
| Lock object | `this` (or Class for static) | Anything you choose |
| Flexibility | Rigid | Flexible — private lock, partial scope |
| Performance | Locks the whole method | Locks only what needs it |

**Prefer synchronized blocks** when:

- Only part of the method touches shared state
- You want a private lock (not exposed via `this`)
- You want to reduce contention

```java
// Better — less contention
public void process(Request req) {
    Request parsed = parse(req);         // outside lock
    synchronized (lock) {
        sharedState.update(parsed);      // only this needs locking
    }
    response.send(...);                  // outside lock
}
```

**Interview line:** *"Synchronized blocks are preferable to synchronized
methods when only part of the method accesses shared state — they reduce
lock contention."*

---

## `volatile` — Visibility Without Locking

`volatile` guarantees:

1. **Visibility** — writes are immediately visible to all threads
2. **Ordering** — happens-before between write and subsequent read
3. **No atomicity** — `volatile int x; x++` is still not atomic

### The visibility problem

```java
class Worker {
    private boolean running = true;   // NOT volatile

    public void stop() { running = false; }

    public void run() {
        while (running) {
            doWork();
        }
    }
}
```

The JIT can hoist `running` into a register and never re-read it. The loop
runs forever even after `stop()`.

Fix:

```java
private volatile boolean running = true;
```

### When `volatile` is enough

- **Simple flag** — start/stop, initialized marker
- **Publishing an immutable object reference**
- **One writer, many readers**

### When `volatile` is NOT enough

Read-modify-write operations:

```java
volatile int counter = 0;
counter++;   // still three operations, still lost updates
```

Use `AtomicInteger` or `synchronized`.

### `volatile` on collections

```java
volatile List<String> list = new ArrayList<>();
list.add("a");   // NOT thread-safe — the list itself isn't synchronized
```

`volatile` on a reference only guarantees the *reference* is visible. The
list's internal state is not protected. Use `CopyOnWriteArrayList` or
`Collections.synchronizedList`.

### `volatile` vs `synchronized`

| | `volatile` | `synchronized` |
|---|---|---|
| Atomicity | ❌ | ✅ |
| Visibility | ✅ | ✅ |
| Mutual exclusion | ❌ | ✅ |
| Blocking | Never | Yes |
| Performance | Cheap | Costly |
| Use for | Flags, single writes | Compound operations |

---

## `wait()`, `notify()`, `notifyAll()`

These methods coordinate threads waiting for a condition. They must be called
while holding the monitor.

### Why are they on `Object`, not `Thread`?

Because they're about **monitors**, not threads. Monitors belong to objects.
Any object can be a lock, and any thread holding that lock may need to wait.
Putting `wait`/`notify` on `Thread` would couple them to the wrong abstraction.

### Producer-consumer via wait/notify

```java
class BoundedBuffer<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;

    public BoundedBuffer(int capacity) { this.capacity = capacity; }

    public synchronized void put(T item) throws InterruptedException {
        while (queue.size() == capacity) {
            wait();   // releases lock, waits for signal
        }
        queue.add(item);
        notifyAll();   // wake waiting consumers
    }

    public synchronized T take() throws InterruptedException {
        while (queue.isEmpty()) {
            wait();
        }
        T item = queue.poll();
        notifyAll();   // wake waiting producers
        return item;
    }
}
```

### Rules

1. **Always call `wait` in a loop** — spurious wakeups are allowed:

```java
while (!condition) {
    wait();
}
```

2. **Always hold the monitor** — `wait`/`notify` throw `IllegalMonitorStateException` otherwise.

3. **Use `notifyAll` by default** — `notify` wakes a random thread; if it's
   waiting for a different condition, you can deadlock.

```java
// RISKY — wakes one random thread
notify();

// SAFER — wakes all waiters; each re-checks its condition
notifyAll();
```

**Interview line:** *"Use `notifyAll` unless you're certain only one thread
is waiting and any of them can proceed. Getting this wrong is a subtle
deadlock."*

### The complete sequence

```text
Producer:        Consumer:
  lock             lock
  while full:      while empty:
    wait()           wait()
  add item         remove item
  notifyAll()      notifyAll()
  unlock           unlock
```

---

## Modern Alternative — `java.util.concurrent`

For most cases, prefer `BlockingQueue`, `Lock`, and atomics over raw
`synchronized` + `wait`/`notify`.

### `BlockingQueue` replaces wait/notify

```java
BlockingQueue<Task> queue = new LinkedBlockingQueue<>(100);

// Producer
queue.put(task);   // blocks if full

// Consumer
Task task = queue.take();   // blocks if empty
```

Simpler, less error-prone, more scalable.

### `ReentrantLock`

Explicit lock with more features than `synchronized`.

```java
private final ReentrantLock lock = new ReentrantLock();

public void increment() {
    lock.lock();
    try {
        count++;
    } finally {
        lock.unlock();   // MUST be in finally
    }
}
```

### `ReentrantLock` vs `synchronized`

| | `synchronized` | `ReentrantLock` |
|---|---|---|
| Auto-release | ✅ (block exit) | ❌ (manual in finally) |
| Try-lock without blocking | ❌ | ✅ (`tryLock()`) |
| Timed lock | ❌ | ✅ (`tryLock(timeout)`) |
| Interruptible lock | ❌ | ✅ (`lockInterruptibly()`) |
| Fairness | ❌ | ✅ (optional) |
| Condition variables | ❌ (wait/notify) | ✅ (`newCondition()`) |

### Advanced `ReentrantLock` patterns

**Try-lock without blocking:**

```java
if (lock.tryLock()) {
    try {
        // got the lock
    } finally {
        lock.unlock();
    }
} else {
    // do something else — no blocking
}
```

**Timed lock:**

```java
if (lock.tryLock(1, TimeUnit.SECONDS)) {
    try { ... } finally { lock.unlock(); }
}
```

**Fairness:**

```java
ReentrantLock fairLock = new ReentrantLock(true);   // FIFO
```

Fair locks reduce starvation but hurt throughput.

### `ReadWriteLock`

Multiple readers, exclusive writers:

```java
private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
private final Lock readLock = rwLock.readLock();
private final Lock writeLock = rwLock.writeLock();

public String read() {
    readLock.lock();
    try { return data; }
    finally { readLock.unlock(); }
}

public void write(String value) {
    writeLock.lock();
    try { data = value; }
    finally { writeLock.unlock(); }
}
```

Useful for read-heavy shared state. Beware: a writer can starve under
continuous readers unless the lock is fair.

---

## Happens-Before — The JMM Rule

The Java Memory Model defines a **happens-before** relationship. If A
happens-before B, then any memory writes in A are visible to B.

### Key happens-before rules

| Rule | Meaning |
|---|---|
| Program order | Statements in a thread happen in order |
| Monitor lock | `unlock(m)` happens-before the next `lock(m)` |
| `volatile` write | `volatile` write happens-before subsequent reads of the same variable |
| Thread start | All writes before `t.start()` happen-before `t.run()` |
| Thread join | All writes by `t` happen-before `t.join()` returns |
| Transitivity | If A → B and B → C, then A → C |

### Example

```java
// Thread A
data = 42;              // (1)
ready = true;           // (2) volatile write

// Thread B
if (ready) {            // (3) volatile read
    System.out.println(data);   // (4) guaranteed to see 42
}
```

Because (2) is a `volatile` write and (3) is a subsequent `volatile` read of
the same variable, all writes before (2) — including (1) — are visible at (4).

**Without `volatile`**, (3) might see `ready = true` but (4) might see `data = 0`
(reordering or stale cache).

---

## Is `String` Thread-Safe?

**Yes.** `String` is immutable — no synchronization needed.

But a **reference to a String** is not automatically safe:

```java
class Holder {
    String value;   // NOT final — could be stale in another thread
}
```

Make it `volatile` or `final` for safe publication.

## Are Immutable Objects Thread-Safe?

**Yes, if properly constructed** (no `this` escape in constructor).

```java
final class Point {
    private final int x, y;

    Point(int x, int y) {
        this.x = x;   // safe — final fields
        this.y = y;
    }
}
```

The `final` field initialization guarantee (JMM) ensures safe publication.
See [Immutable Objects](../design-patterns-java/immutable-objects.md).

---

## Tricky Corners ⚠️

**`synchronized` on `this` vs a private lock.** Synchronizing on `this` (or a
public object) exposes the lock to external code, which could hold it forever.
Prefer private final lock objects.

**`synchronized` doesn't make code interruptible.** A thread waiting for a
monitor can't be interrupted. Use `ReentrantLock.lockInterruptibly()` if you
need that.

**`volatile` doesn't make `++` atomic.** Use `AtomicInteger` or `synchronized`.

**`volatile` on an array reference doesn't protect the elements.**

```java
volatile int[] arr = new int[10];
arr[0] = 42;   // NOT safe — only the reference is volatile
```

Use `AtomicIntegerArray` for element-level atomicity.

**Double-checked locking needs `volatile`:**

```java
class Singleton {
    private static volatile Singleton instance;

    public static Singleton getInstance() {
        if (instance == null) {                    // 1st check
            synchronized (Singleton.class) {
                if (instance == null) {            // 2nd check
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

Without `volatile`, another thread could see a **partially constructed**
object (constructor not finished but reference assigned).

**Prefer the initialization-on-demand holder idiom** — simpler and faster:

```java
class Singleton {
    private Singleton() {}

    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }

    public static Singleton getInstance() { return Holder.INSTANCE; }
}
```

**`synchronized` on a `String` literal** is a bad idea — literals are interned
and shared across the JVM. Use a dedicated lock object.

**Prefer `synchronized` over `Lock` when possible** — less code, fewer
mistakes. Reach for `Lock` only when you need its extra features.

---

## Common Pitfalls

- Synchronizing on public objects or `this`.
- Using `notify()` instead of `notifyAll()`.
- Not calling `wait()` in a loop.
- Assuming `volatile` gives atomicity.
- Forgetting to unlock in `finally` when using `Lock`.
- Double-checked locking without `volatile`.
- Assuming `String` field mutations are safe without `volatile`/`final`.

---

## Key Interview Tips

- Explain the visibility problem and why `volatile` fixes it but doesn't give atomicity.
- Know that `synchronized` provides both mutual exclusion and visibility.
- Explain why `wait`/`notify` are on `Object`, not `Thread`.
- Give the double-checked locking example with `volatile`.
- Mention the happens-before rules and how they enable safe publication.

---

## Related

- [Threads Basics](threads-basics.md) — thread lifecycle
- [Concurrency Utilities](concurrency-utilities.md) — atomics, latches, barriers
- [Deadlock & Liveness](deadlock-and-liveness.md) — deadlock detection and prevention
- [Concurrent Collections](../collections/concurrent-collections.md) — thread-safe collections
- [Immutable Objects](../design-patterns-java/immutable-objects.md) — safe publication