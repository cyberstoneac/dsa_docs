# Set & Sorted Collections

> **JDK context:** `HashSet`, `TreeSet`, `LinkedHashSet` all arrived in Java 1.2.
> `EnumSet` and `EnumMap` arrived in Java 5. `Set.of` (immutable) arrived in
> Java 9. `SequencedSet` arrived in Java 21.

## Mental Model

`Set` = **unique elements**. Different implementations answer different
questions about **ordering**:

```d2
direction: down

sets: "Set implementations" {
  style.fill: "#f5f5f5"

  hashset: "HashSet" {
    style.fill: "#bbdefb"
    desc: "Unordered\nBacked by HashMap"
  }
  linkedhashset: "LinkedHashSet" {
    style.fill: "#c8e6c9"
    desc: "Insertion order\nBacked by LinkedHashMap"
  }
  treeset: "TreeSet" {
    style.fill: "#fff9c4"
    desc: "Sorted\nBacked by TreeMap (RB-tree)"
  }
  enumset: "EnumSet" {
    style.fill: "#ffe0b2"
    desc: "Enum only\nBit-vector"
  }
}
```

Every `Set` answers a slightly different question:

| Set | "What order?" | "How fast?" |
|---|---|---|
| `HashSet` | Any order | O(1) avg |
| `LinkedHashSet` | Insertion order | O(1) avg |
| `TreeSet` | Sorted | O(log n) |
| `EnumSet` | Enum ordinal | O(1) via bit ops |

---

## `HashSet`

Backed by a `HashMap` where elements are keys and values are a dummy `PRESENT`:

```java
public class HashSet<E> {
    private transient HashMap<E, Object> map;
    private static final Object PRESENT = new Object();

    public boolean add(E e) {
        return map.put(e, PRESENT) == null;
    }
}
```

### Consequences

- **Uniqueness** comes from `HashMap`'s key uniqueness
- **`hashCode` / `equals` contract applies** — you must override both
- **Insertion order is not preserved** — and it changes as the map resizes
- **Allows one null element** (backed map allows one null key)
- **Not thread-safe**

### When to use

Default `Set` when you don't care about order and want fastest `contains`.

```java
Set<String> seen = new HashSet<>();
for (String word : words) {
    if (!seen.add(word)) { /* duplicate */ }
}
```

---

## `LinkedHashSet`

Extends `HashSet`, backed by a `LinkedHashMap`. Preserves **insertion order**.

```java
Set<String> ordered = new LinkedHashSet<>();
ordered.add("banana");
ordered.add("apple");
ordered.add("cherry");
// iteration order: banana, apple, cherry
```

### When to use

You need uniqueness **and** stable iteration order. Slightly more memory than
`HashSet` (extra linked-list pointers), same asymptotic cost.

---

## `TreeSet`

Backed by a `TreeMap`, which is a **Red-Black tree**. Elements are kept
**sorted** according to their natural ordering or a supplied `Comparator`.

| Operation | Complexity |
|---|---|
| `add` | O(log n) |
| `remove` | O(log n) |
| `contains` | O(log n) |
| Iteration (in order) | O(n) |
| `first` / `last` | O(log n) |
| `floor` / `ceiling` | O(log n) |
| `headSet` / `tailSet` / `subSet` | O(log n) for the range, O(k) for iteration |

### Rich API

`TreeSet` implements `NavigableSet`, which adds:

```java
TreeSet<Integer> set = new TreeSet<>(List.of(10, 20, 30, 40, 50));

set.first();      // 10
set.last();       // 50
set.floor(25);    // 20 (≤ 25, greatest such)
set.ceiling(25);  // 30 (≥ 25, smallest such)
set.lower(30);    // 20 (< 30)
set.higher(30);   // 40 (> 30)

set.headSet(30);        // [10, 20]
set.tailSet(30);        // [30, 40, 50]
set.subSet(20, 40);     // [20, 30]
```

All returned sets are **views** — mutations reflect back.

### Sorting a custom class

Two ways:

**1. Implement `Comparable<T>` in the class:**

```java
class Person implements Comparable<Person> {
    String name;
    int age;

    @Override
    public int compareTo(Person other) {
        return Integer.compare(this.age, other.age);
    }
}

TreeSet<Person> byAge = new TreeSet<>();
byAge.add(new Person("Alice", 30));
```

**2. Supply a `Comparator`:**

```java
TreeSet<Person> byName = new TreeSet<>(Comparator.comparing(p -> p.name));
```

If neither is provided and the class isn't `Comparable`, `add()` throws
`ClassCastException`.

### Tricky: `TreeSet` uses `compareTo`, not `equals`

```java
class Person implements Comparable<Person> {
    String name;
    public int compareTo(Person o) {
        return this.name.compareTo(o.name);
    }
}
```

`TreeSet` considers two `Person`s **equal** if `compareTo` returns 0. Even
if `equals` returns false. This means:

```java
TreeSet<Person> set = new TreeSet<>();
set.add(new Person("Alice"));
set.add(new Person("Alice"));   // rejected as duplicate!
```

If your `compareTo` is inconsistent with `equals`, `TreeSet` may behave
differently from `HashSet` for the same elements.

**Rule:** make `compareTo` consistent with `equals` — return 0 iff `equals`
returns true.

### Null handling

`TreeSet` **rejects null** (thrown `NullPointerException` on `add(null)`).
Because it needs to compare null against existing elements, which it can't
do with natural ordering. Custom `Comparator` can allow it if it handles null.

---

## `EnumSet` and `EnumMap`

Special-purpose, extremely fast collections for enum keys.

### `EnumSet`

Backed by a **bit vector** (a `long` for ≤ 64 elements, a `long[]` above).

```java
enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

EnumSet<Day> weekdays = EnumSet.of(Day.MON, Day.TUE, Day.WED, Day.THU, Day.FRI);
EnumSet<Day> all = EnumSet.allOf(Day.class);
EnumSet<Day> none = EnumSet.noneOf(Day.class);

EnumSet<Day> range = EnumSet.range(Day.MON, Day.FRI);
EnumSet<Day> complement = EnumSet.complementOf(weekdays);   // {SAT, SUN}
```

**Characteristics:**
- **Ordered by enum ordinal** — always
- **Extremely fast** — bit ops, no hashing
- **Memory efficient** — 1 bit per element
- **Null-rejecting**
- **Not thread-safe**

**`EnumSet` is abstract** — use factory methods (`of`, `allOf`, `noneOf`,
`range`, `complementOf`). Internally picks `RegularEnumSet` (≤ 64 elements)
or `JumboEnumSet` (more).

### `EnumMap`

Same idea for key-value pairs, keyed by an enum:

```java
EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
schedule.put(Day.MON, "gym");
schedule.put(Day.WED, "yoga");
```

Backed by an **array** indexed by enum ordinal. O(1) operations, iteration in
ordinal order.

### When to use

Whenever your keys are enums — always prefer `EnumSet`/`EnumMap` over
`HashSet`/`HashMap`. They're faster and use less memory.

---

## `Comparable` vs `Comparator`

| | `Comparable<T>` | `Comparator<T>` |
|---|---|---|
| Package | `java.lang` | `java.util` |
| Method | `int compareTo(T other)` | `int compare(T a, T b)` |
| Implemented by | The class itself | An external class or lambda |
| Natural order | Yes — the class's default | Customizable, many per class |
| Sort via | `Collections.sort(list)` | `Collections.sort(list, comparator)` |
| Intended use | One obvious ordering | Multiple possible orderings |

### `Comparable` example

```java
class Employee implements Comparable<Employee> {
    String name;
    int salary;

    @Override
    public int compareTo(Employee o) {
        return Integer.compare(this.salary, o.salary);
    }
}

List<Employee> list = new ArrayList<>();
Collections.sort(list);   // uses compareTo
```

### `Comparator` example

```java
Comparator<Employee> byName = Comparator.comparing(e -> e.name);
Comparator<Employee> bySalaryDesc = Comparator.comparingInt((Employee e) -> e.salary).reversed();

list.sort(byName);
list.sort(bySalaryDesc);

// Chaining
Comparator<Employee> complex = Comparator
    .comparing(Employee::department)
    .thenComparing(Employee::name)
    .thenComparingInt(Employee::salary);
```

### Contract of `compare`

- Return **negative** if a < b
- Return **zero** if a equals b
- Return **positive** if a > b

**Consistency rule:** `compare` should return 0 **iff** `equals` returns true.
Otherwise sorted collections (TreeMap, TreeSet) behave inconsistently.

### When to use which

- **`Comparable`** — when the class has one obvious natural order
- **`Comparator`** — when you need multiple orderings, or can't modify the
  class (e.g. third-party types)

---

## Set Operations

```java
Set<Integer> a = new HashSet<>(Set.of(1, 2, 3, 4));
Set<Integer> b = new HashSet<>(Set.of(3, 4, 5, 6));

// Union
Set<Integer> union = new HashSet<>(a);
union.addAll(b);                          // {1, 2, 3, 4, 5, 6}

// Intersection
Set<Integer> intersection = new HashSet<>(a);
intersection.retainAll(b);                // {3, 4}

// Difference (a - b)
Set<Integer> difference = new HashSet<>(a);
difference.removeAll(b);                  // {1, 2}

// Symmetric difference
Set<Integer> symDiff = new HashSet<>(a);
symDiff.addAll(b);
Set<Integer> both = new HashSet<>(a);
both.retainAll(b);
symDiff.removeAll(both);                  // {1, 2, 5, 6}
```

All these mutate the receiver — always copy first.

---

## Tricky Corners ⚠️

**`TreeSet` uses `compareTo`, not `equals`, to determine uniqueness.** A
`compareTo` that returns 0 for logically different objects silently drops
one of them.

**`HashSet` and `TreeSet` may disagree on duplicates.** Same element can be
added once to each with different results if `hashCode`/`equals` and
`compareTo` are inconsistent.

**`Set.of(...)` is immutable and rejects nulls.** Same for `Map.of(...)`,
`List.of(...)`.

**`EnumSet` is abstract and cannot be instantiated directly.** Use `EnumSet.of`,
`allOf`, `noneOf`, etc.

**`EnumSet.noneOf(Day.class)` is the correct way to make an empty EnumSet.**

**`TreeSet` navigation methods return views for range queries.** `headSet`,
`tailSet`, `subSet` are backed by the original set.

**`Comparable` and `Comparator` can use `Integer.compare`, not subtraction.**
`a - b` overflows for large values.

```java
// BAD — overflow risk
return this.value - other.value;

// GOOD
return Integer.compare(this.value, other.value);
```

**`HashSet` iterator order changes across JVM runs.** Don't rely on it.

**`TreeSet` with a `Comparator` that isn't consistent with `equals`**: `Set`
contract is violated (two "equal" elements can both be in the set according
to `equals`, but only one according to the comparator).

---

## Common Pitfalls

- Using `TreeSet` with a mutable key — mutation breaks ordering.
- Assuming `TreeSet` uses `equals` for uniqueness — it uses `compareTo`.
- Using subtraction in `compareTo` — overflow.
- Modifying a `subSet`/`headSet` view expecting a copy.
- Using `HashSet` when insertion order matters (use `LinkedHashSet`).
- Using `HashSet` for enum keys instead of `EnumSet`.

---

## Key Interview Tips

- Know the four `Set` implementations and their ordering guarantees cold.
- Explain the `TreeSet` `compareTo` vs `equals` trap — it's a favorite.
- Mention that `Comparable` is one natural order, `Comparator` is customizable.
- Reach for `EnumSet`/`EnumMap` when keys are enums — free performance.
- Return `Integer.compare(a, b)` in `compare` — never `a - b`.

---

## Related

- [Collections Overview](collections-overview.md) — hierarchy and decision table
- [HashMap Internals](hashmap-internals.md) — how `HashSet` and `TreeMap` work internally
- [List Implementations](list-implementations.md) — sibling implementations
- [Concurrent Collections](concurrent-collections.md) — thread-safe variants