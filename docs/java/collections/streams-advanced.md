# Streams Advanced

> **JDK context:** This file focuses on the deeper corners of the Streams API
> introduced in Java 8 and refined through Java 21. Assumes familiarity with
> the basics — see [Streams & Functional](streams-and-functional.md) first.

## Mental Model

A Stream pipeline has three parts:

1. **Source** — where elements come from
2. **Intermediate operations** — zero or more lazy stages
3. **Terminal operation** — one final eager operation

The internals that matter for advanced work:

- Each intermediate op wraps the previous one in a **`Sink` chain**
- Terminal operations **push** elements through that chain
- Whether a stream **splits** for parallelism depends on its **`Spliterator`**
- **Collectors** are configurable aggregation strategies with **characteristics**

Everything in this file expands on those four ideas.

---

## Collector Characteristics — The Contract

Every `Collector` declares a `Set<Characteristics>`:

```java
public interface Collector<T, A, R> {
    Set<Characteristics> characteristics();

    enum Characteristics {
        CONCURRENT,       // can use a single mutable accumulator in parallel
        UNORDERED,        // doesn't preserve encounter order
        IDENTITY_FINISH   // no final transformation (A == R)
    }
}
```

### What each means

| Characteristic | Meaning | Enables |
|---|---|---|
| **CONCURRENT** | Multiple threads can accumulate into the same mutable container | Saves memory — no per-thread copies |
| **UNORDERED** | Doesn't respect encounter order | Cheaper in parallel |
| **IDENTITY_FINISH** | `A` (accumulator) and `R` (result) are the same type | Skips the finisher function |

### Built-in collector characteristics

```java
Collectors.toList()           // no characteristics
Collectors.toSet()            // no characteristics
Collectors.toConcurrentMap()  // CONCURRENT, UNORDERED
Collectors.joining()          // IDENTITY_FINISH
Collectors.counting()         // IDENTITY_FINISH
Collectors.summingInt(...)    // IDENTITY_FINISH
```

### Why CONCURRENT matters

```java
// Standard toList() — parallel uses per-thread copies then merges
List<String> list = stream.parallel().collect(Collectors.toList());

// Concurrency-safe — single shared container
List<String> concurrent = stream.parallel()
        .collect(Collectors.toCollection(CopyOnWriteArrayList::new));
```

For `toList()`, the JDK uses per-thread `ArrayList`s and merges them at the
end. This is correct and usually fastest.

### Identity function optimization

`IDENTITY_FINISH` tells the JDK it doesn't need to call the finisher — the
accumulator's type *is* the result type. `Collectors.counting()` returns
`Long`, so the finisher is identity.

---

## Custom Collectors — The Full Anatomy

A `Collector<T, A, R>` is defined by **four functions**:

| Function | Type | Purpose |
|---|---|---|
| `supplier()` | `Supplier<A>` | Creates a new accumulator |
| `accumulator()` | `BiConsumer<A, T>` | Folds one element into the accumulator |
| `combiner()` | `BinaryOperator<A>` | Merges two accumulators (parallel) |
| `finisher()` | `Function<A, R>` | Converts accumulator → result |

### Example — immutable list collector

```java
static <T> Collector<T, ?, List<T>> toImmutableList() {
    return Collector.of(
            ArrayList::new,                              // supplier
            List::add,                                   // accumulator
            (left, right) -> { left.addAll(right); return left; },   // combiner
            Collections::unmodifiableList,               // finisher
            Collector.Characteristics.IDENTITY_FINISH    // this is wrong! see below
    );
}
```

**Wait — that's wrong.** `IDENTITY_FINISH` means the finisher is skipped. But
here we *do* need to call `Collections::unmodifiableList`. So omit
`IDENTITY_FINISH`:

```java
static <T> Collector<T, List<T>, List<T>> toImmutableList() {
    return Collector.of(
            ArrayList::new,
            List::add,
            (left, right) -> { left.addAll(right); return left; },
            Collections::unmodifiableList
    );
}
```

### Example — running sum with an offset

```java
static Collector<Integer, int[], Integer> sumWithOffset(int offset) {
    return Collector.of(
            () -> new int[]{offset},          // supplier
            (acc, x) -> acc[0] += x,          // accumulator
            (a, b) -> new int[]{a[0] + b[0]}, // combiner
            acc -> acc[0]                       // finisher
    );
}

int total = List.of(1, 2, 3, 4).stream()
        .collect(sumWithOffset(10));

System.out.println(total);   // 20
```

### When to write a custom collector

**Rarely.** Almost everything has a built-in collector or a simple combination
(`groupingBy` + `mapping` + `counting`, etc.). Custom collectors are for:

- Framework-level utilities
- Domain-specific aggregations that combine multiple stats
- Performance-critical aggregation that avoids intermediate collections

**Rule:** if you can express it with built-ins, do that. Custom collectors add
surface area for bugs.

---

## Collectors.teeing — Advanced Combinations

`teeing` lets you run two collectors in **one pass** and merge their results.

### Basic recap

```java
record Stats(long count, double average) {}

Stats s = stream.collect(Collectors.teeing(
        Collectors.counting(),
        Collectors.averagingInt(Employee::salary),
        Stats::new
));
```

### Nesting teeing — three or more aggregations

```java
record FullStats(long count, double average, int max) {}

FullStats stats = employees.stream().collect(
        Collectors.teeing(
                Collectors.counting(),
                Collectors.teeing(
                        Collectors.averagingInt(Employee::salary),
                        Collectors.collectingAndThen(
                                Collectors.maxBy(Comparator.comparingInt(Employee::salary)),
                                opt -> opt.map(Employee::salary).orElse(0)
                        ),
                        (avg, max) -> new double[]{avg, max}
                ),
                (count, avgMax) -> new FullStats(count, avgMax[0], (int) avgMax[1])
        )
);
```

**Reality check:** nesting `teeing` more than twice gets ugly. At three
aggregations, switch to a custom `Collector` or just do two passes.

### Real-world use — combining partitioned count with totals

```java
record Report(long passed, long failed, double passRate) {}

Report report = tests.stream().collect(
        Collectors.teeing(
                Collectors.filtering(Test::passed, Collectors.counting()),
                Collectors.filtering(t -> !t.passed(), Collectors.counting()),
                (passed, failed) -> {
                    long total = passed + failed;
                    return new Report(passed, failed, total == 0 ? 0 : (double) passed / total);
                }
        )
);
```

One pass, both counts, derived rate. Before `teeing`, this required two loops.

---

## The 4-Argument `Collectors.toMap`

Most people know the 2-arg version. The 4-arg form is more powerful:

```java
Collectors.toMap(
        keyMapper,
        valueMapper,
        mergeFunction,
        mapSupplier
)
```

### Full example

```java
Map<String, Integer> nameToAge = people.stream().collect(
        Collectors.toMap(
                Person::name,
                Person::age,
                (existing, replacement) -> Math.max(existing, replacement),
                TreeMap::new                  // sorted by name
        )
);
```

### Why the 4th argument matters

- Default is `HashMap`
- `LinkedHashMap::new` — preserve insertion order
- `TreeMap::new` — sorted by key
- `ConcurrentHashMap::new` — thread-safe (only useful with `parallelStream`)

### The mutable map trap

The result is a fresh map from the supplier — you can't inject an existing one.
To collect into an existing map, use `forEach` or `reduce`:

```java
// Won't work — toMap always creates a new map
Map<String, Integer> existing = new HashMap<>();
// map = stream.collect(toMap(..., ..., ..., () -> existing));  // WRONG

// Correct — mutate the existing map in a terminal op
stream.forEach(p -> existing.put(p.name(), p.age()));
```

---

## `Collectors.groupingBy` — Full Combination Catalog

### Signature variants

```java
// 1-arg — group by classifier, default downstream toList
groupingBy(classifier)

// 2-arg — custom downstream
groupingBy(classifier, downstream)

// 3-arg — custom map supplier + downstream
groupingBy(classifier, mapFactory, downstream)
```

### Downstream combinations

```java
// Group + count per group
groupingBy(dept, counting())

// Group + average per group
groupingBy(dept, averagingInt(Employee::salary))

// Group + sum per group
groupingBy(dept, summingInt(Employee::salary))

// Group + collect a Set
groupingBy(dept, mapping(Employee::name, toSet()))

// Group + filter within the group
groupingBy(dept, filtering(e -> e.salary() > 80_000,
                           mapping(Employee::name, toList())))

// Group + flatMap within the group
groupingBy(dept, flatMapping(e -> e.skills().stream(), toSet()))

// Group + custom collection
groupingBy(dept, toCollection(LinkedList::new))

// Group + reduce
groupingBy(dept, reducing(0, Employee::salary, Integer::sum))

// Nested grouping — group by dept, then by role
groupingBy(Employee::department,
           groupingBy(Employee::role))
```

### Nested grouping in detail

```java
Map<String, Map<String, List<Employee>>> byDeptAndRole = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.groupingBy(Employee::role)
        ));

// Access: byDeptAndRole.get("IT").get("SENIOR")
```

### Multi-level key with `record`

```java
record DeptRole(String dept, String role) {}

Map<DeptRole, List<Employee>> byCombo = employees.stream()
        .collect(Collectors.groupingBy(
                e -> new DeptRole(e.department(), e.role())
        ));
```

### `groupingBy` + `teeing` — two aggregates per group

```java
Map<String, DepartmentStats> statsByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.teeing(
                        Collectors.counting(),
                        Collectors.averagingInt(Employee::salary),
                        DepartmentStats::new
                )
        ));
```

One pass over the data, rich result per group.

---

## `Collectors.reducing` — The Hidden Collector

`reduce()` is a **Stream** method; `reducing()` is its **Collector** form. Use
it as a downstream when you need to reduce within groups.

```java
// Total salary per department
Map<String, Integer> totalByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.reducing(0, Employee::salary, Integer::sum)
        ));
```

### Signature variants

```java
reducing(identity, mapper, op)          // map then reduce
reducing(identity, op)                  // reduce directly
reducing(op)                            // no identity, returns Optional
```

### `reducing` vs `summingInt`

```java
// Equivalent for simple sums
groupingBy(dept, reducing(0, Employee::salary, Integer::sum))
groupingBy(dept, summingInt(Employee::salary))
```

`summingInt` is clearer and faster. Reach for `reducing` only when you have
a **non-arithmetic** op (max, custom merge).

### `reducing` for min/max per group

```java
Map<String, Optional<Employee>> topPerDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.reducing(
                        BinaryOperator.maxBy(Comparator.comparingInt(Employee::salary))
                )
        ));
```

Note the `Optional` — no identity provided.

---

## `Collectors.partitioningBy` — Deeper Corners

### Always two keys

Unlike `groupingBy`, `partitioningBy` **always** has exactly two keys:

```java
Map<Boolean, List<Integer>> result = List.of(1, 2, 3).stream()
        .collect(Collectors.partitioningBy(n -> n > 100));

System.out.println(result);
// {false=[1, 2, 3], true=[]}
```

The `true` key exists even when empty.

### Downstream variants

```java
// Count in each partition
partitioningBy(predicate, counting())

// Collect names in each partition
partitioningBy(predicate, mapping(Employee::name, toList()))

// Sum in each partition
partitioningBy(predicate, summingInt(Employee::salary))

// Average in each partition
partitioningBy(predicate, averagingInt(Employee::salary))
```

### When `partitioningBy` beats `groupingBy`

- You have a **boolean** condition
- You want **both** groups present in the result (even if empty)
- You want a **fixed-shape** result for a downstream consumer

For all other cases, `groupingBy` is more flexible.

---

## `Collectors.filtering` vs Pipeline `filter`

Two ways to filter with grouping — different semantics.

### Pipeline `filter` — removes elements entirely

```java
Map<String, List<String>> result = employees.stream()
        .filter(e -> e.salary() > 80_000)          // pipeline filter
        .collect(groupingBy(
                Employee::department,
                mapping(Employee::name, toList())
        ));

// Result — only departments that have high earners
// {IT=[Alice, Charlie]}
```

Departments with no high earners **disappear**.

### `filtering` collector — keeps groups

```java
Map<String, List<String>> result = employees.stream()
        .collect(groupingBy(
                Employee::department,
                Collectors.filtering(
                        e -> e.salary() > 80_000,     // downstream filter
                        Collectors.mapping(Employee::name, toList())
                )
        ));

// Result — all departments present
// {IT=[Alice, Charlie], HR=[]}
```

Departments with no high earners still appear with empty lists.

### When to choose

| You want… | Use |
|---|---|
| Only matching groups | Pipeline `filter` |
| All groups, some empty | `Collectors.filtering` |
| Preserve map shape | `Collectors.filtering` |
| Simplest code | Pipeline `filter` (usually) |

---

## `Collectors.flatMapping` — Downstream flatMap

The downstream version of `flatMap`:

```java
Map<String, Set<String>> skillsByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.flatMapping(
                        e -> e.skills().stream(),
                        Collectors.toSet()
                )
        ));
```

### When to use

Whenever you'd otherwise need `groupingBy` → `mapping` → `flatMap`. This
collector keeps the "one pass" property of `collect`.

### `flatMapping` vs pipeline `flatMap`

```java
// Pipeline flatMap — flattens the stream, then groups
employees.stream()
        .flatMap(e -> e.skills().stream().map(s -> Map.entry(e.department(), s)))
        .collect(groupingBy(Map.Entry::getKey, mapping(Map.Entry::getValue, toSet())));

// flatMapping — flattens inside the downstream collector
employees.stream()
        .collect(groupingBy(
                Employee::department,
                flatMapping(e -> e.skills().stream(), toSet())
        ));
```

The second is shorter and preserves the group structure.

---

## `Collectors.collectingAndThen` — The Adapter

Wraps any collector, then applies a finishing transformation.

### Wrap to make immutable

```java
List<String> immutable = stream.collect(
        Collectors.collectingAndThen(
                Collectors.toList(),
                Collections::unmodifiableList
        )
);
```

### Extract one stat from `summaryStatistics`

```java
record Range(int min, int max) {}

Range r = stream.collect(
        Collectors.collectingAndThen(
                Collectors.summarizingInt(Employee::salary),
                stats -> new Range(stats.getMin(), stats.getMax())
        )
);
```

### Guard against empty results

```java
Optional<Employee> top = employees.stream().collect(
        Collectors.collectingAndThen(
                Collectors.maxBy(Comparator.comparingInt(Employee::salary)),
                Optional::ofNullable
        )
);
```

### Chain multiple transformations

```java
stream.collect(
        Collectors.collectingAndThen(
                Collectors.toList(),
                list -> list.stream()
                        .sorted()
                        .toList()
        )
);
```

**Warning:** the finisher runs after accumulation — you can do expensive
post-processing, but the intermediate list lives in memory.

---

## Stream Construction — Beyond `.stream()`

### `StreamSupport.stream`

Build a stream from any `Spliterator`:

```java
StreamSupport.stream(spliterator, parallel)
```

### From an `Iterator`

```java
Iterator<String> it = someCollection.iterator();
Stream<String> stream = StreamSupport.stream(
        Spliterators.spliteratorUnknownSize(it, Spliterator.ORDERED),
        false
);
```

### `Stream.builder`

```java
Stream<String> stream = Stream.<String>builder()
        .add("a")
        .add("b")
        .build();
```

### `Stream.iterate` — Java 9 three-arg

```java
Stream.iterate(1, n -> n <= 10, n -> n + 1).toList();   // [1..10]
```

### `Stream.iterate` with a stateful seed

```java
record Pair(long a, long b) {}
Stream<Long> fibs = Stream.iterate(
        new Pair(0, 1),
        p -> p.a() < 100,
        p -> new Pair(p.b(), p.a() + p.b())
).map(Pair::a);
```

### `Stream.generate`

```java
Stream<UUID> ids = Stream.generate(UUID::randomUUID).limit(10);
```

### From a `String`

```java
IntStream chars = "hello".chars();                // code units
IntStream cps  = "hello".codePoints();            // full Unicode
String[] split = "a,b,c".split(",");
Stream<String> words = Stream.of(split);
```

### From `Files`

```java
try (Stream<String> lines = Files.lines(Path.of("data.txt"))) {
    long count = lines.filter(l -> !l.isBlank()).count();
}
```

**Important:** `Files.lines` must be closed. Use try-with-resources.

---

## `Spliterator` — The Foundation of Parallelism

A `Spliterator` describes how a stream of elements can be:

- **Traversed** — iterated element by element
- **Split** — partitioned for parallel processing

### Core methods

```java
public interface Spliterator<T> {
    boolean tryAdvance(Consumer<? super T> action);
    Spliterator<T> trySplit();
    long estimateSize();
    int characteristics();
}
```

- `tryAdvance` — moves to next element, runs action, returns true if there was one
- `trySplit` — returns a `Spliterator` covering roughly half the remaining elements (or null if it can't split)
- `estimateSize` — hint at the number of remaining elements
- `characteristics` — bitmask describing behavior

### Characteristic flags

| Flag | Meaning |
|---|---|
| `ORDERED` | Elements have a defined encounter order |
| `SORTED` | Encounter order is sorted (`getComparator()` gives the comparator) |
| `SIZED` | `estimateSize()` is exact |
| `SUBSIZED` | All splits will also be SIZED |
| `DISTINCT` | No two elements are `equals` |
| `SORTED` | Preserve sorted order |
| `NONNULL` | No nulls allowed |
| `IMMUTABLE` | Source cannot be structurally modified |
| `CONCURRENT` | Source can be safely modified concurrently |

These flags **optimize terminal operations**. For example:

- `DISTINCT` lets `distinct()` become a no-op
- `SIZED` lets `count()` return without traversing
- `SORTED` lets `min()` skip comparisons in some cases

### Why ArrayList splits well

```java
List<Integer> array = new ArrayList<>(...);
array.parallelStream();          // ⚡ fast split
```

`ArrayList.spliterator()` is `ORDERED`, `SIZED`, `SUBSIZED`. `trySplit()`
returns an index range — O(1) work.

### Why LinkedList doesn't

```java
List<Integer> linked = new LinkedList<>(...);
linked.parallelStream();          // 🐌 slow split
```

`LinkedList.spliterator()` is `ORDERED`, `SIZED`, `SUBSIZED`, but `trySplit()`
must traverse half the list to find the midpoint — O(n) per split, O(n log n)
total overhead.

### Custom `Spliterator` example

```java
class RangeSpliterator implements Spliterator<Integer> {
    private int current;
    private final int end;

    RangeSpliterator(int start, int end) {
        this.current = start;
        this.end = end;
    }

    @Override
    public boolean tryAdvance(Consumer<? super Integer> action) {
        if (current >= end) return false;
        action.accept(current++);
        return true;
    }

    @Override
    public Spliterator<Integer> trySplit() {
        int mid = current + (end - current) / 2;
        if (mid == current) return null;
        RangeSpliterator left = new RangeSpliterator(current, mid);
        current = mid;
        return left;
    }

    @Override
    public long estimateSize() { return end - current; }

    @Override
    public int characteristics() {
        return ORDERED | SIZED | SUBSIZED | IMMUTABLE | NONNULL;
    }
}

// Usage
Spliterator<Integer> sp = new RangeSpliterator(1, 1_000_000);
long sum = StreamSupport.stream(sp, true)
        .mapToLong(Integer::longValue)
        .sum();

System.out.println(sum);   // 499999500000
```

Custom spliterators are rarely needed — but they show up in interview
questions about parallel stream performance.

---

## Parallel Streams — When and Why

### How parallelism works

Parallel streams use `ForkJoinPool.commonPool()` by default. The pool:

- Has `Runtime.getRuntime().availableProcessors() - 1` threads
- Splits work via `Spliterator.trySplit()`
- Uses **work-stealing** to balance load

### When parallel streams help

| Condition | Reason |
|---|---|
| Large dataset (1000+ elements) | Overhead amortizes |
| Expensive per-element work | Parallelism pays off |
| Splittable source | `ArrayList`, arrays, `IntStream.range` |
| No ordering requirement | Avoids coordination |

### When they hurt

| Condition | Reason |
|---|---|
| Small data | Overhead > benefit |
| Cheap work | Same |
| Ordering required | Coordination cost |
| `LinkedList`, `Iterator` sources | Splitting is expensive |
| Blocking I/O | Ties up ForkJoinPool threads |
| Shared mutable state | Race conditions |

### The parallel slowdown pattern

```java
// Idiom that looks fine but is slow
long count = list.parallelStream()                 // LinkedList
        .map(x -> x * 2)                           // cheap
        .filter(x -> x > 100)                      // cheap
        .count();                                  // optimized with SIZED? no
```

For small lists with cheap operations, this is **slower** than sequential.

### Measuring the difference

```java
List<Integer> nums = IntStream.range(0, 10_000_000).boxed().toList();

// Sequential
long t1 = System.nanoTime();
long s1 = nums.stream().mapToLong(n -> (long) n * n).sum();
long d1 = System.nanoTime() - t1;

// Parallel
long t2 = System.nanoTime();
long s2 = nums.parallelStream().mapToLong(n -> (long) n * n).sum();
long d2 = System.nanoTime() - t2;

System.out.printf("Sequential: %,d ns%n", d1);
System.out.printf("Parallel:   %,d ns%n", d2);
// On 4-core machines with 10M elements: parallel is typically 2–3× faster
```

### Ordered operations in parallel

```java
// findFirst respects encounter order even in parallel
Optional<Integer> first = nums.parallelStream()
        .filter(n -> n % 1000 == 0)
        .findFirst();
// Always the smallest matching value in encounter order
```

```java
// findAny doesn't respect order — usually faster
Optional<Integer> any = nums.parallelStream()
        .filter(n -> n % 1000 == 0)
        .findAny();
// Any matching value
```

### `forEachOrdered` in parallel

```java
nums.parallelStream()
        .filter(n -> n % 100000 == 0)
        .forEachOrdered(System.out::println);
```

The processing is parallel, but the terminal consumption is ordered. This
introduces coordination overhead — only use when order truly matters.

---

## Parallel `reduce` — Identity, Associativity, Combiner

### The three-arg signature

```java
<U> U reduce(
    U identity,                        // starting value
    BiFunction<U, T, U> accumulator,   // combine element into accumulator
    BinaryOperator<U> combiner         // merge two accumulators (parallel)
);
```

### Correct example — sum of squares

```java
long sumOfSquares = numbers.parallelStream()
        .mapToLong(n -> (long) n * n)
        .sum();
```

### Manual three-arg reduce

```java
int totalLength = words.parallelStream().reduce(
        0,                                     // identity
        (sum, word) -> sum + word.length(),    // accumulator
        Integer::sum                            // combiner
);
```

### The identity rule

The identity must satisfy:

```text
identity op x == x
x op identity == x
```

Otherwise parallel results can be wrong:

```java
// WRONG — 1 is not an identity for +
int wrong = numbers.parallelStream()
        .reduce(1, Integer::sum);
// Each partition starts at 1, so sum is inflated by the number of partitions
```

### The associativity rule

```text
(a op b) op c == a op (b op c)
```

Addition, multiplication, min, max, string concat are associative.
Subtraction, division are not:

```java
List<Integer> nums = List.of(1, 2, 3, 4);

// Sequential — deterministic
int seq = nums.stream().reduce(0, (a, b) -> a - b);
System.out.println(seq);   // -10

// Parallel — result depends on how partitions combine
int par = nums.parallelStream().reduce(0, (a, b) -> a - b);
System.out.println(par);   // usually not -10
```

**Rule:** never use non-associative ops in a parallel reduce.

### When to use `reduce` vs `collect`

| Use `reduce` | Use `collect` |
|---|---|
| Immutable aggregation (sum, min, max) | Building a mutable collection |
| Result type same as element type | Different result type |
| No shared state | Requires mutable accumulator |

```java
// BAD — reduce with mutable accumulator (O(n²) list copying)
List<String> bad = words.parallelStream()
        .reduce(new ArrayList<>(),
                (list, w) -> { list.add(w); return list; },
                (l1, l2) -> { l1.addAll(l2); return l1; });

// GOOD — collect
List<String> good = words.parallelStream().collect(Collectors.toList());
```

`collect` is *designed* for parallel mutable accumulation. `reduce` should be
reserved for immutable results.

### Shared mutable state — the killer bug

```java
// WRONG — race condition
List<String> results = new ArrayList<>();
words.parallelStream().forEach(w -> results.add(w));   // data race

// RIGHT — collect
List<String> results = words.parallelStream()
        .collect(Collectors.toList());
```

`forEach` in parallel is order-unsafe **and** not thread-safe for a shared
`ArrayList`. `collect` handles both problems.

---

## Stream Debugging

### `peek` — but only for debugging

```java
numbers.stream()
        .filter(n -> n > 2)
        .peek(n -> System.out.println("after filter: " + n))
        .map(n -> n * 10)
        .peek(n -> System.out.println("after map: " + n))
        .toList();
```

**Anti-patterns with `peek`:**

```java
// BAD — peek may be skipped for optimizations like count()
long count = stream.peek(System.out::println).count();
// count() may not traverse at all if SIZED

// BAD — using peek for side effects
stream.peek(System.out::println).collect(toList());   // works but fragile

// OK — using peek in a pipeline that fully traverses
stream.peek(System.out::println).filter(...).toList();
```

**Rule:** `peek` is for debugging only. Use `forEach` for side effects.

### Logging without breaking the pipeline

```java
// Wrap to log then return the same element
Function<Employee, Employee> log = e -> {
    System.out.println("Processing: " + e.name());
    return e;
};

employees.stream().map(log).filter(...).toList();
```

This is clearer than `peek` and never gets optimized away.

---

## Stream Anti-Patterns

### 1. Streams for everything

```java
// Overkill for a simple loop
boolean anyNegative = numbers.stream().anyMatch(n -> n < 0);

// Clearer and faster
boolean anyNegative2 = false;
for (int n : numbers) {
    if (n < 0) { anyNegative2 = true; break; }
}
```

For simple loops with early exit, an explicit loop is fine.

### 2. Side effects in `map`

```java
// BAD — map should be pure
list.stream().map(x -> { counter.incrementAndGet(); return x * 2; });

// GOOD — separate concerns
list.forEach(x -> counter.incrementAndGet());
List<Integer> doubled = list.stream().map(x -> x * 2).toList();
```

`map` can be skipped, reordered, or parallelized. Side effects break all three.

### 3. Modifying the source during iteration

```java
// BAD — ConcurrentModificationException
list.stream().forEach(x -> {
    if (x > 10) list.remove(x);       // modifying source
});

// GOOD — removeIf
list.removeIf(x -> x > 10);
```

### 4. Reusing a stream

```java
// BAD — IllegalStateException
Stream<Integer> s = numbers.stream();
long c1 = s.count();
long c2 = s.count();        // IllegalStateException
```

### 5. Parallel streams for I/O

```java
// BAD — ties up the ForkJoinPool
files.parallelStream().forEach(f -> readFromDisk(f));

// GOOD — dedicated executor, or virtual threads
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    files.forEach(f -> exec.submit(() -> readFromDisk(f)));
}
```

### 6. Ignoring `Closeable` streams

```java
// BAD — leaks file handle
Files.lines(path).forEach(System.out::println);

// GOOD — try-with-resources
try (Stream<String> lines = Files.lines(path)) {
    lines.forEach(System.out::println);
}
```

### 7. `Optional.get()` without `isPresent`

```java
// BAD
Employee e = stream.max(comparator).get();

// GOOD
Employee e = stream.max(comparator).orElseThrow();
```

### 8. Boxing where primitives suffice

```java
// Slower — boxes every int
int sum = numbers.stream().map(n -> n * 2).reduce(0, Integer::sum);

// Faster — primitive pipeline
int sum = numbers.stream().mapToInt(n -> n * 2).sum();
```

---

## `Optional` — Deep Integration with Streams

### `Optional.stream()` — Java 9+

```java
List<Optional<String>> optionals = List.of(
        Optional.of("Alice"),
        Optional.empty(),
        Optional.of("Charlie")
);

List<String> names = optionals.stream()
        .flatMap(Optional::stream)
        .toList();
// [Alice, Charlie]
```

### Combining Optional-returning operations

```java
// Before Java 9
users.stream()
        .map(u -> findEmail(u))                      // Stream<Optional<String>>
        .filter(Optional::isPresent)
        .map(Optional::get)
        .toList();

// After Java 9
users.stream()
        .flatMap(u -> findEmail(u).stream())
        .toList();
```

### `findFirst().orElseThrow()`

```java
String first = names.stream()
        .filter(n -> n.startsWith("A"))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("no match"));
```

Better than `.get()` — signals intent and throws a meaningful exception.

---

## Sequenced Collections + Streams (Java 21)

Java 21 introduced `SequencedCollection`, `SequencedSet`, `SequencedMap`.

```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3, 4));

list.getFirst();       // 1
list.getLast();        // 4
list.reversed();       // [4, 3, 2, 1]

list.stream()
    .filter(n -> n % 2 == 0)
    .forEach(System.out::println);   // 2, 4
```

### `reversed()` and streams

```java
list.reversed().stream().forEach(System.out::println);
// Prints in reverse order
```

`reversed()` returns a **view** — no copying.

### Practical use — LIFO processing

```java
Deque<Integer> stack = new ArrayDeque<>(List.of(1, 2, 3));

stack.reversed().stream()
        .map(n -> n * 10)
        .forEach(System.out::println);
// 30, 20, 10
```

---

## Bonus — `Collectors.summarizing*` Cheat Sheet

```java
IntSummaryStatistics stats = stream
        .collect(Collectors.summarizingInt(Employee::salary));

stats.getCount();      // long
stats.getSum();        // long
stats.getMin();        // int
stats.getMax();        // int
stats.getAverage();    // double
```

Variants: `summarizingLong`, `summarizingDouble`.

### Return type cheat sheet

| Collector | Returns |
|---|---|
| `counting()` | `Long` |
| `summingInt(…)` | `Integer` |
| `summingLong(…)` | `Long` |
| `summingDouble(…)` | `Double` |
| `averagingInt(…)` | `Double` |
| `minBy(…)` / `maxBy(…)` | `Optional<T>` |
| `summarizingInt(…)` | `IntSummaryStatistics` |

---

## Quick Reference — Advanced Operations

| Need | Operation |
|---|---|
| Two aggregates in one pass | `Collectors.teeing(...)` |
| Custom aggregation logic | `Collector.of(...)` |
| Immutable collection result | `Collectors.toUnmodifiableList()` |
| Keep empty groups after filter | `Collectors.filtering(...)` |
| Flatten inside a downstream | `Collectors.flatMapping(...)` |
| Transform the collected result | `Collectors.collectingAndThen(...)` |
| Reduce within a group | `Collectors.reducing(...)` |
| Custom map type | `toMap(…, TreeMap::new)` or `groupingBy(…, TreeMap::new, …)` |
| Build a stream from a `Spliterator` | `StreamSupport.stream(...)` |
| Force unordered execution | `.unordered()` |
| Ordered parallel output | `.forEachOrdered(...)` |

---

## Tricky Corners ⚠️

**`Collector.Characteristics.IDENTITY_FINISH`** means the finisher is skipped.
Do not set it if your collector has a real finisher.

**`teeing` nested more than twice is unreadable.** Use a custom collector or
split into two passes.

**`Collectors.toMap` default is `HashMap`.** Use the 4-arg form for `TreeMap`
or `LinkedHashMap` when order matters.

**`groupingBy` default map is `HashMap`.** Same fix — use the 3-arg form.

**`partitioningBy` always returns two keys.** `groupingBy` doesn't.

**Pipeline `filter` removes groups.** `Collectors.filtering` keeps them (empty).

**`Files.lines` must be closed.** Try-with-resources.

**`Stream.iterate` in Java 8 needs `.limit()`** — the 3-arg form (Java 9+)
takes a predicate.

**`reduce` with a non-identity identity** gives wrong parallel results.

**`reduce` with non-associative ops** gives non-deterministic parallel results.

**`reduce` for mutable accumulation** is O(n²). Use `collect`.

**`forEach` on parallel streams doesn't preserve order.** Use `forEachOrdered`.

**`Spliterator` characteristics** drive optimizer shortcuts. `SIZED` lets
`count()` skip traversal.

**Parallel streams share `ForkJoinPool.commonPool()`** with other parallel
streams. Heavy blocking work starves them all.

**`peek` may be skipped** if the terminal op doesn't need the elements.

**Streams can't be reused.** Recreate from source.

**`Stream.of(primitiveArray)` gives `Stream<int[]>`** of size 1, not
`Stream<Integer>`:

```java
int[] arr = {1, 2, 3};
Stream.of(arr).count();                 // 1
Arrays.stream(arr).boxed().count();     // 3
```

---

## Common Pitfalls

- Using `peek` for business logic (may be skipped).
- Setting `IDENTITY_FINISH` on a collector that has a real finisher.
- Assuming `groupingBy` uses a specific map — it's `HashMap` by default.
- Forgetting that pipeline `filter` removes empty groups.
- Writing custom collectors when built-ins suffice.
- Parallelizing without measuring.
- Non-associative operations in parallel `reduce`.
- `forEach` + shared mutable state in parallel.
- Not closing `Files.lines()`.
- Ignoring `Spliterator` characteristics when reasoning about parallel speed.

---

## Key Interview Tips

- Explain `Collector` in four functions: supplier, accumulator, combiner,
  finisher.
- Recite `Collector.Characteristics` and what each enables.
- Distinguish `filtering` (keeps groups) from pipeline `filter` (drops them).
- Explain `Spliterator.trySplit` and why `ArrayList` parallelizes better than
  `LinkedList`.
- Say "identity must be a true identity; op must be associative" for parallel
  `reduce`.
- Know that `reduce` is for immutable results, `collect` for mutable containers.
- Mention `Files.lines` needs try-with-resources.
- For "why is my parallel stream slow?", lead with data size, splittability,
  and ordering requirements.

---

## Related

- [Streams & Functional](streams-and-functional.md) — the basics
- [Collections Overview](collections-overview.md) — stream sources
- [Concurrent Collections](concurrent-collections.md) — thread-safe collect targets
- [Executors & Futures](../concurrency/executors-and-futures.md) — the pool
  parallel streams use
- [Virtual Threads](../concurrency/virtual-threads.md) — the modern alternative
  for I/O-bound concurrency