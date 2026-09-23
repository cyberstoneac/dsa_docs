# Misc Tricky Corners

> A grab-bag of interview traps that don't fit neatly into other files.

## Overview

Topics covered here:

1. Compare two arrays
2. Java pass-by-value (not pass-by-reference)
3. 2D array initialization
4. Null static access
5. Method hiding vs overriding
6. Static method via null reference
7. `enum` edge cases (interfaces, abstract methods)
8. `equals` on arrays vs objects
9. Autoboxing traps
10. `System.arraycopy` vs `Arrays.copyOf` vs `clone`

---

## Comparing Two Arrays

`==` and `equals` compare **references** for arrays. For value comparison:

### 1D arrays

```java
int[] a = {1, 2, 3};
int[] b = {1, 2, 3};

System.out.println(a == b);              // false
System.out.println(a.equals(b));         // false (reference equality)
System.out.println(Arrays.equals(a, b)); // true
```

### 2D arrays

```java
int[][] a = {{1, 2}, {3, 4}};
int[][] b = {{1, 2}, {3, 4}};

System.out.println(Arrays.equals(a, b));     // false! compares rows by reference
System.out.println(Arrays.deepEquals(a, b)); // true
```

**Rule:**

| | 1D | 2D (or deeper) |
|---|---|---|
| Equality | `Arrays.equals` | `Arrays.deepEquals` |
| Hash | `Arrays.hashCode` | `Arrays.deepHashCode` |
| Print | `Arrays.toString` | `Arrays.deepToString` |

---

## Java Is Pass-by-Value

**Always.** Java passes **copies of references**, not the objects themselves.

```java
void modify(int x) {
    x = 99;   // local copy — caller's value unchanged
}

void modifyList(List<Integer> list) {
    list.add(42);            // MUTATES the shared object — caller sees it
    list = new ArrayList<>(); // reassigns the LOCAL copy — caller unaffected
}
```

### Demonstration

```java
List<Integer> original = new ArrayList<>(List.of(1, 2));
addElement(original);
System.out.println(original);   // [1, 2, 42]

reassign(original);
System.out.println(original);   // [1, 2, 42] — unchanged

void addElement(List<Integer> l) { l.add(42); }
void reassign(List<Integer> l) { l = List.of(99); }
```

**Interview line:** *"Java is always pass-by-value. What gets copied is the
reference, not the object. So you can mutate the object a reference points
to, but reassigning the reference has no effect on the caller."*

---

## 2D Array Initialization

### 1. Static initialization

```java
int[][] matrix = {
    {1, 2, 3},
    {4, 5, 6},
    {7, 8, 9}
};
```

### 2. Fixed-size, default values

```java
int[][] matrix = new int[3][3];   // all zeros
matrix[1][2] = 6;
```

### 3. Jagged (rows of different lengths)

```java
int[][] jagged = new int[3][];
jagged[0] = new int[]{1};
jagged[1] = new int[]{2, 3};
jagged[2] = new int[]{4, 5, 6};
```

### 4. Using streams

```java
int[][] matrix = IntStream.range(0, 3)
        .mapToObj(i -> IntStream.range(0, 3).map(j -> i * 3 + j).toArray())
        .toArray(int[][]::new);
```

### Declaration gotcha

```java
int[] a[];        // legal — same as int[][] a;
int[][] b;        // legal
int c[][];        // legal but discouraged
```

**In Java, `int[][] a` is an array of arrays.** There's no true 2D array —
jagged arrays are the norm.

### Memory layout

```text
int[][] matrix = new int[3][3]

matrix  -> [ref0, ref1, ref2]      // array of row references
ref0    -> [0, 0, 0]
ref1    -> [0, 0, 0]
ref2    -> [0, 0, 0]
```

Each row is a separate array object on the heap.

---

## Null Static Access

**You can access static members through a null reference.**

```java
class Counter {
    static int count = 10;
    static void print() { System.out.println(count); }
}

Counter c = null;
System.out.println(c.count);   // 10 — no NPE!
c.print();                     // 10 — no NPE!
```

**Why?** The compiler rewrites `c.count` to `Counter.count` at compile time.
The null check is never performed because the reference isn't dereferenced.

**Interview line:** *"Static members are resolved at compile time via the
class, not the reference. So a null reference can access them without NPE."*

### Instance members DO throw NPE

```java
Counter c = null;
// c.instanceMethod();   // NullPointerException
```

---

## Method Hiding vs Overriding

| | Overriding | Hiding |
|---|---|---|
| Method type | Instance | Static |
| Resolution | Runtime (dynamic dispatch) | Compile time (static) |
| `@Override` | ✅ valid | ❌ compile error |

### Overriding (instance methods)

```java
class Parent { void greet() { System.out.println("P"); } }
class Child extends Parent { @Override void greet() { System.out.println("C"); } }

Parent p = new Child();
p.greet();   // "C" — runtime dispatch
```

### Hiding (static methods)

```java
class Parent { static void greet() { System.out.println("P"); } }
class Child extends Parent { static void greet() { System.out.println("C"); } }

Parent p = new Child();
p.greet();   // "P" — compile-time dispatch on the reference type
Child c = new Child();
c.greet();   // "C"
```

**Interview line:** *"Static methods can't be overridden — they're hidden.
Which one runs depends on the reference type, not the object type."*

### Can you override a static with an instance method?

No. The compiler rejects it.

### Can you override a `final` method?

No. `final` methods cannot be overridden.

### Can you override a private method?

No — but subclass can declare a method with the same signature (it's a new
method, not an override).

---

## Enum Edge Cases

### Enums can implement interfaces

```java
interface Describable { String describe(); }

enum Color implements Describable {
    RED, GREEN, BLUE;

    @Override
    public String describe() { return "color: " + name(); }
}
```

### Enums can have abstract methods

Each constant provides its own implementation:

```java
enum Operation {
    ADD {
        @Override public int apply(int a, int b) { return a + b; }
    },
    SUBTRACT {
        @Override public int apply(int a, int b) { return a - b; }
    };

    public abstract int apply(int a, int b);
}

System.out.println(Operation.ADD.apply(2, 3));         // 5
System.out.println(Operation.SUBTRACT.apply(5, 2));    // 3
```

Under the hood, each constant with a body becomes an **anonymous subclass**
of the enum.

### Enums cannot extend a class

Enums implicitly extend `java.lang.Enum`. You can't extend anything else.

### Enums can have constructors and fields

```java
enum Planet {
    MERCURY(3.303e+23, 2.4397e6),
    EARTH(5.976e+24, 6.37814e6);

    private final double mass;
    private final double radius;

    Planet(double mass, double radius) {   // constructor is private implicitly
        this.mass = mass;
        this.radius = radius;
    }

    public double surfaceGravity() {
        return 6.67300E-11 * mass / (radius * radius);
    }
}
```

### Enums are singletons per constant

```java
Color.RED == Color.RED;   // true — the same instance
```

### `EnumSet` and `EnumMap`

See [Set & Sorted Collections](../collections/set-and-sorted.md) for full details.

### Enum with `values()` and `valueOf()`

```java
for (Color c : Color.values()) { ... }
Color.valueOf("RED");          // returns Color.RED
Color.valueOf("REDD");         // throws IllegalArgumentException
```

### Enum `name()` vs `toString()`

- `name()` — the exact declared name, `final`
- `toString()` — overridable, defaults to `name()`

### `switch` on enum

```java
switch (color) {
    case RED -> System.out.println("hot");
    case BLUE -> System.out.println("cold");
    default -> System.out.println("unknown");
}
```

---

## Autoboxing Traps

### Cached values

```java
Integer a = 100;
Integer b = 100;
System.out.println(a == b);   // true — cached (-128..127)

Integer c = 200;
Integer d = 200;
System.out.println(c == d);   // false — outside cache
```

**`Integer.valueOf` caches -128 to 127.** Beyond that, new objects.

### `Long` cache is the same range

```java
Long a = 100L; Long b = 100L;
System.out.println(a == b);   // true

Long c = 200L; Long d = 200L;
System.out.println(c == d);   // false
```

### `Character` caches 0–127

```java
Character a = 'a'; Character b = 'a';
System.out.println(a == b);   // true

Character c = 'é'; Character d = 'é';   // > 127
System.out.println(c == d);   // false
```

### Comparison with `==` between wrapper and primitive

```java
Integer x = 1000;
int y = 1000;
System.out.println(x == y);   // true — unboxing happens
```

### NPE from unboxing

```java
Integer x = null;
int y = x;   // NullPointerException — auto-unboxing
```

### Rule

**Always use `.equals()` for wrapper comparison.**

---

## `System.arraycopy` vs `Arrays.copyOf` vs `clone`

### `System.arraycopy` — fastest, most flexible

```java
int[] src = {1, 2, 3, 4, 5};
int[] dst = new int[5];
System.arraycopy(src, 0, dst, 0, 5);
```

- Copies from `src[srcPos]` to `dst[dstPos]`, `length` elements
- Overlapping regions handled (it behaves like `memmove`)
- Native method — fastest

### `Arrays.copyOf` — convenience wrapper

```java
int[] copy = Arrays.copyOf(src, src.length);
int[] bigger = Arrays.copyOf(src, 10);   // pads with zeros
int[] smaller = Arrays.copyOf(src, 3);   // truncates
```

Internally uses `System.arraycopy`. Convenient for growing/shrinking.

### `array.clone()`

```java
int[] copy = src.clone();
```

Fast, but returns `Object` in some contexts and requires casts. `System.arraycopy`
is generally preferred for control.

### Comparison

| | Speed | Flexibility | Notes |
|---|---|---|---|
| `System.arraycopy` | Fastest | Highest | Manual indices, overlapping |
| `Arrays.copyOf` | Fast | Medium | Handles resizing |
| `array.clone()` | Fast | Lowest | Full copy only |

### Deep copy of object arrays

```java
Employee[] original = { new Employee("Alice") };
Employee[] copy = original.clone();   // SHALLOW — shares Employee objects

// Deep copy
Employee[] deep = new Employee[original.length];
for (int i = 0; i < original.length; i++) {
    deep[i] = new Employee(original[i]);   // uses copy constructor
}
```

---

## Misc Traps

### `"a" + 1 + 2` vs `1 + 2 + "a"`

```java
System.out.println("a" + 1 + 2);   // "a12"
System.out.println(1 + 2 + "a");   // "3a"
```

String concatenation is left-associative. Once a String is involved, everything
after is concatenated.

### `System.out.println('a' + 1)`

```java
System.out.println('a' + 1);       // 98 (char promoted to int)
System.out.println((char)('a' + 1)); // b
System.out.println("" + 'a' + 1);  // a1
```

### `null instanceof X` is always false

```java
Object o = null;
System.out.println(o instanceof String);   // false — no NPE
```

`instanceof` returns false for null; it never throws.

### `"".isEmpty()` vs `null.isEmpty()`

```java
String s = "";
s.isEmpty();       // true

String n = null;
n.isEmpty();       // NullPointerException
```

Use `Objects.requireNonNull` or null checks.

### `Long` and `Float` `hashCode`

```java
Long l = 42L;
int h = l.hashCode();   // (int)(42 ^ (42 >>> 32))
```

Don't try to hand-compute — use `Objects.hash` or the wrapper's `hashCode`.

### `HashMap` with a mutable key

Mutating a key after insertion breaks lookup — the entry stays in its old
bucket. See [HashMap Internals](../collections/hashmap-internals.md).

### `String.split` and special characters

```java
"a.b.c".split(".");     // [] — "." is a regex metachar
"a.b.c".split("\\.");   // ["a", "b", "c"]
```

### `List.of(...)` rejects nulls

```java
List.of("a", null);   // NullPointerException
```

`Arrays.asList` allows nulls; `List.of` doesn't.

### `subList` is a view

```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3, 4, 5));
List<Integer> sub = list.subList(1, 3);   // [2, 3]

sub.clear();
System.out.println(list);   // [1, 4, 5] — sublist modifies backing list
```

### `toArray()` returns `Object[]`

```java
List<String> list = List.of("a");
Object[] obj = list.toArray();          // OK
String[] str = list.toArray(new String[0]);   // typed
```

Use `list.toArray(new T[0])` for typed arrays — the empty array form is
optimized.

---

## Tricky Corners Summary Table

| Trap | Correct approach |
|---|---|
| Compare arrays | `Arrays.equals` / `Arrays.deepEquals` |
| Java pass-by | Always by value (references copied) |
| Static via null | Works — no NPE |
| Method hiding vs override | Static = hiding (compile-time) |
| Enum with abstract methods | Each constant provides impl |
| Autoboxing `==` | Use `.equals()` for wrappers |
| Copy arrays | `System.arraycopy` (fast), `Arrays.copyOf` (convenient) |
| `String.split(".")` | Use `"\\."` |
| `List.of(null)` | Rejected — use `Arrays.asList` |
| `subList` | View, not copy |

---

## Common Pitfalls

- Comparing arrays with `==`.
- Assuming Java is pass-by-reference.
- Assuming null reference throws NPE on static access.
- Using `==` for wrapper comparison.
- Mutating a key after putting it in a `HashMap`.
- Forgetting to escape regex special chars in `String.split`.
- Treating `subList` as an independent copy.

---

## Key Interview Tips

- Answer "Java is pass-by-value" confidently and demonstrate.
- Know `Arrays.deepEquals` for nested arrays.
- Explain static-hiding vs overriding with the reference-type example.
- Say "Integer cache is -128..127" without hesitation.
- Mention `System.arraycopy` for fast array copying.
- For "can enum implement interfaces?" — yes, and abstract methods too.

---

## Related

- [Object Lifecycle](../fundamentals/object-lifecycle.md) — object creation
- [HashMap Internals](../collections/hashmap-internals.md) — mutable keys
- [List Implementations](../collections/list-implementations.md) — `subList` behavior
- [Records & Enums](../fundamentals/records-and-enums.md) — enums in depth