# Streams & Functional

> **JDK context:** Lambdas and Streams arrived in Java 8. `takeWhile`/`dropWhile`
> and `Stream.ofNullable` came in Java 9. `Collectors.toUnmodifiable*` came in
> Java 10. `Collectors.teeing` came in Java 12. `mapMulti` and `Stream.toList()`
> came in Java 16. Sequenced collections and Stream integration with virtual
> threads came in Java 21.

## Mental Model

A Stream is a **lazy pipeline** over a source. It's not a data structure —
it's a sequence of operations that get executed only when a terminal
operation demands a result.

```d2
direction: right

src: "Source\n(Collection, array, IO)" {
  style.fill: "#e3f2fd"
}
inter: "Intermediate ops\n(lazy — filter, map...)" {
  style.fill: "#c8e6c9"
}
term: "Terminal op\n(eager — toList, forEach...)" {
  style.fill: "#ffe0b2"
}
result: "Result" {
  style.fill: "#f8bbd0"
}

src.inter -> inter: "stream()"
inter.term -> term: "chained"
term.result -> result: "produces"
```

**Three rules to remember:**

1. Streams are **lazy** — nothing runs until a terminal op
2. Streams are **single-use** — a terminal op consumes the stream
3. Streams are **declarative** — describe what, not how

**Why streams exist:** Before Java 8, filtering/transforming collections meant
loops with mutable state. Streams let you express *what* you want in a pipeline,
and the implementation decides *how* — including whether to parallelize.

---

## Basic Pipeline — `filter`

Keep elements matching a predicate.

```java
List<Integer> numbers = List.of(10, 25, 15, 30, 5, 40);

List<Integer> result = numbers.stream()
        .filter(n -> n > 20)
        .toList();

System.out.println(result);   // [25, 30, 40]
```

**Example with strings:**

```java
List<String> names = List.of("Alice", "Bob", "Charlie", "Dave");

List<String> longNames = names.stream()
        .filter(n -> n.length() > 4)
        .toList();

System.out.println(longNames);   // [Alice, Charlie]
```

`filter` doesn't short-circuit — it examines **every** element. If you want
to stop early on ordered data, use `takeWhile` (covered below).

---

## `map`

One input → exactly one transformed output.

```java
List<String> names = List.of("Alice", "Bob", "Charlie");

List<Integer> lengths = names.stream()
        .map(String::length)
        .toList();

System.out.println(lengths);   // [5, 3, 7]
```

**Object → object mapping:**

```java
record Employee(String name, int salary) {}

List<Employee> employees = List.of(
        new Employee("Alice", 90_000),
        new Employee("Bob", 75_000),
        new Employee("Charlie", 85_000)
);

List<String> names = employees.stream()
        .map(Employee::name)
        .toList();

System.out.println(names);   // [Alice, Bob, Charlie]
```

### `filter` + `map` chained

```java
List<Integer> lengths = names.stream()
        .filter(n -> n.length() > 5)
        .map(String::length)
        .toList();

System.out.println(lengths);   // [7]  — only Charlie
```

### `map` vs `flatMap` — the rule

| Situation | Use |
|---|---|
| One input → one output | `map` |
| One input → zero, one, or many outputs | `flatMap` |

```text
map()     :  T -> R
flatMap() :  T -> Stream<R>
```

---

## `distinct`

Removes duplicates. Uses `hashCode`/`equals` internally (via a `HashSet`).

```java
List<Integer> numbers = List.of(10, 20, 20, 30, 10, 40);

List<Integer> unique = numbers.stream()
        .distinct()
        .toList();

System.out.println(unique);   // [10, 20, 30, 40]
```

**With `filter`:**

```java
List<Integer> result = numbers.stream()
        .filter(n -> n > 15)
        .distinct()
        .toList();

System.out.println(result);   // [20, 30, 40]
```

### The `distinct` trap with custom objects

```java
record Person(String name) {
    // record auto-generates equals/hashCode — good
}

List<Person> people = List.of(
        new Person("Alice"),
        new Person("Alice"),   // logically duplicate
        new Person("Bob")
);

long count = people.stream().distinct().count();
System.out.println(count);   // 2

// But if Person were a regular class WITHOUT equals/hashCode:
class RawPerson { String name; }
List<RawPerson> raw = List.of(new RawPerson("A"), new RawPerson("A"));
long rawCount = raw.stream().distinct().count();
System.out.println(rawCount);   // 2 — no dedup!
```

### Internals

`distinct()` on an **ordered** stream uses a `LinkedHashSet` internally —
preserves first occurrence and keeps encounter order.

On an **unordered** stream, it uses a `ConcurrentHashMap` — allows parallel
processing but doesn't preserve order.

---

## `sorted`

Sort the stream.

```java
List<Integer> numbers = List.of(40, 10, 30, 20);

// Ascending
List<Integer> asc = numbers.stream()
        .sorted()
        .toList();
System.out.println(asc);   // [10, 20, 30, 40]

// Descending
List<Integer> desc = numbers.stream()
        .sorted(Comparator.reverseOrder())
        .toList();
System.out.println(desc);   // [40, 30, 20, 10]
```

### Custom comparator

```java
List<Employee> employees = List.of(
        new Employee("Alice", 90_000),
        new Employee("Bob", 75_000),
        new Employee("Charlie", 85_000)
);

List<Employee> bySalary = employees.stream()
        .sorted(Comparator.comparingInt(Employee::salary))
        .toList();

// [Bob(75000), Charlie(85000), Alice(90000)]
```

### Chained comparators

```java
List<Employee> sorted = employees.stream()
        .sorted(Comparator
                .comparing(Employee::name)
                .thenComparingInt(Employee::salary))
        .toList();
```

### Important: `sorted()` is a **stateful** intermediate operation

It buffers the entire stream before emitting any element. On huge inputs
(millions), this can blow memory. For extremely large data, external sort
or a database `ORDER BY` is better.

---

## Primitive Streams — `mapToInt`, `mapToLong`, `mapToDouble`

Use when you need numeric operations. Avoids autoboxing overhead.

```java
List<Integer> numbers = List.of(10, 20, 30, 40);

int sum = numbers.stream()
        .mapToInt(Integer::intValue)
        .sum();

System.out.println(sum);   // 100
```

### With objects

```java
int totalSalary = employees.stream()
        .mapToInt(Employee::salary)
        .sum();

System.out.println(totalSalary);   // 250000
```

### Numeric terminal operations

```java
int sum = intStream.sum();
OptionalDouble avg = intStream.average();
OptionalInt min = intStream.min();
OptionalInt max = intStream.max();
IntSummaryStatistics stats = intStream.summaryStatistics();
```

### Primitive stream types

```java
IntStream
LongStream
DoubleStream
```

### `summaryStatistics()` — one pass, all stats

```java
IntSummaryStatistics stats = employees.stream()
        .mapToInt(Employee::salary)
        .summaryStatistics();

System.out.println("count:   " + stats.getCount());     // 3
System.out.println("sum:     " + stats.getSum());       // 250000
System.out.println("min:     " + stats.getMin());       // 75000
System.out.println("max:     " + stats.getMax());       // 90000
System.out.println("average: " + stats.getAverage());   // 83333.33
```

**One pass, all stats.** That's the key benefit — no multiple traversals.

### Why `mapToInt` is faster

```java
// Stream<Integer> — 3 objects per element (Integer + autoboxing + pipeline node)
numbers.stream().map(n -> n * 2).reduce(0, Integer::sum);

// IntStream — primitive, no boxing
numbers.stream().mapToInt(n -> n * 2).sum();
```

For a million-element list, `mapToInt` is typically **5–10× faster** than
`map` + `reduce`.

### Conversion back

```java
Stream<Integer> boxed = intStream.boxed();
```

---

## `count`

```java
List<String> names = List.of("Alice", "Bob", "Charlie", "Dave");

long count = names.stream()
        .filter(n -> n.length() > 4)
        .count();

System.out.println(count);   // 2
```

Returns `long`.

### Optimization note

`count()` on a stream with only `map`/`filter` can skip the actual traversal
entirely. The JVM can sometimes determine the size without running the
pipeline.

```java
// Fast — may skip the filter entirely
long c = stream.filter(x -> expensiveCheck(x)).count();

// Slower — must run peek
long c = stream.filter(x -> expensiveCheck(x)).peek(System.out::println).count();
```

---

## `reduce`

Repeatedly combine elements into one result.

### Two-arg form — with identity

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);

int product = numbers.stream()
        .reduce(1, (a, b) -> a * b);

System.out.println(product);   // 120
```

```java
int max = numbers.stream()
        .reduce(0, Integer::max);

System.out.println(max);   // 5
```

### One-arg form — no identity, returns Optional

```java
Optional<Integer> min = numbers.stream()
        .reduce(Integer::min);

System.out.println(min.orElseThrow());   // 1
```

Returns `Optional<T>` because an empty stream has no "identity" value to fall
back on.

### With strings

```java
List<String> names = List.of("Alice", "Bob", "Charlie");

String longest = names.stream()
        .reduce((a, b) -> a.length() > b.length() ? a : b)
        .orElseThrow();

System.out.println(longest);   // Charlie
```

### Signature variants

```java
T reduce(T identity, BinaryOperator<T> accumulator)
Optional<T> reduce(BinaryOperator<T> accumulator)
<U> U reduce(U identity, BiFunction<U, T, U> accumulator, BinaryOperator<U> combiner)
```

The **three-arg form** is for parallel streams — see the parallel section.

### `reduce` vs `min`/`max`

`min`/`max` communicate intent better:

```java
// Prefer
Optional<Employee> highestPaid = employees.stream()
        .max(Comparator.comparingInt(Employee::salary));

// Over
Optional<Employee> highestPaid2 = employees.stream()
        .reduce((a, b) -> a.salary() > b.salary() ? a : b);
```

Both work. `max` is clearer.

### When `reduce` is the wrong tool

For building collections, `reduce` is **inefficient and wrong** in parallel:

```java
// BAD — O(n²) due to list copy at each step
List<String> result = names.stream()
        .reduce(new ArrayList<>(),
                (list, name) -> { list.add(name); return list; },
                (l1, l2) -> { l1.addAll(l2); return l1; });

// GOOD — use collect
List<String> result2 = names.stream().collect(Collectors.toList());
```

Use `reduce` for **immutable aggregation** (sums, products, min, max). Use
`collect` for **mutable container building**.

---

## `min` / `max`

```java
Optional<Employee> top = employees.stream()
        .max(Comparator.comparingInt(Employee::salary));

System.out.println(top.map(Employee::name).orElse("none"));   // Alice
```

```java
Optional<Employee> low = employees.stream()
        .min(Comparator.comparingInt(Employee::salary));

System.out.println(low.map(Employee::name).orElse("none"));   // Bob
```

Both return `Optional<T>` — empty stream means empty Optional.

---

## `average`

```java
OptionalDouble avg = employees.stream()
        .filter(e -> e.name().startsWith("A") || e.name().startsWith("B"))
        .mapToInt(Employee::salary)
        .average();

System.out.println(avg.orElse(0));   // 82500.0  (Alice + Bob / 2)
```

`average()` returns `OptionalDouble` — empty stream → empty Optional.

---

## Collectors — The Workhorses

`Collectors` is the utility class for terminal `collect(...)` operations.

### `groupingBy`

Group by a key function.

```java
Map<String, List<Employee>> byDept = employees.stream()
        .collect(Collectors.groupingBy(Employee::department));

// {IT=[Alice, Charlie], HR=[Bob, Dave]}
```

Default downstream is `toList()`. Default map is `HashMap` (unspecified iteration order).

### `groupingBy` + `mapping`

Group, but transform each element before collecting.

```java
List<Employee> employees = List.of(
        new Employee("Alice", "IT", 90_000),
        new Employee("Bob", "HR", 75_000),
        new Employee("Charlie", "IT", 85_000),
        new Employee("Dave", "HR", 80_000)
);

Map<String, List<String>> namesByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.mapping(Employee::name, Collectors.toList())
        ));

System.out.println(namesByDept);
// {IT=[Alice, Charlie], HR=[Bob, Dave]}
```

### `groupingBy` + `counting`

```java
Map<String, Long> countByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.counting()
        ));

System.out.println(countByDept);
// {IT=2, HR=2}
```

### `groupingBy` + `averagingInt`

```java
Map<String, Double> avgSalaryByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.averagingInt(Employee::salary)
        ));

System.out.println(avgSalaryByDept);
// {IT=87500.0, HR=77500.0}
```

### `groupingBy` + `summingInt`

```java
Map<String, Integer> totalSalaryByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.summingInt(Employee::salary)
        ));

System.out.println(totalSalaryByDept);
// {IT=175000, HR=155000}
```

### `groupingBy` with a specific Map type

By default, `groupingBy` uses `HashMap`. To preserve insertion order:

```java
Map<String, List<Employee>> byDeptOrdered = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                LinkedHashMap::new,
                Collectors.toList()
        ));
```

For sorted keys:

```java
Map<String, List<Employee>> byDeptSorted = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                TreeMap::new,
                Collectors.toList()
        ));
```

### `partitioningBy`

Two buckets — `true` and `false`.

```java
List<Integer> numbers = List.of(10, 25, 15, 30, 5, 40);

Map<Boolean, List<Integer>> partition = numbers.stream()
        .collect(Collectors.partitioningBy(n -> n > 20));

System.out.println(partition);
// {false=[10, 15, 5], true=[25, 30, 40]}
```

With counting:

```java
Map<Boolean, Long> counts = numbers.stream()
        .collect(Collectors.partitioningBy(
                n -> n > 20,
                Collectors.counting()
        ));

System.out.println(counts);   // {false=3, true=3}
```

**Difference from `groupingBy`:** `partitioningBy` **always** has exactly two
keys — even if one is empty. `groupingBy` only has keys present in the data.

```java
List<Integer> allSmall = List.of(1, 2, 3);
Map<Boolean, List<Integer>> p = allSmall.stream()
        .collect(Collectors.partitioningBy(n -> n > 100));

System.out.println(p);   // {false=[1, 2, 3], true=[]}  — true key still exists
```

### `toMap`

```java
Map<Integer, String> idToName = employees.stream()
        .collect(Collectors.toMap(
                Employee::id,
                Employee::name
        ));

System.out.println(idToName);
// {1=Alice, 2=Bob, 3=Charlie, 4=Dave}
```

### `toMap` with duplicate keys — merge function

Without a merge function, `toMap` **throws** `IllegalStateException` on
duplicate keys:

```java
// Two employees with the same ID
List<Employee> dupes = List.of(
        new Employee(1, "Alice", 90_000),
        new Employee(1, "Bob", 75_000)
);

Map<Integer, String> map = dupes.stream()
        .collect(Collectors.toMap(Employee::id, Employee::name));
// java.lang.IllegalStateException: Duplicate key 1
```

**Fix — provide a merge function:**

```java
Map<Integer, Employee> highestPaidById = dupes.stream()
        .collect(Collectors.toMap(
                Employee::id,
                Function.identity(),
                (existing, replacement) ->
                        existing.salary() > replacement.salary()
                                ? existing
                                : replacement
        ));

// {1=Employee[Alice, 90000]}
```

### `toUnmodifiableList` / `toUnmodifiableSet` / `toUnmodifiableMap` (Java 10+)

```java
List<String> immutable = employees.stream()
        .map(Employee::name)
        .collect(Collectors.toUnmodifiableList());

immutable.add("Eve");   // UnsupportedOperationException
```

Safer than `Collectors.toList()` if the result shouldn't be mutated.

### `joining`

```java
List<String> names = List.of("Alice", "Bob", "Charlie");

// No separator
String s1 = names.stream().collect(Collectors.joining());
System.out.println(s1);   // "AliceBobCharlie"

// With separator
String s2 = names.stream().collect(Collectors.joining(", "));
System.out.println(s2);   // "Alice, Bob, Charlie"

// With prefix and suffix
String s3 = names.stream().collect(Collectors.joining(", ", "[", "]"));
System.out.println(s3);   // "[Alice, Bob, Charlie]"
```

### `filtering` collector (Java 9+)

Filters inside a downstream collector. **Different from a pipeline `filter()`.**

```java
Map<String, List<String>> highEarners = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.filtering(
                        e -> e.salary() >= 85_000,
                        Collectors.mapping(Employee::name, Collectors.toList())
                )
        ));

System.out.println(highEarners);
// {IT=[Alice, Charlie], HR=[]}  — HR key still present, empty list
```

**Compare with a pipeline filter:**

```java
Map<String, List<String>> viaFilter = employees.stream()
        .filter(e -> e.salary() >= 85_000)
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.mapping(Employee::name, Collectors.toList())
        ));

System.out.println(viaFilter);
// {IT=[Alice, Charlie]}   — HR key is gone entirely
```

**The difference:** with `filtering` as a downstream, all groups are kept
(even empty ones). With a pipeline `filter`, empty groups disappear.

### `flatMapping` collector (Java 9+)

Downstream version of `flatMap`:

```java
record EmployeeWithSkills(String name, String dept, List<String> skills) {}

List<EmployeeWithSkills> emps = List.of(
        new EmployeeWithSkills("Alice", "IT", List.of("Java", "SQL")),
        new EmployeeWithSkills("Bob", "HR", List.of("Recruiting")),
        new EmployeeWithSkills("Charlie", "IT", List.of("Java", "Spring"))
);

Map<String, List<String>> skillsByDept = emps.stream()
        .collect(Collectors.groupingBy(
                EmployeeWithSkills::dept,
                Collectors.flatMapping(
                        e -> e.skills().stream(),
                        Collectors.toList()
                )
        ));

System.out.println(skillsByDept);
// {IT=[Java, SQL, Java, Spring], HR=[Recruiting]}
```

### `collectingAndThen`

Collect, then transform the collected result.

```java
// Wrap an unmodifiable view
List<String> immutableNames = employees.stream()
        .map(Employee::name)
        .collect(Collectors.collectingAndThen(
                Collectors.toList(),
                Collections::unmodifiableList
        ));
```

```java
// Get just min and max salary as a range
record SalaryRange(int min, int max) {}

SalaryRange range = employees.stream()
        .collect(Collectors.collectingAndThen(
                Collectors.summarizingInt(Employee::salary),
                stats -> new SalaryRange(stats.getMin(), stats.getMax())
        ));

System.out.println(range);
// SalaryRange[min=75000, max=90000]
```

### `summarizingInt` / `summarizingLong` / `summarizingDouble`

```java
IntSummaryStatistics stats = employees.stream()
        .collect(Collectors.summarizingInt(Employee::salary));

System.out.println("count:   " + stats.getCount());     // 4
System.out.println("sum:     " + stats.getSum());       // 330000
System.out.println("min:     " + stats.getMin());       // 75000
System.out.println("max:     " + stats.getMax());       // 90000
System.out.println("average: " + stats.getAverage());   // 82500.0
```

One pass, all statistics. Cheaper than calling `count()`, `sum()`, `min()`,
`max()` separately.

---

## `Collectors.teeing` (Java 12+)

Two collectors, one pass, combined by a merger.

```java
record DepartmentStats(long count, double avgSalary) {}

Map<String, DepartmentStats> statsByDept = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::department,
                Collectors.teeing(
                        Collectors.counting(),
                        Collectors.averagingInt(Employee::salary),
                        DepartmentStats::new
                )
        ));

System.out.println(statsByDept);
// {IT=DepartmentStats[count=2, avgSalary=87500.0],
//  HR=DepartmentStats[count=2, avgSalary=77500.0]}
```

### Why `teeing` matters

Before `teeing`, computing two aggregates in one pass required either:
- Two separate stream traversals, or
- A custom collector

`teeing` lets you combine any two collectors in one pass.

### Visualizing the structure

```text
              teeing
             /      \
    counting()   averagingInt()
             \      /
              merger (DepartmentStats::new)
                |
                v
        DepartmentStats
```

---

## `flatMap`

One input → zero, one, or many outputs, flattened into a single stream.

```java
List<List<Integer>> nested = List.of(
        List.of(1, 2, 3),
        List.of(4, 5),
        List.of(6)
);

List<Integer> flat = nested.stream()
        .flatMap(List::stream)
        .toList();

System.out.println(flat);   // [1, 2, 3, 4, 5, 6]
```

### Employee skills example

```java
List<EmployeeWithSkills> emps = List.of(
        new EmployeeWithSkills("Alice", "IT", List.of("Java", "SQL")),
        new EmployeeWithSkills("Bob", "HR", List.of("Recruiting"))
);

List<String> allSkills = emps.stream()
        .flatMap(e -> e.skills().stream())
        .distinct()
        .toList();

System.out.println(allSkills);   // [Java, SQL, Recruiting]
```

### The rule

```text
map()     :  T -> R
flatMap() :  T -> Stream<R>   (flattened)
```

### `flatMap` vs `map` — side by side

```java
List<List<Integer>> nested = List.of(List.of(1, 2), List.of(3, 4));

// map — gives List<Stream<Integer>>
List<Stream<Integer>> mapped = nested.stream()
        .map(List::stream)
        .toList();

// flatMap — gives List<Integer>
List<Integer> flat = nested.stream()
        .flatMap(List::stream)
        .toList();
```

### Flatmapping `Optional` (common idiom)

```java
List<Optional<String>> optionals = List.of(
        Optional.of("Alice"),
        Optional.empty(),
        Optional.of("Charlie")
);

List<String> names = optionals.stream()
        .flatMap(Optional::stream)
        .toList();

System.out.println(names);   // [Alice, Charlie]
```

---

## `mapMulti` (Java 16+)

Modern alternative for imperatively emitting zero, one, or many outputs
without creating intermediate streams.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);

List<Integer> result = numbers.stream()
        .<Integer>mapMulti((n, consumer) -> {
            if (n % 2 == 0) {
                consumer.accept(n * 10);
            }
        })
        .toList();

System.out.println(result);   // [20, 40]
```

### When `mapMulti` beats `flatMap`

When you'd otherwise create a stream per input element:

```java
// flatMap — creates a Stream per element
stream.flatMap(n -> n % 2 == 0 ? Stream.of(n * 10) : Stream.empty());

// mapMulti — no intermediate streams
stream.<Integer>mapMulti((n, c) -> {
    if (n % 2 == 0) c.accept(n * 10);
});
```

### Decision matrix

| Situation | Prefer |
|---|---|
| Simple transformation (filter + map) | `filter()` + `map()` |
| Nested collections | `flatMap()` |
| Complex emission logic, avoiding nested streams | `mapMulti()` |

`mapMulti` is more imperative. Use sparingly.

---

## Stream Laziness — Deep Dive

Intermediate operations do **not** run until a terminal op demands a result.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);

List<Integer> result = numbers.stream()
        .filter(n -> {
            System.out.println("Filter: " + n);
            return n % 2 == 0;
        })
        .map(n -> {
            System.out.println("Map: " + n);
            return n * 10;
        })
        .toList();

System.out.println(result);
```

**Output:**

```text
Filter: 1
Filter: 2
Map: 2
Filter: 3
Filter: 4
Map: 4
Filter: 5
Filter: 6
Map: 6
[20, 40, 60]
```

Notice the **interleaving** — each element travels through the full pipeline
before the next one starts. This is not "filter all, then map all."

### Why laziness matters

**1. Short-circuiting works:**

```java
// Stops at the first match — never processes remaining elements
Optional<Integer> first = IntStream.range(1, 1_000_000_000)
        .filter(n -> n % 12345 == 0)
        .findFirst();
```

**2. Infinite streams become usable:**

```java
// Take first 5 primes
Stream.iterate(2, n -> n + 1)
        .filter(StreamsAndFunctional::isPrime)
        .limit(5)
        .forEach(System.out::println);
// 2, 3, 5, 7, 11
```

**3. Efficiency:**

```java
// Only maps even numbers, not all
stream.filter(n -> n % 2 == 0).map(expensiveOp).toList();
```

### Under the hood

Each intermediate operation creates a new **stage** in the pipeline. Terminal
operations drive elements through all stages via `Sink` objects.

You can see this with `peek` — since `peek` is a no-op consumer, it forces
materialization of each element at that stage.

---

## Short-Circuiting Operations

These can terminate early:

```java
anyMatch()
allMatch()
noneMatch()
findFirst()
findAny()
limit()
takeWhile()
```

### Examples

```java
List<Integer> numbers = List.of(10, 25, 30, 40);

boolean anyOver20 = numbers.stream().anyMatch(n -> n > 20);
System.out.println(anyOver20);   // true

boolean allOver20 = numbers.stream().allMatch(n -> n > 20);
System.out.println(allOver20);   // false

boolean noneOver100 = numbers.stream().noneMatch(n -> n > 100);
System.out.println(noneOver100);   // true

Optional<Integer> first = numbers.stream()
        .filter(n -> n > 20)
        .findFirst();
System.out.println(first.orElse(0));   // 25
```

### Short-circuit on infinite streams

```java
// Runs forever without short-circuiting
Stream.iterate(1, n -> n + 1)
        .filter(n -> n > 1000)
        .findFirst();      // fine — stops at 1001
```

Without `findFirst`, this would loop forever.

---

## `peek` — Debug Only

Observe pipeline stages without consuming:

```java
List<Integer> result = List.of(1, 2, 3, 4, 5).stream()
        .filter(n -> n > 2)
        .peek(n -> System.out.println("After filter: " + n))
        .map(n -> n * 10)
        .peek(n -> System.out.println("After map: " + n))
        .toList();

System.out.println(result);
```

**Output:**

```text
After filter: 3
After map: 30
After filter: 4
After map: 40
After filter: 5
After map: 50
[30, 40, 50]
```

**Warning:** `peek` is for debugging, not for side effects. The JVM may skip
`peek` if the terminal operation doesn't need the elements. Don't use `peek`
for logging business events — use `forEach` or explicit loops.

```java
// BAD — the peek may be skipped by JVM optimization
stream.peek(System.out::println).count();

// GOOD
stream.forEach(System.out::println);
```

---

## `findFirst()` vs `findAny()`

| | `findFirst()` | `findAny()` |
|---|---|---|
| Ordering | Respects encounter order | Any matching element |
| Parallel streams | More expensive (coordination) | Cheaper |
| Deterministic? | Yes | No |
| Use when | You need the first match | You don't care which |

```java
List<Integer> numbers = List.of(10, 25, 30, 40);

// Sequential — both return 25 in practice
System.out.println(numbers.stream().filter(n -> n > 20).findFirst().orElse(0));   // 25
System.out.println(numbers.stream().filter(n -> n > 20).findAny().orElse(0));     // 25
```

```java
// Parallel — findFirst respects order, findAny doesn't
System.out.println(numbers.parallelStream().filter(n -> n > 20).findFirst().orElse(0));
// Always 25

System.out.println(numbers.parallelStream().filter(n -> n > 20).findAny().orElse(0));
// Often 25, but not guaranteed
```

---

## `unordered()`

Explicitly drop the encounter order guarantee.

```java
List<Integer> result = numbers.parallelStream()
        .unordered()
        .filter(n -> n > 20)
        .limit(2)
        .toList();

System.out.println(result);
// Any two matching elements — not necessarily [25, 30]
```

**Why it matters:** `unordered()` gives the implementation more freedom to
parallelize and short-circuit. With `limit(2)` on an unordered parallel
stream, any two matching elements may be returned.

---

## `forEach()` vs `forEachOrdered()`

| | `forEach` | `forEachOrdered` |
|---|---|---|
| Order | Unspecified (especially parallel) | Encounter order |
| Parallel-friendly | ✅ | ❌ (coordination cost) |
| Use when | Order doesn't matter | Order matters |

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);

// Sequential — both print in order
numbers.stream().forEach(System.out::print);          // 12345
numbers.stream().forEachOrdered(System.out::print);   // 12345

// Parallel — forEach is unordered, forEachOrdered is ordered
numbers.parallelStream().forEach(System.out::print);       // e.g. 35412
numbers.parallelStream().forEachOrdered(System.out::print); // 12345
```

**Important nuance:** even `forEachOrdered()` doesn't serialize upstream
processing. Work still happens in parallel — only the terminal consumption
is ordered.

```java
parallelStream
        .map(expensiveWork)             // parallel
        .forEachOrdered(System.out::println);   // ordered output
```

---

## `takeWhile` / `dropWhile` (Java 9+)

### `takeWhile` — keep until predicate fails, then stop

```java
List<Integer> numbers = List.of(1, 2, 3, 10, 4, 5);

List<Integer> result = numbers.stream()
        .takeWhile(n -> n < 5)
        .toList();

System.out.println(result);   // [1, 2, 3]
```

Once `10` fails the predicate, processing stops. The `4` and `5` after it
are ignored.

### `dropWhile` — drop until predicate fails, then keep everything

```java
List<Integer> result = numbers.stream()
        .dropWhile(n -> n < 5)
        .toList();

System.out.println(result);   // [10, 4, 5]
```

### Real-world use case — time-series data

```java
record LogEntry(Instant timestamp, String msg) {}

List<LogEntry> recentLogs = logs.stream()
        .dropWhile(log -> log.timestamp().isBefore(cutoff))
        .toList();
```

vs `filter()` which would check **every** element. `dropWhile` short-circuits.

### `takeWhile` / `dropWhile` vs `filter`

| | `takeWhile`/`dropWhile` | `filter` |
|---|---|---|
| On predicate failure | Stops/starts immediately | Continues checking all elements |
| Assumes sorted order? | Yes (for meaningful use) | No |
| Short-circuits? | ✅ | ❌ |

**Why this matters on unsorted data:**

```java
List<Integer> unsorted = List.of(10, 2, 30, 4, 50);

// takeWhile — stops at 2 (fails < 5)
System.out.println(unsorted.stream().takeWhile(n -> n < 20).toList());
// [10]

// filter — checks all, keeps all matching
System.out.println(unsorted.stream().filter(n -> n < 20).toList());
// [10, 2, 4]
```

`takeWhile` on unsorted data is almost always a bug.

---

## `Stream.iterate` — Bounded (Java 9+)

```java
List<Integer> odds = Stream.iterate(
        1,                      // seed
        n -> n <= 10,           // predicate — stop when false
        n -> n + 2              // next
).toList();

System.out.println(odds);   // [1, 3, 5, 7, 9]
```

The predicate is checked **before** the value is emitted — so `11` never
appears.

### Compare with the Java 8 form

```java
// Java 8 — unbounded, needs limit
List<Integer> odds8 = Stream.iterate(1, n -> n + 2)
        .limit(5)
        .toList();
```

The Java 9 three-arg form is like a functional `for` loop.

### Fibonacci with `iterate`

```java
record Pair(long a, long b) {}

List<Long> fibs = Stream.iterate(
        new Pair(0, 1),
        p -> p.a() < 100,
        p -> new Pair(p.b(), p.a() + p.b())
).map(Pair::a).toList();

System.out.println(fibs);   // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
```

### `Stream.generate`

For arbitrary suppliers:

```java
List<Double> randoms = Stream.generate(Math::random)
        .limit(5)
        .toList();

System.out.println(randoms);   // 5 random doubles
```

Always pair with `limit` — otherwise infinite.

---

## Null / Optional Integration

### `Stream.ofNullable` (Java 9+)

```java
String value = null;

List<String> result = Stream.ofNullable(value)
        .map(String::toUpperCase)
        .toList();

System.out.println(result);   // []
```

```java
String value = "hello";

List<String> result = Stream.ofNullable(value)
        .map(String::toUpperCase)
        .toList();

System.out.println(result);   // [HELLO]
```

Equivalent to:

```java
value != null ? Stream.of(value) : Stream.empty();
```

Useful when an operation may return `null` and you want to integrate it into
a pipeline without null checks.

### `Optional.stream` (Java 9+)

An `Optional<T>` becomes a `Stream<T>` of 0 or 1 elements.

```java
List<Optional<String>> optionals = List.of(
        Optional.of("Alice"),
        Optional.empty(),
        Optional.of("Charlie")
);

List<String> names = optionals.stream()
        .flatMap(Optional::stream)
        .toList();

System.out.println(names);   // [Alice, Charlie]
```

**Why this is idiomatic:** before `Optional.stream()`, you'd use
`filter(Optional::isPresent).map(Optional::get)`. The `flatMap(Optional::stream)`
form is cleaner and shorter.

### `map` returning `Optional`

```java
List<String> ids = List.of("1", "abc", "3");

List<Integer> numbers = ids.stream()
        .map(s -> {
            try { return Optional.of(Integer.parseInt(s)); }
            catch (NumberFormatException e) { return Optional.<Integer>empty(); }
        })
        .flatMap(Optional::stream)
        .toList();

System.out.println(numbers);   // [1, 3]
```

Filters out parse failures in one pipeline.

---

## Stream Lifecycle — Cannot Be Reused

A terminal op **consumes** the stream.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);
Stream<Integer> stream = numbers.stream();

long count = stream.count();          // terminal — stream consumed

List<Integer> result = stream
        .filter(n -> n > 2)
        .toList();                    // IllegalStateException!
```

**Actual exception:** `java.lang.IllegalStateException: stream has already
been operated upon or closed`

### Correct

```java
long count = numbers.stream().count();

List<Integer> result = numbers.stream()
        .filter(n -> n > 2)
        .toList();
```

**Mental model:**

```text
Collection -> can produce many streams
Stream     -> one pipeline, one terminal op, then done
```

### Reusable streams via `Supplier<Stream<T>>`

```java
List<Employee> employees = getEmployees();

Supplier<Stream<Employee>> employeeStream = () -> employees.stream();

long count = employeeStream.get().count();
long sum = employeeStream.get()
        .mapToLong(Employee::salary)
        .sum();
```

Each `get()` produces a **new** stream. **But** if `getEmployees()` were a
database query, calling it twice would run the query twice. A supplier is
not automatically a performance win.

---

## Primitive Streams vs Object Streams

| | `Stream<Integer>` | `IntStream` |
|---|---|---|
| Element type | Boxed `Integer` | Primitive `int` |
| Memory | ~16 bytes per element | 4 bytes |
| Numeric ops | None | `sum`, `average`, `max`, `min` |
| Conversion | `mapToInt(...)` | `.boxed()` |

### `map` vs `mapToInt` — measured

```java
List<Integer> numbers = IntStream.range(0, 1_000_000)
        .boxed()
        .toList();

long start = System.nanoTime();
long sum1 = numbers.stream()
        .map(n -> n * 2)
        .reduce(0, Integer::sum);
long t1 = System.nanoTime() - start;

start = System.nanoTime();
long sum2 = numbers.stream()
        .mapToInt(n -> n * 2)
        .sum();
long t2 = System.nanoTime() - start;

System.out.printf("map+reduce:  %,d ns%n", t1);
System.out.printf("mapToInt:    %,d ns%n", t2);
// Typically 3–5x faster with mapToInt
```

Use `mapToInt` for numeric processing — avoids autoboxing.

---

## Parallel Streams

```java
numbers.parallelStream()
```

or:

```java
numbers.stream().parallel()
```

### When parallelism helps — measured

```java
List<Integer> numbers = IntStream.rangeClosed(1, 10_000_000)
        .boxed()
        .toList();

// Sequential
long start = System.nanoTime();
long sum1 = numbers.stream()
        .mapToLong(n -> (long) n * n)
        .sum();
long seqTime = System.nanoTime() - start;

// Parallel
start = System.nanoTime();
long sum2 = numbers.parallelStream()
        .mapToLong(n -> (long) n * n)
        .sum();
long parTime = System.nanoTime() - start;

System.out.printf("Sequential: %,d ns%n", seqTime);
System.out.printf("Parallel:   %,d ns%n", parTime);
```

For 10M elements with real work — parallel is often **2–4× faster** on a
multi-core machine. For small data or trivial operations — parallel is often
**slower** due to overhead.

### When parallel streams are bad

| Bad case | Why |
|---|---|
| Small datasets | Overhead > benefit |
| Cheap operations | Same |
| Ordering required | Coordination cost |
| Non-splittable source | No parallelism possible |
| Blocking I/O | Ties up ForkJoinPool threads |
| Shared mutable state | Race conditions |

### Processing order vs encounter order

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);

numbers.parallelStream()
        .map(n -> { System.out.println("processing " + n); return n; })
        .forEachOrdered(n -> System.out.println("consuming " + n));
// processing order: unpredictable
// consuming order:  1, 2, 3, 4, 5
```

### Ordered `limit` in parallel

```java
List<Integer> result = IntStream.range(0, 1_000_000)
        .parallel()
        .filter(n -> n % 7 == 0)
        .limit(2)
        .boxed()
        .toList();

System.out.println(result);   // [0, 7] — first two in encounter order
```

With `unordered()`:

```java
List<Integer> result = IntStream.range(0, 1_000_000)
        .parallel()
        .unordered()
        .filter(n -> n % 7 == 0)
        .limit(2)
        .boxed()
        .toList();

// Any two multiples of 7 — more parallel freedom, less coordination
```

### `ForkJoinPool` — the execution engine

Parallel streams use `ForkJoinPool.commonPool()` by default. Pool size is
`Runtime.getRuntime().availableProcessors() - 1` (minimum 1).

You can run a parallel stream in a **custom pool**:

```java
ForkJoinPool customPool = new ForkJoinPool(8);
try {
    List<Integer> result = customPool.submit(() ->
            numbers.parallelStream()
                    .map(expensiveOp)
                    .toList()
    ).get();
} finally {
    customPool.shutdown();
}
```

**Warning:** blocking I/O inside a parallel stream can starve the common pool
for other parallel streams in the same JVM. Use a custom pool or virtual
threads for I/O-bound work.

### `Spliterator`

The source iterator for parallel streams. Determines how a stream splits.

```java
default Stream<E> parallelStream() {
    return StreamSupport.stream(spliterator(), true);
}
```

Well-splitting sources (ArrayList, arrays, `IntStream.range`) parallelize
nicely. Poorly-splitting sources (LinkedList, `Iterator`-backed) don't.

```java
// GOOD — splits in half each time
List<Integer> arrayList = new ArrayList<>(...);
arrayList.parallelStream()...

// BAD — must traverse to split
List<Integer> linkedList = new LinkedList<>(...);
linkedList.parallelStream()...
```

### Parallel `reduce` — identity, accumulator, combiner

```java
T reduce(T identity, BinaryOperator<T> accumulator)
```

For sequential streams, only identity and accumulator matter.

```java
<U> U reduce(U identity,
             BiFunction<U, T, U> accumulator,
             BinaryOperator<U> combiner)
```

For **parallel** streams, the combiner merges partial results.

```java
List<String> words = List.of("hello", "world", "foo", "bar");

int total = words.parallelStream()
        .reduce(
                0,                                       // identity
                (sum, word) -> sum + word.length(),      // accumulator
                Integer::sum                             // combiner
        );

System.out.println(total);   // 17
```

### Associativity requirement

The accumulator and combiner must be **associative**:

```text
(a op b) op c  ==  a op (b op c)
```

```java
// Associative — safe in parallel
(a + b) + c == a + (b + c)

// NOT associative — parallel may give wrong result
(a - b) - c != a - (b - c)
```

```java
List<Integer> numbers = List.of(1, 2, 3, 4);

// Sequential — always 1 - 2 - 3 - 4 = -8
int seq = numbers.stream().reduce(0, (a, b) -> a - b);
System.out.println(seq);   // -8

// Parallel — result is unpredictable due to non-associativity
int par = numbers.parallelStream().reduce(0, (a, b) -> a - b);
System.out.println(par);   // e.g. -10 or -2 or -8 depending on split
```

### Identity requirement

The identity must be a **true identity** for the operation:

```text
identity op x == x
x op identity == x
```

```java
// WRONG — 1 is not an identity for subtraction
int result = numbers.parallelStream().reduce(1, (a, b) -> a - b);

// RIGHT — 0 is the identity for addition, 1 for multiplication, "" for concat
```

Breaking the identity rule in parallel can produce **wrong results**.

### `reduce` vs `collect`

| | `reduce` | `collect` |
|---|---|---|
| Result type | Immutable combination | Mutable container |
| Parallel-friendly | Requires associative op | Built for it (mutable containers merge) |
| Typical use | Sums, products, min/max | Building lists, maps, strings |
| Example | `reduce(0, Integer::sum)` | `collect(toList())` |

Use `collect` when building collections — it's designed for parallel
correctness with immutable results.

### Shared mutable state in parallel streams

**Never mutate shared state inside a parallel stream.**

```java
// WRONG — race condition, may produce wrong results
List<String> results = new ArrayList<>();
words.parallelStream().forEach(w -> results.add(w));   // BAD

// RIGHT — use collect
List<String> results = words.parallelStream()
        .collect(Collectors.toList());
```

`collect` is designed to build containers safely in parallel. `forEach` is
not.

---

## Collector Characteristics

A `Collector` has a `Set<Characteristics>`:

| Characteristic | Meaning |
|---|---|
| `CONCURRENT` | Can run in parallel using a shared mutable accumulator |
| `UNORDERED` | Doesn't preserve encounter order |
| `IDENTITY_FINISH` | No final transformation after accumulation |

Built-in collectors:

- `toList()`, `toSet()` — no special characteristics
- `toConcurrentMap()` — CONCURRENT, UNORDERED
- `joining()` — IDENTITY_FINISH
- `counting()` — IDENTITY_FINISH

### Custom `Collector` (rare)

```java
Collector<String, ?, List<String>> toImmutableList() {
    return Collector.of(
            ArrayList::new,                              // supplier
            List::add,                                   // accumulator
            (left, right) -> { left.addAll(right); return left; },   // combiner
            Collections::unmodifiableList                // finisher
    );
}
```

Four functions: supplier, accumulator, combiner, finisher.

**Advice:** use built-in collectors first. Custom collectors are rarely
worth the complexity.

---

## Exception Handling in Lambdas

Lambdas can't throw checked exceptions directly:

```java
// WRONG — doesn't compile
list.stream()
        .map(s -> Files.readString(Path.of(s)))   // IOException not allowed
        .toList();
```

### Wrapper helpers

```java
@FunctionalInterface
interface ThrowingFunction<T, R> {
    R apply(T t) throws Exception;
}

static <T, R> Function<T, R> unchecked(ThrowingFunction<T, R> f) {
    return t -> {
        try { return f.apply(t); }
        catch (Exception e) { throw new RuntimeException(e); }
    };
}
```

### Inline wrapping

```java
List<String> files = List.of("a.txt", "b.txt", "c.txt");

List<String> contents = files.stream()
        .map(s -> {
            try { return Files.readString(Path.of(s)); }
            catch (IOException e) { throw new UncheckedIOException(e); }
        })
        .toList();
```

**Why `UncheckedIOException`:** it signals "I/O problem" in the type name,
making stack traces clearer than a generic `RuntimeException`.

### Collecting errors instead of throwing

```java
record ParseResult(String input, Integer value, Exception error) {}

List<String> inputs = List.of("1", "abc", "3", "xyz");

List<ParseResult> results = inputs.stream()
        .map(s -> {
            try { return new ParseResult(s, Integer.parseInt(s), null); }
            catch (NumberFormatException e) { return new ParseResult(s, null, e); }
        })
        .toList();

// Then partition
Map<Boolean, List<ParseResult>> partitioned = results.stream()
        .collect(Collectors.partitioningBy(r -> r.error() == null));

List<Integer> good = partitioned.get(true).stream()
        .map(ParseResult::value)
        .toList();

List<String> bad = partitioned.get(false).stream()
        .map(ParseResult::input)
        .toList();

System.out.println(good);   // [1, 3]
System.out.println(bad);    // [abc, xyz]
```

---

## Extra Topics

### `IntStream.range` and `rangeClosed`

```java
System.out.println(IntStream.range(0, 5).boxed().toList());
// [0, 1, 2, 3, 4]

System.out.println(IntStream.rangeClosed(0, 5).boxed().toList());
// [0, 1, 2, 3, 4, 5]
```

Functional alternatives to `for` loops:

```java
IntStream.range(0, list.size())
        .forEach(i -> process(list.get(i)));
```

### `Collectors.joining` variants

```java
List<String> names = List.of("Alice", "Bob", "Charlie");

System.out.println(names.stream().collect(Collectors.joining()));
// AliceBobCharlie

System.out.println(names.stream().collect(Collectors.joining(", ")));
// Alice, Bob, Charlie

System.out.println(names.stream().collect(Collectors.joining(", ", "[", "]")));
// [Alice, Bob, Charlie]
```

### `Stream.concat`

```java
Stream<String> a = Stream.of("a", "b");
Stream<String> b = Stream.of("b", "c");

System.out.println(Stream.concat(a, b).toList());
// [a, b, b, c] — duplicates preserved
```

Combine with `.distinct()` if needed.

### Sequenced Collections (Java 21)

```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3, 4));

System.out.println(list.getFirst());   // 1
System.out.println(list.getLast());    // 4

list.addFirst(0);
list.addLast(5);
System.out.println(list);   // [0, 1, 2, 3, 4, 5]

System.out.println(list.reversed());   // [5, 4, 3, 2, 1, 0]
```

All `List`, `Deque`, and sorted collections implement these.

### `Collectors.toUnmodifiableList/Set/Map` (Java 10+)

```java
List<String> immutable = stream.collect(Collectors.toUnmodifiableList());
immutable.add("x");   // UnsupportedOperationException
```

### `Stream.toList()` (Java 16+)

Shorter than `collect(Collectors.toList())`:

```java
List<Integer> result = stream.filter(...).toList();
```

**Difference:** `Stream.toList()` returns an **immutable** list.
`Collectors.toList()` returns a mutable one (implementation-dependent, but
usually `ArrayList`).

---

## Stream Operations Quick Decision Guide

| Need | Operation |
|---|---|
| Remove elements | `filter()` |
| One transformed value per input | `map()` |
| Zero/many outputs per input | `flatMap()` |
| Complex imperative emission | `mapMulti()` |
| Numeric primitive processing | `mapToInt` / `mapToLong` / `mapToDouble` |
| One combined result | `reduce()` |
| Min/max of an object stream | `min()` / `max()` |
| Group by key | `groupingBy()` |
| Two buckets (true/false) | `partitioningBy()` |
| Build a Map | `toMap()` |
| Multiple aggregations, one pass | `teeing()` or `summarizingInt` |
| Stop at first predicate failure | `takeWhile()` |
| Skip until first predicate failure | `dropWhile()` |
| Optional as a 0/1 stream | `Optional.stream()` |
| Null as 0/1 stream | `Stream.ofNullable()` |
| Reusable pipeline | New stream from source; or `Supplier<Stream<T>>` |
| Parallel processing | `parallelStream()` — verify it helps |

---

## Interview-Level Rules

1. **Streams are lazy.** Nothing runs until a terminal op.
2. **A stream cannot be reused** after a terminal op.
3. **`map()` = one output per input.**
4. **`flatMap()` = zero/many outputs, flattened.**
5. **`filter()` examines all elements; `takeWhile()` stops at first failure
   on ordered streams.**
6. **`findFirst()` respects order; `findAny()` doesn't need to.**
7. **Parallelism doesn't remove ordering guarantees** unless you call
   `unordered()`.
8. **`mapToInt()` creates an `IntStream`**, not `Stream<Integer>`.
9. **Use built-in collectors before writing custom ones.**
10. **`teeing()` combines two collectors in one pass.**
11. **`summarizingInt()` yields count/sum/min/max/average in one pass.**
12. **Parallel `reduce()` requires associative ops and a true identity.**
13. **Never mutate shared state inside a parallel stream — use `collect`.**
14. **`peek` is for debugging only, not business logic.**
15. **`Optional.stream()` is the idiomatic way to filter out empty Optionals.**
16. **`filtering` (collector) keeps empty groups; a pipeline `filter` removes
    them.**
17. **`Stream.toList()` is immutable; `Collectors.toList()` is mutable.**
18. **`sorted()` is stateful — it buffers the entire stream.**

---

## Tricky Corners ⚠️

**`Collectors.toMap` throws on duplicate keys** unless a merge function is
provided.

**`groupingBy` uses `HashMap` by default** — iteration order is unspecified.
Use the 3-arg form to supply `TreeMap` or `LinkedHashMap`.

**`distinct()` on objects requires `equals`/`hashCode`.** If you didn't
override them, `distinct()` uses identity — usually not what you want.

**`sorted()` is stateful.** It buffers the whole stream. Watch memory on
large inputs.

**`parallelStream()` uses the common ForkJoinPool.** Blocking I/O inside a
parallel stream can starve the pool. Use a custom pool or virtual threads
for I/O-bound work.

**`forEachOrdered` doesn't serialize upstream work** — only the terminal
consumption is ordered.

**`reduce` with a non-associative op gives different results in parallel
vs sequential.** Subtraction is a classic example.

**`Collectors.toList()` makes no guarantees about mutability.** Use
`toUnmodifiableList()` for immutable, or `collectingAndThen` to wrap.

**Stream re-use throws `IllegalStateException`**, not
`UnsupportedOperationException`.

**`Stream.empty()` returns a shared instance** — safe to reuse.

**`Stream.of(primitiveArray)` gives `Stream<int[]>` of size 1**, not
`Stream<Integer>`:

```java
int[] arr = {1, 2, 3};

System.out.println(Stream.of(arr).count());              // 1
System.out.println(Arrays.stream(arr).boxed().count());  // 3
```

**`peek` may be skipped** if the terminal operation doesn't need the elements.
Never use it for business side effects.

**`Collectors.groupingBy` with a downstream that returns `Optional`:**
`groupingBy` will not merge `Optional.empty()`. Result map type is
`Map<K, Optional<V>>`, not `Map<K, V>`.

**`null` in a stream:** streams don't allow `null` in the source for some
operations. `List.of("a", null)` throws. Use `Arrays.asList(...)` if you
really need nulls — but prefer avoiding them.

---

## Common Pitfalls

- Trying to reuse a stream after a terminal operation.
- Using `peek` for business logic instead of debugging.
- Assuming `parallelStream()` is faster without measuring.
- Using `filter` before `groupingBy` and losing empty groups.
- Mutating a shared collection inside a parallel stream.
- Forgetting that `toMap` fails on duplicate keys.
- Using `Stream.of(primitiveArray)` — use `Arrays.stream(...)` instead.
- Forgetting `Collectors.toList()` doesn't guarantee immutability.
- Assuming `forEach` on parallel streams preserves order.
- Using `reduce` for building collections (use `collect`).

---

## Key Interview Tips

- Lead with **laziness** — most "why is this happening?" questions hinge on it.
- Explain the **Stream lifecycle** — a stream is one pipeline, one terminal op.
- Know the **difference between `map` and `flatMap`** in one line.
- Be ready to say: filter/transform in a pipeline; aggregate with collectors.
- Explain **parallel stream pitfalls** — shared state, ordering, blocking I/O.
- Mention **`teeing`** as the modern way to do two aggregations in one pass.
- Know **`Optional.stream()`** as a common idiom for filtering empty Optionals.
- Explain **why `reduce` isn't right for building collections** (use `collect`).
- If asked "when is parallelStream faster?", cite **large data, expensive ops,
  splittable source, no ordering requirement**.

---

## Related

- [Collections Overview](collections-overview.md) — source of most streams
- [List Implementations](list-implementations.md) — `ArrayList.stream()` vs `LinkedList.parallelStream()`
- [HashMap Internals](hashmap-internals.md) — `groupingBy` and `toMap` internals
- [Concurrent Collections](concurrent-collections.md) — concurrency-safe collect
- [Keywords Deep Dive](../fundamentals/keywords-deep-dive.md) — `final`, `var` in lambdas
- [Virtual Threads](../concurrency/virtual-threads.md) — Java 21 alternative to parallel streams for I/O