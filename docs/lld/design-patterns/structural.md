# Structural Patterns

Structural patterns deal with **how classes and objects are composed** to form larger structures. They help you add behavior without subclassing, simplify complex subsystems, control access, and share state efficiently.

In LLD interviews, **Decorator**, **Adapter**, **Facade**, and **Proxy** appear most often. **Composite** is essential for tree-shaped problems. **Bridge** and **Flyweight** are rarer but powerful.

---

## 📐 Why Structural Patterns?

- **Add behavior without subclassing** — Decorator, Proxy
- **Make incompatible interfaces work together** — Adapter
- **Simplify a complex subsystem** — Facade
- **Tree structures with uniform treatment** — Composite
- **Reduce memory footprint** — Flyweight
- **Separate abstraction from implementation** — Bridge

---

## 1. Adapter

**Convert the interface of a class into another interface clients expect.**

### Problem

You have an existing class with the **right behavior** but the **wrong interface**. You can't change the existing class (third-party library, legacy code), and you don't want to rewrite callers.

### ❌ Without Adapter

```java
public class LegacyPaymentGateway {
    public void makePayment(String cardNum, double amt) { /* ... */ }
}

// Client expects
public interface PaymentProcessor {
    Receipt process(Ticket t, Money amount);
}

// Caller forced to know legacy API
public Receipt charge(Ticket t, Money m) {
    legacy.makePayment(t.cardNumber(), m.amount().doubleValue());
    return new Receipt(/* ... */);
}
```

**Problems:** Every caller must know the legacy API. If the gateway changes, every caller changes.

### ✅ With Adapter

```java
public class LegacyPaymentAdapter implements PaymentProcessor {
    private final LegacyPaymentGateway legacy;

    public LegacyPaymentAdapter(LegacyPaymentGateway legacy) {
        this.legacy = legacy;
    }

    @Override
    public Receipt process(Ticket t, Money amount) {
        legacy.makePayment(t.cardNumber(), amount.amount().doubleValue());
        return new Receipt(t.id(), amount, PaymentMethod.CARD, LocalDateTime.now());
    }
}
```

**Usage:**
```java
PaymentProcessor processor = new LegacyPaymentAdapter(new LegacyPaymentGateway());
Receipt r = processor.process(ticket, Money.of(7.0, "USD"));
```

**Benefits:**
- Callers depend on `PaymentProcessor` (our interface)
- Legacy class unchanged
- Swap adapters to support different gateways

### Object Adapter vs Class Adapter

**Object Adapter** (shown above): holds a reference to the adaptee. **Preferred** (composition).

**Class Adapter**: extends the adaptee class. Requires multiple inheritance (not possible in Java for classes). Rare in Java.

### When to Use Adapter

✅ Integrating a **third-party library** with a different API
✅ Migrating from a **legacy** system gradually
✅ Wrapping an **incompatible interface** to fit your design

❌ You control both classes → just change one
❌ No interface mismatch → no adapter needed

### In LLD Problems

- **Payment** — wrap a third-party gateway behind `PaymentProcessor`
- **Logger** — wrap `java.util.logging` behind a unified `Logger` interface
- **Cache** — wrap Redis client behind `Cache` interface
- **Storage** — wrap S3 SDK behind `BlobStore` interface

---

## 2. Decorator

**Attach additional responsibilities to an object dynamically. Wrappers that add behavior.**

### Problem

You want to add optional behavior (logging, caching, encryption, compression) to an object **without subclassing**. Multiple combinations lead to a class explosion.

### ❌ Without Decorator

```java
public class DataSource { void write(String d) {} }
public class LoggingDataSource extends DataSource { ... }
public class EncryptingDataSource extends DataSource { ... }
public class CompressingDataSource extends DataSource { ... }
public class LoggingEncryptingDataSource extends DataSource { ... }        // combination
public class LoggingCompressingDataSource extends DataSource { ... }       // combination
public class EncryptingCompressingDataSource extends DataSource { ... }    // combination
public class LoggingEncryptingCompressingDataSource extends DataSource { } // combination
```

**2^N combinations for N features.**

### ✅ With Decorator

```java
public interface DataSource {
    void write(String data);
    String read();
}

public class FileDataSource implements DataSource {
    public void write(String data) { /* write to file */ }
    public String read() { return "file contents"; }
}

public abstract class DataSourceDecorator implements DataSource {
    protected final DataSource wrapped;
    protected DataSourceDecorator(DataSource wrapped) { this.wrapped = wrapped; }
}

public class LoggingDecorator extends DataSourceDecorator {
    public LoggingDecorator(DataSource d) { super(d); }
    public void write(String data) {
        System.out.println("Writing: " + data);
        wrapped.write(data);
    }
    public String read() {
        String data = wrapped.read();
        System.out.println("Read: " + data);
        return data;
    }
}

public class EncryptingDecorator extends DataSourceDecorator {
    public EncryptingDecorator(DataSource d) { super(d); }
    public void write(String data) { wrapped.write(encrypt(data)); }
    public String read() { return decrypt(wrapped.read()); }
}

public class CompressingDecorator extends DataSourceDecorator {
    public CompressingDecorator(DataSource d) { super(d); }
    public void write(String data) { wrapped.write(compress(data)); }
    public String read() { return decompress(wrapped.read()); }
}
```

**Usage — compose as needed:**
```java
DataSource ds = new LoggingDecorator(
                    new EncryptingDecorator(
                        new CompressingDecorator(
                            new FileDataSource())));

ds.write("hello");
String data = ds.read();
```

**Benefits:**
- **N decorators** instead of 2^N subclasses
- **Runtime composition** — combine as needed
- **Transparent** — client still sees `DataSource`

### Java I/O — The Canonical Example

```java
InputStream in = new BufferedInputStream(
                     new FileInputStream("file.txt"));
```

Every `InputStream` wrapper is a Decorator.

### When to Use Decorator

✅ **Optional behaviors** that can be composed
✅ **Avoid class explosion** from combinations
✅ Add behavior **without modifying** existing class
✅ **Runtime flexibility** in composition

❌ Small fixed set of features → subclass
❌ Behavior affects the **interface** → Adapter

### Decorator vs Inheritance

| Aspect | Inheritance | Decorator |
|---|---|---|
| When decided | Compile time | Runtime |
| Combinations | Class explosion | Compose freely |
| Change interface | Yes | No |
| Transparency | Same type | Same type (via interface) |

### In LLD Problems

- **Logger** — add formatters, filters, appenders
- **Coffee Machine** — add milk, sugar, foam as decorators
- **HTTP Client** — add retries, logging, auth as wrappers
- **Cache** — add metrics, eviction, persistence as decorators

---

## 3. Facade

**Provide a unified interface to a set of interfaces in a subsystem.**

### Problem

A subsystem has many classes with complex interactions. Clients shouldn't have to know all of them.

### ❌ Without Facade

```java
// Client code, painful:
TV tv = new TV();
SoundSystem sound = new SoundSystem();
Projector projector = new Projector();
Lights lights = new Lights();

tv.on();
sound.on();
sound.setVolume(10);
projector.on();
projector.setInput("HDMI");
lights.dim(20);
// ... user wants to "watch a movie"
```

### ✅ With Facade

```java
public class HomeTheaterFacade {
    private final TV tv;
    private final SoundSystem sound;
    private final Projector projector;
    private final Lights lights;

    public HomeTheaterFacade(TV tv, SoundSystem sound, Projector projector, Lights lights) {
        this.tv = tv; this.sound = sound; this.projector = projector; this.lights = lights;
    }

    public void watchMovie() {
        tv.on();
        sound.on();
        sound.setVolume(10);
        projector.on();
        projector.setInput("HDMI");
        lights.dim(20);
    }

    public void endMovie() {
        tv.off();
        sound.off();
        projector.off();
        lights.on();
    }
}
```

**Usage:**
```java
facade.watchMovie();
```

**Benefits:**
- **Simpler API** for common workflows
- **Decouples** clients from subsystem
- **Subsystem still accessible** for advanced use

### When to Use Facade

✅ **Complex subsystem** with many classes
✅ **Common workflows** used repeatedly
✅ **Layered architecture** — expose high-level API
✅ **Migration** — wrap legacy with a cleaner interface

❌ Trivial subsystem → unnecessary indirection
❌ Facade becomes god object → split into multiple facades

### In LLD Problems

- **Parking Lot** — `ParkingService` is a facade over spot allocation, pricing, payment, notification
- **Order** — `OrderService` facade over inventory, payment, shipping
- **Booking** — `BookingService` facade over seats, payment, confirmation

**The facade is often the "Service" class in LLD.**

---

## 4. Proxy

**Provide a surrogate or placeholder for another object to control access.**

### Problem

You want to control access to an object: add caching, lazy init, access control, remote call, logging — without changing the object.

### Types of Proxy

| Type | Purpose |
|---|---|
| **Virtual Proxy** | Lazy initialization (create on first use) |
| **Protection Proxy** | Access control (check permissions) |
| **Remote Proxy** | Local representative of a remote object |
| **Caching Proxy** | Cache results |
| **Logging Proxy** | Log method calls |
| **Smart Reference** | Reference counting, locking |

### Example: Virtual Proxy (Lazy Load)

```java
public interface Image {
    void display();
}

public class RealImage implements Image {
    private final String filename;
    public RealImage(String filename) {
        this.filename = filename;
        loadFromDisk();   // expensive
    }
    private void loadFromDisk() { /* expensive I/O */ }
    public void display() { /* ... */ }
}

public class ImageProxy implements Image {
    private final String filename;
    private RealImage realImage;   // lazy

    public ImageProxy(String filename) { this.filename = filename; }

    @Override
    public void display() {
        if (realImage == null) {
            realImage = new RealImage(filename);   // create on first use
        }
        realImage.display();
    }
}
```

### Example: Protection Proxy

```java
public class AdminProxy implements AdminService {
    private final AdminService real;
    private final User currentUser;

    public AdminProxy(AdminService real, User currentUser) {
        this.real = real;
        this.currentUser = currentUser;
    }

    @Override
    public void deleteUser(String id) {
        if (currentUser.hasRole("ADMIN")) {
            real.deleteUser(id);
        } else {
            throw new SecurityException("Not authorized");
        }
    }
}
```

### Example: Caching Proxy

```java
public class CachedPricingProxy implements PricingStrategy {
    private final PricingStrategy real;
    private final Map<String, Money> cache = new ConcurrentHashMap<>();

    public CachedPricingProxy(PricingStrategy real) { this.real = real; }

    @Override
    public Money calculateFee(Ticket t) {
        return cache.computeIfAbsent(t.id(), id -> real.calculateFee(t));
    }
}
```

### When to Use Proxy

✅ **Lazy initialization** (Virtual Proxy)
✅ **Access control** (Protection Proxy)
✅ **Caching** (Caching Proxy)
✅ **Remote calls** (RPC stubs)
✅ **Cross-cutting concerns** (logging, metrics)

### Decorator vs Proxy vs Adapter

All three wrap an object — **but with different intent:**

| Pattern | Intent | Interface |
|---|---|---|
| **Adapter** | Change interface | Different |
| **Decorator** | Add behavior | Same |
| **Proxy** | Control access | Same |

**Rule of thumb:**
- Adapter = translator
- Decorator = enhancer
- Proxy = gatekeeper

### In LLD Problems

- **Cache** — Caching proxy for slow data sources
- **Auth** — Protection proxy for admin services
- **Image loader** — Virtual proxy for lazy load
- **Remote APIs** — Client stub is a proxy

---

## 5. Composite

**Compose objects into tree structures. Treat individual objects and compositions uniformly.**

### Problem

You have a tree (file system, UI, org chart, menu). Client code shouldn't care whether it's dealing with a leaf or a branch.

### Example: File System

```java
public interface FileSystemNode {
    String name();
    long size();
    void print(String indent);
}

public class File implements FileSystemNode {
    private final String name;
    private final long size;
    public File(String name, long size) { this.name = name; this.size = size; }
    public String name() { return name; }
    public long size() { return size; }
    public void print(String indent) {
        System.out.println(indent + name + " (" + size + " bytes)");
    }
}

public class Directory implements FileSystemNode {
    private final String name;
    private final List<FileSystemNode> children = new ArrayList<>();
    public Directory(String name) { this.name = name; }
    public void add(FileSystemNode child) { children.add(child); }
    public String name() { return name; }
    public long size() {
        return children.stream().mapToLong(FileSystemNode::size).sum();
    }
    public void print(String indent) {
        System.out.println(indent + name + "/");
        children.forEach(c -> c.print(indent + "  "));
    }
}
```

**Usage:**
```java
Directory root = new Directory("root");
root.add(new File("readme.txt", 100));
Directory src = new Directory("src");
src.add(new File("Main.java", 500));
root.add(src);

System.out.println(root.size());   // 600
root.print("");
```

**Uniform treatment:** `root.size()` and `file.size()` work the same way. Client code doesn't branch on type.

### Example: UI Components

```java
public interface UIComponent {
    void render();
}

public class Button implements UIComponent {
    public void render() { /* ... */ }
}

public class Panel implements UIComponent {
    private final List<UIComponent> children = new ArrayList<>();
    public void add(UIComponent c) { children.add(c); }
    public void render() { children.forEach(UIComponent::render); }
}
```

### When to Use Composite

✅ **Tree structures** (files, UI, orgs, menus)
✅ Client code should **treat leaves and branches the same**
✅ **Recursive** operations (size, render, evaluate)

❌ No tree → no composite
❌ Leaf and branch behavior is very different → don't force uniformity

### In LLD Problems

- **File System** — files and directories
- **UI** — panels and widgets
- **Menu** — menu items and submenus
- **Org Chart** — employees and teams
- **Expression Tree** — operands and operators

---

## 6. Bridge

**Decouple an abstraction from its implementation so both can vary independently.**

### Problem

You have two dimensions of variation (e.g., shape × renderer). Inheritance leads to class explosion.

### ❌ Without Bridge

```java
public class CircleOpenGLRenderer { }
public class CircleDirectXRenderer { }
public class SquareOpenGLRenderer { }
public class SquareDirectXRenderer { }
// ... N shapes × M renderers = N*M classes
```

### ✅ With Bridge

```java
public interface Renderer {
    void renderCircle(int x, int y, int radius);
    void renderSquare(int x, int y, int side);
}

public class OpenGLRenderer implements Renderer { /* ... */ }
public class DirectXRenderer implements Renderer { /* ... */ }

public abstract class Shape {
    protected final Renderer renderer;
    protected Shape(Renderer renderer) { this.renderer = renderer; }
    public abstract void draw();
}

public class Circle extends Shape {
    private final int x, y, radius;
    public Circle(Renderer r, int x, int y, int radius) {
        super(r); this.x = x; this.y = y; this.radius = radius;
    }
    public void draw() { renderer.renderCircle(x, y, radius); }
}

public class Square extends Shape {
    private final int x, y, side;
    public Square(Renderer r, int x, int y, int side) {
        super(r); this.x = x; this.y = y; this.side = side;
    }
    public void draw() { renderer.renderSquare(x, y, side); }
}
```

**Now:** N shapes + M renderers = N + M classes. Both dimensions vary independently.

### When to Use Bridge

✅ **Two independent dimensions** of variation
✅ Want to avoid class explosion
✅ Implementation may change at runtime

❌ Only one dimension → don't need it

### In LLD Problems

Rare in LLD interviews. Appears in:
- **Cross-platform UI** (OS × widget)
- **Database abstraction** (DB × query type)
- **Message senders** (channel × provider)

---

## 7. Flyweight

**Share common state to reduce memory footprint. Immutable intrinsic state is shared; extrinsic state is passed in.**

### Problem

You have millions of objects with mostly **identical state**. Creating one instance per object wastes memory.

### ❌ Without Flyweight

```java
// Every character in a document is an object
public class Character {
    private final char c;
    private final String font;      // duplicated
    private final int size;         // duplicated
    private final String color;     // duplicated
    private int position;           // unique per char
}
```

**Memory:** 1M characters × ~100 bytes = 100 MB.

### ✅ With Flyweight

```java
public final class CharStyle {   // shared, immutable
    private final String font;
    private final int size;
    private final String color;

    public CharStyle(String font, int size, String color) { /* ... */ }
    // equals/hashCode for interning
}

public final class CharStyleFactory {
    private static final Map<CharStyle, CharStyle> cache = new ConcurrentHashMap<>();

    public static CharStyle of(String font, int size, String color) {
        CharStyle style = new CharStyle(font, size, color);
        return cache.computeIfAbsent(style, s -> s);
    }
}

public class Character {
    private final char c;
    private final CharStyle style;   // shared
    private int position;             // unique

    public Character(char c, CharStyle style, int position) {
        this.c = c; this.style = style; this.position = position;
    }
}
```

**Memory:** 1M characters × ~40 bytes + a few shared styles = ~40 MB.

### Intrinsic vs Extrinsic State

- **Intrinsic** — shared, stored in flyweight (font, size, color)
- **Extrinsic** — unique, passed in at use time (position)

### When to Use Flyweight

✅ **Millions of similar objects**
✅ Most state is **shareable**
✅ Memory is a constraint

❌ Few objects → don't bother
❌ State isn't shareable → not applicable

### In LLD Problems

Rare in classic LLD, but appears in:
- **Text editors** — character styles
- **Game tiles** — texture/position separation
- **Chess** — piece types (limited; usually not worth it)

---

## 🎯 Choosing a Structural Pattern

| Situation | Pattern |
|---|---|
| Interface mismatch | Adapter |
| Add behavior, avoid subclass explosion | Decorator |
| Simplify a complex subsystem | Facade |
| Control access (lazy, security, caching) | Proxy |
| Tree structure, uniform treatment | Composite |
| Two dimensions of variation | Bridge |
| Millions of similar objects | Flyweight |

---

## ⚠️ Common Pitfalls

| Pattern | Pitfall |
|---|---|
| Adapter | Overusing for interface mismatches you can fix directly |
| Decorator | Order of wrappers matters — document it |
| Decorator | Deep nesting obscures the type; consider a builder |
| Facade | Becoming a god object — split into multiple facades |
| Proxy | Forgetting thread safety in caching proxies |
| Composite | Cycles in the tree — allow only acyclic structures |
| Bridge | Overkill for one dimension |
| Flyweight | Mutable flyweights break sharing |

---

## 🔗 Related Sections

- [Design Patterns Index](index.md) — all categories
- [Creational Patterns](creational.md) — Singleton, Factory, Builder
- [Behavioral Patterns](behavioral.md) — Strategy, Observer, State
- [SOLID Principles](../solid-principles.md) — Decorator = OCP; Adapter = DIP
- [UML Basics](../uml-basics.md) — how to diagram structural patterns

---

## 📌 Key Takeaways

- **Adapter** — translate interfaces; wrap legacy or third-party
- **Decorator** — add behavior by wrapping; avoids class explosion
- **Facade** — simplify a subsystem; the "Service" in LLD is often a facade
- **Proxy** — control access (lazy, cache, security, remote)
- **Composite** — trees; uniform treatment of leaves and branches
- **Bridge** — two independent dimensions; N+M not N*M
- **Flyweight** — share intrinsic state; reduce memory for millions of objects
- **Adapter ≠ Decorator ≠ Proxy** — translator ≠ enhancer ≠ gatekeeper
- **Facade is the LLD workhorse** for "Service" classes; **Decorator** is the workhorse for cross-cutting concerns