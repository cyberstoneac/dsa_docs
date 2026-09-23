# Generics & Wildcards

> **JDK context:** Generics arrived in Java 5. Their implementation uses **type
> erasure** — a design choice made to preserve backward compatibility with
> pre-generics bytecode. Diamond operator (`<>`) arrived in Java 7.

## Mental Model

Generics give you **compile-time type safety** for containers and algorithms.
But the JVM has **no concept of generics** at runtime — the compiler erases
type parameters and inserts casts where needed.

```d2
direction: right

source: "List<String> list" {
  style.fill: "#e3f2fd"
}
compile: "Compile-time\n(type-checked)" {
  style.fill: "#c8e6c9"
}
bytecode: "List list\n(raw type)" {
  style.fill: "#fff9c4"
}
runtime: "Runtime\n(no type info)" {
  style.fill: "#ffe0b2"
}

source.compile -> bytecode: "erasure"
bytecode.runtime -> runtime: "no generic types\nat runtime"
```

This single fact explains most confusing generic behavior: **you can't use
generics where type info is needed at runtime** (no `new T[]`, no
`instanceof List<String>`, no `T.class`).

---

## Why Generics in Collections?

Before generics, collections held `Object`:

```java
List names = new ArrayList();
names.add("Alice");
names.add(42);                    // compiles — List holds Objects

String name = (String) names.get(1);  // ClassCastException at runtime
```

After generics:

```java
List<String> names = new ArrayList<>();
names.add("Alice");
names.add(42);                    // compile error — caught early

String name = names.get(0);       // no cast needed
```

**The win:** bugs move from runtime to compile time. No manual casts. Self-documenting types.

---

## Type Erasure — The Core Mechanism

At compile time, `List<String>` and `List<Integer>` are **the same type** —
`List`. Type parameters are erased.

### What erasure does

| Source | Erased to |
|---|---|
| `List<String>` | `List` |
| `List<T extends Number>` | `List<Number>` |
| `T` (unbounded) | `Object` |
| `T extends Number` | `Number` |

### What this breaks

```java
// 1. Cannot create arrays of generic types
// T[] arr = new T[10];                 // compile error

// 2. Cannot use instanceof with generics
// if (list instanceof List<String>) { }  // compile error
if (list instanceof List<?>) { }          // OK

// 3. Cannot access .class on a type parameter
// T.class                              // compile error

// 4. Cannot overload on type parameters
// void m(List<String> l) {}
// void m(List<Integer> l) {}           // compile error — same erasure
```

### Bridge methods

To preserve polymorphism after erasure, the compiler inserts **bridge methods**:

```java
class Box<T> {
    private T value;
    public void set(T value) { this.value = value; }
}

class StringBox extends Box<String> {
    @Override
    public void set(String value) { super.set(value); }
}
```

Bytecode for `StringBox`:

```java
// real method
public void set(String value) { super.set(value); }

// compiler-generated bridge
public void set(Object value) { set((String) value); }
```

The bridge lets `Box<String> b = new StringBox(); b.set("x")` work through
the erased `set(Object)` signature.

---

## Bounded Type Parameters

### Upper bound — `T extends X`

```java
public <T extends Comparable<T>> T max(List<T> list) {
    T max = list.get(0);
    for (T t : list) {
        if (t.compareTo(max) > 0) max = t;
    }
    return max;
}
```

`T extends Comparable<T>` means `T` must implement `Comparable<T>`. Inside the
method, you can call `compareTo`.

**Multiple bounds:**

```java
<T extends Number & Comparable<T>>   // class first, then interfaces
```

### Lower bound — `? super X`

Used only with wildcards (see below).

---

## Wildcards — `?`, `? extends`, `? super`

### `?` — unbounded

Any type. Used when you only need `Object`-level operations.

```java
void printAll(List<?> list) {
    for (Object o : list) {
        System.out.println(o);
    }
}
```

### `? extends T` — upper-bounded (covariance)

Read-only view: you can get `T`s out, but can't add to the collection.

```java
double sum(List<? extends Number> list) {
    double total = 0;
    for (Number n : list) {     // can read as Number
        total += n.doubleValue();
    }
    return total;
}

sum(List.of(1, 2, 3));        // List<Integer> works
sum(List.of(1.0, 2.0));       // List<Double> works
```

You **cannot** add to a `List<? extends Number>`:

```java
list.add(1);   // compile error — what's the actual element type?
```

### `? super T` — lower-bounded (contravariance)

Write-only view: you can put `T`s in, but reading gives you `Object`.

```java
void addInts(List<? super Integer> list) {
    list.add(1);
    list.add(2);
}

List<Number> nums = new ArrayList<>();
addInts(nums);                // List<Number> accepts Integers
List<Object> objs = new ArrayList<>();
addInts(objs);                // List<Object> accepts Integers
```

You **cannot** get `Integer`s out reliably:

```java
Integer i = list.get(0);      // compile error — could be any supertype
Object o = list.get(0);       // OK
```

---

## PECS — The Rule to Remember

**Producer Extends, Consumer Super.**

| Situation | Wildcard | Why |
|---|---|---|
| You **read** from a source (producer) | `? extends T` | Read-only view; caller provides the actual type |
| You **write** to a sink (consumer) | `? super T` | Write-only view; you supply T to a broader container |
| You **do both** | No wildcard — use `T` | Need a fixed type |

### Example

```java
// src produces T, dst consumes T
public static <T> void copy(List<? extends T> src,
                            List<? super T> dst) {
    for (T t : src) {
        dst.add(t);
    }
}

List<Integer> ints = List.of(1, 2, 3);
List<Number> nums = new ArrayList<>();
copy(ints, nums);        // src extends Integer... extends Number, dst super Number
```

### Interview line

*"PECS — Producer Extends, Consumer Super. If a parameterized type appears as
a producer, use `extends`. If it appears as a consumer, use `super`. If it's
both, use a bounded type parameter instead."*

---

## Wildcard Comparison Table

| Type | Can read? | Can write? | Typical use |
|---|---|---|---|
| `List<?>` | ✅ (as Object) | ❌ | Print, contains, size |
| `List<? extends Number>` | ✅ (as Number) | ❌ | Sum, iterate |
| `List<? super Integer>` | ✅ (as Object) | ✅ (as Integer) | Add, collect |
| `List<Number>` | ✅ (as Number) | ✅ (as Number) | Full access |

---

## Generic Methods

```java
public <T> T firstOrNull(List<T> list) {
    return list.isEmpty() ? null : list.get(0);
}
```

The `<T>` before the return type declares a type parameter **for the method**.

Compare to a generic class:

```java
public class Box<T> {          // T is class-scoped
    private T value;
    public T get() { return value; }
}
```

---

## Why Not Reified Generics?

Reified = type info available at runtime. Java chose erasure because:

- **Backward compatibility** — pre-Java-5 bytecode had no generics
- **Migration path** — raw types and generics had to coexist
- **Runtime simplicity** — no new type system at the JVM level

Kotlin, C#, and Scala have reified generics. Java doesn't. This is a
**deliberate trade-off**, not a bug.

---

## Tricky Corners ⚠️

**You cannot create an instance of a type parameter.**

```java
// T t = new T();   // compile error
```

Workaround: pass a `Supplier<T>` or `Class<T>`.

**You cannot create arrays of a generic type.**

```java
// T[] arr = new T[10];              // compile error
// List<String>[] arr = new List<String>[10];   // compile error
List<?>[] arr = new List<?>[10];    // OK — wildcard
```

Workaround: `List<T>` instead of `T[]`, or use `Array.newInstance` with a
`Class<T>`.

**Raw types bypass checks.**

```java
List<String> list = new ArrayList<>();
List raw = list;
raw.add(42);                // compiles — warning, not error
String s = list.get(0);     // ClassCastException at runtime
```

Raw types exist for backward compatibility but should never be used in new code.

**`instanceof` with generic types is not allowed.**

```java
if (list instanceof List<String>) { }   // compile error
if (list instanceof List<?>) { }        // OK
```

**Overloading on erasure is illegal.**

```java
void m(List<String> l) { }
void m(List<Integer> l) { }    // compile error — same erasure
```

**Casting is allowed with an unchecked warning.**

```java
List<String> list = (List<String>) someObject;   // unchecked warning
```

**Static fields cannot use class-level type parameters.**

```java
class Box<T> {
    // static T value;    // compile error
    static int count;     // OK
}
```

**Generic exceptions are illegal.**

```java
// class MyException<T> extends Exception { }   // compile error
```

You cannot catch a type parameter either.

**`Class<?>` vs `Class<T>`:** `Class<T>` is a reified type token. Use
`Class<T>` parameters when you need runtime type info:

```java
public <T> T create(Class<T> clazz) throws Exception {
    return clazz.getDeclaredConstructor().newInstance();
}
```

---

## Common Pitfalls

- Using raw types where generics would work.
- Confusing `? extends T` (read-only) with `? super T` (write-only).
- Trying to add to a `List<? extends T>`.
- Expecting `instanceof List<String>` to compile.
- Trying to create `T[]` — use `List<T>` instead.
- Overloading methods that differ only in type parameters.

---

## Key Interview Tips

- Explain erasure in one sentence: *"Generics are a compile-time feature;
  the JVM sees raw types."*
- Recite **PECS** without hesitation.
- Give an example where `? extends` prevents writes and `? super` prevents
  reads — the classic.
- Mention bridge methods for covariant return types.
- Know that reified generics were intentionally avoided for backward
  compatibility.

---

## Related

- [Collections Overview](../collections/collections-overview.md) — generic collection types
- [HashMap Internals](../collections/hashmap-internals.md) — generic keys and values
- [Object Lifecycle](../fundamentals/object-lifecycle.md) — arrays of objects
- [Exception Mastery](../exceptions/exception-mastery.md) — generic exceptions rules