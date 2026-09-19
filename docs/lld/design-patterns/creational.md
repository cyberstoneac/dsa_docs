# Creational Patterns

Creational patterns deal with **object creation** — how, when, and by whom objects are instantiated. They abstract the `new` keyword, control instance counts, and make creation logic flexible and testable.

In LLD interviews, you'll use **Factory** and **Builder** frequently. **Singleton** appears often but is controversial. **Abstract Factory** and **Prototype** are rarer.

---

## 📐 Why Creational Patterns?

- **Encapsulate creation logic** — callers don't need to know concrete classes
- **Control instance count** — Singleton ensures one instance; Prototype avoids re-initialization
- **Separate construction from representation** — Builder
- **Open/Closed** — new types don't require editing existing code (Factory, Abstract Factory)

---

## 1. Singleton

**Ensure one instance per process, with a global point of access.**

### Problem

Some services should exist **exactly once** in a JVM:
- Configuration registry
- Logger
- Connection pool
- Cache manager
- Metrics collector

Without Singleton, you might accidentally create multiple instances and lose consistency.

### ❌ Naive (Broken Under Concurrency)

```java
public class Config {
    private static Config instance;
    private Config() {}

    public static Config getInstance() {
        if (instance == null) {
            instance = new Config();   // race: two threads may both create
        }
        return instance;
    }
}
```

### ✅ Approach 1: Eager Initialization

```java
public final class Config {
    private static final Config INSTANCE = new Config();
    private Config() {}
    public static Config getInstance() { return INSTANCE; }
}
```

**Pros:** Simple, thread-safe (JVM class loading is safe).
**Cons:** Instance created even if never used.

### ✅ Approach 2: Holder Class (Lazy, Thread-Safe)

```java
public final class Config {
    private Config() {}

    private static class Holder {
        private static final Config INSTANCE = new Config();
    }

    public static Config getInstance() { return Holder.INSTANCE; }
}
```

**Why it works:** JVM lazily loads `Holder` on first access; class initialization is thread-safe. **No locks needed.**

**Recommended default.**

### ✅ Approach 3: Enum (Best for Serialization Safety)

```java
public enum Config {
    INSTANCE;

    private final Map<String, String> values = new HashMap<>();

    public String get(String key) { return values.get(key); }
    public void set(String key, String value) { values.put(key, value); }
}
```

**Pros:** Serialization-safe, reflection-safe, simplest.
**Cons:** Enum can't extend another class.

### ✅ Approach 4: Double-Checked Locking

```java
public final class Config {
    private static volatile Config instance;   // volatile required!

    private Config() {}

    public static Config getInstance() {
        if (instance == null) {
            synchronized (Config.class) {
                if (instance == null) {
                    instance = new Config();
                }
            }
        }
        return instance;
    }
}
```

**Why `volatile`:** Prevents partial-construction visibility (see Concurrency Basics).

**Less recommended** — Holder class is simpler and equally lazy.

### When to Use Singleton

✅ Genuine one-per-JVM: loggers, config, registries, caches
❌ Not as a shortcut to avoid passing dependencies (that's what DI is for)
❌ Not for testability-critical code — global state is hard to mock

### Modern Alternative: Dependency Injection

Instead of a Singleton, **inject one instance** into every consumer:

```java
public class Service {
    private final Config config;
    public Service(Config config) { this.config = config; }
}

// Composition root
Config config = new Config();
Service svc = new Service(config);
```

**Why it's better:** Testable, explicit dependencies, no global state. Use this in real code; Singleton only when truly warranted.

### Common Pitfalls

- **Forgetting `volatile`** in DCL → broken on JMM
- **Serialization**: deserialization creates a new instance unless `readResolve()` — enum avoids this
- **Reflection**: can bypass private constructor — enum avoids this
- **Class loaders**: multiple class loaders can each load a Singleton → multiple instances
- **Not thread-safe on lazy init** if you skip the lock

### In LLD Problems

- **Logger** — one instance, global access
- **Parking Lot Registry** — one lot per ID (registry, not classic Singleton)
- **Rate Limiter** — one limiter per key, but managed by a registry
- **Cache Manager** — one cache per JVM (or per tenant)

---

## 2. Factory Method

**Define an interface for creating an object, but let subclasses decide which class to instantiate.**

### Problem

You need to create objects, but the **concrete type depends on input** at runtime. Callers shouldn't know the concrete classes.

### ❌ Without Factory

```java
public Vehicle createVehicle(String type) {
    if (type.equals("CAR")) return new Car();
    else if (type.equals("BIKE")) return new Bike();
    else if (type.equals("TRUCK")) return new Truck();
    else throw new IllegalArgumentException(type);
}
```

**Problems:**
- Caller knows all types
- Adding a new type requires editing this method
- Violates Open/Closed

### ✅ Simple Factory (Static Method)

```java
public final class VehicleFactory {
    private VehicleFactory() {}

    public static Vehicle create(String licensePlate, VehicleType type) {
        return switch (type) {
            case CAR -> new Car(licensePlate);
            case BIKE -> new Bike(licensePlate);
            case TRUCK -> new Truck(licensePlate);
            case EV -> new EV(licensePlate);
        };
    }
}
```

**Usage:**
```java
Vehicle v = VehicleFactory.create("KA-01-AB-1234", VehicleType.CAR);
```

**Still OCP-violating** when adding new types, but centralizes the change to one place.

### ✅ Factory Method (GoF)

Define a factory **interface** and let subclasses decide:

```java
public interface VehicleFactory {
    Vehicle create(String licensePlate);
}

public final class CarFactory implements VehicleFactory {
    public Vehicle create(String plate) { return new Car(plate); }
}

public final class BikeFactory implements VehicleFactory {
    public Vehicle create(String plate) { return new Bike(plate); }
}
```

**Usage:**
```java
VehicleFactory factory = getFactoryFor(type);
Vehicle v = factory.create("KA-01-AB-1234");
```

**Adding EV:** create `EvFactory` — no existing class changes (OCP).

### When to Use Factory

✅ Object creation has **logic** (validation, lookup, config)
✅ Caller **shouldn't know** the concrete class
✅ **New types** are expected (OCP)
✅ **Testing** — inject a factory mock

❌ Simple `new` is fine — don't wrap

### Real-World Examples

- `Calendar.getInstance()`
- `LoggerFactory.getLogger(name)`
- `Executors.newFixedThreadPool(n)`
- `NumberFormat.getInstance(locale)`

### In LLD Problems

- **Parking Lot** — `VehicleFactory.create(plate, type)`
- **Chess** — `PieceFactory.create(type, color)`
- **Logger** — `AppenderFactory.create(type)`
- **Cache** — `EvictionPolicyFactory.create(type)`

---

## 3. Abstract Factory

**Provide an interface for creating families of related objects without specifying concrete classes.**

### Problem

You need to create **multiple related objects** that must be compatible.

### Example: UI Toolkit

```java
public interface Button { void render(); }
public interface Checkbox { void render(); }

public interface UIFactory {
    Button createButton();
    Checkbox createCheckbox();
}

public final class WindowsFactory implements UIFactory {
    public Button createButton() { return new WindowsButton(); }
    public Checkbox createCheckbox() { return new WindowsCheckbox(); }
}

public final class MacFactory implements UIFactory {
    public Button createButton() { return new MacButton(); }
    public Checkbox createCheckbox() { return new MacCheckbox(); }
}
```

**Usage:**
```java
UIFactory factory = isMac ? new MacFactory() : new WindowsFactory();
Button b = factory.createButton();
Checkbox c = factory.createCheckbox();
// b and c are from the same family (both Mac or both Windows)
```

### When to Use Abstract Factory

✅ **Families of related objects** must be used together
✅ Multiple **variants** (Windows/Mac, Prod/Test, Region/Region)
✅ You want to enforce family consistency

❌ Only one product → use Factory Method
❌ Families don't exist → don't force it

### In LLD Problems

Rare in LLD interviews, but appears in:
- **Cloud provider abstraction** (AWS/GCP/Azure factories)
- **Database abstraction** (Postgres/MySQL factories)
- **Theme systems** (Light/Dark factories)

**Example — DatabaseFactory:**
```java
public interface DatabaseFactory {
    Connection createConnection();
    QueryBuilder createQueryBuilder();
    TransactionManager createTransactionManager();
}
```

---

## 4. Builder

**Construct a complex object step by step. Same construction process can produce different representations.**

### Problem

Objects with **many optional fields** lead to telescoping constructors:

```java
public Ticket(Vehicle v) { ... }
public Ticket(Vehicle v, PricingStrategy p) { ... }
public Ticket(Vehicle v, PricingStrategy p, LocalDateTime t) { ... }
public Ticket(Vehicle v, PricingStrategy p, LocalDateTime t, String coupon) { ... }
// ... exploding
```

Callers can't tell which argument is which; ordering mistakes are common.

### ✅ Builder Pattern

```java
public final class Ticket {
    private final String id;
    private final Vehicle vehicle;
    private final ParkingSpot spot;
    private final LocalDateTime entryTime;
    private final PricingStrategy pricing;
    private final String coupon;

    private Ticket(Builder b) {
        this.id = b.id;
        this.vehicle = b.vehicle;
        this.spot = b.spot;
        this.entryTime = b.entryTime;
        this.pricing = b.pricing;
        this.coupon = b.coupon;
    }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String id;
        private Vehicle vehicle;
        private ParkingSpot spot;
        private LocalDateTime entryTime;
        private PricingStrategy pricing;
        private String coupon;

        public Builder id(String id) { this.id = id; return this; }
        public Builder vehicle(Vehicle v) { this.vehicle = v; return this; }
        public Builder spot(ParkingSpot s) { this.spot = s; return this; }
        public Builder entryTime(LocalDateTime t) { this.entryTime = t; return this; }
        public Builder pricing(PricingStrategy p) { this.pricing = p; return this; }
        public Builder coupon(String c) { this.coupon = c; return this; }

        public Ticket build() {
            // validate
            if (vehicle == null) throw new IllegalStateException("vehicle required");
            if (spot == null) throw new IllegalStateException("spot required");
            if (entryTime == null) entryTime = LocalDateTime.now();
            if (pricing == null) throw new IllegalStateException("pricing required");
            if (id == null) id = UUID.randomUUID().toString();
            return new Ticket(this);
        }
    }
}
```

**Usage:**
```java
Ticket t = Ticket.builder()
    .vehicle(car)
    .spot(spot)
    .pricing(new HourlyPricing(Money.of(2.0, "USD")))
    .build();
```

**Benefits:**
- **Readable** — named parameters
- **Optional fields** — only set what's needed
- **Immutable result** — private constructor, final fields
- **Validation** in `build()`

### Modern Alternatives (Java 17)

**Records** — for simple immutable data:

```java
public record Point(int x, int y) {}
```

But records don't help when there are many optional fields. For those, Builder still wins.

**Static factory methods** — for a small number of variants:

```java
public static Ticket of(Vehicle v, ParkingSpot s) { ... }
public static Ticket withCoupon(Vehicle v, ParkingSpot s, String c) { ... }
```

### When to Use Builder

✅ **Many optional fields** (>4)
✅ **Immutability** desired
✅ **Step-by-step construction** with validation at the end
✅ **Fluent API** improves readability

❌ Few fields → use constructor
❌ Mutable object → setters are fine
❌ No validation → constructor is fine

### In LLD Problems

- **Ticket** — many optional fields (coupon, discount, valet)
- **Order** — items, discounts, delivery address, payment
- **HTTP Request** — URL, headers, body, auth
- **Query** — SELECT, WHERE, GROUP BY, ORDER BY, LIMIT

### Lombok Note

Lombok's `@Builder` generates this automatically. In **interviews**, don't rely on Lombok — write it out to show you understand.

---

## 5. Prototype

**Create new objects by cloning existing ones.**

### Problem

Creating an object is **expensive** (DB query, network call, complex computation), and you want a **copy** with slight modifications.

### ✅ Prototype Pattern

```java
public abstract class Shape implements Cloneable {
    protected String color;

    @Override
    public Shape clone() {
        try {
            return (Shape) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError(e);
        }
    }

    public abstract void draw();
}

public final class Circle extends Shape {
    private int radius;

    @Override
    public Circle clone() {
        return (Circle) super.clone();
    }
}
```

**Usage:**
```java
Circle base = new Circle();
base.color = "red";
base.radius = 10;

Circle copy = base.clone();
copy.color = "blue";   // only this changes
```

### Deep vs Shallow Copy

**Shallow** (`Object.clone()`): copies primitive fields and references. Nested objects are **shared**.

**Deep**: recursively clones nested objects.

```java
// Shallow — addresses list is shared!
public class User implements Cloneable {
    private String name;
    private List<Address> addresses;

    @Override
    public User clone() throws CloneNotSupportedException {
        return (User) super.clone();   // addresses shared!
    }
}

// Deep
@Override
public User clone() {
    User copy = (User) super.clone();
    copy.addresses = new ArrayList<>(this.addresses);   // new list
    return copy;
}
```

### Copy Constructors (Preferred)

```java
public class User {
    private final String name;
    private final List<Address> addresses;

    public User(User other) {
        this.name = other.name;
        this.addresses = new ArrayList<>(other.addresses);   // deep
    }
}
```

**Better than `Cloneable`** — explicit, no `CloneNotSupportedException`, no `super.clone()` magic.

### When to Use Prototype

✅ Creation is **expensive** and you want copies
✅ You need **many variants** of a base object
✅ Object graph is **large** and mostly shared

❌ `new` is cheap → don't bother
❌ Deep copy is complex → copy constructor is cleaner

### In LLD Problems

Rare in classic LLD interviews, but useful in:
- **Game state snapshots** (Chess, Tic-Tac-Toe for undo)
- **Document templates** (copy a template doc)
- **Config presets** (clone a base config)

---

## 🎯 Choosing a Creational Pattern

| Situation | Pattern |
|---|---|
| One instance per JVM | Singleton |
| Create based on runtime input | Factory Method (simple) |
| Create with a factory interface | Factory Method (GoF) |
| Create families of related objects | Abstract Factory |
| Construct complex object step by step | Builder |
| Copy existing object | Prototype |

---

## ⚠️ Common Pitfalls

| Pattern | Pitfall |
|---|---|
| Singleton | Not thread-safe lazy init; use holder class |
| Singleton | Serialization/reflection bypass |
| Singleton | Overused as global state; prefer DI |
| Factory | Wrapping `new` when there's no logic |
| Factory | Returning `null` for unknown types — throw instead |
| Abstract Factory | Overkill when one product |
| Builder | Mutable intermediate state shared across calls |
| Builder | Not validating in `build()` |
| Prototype | Shallow copy when deep needed |
| Prototype | `Cloneable` is broken by design; use copy constructors |

---

## 🔗 Related Sections

- [Design Patterns Index](index.md) — all categories
- [Structural Patterns](structural.md) — Adapter, Decorator, Facade, Proxy, Composite
- [Behavioral Patterns](behavioral.md) — Strategy, Observer, State, Command
- [SOLID Principles](../solid-principles.md) — Factory is OCP in action; Builder is SRP
- [Concurrency Basics](../concurrency-basics.md) — Singleton thread-safe init

---

## 📌 Key Takeaways

- **Singleton** — one instance; use holder class or enum, avoid classic DCL
- **Factory Method** — decouple creation from usage; OCP for new types
- **Abstract Factory** — families of related objects; used for providers/themes
- **Builder** — step-by-step construction; readable, immutable, validated
- **Prototype** — clone existing objects; prefer copy constructors over `Cloneable`
- **Prefer DI over Singleton** for testability
- **Don't wrap `new`** unless there's logic to encapsulate
- **Validate in Builder's `build()`** — never return half-constructed objects
- **Factory + Strategy + Observer** are the LLD workhorses — master them