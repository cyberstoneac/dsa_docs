# Modern JDK APIs (9 → 21)

> **JDK context:** This file covers API additions from Java 9 through Java 21
> *except* `java.time` (Java 8, well-covered elsewhere). Focus is on APIs you
> will actually use.

## Mental Model

Modern Java releases land in three cadences:

- **LTS** (Long-Term Support): 11, 17, 21 — safe for production
- **Feature releases** every 6 months — try them, don't depend on them for
  long-running production
- **Preview features** — opt-in with `--enable-preview`

Everything below is **standard** (not preview) unless marked.

---

## Java 9 — The Transition Release

### `List.of`, `Set.of`, `Map.of` — immutable factory methods

```java
List<String> list = List.of("a", "b", "c");
Set<String> set = Set.of("x", "y", "z");
Map<String, Integer> map = Map.of("a", 1, "b", 2);

// All immutable — throws UnsupportedOperationException on modification
list.add("d");   // UnsupportedOperationException
```

**Properties:**

- Immutable
- Reject nulls — `List.of("a", null)` throws `NullPointerException`
- `Set.of` and `Map.of` reject duplicate elements/keys at construction
- Up to 10 key-value pairs in `Map.of`; use `Map.ofEntries(...)` for more

### `Stream.ofNullable`, `takeWhile`, `dropWhile`

```java
Stream.ofNullable(maybeNull).forEach(System.out::println);
// null → empty stream; non-null → single-element stream

List.of(1, 2, 3, 10, 4).stream()
        .takeWhile(n -> n < 5)
        .toList();
// [1, 2, 3]

List.of(1, 2, 3, 10, 4).stream()
        .dropWhile(n -> n < 5)
        .toList();
// [10, 4]
```

### `Optional.ifPresentOrElse`, `or`

```java
optional.ifPresentOrElse(
        value -> System.out.println("Got: " + value),
        () -> System.out.println("Empty")
);

Optional<String> result = optional.or(() -> Optional.of("default"));
```

### `Optional.stream()` — Java 9+

```java
List<Optional<String>> optionals = List.of(Optional.of("a"), Optional.empty());
List<String> present = optionals.stream()
        .flatMap(Optional::stream)
        .toList();
// [a]
```

### Private interface methods

```java
public interface Greeter {
    default String greet(String name) { return format("Hello", name); }
    default String farewell(String name) { return format("Goodbye", name); }

    private String format(String greeting, String name) {
        return greeting + ", " + name;
    }
}
```

Private methods let default methods share code without exposing helpers.

### `ProcessHandle`

```java
ProcessHandle current = ProcessHandle.current();
System.out.println("PID: " + current.pid());

current.info().commandLine().ifPresent(System.out::println);
current.info().startInstant().ifPresent(System.out::println);

// List child processes
current.children().forEach(p -> System.out.println(p.pid()));
```

### `String.chars()` and `codePoints()`

```java
"hello".chars().forEach(c -> System.out.print((char) c));   // hello

"héllo".codePoints().forEach(cp -> System.out.print((char) cp));   // héllo
```

Use `codePoints()` for full Unicode support (surrogate pairs).

---

## Java 10 — `var` and `toUnmodifiable*`

### `var` — local variable type inference

```java
var list = new ArrayList<String>();   // ArrayList<String>
var count = 10;                       // int
var name = "hello";                   // String
```

**Rules:**

- Local variables only (no fields, no method params)
- Requires an initializer
- Cannot be `null`
- Cannot be used in multi-variable declarations

### `Collectors.toUnmodifiable*`

```java
List<String> immutable = stream.collect(Collectors.toUnmodifiableList());
Set<String> immutableSet = stream.collect(Collectors.toUnmodifiableSet());
Map<String, Integer> immutableMap = stream.collect(Collectors.toUnmodifiableMap(k, v));
```

Safer than `Collectors.toList()` — truly immutable.

### `Optional.orElseThrow()` — no-arg

```java
// Before
optional.orElseThrow(() -> new NoSuchElementException());

// After
optional.orElseThrow();   // throws NoSuchElementException with no message
```

---

## Java 11 — HTTP Client & File Conveniences

### `String.isBlank`, `lines`, `strip`, `repeat`

```java
"   ".isBlank();                  // true
"line1\nline2".lines().toList();  // [line1, line2]
"  hi  ".strip();                 // "hi" (Unicode-aware trim)
"ab".repeat(3);                   // "ababab"
```

### `Files.readString` / `writeString`

```java
String content = Files.readString(Path.of("file.txt"));
Files.writeString(Path.of("out.txt"), "hello");
```

One-liner file I/O with UTF-8 by default.

### `HttpClient` — the modern HTTP client

Replaces the painful `HttpURLConnection`. Supports HTTP/2, WebSocket, and
async.

```java
HttpClient client = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_2)
        .connectTimeout(Duration.ofSeconds(5))
        .build();

HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://api.example.com/users"))
        .header("Accept", "application/json")
        .GET()
        .build();

// Synchronous
HttpResponse<String> response = client.send(request,
        HttpResponse.BodyHandlers.ofString());
System.out.println(response.statusCode());
System.out.println(response.body());
```

**Async version:**

```java
CompletableFuture<HttpResponse<String>> future = client.sendAsync(
        request, HttpResponse.BodyHandlers.ofString());

future.thenApply(HttpResponse::body)
      .thenAccept(System.out::println)
      .join();
```

**POST with JSON:**

```java
HttpRequest postRequest = HttpRequest.newBuilder()
        .uri(URI.create("https://api.example.com/users"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"Alice\"}"))
        .build();
```

**Why it matters:** `HttpClient` is the standard for HTTP in modern Java.
Frameworks (Spring WebClient, etc.) build on it.

### `Collection.toArray(IntFunction)` — typed array without casting

```java
List<String> list = List.of("a", "b");
String[] arr = list.toArray(String[]::new);
```

Cleaner than `toArray(new String[0])`.

### `Predicate.not`

```java
List<String> nonEmpty = list.stream()
        .filter(Predicate.not(String::isBlank))
        .toList();
```

Better than `.filter(s -> !s.isBlank())` — clearer intent.

### `Optional.isEmpty`

```java
if (optional.isEmpty()) { ... }
```

Reads better than `!optional.isPresent()`.

---

## Java 12 — `teeing` and `String` utilities

### `Collectors.teeing`

```java
record Stats(long count, double average) {}

Stats s = stream.collect(Collectors.teeing(
        Collectors.counting(),
        Collectors.averagingInt(Employee::salary),
        Stats::new
));
```

See [Streams Advanced](../collections/streams-advanced.md) for details.

### `String.indent` and `transform`

```java
"hello".indent(4);      // "    hello\n"
"HELLO".transform(String::toLowerCase);   // "hello"
```

---

## Java 13 — Text Blocks (preview → standard in 15)

```java
String json = """
        {
            "name": "Alice",
            "age": 30
        }
        """;
```

**Rules:**

- Delimiter is `"""`
- Opening `"""` must be followed by a newline
- Indentation is determined by the least-indented line
- Trailing whitespace on each line is stripped
- `\` at line end suppresses newline

**Escapes:**

```java
String s = """
        Line 1 \
        continues
        """;
// "Line 1 continues\n"
```

---

## Java 14 — Helpful NPEs and `switch` expressions

### Enhanced `NullPointerException` messages

Before Java 14:

```text
Exception in thread "main" java.lang.NullPointerException
    at com.example.Main.main(Main.java:10)
```

After Java 14:

```text
Exception in thread "main" java.lang.NullPointerException:
  Cannot invoke "String.length()" because "user.name" is null
    at com.example.Main.main(Main.java:10)
```

Enabled by default since Java 15. Can be disabled with
`-XX:-ShowCodeDetailsInExceptionMessages`.

### Switch expressions

```java
String result = switch (day) {
    case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> "weekday";
    case SATURDAY, SUNDAY -> "weekend";
};

// Multi-line with yield
int value = switch (type) {
    case A -> 1;
    case B -> {
        int x = compute();
        yield x * 2;
    }
    default -> 0;
};
```

### `@Serial` annotation

Marks fields and methods related to serialization. `serialVersionUID`,
`writeObject`, `readObject`, `readResolve`, etc.

```java
@Serial
private static final long serialVersionUID = 1L;

@Serial
private void writeObject(ObjectOutputStream out) throws IOException { }
```

Why: prevents accidental typos that silently break serialization.

---

## Java 15 — Text Blocks (standard), Sealed (preview)

Text blocks become standard. Sealed classes preview.

---

## Java 16 — Records, `instanceof` pattern, `Stream.toList`

### Records (preview → standard in 16)

```java
public record Point(int x, int y) { }
```

Generates:
- `private final int x, y`
- Canonical constructor
- Accessors `x()`, `y()`
- `equals`, `hashCode`, `toString`

See [Records & Enums](../fundamentals/records-and-enums.md) for depth.

### `instanceof` pattern

```java
if (obj instanceof Point p) {
    System.out.println(p.x());
}
```

Combines check + cast.

### `Stream.toList()`

```java
List<String> list = stream.filter(...).toList();
```

Shorter than `collect(Collectors.toList())`. **Returns an immutable list.**

### `Stream.mapMulti`

```java
stream.<Integer>mapMulti((n, consumer) -> {
    if (n % 2 == 0) {
        consumer.accept(n * 10);
    }
}).toList();
```

Zero, one, or many outputs per input without creating intermediate streams.

---

## Java 17 — Sealed Classes, HexFormat

### Sealed classes (standard)

```java
public sealed interface Shape permits Circle, Square { }
record Circle(double radius) implements Shape { }
record Square(double side) implements Shape { }
```

Closed hierarchies for pattern matching.

### `HexFormat`

```java
HexFormat hex = HexFormat.of();
hex.toHexDigits(255);            // "ff"
hex.parseHex("deadbeef");        // byte[]
```

For hex encoding/decoding — cleaner than hand-rolled.

### Enhanced pseudo-random generators

```java
RandomGenerator gen = RandomGenerator.of("L64X128MixRandom");
int n = gen.nextInt(100);
```

New interface and implementations with better statistical properties.

---

## Java 18 — UTF-8 by default, `@snippet`

### UTF-8 default charset

`file.encoding` defaults to UTF-8. Source files, `String` bytes, and file
I/O all default to UTF-8.

### Javadoc `@snippet`

```java
/**
 * {@snippet :
 *   int x = 1;
 *   System.out.println(x);
 * }
 */
```

Replaces `{@code}` for multi-line examples with syntax highlighting.

---

## Java 19 — Virtual Threads (preview)

```java
Thread vthread = Thread.ofVirtual().start(() -> { });
```

Covered in [Virtual Threads](../concurrency/virtual-threads.md).

### `AutoCloseable` on `ExecutorService`

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(task);
}
```

The executor is closed at scope end.

### `RandomGenerator` interface (already in 17, refined in 19)

---

## Java 20 — Scoped Values (preview)

```java
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.where(CURRENT_USER, user).run(() -> {
    handleRequest();   // CURRENT_USER.get() returns `user`
});
```

Covered in [Thread-Local & Scoped Values](thread-local-and-scoped-values.md).

---

## Java 21 — The Big LTS

### Virtual Threads (standard)

See [Virtual Threads](../concurrency/virtual-threads.md).

### Pattern Matching for `switch` (standard)

```java
String describe(Object obj) {
    return switch (obj) {
        case Integer i -> "int: " + i;
        case String s when s.length() > 5 -> "long string: " + s;
        case String s -> "short string: " + s;
        case null -> "null";
        default -> "unknown";
    };
}
```

**Guards with `when`** — extra condition on a case.

### Record Patterns (standard)

```java
record Point(int x, int y) { }
record Line(Point start, Point end) { }

void print(Line line) {
    if (line instanceof Line(Point(var x1, var y1), Point(var x2, var y2))) {
        System.out.println("From (" + x1 + "," + y1 + ") to (" + x2 + "," + y2 + ")");
    }
}
```

Destructure records directly in patterns.

### Sequenced Collections

```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3, 4));

list.getFirst();     // 1
list.getLast();      // 4
list.addFirst(0);
list.addLast(5);
list.reversed();     // view in reverse order
```

Interfaces: `SequencedCollection`, `SequencedSet`, `SequencedMap`. All `List`,
`Deque`, and sorted collections implement them.

### `String.splitWithDelimiters`

```java
String[] parts = "a,b,c".splitWithDelimiters(",", 0);
// ["a", ",", "b", ",", "c"]
```

Keeps the delimiters.

### `Math.clamp`

```java
Math.clamp(15, 0, 10);   // 10
Math.clamp(-5, 0, 10);   // 0
```

Clamps a value into a range. Cleaner than `Math.min(Math.max(...))`.

### Generational ZGC

```bash
-XX:+UseZGC -XX:+ZGenerational
```

Improves ZGC throughput by separating young and old generations.

---

## Summary — APIs by JDK

| JDK | Notable APIs |
|---|---|
| 9 | `List.of`, `Set.of`, `Map.of`, `Optional.stream`, `Stream.ofNullable`, `ProcessHandle`, private interface methods |
| 10 | `var`, `Collectors.toUnmodifiable*` |
| 11 | `HttpClient`, `String.isBlank/lines/strip/repeat`, `Files.readString/writeString`, `Optional.isEmpty`, `Predicate.not` |
| 12 | `Collectors.teeing`, `String.indent/transform` |
| 13 | Text blocks (preview) |
| 14 | Helpful NPEs, switch expressions, `@Serial` |
| 15 | Text blocks (standard) |
| 16 | Records, `instanceof` pattern, `Stream.toList()`, `mapMulti` |
| 17 | Sealed classes, `HexFormat`, `RandomGenerator` |
| 18 | UTF-8 default, `@snippet` |
| 19 | Virtual threads (preview), `AutoCloseable` executor |
| 20 | Scoped values (preview) |
| 21 | Virtual threads (std), switch pattern (std), record patterns, sequenced collections, `Math.clamp` |

---

## Tricky Corners ⚠️

**`List.of` rejects nulls.** `Arrays.asList` allows them. Different semantics.

**`List.of` returns immutable — even `set()` throws.** `Arrays.asList` allows
`set()` (fixed-size, but mutable entries).

**`var` requires a nonzero initializer.** No `var x;`, no `var x = null;`.

**`var` cannot be used for fields, method params, or return types.**

**Text blocks strip trailing whitespace by default.** Use `\s` to keep it.

**Switch expressions must be exhaustive.** With enums and sealed types, no
`default` needed. With other types, you need `default` or all cases.

**`Stream.toList()` returns immutable.** `collect(Collectors.toList())` is
mutable (implementation-dependent).

**Record patterns require the record type to be known at compile time.**

**`instanceof` pattern variable is only in scope when the check succeeds.**

**Sealed classes' permitted subclasses must be in the same package or module.**

**`HttpClient` is not auto-closeable.** You don't need to close it — it
manages its own connection pool.

**`ProcessHandle` is OS-dependent** — some info (command line) may be
unavailable.

**`Optional.stream()` is Java 9+, not 8.** Don't assume it works on Java 8.

**`HexFormat` is Java 17+, not earlier.** `parseHex` returns `byte[]`.

**`Math.clamp` is Java 21+.** For earlier, `Math.min(Math.max(...))`.

---

## Common Pitfalls

- Trying to modify a `List.of` result — it's immutable.
- Using `var` where the type is unclear from the RHS.
- Forgetting `Stream.toList()` is immutable.
- Using text blocks for single-line strings — no benefit.
- Assuming `HttpClient` needs a `.close()`.
- Using preview features (`--enable-preview`) in production.
- Trying to use `record patterns` on Java 17 — they're Java 21+.
- Forgetting that `instanceof` pattern variables have block scope.

---

## Key Interview Tips

- Know the **LTS cadence**: 11, 17, 21 (and 25 expected).
- Recite the **big four of Java 11**: HTTP client, `String` utilities,
  `Files.readString/writeString`, `Predicate.not`.
- Explain **records in one sentence**: "immutable data carriers with
  auto-generated ctor, accessors, equals, hashCode, toString."
- Explain **sealed classes** as closed hierarchies enabling exhaustive
  pattern matching.
- Say **"text blocks strip indentation and trailing whitespace."**
- Know `Stream.toList()` (16) vs `collect(toList())` (mutable vs immutable).
- Mention **virtual threads** (21) as the headline modern concurrency feature.
- For Java 21, lead with **virtual threads + pattern matching for switch +
  record patterns + sequenced collections**.

---

## Related

- [Streams & Functional](../collections/streams-and-functional.md) — Streams API
- [Streams Advanced](../collections/streams-advanced.md) — deep collector work
- [Records & Enums](../fundamentals/records-and-enums.md) — records in depth
- [Virtual Threads](../concurrency/virtual-threads.md) — the Java 21 concurrency model
- [Thread-Local & Scoped Values](thread-local-and-scoped-values.md) — scoped values
- [Java Versions](../fundamentals/java-versions.md) — full timeline