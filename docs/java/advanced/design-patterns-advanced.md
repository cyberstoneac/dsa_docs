# Design Patterns Advanced

> **JDK context:** GoF patterns predate Java. This file covers patterns not
> in [Patterns in Java](../design-patterns-java/patterns-in-java.md) — the
> remaining GoF catalog plus framework-level patterns you'll meet in Spring,
> Hibernate, and microservices.

## Mental Model

Patterns solve one of three problems:

```d2
direction: right

patterns: "Advanced Patterns" {
  style.fill: "#f5f5f5"

  structural: "Compose objects" {
    style.fill: "#bbdefb"
  }
  behavioral: "Manage interaction" {
    style.fill: "#c8e6c9"
  }
  architectural: "Structure systems" {
    style.fill: "#fff9c4"
  }

  abstractFactory: "Abstract Factory" {
    style.fill: "#a5d6a7"
  }
  prototype: "Prototype" {
    style.fill: "#a5d6a7"
  }
  composite: "Composite" {
    style.fill: "#a5d6a7"
  }
  bridge: "Bridge" {
    style.fill: "#a5d6a7"
  }
  flyweight: "Flyweight" {
    style.fill: "#a5d6a7"
  }

  chain: "Chain of Responsibility" {
    style.fill: "#a5d6a7"
  }
  command: "Command" {
    style.fill: "#a5d6a7"
  }
  iterator: "Iterator" {
    style.fill: "#a5d6a7"
  }
  mediator: "Mediator" {
    style.fill: "#a5d6a7"
  }
  memento: "Memento" {
    style.fill: "#a5d6a7"
  }
  state: "State" {
    style.fill: "#a5d6a7"
  }
  visitor: "Visitor" {
    style.fill: "#a5d6a7"
  }

  di: "Dependency Injection" {
    style.fill: "#ffcc80"
  }
  repo: "Repository" {
    style.fill: "#ffcc80"
  }
  service: "Service Layer" {
    style.fill: "#ffcc80"
  }
  dao: "DAO" {
    style.fill: "#ffcc80"
  }
  mvc: "MVC" {
    style.fill: "#ffcc80"
  }
  nullObj: "Null Object" {
    style.fill: "#ffcc80"
  }
  circuitBreaker: "Circuit Breaker" {
    style.fill: "#ffcc80"
  }
  saga: "Saga" {
    style.fill: "#ffcc80"
  }
}
```

**This file covers:**

1. **Remaining GoF patterns** — Abstract Factory, Prototype, Composite,
   Bridge, Flyweight, State, Command, Chain of Responsibility, Mediator,
   Memento, Iterator, Visitor
2. **Framework-level patterns** — DI, Repository, Service Layer, DAO, MVC,
   Null Object, Circuit Breaker, Saga

---

# Part 1 — Remaining GoF Patterns

## Abstract Factory

**Intent:** Create families of related objects without specifying their
concrete classes.

```java
// Abstract products
interface Button { void render(); }
interface Checkbox { void check(); }

// Abstract factory
interface UIFactory {
    Button createButton();
    Checkbox createCheckbox();
}

// Concrete family 1
class WindowsButton implements Button {
    public void render() { System.out.println("Windows button"); }
}
class WindowsCheckbox implements Checkbox {
    public void check() { System.out.println("Windows checkbox"); }
}
class WindowsFactory implements UIFactory {
    public Button createButton() { return new WindowsButton(); }
    public Checkbox createCheckbox() { return new WindowsCheckbox(); }
}

// Concrete family 2
class MacButton implements Button {
    public void render() { System.out.println("Mac button"); }
}
class MacCheckbox implements Checkbox {
    public void check() { System.out.println("Mac checkbox"); }
}
class MacFactory implements UIFactory {
    public Button createButton() { return new MacButton(); }
    public Checkbox createCheckbox() { return new MacCheckbox(); }
}

// Client
class Application {
    private final Button button;
    private final Checkbox checkbox;

    Application(UIFactory factory) {
        this.button = factory.createButton();
        this.checkbox = factory.createCheckbox();
    }

    void render() {
        button.render();
        checkbox.check();
    }
}

// Usage
new Application(new WindowsFactory()).render();
new Application(new MacFactory()).render();
```

**Abstract Factory vs Factory Method:**

| | Factory Method | Abstract Factory |
|---|---|---|
| Creates | One product | A family of products |
| Method | Single factory method | Multiple factory methods |
| Example | `Button createButton()` | `Button createButton() + Checkbox createCheckbox()` |
| When | One varying type | Multiple **related** types that must match |

**Interview line:** *"Factory Method creates one product; Abstract Factory
creates a family of products that are meant to be used together."*

---

## Prototype

**Intent:** Create new objects by cloning existing ones.

```java
public class Sheep implements Cloneable {
    private final String name;
    private final String color;

    public Sheep(String name, String color) {
        this.name = name;
        this.color = color;
    }

    @Override
    public Sheep clone() {
        try {
            return (Sheep) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}

Sheep original = new Sheep("Dolly", "white");
Sheep copy = original.clone();
```

**When to use:**

- Object creation is expensive (DB query, network call, heavy computation)
- You need many variations of a base object
- You want to avoid a factory hierarchy

**Modern Java alternatives:**

- Copy constructors (`new Sheep(original)`)
- Records (immutable by default, `withX` methods for variants)
- Serialization-based deep copy

**`Cloneable` is broken** — see
[Object Copying & Cloning](../io-serialization/object-copying-and-cloning.md).

---

## Composite

**Intent:** Treat individual objects and compositions of objects uniformly.

```java
interface FileSystemItem {
    long size();
    void print(String indent);
}

class File implements FileSystemItem {
    private final String name;
    private final long size;

    File(String name, long size) { this.name = name; this.size = size; }

    @Override public long size() { return size; }

    @Override public void print(String indent) {
        System.out.println(indent + name + " (" + size + " bytes)");
    }
}

class Directory implements FileSystemItem {
    private final String name;
    private final List<FileSystemItem> children = new ArrayList<>();

    Directory(String name) { this.name = name; }

    void add(FileSystemItem item) { children.add(item); }

    @Override
    public long size() {
        return children.stream().mapToLong(FileSystemItem::size).sum();
    }

    @Override
    public void print(String indent) {
        System.out.println(indent + name + "/");
        children.forEach(c -> c.print(indent + "  "));
    }
}

// Usage
Directory root = new Directory("root");
root.add(new File("a.txt", 100));
Directory sub = new Directory("sub");
sub.add(new File("b.txt", 200));
root.add(sub);

System.out.println(root.size());   // 300
root.print("");
```

**Where it appears:**

- File systems (file + directory)
- UI trees (component + container)
- Organizational charts
- Expression trees (arithmetic + operands)

**Key idea:** individual and composite implement the same interface. Client
code treats them uniformly.

---

## Bridge

**Intent:** Decouple an abstraction from its implementation so both can vary
independently.

**Problem without Bridge:** every combination of (shape × renderer) needs its
own class.

```java
// Without Bridge — combinatorial explosion
abstract class Shape { }
class CircleOpenGL extends Shape { }
class CircleDirectX extends Shape { }
class SquareOpenGL extends Shape { }
class SquareDirectX extends Shape { }
// 2 shapes × N renderers = 2N classes
```

**With Bridge:**

```java
// Implementation hierarchy
interface Renderer {
    void renderCircle(double radius);
    void renderSquare(double side);
}

class OpenGLRenderer implements Renderer {
    public void renderCircle(double r) { System.out.println("OpenGL circle: " + r); }
    public void renderSquare(double s) { System.out.println("OpenGL square: " + s); }
}

class DirectXRenderer implements Renderer {
    public void renderCircle(double r) { System.out.println("DirectX circle: " + r); }
    public void renderSquare(double s) { System.out.println("DirectX square: " + s); }
}

// Abstraction hierarchy
abstract class Shape {
    protected final Renderer renderer;
    Shape(Renderer r) { this.renderer = r; }
    abstract void draw();
}

class Circle extends Shape {
    private final double radius;
    Circle(Renderer r, double radius) { super(r); this.radius = radius; }

    @Override void draw() { renderer.renderCircle(radius); }
}

class Square extends Shape {
    private final double side;
    Square(Renderer r, double side) { super(r); this.side = side; }

    @Override void draw() { renderer.renderSquare(side); }
}

// Usage
new Circle(new OpenGLRenderer(), 5).draw();
new Square(new DirectXRenderer(), 4).draw();
// 2 shapes + 2 renderers = 4 classes (not 4)
```

**Where it appears:**

- JDBC (abstraction: `Connection`, implementations: driver-specific)
- Logging frameworks (abstraction: `Logger`, implementations: appenders)
- GUI toolkits (abstraction: widgets, implementations: OS-specific)

**Interview line:** *"Bridge = two parallel hierarchies connected by
composition."*

---

## Flyweight

**Intent:** Share common state across many objects to reduce memory.

Two kinds of state:

- **Intrinsic** — shared, immutable (e.g., character shape for a font)
- **Extrinsic** — per-instance, passed in at use time (e.g., position)

```java
// Flyweight factory — cache of shared intrinsic state
class TreeTypeFactory {
    private static final Map<String, TreeType> cache = new HashMap<>();

    static TreeType get(String name, String color, String texture) {
        String key = name + "|" + color + "|" + texture;
        return cache.computeIfAbsent(key,
                k -> new TreeType(name, color, texture));
    }
}

// Flyweight — intrinsic state
record TreeType(String name, String color, String texture) { }

// Context — holds extrinsic state + reference to flyweight
class Tree {
    private final int x, y;
    private final TreeType type;

    Tree(int x, int y, TreeType type) {
        this.x = x; this.y = y; this.type = type;
    }
}

// Usage — 1 million trees, only a handful of TreeType instances
List<Tree> forest = new ArrayList<>();
for (int i = 0; i < 1_000_000; i++) {
    TreeType type = TreeTypeFactory.get("Oak", "green", "rough");
    forest.add(new Tree(i, i, type));
}
```

**Where it appears:**

- String interning (built into the JVM)
- `Integer.valueOf(-128..127)` cache
- Font rendering (glyph cache)
- Game engines (particle systems)

**Interview line:** *"Flyweight = share immutable intrinsic state across many
objects; externalize varying state."*

**Modern note:** Java's `String` pool is a JVM-level flyweight.

---

## State

**Intent:** An object changes its behavior when its internal state changes —
looks like it changed its class.

```java
interface State {
    void insertCoin(VendingMachine m);
    void selectProduct(VendingMachine m);
    void dispense(VendingMachine m);
}

class IdleState implements State {
    public void insertCoin(VendingMachine m) {
        System.out.println("Coin inserted");
        m.setState(new HasCoinState());
    }
    public void selectProduct(VendingMachine m) {
        System.out.println("Insert a coin first");
    }
    public void dispense(VendingMachine m) {
        System.out.println("Nothing to dispense");
    }
}

class HasCoinState implements State {
    public void insertCoin(VendingMachine m) {
        System.out.println("Coin already inserted");
    }
    public void selectProduct(VendingMachine m) {
        System.out.println("Product selected");
        m.setState(new DispensingState());
    }
    public void dispense(VendingMachine m) {
        System.out.println("Select a product first");
    }
}

class DispensingState implements State {
    public void insertCoin(VendingMachine m) {
        System.out.println("Please wait");
    }
    public void selectProduct(VendingMachine m) {
        System.out.println("Already dispensing");
    }
    public void dispense(VendingMachine m) {
        System.out.println("Dispensing product");
        m.setState(new IdleState());
    }
}

class VendingMachine {
    private State state = new IdleState();

    void setState(State s) { this.state = s; }
    void insertCoin()      { state.insertCoin(this); }
    void selectProduct()   { state.selectProduct(this); }
    void dispense()        { state.dispense(this); }
}
```

**State vs Strategy:**

| | State | Strategy |
|---|---|---|
| Purpose | Behavior changes with internal state | Swap algorithms |
| Transitions | States know each other; transitions happen | Strategies are independent |
| Client awareness | Client doesn't manage the state | Client selects the strategy |
| Typically | Finite state machine | Interchangeable algorithms |

**Where it appears:**

- Workflow engines (order states, ticket states)
- Protocol implementations (TCP states)
- UI components (button states: enabled, disabled, pressed)

---

## Command

**Intent:** Encapsulate a request as an object — allows parameterization,
queuing, logging, and undo.

```java
interface Command {
    void execute();
    void undo();
}

class Light {
    void on()  { System.out.println("Light on"); }
    void off() { System.out.println("Light off"); }
}

class TurnOnCommand implements Command {
    private final Light light;
    TurnOnCommand(Light l) { this.light = l; }

    public void execute() { light.on(); }
    public void undo()    { light.off(); }
}

class TurnOffCommand implements Command {
    private final Light light;
    TurnOffCommand(Light l) { this.light = l; }

    public void execute() { light.off(); }
    public void undo()    { light.on(); }
}

class RemoteControl {
    private final Deque<Command> history = new ArrayDeque<>();

    void press(Command c) {
        c.execute();
        history.push(c);
    }

    void undo() {
        if (!history.isEmpty()) history.pop().undo();
    }
}

// Usage
RemoteControl remote = new RemoteControl();
Light light = new Light();
remote.press(new TurnOnCommand(light));   // Light on
remote.press(new TurnOffCommand(light));  // Light off
remote.undo();                            // Light on
remote.undo();                            // Light off
```

**Where it appears:**

- Undo/redo stacks
- Task queues (each task is a Command)
- Transaction logging
- Macro recording

**Modern Java:** `Runnable` is a Command. `Callable<T>` returns a result.

---

## Chain of Responsibility

**Intent:** Pass a request along a chain until one handler handles it.

```java
abstract class Handler {
    private Handler next;

    Handler setNext(Handler next) {
        this.next = next;
        return next;
    }

    void handle(Request req) {
        if (canHandle(req)) {
            doHandle(req);
        } else if (next != null) {
            next.handle(req);
        } else {
            System.out.println("No handler for: " + req);
        }
    }

    protected abstract boolean canHandle(Request req);
    protected abstract void doHandle(Request req);
}

record Request(String type, String payload) { }

class AuthHandler extends Handler {
    protected boolean canHandle(Request r) { return r.type().equals("auth"); }
    protected void doHandle(Request r) { System.out.println("Handling auth"); }
}

class LogHandler extends Handler {
    protected boolean canHandle(Request r) { return r.type().equals("log"); }
    protected void doHandle(Request r) { System.out.println("Handling log"); }
}

// Usage
Handler chain = new AuthHandler();
chain.setNext(new LogHandler());

chain.handle(new Request("auth", "user"));
chain.handle(new Request("log", "message"));
chain.handle(new Request("unknown", ""));
```

**Where it appears:**

- HTTP filter chains (Servlet, Spring)
- Middleware pipelines (Express, Netty)
- Logging appenders
- Exception handling chains

**Modern Java:** functions compose into a chain via `andThen`:

```java
Function<Request, Boolean> chain = auth.andThen(log).andThen(handler);
```

---

## Iterator

**Intent:** Access elements sequentially without exposing the underlying
structure.

`java.util.Iterator` is the canonical implementation:

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));
Iterator<String> it = list.iterator();

while (it.hasNext()) {
    String s = it.next();
    if (s.equals("b")) it.remove();      // safe removal
}
```

### Custom Iterator

```java
class Range implements Iterable<Integer> {
    private final int start, end;

    Range(int start, int end) { this.start = start; this.end = end; }

    @Override
    public Iterator<Integer> iterator() {
        return new Iterator<>() {
            private int current = start;

            @Override public boolean hasNext() { return current < end; }
            @Override public Integer next() {
                if (!hasNext()) throw new NoSuchElementException();
                return current++;
            }
        };
    }
}

// Usage — works with for-each
for (int n : new Range(1, 5)) {
    System.out.println(n);   // 1, 2, 3, 4
}
```

**Why `Iterable`?** Implementing `Iterable` lets the class work with for-each
and stream API.

```java
StreamSupport.stream(new Range(1, 5).spliterator(), false).forEach(System.out::println);
```

---

## Mediator

**Intent:** Reduce direct communication between many objects by routing
through a central mediator.

**Problem:** In an air traffic control system, every plane talking to every
other plane is O(n²) connections.

**Solution:** All planes talk to the control tower (mediator). O(n) connections.

```java
interface Mediator {
    void notify(Component sender, String event);
}

abstract class Component {
    protected final Mediator mediator;
    Component(Mediator m) { this.mediator = m; }
}

class Button extends Component {
    Button(Mediator m) { super(m); }

    void click() { mediator.notify(this, "click"); }
}

class TextBox extends Component {
    private String text = "";

    TextBox(Mediator m) { super(m); }

    void setText(String t) { text = t; mediator.notify(this, "textChanged"); }
    String getText() { return text; }
}

class DialogMediator implements Mediator {
    Button submit;
    TextBox name;

    void setSubmit(Button b) { this.submit = b; }
    void setName(TextBox t) { this.name = t; }

    @Override
    public void notify(Component sender, String event) {
        if (sender == submit && event.equals("click")) {
            System.out.println("Submitting: " + name.getText());
        } else if (sender == name && event.equals("textChanged")) {
            System.out.println("Text changed: " + name.getText());
        }
    }
}
```

**Where it appears:**

- UI dialog coordination
- Chat room routing
- Event buses
- Air traffic control (classic example)

**Modern Java:** An event bus (`EventBus` in Guava) is a Mediator.

---

## Memento

**Intent:** Capture an object's internal state so it can be restored later —
without exposing internals.

```java
// Memento — immutable snapshot
record Memento(String content, int cursorPosition) { }

// Originator — the object whose state we save
class Editor {
    private String content = "";
    private int cursor = 0;

    void type(String text) {
        content += text;
        cursor += text.length();
    }

    Memento save() {
        return new Memento(content, cursor);
    }

    void restore(Memento m) {
        this.content = m.content();
        this.cursor = m.cursorPosition();
    }

    @Override public String toString() {
        return "content='" + content + "', cursor=" + cursor;
    }
}

// Caretaker — stores mementos, never inspects them
class History {
    private final Deque<Memento> snapshots = new ArrayDeque<>();

    void push(Memento m) { snapshots.push(m); }

    Memento pop() { return snapshots.pop(); }
}

// Usage
Editor editor = new Editor();
History history = new History();

history.push(editor.save());
editor.type("Hello");

history.push(editor.save());
editor.type(" World");

System.out.println(editor);        // content='Hello World', cursor=11

editor.restore(history.pop());
System.out.println(editor);        // content='Hello', cursor=5
```

**Where it appears:**

- Undo/redo (with Command)
- Transaction rollback
- Save games
- Form draft autosave

---

## Visitor

**Intent:** Add operations to a class hierarchy without modifying the classes.

```java
interface Shape {
    <R> R accept(ShapeVisitor<R> visitor);
}

record Circle(double radius) implements Shape {
    @Override public <R> R accept(ShapeVisitor<R> v) { return v.visit(this); }
}

record Square(double side) implements Shape {
    @Override public <R> R accept(ShapeVisitor<R> v) { return v.visit(this); }
}

interface ShapeVisitor<R> {
    R visit(Circle c);
    R visit(Square s);
}

// Visitor 1 — compute area
class AreaVisitor implements ShapeVisitor<Double> {
    @Override public Double visit(Circle c) { return Math.PI * c.radius() * c.radius(); }
    @Override public Double visit(Square s) { return s.side() * s.side(); }
}

// Visitor 2 — render as SVG
class SvgVisitor implements ShapeVisitor<String> {
    @Override public String visit(Circle c) {
        return "<circle r=\"" + c.radius() + "\"/>";
    }
    @Override public String visit(Square s) {
        return "<rect width=\"" + s.side() + "\" height=\"" + s.side() + "\"/>";
    }
}

// Usage
List<Shape> shapes = List.of(new Circle(5), new Square(4));
AreaVisitor areas = new AreaVisitor();
shapes.forEach(s -> System.out.println(s.accept(areas)));
```

**Where it appears:**

- Compilers (AST traversal: type checking, code gen, optimization)
- Document exporters (HTML, PDF, Markdown visitors)
- Static analysis tools

**Modern Java alternatives:** sealed classes + pattern matching switch make
Visitor less necessary:

```java
sealed interface Shape permits Circle, Square { }

double area(Shape s) {
    return switch (s) {
        case Circle c -> Math.PI * c.radius() * c.radius();
        case Square sq -> sq.side() * sq.side();
    };
}
```

**Interview line:** *"Visitor adds operations to a closed type hierarchy.
Sealed interfaces + pattern matching make it largely unnecessary in Java 21."*

---

# Part 2 — Framework-Level Patterns

## Dependency Injection (DI)

**Intent:** Supply an object's dependencies from outside, rather than the
object creating them.

```java
// Without DI — tight coupling
class UserService {
    private final UserRepository repo = new MySqlUserRepository();   // hardcoded
}
```

```java
// With DI — decoupled
class UserService {
    private final UserRepository repo;

    UserService(UserRepository repo) {   // injected
        this.repo = repo;
    }
}
```

**Types of injection:**

| Type | Example | Trade-off |
|---|---|---|
| Constructor | `new UserService(repo)` | Preferred — immutability + testability |
| Setter | `service.setRepo(repo)` | Optional dependencies |
| Field | `@Autowired UserRepository repo` | Framework-managed (Spring) |

**Container responsibilities:**

- Instantiate beans
- Resolve dependency graph
- Manage scope (singleton, prototype, request)
- Manage lifecycle (init, destroy)

**Where it appears:**

- Spring, Guice, CDI, Dagger (compile-time), Micronaut
- Almost every modern Java framework

**Why DI matters:**

- Testability (inject mocks)
- Flexibility (swap implementations)
- Lifecycle management
- Clear dependencies

**Interview line:** *"DI means the object doesn't create its dependencies —
they're supplied. It inverts control: the framework calls you, not the
other way around."*

---

## Repository

**Intent:** Mediate between domain and data mapping layers — provides a
collection-like interface for accessing domain objects.

```java
interface UserRepository {
    Optional<User> findById(long id);
    List<User> findAll();
    User save(User user);
    void delete(long id);
}
```

**Implementation hides:**

- SQL/JPA specifics
- Caching
- Connection management
- Multiple data sources

**Where it appears:** Spring Data JPA, Hibernate-based apps.

**Benefit:** domain code depends on `UserRepository`, not `EntityManager`.

---

## Service Layer

**Intent:** Define an application's boundary with a layer of services that
coordinates business logic.

```java
@Service
public class OrderService {
    private final OrderRepository orders;
    private final PaymentService payments;
    private final InventoryService inventory;

    @Transactional
    public Order placeOrder(OrderRequest req) {
        inventory.reserve(req.items());
        Order order = orders.save(new Order(req));
        payments.charge(order);
        return order;
    }
}
```

**Responsibilities:**

- Transaction boundaries
- Business rules
- Orchestration of repositories
- DTO ↔ domain mapping

**Where it appears:** every layered backend (Spring, Jakarta EE).

---

## Data Access Object (DAO)

**Intent:** Abstract all access to a data source.

```java
interface UserDao {
    User findById(long id);
    void insert(User user);
    void update(User user);
}
```

**DAO vs Repository:**

| | DAO | Repository |
|---|---|---|
| Level | Low-level (per entity) | High-level (aggregate) |
| Interface | Data-centric | Domain-centric |
| Focus | Table operations | Aggregate operations |

Many codebases use them interchangeably. Strictly, repositories sit above
DAOs and deal with aggregates.

---

## Model-View-Controller (MVC)

**Intent:** Separate data (Model), presentation (View), and input handling
(Controller).

```d2
direction: right

user: "User" {
  style.fill: "#e3f2fd"
}
controller: "Controller\n(handles input)" {
  style.fill: "#c8e6c9"
}
model: "Model\n(domain state)" {
  style.fill: "#fff9c4"
}
view: "View\n(rendering)" {
  style.fill: "#ffe0b2"
}

user.controller -> controller: "request"
controller.model -> model: "reads/updates"
model.view -> view: "renders"
view.user -> user: "response"
```

**Where it appears:** Spring MVC, Jakarta Faces, Struts, Play.

**Modern variants:**

- **MVP** (Model-View-Presenter) — passive view
- **MVVM** (Model-View-ViewModel) — data binding
- **MVI** (Model-View-Intent) — unidirectional flow

---

## Null Object

**Intent:** Provide a do-nothing implementation so clients don't need null checks.

```java
interface Logger {
    void log(String message);
}

class ConsoleLogger implements Logger {
    public void log(String msg) { System.out.println(msg); }
}

class NullLogger implements Logger {
    public void log(String msg) { /* intentionally empty */ }
}

// Client doesn't need null checks
class Service {
    private final Logger logger;

    Service(Logger logger) { this.logger = logger; }
    Service() { this(new NullLogger()); }   // default

    void doWork() {
        logger.log("working");   // never NPEs
    }
}
```

**Where it appears:**

- Optional dependencies (logger, metrics)
- Test doubles
- Sentinel values

**Modern alternative:** `Optional` for return values, but Null Object is
better for behavior.

---

## Circuit Breaker

**Intent:** Stop calling a failing service after a threshold, giving it time
to recover. Fails fast instead of piling up requests.

Three states:

- **CLOSED** — calls flow through
- **OPEN** — calls fail immediately
- **HALF_OPEN** — allow a few calls to test recovery

```d2
direction: right

closed: "CLOSED\n(calls pass)" {
  style.fill: "#c8e6c9"
}
open: "OPEN\n(calls fail fast)" {
  style.fill: "#ffcdd2"
}
halfOpen: "HALF_OPEN\n(test recovery)" {
  style.fill: "#fff9c4"
}

closed.open -> open: "failure threshold hit"
open.halfOpen -> halfOpen: "after timeout"
halfOpen.closed -> closed: "probe succeeds"
halfOpen.open -> open: "probe fails"
```

**Where it appears:** Resilience4j, Hystrix (deprecated), Sentinel.

**Why it matters:** cascading failures are the #1 cause of system-wide
outages in microservices.

---

## Saga

**Intent:** Manage distributed transactions across microservices using
compensating actions.

Two styles:

- **Choreography** — services react to events
- **Orchestration** — a central saga orchestrator drives the flow

```text
Order Saga (orchestrated):
  1. Reserve inventory       → rollback: release inventory
  2. Charge payment          → rollback: refund payment
  3. Create shipment         → rollback: cancel shipment
  4. Mark order as confirmed
```

**Where it appears:** any system with distributed transactions (e-commerce
checkout, booking systems, fintech).

**Interview line:** *"A Saga replaces a distributed transaction with a
sequence of local transactions and compensating actions."*

---

# Part 3 — Patterns Decision Table

## Which pattern should I use?

| Problem | Pattern |
|---|---|
| Create one product with varying implementation | Factory Method |
| Create a family of related products | Abstract Factory |
| Create complex objects step by step | Builder |
| Create many similar objects cheaply | Prototype |
| Ensure one instance per classloader | Singleton |
| Add behavior without modifying the class | Decorator |
| Adapt an incompatible interface | Adapter |
| Provide a simplified facade over a subsystem | Facade |
| Control access to an object | Proxy |
| Treat individual and composite uniformly | Composite |
| Vary abstraction and implementation independently | Bridge |
| Share state across many objects | Flyweight |
| Change behavior with internal state | State |
| Encapsulate a request as an object | Command |
| Pass a request along a chain of handlers | Chain of Responsibility |
| Traverse a structure without exposing internals | Iterator |
| Reduce many-to-many communication | Mediator |
| Save/restore state without exposing internals | Memento |
| Add operations to a hierarchy without modifying it | Visitor |
| Interchangeable algorithms | Strategy |
| Notify many subscribers of state changes | Observer |
| Define an algorithm skeleton with hooks | Template Method |

## Which architectural pattern should I use?

| Problem | Pattern |
|---|---|
| Decouple object creation from usage | Dependency Injection |
| Hide persistence details | Repository / DAO |
| Isolate business logic | Service Layer |
| Separate UI from domain | MVC / MVP / MVVM |
| Avoid null checks | Null Object |
| Prevent cascading failures | Circuit Breaker |
| Manage distributed transactions | Saga |
| Migrate legacy system incrementally | Strangler Fig |
| Handle cross-cutting concerns | Interceptor / AOP |
| Route requests by content | Router |

---

## Tricky Corners ⚠️

**Abstract Factory vs Factory Method:** Abstract Factory creates a *family*;
Factory Method creates *one* product. Abstract Factory often uses multiple
Factory Methods internally.

**Prototype in modern Java:** copy constructors and records often replace it.
`Cloneable` is broken — avoid it.

**Composite requires a leaf/container interface** with methods meaningful to
both. Methods that don't apply to leaves are a design smell.

**Bridge is often mistaken for Strategy.** Bridge has *two* hierarchies;
Strategy has *one* varying algorithm.

**Flyweight requires immutability of intrinsic state.** If intrinsic state
can mutate, flyweight breaks.

**State vs Strategy:** State transitions are managed by the states themselves;
strategy is chosen by the client.

**Command is just `Runnable` in modern Java** — use the built-in when possible.

**Chain of Responsibility can be infinite** if handlers don't terminate.
Always have a fallback or default handler.

**Iterator's `remove()` is optional.** Many iterators throw
`UnsupportedOperationException`.

**Visitor requires stable hierarchies.** Adding a new element type breaks all
visitors. Sealed + pattern matching avoids this.

**DI frameworks obscure control flow.** Constructor injection makes
dependencies explicit; field injection hides them.

**Repository vs DAO:** repos work with aggregates (domain), DAOs work with
tables (data). Many teams blur the line.

**Circuit breaker thresholds need tuning.** Too sensitive → frequent false
trips. Too lenient → no protection.

**Saga compensations may fail.** Idempotent rollbacks are essential.

---

## Common Pitfalls

- Using Abstract Factory when a single Factory Method suffices.
- Implementing Prototype with `Cloneable` — use copy constructors.
- Confusing Bridge with Strategy.
- Using Composite with methods that only apply to some nodes.
- Making State transitions client-managed.
- Reimplementing Command when `Runnable` works.
- Forgetting a fallback in Chain of Responsibility.
- Adding new element types to a Visitor hierarchy (breaks all visitors).
- Using field injection for mandatory dependencies.
- Applying Circuit Breaker without monitoring its state transitions.
- Non-idempotent compensating actions in a Saga.

---

## Key Interview Tips

- **Abstract Factory vs Factory Method** — family vs single product.
- **Bridge vs Strategy** — two hierarchies vs one varying algorithm.
- **Composite** — same interface for leaf and container.
- **Flyweight** — intrinsic (shared) vs extrinsic (per-instance) state.
- **State vs Strategy** — who controls transitions.
- **Command** — encapsulate request as object; enables undo/queue/log.
- **Visitor** — add operations to a hierarchy; sealed + patterns reduces need.
- **DI** — invert control; constructor injection is preferred.
- **Repository vs DAO** — aggregate vs table.
- **Circuit Breaker** — CLOSED → OPEN → HALF_OPEN.
- **Saga** — local transactions + compensations.
- **Sealed + pattern matching** replaces Visitor in many cases.

---

## Related

- [Patterns in Java](../design-patterns-java/patterns-in-java.md) — Singleton, Builder, Observer, Strategy, Proxy, Decorator, etc.
- [Immutable Objects](../design-patterns-java/immutable-objects.md) — foundation for many patterns
- [Nested Classes](../fundamentals/nested-classes.md) — anonymous classes for Strategy, Command
- [Records & Enums](../fundamentals/records-and-enums.md) — sealed + records for Visitor replacement
- [Object Copying & Cloning](../io-serialization/object-copying-and-cloning.md) — Prototype's modern alternatives