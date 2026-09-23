# Records & Enums

> **JDK context:** Enums arrived in Java 5. Records were previewed in 14, 15,
> and became standard in **Java 16**. Record patterns arrived in Java 21.
> Sealed classes (Java 17) pair naturally with records for algebraic data types.

## Mental Model

Records and enums are **restricted class forms** that eliminate boilerplate
and enforce design constraints:

- **Enum** — a fixed set of named constants (each is an instance)
- **Record** — an immutable data carrier (fields, equals, hashCode, toString, accessors — all generated)

```d2
direction: right

enumClass: "Enum\nFixed set of instances\nSingleton per constant\nFields, methods, interfaces,\nabstract methods allowed" {
  style.fill: "#bbdefb"
}

recordClass: "Record\nImmutable data holder\nAuto: ctor, accessors,\nequals, hashCode, toString" {
  style.fill: "#c8e6c9"
}

sealedClass: "Sealed\nRestricted subclassing\nClosed type hierarchies" {
  style.fill: "#fff9c4"
}

enumClass -> recordClass: "modern class forms"
recordClass -> sealedClass: "paired for ADTs"
```

---

## Enums — Beyond Constants

### Basic enum

```java
public enum Day {
    MON, TUE, WED, THU, FRI, SAT, SUN
}

Day d = Day.MON;
System.out.println(d);               // MON
System.out.println(d.name());        // MON
System.out.println(d.ordinal());     // 0
```

Each constant is a **singleton instance** of the enum class.

### Enums with fields and constructors

```java
public enum Planet {
    MERCURY(3.303e+23, 2.4397e6),
    EARTH(5.976e+24, 6.37814e6),
    MARS(6.421e+23, 3.3972e6);

    private final double mass;      // kg
    private final double radius;    // m

    Planet(double mass, double radius) {   // implicitly private
        this.mass = mass;
        this.radius = radius;
    }

    public double surfaceGravity() {
        return 6.67300E-11 * mass / (radius * radius);
    }
}

System.out.println(Planet.EARTH.surfaceGravity());   // 9.80...
```

**Enum constructor is always private.** Cannot be `public` or `protected`.

### Can enums implement interfaces? Yes.

```java
interface Describable {
    String describe();
}

enum Color implements Describable {
    RED, GREEN, BLUE;

    @Override
    public String describe() {
        return "Color: " + name();
    }
}

System.out.println(Color.RED.describe());   // Color: RED
```

### Can enums have abstract methods?

**Yes.** Each constant provides its own implementation:

```java
enum Operation {
    ADD {
        @Override public int apply(int a, int b) { return a + b; }
    },
    SUBTRACT {
        @Override public int apply(int a, int b) { return a - b; }
    },
    MULTIPLY {
        @Override public int apply(int a, int b) { return a * b; }
    };

    public abstract int apply(int a, int b);
}

System.out.println(Operation.ADD.apply(2, 3));        // 5
System.out.println(Operation.SUBTRACT.apply(5, 2));   // 3
System.out.println(Operation.MULTIPLY.apply(4, 5));   // 20
```

Under the hood, constants with bodies become **anonymous subclasses** of
the enum. `Operation.ADD` is an instance of `Operation$1`, and so on.

**Interview line:** *"Enums can implement interfaces and declare abstract
methods. Each constant that has a body becomes an anonymous subclass."*

### Enums can override `toString`

```java
enum Status {
    ACTIVE, INACTIVE;

    @Override
    public String toString() {
        return name().toLowerCase();
    }
}

System.out.println(Status.ACTIVE);   // active
```

### Utility methods

```java
Day[] all = Day.values();               // copies the values array
Day d = Day.valueOf("MON");             // parses; throws IllegalArgumentException if invalid
int ord = d.ordinal();                  // position — avoid using this for logic
```

**Don't rely on `ordinal()`** for persistence or logic — it changes if
constants are reordered. Use `name()` instead.

### Enum singleton (Bloch's recommendation)

```java
public enum Singleton {
    INSTANCE;

    public void doSomething() { }
}
```

Serialization-safe, reflection-safe, thread-safe. The best singleton.

### `EnumSet` and `EnumMap`

```java
EnumSet<Day> weekdays = EnumSet.range(Day.MON, Day.FRI);
EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
```

Backed by bit vectors and arrays — extremely fast. See
[Set & Sorted Collections](../collections/set-and-sorted.md).

### `switch` on enum

```java
switch (day) {
    case MON, TUE, WED, THU, FRI -> System.out.println("weekday");
    case SAT, SUN -> System.out.println("weekend");
}
```

Modern switch expressions work great with enums.

### Enums cannot extend a class

They implicitly extend `java.lang.Enum`. Single inheritance means no other
superclass.

### Enums are `final` unless they have abstract methods

Constants with bodies require the enum to be non-final (so anonymous
subclasses can extend it). But the enum can't be extended by user code.

---

## Records — Modern Data Carriers

### Basic record

```java
public record Point(int x, int y) { }
```

Generated:
- `private final int x;`
- `private final int y;`
- Canonical constructor `Point(int x, int y)`
- Accessors `x()` and `y()` (not `getX()`!)
- `equals`, `hashCode`, `toString`

```java
Point p = new Point(3, 4);
System.out.println(p.x());              // 3
System.out.println(p);                  // Point[x=3, y=4]

Point q = new Point(3, 4);
System.out.println(p.equals(q));        // true
System.out.println(p.hashCode() == q.hashCode());   // true
```

### Records are immutable

```java
Point p = new Point(1, 2);
// p.x = 5;    // no such field — no setters
```

Records **cannot** have non-final instance fields.

### Compact constructor — for validation and normalization

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        if (amount.signum() < 0) {
            throw new IllegalArgumentException("negative amount");
        }
        // `amount` and `currency` are implicitly assigned after this block
    }
}
```

The compact constructor syntax (no parameter list) lets you validate without
repeating parameters.

### Canonical vs additional constructors

```java
public record Range(int lo, int hi) {
    // Canonical (explicit)
    public Range(int lo, int hi) {
        if (lo > hi) throw new IllegalArgumentException();
        this.lo = lo;
        this.hi = hi;
    }

    // Additional constructor — must delegate to canonical
    public Range(int hi) {
        this(0, hi);
    }
}
```

**Every non-canonical constructor must call `this(...)`** — you can't set
fields directly.

### Records can have methods

```java
public record Point(int x, int y) {
    public Point translate(int dx, int dy) {
        return new Point(x + dx, y + dy);
    }

    public double distanceTo(Point other) {
        int dx = this.x - other.x;
        int dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
```

### Records can implement interfaces

```java
interface Shape {
    double area();
}

record Circle(double radius) implements Shape {
    @Override public double area() { return Math.PI * radius * radius; }
}

record Square(double side) implements Shape {
    @Override public double area() { return side * side; }
}
```

### Records cannot extend a class

Implicitly extend `java.lang.Record`. Single inheritance.

### Records with generic types

```java
public record Pair<K, V>(K key, V value) { }

Pair<String, Integer> p = new Pair<>("age", 30);
```

### Static fields and methods

```java
public record Point(int x, int y) {
    public static final Point ORIGIN = new Point(0, 0);

    public static Point of(int x, int y) {
        return new Point(x, y);
    }
}
```

Allowed — only **instance** fields must come from components.

### Records and mutability — the caveat

Records are **shallowly immutable**. If a component holds a mutable object,
the record doesn't protect it:

```java
public record Employee(String name, List<String> skills) { }

List<String> list = new ArrayList<>(List.of("Java"));
Employee e = new Employee("Alice", list);

list.add("SQL");
System.out.println(e.skills());   // [Java, SQL] — mutated!
```

**Fix — defensive copy in the compact constructor:**

```java
public record Employee(String name, List<String> skills) {
    public Employee {
        skills = List.copyOf(skills);
    }
}
```

### Records and serialization

Records are `Serializable` if they implement `Serializable`:

```java
record Point(int x, int y) implements Serializable {
    private static final long serialVersionUID = 1L;
}
```

Records serialize by writing components — no custom `writeObject`.

### Records and reflection

```java
Point.class.isRecord();              // true
RecordComponent[] comps = Point.class.getRecordComponents();
```

Introspection for framework support.

### Records in pattern matching (Java 16+)

```java
if (obj instanceof Point p) {
    System.out.println(p.x() + ", " + p.y());
}
```

### Record patterns (Java 21)

Destructure records directly in patterns:

```java
record Point(int x, int y) { }
record Line(Point start, Point end) { }

void print(Line line) {
    if (line instanceof Line(Point(var x1, var y1), Point(var x2, var y2))) {
        System.out.println("From (" + x1 + ", " + y1 + ") to (" + x2 + ", " + y2 + ")");
    }
}
```

Or in switch:

```java
String describe(Object obj) {
    return switch (obj) {
        case Point(int x, int y) -> "Point at " + x + "," + y;
        case Line(Point s, Point e) -> "Line";
        case null -> "null";
        default -> "unknown";
    };
}
```

### Records in switch (Java 21, standard)

```java
sealed interface Shape permits Circle, Square { }
record Circle(double radius) implements Shape { }
record Square(double side) implements Shape { }

double area(Shape s) {
    return switch (s) {
        case Circle c -> Math.PI * c.radius() * c.radius();
        case Square sq -> sq.side() * sq.side();
    };
}
```

The compiler knows all subtypes (sealed) — no `default` needed.

---

## Sealed Classes

Restrict **who can extend or implement** a type.

```java
public sealed interface Shape permits Circle, Square, Triangle { }

record Circle(double radius) implements Shape { }
record Square(double side) implements Shape { }
record Triangle(double base, double height) implements Shape { }
```

### Rules

- A sealed class lists its permitted subclasses
- Each permitted subclass must be `final`, `sealed`, or `non-sealed`
- Permitted subclasses must be in the same package (or module, if named)

### Why sealed

- **Exhaustive pattern matching** — the compiler knows all subtypes
- **Controlled extension** — no rogue subclasses
- **Better modeling** — encode algebraic data types

### Example with `non-sealed`

```java
public sealed interface Vehicle permits Car, Truck, OtherVehicle { }

final class Car implements Vehicle { }
sealed class Truck implements Vehicle permits Pickup, SemiTruck { }
final class Pickup extends Truck { }
final class SemiTruck extends Truck { }
non-sealed class OtherVehicle implements Vehicle { }   // anyone can extend
```

### Pattern matching without `default`

```java
double area(Shape s) {
    return switch (s) {
        case Circle c -> Math.PI * c.radius() * c.radius();
        case Square sq -> sq.side() * sq.side();
        case Triangle t -> 0.5 * t.base() * t.height();
    };
}
```

Because `Shape` is sealed, the compiler verifies exhaustiveness.

---

## Records vs Lombok

Lombok `@Value` and `@Data` generate similar boilerplate, but:

| | Records | Lombok |
|---|---|---|
| Part of Java | ✅ | ❌ (annotation processor) |
| Immutability enforced | ✅ | Depends on annotation |
| Works with switch patterns | ✅ | ❌ |
| Requires build config | ❌ | ✅ |
| Customizable | Compact ctor | Many annotations |

**Records are the modern way.** Use Lombok only if you need features records
don't have (e.g., `@Builder` on a class with mutable fields).

---

## When to Use Records vs Classes

| Use Record when | Use Class when |
|---|---|
| Simple data holder | Behavior-rich object |
| Immutability is desired | Mutable state needed |
| Value semantics (equals/hashCode by content) | Identity semantics |
| Serializable DTOs | Framework-managed beans |
| Pattern matching target | Complex inheritance |

**Records are for value objects.** Not for entities that need to change
over time.

---

## Tricky Corners ⚠️

**Records are shallowly immutable.** Mutable components need defensive copies.

**Records cannot have instance fields beyond components.** `private int x;`
is illegal unless `x` is a component.

**Records can have static fields.** They just can't be instance fields.

**`record Point(int x, int y)`** — accessors are `x()` and `y()`, not
`getX()`.

**Records are `final`.** Cannot be extended.

**Canonical constructor must assign all components.** Or use the compact form.

**Additional constructors must delegate to the canonical one** via `this(...)`.

**Records can't extend classes.** They implicitly extend `java.lang.Record`.

**Enums are implicitly `final`** unless they have constants with bodies.

**Enums can't be instantiated** — the only instances are the constants.

**`ordinal()` is fragile.** Reordering constants changes ordinals. Persist
`name()` instead.

**Enums can implement interfaces but cannot extend classes.**

**Records in switch with sealed parents** allow exhaustive checks without
`default`.

**Records with null components** — `equals` uses `Objects.equals`, so null
components compare correctly. But some frameworks reject them.

**Records as map keys** — safe because they're immutable (assuming immutable
components).

---

## Common Pitfalls

- Mutating a `List` component of a record — the record doesn't protect it.
- Using `ordinal()` for persistence — brittle.
- Assuming records can have `@Override` setters — they can't.
- Forgetting the compact constructor is `public RecordName { ... }`, not
  `public RecordName() { ... }`.
- Trying to extend a record.
- Expecting enums to have a public constructor.

---

## Key Interview Tips

- Recite what a record generates: **fields, canonical ctor, accessors,
  equals, hashCode, toString**.
- Explain the compact constructor.
- Explain why records are **shallowly immutable** and how to fix.
- Explain that enums can **implement interfaces and have abstract methods**.
- Mention enum-as-singleton as Bloch's recommendation.
- Pair records + sealed + pattern matching as the modern algebraic-data-type
  combo.
- Know that `record patterns` are Java 21+.

---

## Related

- [Immutable Objects](../design-patterns-java/immutable-objects.md) — full immutability rules
- [Patterns in Java](../design-patterns-java/patterns-in-java.md) — enum singleton
- [Set & Sorted Collections](../collections/set-and-sorted.md) — `EnumSet`, `EnumMap`
- [Java Versions](java-versions.md) — records and sealed classes timeline