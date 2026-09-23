# Patterns in Java

> **JDK context:** The Gang-of-Four patterns predate Java. Modern Java
> provides `enum` singletons (Java 5), functional interfaces (Java 8),
> records (Java 16), and sealed types (Java 17) that reshape how some
> patterns are implemented. Some classic patterns become trivial or
> obsolete in modern Java.

## Mental Model

Design patterns are **named solutions to recurring design problems**. They
give you a shared vocabulary and a starting point — not templates to paste in.

The GoF patterns split into three families:

```d2
direction: down

gof: "Gang-of-Four Patterns" {
  style.fill: "#f5f5f5"

  creational: "Creational" {
    style.fill: "#bbdefb"
    desc: "How objects are created\nSingleton, Factory, Builder,\nPrototype, Abstract Factory"
  }

  structural: "Structural" {
    style.fill: "#c8e6c9"
    desc: "How objects compose\nAdapter, Decorator, Proxy,\nFacade, Composite, ..."
  }

  behavioral: "Behavioral" {
    style.fill: "#fff9c4"
    desc: "How objects communicate\nStrategy, Observer, State,\nCommand, Template, ..."
  }
}
```

**This file focuses on the patterns that come up in Java interviews and
code reviews.** Deep coverage of every pattern belongs in the LLD section.

---

## Singleton

Exactly one instance per classloader.

### Version 1 — Lazy, not thread-safe

```java
public class Singleton {
    private static Singleton instance;

    private Singleton() {}

    public static Singleton getInstance() {
        if (instance == null) {
            instance = new Singleton();   // RACE
        }
        return instance;
    }
}
```

Two threads can both see `null` and create two instances.

### Version 2 — `synchronized` (correct, slow)

```java
public static synchronized Singleton getInstance() {
    if (instance == null) {
        instance = new Singleton();
    }
    return instance;
}
```

Correct but locks on every call.

### Version 3 — Double-checked locking

```java
public class Singleton {
    private static volatile Singleton instance;

    private Singleton() {}

    public static Singleton getInstance() {
        if (instance == null) {                  // 1st check (fast path)
            synchronized (Singleton.class) {
                if (instance == null) {          // 2nd check
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

The **`volatile` is mandatory** — without it, another thread could see a
partially constructed object.

### Version 4 — Initialization-on-demand holder (BEST)

```java
public class Singleton {
    private Singleton() {}

    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }

    public static Singleton getInstance() {
        return Holder.INSTANCE;
    }
}
```

- **Lazy** — `Holder` loads only on first `getInstance()`
- **Thread-safe** — classloading is synchronized by the JVM
- **Fast** — no `synchronized` on the hot path
- **No `volatile` needed** — the JLS guarantees safe publication

### Version 5 — Enum singleton (Bloch's favorite)

```java
public enum Singleton {
    INSTANCE;

    public void doWork() { }
}
```

- Thread-safe
- Serialization-safe (JVM handles it)
- Reflection-safe (can't invoke enum constructor reflectively)
- Succinct

**Use this unless you need to extend a class.**

### Which to use

| Version | Thread-safe | Lazy | Serializable | Reflection-safe | Recommended |
|---|---|---|---|---|---|
| V1 | ❌ | ✅ | ❌ | ❌ | Never |
| V2 | ✅ | ✅ | ❌ | ❌ | Rarely |
| V3 (DCL) | ✅ | ✅ | ⚠️ | ❌ | With `readResolve` |
| V4 (holder) | ✅ | ✅ | ⚠️ | ❌ | ✅ Default choice |
| V5 (enum) | ✅ | ✅ | ✅ | ✅ | ✅ Preferred |

### Is Singleton thread-safe?

**Depends on the implementation.** V1 isn't. V2, V3, V4, V5 are.

### Preventing reflection / serialization attacks

```java
// Reflection
private Singleton() {
    if (Holder.INSTANCE != null) {
        throw new IllegalStateException("Use getInstance()");
    }
}

// Serialization
protected Object readResolve() {
    return getInstance();
}
```

**Enum singletons don't need either.** The JVM blocks reflective instantiation
and deserialization for enums.

---

## Factory Method

Delegate object creation to a method or subclass.

### Simple factory

```java
public class ShapeFactory {
    public static Shape create(String type) {
        return switch (type) {
            case "circle" -> new Circle();
            case "square" -> new Square();
            default -> throw new IllegalArgumentException("unknown: " + type);
        };
    }
}
```

### Factory method with subclasses

```java
abstract class Dialog {
    public void render() {
        Button button = createButton();   // factory method
        button.render();
    }

    protected abstract Button createButton();
}

class WindowsDialog extends Dialog {
    @Override protected Button createButton() { return new WindowsButton(); }
}

class MacDialog extends Dialog {
    @Override protected Button createButton() { return new MacButton(); }
}
```

### When to use

- You don't know the exact class to instantiate up front
- You want to centralize creation logic
- You want to decouple callers from concrete types

### Modern alternative — `Supplier<T>`

```java
Map<String, Supplier<Shape>> registry = Map.of(
        "circle", Circle::new,
        "square", Square::new
);

Shape s = registry.get("circle").get();
```

No factory class needed for simple cases.

---

## Builder

Construct complex objects step by step.

```java
public class Pizza {
    private final String size;
    private final boolean cheese;
    private final boolean pepperoni;
    private final List<String> toppings;

    private Pizza(Builder b) {
        this.size = b.size;
        this.cheese = b.cheese;
        this.pepperoni = b.pepperoni;
        this.toppings = List.copyOf(b.toppings);
    }

    public static class Builder {
        private final String size;                // required
        private boolean cheese;
        private boolean pepperoni;
        private final List<String> toppings = new ArrayList<>();

        public Builder(String size) { this.size = size; }   // required in ctor

        public Builder cheese(boolean v) { this.cheese = v; return this; }
        public Builder pepperoni(boolean v) { this.pepperoni = v; return this; }
        public Builder addTopping(String t) { toppings.add(t); return this; }

        public Pizza build() {
            return new Pizza(this);
        }
    }
}

// Usage — fluent
Pizza p = new Pizza.Builder("large")
        .cheese(true)
        .addTopping("mushrooms")
        .addTopping("olives")
        .build();
```

### Why Builder

- **Many optional parameters** — avoids telescoping constructors
- **Immutability** — the built object can be immutable with a private constructor
- **Readable** — named setters in fluent chain
- **Validated** — `build()` can validate before constructing

### Modern alternative — Records + `withX` methods

```java
public record Pizza(String size, boolean cheese, boolean pepperoni, List<String> toppings) {
    public Pizza withCheese(boolean v) {
        return new Pizza(size, v, pepperoni, toppings);
    }
}
```

Works for small objects. Builder still wins for many optional fields.

---

## Observer

One object (subject) notifies many (observers) when its state changes.

### Java's built-in (deprecated)

`java.util.Observable` and `Observer` were deprecated in Java 9. Roll your own.

### Modern implementation

```java
@FunctionalInterface
interface Listener {
    void onEvent(Event event);
}

class EventSource {
    private final List<Listener> listeners = new CopyOnWriteArrayList<>();

    public void subscribe(Listener l) { listeners.add(l); }
    public void unsubscribe(Listener l) { listeners.remove(l); }

    public void fire(Event e) {
        for (Listener l : listeners) l.onEvent(e);
    }
}
```

### With `Consumer<T>`

```java
class EventSource {
    private final List<Consumer<Event>> listeners = new CopyOnWriteArrayList<>();

    public void subscribe(Consumer<Event> l) { listeners.add(l); }
    public void fire(Event e) { listeners.forEach(l -> l.accept(e)); }
}
```

### Where it appears in Java

- `java.util.concurrent.Flow` (Java 9) — reactive streams
- `PropertyChangeListener` (Swing)
- `ApplicationListener` (Spring)
- Reactive frameworks (RxJava, Reactor)

### Pitfall — memory leak

Listeners registered on a long-lived subject are **never GC'd** unless
explicitly removed. Use `WeakReference` or explicit unsubscribe.

---

## Strategy

Interchangeable algorithms behind a common interface.

```java
@FunctionalInterface
interface DiscountStrategy {
    double apply(double price);
}

class Checkout {
    private DiscountStrategy discount;

    public Checkout(DiscountStrategy discount) { this.discount = discount; }

    public double total(double price) { return discount.apply(price); }
}

// Usage
Checkout c1 = new Checkout(p -> p * 0.9);           // 10% off
Checkout c2 = new Checkout(p -> p > 100 ? p - 20 : p);  // $20 off if > 100
```

### Modern Java — Strategy is just a lambda

Before Java 8, you needed:

```java
interface DiscountStrategy { double apply(double price); }

class TenPercentOff implements DiscountStrategy {
    public double apply(double price) { return price * 0.9; }
}

new Checkout(new TenPercentOff());
```

After Java 8:

```java
new Checkout(p -> p * 0.9);
```

**Strategy is the poster child for the lambda-ification of design patterns.**

### Where it appears

- `Comparator<T>` — strategy for comparison
- `Runnable` — strategy for what to run
- `Function`, `Predicate` — strategies for transforming/filtering

---

## Template Method

Define the skeleton of an algorithm; let subclasses fill in steps.

```java
abstract class DataMiner {
    // Template method — final to prevent override
    public final void mine(String path) {
        open(path);
        extract();
        parse();
        analyze();
        close();
    }

    protected abstract void open(String path);
    protected abstract void extract();
    protected abstract void parse();
    protected abstract void analyze();
    protected abstract void close();
}
```

### Modern alternative — functional composition

```java
record Pipeline<S, T>(
        Function<String, S> open,
        Function<S, T> process,
        Consumer<T> output) {

    void run(String path) {
        output.accept(process.apply(open.apply(path)));
    }
}
```

Both are valid. Template Method is clearer for algorithms with optional
steps and hooks; functional composition is cleaner for simple pipelines.

---

## Decorator

Add behavior to an object without modifying its class.

```java
interface Coffee {
    double cost();
    String description();
}

class Espresso implements Coffee {
    public double cost() { return 2.0; }
    public String description() { return "Espresso"; }
}

class MilkDecorator implements Coffee {
    private final Coffee base;
    MilkDecorator(Coffee base) { this.base = base; }
    public double cost() { return base.cost() + 0.5; }
    public String description() { return base.description() + ", milk"; }
}

// Usage
Coffee c = new MilkDecorator(new Espresso());
System.out.println(c.description() + ": $" + c.cost());
// Espresso, milk: $2.5
```

### Where it appears in the JDK

- **I/O streams** — `BufferedReader(new FileReader(f))`, `GZIPInputStream(...)`
- **`Collections.unmodifiableList(...)`** — decorator that blocks mutation
- **`Collections.synchronizedList(...)`** — decorator that adds locking

### Decorator vs Inheritance

| | Decorator | Inheritance |
|---|---|---|
| Combination at runtime | ✅ | ❌ |
| Combinatorial explosion | Avoided | Nested subclasses |

---

## Proxy

Same interface as a target, but you control access.

Three flavors:

- **Virtual proxy** — lazy initialization (create the target on first use)
- **Protection proxy** — access control (check permissions)
- **Remote proxy** — local representative of a remote object (RMI, gRPC stub)

```java
interface Image { void display(); }

class RealImage implements Image {
    RealImage(String path) { load(path); }   // expensive
    public void display() { /* show */ }
    private void load(String path) { /* ... */ }
}

class LazyImageProxy implements Image {
    private final String path;
    private RealImage real;

    LazyImageProxy(String path) { this.path = path; }

    public void display() {
        if (real == null) real = new RealImage(path);   // lazy load
        real.display();
    }
}
```

### Where it appears

- **Spring AOP** — proxies for `@Transactional`, `@Cacheable`
- **`java.lang.reflect.Proxy`** — dynamic proxies
- **Mockito mocks** — proxies that intercept calls
- **Hibernate lazy loading** — entity proxies

### Static vs Dynamic proxy

| | Static | Dynamic |
|---|---|---|
| Created at | Compile time | Runtime |
| Classes | One per target | `Proxy.newProxyInstance(...)` |
| Bytecode | Hand-written | Generated |
| Spring | Rarely | Common |

---

## Adapter

Convert one interface to another.

```java
interface ModernPayment {
    void pay(double amount);
}

class LegacyPaymentSystem {
    public void makePayment(double amount, String currency) { /* ... */ }
}

class LegacyAdapter implements ModernPayment {
    private final LegacyPaymentSystem legacy;
    LegacyAdapter(LegacyPaymentSystem l) { this.legacy = l; }

    @Override
    public void pay(double amount) {
        legacy.makePayment(amount, "USD");
    }
}
```

### Adapter vs Decorator vs Proxy

All three "wrap" another object. The difference is intent:

| Pattern | Intent |
|---|---|
| **Adapter** | Change the interface |
| **Decorator** | Add behavior, same interface |
| **Proxy** | Control access, same interface |

---

## Facade

A simplified interface over a complex subsystem.

```java
class OrderFacade {
    private final InventoryService inventory;
    private final PaymentService payment;
    private final ShippingService shipping;

    public OrderResult placeOrder(Order order) {
        inventory.reserve(order);
        payment.charge(order);
        shipping.schedule(order);
        return new OrderResult(order.id(), "PLACED");
    }
}
```

**Not the same as Adapter** — Facade doesn't adapt an existing interface, it
**defines** a new simplified one.

---

## Immutable Object Pattern

Not a GoF pattern but essential in modern Java. See
[Immutable Objects](immutable-objects.md) for the full treatment.

Quick summary:

```java
public final class Money {
    private final BigDecimal amount;
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        this.amount = amount;
        this.currency = currency;
    }

    // No setters. Every "modification" returns a new instance.
    public Money add(Money other) {
        // validate same currency, etc.
        return new Money(amount.add(other.amount), currency);
    }
}
```

---

## Pattern-to-Java-Feature Cross-Reference

| Pattern | Java-builtin equivalent |
|---|---|
| Strategy | `Comparator`, `Runnable`, `Function` |
| Observer | `java.util.concurrent.Flow`, `PropertyChangeListener` |
| Iterator | `Iterator`, `Iterable`, `Stream` |
| Template Method | `Stream.map/filter` pipelines |
| Decorator | `InputStream` chain, `Collections.unmodifiable*` |
| Proxy | `java.lang.reflect.Proxy`, Spring AOP |
| Factory | `Supplier<T>`, `Stream.generate` |
| Singleton | `enum` with a single constant |
| Command | `Runnable` |

---

## Patterns Not Covered Here

- **Abstract Factory** — a family of related factories
- **Prototype** — clone to create new instances
- **Composite** — tree structures of uniform elements
- **Bridge** — separate abstraction from implementation
- **Flyweight** — share common state across many objects
- **Chain of Responsibility** — pass request along a chain
- **Command** — encapsulate a request as an object
- **Interpreter** — grammar for a language
- **Iterator** — already familiar
- **Mediator** — centralize communication
- **Memento** — capture/restore state
- **State** — behavior varies with internal state
- **Visitor** — add operations without modifying classes

Deep treatment belongs in the [LLD section](../../lld/index.md).

---

## Which Pattern for "Modularity"?

**Interfaces + Dependency Injection.**

Modularity in Java comes from:
1. **Interfaces** as contracts (implementations swappable)
2. **Dependency Injection** (constructor injection, DI containers)
3. **Package structure** (bounded contexts)

Design patterns that support modularity:
- **Strategy** — swappable algorithms
- **Factory** — swappable creation
- **Adapter** — decouple from external interfaces
- **Facade** — simplified, stable surface

If asked "which pattern achieves modularity?" — the honest answer is
**Interfaces + DI** more than any single GoF pattern.

---

## Tricky Corners ⚠️

**Singleton via `enum` is serialization-safe and reflection-safe.**
Non-enum singletons need `readResolve` and a constructor guard.

**Double-checked locking requires `volatile`.** Without it, unsafe publication.

**Singleton is per-classloader, not per-JVM.** Custom classloaders can create
multiple "singletons."

**Observer listeners are a common memory leak.** Long-lived subjects hold
strong refs to listeners.

**Proxy is not Adapter.** Proxy preserves the interface; Adapter changes it.

**Decorator and Proxy look identical in code.** The difference is intent.

**`java.util.Observable` is deprecated** — implement it yourself or use
`Flow`.

**Singleton is often an anti-pattern in modern code.** Prefer DI containers
that manage lifecycle. A singleton makes testing hard.

**Records make several patterns unnecessary.** Value objects no longer need
builders; immutability is free.

---

## Common Pitfalls

- Lazy Singleton without synchronization.
- DCL without `volatile`.
- Confusing Adapter, Decorator, Proxy.
- Observer listeners causing leaks.
- Using Singleton for global state (testability nightmare).
- Choosing Builder when a record suffices.

---

## Key Interview Tips

- **Singleton** — pitch initialization-on-demand holder; mention enum.
- **Factory** — differ from Abstract Factory in one line.
- **Strategy** — say "it's a lambda now."
- **Observer** — mention `CopyOnWriteArrayList` for thread safety.
- **Adapter vs Decorator vs Proxy** — same shape, different intent.
- **Template Method vs Strategy** — inheritance vs composition.

---

## Related

- [Immutable Objects](immutable-objects.md) — modern object design
- [Nested Classes](../fundamentals/nested-classes.md) — for Singleton holder idiom
- [Serialization Deep Dive](../io-serialization/serialization-deep-dive.md) — singleton serialization
- [LLD section](../../lld/index.md) — full pattern catalog