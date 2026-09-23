# List Implementations

> **JDK context:** `Vector` and `Stack` are legacy (Java 1.0). `ArrayList` and
> `LinkedList` arrived in Java 1.2. `CopyOnWriteArrayList` (Java 5) and
> `Arrays.asList` (Java 1.2) round out the toolkit. `List.of` (Java 9) returns
> an immutable list.

## Mental Model

Three main `List` implementations, three different trade-offs:

```d2
direction: right

list: "List implementations" {
  style.fill: "#f5f5f5"

  arraylist: "ArrayList" {
    style.fill: "#bbdefb"
    desc: "Resizable array\nFast random access"
  }

  linkedlist: "LinkedList" {
    style.fill: "#c8e6c9"
    desc: "Doubly-linked list\nFast at ends, slow in middle"
  }

  vector: "Vector" {
    style.fill: "#ffcdd2"
    desc: "Synchronized array\nLegacy — avoid"
  }
}
```

**Default choice:** `ArrayList` unless you have a specific reason.

---

## `ArrayList`

Backed by a plain array with automatic growth.

```java
transient Object[] elementData;
private int size;
```

| Operation | Complexity | Notes |
|---|---|---|
| `get(i)` | O(1) | Direct index |
| `set(i, e)` | O(1) | Direct index |
| `add(e)` (end) | Amortized O(1) | May trigger resize |
| `add(i, e)` | O(n) | Shifts elements |
| `remove(i)` | O(n) | Shifts elements |
| `remove(e)` | O(n) | Linear search + shift |
| `contains(e)` | O(n) | Linear |
| Iteration | O(n) | Cache-friendly |

### Growth

Starts at **10**. Grows by 50% on overflow:

```java
int newCapacity = oldCapacity + (oldCapacity >> 1);
```

For 1 million inserts, the array grows ~30 times. Pre-size with
`new ArrayList<>(expectedSize)` to avoid this.

### Memory layout

Contiguous `Object[]` → excellent CPU cache locality → fast iteration.
This is why `ArrayList` almost always wins in practice, even for
insert/delete-heavy workloads — unless the operations are at the ends.

---

## `LinkedList`

Backed by a doubly-linked list of `Node` objects:

```java
static class Node<E> {
    E item;
    Node<E> next;
    Node<E> prev;
}
```

Also implements `Deque` — can be used as a stack or queue.

| Operation | Complexity | Notes |
|---|---|---|
| `get(i)` | O(n) | Must walk from head or tail |
| `set(i, e)` | O(n) | Same walk |
| `add(e)` | O(1) | Append to tail |
| `add(i, e)` | O(n) | Walk to position, then O(1) insert |
| `remove(i)` | O(n) | Walk + unlink |
| `remove(e)` | O(n) | Search + unlink |
| `addFirst` / `addLast` | O(1) | Direct via head/tail |
| `removeFirst` / `removeLast` | O(1) | Direct via head/tail |

### The hidden cost

Each node is a separate heap allocation:
- 24+ bytes per node (header + 3 fields)
- Poor cache locality (scattered in memory)
- Traversal touches many cache lines

For iteration, `LinkedList` is dramatically slower than `ArrayList` even
though both are O(n) — the constant factor is huge.

### When `LinkedList` makes sense

- **Frequent insert/delete at head or tail** (as a deque)
- **Unknown size** with strict memory constraints per node
- **Iterator-based** insertion/removal (using `ListIterator.add/remove`,
  which are O(1) at the iterator's position)

Even then, `ArrayDeque` usually beats `LinkedList` for queue/deque use.

---

## `Vector` — Legacy

Everything `ArrayList` does, but with `synchronized` methods.

```java
public synchronized boolean add(E e) { ... }
public synchronized E get(int index) { ... }
```

Problems:
- Coarse synchronization — every operation locks the whole vector
- Iteration is not atomic across multiple method calls
- Almost never the right choice

**Modern replacement:** `ArrayList` (single-threaded) or
`CopyOnWriteArrayList` (concurrent read-heavy) or
`Collections.synchronizedList(new ArrayList<>())` (general concurrent).

`Vector` also grows by 100% on overflow (vs ArrayList's 50%) — a legacy quirk.

---

## `Stack` — Also Legacy

```java
public class Stack<E> extends Vector<E> { ... }
```

Extends `Vector`. Every operation is synchronized. The API (`push`, `pop`,
`peek`, `empty`) is fine, but the implementation is dated.

**Modern replacement:** `ArrayDeque`.

```java
Deque<String> stack = new ArrayDeque<>();
stack.push("a");
stack.pop();
stack.peek();
```

Use the `Deque` interface's `push`/`pop` methods — the semantics match `Stack`.

---

## Comparison Table

| Feature | ArrayList | LinkedList | Vector | ArrayDeque |
|---|---|---|---|---|
| Backing structure | array | doubly-linked list | array | resizable array |
| Random access | O(1) | O(n) | O(1) | N/A (no index) |
| Add at end | amortized O(1) | O(1) | amortized O(1) | O(1) |
| Add at front | O(n) | O(1) | O(n) | O(1) |
| Add in middle | O(n) | O(n) | O(n) | N/A |
| Memory per element | 4–8 bytes + slack | ~24 bytes | 4–8 bytes + slack | 4–8 bytes + slack |
| Thread-safe | ❌ | ❌ | ✅ | ❌ |
| Null allowed | ✅ | ✅ | ✅ | ❌ |
| Iteration performance | Excellent | Poor | Good | Good |
| Modern recommendation | ✅ | rarely | ❌ | ✅ |

---

## Which List Should You Use?

| Situation | Recommended |
|---|---|
| Default, no special requirement | `ArrayList` |
| Frequent add/remove at head or tail | `ArrayDeque` (or `LinkedList`) |
| Read-heavy concurrent access | `CopyOnWriteArrayList` |
| LIFO stack | `ArrayDeque` |
| FIFO queue | `ArrayDeque` |
| Legacy code already using it | Keep as-is |

**Rule of thumb:** default to `ArrayList`. Use `ArrayDeque` for stack/queue
semantics. Reserve `LinkedList` for the rare case where you're inserting or
removing through a `ListIterator` at a known position. Prefer
`CopyOnWriteArrayList` only when reads vastly outnumber writes.

---

## `Arrays.asList()` — The Fixed-Size Trap

```java
List<String> list = Arrays.asList("a", "b", "c");
list.set(0, "x");        // OK
list.add("d");           // UnsupportedOperationException
list.remove(0);          // UnsupportedOperationException
```

**Why?** `Arrays.asList` returns `Arrays$ArrayList`, which is a **view over
the original array** with a fixed size. `set` works because it writes back to
the array; `add`/`remove` would change the length, which the array can't do.

To get a mutable list:

```java
List<String> mutable = new ArrayList<>(Arrays.asList("a", "b", "c"));
// or
List<String> mutable2 = new ArrayList<>(List.of("a", "b", "c"));
```

**Also:** `Arrays.asList(intArray)` on a **primitive array** returns a
`List<int[]>` of size 1, not `List<Integer>` of size N. Use `Integer[]` or
`Arrays.stream(intArray).boxed().collect(toList())`.

---

## `ConcurrentModificationException` — Not Just Concurrency

This is a **fail-fast** check. It fires when a collection is structurally
modified outside its `Iterator` — **even in single-threaded code**.

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));
for (String s : list) {
    if (s.equals("b")) list.remove(s);   // CME!
}
```

### Why it happens

Every collection tracks a `modCount`. Iterators snapshot it. Each `next()`
compares against the current `modCount` — if they differ, throws.

### Fix 1 — `Iterator.remove()`

```java
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().equals("b")) it.remove();   // safe
}
```

### Fix 2 — `removeIf()` (Java 8+)

```java
list.removeIf(s -> s.equals("b"));
```

### Fix 3 — Iterate a copy

```java
for (String s : new ArrayList<>(list)) {
    if (s.equals("b")) list.remove(s);
}
```

### Fix 4 — `CopyOnWriteArrayList` (for concurrent scenarios)

Snapshots on write; iteration is over an immutable snapshot.

### Why is it "fail-fast"?

The exception *prevents* silent corruption. Without it, the iterator might
skip elements, return stale data, or produce inconsistent state. Better to
fail loudly.

**Common misconception:** `ConcurrentModificationException` is not only from
multithreading. It's the **single biggest trap** in Java collections —
single-threaded code triggers it constantly.

---

## Fail-Fast vs Fail-Safe Iterators

| | Fail-Fast | Fail-Safe |
|---|---|---|
| Detects modification | ✅ throws CME | ❌ no exception |
| Iterates over | live collection | snapshot |
| Examples | `ArrayList`, `HashMap`, `HashSet` iterators | `CopyOnWriteArrayList`, `ConcurrentHashMap` iterators |
| Memory | O(1) extra | can be O(n) for snapshot |

Fail-safe iterators do **not** see subsequent modifications — they see the
state at the moment the iterator was created.

---

## `List.of()` — Truly Immutable

```java
List<String> list = List.of("a", "b", "c");
list.set(0, "x");        // UnsupportedOperationException
list.add("d");           // UnsupportedOperationException
list.remove(0);          // UnsupportedOperationException
```

`List.of` returns an immutable list, **even for `set`**. Contrast with
`Arrays.asList`, which allows `set`.

Also: `List.of` **rejects nulls**:

```java
List.of("a", null);      // NullPointerException
```

`Arrays.asList` allows nulls.

| Operation | `Arrays.asList` | `List.of` |
|---|---|---|
| `set` | ✅ | ❌ |
| `add` / `remove` | ❌ | ❌ |
| `contains(null)` | ✅ | ❌ (NPE) |
| Backed by array? | ✅ (writes through) | ❌ (copy) |
| Java version | 1.2 | 9 |

---

## Iteration Performance

For 10 million elements, `ArrayList` iteration is **5–10× faster** than
`LinkedList`. Same big-O, but cache locality dominates.

```d2
direction: right

array: "ArrayList\nContiguous memory" {
  style.fill: "#c8e6c9"
  desc: "CPU prefetcher\nloads the next\nfew elements ahead"
}

linked: "LinkedList\nScattered nodes" {
  style.fill: "#ffcdd2"
  desc: "Each node is a\ncache miss"
}
```

**Real-world implication:** choose `ArrayList` by default, even if your
algorithm does some middle inserts. `System.arraycopy` (used by ArrayList's
insert) is extremely fast on contiguous memory.

---

## Tricky Corners ⚠️

**`Arrays.asList` is a view over the array** — mutating the array reflects in
the list and vice versa. `List.of` copies.

**`ArrayList` and `Vector` differ in growth factor** — 50% vs 100%.
After many additions, `Vector` wastes more memory.

**`Stack` extends `Vector`, so `pop()` on empty stack throws
`EmptyStackException`, not `NoSuchElementException`.** `ArrayDeque.pop`
throws `NoSuchElementException`. Interface inconsistency.

**`LinkedList` implements `Deque`.** So does `ArrayDeque`. Both can serve as
queue or stack — but `ArrayDeque` is faster.

**`Collections.synchronizedList` returns a list that locks on every method
call**, but iteration is still not atomic — you must synchronize manually:

```java
List<String> sync = Collections.synchronizedList(new ArrayList<>());
synchronized (sync) {
    for (String s : sync) { ... }
}
```

**`subList` returns a view**, not a copy. Modifying the sublist modifies the
backing list. Use `new ArrayList<>(list.subList(...))` for a copy.

**`ArrayList.toArray()` returns `Object[]`.** Use `toArray(new T[0])` for a
typed array — the empty array form is more efficient in modern JVMs.

**`List.copyOf(null)` throws NPE.** `List.copyOf(emptyList)` returns the same
emptyList — no new allocation.

---

## Common Pitfalls

- Modifying a list while iterating without `Iterator.remove()`.
- Using `Arrays.asList` when you need a mutable list.
- Assuming `LinkedList` is faster for insert/remove — the traversal cost
  often dominates.
- Using `Vector` or `Stack` in new code.
- Relying on `subList` as an independent copy.
- Using `Collections.synchronizedList` and iterating without synchronization.

---

## Key Interview Tips

- Explain fail-fast vs fail-safe in one sentence.
- Give the `ConcurrentModificationException` single-threaded example — it
  surprises a lot of candidates.
- Know the `Arrays.asList` vs `List.of` differences cold.
- Default to `ArrayList`; justify `LinkedList` rarely.
- Mention `ArrayDeque` for stack/queue.

---

## Related

- [Collections Overview](collections-overview.md) — hierarchy and when to use what
- [HashMap Internals](hashmap-internals.md) — for `hashCode`/`equals` contract
- [Set & Sorted Collections](set-and-sorted.md) — `TreeSet`, `Comparable`/`Comparator`
- [Concurrent Collections](concurrent-collections.md) — `CopyOnWriteArrayList`, `BlockingQueue`
- [Streams & Functional](streams-and-functional.md) — Stream operations on lists