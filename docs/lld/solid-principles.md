# SOLID Principles

SOLID is an acronym for five object-oriented design principles introduced by Robert C. Martin (Uncle Bob). Together they produce code that is easier to extend, test, and reason about — the exact qualities LLD interviews test for.

Every LLD problem you design will benefit from SOLID. This page explains each principle with **violations**, **refactored versions**, and **Java 17 code**.

---

## 📐 Overview

| Letter | Principle | One-liner |
|---|---|---|
| **S** | Single Responsibility | A class should have one reason to change |
| **O** | Open/Closed | Open for extension, closed for modification |
| **L** | Liskov Substitution | Subtypes must be substitutable for their base types |
| **I** | Interface Segregation | No client should depend on methods it doesn't use |
| **D** | Dependency Inversion | Depend on abstractions, not concretions |

---

## 1. Single Responsibility Principle (SRP)

> A class should have only one reason to change.

### Why It Matters

A class with multiple responsibilities becomes a magnet for unrelated changes. Fixing pricing shouldn't risk breaking logging; fixing logging shouldn't break persistence.

### ❌ Violation

```java
public class Invoice {
    private final List<LineItem> items;

    public double calculateTotal() { /* ... */ }      // business logic

    public void saveToDatabase() { /* JDBC code */ }  // persistence

    public String renderHtml() { /* HTML */ }         // presentation

    public void sendEmail() { /* SMTP */ }            // notification
}
```

**Problem:** Four reasons to change (business rule, DB schema, HTML design, email server). Testing requires all four.

### ✅ Refactored

```java
public class Invoice {
    private final List<LineItem> items;
    public Money calculateTotal() { /* pure logic */ }
    public List<LineItem> items() { return items; }
}

public class InvoiceRepository {
    public void save(Invoice invoice) { /* JDBC */ }
}

public class InvoiceHtmlRenderer {
    public String render(Invoice invoice) { /* HTML */ }
}

public class InvoiceEmailNotifier {
    public void send(Invoice invoice, String email) { /* SMTP */ }
}
```

**Result:** Each class has one reason to change. Testing `Invoice` needs no mocks.

### How to Spot

- Class name contains "And" or "Manager"
- Class has unrelated methods (`calculateX`, `saveY`, `renderZ`)
- A single change request touches multiple unrelated concerns

### In LLD Problems

**Parking Lot:** `ParkingLot` should orchestrate, not compute pricing or persist tickets. Split:
- `ParkingLot` — orchestration
- `PricingStrategy` — fee calculation
- `TicketRepository` — persistence
- `DisplayBoard` — presentation

---

## 2. Open/Closed Principle (OCP)

> Software entities should be open for extension, but closed for modification.

### Why It Matters

Adding a new feature shouldn't require editing existing, tested code. New behavior should plug in via new classes.

### ❌ Violation

```java
public class PricingCalculator {
    public Money calculate(Ticket t, String vehicleType) {
        if (vehicleType.equals("CAR")) {
            return Money.of(2.0 * t.hours(), "USD");
        } else if (vehicleType.equals("BIKE")) {
            return Money.of(1.0 * t.hours(), "USD");
        } else if (vehicleType.equals("TRUCK")) {
            return Money.of(5.0 * t.hours(), "USD");
        }
        throw new IllegalArgumentException("Unknown type");
    }
}
```

**Problem:** Adding `EV` requires editing this method. Every edit risks breaking existing cases.

### ✅ Refactored (Strategy Pattern)

```java
public interface PricingStrategy {
    Money calculateFee(Ticket ticket);
}

public final class CarPricing implements PricingStrategy {
    public Money calculateFee(Ticket t) { return Money.of(2.0 * t.hours(), "USD"); }
}

public final class BikePricing implements PricingStrategy {
    public Money calculateFee(Ticket t) { return Money.of(1.0 * t.hours(), "USD"); }
}

public final class TruckPricing implements PricingStrategy {
    public Money calculateFee(Ticket t) { return Money.of(5.0 * t.hours(), "USD"); }
}
```

**Adding EV:** Create `EvPricing` — no existing class changes.

### How to Spot

- `if/else if/else` chains keyed on type strings
- `switch` on enum with many branches (that will grow)
- Methods whose behavior changes for every new type

### In LLD Problems

- **Parking Lot:** Pricing strategies, spot allocation strategies
- **Chess:** Piece movement rules (each piece = its own class with `canMove()`)
- **Logger:** Log appenders (Console, File, Cloud) — add new appender without changing `Logger`
- **Vending Machine:** Payment methods — add UPI without touching existing

### Caveat

Not every `if` needs a strategy. If there are 2 cases and no expectation of growth, keep the `if`. OCP is about **anticipated variation**.

---

## 3. Liskov Substitution Principle (LSP)

> Objects of a superclass should be replaceable with objects of its subclasses without breaking correctness.

### Why It Matters

If a subclass can't honor the base class contract, polymorphism fails. Client code holding a `Vehicle` reference must work for `Car`, `Bike`, `Truck`.

### ❌ Violation

```java
public class Bird {
    public void fly() { /* ... */ }
}

public class Penguin extends Bird {
    @Override
    public void fly() {
        throw new UnsupportedOperationException("Penguins can't fly");
    }
}
```

**Problem:** Client code `bird.fly()` breaks for `Penguin`. The subclass violates the base contract.

### ✅ Refactored

```java
public abstract class Bird { /* common bird behavior */ }

public interface Flyer { void fly(); }
public interface Swimmer { void swim(); }

public class Sparrow extends Bird implements Flyer {
    public void fly() { /* ... */ }
}

public class Penguin extends Bird implements Swimmer {
    public void swim() { /* ... */ }
}
```

**Result:** Clients depend on capabilities (`Flyer`, `Swimmer`), not on a fragile base class.

### Classic Violation Examples

- `Rectangle` / `Square` — Square can't be substituted for Rectangle without breaking setter contracts
- `Stack extends Vector` — Stack inherits unrelated Vector methods
- `ImmutableList extends ArrayList` — subclass exposes mutating methods

### The LSP Test

Before declaring `class Child extends Parent`, ask:
1. Does `Child` fulfill every contract of `Parent`?
2. Can client code written against `Parent` work unchanged with `Child`?
3. Are preconditions in `Child` ≤ those of `Parent`? (weaker or equal)
4. Are postconditions in `Child` ≥ those of `Parent`? (stronger or equal)

If any answer is "no", refactor with composition.

### How to Spot

- Overridden method throws `UnsupportedOperationException`
- Subclass narrows accepted inputs or loosens outputs
- Subclass changes semantics of inherited methods (e.g., `save()` that deletes instead)

### In LLD Problems

- **Parking Lot:** `Vehicle` hierarchy must be clean. If `Truck` requires a spot type that `Vehicle.park()` can't honor, the base method is wrong.
- **Chess:** `Piece.move()` must work for every piece. Pawn's "cannot move backward" must be encoded in its move logic, not as an exception in the base.
- **Payment:** `PaymentProcessor.process()` must succeed for Cash, Card, UPI with the same signature.

---

## 4. Interface Segregation Principle (ISP)

> No client should be forced to depend on methods it doesn't use.

### Why It Matters

Fat interfaces force implementers to write stubs or throw exceptions. Clients see methods they shouldn't call. Split into focused interfaces.

### ❌ Violation

```java
public interface Worker {
    void work();
    void eat();
    void sleep();
    void takeBreak();
}

public class Robot implements Worker {
    public void work() { /* ... */ }
    public void eat() { throw new UnsupportedOperationException(); }
    public void sleep() { throw new UnsupportedOperationException(); }
    public void takeBreak() { throw new UnsupportedOperationException(); }
}
```

**Problem:** `Robot` is forced to implement human-only methods.

### ✅ Refactored

```java
public interface Workable { void work(); }
public interface Feedable { void eat(); void sleep(); }
public interface Breakable { void takeBreak(); }

public class Human implements Workable, Feedable, Breakable {
    public void work() { /* ... */ }
    public void eat() { /* ... */ }
    public void sleep() { /* ... */ }
    public void takeBreak() { /* ... */ }
}

public class Robot implements Workable {
    public void work() { /* ... */ }
}
```

### How to Spot

- Interface has >7 methods (rule of thumb)
- Implementers throw `UnsupportedOperationException` for some methods
- Different clients use disjoint subsets of methods

### In LLD Problems

- **Logger:** Don't force every appender to implement `flushToCloud()`. Split into `Logger`, `Flushable`, `CloudEnabled`.
- **Payment:** Split `PaymentProcessor` (charge, refund) from `RecurringPaymentProcessor` (subscribe, cancel) if not all support recurring.
- **Cache:** Split `Cache` (get, put, evict) from `ObservableCache` (register listeners).

### Prefer Small, Composed Interfaces

```java
public interface Readable<K, V> { V get(K key); }
public interface Writeable<K, V> { void put(K key, V value); }
public interface Cache<K, V> extends Readable<K, V>, Writeable<K, V> { void evict(K key); }
```

Clients that only read depend on `Readable`, not the full `Cache`.

---

## 5. Dependency Inversion Principle (DIP)

> High-level modules should not depend on low-level modules. Both should depend on abstractions.
> Abstractions should not depend on details. Details should depend on abstractions.

### Why It Matters

Business logic shouldn't be coupled to a specific database, HTTP client, or framework. Invert the dependency: introduce an interface, inject implementations.

### ❌ Violation

```java
public class TicketService {
    private final MySqlTicketRepository repo = new MySqlTicketRepository();

    public Ticket createTicket(Vehicle v, ParkingSpot s) {
        Ticket t = new Ticket(/* ... */);
        repo.insert(t);   // hard-coded dependency
        return t;
    }
}
```

**Problem:** `TicketService` can't be tested without MySQL. Swapping to Postgres requires editing `TicketService`.

### ✅ Refactored

```java
public interface TicketRepository {
    void save(Ticket t);
    Optional<Ticket> findById(String id);
}

public final class MySqlTicketRepository implements TicketRepository { /* ... */ }
public final class InMemoryTicketRepository implements TicketRepository { /* ... */ }

public class TicketService {
    private final TicketRepository repo;

    public TicketService(TicketRepository repo) {   // constructor injection
        this.repo = repo;
    }

    public Ticket createTicket(Vehicle v, ParkingSpot s) {
        Ticket t = new Ticket(/* ... */);
        repo.save(t);
        return t;
    }
}
```

**Result:** Test with `InMemoryTicketRepository`. Swap to Postgres by injecting `PostgresTicketRepository`. No changes to `TicketService`.

### How to Spot

- `new` keyword inside business logic (creating dependencies)
- Imports of framework-specific classes in domain code (`import java.sql.*`, `import org.springframework.*`)
- Static method calls on utilities that should be injected (`Logger.getInstance()`, `Clock.systemUTC()`)
- Hard-coded file paths, URLs, credentials

### Three Injection Styles

```java
// Constructor injection (preferred — immutable, testable)
public class Service {
    private final Repo repo;
    public Service(Repo repo) { this.repo = repo; }
}

// Setter injection (for optional deps, or cyclic needs)
public void setRepo(Repo repo) { this.repo = repo; }

// Field injection (avoid — hides dependencies, needs reflection)
@Inject private Repo repo;
```

**Recommendation:** Constructor injection. Mark fields `final`.

### Inject Clock, Not `System.currentTimeMillis()`

```java
public class TicketService {
    private final Clock clock;   // java.time.Clock

    public TicketService(TicketRepository repo, Clock clock) {
        this.repo = repo;
        this.clock = clock;
    }

    public Ticket createTicket(Vehicle v, ParkingSpot s) {
        LocalDateTime now = LocalDateTime.now(clock);   // testable
        // ...
    }
}
```

In tests: `Clock.fixed(Instant.parse("2026-01-01T10:00:00Z"), ZoneOffset.UTC)`.

### In LLD Problems

- **Parking Lot:** Inject `PricingStrategy`, `TicketRepository`, `Clock` into `ParkingLot` — don't `new` them inside.
- **ATM:** Inject `BankService` (interface) — swap real bank for a mock in tests.
- **Logger:** Inject `List<LogAppender>` — add a new appender without modifying `Logger`.

---

## 🔗 How the Five Principles Work Together

SOLID isn't five independent rules; they reinforce each other.

| Scenario | Which Principles Apply |
|---|---|
| Extract pricing logic into a class | SRP + OCP |
| Make `PaymentProcessor` an interface | DIP + ISP |
| Split `Vehicle` into `Vehicle` + `Fuelable` + `Chargeable` | ISP + LSP |
| Inject `Clock` for testable time | DIP |
| Add new vehicle type without editing existing code | OCP |
| Make `Worker` interface minimal | ISP |
| Ensure `Truck extends Vehicle` honors base contract | LSP |
| Split `Invoice` from `InvoiceRepository` | SRP + DIP |

---

## 🧠 Applying SOLID in LLD Interviews

### In Step 3 (Relationships & Interfaces)

- **SRP:** Each class has one reason to change — split orchestration from logic
- **ISP:** Prefer small, focused interfaces
- **DIP:** Depend on abstractions; inject dependencies

### In Step 4 (Design Patterns)

- **OCP:** Patterns like Strategy, Factory, Observer are OCP in action
- **LSP:** Verify subclass contracts before using inheritance
- **DIP:** Strategy/Observer interfaces = abstractions both sides depend on

### In Step 5 (Code Skeleton)

- **DIP:** Constructor injection, `final` fields
- **SRP:** Split classes by responsibility
- **ISP:** Small interfaces

---

## ⚠️ Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---|---|---|
| Applying SOLID to every class | Over-engineering | Only where variation is expected |
| Extract interface for one implementation | Premature abstraction | Add interface when second impl arrives |
| Split every class into 5 | Fragmentation | Cohesive group of methods stays together |
| Inheritance for code reuse | Violates LSP frequently | Prefer composition |
| `new` inside business logic | Violates DIP | Inject dependencies |
| Fat interfaces with `throw new Unsupported` | Violates ISP | Split interfaces |
| Returning `null` for missing values | Boilerplate guards | Return `Optional<T>` |

---

## 📌 Quick Reference Card

```
S — One reason to change      → Split orchestration from logic
O — Extend without modifying  → Strategy, Factory, Observer
L — Substitutable subtypes    → Verify contracts before extends
I — Small interfaces          → Split fat interfaces by client need
D — Depend on abstractions    → Constructor injection; inject Clock, Repo, Strategy
```

---

## 🔗 Related Sections

- [How to Approach LLD](how-to-approach-lld.md) — the 6-step framework (SOLID applies in steps 3-5)
- [Design Patterns](design-patterns/index.md) — SOLID in practice
- [UML Basics](uml-basics.md) — how to draw the relationships
- [Concurrency Basics](concurrency-basics.md) — thread safety alongside design

---

## 📌 Key Takeaways

- **SRP** — one class, one reason to change; split orchestration from logic
- **OCP** — add features via new classes, not by editing existing ones
- **LSP** — subclasses must honor base contracts; prefer composition if unsure
- **ISP** — small, focused interfaces; clients shouldn't see unused methods
- **DIP** — depend on abstractions; inject dependencies (constructor injection, `final` fields)
- **SOLID is a guide, not a religion** — apply where variation is expected; avoid over-abstraction
- **Patterns implement SOLID** — Strategy = OCP + DIP; Observer = OCP + DIP; Factory = OCP
- **Testability is a signal** — if a class is hard to test, it's probably violating SOLID