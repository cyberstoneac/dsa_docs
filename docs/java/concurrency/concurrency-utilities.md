# Concurrency Utilities

> **JDK context:** `java.util.concurrent` arrived in Java 5, bringing
> `Semaphore`, `CountDownLatch`, `CyclicBarrier`, and the atomic package.
> `Phaser` (Java 7) and `CompletableFuture` (Java 8) extended the toolkit.

## Mental Model

The `java.util.concurrent` utilities fall into three families:

1. **Synchronizers** — coordinate thread execution (`Semaphore`, `Latch`, `Barrier`, `Phaser`)
2. **Atomics** — lock-free, CAS-based primitives (`AtomicInteger`, `AtomicReference`, etc.)
3. **Concurrent collections** — covered in [Concurrent Collections](../collections/concurrent-collections.md)

```d2
direction: right

juc: "java.util.concurrent" {
  style.fill: "#f5f5f5"

  sync: "Synchronizers" {
    style.fill: "#c8e6c9"
    desc: "Semaphore, CountDownLatch,\nCyclicBarrier, Phaser,\nExchanger"
  }

  atomic: "Atomics" {
    style.fill: "#bbdefb"
    desc: "AtomicInteger, AtomicLong,\nAtomicReference,\nLongAdder"
  }

  coll: "Concurrent Collections" {
    style.fill: "#fff9c4"
    desc: "ConcurrentHashMap,\nBlockingQueue,\nCopyOnWriteArrayList"
  }
}
```

**Why these exist:** raw `synchronized` + `wait`/`notify` is error-prone and
low-level. These utilities encapsulate common coordination patterns with
well-tested, efficient implementations.

---

## `AtomicInteger` and the Atomic Family

Lock-free thread-safe operations on single variables, using **CAS**
(compare-and-swap).

### The basic problem

```java
// NOT thread-safe — lost updates under contention
int counter = 0;
counter++;
```

You could use `synchronized`:

```java
private int counter = 0;
public synchronized void increment() { counter++; }
```

But atomics are faster and simpler:

```java
private final AtomicInteger counter = new AtomicInteger(0);
public void increment() { counter.incrementAndGet(); }
```

### Core API

```java
AtomicInteger counter = new AtomicInteger(0);

counter.incrementAndGet();          // ++counter → 1
counter.getAndIncrement();          // counter++ → 1, returns 0
counter.decrementAndGet();          // --counter
counter.getAndDecrement();          // counter--

counter.addAndGet(5);               // += 5
counter.getAndAdd(5);               // += 5, returns old

counter.compareAndSet(0, 10);       // if current == 0, set to 10
counter.get();                      // read

counter.updateAndGet(x -> x * 2);   // transform
counter.accumulateAndGet(3, Integer::sum);  // combine
```

### Atomic family

| Class | Purpose |
|---|---|
| `AtomicInteger` | `int` |
| `AtomicLong` | `long` |
| `AtomicBoolean` | `boolean` |
| `AtomicReference<T>` | Object references |
| `AtomicIntegerArray` / `AtomicLongArray` | Arrays (element-level atomicity) |
| `AtomicReferenceArray<T>` | Object arrays |
| `AtomicStampedReference<T>` | Reference + version stamp (avoids ABA) |
| `AtomicMarkableReference<T>` | Reference + boolean flag |

### `LongAdder` (Java 8+) — higher throughput counters

Under heavy contention, `AtomicLong` spins on CAS retries. `LongAdder`
maintains a **cell array** to reduce contention:

```java
LongAdder counter = new LongAdder();

counter.increment();       // no return value
counter.add(10);
long total = counter.sum();   // aggregates all cells
```

| | `AtomicLong` | `LongAdder` |
|---|---|---|
| Throughput under contention | Lower | Higher |
| Read (`sum()`) | O(1) | O(#cells) |
| Use when | Frequent reads | Frequent writes |
| `getAndIncrement()` | ✅ | ❌ |

**Rule:** `AtomicLong` when you need the value returned on each op.
`LongAdder` when you mostly increment and occasionally read.

---

## CAS — Compare-And-Swap

The primitive behind all atomics.

```java
boolean compareAndSet(int expected, int newValue)
```

**Semantics:**
1. Read current value
2. If `current == expected`, atomically write `newValue` and return true
3. Otherwise, do nothing and return false

### Under the hood

On x86: `lock cmpxchg` instruction.
On ARM: `ldrex`/`strex` pair.
At the JVM level: `sun.misc.Unsafe.compareAndSwapInt` (older) or `VarHandle`
(Java 9+, preferred).

### Implementing `incrementAndGet` with CAS

```java
public final int incrementAndGet() {
    for (;;) {
        int current = get();
        int next = current + 1;
        if (compareAndSet(current, next)) {
            return next;
        }
        // someone else changed it; retry
    }
}
```

The retry loop is why atomics can livelock under extreme contention.
`LongAdder` sidesteps this by using multiple cells.

### ABA problem

CAS can't detect `A → B → A`. A thread reads `A`, another changes it to `B`
and back to `A`, and the CAS succeeds — even though state changed twice.

**Fix:** use `AtomicStampedReference` (adds a version counter):

```java
AtomicStampedReference<String> ref = new AtomicStampedReference<>("A", 0);

int[] stamp = new int[1];
String value = ref.get(stamp);

ref.compareAndSet(value, "B", stamp[0], stamp[0] + 1);
```

ABA is rare in practice — matters for lock-free algorithms on reused objects.

### `VarHandle` (Java 9+)

The modern replacement for `sun.misc.Unsafe`:

```java
private static final VarHandle COUNTER;

static {
    try {
        COUNTER = MethodHandles.lookup()
                .findVarHandle(Counter.class, "value", int.class);
    } catch (ReflectiveOperationException e) {
        throw new ExceptionInInitializerError(e);
    }
}

private volatile int value;

public void increment() {
    int current;
    do {
        current = (int) COUNTER.getVolatile(this);
    } while (!COUNTER.compareAndSet(this, current, current + 1));
}
```

Verbose but safe. Libraries and frameworks use this.

---

## `Semaphore` — Bounded Concurrency

A permit-based counter. Threads acquire permits to proceed; release them when
done.

```java
Semaphore semaphore = new Semaphore(3);   // 3 permits
```

### Basic usage

```java
class ConnectionPool {
    private final Semaphore permits;

    ConnectionPool(int maxConnections) {
        this.permits = new Semaphore(maxConnections);
    }

    Connection acquire() throws InterruptedException {
        permits.acquire();      // blocks if no permits available
        return createConnection();
    }

    void release(Connection c) {
        c.close();
        permits.release();      // returns a permit
    }
}
```

### Methods

```java
semaphore.acquire();                 // blocks, acquires 1 permit
semaphore.acquire(3);                // acquires 3 permits
semaphore.tryAcquire();              // non-blocking, returns boolean
semaphore.tryAcquire(timeout, unit); // timed
semaphore.release();                 // adds 1 permit
semaphore.release(3);                // adds 3 permits
semaphore.availablePermits();        // current count (approximate)
```

### Binary semaphore

A `Semaphore(1)` acts like a mutex:

```java
Semaphore mutex = new Semaphore(1);
mutex.acquire();
try {
    // critical section
} finally {
    mutex.release();
}
```

**Different from `synchronized`:** semaphores are **not reentrant** — the
same thread cannot acquire twice (it would deadlock).

### Fairness

```java
Semaphore fair = new Semaphore(3, true);   // FIFO
```

Fair semaphores reduce starvation but hurt throughput.

### Real use — rate limiting

```java
class RateLimiter {
    private final Semaphore permits;

    RateLimiter(int requestsPerSecond) {
        this.permits = new Semaphore(requestsPerSecond);
    }

    void tryConsume() throws InterruptedException {
        permits.acquire();
        // reset permits every second via a scheduler
    }
}
```

### Interview answer — "1000 threads access a method but not others"

```java
class Resource {
    private final Semaphore permits = new Semaphore(1000);

    void access() throws InterruptedException {
        permits.acquire();
        try {
            // up to 1000 concurrent threads
        } finally {
            permits.release();
        }
    }
}
```

---

## `CountDownLatch` — One-Time Barrier

A countdown counter. Threads wait until the count reaches zero.

```java
CountDownLatch latch = new CountDownLatch(3);   // must count down 3 times
```

### Basic pattern — wait for N tasks

```java
ExecutorService executor = Executors.newFixedThreadPool(3);
CountDownLatch latch = new CountDownLatch(3);

for (int i = 0; i < 3; i++) {
    executor.submit(() -> {
        try {
            doWork();
        } finally {
            latch.countDown();   // decrement
        }
    });
}

latch.await();   // blocks until count == 0
System.out.println("All tasks complete");
executor.shutdown();
```

### Start signal pattern

```java
CountDownLatch startSignal = new CountDownLatch(1);

for (int i = 0; i < 5; i++) {
    new Thread(() -> {
        try {
            startSignal.await();   // wait for the gun
            doWork();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }).start();
}

startSignal.countDown();   // fire the gun — all 5 start
```

### Rules

- **One-time use** — once the count hits zero, it stays zero forever
- Cannot be reset
- `await()` without timeout blocks indefinitely
- `await(timeout, unit)` returns `false` on timeout

### When to use

- Wait for N tasks to finish before proceeding
- Start N threads simultaneously (test rigs)
- Test setup/teardown coordination

**For reusable barriers, use `CyclicBarrier`.**

---

## `CyclicBarrier` — Reusable Barrier

Threads wait for each other at a barrier point. When all arrive, they're
released and the barrier resets.

```java
CyclicBarrier barrier = new CyclicBarrier(3);   // 3 parties
```

### Basic pattern

```java
Runnable task = () -> {
    try {
        System.out.println(Thread.currentThread().getName() + " arrived");
        barrier.await();   // wait for all 3
        System.out.println(Thread.currentThread().getName() + " proceeding");
    } catch (Exception e) {
        Thread.currentThread().interrupt();
    }
};

for (int i = 0; i < 3; i++) {
    new Thread(task).start();
}
```

**Output:**

```text
Thread-0 arrived
Thread-1 arrived
Thread-2 arrived
Thread-2 proceeding
Thread-0 proceeding
Thread-1 proceeding
```

All three must arrive before any proceeds. The barrier then resets, and the
next round of 3 can use it.

### Barrier action

Run something when the barrier trips:

```java
CyclicBarrier barrier = new CyclicBarrier(3, () -> {
    System.out.println("All arrived — running action");
});
```

Runs once per round, on the last thread to arrive.

### `CountDownLatch` vs `CyclicBarrier`

| | `CountDownLatch` | `CyclicBarrier` |
|---|---|---|
| Reusable | ❌ | ✅ |
| Direction | One-way (down) | Meeting point |
| Waiters vs counters | Different threads | Same threads |
| Reset | ❌ | Automatic (or `reset()`) |
| Typical use | "Wait for N things" | "Wait for all peers" |

### Broken barrier

If any waiting thread is interrupted or times out, the barrier becomes
**broken** and all others throw `BrokenBarrierException`. Use
`barrier.isBroken()` to check.

---

## `Phaser` (Java 7+) — Dynamic Barrier

A more flexible barrier that supports **dynamic registration**.

```java
Phaser phaser = new Phaser(1);   // register the main thread
```

Phases can add and remove parties at runtime.

### Basic pattern

```java
Phaser phaser = new Phaser();

for (int i = 0; i < 3; i++) {
    phaser.register();
    new Thread(() -> {
        try {
            doPhase1();
            phaser.arriveAndAwaitAdvance();   // wait for all
            doPhase2();
            phaser.arriveAndDeregister();      // leave
        } catch (Exception e) {
            Thread.currentThread().interrupt();
        }
    }).start();
}
```

### When to use

- Multi-phase computations
- Workloads where participant count changes
- When you need more than `CyclicBarrier` offers

**Rarely used in practice** — `CyclicBarrier` covers most needs.

---

## `Exchanger`

Two threads swap values at a rendezvous point.

```java
Exchanger<String> exchanger = new Exchanger<>();

// Thread A
String received = exchanger.exchange("from A");
// blocks until B calls exchange

// Thread B
String received2 = exchanger.exchange("from B");
```

Both threads block until the other arrives, then swap values. Used in
pipeline patterns and genetic algorithms.

**Rarely used.**

---

## Producer-Consumer — Three Ways

### 1. `BlockingQueue` (preferred)

```java
BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(10);

Runnable producer = () -> {
    try {
        for (int i = 0; i < 100; i++) {
            queue.put(i);           // blocks if full
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
};

Runnable consumer = () -> {
    try {
        while (true) {
            Integer item = queue.take();   // blocks if empty
            process(item);
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
};
```

### 2. `synchronized` + `wait`/`notify`

Covered in [Synchronization](synchronization.md).

### 3. `Semaphore`-based

```java
class Buffer<T> {
    private final Semaphore empty;
    private final Semaphore full = new Semaphore(0);
    private final Queue<T> queue = new LinkedList<>();

    Buffer(int capacity) {
        this.empty = new Semaphore(capacity);
    }

    void put(T item) throws InterruptedException {
        empty.acquire();       // wait for space
        synchronized (queue) {
            queue.add(item);
        }
        full.release();        // signal item available
    }

    T take() throws InterruptedException {
        full.acquire();        // wait for item
        T item;
        synchronized (queue) {
            item = queue.poll();
        }
        empty.release();       // signal space available
        return item;
    }
}
```

**Prefer `BlockingQueue`** — simpler and less error-prone.

---

## Summary Table

| Utility | Purpose | Reusable | Blocking |
|---|---|---|---|
| `Semaphore` | Limit concurrent access | ✅ | ✅ |
| `CountDownLatch` | Wait for N events | ❌ | ✅ |
| `CyclicBarrier` | Wait for peers at a point | ✅ | ✅ |
| `Phaser` | Dynamic multi-phase barrier | ✅ | ✅ |
| `Exchanger` | Swap values between 2 threads | ✅ | ✅ |
| `AtomicInteger` | Lock-free counter | ✅ | ❌ |
| `LongAdder` | High-throughput counter | ✅ | ❌ |
| `BlockingQueue` | Producer-consumer | ✅ | ✅ |

---

## Tricky Corners ⚠️

**`Semaphore` is not reentrant.** The same thread acquiring twice can deadlock.

**`CountDownLatch.await()` returns void; `await(timeout)` returns boolean.**
Check the return value.

**`CountDownLatch` count cannot go negative** — extra `countDown()` calls are
no-ops, but they don't undo.

**`CyclicBarrier` is broken by interruption or timeout.** All remaining waiters
get `BrokenBarrierException`.

**`CyclicBarrier` cannot be used by a thread pool smaller than its parties.**
If you have a barrier of 3 but a pool of 2 threads, the third never arrives →
deadlock.

**`AtomicReference.compareAndSet` uses `==`, not `equals`.** Value equality
requires manual implementation.

**`LongAdder.sum()` is not atomic.** Under concurrent updates, it's a snapshot
of cells, not a consistent read.

**`AtomicInteger.incrementAndGet()` under contention can livelock** — rare
but possible. `LongAdder` trades reads for this.

**`Phaser.arriveAndAwaitAdvance` will block forever if you forget to register.**

**`Exchanger` requires exactly two threads.** More than two → undefined
pairing.

**`Semaphore` permits can be over-released.** `release()` on a semaphore with
max permits keeps increasing the count. Use `reducePermits()` or track manually.

**`AtomicInteger` is not a substitute for `synchronized`** for multi-variable
invariants. Only single-variable operations are atomic.

---

## Common Pitfalls

- Using `Semaphore` as a mutex and assuming reentrancy.
- Reusing a `CountDownLatch` — use `CyclicBarrier` instead.
- Forgetting that `CyclicBarrier` breaks on interrupt.
- Assuming `LongAdder.sum()` is atomic.
- Using `AtomicInteger` for multi-variable invariants.
- Forgetting to release semaphore permits — leaks capacity.
- Using `Exchanger` with more than 2 threads.

---

## Key Interview Tips

- Explain CAS and why atomics are lock-free.
- Distinguish `AtomicLong` from `LongAdder`.
- Distinguish `CountDownLatch` (one-way) from `CyclicBarrier` (reusable).
- Use `Semaphore` when asked about "limit concurrent access."
- Mention `BlockingQueue` first for producer-consumer.
- Know that `Semaphore` is not reentrant.

---

## Related

- [Threads Basics](threads-basics.md) — thread lifecycle
- [Synchronization](synchronization.md) — locks and `volatile`
- [Executors & Futures](executors-and-futures.md) — thread pools
- [Concurrent Collections](../collections/concurrent-collections.md) — `BlockingQueue`
- [Virtual Threads](virtual-threads.md) — modern concurrency