# String Internals

> **JDK context:** String is `final` since Java 1.0. The string constant pool
> moved from PermGen to the heap in Java 7. `String.intern()` behavior has been
> stable since. Java 9 introduced **compact strings** — a `byte[]` + coder field
> replaces the old `char[]`, saving ~50% memory for Latin-1 strings.

## Mental Model

`String` is **immutable**, and every `String` instance either lives in the
**string constant pool** (interned) or on the **heap** (regular object). The
same string literal always refers to the *same* pool object; `new String(...)`
always creates a fresh heap object.

```d2
direction: down

memory: "String Memory" {
  style.fill: "#f5f5f5"

  pool: "String Constant Pool" {
    style.fill: "#c8e6c9"
    desc: "Inside heap since Java 7\nStores interned literals\nUnique per value"
  }

  heap: "Heap (non-pool)" {
    style.fill: "#ffe0b2"
    desc: "Every `new String(...)` object\nFresh instance each time"
  }
}
```

---

## Immutability — Why

A `String` cannot be changed after construction. Every "modification" returns
a new `String`.

```java
String s = "hello";
s = s + " world";   // s now points to a NEW object; "hello" is unchanged
```

### Why immutable?

| Reason | Explanation |
|---|---|
| **String pool safety** | If Strings were mutable, changing one would affect every reference sharing that pool entry |
| **Thread safety** | Immutable objects can be shared freely across threads without synchronization |
| **Hashcode caching** | `hashCode()` is computed once and cached — safe because the value can never change |
| **Security** | Class names, file paths, DB URLs used as Strings cannot be tampered with after validation |
| **Class loading** | JVM uses Strings for class names during loading — mutability would be a security hole |

### How immutability is enforced

```java
public final class String {
    private final byte[] value;   // Java 9+ compact strings
    private final byte coder;     // LATIN1 or UTF16
    private int hash;             // cached, computed lazily
}
```

- `final` class → cannot be subclassed to override behavior
- `private final byte[]` → no external mutation
- No setters → value never changes after construction

**Note:** the array reference is `final`, and the class never exposes it. If
you could get a reference to the array, you could mutate elements — but the
array is private and never returned.

---

## The String Constant Pool

The pool is a special region inside the heap (since Java 7) that holds **unique
copies of string literals**.

```java
String a = "hello";          // interned → pool
String b = "hello";          // same pool entry
String c = new String("hello");  // new heap object

System.out.println(a == b);   // true  — same pool entry
System.out.println(a == c);   // false — different objects
System.out.println(a.equals(c)); // true — same content
```

```d2
direction: right

pool: "String Pool" {
  style.fill: "#c8e6c9"
  hello: "\"hello\"" {
    style.fill: "#a5d6a7"
  }
}

heap1: "Heap Object" {
  style.fill: "#ffe0b2"
  h1: "new String(\"hello\")" {
    style.fill: "#ffcc80"
  }
}

pool.hello -> heap1.h1: "different object\n(same content)"
```

---

## How Many Objects — The Classic Trap

Interviewers love "how many objects are created?" questions. Here are the cases.

### Case 1

```java
String s = "hello";
```

**1 object** (or 0, if `"hello"` is already interned from a previous use).
The literal goes into the pool.

### Case 2

```java
String s = new String("hello");
```

**2 objects** (or 1 if `"hello"` is already in the pool):
- One pool entry for the literal `"hello"`
- One heap object created by `new`

### Case 3

```java
String s1 = "hello";
String s2 = "hello";
```

**1 object.** Both reference the same pool entry.

### Case 4

```java
String s1 = "hello";
String s2 = new String("hello");
```

**2 objects.** Pool entry + heap object.

### Case 5

```java
String s = "hel" + "lo";
```

**1 object.** The compiler folds constant expressions at compile time.
`"hel" + "lo"` becomes `"hello"` in bytecode, then goes into the pool.

### Case 6

```java
String a = "hel";
String b = a + "lo";
```

**3 objects** (potentially):
- `"hel"` in pool
- `"lo"` in pool
- A new `String` from the runtime concatenation of `a + "lo"`

`a` is not a compile-time constant, so this is a runtime operation.

### Case 7

```java
String s = new String("hello").intern();
```

**2 objects** created then 1 discarded. The `.intern()` returns the pool entry.
The temporary heap object is eligible for GC.

### Summary Table

| Code | Pool objects | Heap objects | Total |
|---|---|---|---|
| `String s = "hello"` | 1 | 0 | 1 |
| `String s = new String("hello")` | 1 | 1 | 2 |
| `"hello"` then `"hello"` | 1 (shared) | 0 | 1 |
| `"hel" + "lo"` (literals) | 1 | 0 | 1 |
| `a + "lo"` (a is variable) | 2 | 1 | 3 |

---

## `intern()`

`intern()` returns the pool entry for a string, adding it if absent.

```java
String s1 = new String("hello");
String s2 = s1.intern();
String s3 = "hello";

System.out.println(s2 == s3);   // true
System.out.println(s1 == s3);   // false
```

### When `intern()` is useful

- Reducing memory when many identical strings are created dynamically
- Fast equality checks via `==` (rare in practice)
- Interning config keys, enum-like identifiers

### Cost

`intern()` hits the pool's hash table — it's not free. In modern JVMs, the
pool uses a fixed-size table that can become a bottleneck if abused.

**Rarely needed.** Don't intern everything.

---

## Where Is String Stored?

| Storage | What lives there |
|---|---|
| **String constant pool** (inside heap, Java 7+) | Literals, interned strings |
| **Heap** (regular) | `new String(...)`, runtime concatenation results |
| **Before Java 7** | Pool was in PermGen — a common OOM cause |

**Interview line:** *"Since Java 7, the string pool lives in the heap. Before
that it was in PermGen, which meant aggressive `intern()` could OOM PermGen."*

---

## `String` vs `StringBuilder` vs `StringBuffer`

| | `String` | `StringBuilder` | `StringBuffer` |
|---|---|---|---|
| **Mutable** | ❌ | ✅ | ✅ |
| **Thread-safe** | ✅ (immutable) | ❌ | ✅ (synchronized) |
| **Performance** | Slow for repeated concat | Fast | Slower than StringBuilder |
| **Use when** | Fixed text, keys | Single-threaded building | Multi-threaded building |

### Why `StringBuilder` matters

```java
// BAD — creates N intermediate Strings
String result = "";
for (int i = 0; i < 10_000; i++) {
    result += i;       // O(n²) total work
}

// GOOD — one mutable buffer
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10_000; i++) {
    sb.append(i);       // O(n) total work
}
String result = sb.toString();
```

**Interview line:** *"`StringBuilder` is not thread-safe; `StringBuffer` is, but
synchronized. Since Java 8, use `StringJoiner` or `Collectors.joining` for
pipelines."*

---

## Encoding vs Encryption

These are often confused. They solve **different problems**.

| | Encoding | Encryption |
|---|---|---|
| **Purpose** | Convert to a different representation | Hide content from unauthorized readers |
| **Reversible by** | Anyone | Only holders of the key |
| **Secret key?** | ❌ | ✅ |
| **Example** | Base64, UTF-8, URL encoding | AES, RSA |
| **Use case** | Transport, storage format | Confidentiality |

### Why encode if it's decodable by everyone?

- **Safe transport** — Base64 turns arbitrary bytes into printable ASCII, safe
  for JSON, URLs, email
- **Format compatibility** — UTF-8 lets the same text travel across systems
- **Size / structure** — URL encoding makes special characters safe in URLs

Encoding is **not** security. It's representation.

### Base64 example

```java
String encoded = Base64.getEncoder().encodeToString("hello".getBytes());
// "aGVsbG8="

byte[] decoded = Base64.getDecoder().decode(encoded);
// "hello"
```

Everyone can decode this. It's for transport, not secrecy.

---

## Is `String` Thread-Safe?

**Yes** — because it's immutable.

Every thread sees the same value; there's nothing to synchronize. Two threads
can share a `String` reference freely.

**But watch out:**

```java
class Holder {
    String value;   // NOT final — the reference can change
}
```

The `String` object is immutable, but the **field holding it** can be mutated
by another thread. If `value` isn't `final` or `volatile`, readers may see
stale references. This is a visibility problem, not a String problem.

---

## Compact Strings (Java 9+)

Before Java 9, `String` stored a `char[]` — 2 bytes per character, even for
pure ASCII.

Since Java 9, `String` stores a `byte[]` + a **coder** field:

```java
private final byte[] value;
private final byte coder;   // LATIN1 (1 byte/char) or UTF16 (2 bytes/char)
```

- **LATIN1** — if all chars fit in 1 byte (ASCII, Latin-1)
- **UTF16** — otherwise

Result: most English text uses **half the memory** it used to. No API change.

---

## Tricky Corners ⚠️

**`==` compares references, `.equals()` compares contents.** Always use
`equals()` for value comparison.

**Compile-time constant folding applies only to `final` constants.** `"a" + "b"`
is folded; `a + b` (where `a` and `b` are variables) is not.

**`String s = "hello"` doesn't always create an object.** If `"hello"` is
already in the pool (from another literal), no new object is created.

**`intern()` returns the canonical pool instance.** Never the original object
unless it was already interned.

**`"hello".substring(1)` doesn't mutate.** It returns a new `String`.

**Old (pre-Java 7u6) `substring` shared the backing array** — a memory leak
risk if you kept a small substring of a huge string. Modern JVMs always copy.

**Switch on String uses `hashCode()` first, then `equals()`.** If you're
paranoid about collisions, know that `hashCode` is only a filter — the final
check is `equals`.

**Serialization of `String` is safe** because it's immutable and `final`.

---

## Common Pitfalls

- Using `==` to compare strings.
- Building large strings with `+=` in a loop.
- Assuming `new String("x") == "x"`.
- Using `intern()` everywhere for "performance" — it can hurt.
- Thinking `String` is a collection of chars — it's not; you can't modify it.
- Confusing encoding with encryption.

---

## Key Interview Tips

- Answer the "how many objects" question by case (literal vs `new`, folded
  vs runtime concat).
- Mention that the pool lives in the **heap** since Java 7.
- Explain why immutability enables thread safety and hash caching.
- Differentiate `StringBuilder` (fast, not thread-safe) vs `StringBuffer`
  (slower, thread-safe).
- For "encoding vs encryption," stress that encoding is not security.

---

## Related

- [Object Lifecycle](../fundamentals/object-lifecycle.md) — object creation, GC
- [Keywords Deep Dive](../fundamentals/keywords-deep-dive.md) — `final`, `transient`
- [Synchronization](../concurrency/synchronization.md) — thread safety & visibility
- [Streams & Functional](../collections/streams-and-functional.md) — `Collectors.joining`