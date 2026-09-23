# Concurrent Collections

> **JDK context:** `java.util.concurrent` (Java 5) introduced
> `ConcurrentHashMap`, `CopyOnWriteArrayList`, and the `BlockingQueue` family.
> Since Java 8, `ConcurrentHashMap` uses lock-free reads and CAS-based updates.
> Java 9 added `ConcurrentHashMap.newKeySet()`.

## Mental Model

Regular collections aren't thread-safe. Wrapping them with
`Collections.synchronizedX` makes them **correct** but slow (one big lock).
The concurrent collections use **finer-grained** strategies:

```d2
direction: right

approaches: "Thread-Safe Collections" {
  style.fill: "#f5f5f5"

  wrap: "Collections.synchronizedX" {
    style.fill: "#ffcdd2"
    desc: "One lock for all ops\nCorrect, but not scalable"
  }

  legacy: "Vector, Hashtable" {
    style.fill: "#ffe0b2"
    desc: "Coarse-grained synchronized\nLegacy — avoid"
  }

  modern: "java.util.concurrent" {
    style.fill: "#c8e6c9"
    desc: "Fine-grained / lock-free\nScalable under load"
  }
}
```

The main concurrent collections:

| Class | Replaces | Strategy |
|---|---|---|
| `ConcurrentHashMap` | `HashMap` | Bucket-level CAS + lock |
| `CopyOnWriteArrayList` | `ArrayList` | Snapshot on write |
| `CopyOnWriteArraySet` | `HashSet` | Snapshot on write |
| `ConcurrentLinkedQueue` | `LinkedList` (as queue) | Lock-free linked list |
| `BlockingQueue` (interface) | — | Producer/consumer |
| `ConcurrentSkipListMap` | `TreeMap` | Lock-free skip list |
| `ConcurrentSkipListSet` | `TreeSet` | Lock-free skip list |

---

## `ConcurrentHashMap`

The workhorse for concurrent maps.

### Design

- **Reads are lock-free** — `get()` doesn't acquire any lock
- **Writes lock only the affected bucket** — different buckets proceed in parallel
- **Resize is incremental** — multiple threads help migrate data
- **No null keys, no null values** — a deliberate design choice (allows
  `get(k) == null` to unambiguously mean "not present")

### Key API additions over `HashMap`

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

// Atomic compute
map.compute("a", (k, v) -> v == null ? 1 : v + 1);

// Atomic computeIfAbsent
map.computeIfAbsent("b", k -> 0);

// Atomic computeIfPresent
map.computeIfPresent("a", (k, v) -> v + 1);

// Atomic merge
map.merge("a", 1, Integer::sum);

// Put if absent
map.putIfAbsent("c", 42);

// Remove if value matches
map.remove("a", 1);

// Replace if value matches
map.replace("a", 1, 2);
```

These avoid the classic check-then-act race:

```java
// BAD — not atomic
if (!map.containsKey("a")) {
    map.put("a", 1);
}

// GOOD
map.putIfAbsent("a", 1);
// or
map.computeIfAbsent("a", k -> 1);
```

### Null handling

Both keys and values cannot be null:

```java
map.put(null, 1);   // NullPointerException
map.put("a", null); // NullPointerException
```

Reason: `get(key)` returns `null` for missing keys. If null values were
allowed, `get` could mean "missing" or "null value" — ambiguous.

### Bucket-level synchronization

`ConcurrentHashMap` doesn't lock the whole map. It locks (or CASes) the
specific bin. Multiple threads writing to different buckets proceed in
parallel. This is the "bucket-level" or "bin-level" synchronization that
makes it scale.

### Iteration is weakly consistent

Iterators are **fail-safe** — they don't throw `ConcurrentModificationException`.
But they also don't snapshot. If the map changes during iteration, you may see
elements added after iteration started, and never see elements removed.

```java
for (Map.Entry<String, Integer> e : map.entrySet()) {
    // safe — no CME
    // but the view may reflect concurrent changes
}
```

**Interview line:** *"ConcurrentHashMap iterators are weakly consistent —
they never throw CME, but they don't guarantee a snapshot either."*

### Size is approximate

`size()` returns a `long` computed from a counter spread across cells.
Concurrent updates can cause it to be slightly off during the call. It's
correct once operations quiesce.

### When to use

- Shared caches
- Counters keyed by some ID
- Any concurrent map need

**Prefer `ConcurrentHashMap` over `Collections.synchronizedMap(new HashMap<>())`**
— it's faster under contention and provides atomic compound operations.

---

## `CopyOnWriteArrayList` / `CopyOnWriteArraySet`

### Design

Every write operation **copies the entire backing array**. Reads are lock-free.

```java
public boolean add(E e) {
    synchronized (lock) {
        Object[] es = getArray();
        int len = es.length;
        Object[] newArray = Arrays.copyOf(es, len + 1);
        newArray[len] = e;
        setArray(newArray);
        return true;
    }
}
```

### Consequences

- **Iteration is over an immutable snapshot** — no locks, no CME
- **Reads are extremely fast** — no synchronization at all
- **Writes are expensive** — O(n) per write

### When to use

- **Read-mostly workloads** — event listeners, observers, config lists
- **Iteration-dominant code** — where adding/removing during iteration is
  common but reads dominate
- **Small collections** — the cost of a full copy scales with size

### When NOT to use

- Write-heavy workloads — catastrophic O(n) per write
- Large collections — copying a million-element list on every add

### Null handling

`CopyOnWriteArrayList` **allows nulls** (unlike `ConcurrentHashMap`).
`CopyOnWriteArraySet` allows one null (via backing list).

---

## `BlockingQueue`

An interface for **producer-consumer** patterns. Methods block when the
queue is full (on `put`) or empty (on `take`).

### Key methods

| Operation | Blocks? | Throws? | Returns special? | Times out? |
|---|---|---|---|---|
| Insert | `put(e)` | `add(e)` throws | `offer(e)` returns false | `offer(e, t, u)` |
| Remove | `take()` | `remove()` throws | `poll()` returns null | `poll(t, u)` |
| Examine | — | `element()` throws | `peek()` returns null | — |

### Implementations

| Class | Backed by | Bounded? |
|---|---|---|
| `ArrayBlockingQueue` | Fixed array | ✅ |
| `LinkedBlockingQueue` | Linked nodes | Optional (default `Integer.MAX_VALUE`) |
| `PriorityBlockingQueue` | Heap | Unbounded |
| `DelayQueue` | Priority + delay | Unbounded |
| `SynchronousQueue` | Handoff | 0 capacity |
| `LinkedTransferQueue` | Linked | Unbounded |

### Producer-consumer example

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

// Producer
Runnable producer = () -> {
    try {
        while (true) {
            queue.put(generateTask());   // blocks if full
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
};

// Consumer
Runnable consumer = () -> {
    try {
        while (true) {
            Task task = queue.take();    // blocks if empty
            process(task);
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
};
```

**This replaces the manual `synchronized` + `wait`/`notify` pattern** — much
safer and simpler.

### `SynchronousQueue`

Zero-capacity queue — every `put` must be matched by a `take`. Used for
handoff between threads.

### `DelayQueue`

Elements become available only after their delay expires. Used for scheduled
tasks, retry queues.

---

## Fail-Fast vs Fail-Safe Iterators

| | Fail-Fast | Fail-Safe (Weakly Consistent) |
|---|---|---|
| On modification during iteration | Throws `ConcurrentModificationException` | No exception |
| Iterates over | Live collection | Snapshot or weakly consistent view |
| Examples | `ArrayList`, `HashMap`, `HashSet`, `TreeMap` | `ConcurrentHashMap`, `CopyOnWriteArrayList`, `ConcurrentLinkedQueue` |
| Memory | O(1) extra | O(n) for full snapshot (COW), O(1) for weakly consistent |
| Use in concurrency | ❌ | ✅ |

**Why is `ConcurrentHashMap` fail-safe?**

Its iterator doesn't use a `modCount` check. Instead, it walks the table
nodes and tolerates concurrent modifications. It may see elements added
during iteration, and may miss elements removed — but never crashes.

**Why is `CopyOnWriteArrayList` fail-safe?**

Its iterator holds a reference to the backing array **at iteration time**.
Subsequent writes create a new array; the iterator is unaffected.

---

## Which Thread-Safe Collection Should You Use?

| Need | Recommendation |
|---|---|
| Concurrent map | `ConcurrentHashMap` |
| Sorted concurrent map | `ConcurrentSkipListMap` |
| Concurrent set | `ConcurrentHashMap.newKeySet()` |
| Read-mostly list | `CopyOnWriteArrayList` |
| Producer-consumer queue | `ArrayBlockingQueue` or `LinkedBlockingQueue` |
| Lock-free queue | `ConcurrentLinkedQueue` |
| Priority queue, concurrent | `PriorityBlockingQueue` |
| Scheduled/delayed | `DelayQueue` |
| Handoff between threads | `SynchronousQueue` |

---

## `Collections.synchronizedX` vs `ConcurrentHashMap`

| Aspect | `synchronizedMap` | `ConcurrentHashMap` |
|---|---|---|
| Lock granularity | Whole map | Per bucket |
| Read concurrency | Serialized | Fully concurrent |
| Write concurrency | Serialized | Bucket-level |
| Iteration | Must synchronize manually | Fail-safe |
| Compound ops | Not atomic | `compute`, `merge`, `putIfAbsent` atomic |
| Null keys/values | Allowed | Rejected |
| Performance under contention | Poor | Excellent |

**Rule:** if you need a thread-safe map, use `ConcurrentHashMap` — not
`synchronizedMap`.

`synchronizedMap` still has its uses (e.g., wrapping a `TreeMap`), but for
most cases `ConcurrentHashMap` wins.

---

## Atomic Compound Operations

The main advantage of `ConcurrentHashMap` over `synchronizedMap` is atomic
compound operations.

```java
// BAD — race even with synchronizedMap
if (!map.containsKey(k)) {
    map.put(k, 1);
} else {
    map.put(k, map.get(k) + 1);
}

// GOOD — atomic in ConcurrentHashMap
map.compute(k, (key, v) -> v == null ? 1 : v + 1);
// or
map.merge(k, 1, Integer::sum);
```

**Always use the atomic APIs** for check-then-act patterns.

---

## Tricky Corners ⚠️

**`ConcurrentHashMap` doesn't allow null keys or values.** This is a
deliberate design choice — see above.

**`size()` may be stale during concurrent updates.** It's accurate once
operations stop.

**Weakly consistent iterators don't see a snapshot.** Elements added during
iteration may or may not appear. Removed elements may still be iterated.

**`CopyOnWriteArrayList` writes are O(n).** Don't use it for write-heavy
workloads.

**`Collections.synchronizedList` still needs manual synchronization for
iteration.**

```java
List<String> sync = Collections.synchronizedList(new ArrayList<>());
synchronized (sync) {
    for (String s : sync) { ... }   // still needed!
}
```

**`ConcurrentHashMap` doesn't support atomic multi-key operations.**
`forEach`, `compute`, etc. are per-key atomic, not per-map.

**`ConcurrentSkipListMap` is the sorted, concurrent alternative to `TreeMap`.**
Not as fast as `ConcurrentHashMap`, but sorted and iterable in order.

**`ConcurrentHashMap.newKeySet()` (Java 8+) returns a concurrent Set** backed
by an internal `ConcurrentHashMap`.

**`BlockingQueue.put()` and `take()` throw `InterruptedException`.** Always
handle or restore the interrupt flag.

**`ArrayBlockingQueue` has a fixed size.** Choose carefully — too small and
producers block constantly; too large wastes memory.

---

## Common Pitfalls

- Using `HashMap` in concurrent code.
- Using `synchronizedMap` when `ConcurrentHashMap` would be better.
- Assuming `ConcurrentHashMap` allows null keys/values.
- Using `CopyOnWriteArrayList` for write-heavy work.
- Forgetting that iteration of `synchronizedList` needs manual sync.
- Ignoring `InterruptedException` from `BlockingQueue`.

---

## Key Interview Tips

- Explain bucket-level synchronization in `ConcurrentHashMap`.
- Describe weakly consistent iteration and why it's not the same as fail-safe snapshot.
- Know why `ConcurrentHashMap` rejects nulls.
- Mention `CopyOnWriteArrayList` for read-mostly scenarios.
- Reach for `BlockingQueue` when asked about producer-consumer.

---

## Related

- [Collections Overview](collections-overview.md) — hierarchy and decision table
- [HashMap Internals](hashmap-internals.md) — how HashMap compares
- [List Implementations](list-implementations.md) — fail-fast iterators
- [Set & Sorted Collections](set-and-sorted.md) — for `TreeMap`/`ConcurrentSkipListMap`
- [Synchronization](../concurrency/synchronization.md) — locks, atomics, visibility
- [Concurrency Utilities](../concurrency/concurrency-utilities.md) — Semaphore, CountDownLatch