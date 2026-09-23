# HashMap Internals

> **JDK context:** Java 8 introduced treeified buckets (RB-trees) to prevent
> O(n) worst-case lookups. Java 9+ changed the hash mixing function. Since
> Java 8, entries are stored as `Node` (not `Entry`); treeified buckets use
> `TreeNode`.

## Mental Model

A `HashMap` is an **array of buckets**. Each bucket holds a linked list (or,
past a threshold, a red-black tree) of entries whose keys hash to the same
bucket index.

```d2
direction: down

map: HashMap {
  style.fill: "#f5f5f5"

  array: "table: Node[] (capacity = 16)" {
    style.fill: "#bbdefb"
  }

  b0: "bucket[0]\nempty" {
    style.fill: "#c8e6c9"
  }
  b3: "bucket[3]\nA → B → C" {
    style.fill: "#c8e6c9"
  }
  b7: "bucket[7]\ntreeified (TreeNode)" {
    style.fill: "#fff9c4"
  }
  b15: "bucket[15]\nX" {
    style.fill: "#ffe0b2"
  }
}
```

**Key operations:**
- `put(k, v)` — hash k → index → find bucket → insert or update
- `get(k)` — hash k → index → scan bucket (list or tree)
- `remove(k)` — same, then unlink

---

## The Hash Pipeline

```d2
direction: right

key: "Key (k)" {
  style.fill: "#e3f2fd"
}
hashcode: "k.hashCode()" {
  style.fill: "#bbdefb"
}
spread: "spread(h)\nh ^ (h >>> 16)" {
  style.fill: "#c8e6c9"
}
index: "index = (n-1) & spread\nn = table capacity" {
  style.fill: "#fff9c4"
}
bucket: "bucket[index]" {
  style.fill: "#ffe0b2"
}

key -> hashcode: "32-bit int"
hashcode -> spread: "mixing"
spread -> index: "mask"
index -> bucket: "O(1) average"
```

### Step 1 — `hashCode()`

Every key's `hashCode()` produces a 32-bit int. Your job: make it well-distributed.

### Step 2 — `spread(h)` — the mixing function (Java 8+)

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

This XORs the top 16 bits into the bottom 16. Why? Because the index is
`(n-1) & hash` — and if `n` is 16, only the **low 4 bits** of hash are used.
XORing the high bits in gives low bits more entropy.

### Step 3 — Index = `(n - 1) & hash`

Since `n` is a power of 2, `(n-1)` is a mask of low bits. This is fast (`&`
instead of `%`), but requires capacity to stay a power of 2.

```java
// For capacity = 16, n-1 = 15 = 0b1111
// index = hash & 0b1111  → low 4 bits
```

---

## The `hashCode` / `equals` Contract

These two methods **must** be consistent:

1. If `a.equals(b)` → `a.hashCode() == b.hashCode()` (**required**)
2. If `a.hashCode() == b.hashCode()` → `a.equals(b)` may be true or false (**allowed collision**)
3. `hashCode` must be **stable** across the object's lifetime (unless fields used in it change)

### Why override both?

- Override only `hashCode` → equal objects may not have equal hashes → lookups fail
- Override only `equals` → equal objects may have different hashes → lookups fail

**Both are required.**

### Standard `hashCode`

```java
@Override
public int hashCode() {
    return Objects.hash(firstName, lastName, age);
}
```

`Objects.hash` uses `Arrays.hashCode` internally with `31` as the multiplier.

### Why 31?

`31 = 2^5 - 1` — a Mersenne prime. Reasons:
- Multiply by 31 = shift left 5, subtract original — JIT can optimize
- Prime reduces collisions
- Standard across the JDK and countless libraries

### Default `hashCode`

`Object.hashCode()` is **identity-based** — derived from the object's memory
address (or a pseudorandom value assigned at allocation). It's stable for
the object's lifetime but not equal to content.

---

## What Happens If You Override Only One

| You override | Consequence |
|---|---|
| Only `equals` | Two "equal" objects with different hashes end up in different buckets → `get` fails |
| Only `hashCode` | Two "equal-content" objects can have the same hash but `equals` returns false → `get` finds the bucket but not the entry |

**The classic HashMap bug:** `get(key)` returns null even though `put(key, value)`
was called earlier — because the key's `equals` was overridden but not
`hashCode` (or vice versa).

---

## Collisions and Buckets

When two keys land in the same bucket, they're stored as a linked list.

```d2
direction: right

bucket: "bucket[3]" {
  style.fill: "#bbdefb"

  nodeA: "Node A\nhash=3, key=A" {
    style.fill: "#c8e6c9"
  }
  nodeB: "Node B\nhash=3, key=B" {
    style.fill: "#fff9c4"
  }
  nodeC: "Node C\nhash=19, key=C" {
    style.fill: "#ffe0b2"
  }
}

bucket.nodeA -> bucket.nodeB: "next"
bucket.nodeB -> bucket.nodeC: "next"
```

Lookup scans the bucket, calling `.equals()` on each node's key.

### Treeification (Java 8+)

If a bucket's linked list grows beyond **8 entries** AND table capacity ≥ 64,
the list becomes a **red-black tree**:

| Bucket size | Structure | Lookup |
|---|---|---|
| 0 | empty | O(1) |
| 1–7 | linked list | O(n) |
| 8+ (and capacity ≥ 64) | red-black tree | O(log n) |

Thresholds:
- `TREEIFY_THRESHOLD = 8`
- `UNTREEIFY_THRESHOLD = 6`
- `MIN_TREEIFY_CAPACITY = 64`

Treeification uses `hashCode` order as the comparator (and `Comparable` if
the key implements it).

### Why treeify?

Pre-Java-8, a malicious client could craft keys with identical hashes,
turning every lookup into O(n) — a **hash-collision DoS**. Treeified buckets
make worst-case O(log n).

---

## Load Factor and Resizing

Default:

- **Initial capacity:** 16
- **Load factor:** 0.75
- **Resize trigger:** `size > capacity * loadFactor`

When the threshold is crossed, capacity **doubles** and every entry is
**rehashed** into the new table.

```d2
direction: right

before: "capacity 16\nsize 12" {
  style.fill: "#bbdefb"
}
trigger: "size > 12\n→ resize" {
  style.fill: "#fff9c4"
}
after: "capacity 32\nrehash all" {
  style.fill: "#c8e6c9"
}

before -> trigger: "put()"
trigger -> after: "rehash"
```

### Why 0.75?

Trade-off:
- **Lower** → more memory, fewer collisions
- **Higher** → less memory, more collisions

0.75 balances space and time. Poisson-based analysis shows ~0.5 average list
length at 0.75 load factor.

### The rehash

Every entry is rehashed into the new array. Because capacity doubles, each
entry moves to either the **same index** or **index + oldCapacity** — a
property of power-of-2 sizing. This is why the JDK uses `(n-1) & hash` — it
lets resize split buckets in half cheaply.

**Pre-sizing** avoids repeated resizes:

```java
Map<String, Integer> map = new HashMap<>(1_000_000);
// or with load factor
new HashMap<>(1_000_000, 0.75f);
```

Calculate capacity as `expectedSize / 0.75 + 1`.

---

## What If All Keys Have the Same `hashCode`?

Every entry lands in one bucket.

**Pre-Java-8:** one linked list → O(n) `get`, O(n) `put`.

**Java 8+:** after 8 entries, the bucket treeifies → O(log n).

**Interview line:** *"Same-hash keys degrade HashMap to O(n) on older JVMs
or O(log n) on Java 8+ due to treeification."*

### Does rehashing happen?

Resizing still happens on size threshold, but **rehashing cannot redistribute
entries** if all keys have the same hash — they all land in the same bucket
again. So resize doesn't help in this pathological case.

---

## `null` as a Key

`HashMap` allows **exactly one null key**. It's stored at `bucket[0]`:

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

Null keys hash to 0, so they always go to bucket[0] (unless resized — still
bucket[0] modulo capacity).

**TreeMap disallows null keys** because it needs to compare them via
`compareTo`. `Hashtable` and `ConcurrentHashMap` also disallow null keys.

---

## The `Node` Object

Since Java 8, entries are `Node<K, V>`:

```java
static class Node<K, V> implements Map.Entry<K, V> {
    final int hash;      // cached hash — avoids recomputing
    final K key;
    V value;
    Node<K, V> next;     // linked-list pointer
}
```

Treeified buckets use `TreeNode<K, V> extends LinkedHashMap.Entry<K, V>` —
which extends `Node`.

The **cached `hash`** is important: on lookup, the map compares the cached
hash first, and only calls `.equals()` if the hashes match — an optimization
that avoids expensive `equals` calls.

---

## Iteration Order

`HashMap` iteration order is **unspecified** and may change across:
- JVM versions
- Capacity resizing
- Insertion of new keys

For predictable order, use `LinkedHashMap`.

**Internally:** iteration walks the `table` array, then each bucket's list/tree.

---

## Complexity Summary

| Operation | Average | Worst case |
|---|---|---|
| `put` | O(1) | O(log n) with treeified bucket |
| `get` | O(1) | O(log n) |
| `remove` | O(1) | O(log n) |
| `containsKey` | O(1) | O(log n) |
| Iteration | O(capacity + size) | same |

Worst case is O(log n) on Java 8+; O(n) on Java 7 and earlier.

---

## `Hashtable` vs `HashMap`

| | `HashMap` | `Hashtable` |
|---|---|---|
| Thread-safe | ❌ | ✅ (synchronized, coarse) |
| Null keys | 1 | ❌ |
| Null values | ✅ | ❌ |
| Iteration | Fail-fast | Fail-fast (Enumeration, not Iterator) |
| Modern recommendation | ✅ | ❌ (use `ConcurrentHashMap`) |

`Hashtable` is legacy. It synchronizes every method on the whole table —
effectively single-threaded throughput. Use `ConcurrentHashMap`.

---

## `HashMap` vs `HashSet`

`HashSet` is backed by a `HashMap` internally:

```java
public class HashSet<E> {
    private transient HashMap<E, Object> map;
    private static final Object PRESENT = new Object();

    public boolean add(E e) {
        return map.put(e, PRESENT) == null;
    }
}
```

Every element is a **key** in the internal map; the value is a dummy `PRESENT`
object. That's why `Set` doesn't allow duplicates — they'd be the same key.

---

## Tricky Corners ⚠️

**Mutating a key after insertion breaks the map.** If you change a field
used in `hashCode`, the entry stays in its old bucket but `get` looks in the
new one — the entry is effectively lost.

```java
Map<Person, String> map = new HashMap<>();
Person p = new Person("Alice");
map.put(p, "value");
p.setName("Bob");     // now p.hashCode() differs
map.get(p);           // null — looks in the wrong bucket
```

Use **immutable keys** whenever possible.

**`Objects.hash()` allocates an array** behind the scenes — fine for normal
use, avoid in ultra-hot paths.

**`hashCode()` for arrays uses identity**, not contents. Use
`Arrays.hashCode(arr)` for value-based.

**Custom `hashCode` with floating-point fields** — use `Double.hashCode(d)`,
not the raw bits.

**`ConcurrentHashMap` disallows null keys and values.** Design your code
accordingly when migrating from `HashMap`.

**`HashMap` initial capacity of 16 vs actual arrays:** the constructor argument
is the expected size; the JDK rounds up to the next power of 2 and may
pre-resize.

**Iteration order of `HashMap` is unstable across JVM runs** — don't depend on it.

---

## Common Pitfalls

- Overriding `equals` without `hashCode` (or vice versa).
- Using mutable objects as keys.
- Assuming iteration order.
- Not pre-sizing large maps — repeated resizes.
- Using `HashMap` in concurrent code.
- Using `Hashtable` when `ConcurrentHashMap` would be better.

---

## Key Interview Tips

- Draw the array-of-buckets diagram and explain hash → index → bucket.
- Explain the `hashCode`/`equals` contract and what breaks if you override
  only one.
- Mention treeification (Java 8+) and why it matters (DoS resistance).
- Explain `(n-1) & hash` and why capacity is a power of 2.
- Know that `HashSet` is backed by `HashMap`.

---

## Related

- [Collections Overview](collections-overview.md) — hierarchy and when to use what
- [Set & Sorted Collections](set-and-sorted.md) — `HashSet`, `TreeSet`, `EnumSet`
- [List Implementations](list-implementations.md) — ArrayList vs LinkedList
- [Concurrent Collections](concurrent-collections.md) — ConcurrentHashMap
- [Object Lifecycle](../fundamentals/object-lifecycle.md) — object header, hashCode default