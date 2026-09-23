# Object Copying & Cloning

> **JDK context:** `Cloneable` has been with Java since 1.0. It's widely
> considered broken — Joshua Bloch's *Effective Java* recommends copy
> constructors and static factories instead. Records (Java 16) are shallow-
> copyable by construction.

## Mental Model

Copying an object splits into **shallow** and **deep**:

```d2
direction: right

shallow: "Shallow copy" {
  style.fill: "#fff9c4"
  desc: "New object, same field references\nPrimitives are copied\nObjects are shared"
}

deep: "Deep copy" {
  style.fill: "#c8e6c9"
  desc: "New object, recursively copied fields\nAll reachable objects are new"
}

source: "Source object" {
  style.fill: "#e3f2fd"
}

source.shallow -> shallow: "Object.clone() by default"
source.deep -> deep: "copy constructors,\nserialization,\nexplicit recursion"
```

**Interview rule:** *"`Object.clone()` performs a shallow copy by default.
For deep copy, override `clone()` and clone each mutable field, or use
copy constructors, or serialize/deserialize."*

---

## Shallow Copy — `Object.clone()`

### The mechanism

```java
class Point implements Cloneable {
    int x, y;

    Point(int x, int y) { this.x = x; this.y = y; }

    @Override
    public Point clone() {
        try {
            return (Point) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();   // can't happen; we're Cloneable
        }
    }
}
```

### How `super.clone()` works

`Object.clone()`:
1. Allocates a new object **without calling a constructor**
2. Copies each field bit-for-bit
3. Returns the new object

For primitives (`int`, `boolean`), this is a real copy. For references, the
**reference** is copied, not the target object.

### Demonstration of shallow copy

```java
class Employee implements Cloneable {
    String name;
    List<String> skills;

    Employee(String name, List<String> skills) {
        this.name = name;
        this.skills = skills;
    }

    @Override
    public Employee clone() {
        try {
            return (Employee) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}

Employee original = new Employee("Alice", new ArrayList<>(List.of("Java")));
Employee copy = original.clone();

copy.name = "Bob";               // OK — primitive/immutable, safe
copy.skills.add("SQL");          // MUTATES THE SHARED LIST!

System.out.println(original.skills);   // [Java, SQL] — original changed!
System.out.println(copy.skills);       // [Java, SQL]
```

The `skills` reference is shared between `original` and `copy`. Modifying
one affects both.

### `Cloneable` marker interface

```java
public interface Cloneable { }   // no methods
```

- Implementing it tells `Object.clone()` "cloning is allowed"
- If you call `super.clone()` on an object whose class doesn't implement
  `Cloneable`, you get `CloneNotSupportedException`
- `Object.clone()` is `protected` — external callers can't use it

### Why `Cloneable` is broken

1. **Marker interface with no method** — you can't call `clone()` on a
   `Cloneable`-typed reference; you need the concrete class
2. **`clone()` is `protected`** — forces overrides just to widen visibility
3. **Returns `Object`** — forces casts
4. **Doesn't call constructors** — bypasses invariants
5. **Requires checked `CloneNotSupportedException` handling** — even when
   it can't happen
6. **Broken with `final` fields** — can't reassign after `super.clone()`

*Effective Java* recommends: **avoid `Cloneable`; use copy constructors or
static factory methods.**

---

## Deep Copy — Three Approaches

### 1. Override `clone()` and clone each mutable field

```java
class Employee implements Cloneable {
    String name;
    List<String> skills;

    Employee(String name, List<String> skills) {
        this.name = name;
        this.skills = skills;
    }

    @Override
    public Employee clone() {
        try {
            Employee copy = (Employee) super.clone();
            copy.skills = new ArrayList<>(this.skills);   // copy the list
            return copy;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}

Employee original = new Employee("Alice", new ArrayList<>(List.of("Java")));
Employee copy = original.clone();
copy.skills.add("SQL");

System.out.println(original.skills);   // [Java] — unchanged
System.out.println(copy.skills);       // [Java, SQL]
```

**Rule:** clone the object, then deep-copy every mutable field manually.

### 2. Copy constructor

The recommended alternative.

```java
class Employee {
    private final String name;
    private final List<String> skills;

    // Regular constructor
    Employee(String name, List<String> skills) {
        this.name = name;
        this.skills = new ArrayList<>(skills);   // defensive copy
    }

    // Copy constructor
    Employee(Employee other) {
        this.name = other.name;
        this.skills = new ArrayList<>(other.skills);   // deep copy
    }
}

Employee original = new Employee("Alice", List.of("Java"));
Employee copy = new Employee(original);
copy.skills.add("SQL");

System.out.println(original.skills);   // [Java]
System.out.println(copy.skills);       // [Java, SQL]
```

**Advantages:**
- No `Cloneable` weirdness
- No checked exceptions
- Works with `final` fields
- Controlled, explicit
- Callable on any type

### 3. Static factory method

```java
static Employee copyOf(Employee other) {
    return new Employee(other.name, new ArrayList<>(other.skills));
}
```

Same as copy constructor, sometimes clearer intent.

---

## Deep Copy via Serialization

Round-trip through bytes:

```java
@SuppressWarnings("unchecked")
static <T extends Serializable> T deepCopy(T original) {
    try {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(baos)) {
            out.writeObject(original);
        }

        try (ObjectInputStream in =
                     new ObjectInputStream(new ByteArrayInputStream(baos.toByteArray()))) {
            return (T) in.readObject();
        }
    } catch (IOException | ClassNotFoundException e) {
        throw new RuntimeException("deep copy failed", e);
    }
}
```

**Advantages:**
- Works for arbitrary object graphs
- Handles cycles automatically

**Disadvantages:**
- Slow (I/O + reflection)
- Requires `Serializable` everywhere
- Doesn't preserve `transient` fields

**Use only when nothing else fits** — or for tests.

---

## `clone()` in the JDK

### Arrays

```java
int[] a = {1, 2, 3};
int[] b = a.clone();
b[0] = 99;

System.out.println(Arrays.toString(a));   // [1, 2, 3]
System.out.println(Arrays.toString(b));   // [99, 2, 3]
```

Arrays' `clone()` is safe — the array contents are copied. For arrays of
primitives, this is a deep copy. For arrays of objects, this is shallow:

```java
String[][] matrix = {{"a"}, {"b"}};
String[][] copy = matrix.clone();
copy[0][0] = "X";

System.out.println(matrix[0][0]);   // X — shared inner arrays!
```

To deep-copy a 2D array:

```java
String[][] deep = new String[matrix.length][];
for (int i = 0; i < matrix.length; i++) {
    deep[i] = matrix[i].clone();
}
```

### Collections

`ArrayList`, `HashMap`, etc. have **copy constructors**, not `clone()`:

```java
List<String> original = new ArrayList<>(List.of("a", "b"));
List<String> copy = new ArrayList<>(original);   // shallow copy of the list

// Deep copy of elements requires manual copy:
List<Employee> deep = original.stream()
        .map(Employee::new)   // uses copy constructor
        .collect(Collectors.toList());
```

### Records

Records are inherently shallow-copyable by reconstruction:

```java
record Point(int x, int y) {}

Point p = new Point(1, 2);
Point copy = new Point(p.x(), p.y());   // explicit "copy"
```

Since records are immutable, a "copy" and the original are semantically
interchangeable.

---

## Copying Immutable Objects

For truly immutable objects (e.g. `String`, `Integer`, records), you don't
need a copy:

```java
String a = "hello";
String b = a;              // same object — fine, it can't change
```

Deep copy is only needed for **mutable** state.

---

## Detecting Shared State — The Takeaway

```d2
direction: right

original: "Original\n{ name: Alice,\n  skills: [Java] }" {
  style.fill: "#e3f2fd"
}
copy: "Shallow Copy\n{ name: Alice,\n  skills: ---------}" {
  style.fill: "#fff9c4"
}
shared: "Shared list" {
  style.fill: "#ffcdd2"
}

original.copy -> copy: "clone()"
copy.shared -> shared: "same reference"
original.shared -> shared: "same reference"
```

Any mutation of `skills` through either object affects both.

**Rule of thumb:** if your object contains references to mutable objects,
shallow copies will surprise you at the worst possible time.

---

## `Object.clone()` vs Copy Constructor vs Serialization

| Aspect | `clone()` | Copy Constructor | Serialization |
|---|---|---|---|
| Deep copy by default | ❌ | Depends on implementation | ✅ |
| Works with `final` fields | ⚠️ (hard) | ✅ | ✅ |
| Calls constructor | ❌ | ✅ | ❌ |
| Checked exceptions | ✅ (`CloneNotSupportedException`) | ❌ | ✅ (I/O) |
| Requires `Serializable` | ❌ | ❌ | ✅ |
| Performance | Fastest | Fast | Slowest |
| Complexity | Medium | Low | Low (but heavy) |
| Recommended | Rarely | ✅ | Only when needed |

**Effective Java recommendation:** prefer copy constructors or static
factories. Avoid `Cloneable`.

---

## Tricky Corners ⚠️

**`clone()` performs a shallow copy.** References are shared. Deep-copy
mutable fields manually.

**`clone()` doesn't call constructors.** If your constructor enforces
invariants, `clone()` can produce invalid objects.

**`Cloneable` doesn't declare `clone()`.** It's a marker interface. You still
need to override `clone()` and widen its visibility to `public`.

**`super.clone()` returns `Object`.** Cast required.

**`final` fields break `clone()`** because you can't reassign them after
`super.clone()` copies the reference — you'd need reflection or a copy
constructor.

**`clone()` on arrays is deep for primitives, shallow for objects.**

**`clone()` on a collection** doesn't exist — collections have copy
constructors.

**Serialization-based deep copy doesn't preserve `transient` fields**, and
requires the entire graph to be `Serializable`.

**`clone()` copies the whole object graph's references**, not just the
object — meaning a `Map` inside is shared after clone.

**Records are immutable** — no copy needed if you only have value semantics.

**Concurrent code + `clone()`** — the fields are copied without locks. If
another thread is mutating the original, the copy can be inconsistent.

---

## Common Pitfalls

- Assuming `clone()` gives a deep copy.
- Forgetting `implements Cloneable` — runtime exception.
- Not handling `CloneNotSupportedException` properly.
- Shared references causing accidental mutation of the original.
- Using `clone()` on collections — they don't have it.
- Relying on serialization for deep copy in performance-sensitive paths.
- Not realizing `final` fields break `clone()`'s deep-copy pattern.

---

## Key Interview Tips

- Say **"shallow by default"** for `Object.clone()`.
- Give the "shared list" example — the classic trap.
- Mention **copy constructors** as the modern alternative to `Cloneable`.
- List the three deep-copy approaches: manual `clone()`, copy constructors,
  serialization.
- Explain why `Cloneable` is considered broken.
- Note that arrays clone deeply for primitives, shallowly for objects.
- For "how do you copy an object?" — answer with **copy constructor** first.

---

## Related

- [Serialization Deep Dive](serialization-deep-dive.md) — deep copy via serialization
- [Immutable Objects](../design-patterns-java/immutable-objects.md) — when copies aren't needed
- [Memory References](../advanced/memory-references.md) — reachability and shared state
- [Records & Enums](../fundamentals/records-and-enums.md) — records and copy semantics