# Memory References & GC Tuning

> **JDK context:** `Reference` subclasses existed since Java 1.2. G1 (Java 7+,
> default since 9), ZGC (Java 11+, generational in 21), and Shenandoah
> (Java 12+) are modern collectors. `Cleaner` (Java 9) replaced `finalize`.

## Mental Model

The JVM **doesn't count references** — it determines reachability from roots.
Four reference strengths control when an object becomes eligible for GC.

```d2
direction: right

refs: "Reference Types" {
  style.fill: "#f5f5f5"

  strong: "Strong" {
    style.fill: "#c8e6c9"
    desc: "Normal references\nCollected only when unreachable"
  }
  soft: "Soft" {
    style.fill: "#fff9c4"
    desc: "Collected under memory pressure\nGood for caches"
  }
  weak: "Weak" {
    style.fill: "#ffe0b2"
    desc: "Collected on next GC\nGood for canonicalizing maps"
  }
  phantom: "Phantom" {
    style.fill: "#ffcdd2"
    desc: "Collected after finalization\nFor cleanup scheduling"
  }
}
```

Each step to the right is weaker — the GC clears it sooner.

---

## Strong References

The default. An object with any strong reference from a GC root is not
collected.

```java
Object o = new Object();   // strong reference
```

Even if you "unreference" it, the object may survive one GC cycle because
of local variable reachability:

```java
public void process() {
    byte[] huge = new byte[100_000_000];   // 100MB
    doSomething();
    // `huge` may still be reachable through the stack frame
    // JIT may or may not keep the reference alive
}
```

**Fix — explicit nulling (rarely needed):**

```java
byte[] huge = new byte[100_000_000];
doSomething();
huge = null;   // now eligible for GC
```

In modern JVMs, the JIT can determine the variable is dead and allow
collection even without nulling. Only null out references when the codebase
or a specific pattern requires it.

---

## `SoftReference`

Collected **only when memory is tight**. The GC keeps soft-referenced objects
if there's room.

```java
SoftReference<byte[]> cache = new SoftReference<>(new byte[10_000_000]);

byte[] data = cache.get();
if (data == null) {
    // was collected due to memory pressure — regenerate
    data = loadExpensiveData();
    cache = new SoftReference<>(data);
}
```

### Use case — memory-sensitive caches

```java
class ImageCache {
    private final Map<String, SoftReference<BufferedImage>> cache = new HashMap<>();

    BufferedImage get(String key) {
        SoftReference<BufferedImage> ref = cache.get(key);
        BufferedImage img = (ref != null) ? ref.get() : null;
        if (img == null) {
            img = loadImage(key);
            cache.put(key, new SoftReference<>(img));
        }
        return img;
    }
}
```

### Caveat

Soft references can be **aggressive** in some JVMs — collected even under
moderate pressure. Avoid relying on them for correctness.

**Interview line:** *"Soft references are kept until memory is tight; the
JVM decides when to clear them. Use for caches, but be prepared for the
value to disappear at any time."*

---

## `WeakReference`

Collected on the **next GC cycle**, regardless of memory pressure.

```java
Object obj = new Object();
WeakReference<Object> weak = new WeakReference<>(obj);

System.out.println(weak.get());   // the object
obj = null;                        // remove strong reference
System.gc();                       // hint GC
System.out.println(weak.get());   // null (usually)
```

### Use case — `WeakHashMap`

```java
Map<Key, Value> cache = new WeakHashMap<>();
```

`WeakHashMap` holds **keys** weakly. When the only reference to a key is the
map itself, the entry is removed on the next GC.

```java
Object key = new Object();
Map<Object, String> map = new WeakHashMap<>();
map.put(key, "value");

System.out.println(map.size());   // 1
key = null;
System.gc();
Thread.sleep(100);
System.out.println(map.size());   // 0 — entry removed
```

### Other uses

- **Listeners** — don't hold strong references to listeners that may not
  unsubscribe
- **Canonicalizing maps** — associate metadata with objects without preventing
  collection
- **`ThreadLocal`** — `ThreadLocal` internally uses weak keys for entries

---

## `PhantomReference`

The **weakest** reference. `get()` always returns null. The reference is
enqueued in a `ReferenceQueue` after the object is finalized and about to
be reclaimed.

```java
ReferenceQueue<Object> queue = new ReferenceQueue<>();
Object obj = new Object();
PhantomReference<Object> phantom = new PhantomReference<>(obj, queue);

obj = null;
System.gc();

Reference<?> ref = queue.poll();   // the phantom reference
```

### Use case — pre-mortem cleanup

Phantom references let you run cleanup logic when an object is about to be
reclaimed. This is the mechanism `Cleaner` uses internally.

```java
class Cleaner {
    public static Cleaner create() { ... }
    public Cleanable register(Object obj, Runnable action) { ... }
}
```

The `Runnable` runs after the object is phantom-reachable — i.e., when the
GC has determined it's unreachable but hasn't reclaimed memory yet.

**Phantom references are rarely used directly.** Use `Cleaner` instead.

---

## `ReferenceQueue`

A queue where references are enqueued when their referents become reachable
by the GC.

```java
ReferenceQueue<Object> queue = new ReferenceQueue<>();
WeakReference<Object> ref = new WeakReference<>(new Object(), queue);

// ... later ...
Reference<?> cleared = queue.poll();
if (cleared != null) {
    // do cleanup
}
```

Threads can process the queue periodically to do cleanup.

---

## Reachability Levels

| Level | Reachable from |
|---|---|
| **Strongly reachable** | Any strong reference chain |
| **Softly reachable** | Only via `SoftReference` |
| **Weakly reachable** | Only via `WeakReference` |
| **Phantom reachable** | Only via `PhantomReference`, post-finalization |
| **Unreachable** | No references at all |

The GC clears soft → weak → phantom in order as memory pressure increases.

---

## Garbage Collectors — Overview

HotSpot ships several collectors.

| Collector | Best for | Pause behavior |
|---|---|---|
| **Serial** | Small heaps, single-core | Stop-the-world |
| **Parallel** | Throughput-oriented batch | Stop-the-world, parallel |
| **G1** (default since 9) | General purpose, balanced | Region-based |
| **ZGC** (15+) | Very large heaps | Sub-millisecond |
| **Shenandoah** (12+) | Similar to ZGC | Concurrent compaction |
| **CMS** (removed in 14) | Low latency (legacy) | Mostly concurrent |

### G1 in one paragraph

Heap is split into **~2048 regions**. Each region is tagged as Eden,
Survivor, Old, or Humongous (large objects). G1 collects the **garbage-first**:
regions with the most garbage are collected first, hitting a target pause
time (`-XX:MaxGCPauseMillis`).

### ZGC in one paragraph

Colored pointers + load barriers. Compaction happens **concurrently** with
application threads. Pause times are **sub-millisecond** regardless of heap
size. Perfect for very large heaps (100s of GB). Slightly lower throughput
than G1.

---

## GC Roots

Objects reachable from these are **not** collected:

- Local variables in live thread stacks
- Static fields of loaded classes
- JNI references
- Active threads
- Synchronization monitors held
- Class objects loaded by the bootstrap loader

An object is collectible when **no path exists** from any root.

---

## Optimizing GC — Practical Advice

### 1. Choose the right collector

| Workload | Collector |
|---|---|
| Small heap, single-threaded | Serial |
| Batch, throughput matters | Parallel |
| Balanced default | G1 |
| Huge heap, latency matters | ZGC or Shenandoah |

```bash
-XX:+UseG1GC
-XX:+UseParallelGC
-XX:+UseZGC
```

### 2. Set heap size correctly

```bash
-Xms4g     # initial heap size
-Xmx4g     # maximum heap size
```

**Set `-Xms` = `-Xmx` in production** to avoid resizing pauses. The JVM
doesn't have to grow the heap, and the OS can allocate it upfront.

### 3. Tune pause target (G1)

```bash
-XX:MaxGCPauseMillis=200   # target 200ms max pauses
```

### 4. Don't over-tune

**Modern JVMs auto-tune effectively.** Reach for manual tuning only when
you have a **specific problem** (long GC pauses, memory growth, throughput
drop) with **measurements**.

### 5. Measure first

Enable GC logs:

```bash
-Xlog:gc*:file=gc.log:time,uptime,level,tags
```

Or older-style:
```bash
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:gc.log
```

Analyze with tools like GCeasy, GCViewer, or JClarity.

### 6. Reduce allocation rate

The single most effective optimization is **not allocating**:

- Reuse buffers
- Prefer primitives
- Use `StringBuilder` in loops
- Avoid unnecessary boxing

### 7. Watch for leaks

Long-lived caches, `ThreadLocal`, listener registrations, and classloader
leaks all cause "OOM" that's really a leak:

```java
// Classic ThreadLocal leak in a thread pool
static final ThreadLocal<Expensive> LOCAL = ThreadLocal.withInitial(Expensive::new);

// Thread pools reuse threads, so `LOCAL` persists
// Fix: LOCAL.remove() after use
```

---

## Common GC Flags Reference

```bash
# Heap sizes
-Xms4g                          # initial
-Xmx4g                          # max

# Collector selection
-XX:+UseG1GC                    # default since Java 9
-XX:+UseZGC                     # Java 15+
-XX:+UseParallelGC              # throughput

# G1 pause target
-XX:MaxGCPauseMillis=200

# Logging
-Xlog:gc*:file=gc.log:time,uptime,level,tags

# Metaspace
-XX:MaxMetaspaceSize=512m

# Thread stack
-Xss512k

# GC hint (rarely needed)
-XX:+DisableExplicitGC          # ignore System.gc()
```

---

## Tricky Corners ⚠️

**`System.gc()` is a hint, not a command.** It may be ignored, especially
with `-XX:+DisableExplicitGC`.

**Soft references can be cleared even under light pressure** in some
implementations.

**`WeakHashMap` isn't for caching.** Values that reference their own keys
prevent the map from clearing entries.

**`WeakReference.get()` can return null at any time.** Always check.

**Phantom references are enqueued after finalization, not immediately.**

**`ThreadLocal` leaks in thread pools.** Remove values after use.

**Classloader leaks cause `OutOfMemoryError: Metaspace`.** Redeployed webapps
often leak through threads, listeners, or `ThreadLocal`.

**GC tuning without measurement is guesswork.** Start with defaults.

**`-Xms` < `-Xmx` causes heap resizes** — additional pauses during growth.

---

## Common Pitfalls

- Nulling variables that the JIT already considers dead.
- Assuming `System.gc()` frees memory immediately.
- Using soft references for correctness-critical caching.
- Forgetting `ThreadLocal.remove()` in pooled threads.
- Increasing heap size instead of fixing a leak.
- Manually tuning GC without measurements.

---

## Key Interview Tips

- Explain the four reference types and when each is collected.
- Say "GC uses reachability from roots, not reference counts."
- Know `WeakHashMap` use cases and its key-weak semantics.
- Contrast G1, ZGC, and Parallel in one sentence each.
- Mention `Cleaner` as the modern replacement for `finalize`.
- For "how to tune GC," say "measure with GC logs first."
- `-Xms` = `-Xmx` in production.

---

## Related

- [Object Lifecycle](../fundamentals/object-lifecycle.md) — GC basics
- [JVM Architecture](../fundamentals/jvm-architecture.md) — memory areas
- [Reflection & Classloaders](reflection-and-classloaders.md) — classloader leaks
- [Synchronization](../concurrency/synchronization.md) — happens-before
- [Immutable Objects](../design-patterns-java/immutable-objects.md) — safe publication