# Concurrency Basics

Concurrency is where LLD interviews separate seniors from juniors. Many LLD problems — Producer-Consumer, LRU Cache, Thread Pool, Dining Philosophers — are entirely about coordinating threads. Even "ordinary" problems like Parking Lot require you to think about two cars arriving at the same moment.

This page covers **Java 17 concurrency**: primitives, locks, `java.util.concurrent`, and the patterns you'll use in every LLD problem.

---

## 📐 Why Concurrency Matters in LLD

- **Correctness**: Concurrent access to shared state breaks without coordination
- **Performance**: Locks are expensive; knowing when to avoid them matters
- **Interview signal**: Talking about `synchronized` vs `ReentrantLock` vs `AtomicInteger` shows depth
- **Real-world**: Every production service is multi-threaded

---

## 1. The Core Problem: Race Conditions

A **race condition** occurs when two threads access shared mutable state without coordination.

### ❌ Broken Example

```java
public class Counter {
    private int count = 0;

    public void increment() {
        count++;   // NOT atomic: read, add, write
    }

    public int get() { return count; }
}
```

**Why it breaks:** `count++` compiles to three bytecode instructions. Two threads can both read `count = 5`, both compute `6`, both write `6` — one increment is lost.

### ✅ Fixed with `synchronized`

```java
public class Counter {
    private int count = 0;

    public synchronized void increment() {
        count++;
    }

    public synchronized int get() {
        return count;
    }
}
```

### ✅ Or with `AtomicInteger`

```java
public class Counter {
    private final AtomicInteger count = new AtomicInteger(0);

    public void increment() {
        count.incrementAndGet();   // lock-free, atomic
    }

    public int get() { return count.get(); }
}
```

**When to use which:**
- `synchronized` — general purpose, familiar, blocks on contention
- `AtomicInteger` — high-contention counters, lock-free, only supports simple ops
- `LongAdder` — even higher contention; better throughput than `AtomicInteger`

### The Three Requirements for a Race

All three must hold for a race condition to exist:
1. **Two or more threads** access the same resource
2. **At least one** writes
3. **No synchronization** between them

Remove any one → no race. Most fixes work by adding synchronization (rule 3).

---

## 2. The Java Memory Model (JMM)

Java threads have their own **caches**. Without synchronization, Thread B may not see Thread A's write.

### The Visibility Problem

```java
public class VisibilityDemo {
    private static boolean running = true;

    public static void main(String[] args) {
        new Thread(() -> {
            while (running) { /* spin */ }
            System.out.println("Stopped");
        }).start();

        try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
        running = false;   // main thread writes false
    }
}
```

**Problem:** The worker thread may cache `running = true` and never see the update. The loop runs forever.

### Fixes

**Option 1 — `volatile`**

```java
private static volatile boolean running = true;
```

`volatile` guarantees **visibility** but not **atomicity**. It's for one writer, many readers — flags, status fields, `volatile` references.

**Option 2 — `synchronized`**

```java
public synchronized void stop() { running = false; }
public synchronized boolean isRunning() { return running; }
```

`synchronized` guarantees both visibility and atomicity.

### The `happens-before` Relation

Java guarantees:
- An **unlock** happens-before a subsequent **lock** on the same monitor
- A **volatile write** happens-before a subsequent **volatile read** of the same variable
- A **thread start** happens-before any action in the started thread
- A **thread join** happens-before the joining thread continues

**In practice:** If Thread A writes and then synchronizes, and Thread B synchronizes and then reads, Thread B sees A's write.

### The DCL (Double-Checked Locking) Bug

```java
// BROKEN (pre-Java 5)
private static Singleton instance;

public static Singleton getInstance() {
    if (instance == null) {              // read outside lock
        synchronized (Singleton.class) {
            if (instance == null) {
                instance = new Singleton();   // may publish partially-constructed
            }
        }
    }
    return instance;
}
```

**Fix:**
```java
private static volatile Singleton instance;   // volatile!
```

The `volatile` prevents the constructor from being reordered after the assignment.

**Modern alternative:** Use an enum-based singleton or a holder class — no locks needed.

```java
public enum Singleton { INSTANCE; }

// or
public class Singleton {
    private Singleton() {}
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() { return Holder.INSTANCE; }
}
```

---

## 3. Synchronization Primitives

### 3.1 `synchronized` — Intrinsic Lock

**Method-level:**
```java
public synchronized void deposit(Money m) { /* ... */ }
```

**Block-level:**
```java
public void deposit(Money m) {
    synchronized (this) {
        balance = balance.add(m);
    }
}
```

**Static method:** locks on `ClassName.class`.

**Pros:**
- Simple, no explicit unlock
- JVM-optimized (biased locking, lock elision)
- Always released on exception

**Cons:**
- No timeout — a thread can block forever
- No interrupt — can't cancel a blocked acquire
- Not fair (though JVM may give some fairness)
- Coarse-grained — one lock per object

### 3.2 `ReentrantLock` — Explicit Lock

```java
private final ReentrantLock lock = new ReentrantLock();

public void transfer(Account to, Money amount) {
    lock.lock();
    try {
        // critical section
    } finally {
        lock.unlock();   // MUST unlock in finally
    }
}
```

**Advantages over `synchronized`:**

| Feature | `synchronized` | `ReentrantLock` |
|---|---|---|
| Explicit lock/unlock | No | Yes |
| Timed `tryLock(timeout)` | No | Yes |
| Interruptible acquire | No | Yes |
| Fair mode | No | Yes (`new ReentrantLock(true)`) |
| Condition variables | Single | Multiple (`newCondition()`) |
| Try-without-blocking | No | `tryLock()` |

**`tryLock` example:**
```java
if (lock.tryLock(500, TimeUnit.MILLISECONDS)) {
    try { /* ... */ } finally { lock.unlock(); }
} else {
    // couldn't acquire in time — do something else
}
```

**Rule:** Always `unlock()` in a `finally` block.

### 3.3 `ReentrantReadWriteLock` — Readers-Writer

**When reads >> writes**, allow multiple concurrent readers but exclusive writers.

```java
private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
private final Lock readLock = rwLock.readLock();
private final Lock writeLock = rwLock.writeLock();

public String read(String key) {
    readLock.lock();
    try { return store.get(key); }
    finally { readLock.unlock(); }
}

public void write(String key, String value) {
    writeLock.lock();
    try { store.put(key, value); }
    finally { writeLock.unlock(); }
}
```

**Semantics:**
- Multiple readers can hold `readLock` simultaneously
- Only one thread can hold `writeLock`
- A `writeLock` acquire waits for all readers to release

**Caveat:** `StampedLock` (Java 8+) is faster but doesn't support reentrancy.

### 3.4 `StampedLock` — Optimistic Reads

```java
private final StampedLock lock = new StampedLock();
private double x, y;

public double distanceFromOrigin() {
    long stamp = lock.tryOptimisticRead();
    double cx = x, cy = y;
    if (!lock.validate(stamp)) {              // write happened → retry
        stamp = lock.readLock();
        try { cx = x; cy = y; }
        finally { lock.unlockRead(stamp); }
    }
    return Math.sqrt(cx * cx + cy * cy);
}

public void move(double dx, double dy) {
    long stamp = lock.writeLock();
    try { x += dx; y += dy; }
    finally { lock.unlockWrite(stamp); }
}
```

**When to use:** Read-heavy, want to avoid blocking readers even briefly.

**Trade-off:** Non-reentrant; can't upgrade read → write without unlocking.

### 3.5 `Semaphore` — Counting Semaphore

**Limits concurrent access** to N permits.

```java
private final Semaphore permits = new Semaphore(5);   // 5 concurrent

public void accessResource() throws InterruptedException {
    permits.acquire();
    try {
        // at most 5 threads here at once
    } finally {
        permits.release();
    }
}
```

**Use cases:**
- Connection pools (max N connections)
- Rate limiting (max N requests/sec)
- Parking lot (N spots)

### 3.6 `CountDownLatch` — Wait for N Events

**One-shot barrier:** a thread waits until a counter reaches zero.

```java
CountDownLatch latch = new CountDownLatch(3);

for (int i = 0; i < 3; i++) {
    new Thread(() -> {
        doWork();
        latch.countDown();
    }).start();
}

latch.await();      // waits until all 3 finish
System.out.println("All workers done");
```

**Use cases:**
- Wait for N services to start
- Wait for N tasks to finish
- Startup synchronization

**Note:** Once the count hits zero, the latch cannot be reset.

### 3.7 `CyclicBarrier` — Reusable Barrier

**Like `CountDownLatch` but resettable.**

```java
CyclicBarrier barrier = new CyclicBarrier(3, () -> System.out.println("All arrived"));

for (int i = 0; i < 3; i++) {
    new Thread(() -> {
        doPhase1();
        barrier.await();   // all 3 wait here
        doPhase2();
    }).start();
}
```

**Use cases:**
- Multi-phase parallel computation
- Simulation loops

### 3.8 `Phaser` — Advanced Barrier

Flexible version of `CyclicBarrier` with **dynamic registration**.

```java
Phaser phaser = new Phaser(1);   // register self
for (Task t : tasks) {
    phaser.register();
    new Thread(() -> {
        doWork();
        phaser.arriveAndAwaitAdvance();
    }).start();
}
phaser.arriveAndDeregister();
```

**Use:** Rarely needed; covers exotic scenarios.

---

## 4. Atomic Classes

`java.util.concurrent.atomic` provides lock-free primitives.

### `AtomicInteger`, `AtomicLong`, `AtomicBoolean`

```java
AtomicInteger count = new AtomicInteger(0);
count.incrementAndGet();          // ++count
count.getAndIncrement();          // count++
count.addAndGet(5);
count.compareAndSet(5, 10);       // CAS: if current == 5, set to 10
```

### `AtomicReference<T>`

```java
AtomicReference<Status> status = new AtomicReference<>(Status.IDLE);
status.compareAndSet(Status.IDLE, Status.RUNNING);
```

**CAS (Compare-And-Swap):** hardware-level atomic op — the foundation of lock-free algorithms.

### `LongAdder` — High-Contention Counter

```java
LongAdder counter = new LongAdder();
counter.increment();   // scales better than AtomicLong under contention
long total = counter.sum();
```

**Why faster:** Internal striping — multiple cells summed on read.

### `AtomicReferenceFieldUpdater` and `VarHandle`

Advanced: update fields atomically without `AtomicReference` wrapper. Rarely needed in LLD.

---

## 5. Concurrent Collections

`java.util.concurrent` provides thread-safe collections.

### 5.1 `ConcurrentHashMap`

**The workhorse.** Lock-free reads, fine-grained locking on writes.

```java
ConcurrentHashMap<String, Ticket> activeTickets = new ConcurrentHashMap<>();

activeTickets.put(id, ticket);
Ticket t = activeTickets.get(id);                       // lock-free
activeTickets.computeIfAbsent(id, k -> createTicket()); // atomic
activeTickets.remove(id);

// Atomic updates
activeTickets.merge(id, ticket, (oldV, newV) -> newV);
activeTickets.compute(id, (k, v) -> v == null ? null : v.close());
```

**Why not `HashMap`?** Even with external locks, `HashMap` can throw `ConcurrentModificationException` during iteration. `ConcurrentHashMap` has weak-consistent iterators — safe to iterate while modifying.

**Why not `Collections.synchronizedMap()`?** Every read locks the whole map. `ConcurrentHashMap` allows concurrent reads and fine-grained writes.

### 5.2 `CopyOnWriteArrayList`

**Best for: many reads, rare writes.**

```java
CopyOnWriteArrayList<ParkingObserver> observers = new CopyOnWriteArrayList<>();
observers.add(listener);   // copies the entire list internally

for (ParkingObserver o : observers) {
    o.onSpotChanged(spot);   // safe iteration
}
```

**When to use:** Listener lists, config lists, anything read frequently but written rarely.

**Cost:** Every write copies the whole list — O(n). Don't use for large lists or frequent writes.

### 5.3 `BlockingQueue`

**The backbone of Producer-Consumer.**

```java
BlockingQueue<Ticket> queue = new LinkedBlockingQueue<>(1000);

// Producer
queue.put(ticket);        // blocks if full
queue.offer(ticket, 1, TimeUnit.SECONDS);  // blocks with timeout

// Consumer
Ticket t = queue.take();  // blocks if empty
Ticket t = queue.poll(1, TimeUnit.SECONDS); // blocks with timeout
```

**Implementations:**

| Impl | Backing | Best for |
|---|---|---|
| `ArrayBlockingQueue` | Fixed array | Bounded, fair option |
| `LinkedBlockingQueue` | Linked nodes | High throughput, optional bound |
| `PriorityBlockingQueue` | Heap | Priority ordering |
| `DelayQueue` | Priority + delay | Scheduled tasks |
| `SynchronousQueue` | Handoff | Zero-capacity handoff |
| `LinkedTransferQueue` | Linked | More efficient than LinkedBlockingQueue |

**Producer-Consumer pattern:**

```java
public class Producer implements Runnable {
    private final BlockingQueue<Item> queue;
    public void run() {
        while (running) {
            queue.put(produce());    // blocks if full
        }
    }
}

public class Consumer implements Runnable {
    private final BlockingQueue<Item> queue;
    public void run() {
        while (running) {
            Item item = queue.take();   // blocks if empty
            consume(item);
        }
    }
}
```

**This is the single most important concurrency pattern for LLD interviews.**

### 5.4 `ConcurrentLinkedQueue` / `ConcurrentLinkedDeque`

Non-blocking queues. Use when you don't need blocking.

```java
ConcurrentLinkedQueue<Event> events = new ConcurrentLinkedQueue<>();
events.offer(e);
Event e = events.poll();
```

**Faster than `LinkedBlockingQueue`** when you have your own signaling.

### 5.5 `ConcurrentSkipListMap` / `ConcurrentSkipListSet`

Sorted, concurrent. Use for **ordered** concurrent maps.

```java
ConcurrentSkipListMap<Long, Order> ordersByTime = new ConcurrentSkipListMap<>();
ordersByTime.put(timestamp, order);
Map.Entry<Long, Order> first = ordersByTime.firstEntry();
```

**Slower than `ConcurrentHashMap`** but supports range queries.

### 5.6 Choosing a Collection

| Need | Use |
|---|---|
| Concurrent map | `ConcurrentHashMap` |
| Concurrent map, sorted | `ConcurrentSkipListMap` |
| Concurrent set | `ConcurrentHashMap.newKeySet()` |
| Concurrent list, rare writes | `CopyOnWriteArrayList` |
| Producer-consumer | `BlockingQueue` |
| Non-blocking queue | `ConcurrentLinkedQueue` |
| Non-blocking stack | `ConcurrentLinkedDeque` |
| Thread-local | `ThreadLocal<T>` |

---

## 6. Executors and Thread Pools

**Don't create threads manually. Use `ExecutorService`.**

### 6.1 The Basics

```java
ExecutorService pool = Executors.newFixedThreadPool(10);

Future<Result> future = pool.submit(() -> compute());
Result r = future.get();   // blocks until done

pool.shutdown();
pool.awaitTermination(10, TimeUnit.SECONDS);
```

### 6.2 Pool Types

| Method | Use case |
|---|---|
| `newFixedThreadPool(n)` | Bounded pool; steady load |
| `newCachedThreadPool()` | Elastic; short tasks |
| `newSingleThreadExecutor()` | Serial execution |
| `newScheduledThreadPool(n)` | Periodic / delayed tasks |
| `newWorkStealingPool()` | Fork-join; CPU-bound |
| `newVirtualThreadPerTaskExecutor()` | **Java 21** — virtual threads |

### 6.3 `ThreadPoolExecutor` — Full Control

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    4,                              // core size
    16,                             // max size
    60, TimeUnit.SECONDS,           // idle timeout
    new ArrayBlockingQueue<>(100),  // work queue
    new ThreadPoolExecutor.CallerRunsPolicy()   // rejection policy
);
```

**Rejection policies:**
- `AbortPolicy` (default) — throw `RejectedExecutionException`
- `CallerRunsPolicy` — run in caller thread (backpressure)
- `DiscardPolicy` — silently drop
- `DiscardOldestPolicy` — drop oldest queued task

**Rule:** Never use `Executors.newFixedThreadPool()` in production — the unbounded queue can OOM. Use `ThreadPoolExecutor` directly with a bounded queue.

### 6.4 `Future` and `CompletableFuture`

**`Future`:** basic async result.

```java
Future<Integer> f = pool.submit(() -> compute());
int result = f.get(5, TimeUnit.SECONDS);
f.cancel(true);
```

**`CompletableFuture`:** composable async.

```java
CompletableFuture<User> user = fetchUserAsync(userId);

CompletableFuture<Order> order = user
    .thenCompose(u -> fetchLatestOrderAsync(u.id()))
    .exceptionally(ex -> Order.empty());

// Combine two async results
CompletableFuture<Pair> combined = user.thenCombine(order, Pair::new);

// Wait for all
CompletableFuture.allOf(f1, f2, f3).join();
```

**Use `CompletableFuture` for:**
- Chaining async calls
- Combining results
- Error handling
- Timeouts

### 6.5 Virtual Threads (Java 21)

**Lightweight threads** managed by the JVM. Millions of them; blocking is cheap.

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            Thread.sleep(1000);   // blocks only the virtual thread, not the OS thread
            return null;
        });
    }
}
```

**When to use:**
- I/O-bound work with blocking APIs (JDBC, HTTP clients)
- Massive concurrency without tuning thread pools

**When NOT to use:**
- CPU-bound work (use `ForkJoinPool` or fixed pool)
- Heavy use of `synchronized` (pins the carrier thread — use `ReentrantLock` instead in Java 21)

---

## 7. Concurrency Patterns for LLD

These are the patterns you'll use in real LLD problems.

### 7.1 Producer-Consumer

**Already shown above with `BlockingQueue`.** The canonical pattern.

**Used in:** Message Queue, Task Scheduler, Thread Pool, Logging Pipeline.

### 7.2 Read-Write Lock

**Multiple readers, one writer.**

```java
public class ConfigStore {
    private final Map<String, String> config = new HashMap<>();
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    public String get(String key) {
        lock.readLock().lock();
        try { return config.get(key); }
        finally { lock.readLock().unlock(); }
    }

    public void set(String key, String value) {
        lock.writeLock().lock();
        try { config.put(key, value); }
        finally { lock.writeLock().unlock(); }
    }
}
```

**Used in:** Cache (LRU with readers), Config, Routing tables.

### 7.3 Immutable Snapshot

**Avoid locks by making state immutable.** On change, replace the whole object.

```java
public class ParkingLotState {
    private final Map<SpotType, Integer> available;

    public ParkingLotState(Map<SpotType, Integer> available) {
        this.available = Map.copyOf(available);   // immutable
    }
    public int get(SpotType type) { return available.getOrDefault(type, 0); }
}

public class ParkingLot {
    private volatile ParkingLotState state;   // volatile reference

    public void updateState(Map<SpotType, Integer> available) {
        state = new ParkingLotState(available);   // atomic replace
    }

    public int available(SpotType type) {
        return state.get(type);   // no lock needed
    }
}
```

**Used in:** Config, Cache, immutable DTOs.

### 7.4 ThreadLocal

**Per-thread state** — avoids sharing entirely.

```java
private static final ThreadLocal<SimpleDateFormat> dateFormat =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

String formatted = dateFormat.get().format(new Date());
```

**Caveat:** Always `remove()` in thread pools (avoid leaks).

```java
try {
    // use threadLocal
} finally {
    dateFormat.remove();
}
```

**Used in:** Request context, transaction context, per-thread formatters.

### 7.5 Compare-And-Swap (CAS)

**Lock-free update** using a hardware atomic.

```java
AtomicReference<Node> head = new AtomicReference<>();

public void push(Node n) {
    Node oldHead;
    do {
        oldHead = head.get();
        n.next = oldHead;
    } while (!head.compareAndSet(oldHead, n));   // retry if changed
}
```

**Used in:** Lock-free stacks, queues, counters.

### 7.6 Double-Checked Locking

**Lazy init with minimal locking** — needs `volatile`.

```java
private volatile Singleton instance;

public Singleton getInstance() {
    if (instance == null) {
        synchronized (this) {
            if (instance == null) {
                instance = new Singleton();
            }
        }
    }
    return instance;
}
```

**Modern alternative:** holder class (no lock needed).

---

## 8. Common Pitfalls

### 8.1 Deadlock

**Four threads, four locks, circular wait.**

```java
// Thread A
synchronized (lock1) { synchronized (lock2) { /* ... */ } }

// Thread B
synchronized (lock2) { synchronized (lock1) { /* ... */ } }  // DEADLOCK
```

**Fixes:**
1. **Lock ordering** — always acquire locks in the same global order
2. **Timeouts** — `tryLock(timeout)` and back off
3. **Single lock** — if possible, use one lock
4. **Lock-free** — atomic / immutable

### 8.2 Livelock

Threads are active but not making progress (e.g., two threads keep retrying and backing off simultaneously).

**Fix:** Randomized backoff, jitter.

### 8.3 Starvation

A thread never gets scheduled (e.g., high-priority thread monopolizes lock).

**Fix:** Fair locks (`new ReentrantLock(true)`), priority tuning.

### 8.4 Lost Update

Two threads read-modify-write the same variable.

**Fix:** `synchronized`, `AtomicInteger`, `ConcurrentHashMap.compute`.

### 8.5 Deadlock Detection (JVM)

- `jstack <pid>` — shows deadlocks
- `jconsole` — GUI
- `ThreadMXBean.findDeadlockedThreads()`

### 8.6 Publishing `this` from Constructor

```java
public class Broken {
    public Broken(EventBus bus) {
        bus.subscribe(this);   // `this` escapes before construction complete
    }
}
```

**Fix:** Don't publish `this` in constructor. Use a factory method.

### 8.7 Forgetting to Unlock

```java
lock.lock();
doWork();       // if this throws, lock never released
lock.unlock();
```

**Fix:** Always `try/finally`.

```java
lock.lock();
try { doWork(); }
finally { lock.unlock(); }
```

### 8.8 Synchronized on `String` or Autoboxed Primitives

```java
synchronized ("lock") { /* ... */ }    // same object across JVM!
synchronized (Integer.valueOf(1)) { /* ... */ }   // cached Integer
```

**Fix:** Use a dedicated `private final Object lock = new Object();`.

### 8.9 ConcurrentHashMap `size()` is Not Exact

```java
if (map.size() < LIMIT) { map.put(k, v); }   // race!
```

**Fix:** Use `compute` or `merge` for atomic check-and-act.

```java
map.compute(k, (key, v) -> v == null ? newValue() : v);
```

---

## 9. Testing Concurrent Code

### 9.1 Flaky Tests Are Normal

Concurrency bugs often hide until the timing is right. Use:
- **Stress tests** — run many iterations
- **Randomized delays** — `Thread.sleep(random)`
- **`@RepeatedTest(1000)`** in JUnit 5

### 9.2 Useful Tools

- **`CountDownLatch`** — synchronize test start
- **`CyclicBarrier`** — force concurrent execution
- **`ExecutorService`** — control thread lifecycle

### 9.3 Example Stress Test

```java
@Test
void counterIsThreadSafe() throws InterruptedException {
    Counter counter = new Counter();
    int threads = 100;
    int increments = 1000;
    CountDownLatch start = new CountDownLatch(1);
    CountDownLatch done = new CountDownLatch(threads);

    for (int i = 0; i < threads; i++) {
        new Thread(() -> {
            try {
                start.await();   // all threads start together
                for (int j = 0; j < increments; j++) counter.increment();
            } catch (InterruptedException ignored) {
            } finally {
                done.countDown();
            }
        }).start();
    }

    start.countDown();
    done.await(10, TimeUnit.SECONDS);
    assertEquals(threads * increments, counter.get());
}
```

### 9.4 Tools

- **`jcstress`** — OpenJDK concurrency stress testing
- **`ThreadMXBean`** — detect deadlocks programmatically
- **`jstack`** — CLI deadlock detection

---

## 10. Cheat Sheet

### Primitive Selection

| Need | Use |
|---|---|
| Simple counter | `AtomicInteger` / `AtomicLong` |
| High-contention counter | `LongAdder` |
| Visibility flag | `volatile boolean` |
| Simple mutual exclusion | `synchronized` |
| Timed acquire | `ReentrantLock.tryLock(timeout)` |
| Readers vs writers | `ReentrantReadWriteLock` |
| Read-mostly, low latency | `StampedLock` |
| Limit concurrency to N | `Semaphore` |
| Wait for N events | `CountDownLatch` |
| Multi-phase barrier | `CyclicBarrier` |
| Lazy init singleton | Holder class |

### Collection Selection

| Need | Use |
|---|---|
| Concurrent map | `ConcurrentHashMap` |
| Sorted concurrent map | `ConcurrentSkipListMap` |
| Concurrent set | `ConcurrentHashMap.newKeySet()` |
| Read-mostly list | `CopyOnWriteArrayList` |
| Producer-consumer queue | `LinkedBlockingQueue` |
| Bounded queue | `ArrayBlockingQueue` |
| Priority queue | `PriorityBlockingQueue` |
| Delayed queue | `DelayQueue` |
| Non-blocking queue | `ConcurrentLinkedQueue` |

### Executor Selection

| Need | Use |
|---|---|
| Bounded pool, steady | `newFixedThreadPool(n)` |
| Elastic, short tasks | `newCachedThreadPool()` |
| Serial | `newSingleThreadExecutor()` |
| Scheduled | `newScheduledThreadPool(n)` |
| CPU-bound recursive | `newWorkStealingPool()` |
| Massive I/O (Java 21) | `newVirtualThreadPerTaskExecutor()` |

### Locks vs Lock-Free

| Scenario | Prefer |
|---|---|
| Simple counter | `AtomicInteger` |
| Simple map | `ConcurrentHashMap` |
| Complex critical section | `ReentrantLock` |
| Read-heavy | `ReentrantReadWriteLock` or `StampedLock` |
| Avoid contention | Immutable + `volatile` reference |

---

## 🔗 Related Sections

- [How to Approach LLD](how-to-approach-lld.md) — step 6 (deep dive) often covers concurrency
- [SOLID Principles](solid-principles.md) — clean interfaces make thread safety easier
- [Design Patterns](design-patterns/index.md) — Singleton needs thread-safe init
- Problems: Producer-Consumer, LRU Cache, Thread Pool, Reader-Writer Lock, Dining Philosophers

---

## 📌 Key Takeaways

- **Race conditions** need three things: shared state + write + no sync
- **`volatile`** gives visibility, not atomicity
- **`synchronized`** is simple; **`ReentrantLock`** is flexible; **atomics** are fast
- **`ConcurrentHashMap`** is the workhorse; **`BlockingQueue`** is the Producer-Consumer backbone
- **`ExecutorService`** — never create raw threads
- **`CompletableFuture`** for composing async work
- **Virtual threads** (Java 21) make blocking cheap — ideal for I/O
- **Deadlock fix** — lock ordering, timeouts, or lock-free
- **Always unlock in `finally`**
- **`ConcurrentHashMap` compound ops** need `compute`/`merge`, not `get` + `put`
- **Test with stress** — `CountDownLatch` + many threads
- **Prefer immutability** — no state, no race