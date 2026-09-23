# Immutable Objects

> **JDK context:** `String`, `Integer`, `BigDecimal`, `LocalDate`, and records
> (Java 16) are immutable. Records make immutable value objects trivial.
> `List.of`, `Set.of`, `Map.of` (Java 9) provide immutable factory methods.

## Mental Model

An **immutable object** cannot change state after construction. Every
"modification" returns a new instance.

```d2
direction: down

mutable: "Mutable object" {
  style.fill: "#ffcdd2"
  desc: "setState() modifies in place\nShared across threads → danger\nCan be in half-updated state"
}

immutable: "Immutable object" {
  style.fill: "#c8e6c9"
  desc: "withState() returns new\nSafe to share freely\nAlways fully constructed"
}
```

**Why immutability matters:**

1. **Thread-safe by construction** — no synchronization needed
2. **Safe to cache and share** — no defensive copies
3. **Easy to reason about** — no hidden state changes
4. **Safe keys in maps** — `hashCode` never changes
5. **No partial construction** — objects are always valid or not constructed

---

## The Five Rules of an Immutable Class

1. **Make the class `final`** — or use private constructors + factory methods
2. **Make all fields `private final`**
3. **No setters**
4. **Ensure exclusive access to mutable fields** — defensive copies on the way in and out
5. **Ensure `this` doesn't escape during construction**

The fifth is subtle but critical.

---

## A Correct Immutable Class — Line by Line

```java
public final class Money {
    private final BigDecimal amount;
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        if (amount.signum() < 0) throw new IllegalArgumentException("negative");
        this.amount = amount;           // BigDecimal is immutable
        this.currency = currency;       // Currency is immutable
    }

    public BigDecimal amount() { return amount; }
    public Currency currency() { return currency; }

    public Money add(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException();
        return new Money(amount.add(other.amount), currency);
    }

    public Money multiply(int factor) {
        return new Money(amount.multiply(BigDecimal.valueOf(factor)), currency);
    }

    @Override public String toString() {
        return amount + " " + currency.getCurrencyCode();
    }
}
```

### Why each rule

| Rule | Reason |
|---|---|
| `final class` | Prevent subclass from overriding methods and mutating |
| `private final` fields | Cannot reassign after construction; visibility guaranteed |
| No setters | No mutation path |
| Defensive copies | Prevent outside mutation of mutable fields |
| No `this` escape | Prevent another thread from seeing a half-built object |

---

## Defensive Copies — The Critical Detail

If your class holds a mutable object, you must copy it on both input and
output.

### Wrong — leaks internal state

```java
public final class Team {
    private final List<String> members;

    public Team(List<String> members) {
        this.members = members;             // shares the caller's list!
    }

    public List<String> members() {
        return members;                      // exposes internal list!
    }
}
```

```java
List<String> external = new ArrayList<>(List.of("Alice"));
Team team = new Team(external);
external.add("Bob");
System.out.println(team.members());   // [Alice, Bob] — mutated from outside!
```

### Right — defensive copies

```java
public final class Team {
    private final List<String> members;

    public Team(List<String> members) {
        this.members = List.copyOf(members);   // copy on input
    }

    public List<String> members() {
        return members;                         // safe — already immutable
    }
}
```

```java
List<String> external = new ArrayList<>(List.of("Alice"));
Team team = new Team(external);
external.add("Bob");
System.out.println(team.members());   // [Alice] — safe
```

### `List.copyOf` vs `new ArrayList<>(...)`

| | `List.copyOf(list)` | `new ArrayList<>(list)` |
|---|---|---|
| Immutable result | ✅ | ❌ |
| Rejects nulls | ✅ | ❌ |
| Copies if not already immutable | ✅ | Always copies |
| Recommended | ✅ | Rarely |

`List.copyOf` (and `Set.copyOf`, `Map.copyOf`) are the modern defensive-copy
tools.

### Arrays require manual copies

```java
public final class Team {
    private final String[] members;

    public Team(String[] members) {
        this.members = members.clone();        // copy on input
    }

    public String[] members() {
        return members.clone();                 // copy on output
    }
}
```

Arrays don't have a `copyOf` that returns an immutable array — you must
clone on both ends.

### `java.time` — the model to follow

```java
LocalDate today = LocalDate.now();
LocalDate tomorrow = today.plusDays(1);   // returns new
// today unchanged
```

All `java.time` types are immutable and return new instances on every
operation. This is the standard Java style.

---

## Records — Immutability Made Easy

Records (Java 16) automatically give you most of the immutable-class rules:

```java
public record Point(int x, int y) {
    // no setters, no equals, no hashCode, no toString — all generated
}
```

- `final class` (implicitly)
- `private final` fields (implicitly)
- No setters
- `equals`, `hashCode`, `toString` generated

**But:** records only prevent **reassignment of fields**, not mutation of
objects they point to.

```java
public record Employee(String name, List<String> skills) {}

List<String> list = new ArrayList<>(List.of("Java"));
Employee e = new Employee("Alice", list);

list.add("SQL");
System.out.println(e.skills());   // [Java, SQL] — mutated from outside!
```

### Fix — copy on input via a compact constructor

```java
public record Employee(String name, List<String> skills) {
    public Employee {
        skills = List.copyOf(skills);   // compact constructor copy
    }
}
```

The **compact constructor** (no parentheses after the record name) lets you
validate and copy without repeating parameters.

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        if (amount.signum() < 0) throw new IllegalArgumentException();
        // amount, currency implicitly assigned
    }
}
```

---

## How to Create Immutable Object Without Declaring Class Final

You can't always make the class `final` — for example, if you're implementing
an interface that other code extends, or you're within a framework that needs
subclassing.

Options:

### Option 1 — Private constructor + static factory

```java
public class Money {
    private final BigDecimal amount;

    private Money(BigDecimal amount) { this.amount = amount; }

    public static Money of(BigDecimal amount) {
        return new Money(amount);
    }
}
```

Prevents direct instantiation but **doesn't prevent subclassing**.

### Option 2 — Package-private constructor + non-final class

```java
public class Money {
    private final BigDecimal amount;

    Money(BigDecimal amount) { this.amount = amount; }

    public static Money of(BigDecimal amount) { return new Money(amount); }
}
```

Subclasses in the same package can still extend, but external packages cannot.
**Not truly immutable**, but constrained.

### Option 3 — Final fields + no setters + defensive copies

Even if a subclass exists, if:
- All fields are `private final`
- No setters exist
- All mutable state is defensively copied
- No methods are overridable (make them `final`)

Then the object is functionally immutable, regardless of the class-level
`final` modifier.

```java
public class Money {
    private final BigDecimal amount;

    public Money(BigDecimal amount) {
        this.amount = amount;
    }

    public final BigDecimal amount() { return amount; }

    public final Money add(Money other) {
        return new Money(amount.add(other.amount));
    }
}
```

**Every method is `final`** — a subclass cannot override to change behavior.
This is a stronger guarantee than class-level `final` in some ways.

### Option 4 — Sealed class (Java 17+)

```java
public sealed class Money permits CurrencyAmount {
    private final BigDecimal amount;
    protected Money(BigDecimal amount) { this.amount = amount; }
    // ...
}
```

Sealed classes restrict who can subclass — a middle ground between `final`
and open extension.

**Rule:** the truly robust approach is `final class` + `final` methods +
private final fields + defensive copies. Only relax the class `final` when
you have a concrete reason.

---

## Preventing Cloning and Serialization

An immutable class **shouldn't allow cloning or serialization to produce
altered copies**.

### Prevent cloning

`Cloneable` is opt-in — don't implement it, and don't override `clone()`.

But if a superclass implements `Cloneable`, override `clone()` to return
`this` (since the object can't change anyway) or throw:

```java
@Override
public Money clone() {
    return this;   // nothing to clone
}
```

Better: don't extend cloneable classes.

### Prevent serialization

Options:

**1. Don't implement `Serializable`.**

```java
public final class Money {
    // no implements Serializable
}
```

Callers get `NotSerializableException`. Simple and effective.

**2. Implement `Serializable` but use `readResolve` to enforce invariants:**

```java
public final class Money implements Serializable {
    private static final long serialVersionUID = 1L;

    private final BigDecimal amount;

    private Money(BigDecimal amount) { this.amount = amount; }

    public static Money of(BigDecimal amount) { return new Money(amount); }

    private Object readResolve() {
        return new Money(amount);   // ensure validity after deserialization
    }
}
```

**3. Use `readObject` for validation:**

```java
private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
    in.defaultReadObject();
    if (amount.signum() < 0) throw new InvalidObjectException("negative");
}
```

### The recommended pattern

For immutable value classes:

- **Do not implement `Serializable`** unless required
- **Do not implement `Cloneable`** — copies aren't needed if the object can't change
- If you must serialize, use `readResolve` to canonicalize and validate

---

## `List.of`, `Set.of`, `Map.of`

Java 9+ factory methods return truly immutable collections:

```java
List<String> names = List.of("Alice", "Bob");
names.add("Charlie");   // UnsupportedOperationException

Map<String, Integer> scores = Map.of("Alice", 90, "Bob", 85);
scores.put("Charlie", 80);   // UnsupportedOperationException
```

**Properties:**
- Immutable
- Reject nulls (`List.of("a", null)` throws)
- `Set.of`/`Map.of` reject duplicate elements/keys at construction

### `List.copyOf(existing)`

```java
List<String> original = new ArrayList<>(List.of("a", "b"));
List<String> immutable = List.copyOf(original);
original.add("c");
System.out.println(immutable);   // [a, b] — snapshot
```

If `original` is already an immutable list, `List.copyOf` returns it without
copying (an optimization).

### `Collections.unmodifiableList` — a view, not a copy

```java
List<String> original = new ArrayList<>(List.of("a"));
List<String> view = Collections.unmodifiableList(original);
original.add("b");
System.out.println(view);   // [a, b] — reflects changes!
```

**Not the same as `List.copyOf`.** `unmodifiableList` is a read-only view
of a live collection. Use it only when you want to expose a read-only view
while keeping the underlying collection mutable internally.

---

## Which Classes in the JDK Are Immutable?

| Class | Immutable? | Notes |
|---|---|---|
| `String` | ✅ | The classic example |
| `Integer`, `Long`, `Double`, etc. | ✅ | All primitive wrappers |
| `BigInteger`, `BigDecimal` | ✅ | Arbitrary precision |
| `LocalDate`, `LocalTime`, `Instant`, `Duration` | ✅ | `java.time` |
| `Optional` | ✅ | Container |
| `UUID` | ✅ | |
| `java.util.regex.Pattern` | ✅ | Compiled regex |
| `List.of()`, `Set.of()`, `Map.of()` | ✅ | Java 9+ |
| Records | ✅ by default | If fields are immutable |
| `java.awt.Color` | ✅ | |
| `java.net.URI` | ✅ | |
| `java.util.Collections` unmodifiable views | ✅ view | Not copies |

**Not immutable:**

| Class | Why |
|---|---|
| `Date` | Mutable (deprecated in favor of `java.time`) |
| `Calendar` | Mutable |
| `StringBuilder` | Mutable by design |
| `AtomicInteger` | Mutable, thread-safe |
| `ArrayList`, `HashMap` | Mutable |

---

## When Immutability Is Worth It

### Great fits

- **Value objects** — `Money`, `Point`, `Address`
- **DTOs** — data transfer, no behavior
- **Configuration** — once loaded, never changed
- **Map keys** — immutable `hashCode`
- **Concurrent shared state** — no synchronization needed
- **Cache entries** — safe to share

### Bad fits

- **Builders** (before `build()`)
- **Accumulators** — mutation is the point
- **Large data structures** — copying costs
- **Frequently-mutated state** — creates garbage

**Balance:** immutability is a default, not a dogma. Choose mutability when
the cost of copying outweighs the benefits.

---

## Thread Safety of Immutable Objects

Immutable objects are **inherently thread-safe**:

```java
final class Config {
    private final Map<String, String> settings;

    Config(Map<String, String> settings) {
        this.settings = Map.copyOf(settings);
    }

    String get(String key) { return settings.get(key); }
}
```

No `synchronized`, no `volatile`, no atomics needed. The JMM's **final field
initialization guarantee** ensures any thread that sees the object sees the
fully-initialized fields (as long as `this` didn't escape during construction).

### Why immutable objects don't need synchronization

1. No state changes → no races
2. Final fields → guaranteed safe publication
3. Multiple threads read the same values → no cache coherence issue

**Interview line:** *"Immutable objects are thread-safe by construction.
No state changes means no race conditions."*

---

## Tricky Corners ⚠️

**`final` doesn't make the object immutable.** `final List` means the
reference can't change. The list's contents still can.

**Records aren't fully immutable.** If a record holds a mutable object,
the object can be mutated. Use compact constructors to copy.

**`Collections.unmodifiableList` is a view, not a copy.** The backing list
can still change.

**`List.of(...)` rejects nulls.** Don't rely on it if your data may contain
nulls.

**`List.copyOf` returns the input if already immutable.** No defensive copy
in that case — but it's still safe.

**Escaping `this` in a constructor breaks safe publication.** Don't register
listeners or pass `this` to other objects during construction.

```java
public class Dangerous {
    private final List<String> data;

    public Dangerous() {
        data = new ArrayList<>();
        EventBus.register(this);   // `this` escapes half-constructed!
    }
}
```

**`String` immutability is safe, but a `String` field in a mutable class
isn't thread-safe** unless the field is `final` or `volatile`.

**Serialization can bypass immutability** if you don't use `readResolve`.
The byte stream can produce any state.

**Reflection can mutate final fields** (with `setAccessible(true)`). Not a
concern for well-behaved code, but a limitation.

**Subclassing can break immutability** even if the parent is immutable,
unless the parent's methods are `final` or the class is `final`.

---

## Common Pitfalls

- Making the class `final` but forgetting defensive copies.
- Returning internal mutable collections directly from getters.
- Records holding mutable objects without compact-constructor copies.
- Confusing `Collections.unmodifiableList` (view) with `List.copyOf` (copy).
- Forgetting `List.of` rejects nulls.
- Assuming `final` alone means immutable.

---

## Key Interview Tips

- Recite the **five rules of immutability**.
- Explain defensive copying with a "leaky list" example.
- Mention **records** and **compact constructors** as the modern way.
- Explain why immutable objects are inherently thread-safe.
- Know `List.of`, `Set.of`, `Map.of`, `List.copyOf` cold.
- Differentiate `unmodifiableList` (view) from `List.copyOf` (snapshot).
- For "how to prevent cloning/serialization": don't implement the interfaces;
  or use `readResolve`.
- For "immutable without `final` class": private/final fields + final methods
  + defensive copies.

---

## Related

- [Serialization Deep Dive](../io-serialization/serialization-deep-dive.md) — `readResolve` for singletons and immutables
- [Object Copying & Cloning](../io-serialization/object-copying-and-cloning.md) — defensive copies
- [Keywords Deep Dive](../fundamentals/keywords-deep-dive.md) — `final`, safe publication
- [Synchronization](../concurrency/synchronization.md) — why immutable thread-safe
- [Records & Enums](../fundamentals/records-and-enums.md) — records in depth