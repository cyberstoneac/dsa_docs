# Java Versions

> **JDK context:** This file is a scannable timeline of language and platform
> changes from Java 7 through 21. Focus is on **what changed and why**, not
> exhaustive feature lists.

## Mental Model

Java's release cadence changed in 2017. Before Java 9, releases were
feature-driven and slow (3+ years between majors). Since Java 9, we get a
**new feature release every 6 months** and an **LTS (Long-Term Support) every
2 years**.

```d2
direction: right

cadence: "Release Cadence" {
  style.fill: "#f5f5f5"

  pre9: "Pre-Java 9\nFeature-driven\n3+ years between majors" {
    style.fill: "#ffcdd2"
  }

  post9: "Java 9+\nTime-driven\n6 months per release" {
    style.fill: "#c8e6c9"
  }

  lts: "LTS every 2 years\n8, 11, 17, 21, 25..." {
    style.fill: "#bbdefb"
  }

  cadence.pre9 -> cadence.post9: "JEP process"
  cadence.post9 -> cadence.lts: "predictable support"
}
```

---

## Timeline Overview

```d2
direction: right

j7: "JDK 7\n2011" {
  style.fill: "#e1f5fe"
  f1: "try-with-resources"
  f2: "diamond operator"
  f3: "strings in switch"
  f4: "ForkJoinPool"
  f5: "invokedynamic"
}

j8: "JDK 8 LTS\n2014" {
  style.fill: "#b3e5fc"
  f1: "Lambdas"
  f2: "Streams"
  f3: "Optional"
  f4: "default methods"
  f5: "CompletableFuture"
  f6: "Date/Time API"
}

j9: "JDK 9\n2017" {
  style.fill: "#81d4fa"
  f1: "JPMS modules"
  f2: "jshell"
  f3: "private interface methods"
  f4: "Stream.ofNullable"
}

j10: "JDK 10\n2018" {
  style.fill: "#4fc3f7"
  f1: "var"
}

j11: "JDK 11 LTS\n2018" {
  style.fill: "#29b6f6"
  f1: "HTTP/2 client"
  f2: "String.isBlank/lines"
  f3: "var in lambda params"
}

j14: "JDK 14\n2020" {
  style.fill: "#03a9f4"
  f1: "switch expressions (std)"
  f2: "records (preview)"
}

j16: "JDK 16\n2021" {
  style.fill: "#039be5"
  f1: "records (std)"
  f2: "instanceof pattern"
  f3: "Stream.toList()"
}

j17: "JDK 17 LTS\n2021" {
  style.fill: "#0288d1"
  f1: "sealed classes"
  f2: "switch pattern (preview)"
  f3: "strong encapsulation"
}

j21: "JDK 21 LTS\n2023" {
  style.fill: "#01579b"
  style.font-color: white
  f1: "virtual threads"
  f2: "sequenced collections"
  f3: "switch pattern (std)"
  f4: "record patterns"
  f5: "generational ZGC"
}

j7 -> j8 -> j9 -> j10 -> j11 -> j14 -> j16 -> j17 -> j21
```

---

## JDK 7 (2011)

The last "feature-driven" release before Java 8.

| Feature | Why it matters |
|---|---|
| **try-with-resources** | Automatic resource cleanup via `AutoCloseable` |
| **Diamond operator** `<>` | Type inference for generic constructors |
| **Strings in switch** | Switch on `String` without `if-else` chains |
| **Multi-catch** | `catch (IOException \| SQLException e)` |
| **Underscores in literals** | `1_000_000` for readability |
| **ForkJoinPool** | Work-stealing parallelism foundation |
| **invokedynamic** | Enables lambdas in Java 8 |

```java
// try-with-resources
try (BufferedReader br = Files.newBufferedReader(path)) {
    return br.readLine();
}   // br.close() called automatically

// diamond
Map<String, List<Integer>> map = new HashMap<>();
```

---

## JDK 8 (2014) — LTS

The most impactful release in modern Java.

| Feature | Why it matters |
|---|---|
| **Lambdas** | Functional-style code, cleaner callbacks |
| **Streams** | Declarative pipelines over collections |
| **Optional** | Express "may not exist" without null |
| **Default methods** | Interfaces can have implementations |
| **CompletableFuture** | Composable async programming |
| **New Date/Time API** | Immutable, thread-safe `java.time` |
| **`Metaspace`** | Replaced `PermGen` |

```java
list.stream()
    .filter(x -> x > 10)
    .map(String::valueOf)
    .toList();
```

**The lambda rationale:** Before Java 8, anonymous classes were verbose. A
single-method interface took 6+ lines to implement inline. Java 8's `invokedynamic`
(from Java 7) enables lambdas to be compiled to a runtime-generated class —
lighter than an anonymous class.

Full coverage: [Streams & Functional](../collections/streams-and-functional.md).

---

## JDK 9 (2017)

| Feature | Why it matters |
|---|---|
| **JPMS (Project Jigsaw)** | Modular JDK — `module-info.java` |
| **jshell** | REPL for quick Java experiments |
| **Private interface methods** | Share code between default methods |
| **`Stream.ofNullable`** | Null-safe stream creation |
| **`takeWhile` / `dropWhile`** | Conditional streaming |
| **Collection factory methods** | `List.of(...)`, `Map.of(...)` |

JPMS lets you build custom runtime images with `jlink`, reducing deployment size.

```bash
jlink --add-modules java.base --output mini-jre
```

---

## JDK 10 (2018)

| Feature | Why it matters |
|---|---|
| **`var`** | Local variable type inference |

```java
var list = new ArrayList<String>();   // list is ArrayList<String>
```

Small but polarizing. See [Keywords Deep Dive](keywords-deep-dive.md#var--type-inference-java-10).

---

## JDK 11 (2018) — LTS

The first LTS after Java 8. Widely adopted.

| Feature | Why it matters |
|---|---|
| **HTTP/2 Client** | Modern replacement for `HttpURLConnection` |
| **`String.isBlank/lines/repeat/strip`** | Everyday string utilities |
| **`var` in lambda params** | Enables annotations on lambda params |
| **`Files.readString/writeString`** | One-liner file I/O |
| **Removed CORBA, JAX-WS** | Ecosystem cleanup |

```java
HttpClient client = HttpClient.newHttpClient();
HttpResponse<String> response = client.send(
    HttpRequest.newBuilder(URI.create("https://example.com")).build(),
    HttpResponse.BodyHandlers.ofString());
```

---

## JDK 12–13 (2019)

Transitional releases. Mostly preview features.

| Feature | Release | Note |
|---|---|---|
| **Switch expressions (preview)** | 12 | Arrow syntax `case X -> ...` |
| **`Collectors.teeing`** | 12 | Two collectors, one pass |
| **Text blocks (preview)** | 13 | Multi-line string literals |

```java
String json = """
    {
        "name": "Alice"
    }
    """;
```

---

## JDK 14 (2020)

| Feature | Why it matters |
|---|---|
| **Switch expressions (standard)** | No more `break` in every case |
| **Records (preview)** | Immutable data carriers |
| **`instanceof` pattern (preview)** | Type check + cast in one |
| **Helpful NullPointerExceptions** | Tells you *which* variable was null |

```java
// Switch expression
String result = switch (day) {
    case MONDAY, TUESDAY -> "start of week";
    case FRIDAY -> "almost there";
    default -> "midweek";
};

// Helpful NPE
// NullPointerException: Cannot invoke "String.length()" because "user.name" is null
```

---

## JDK 15 (2020)

| Feature | Why it matters |
|---|---|
| **Text blocks (standard)** | Multi-line strings |
| **Sealed classes (preview)** | Restrict who can extend |
| **ZGC (production)** | Ultra-low-latency GC |
| **Records (2nd preview)** | Refined |

---

## JDK 16 (2021)

| Feature | Why it matters |
|---|---|
| **Records (standard)** | `record Point(int x, int y) {}` |
| **`instanceof` pattern (standard)** | `if (o instanceof String s)` |
| **`Stream.toList()`** | Shorter than `collect(toList())` |
| **Vector API (incubator)** | SIMD-style computation |

```java
record Point(int x, int y) { }

if (obj instanceof Point p) {
    System.out.println(p.x());
}
```

---

## JDK 17 (2021) — LTS

The current baseline for most enterprise code.

| Feature | Why it matters |
|---|---|
| **Sealed classes (standard)** | Closed type hierarchies |
| **Pattern matching for switch (preview)** | Type-based case branches |
| **Strong encapsulation of JDK internals** | No more `--illegal-access` |
| **Deprecation of Applet API** | Removing legacy |
| **Enhanced pseudo-random generators** | `RandomGenerator` interface |

```java
sealed interface Shape permits Circle, Square { }
record Circle(double radius) implements Shape { }
record Square(double side) implements Shape { }

double area = switch (shape) {
    case Circle c -> Math.PI * c.radius() * c.radius();
    case Square s -> s.side() * s.side();
};
```

---

## JDK 18 (2022)

| Feature | Why it matters |
|---|---|
| **Simple web server** | `jwebserver` for static files |
| **UTF-8 by default** | Standard charset consistency |
| **Code snippets in Javadoc** | `{@snippet ...}` |

Mostly a stepping stone to 21.

---

## JDK 19–20 (2022–2023)

Preview-heavy releases leading to 21.

| Feature | Release | Note |
|---|---|---|
| **Virtual threads (preview)** | 19 | Lightweight threads |
| **Structured concurrency (preview)** | 19 | Scoped task groups |
| **Record patterns (preview)** | 19 | Destructure records |
| **Scoped values (preview)** | 20 | Alternative to ThreadLocal |

---

## JDK 21 (2023) — LTS

The most significant release since Java 8.

| Feature | Why it matters |
|---|---|
| **Virtual threads (standard)** | Millions of threads on one JVM |
| **Sequenced collections** | `SequencedCollection`, `SequencedSet`, `SequencedMap` |
| **Pattern matching for switch (standard)** | `case Circle c -> ...` |
| **Record patterns (standard)** | Destructure records in patterns |
| **Generational ZGC** | Better ZGC throughput |
| **Structured concurrency (preview)** | `StructuredTaskScope` |

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        });
    }
}   // waits for all tasks
```

Full coverage: [Virtual Threads](../concurrency/virtual-threads.md).

---

## Version Selection Guidance

| Situation | Recommended JDK |
|---|---|
| **Enterprise / LTS-required** | 17 or 21 |
| **New greenfield project** | 21 |
| **Android** | Depends on API level — 17 for modern |
| **Legacy compatibility** | 11 minimum |
| **Learning modern Java** | 21 |

**LTS pattern:** 8 → 11 → 17 → 21 → 25 (expected ~2025). Each LTS is
supported for years; non-LTS releases fall out of support after 6 months.

---

## Feature-to-JDK Cheat Table

| Feature | Introduced |
|---|---|
| `try-with-resources` | 7 |
| Diamond operator | 7 |
| Lambdas | 8 |
| Streams | 8 |
| `Optional` | 8 |
| `CompletableFuture` | 8 |
| Default methods in interfaces | 8 |
| `java.time` API | 8 |
| JPMS (modules) | 9 |
| `List.of`, `Map.of` | 9 |
| Private interface methods | 9 |
| `var` | 10 |
| HTTP/2 client | 11 |
| `String.isBlank/lines/strip` | 11 |
| Switch expressions (std) | 14 |
| Helpful NPEs | 14 |
| Text blocks (std) | 15 |
| Records | 16 |
| `instanceof` pattern | 16 |
| `Stream.toList()` | 16 |
| Sealed classes | 17 |
| Pattern matching for switch (std) | 21 |
| Record patterns | 21 |
| Virtual threads | 21 |
| Sequenced collections | 21 |
| Structured concurrency (preview) | 21 |

---

## Common Pitfalls

- Assuming every JDK release is production-ready — non-LTS releases lose
  support after 6 months.
- Forgetting that `records` were preview before 16 and `sealed` before 17.
- Using preview features (`--enable-preview`) in production code.
- Not knowing which JDK introduced a feature — a common interview question.
- Assuming Java 21 features will work on Java 17 without checking.

---

## Key Interview Tips

- Know the **LTS versions**: 8, 11, 17, 21.
- Explain the cadence change: pre-9 feature-driven, post-9 time-driven.
- Mention `invokedynamic` (Java 7) as the enabler for lambdas (Java 8).
- Connect Metaspace (Java 8) to the PermGen removal.
- For "what's new in Java 21," lead with virtual threads and pattern matching.

---

## Related

- [JVM Architecture](jvm-architecture.md) — Metaspace vs PermGen context
- [Keywords Deep Dive](keywords-deep-dive.md) — `var` details
- [Streams & Functional](../collections/streams-and-functional.md) — Streams from Java 8 to 21
- [Virtual Threads](../concurrency/virtual-threads.md) — Java 21 concurrency