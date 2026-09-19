# Design Patterns

Design patterns are **named, reusable solutions to recurring design problems**. They're not algorithms — they're templates for structuring classes and objects. In LLD interviews, using the right pattern shows you've seen the problem shape before and can apply a proven solution.

---

## 📐 Why Design Patterns Matter in LLD

- **Shared vocabulary** — "I'll use a Strategy here" says more than 20 lines of explanation
- **Proven solutions** — patterns have been battle-tested for decades
- **Extensibility** — patterns are often OCP in action (add behavior without modifying existing code)
- **Interview signal** — recognizing the right pattern is a strong senior signal

**But:** Patterns are a means, not an end. Applying patterns when they don't fit is worse than not using them at all.

---

## 🗂️ Pattern Categories

The classic GoF (Gang of Four) classification splits patterns into three groups:

### Creational — How objects are created

| Pattern | One-liner |
|---|---|
| **Singleton** | One instance per process |
| **Factory Method** | Subclass decides which class to instantiate |
| **Abstract Factory** | Family of related objects without specifying classes |
| **Builder** | Construct complex objects step by step |
| **Prototype** | Clone existing objects |

### Structural — How objects are composed

| Pattern | One-liner |
|---|---|
| **Adapter** | Convert one interface to another |
| **Decorator** | Add behavior dynamically by wrapping |
| **Facade** | Simplify a complex subsystem with one interface |
| **Proxy** | Stand-in that controls access to a real object |
| **Composite** | Tree structures; treat leaf and branch uniformly |
| **Bridge** | Separate abstraction from implementation |
| **Flyweight** | Share common state to reduce memory |

### Behavioral — How objects interact

| Pattern | One-liner |
|---|---|
| **Strategy** | Encapsulate interchangeable algorithms |
| **Observer** | Notify dependents when state changes |
| **State** | Behavior changes with internal state |
| **Command** | Encapsulate a request as an object |
| **Template Method** | Skeleton algorithm; subclasses fill steps |
| **Iterator** | Sequential access without exposing internals |
| **Chain of Responsibility** | Pass request along a chain of handlers |
| **Mediator** | Centralize complex communications |
| **Memento** | Capture and restore state |
| **Visitor** | Add operations without modifying classes |

---

## 🎯 Which Patterns Matter Most in LLD?

In 90% of LLD interview problems, you'll use 5-6 patterns repeatedly. Master these first:

| Rank | Pattern | Used In |
|---|---|---|
| 1 | **Strategy** | Pricing, moves, algorithms, allocation |
| 2 | **Factory** | Object creation with logic |
| 3 | **Singleton** | Global services (Logger, Registry) |
| 4 | **Observer** | Event notification (order, display) |
| 5 | **State** | Lifecycle (Vending Machine, ATM, Order) |
| 6 | **Command** | Actions as objects (Chess, Undo/Redo) |

Then **Chain of Responsibility**, **Template Method**, **Builder**, **Decorator** appear in specific problems.

Patterns like **Abstract Factory**, **Bridge**, **Flyweight**, **Mediator**, **Memento**, **Visitor** appear less often but are worth knowing.

---

## 🔑 Patterns by LLD Problem

| Problem | Patterns |
|---|---|
| **Parking Lot** | Strategy (pricing, allocation), Factory (vehicle), Observer (display), Singleton (lot registry) |
| **Vending Machine** | State (idle, coin-inserted, dispensing), Strategy (payment), Singleton |
| **ATM** | State, Chain of Responsibility (cash dispensing), Strategy |
| **Elevator** | State (moving/idle), Strategy (scheduling), Observer (display) |
| **Library Management** | Strategy (search), Observer (availability) |
| **Hotel Management** | Strategy (pricing), Factory (room types), Observer |
| **Snake and Ladder** | Strategy (dice, board rules), Observer (events) |
| **Tic-Tac-Toe** | Strategy (win rules), State (game phases) |
| **Chess** | Strategy (piece moves), Command (moves for undo), Factory (piece creation) |
| **Splitwise** | Strategy (split algorithms), Observer (notifications) |
| **Movie Ticket Booking** | State (booking lifecycle), Strategy (pricing), Observer |
| **Cab Booking** | Strategy (matching, pricing), Observer (status), State |
| **Food Delivery** | State (order lifecycle), Observer, Strategy (assignment) |
| **Meeting Scheduler** | Strategy (conflict resolution), Observer |
| **Airline Reservation** | State, Strategy (pricing), Observer |
| **Coffee Machine** | State, Strategy (recipe), Template Method |
| **Car Rental** | Strategy (pricing), Factory (car types), Observer |
| **Shopping Cart** | Strategy (discounts), Observer, Command (undo) |
| **Restaurant Ordering** | State, Observer, Strategy |
| **Logging Framework** | Singleton, Strategy (formatting), Chain of Responsibility (log levels) |
| **Rate Limiter (LLD)** | Strategy (algorithms), Factory, Singleton |
| **Producer-Consumer** | Producer-Consumer (via BlockingQueue) |
| **LRU Cache** | Strategy (eviction), Read-Write Lock |
| **Thread Pool** | Worker Pool, BlockingQueue, Future |
| **Reader-Writer Lock** | Read-Write Lock, Semaphore |
| **Dining Philosophers** | Lock ordering, Semaphore |
| **Cache with Eviction** | Strategy (LRU/LFU/FIFO), Factory, Singleton |
| **Message Queue (LLD)** | Producer-Consumer, Observer, Strategy |
| **URL Shortener (LLD)** | Strategy (encoding), Factory, Repository |
| **Pub-Sub (LLD)** | Observer, Strategy, Factory |

---

## 📚 Pattern Pages in This Section

We've split patterns into three pages matching the GoF classification:

### [Creational Patterns](creational.md)

- **Singleton** — one instance per process, thread-safe init
- **Factory Method** — subclass decides which class to create
- **Abstract Factory** — families of related objects
- **Builder** — construct step by step, immutable result
- **Prototype** — clone existing objects

### [Structural Patterns](structural.md)

- **Adapter** — convert interfaces
- **Decorator** — wrap to add behavior
- **Facade** — simplify a subsystem
- **Proxy** — control access (lazy, security, remote)
- **Composite** — tree structures
- **Bridge** — separate abstraction from implementation
- **Flyweight** — share state

### [Behavioral Patterns](behavioral.md)

- **Strategy** — interchangeable algorithms
- **Observer** — publish-subscribe
- **State** — behavior changes with state
- **Command** — encapsulate requests
- **Template Method** — skeleton algorithm
- **Iterator** — sequential access
- **Chain of Responsibility** — pass along a chain
- **Mediator**, **Memento**, **Visitor** — advanced

---

## 🧠 When to Use a Pattern

Patterns solve **specific recurring problems**. Match the problem to the pattern.

| Problem | Pattern |
|---|---|
| I need one global instance | Singleton |
| I need to hide creation logic | Factory |
| I need to swap algorithms at runtime | Strategy |
| I need to notify multiple observers | Observer |
| I need behavior to change with state | State |
| I need to encapsulate a request | Command |
| I need to build a complex object | Builder |
| I need to add behavior without subclassing | Decorator |
| I need to convert an interface | Adapter |
| I need to traverse a tree uniformly | Composite |
| I need to reduce memory by sharing | Flyweight |
| I need a chain of handlers | Chain of Responsibility |
| I need to simplify a subsystem | Facade |
| I need to control access | Proxy |
| I need to encapsulate a family of products | Abstract Factory |

---

## ⚠️ When NOT to Use a Pattern

Patterns add **indirection** — they make code more abstract and sometimes harder to read. Skip them when:

- **There's only one implementation** and no expectation of another (skip Strategy)
- **Creation is simple** — just use `new` (skip Factory)
- **The state is trivial** — an `if` is fine (skip State)
- **You're notifying one listener** — direct call (skip Observer)
- **The abstraction is artificial** — you're adding an interface for its own sake

**Rule of thumb:** Apply a pattern when you can name the pain it solves. If you can't, don't.

---

## 🎓 Learning Path

If you're new to patterns:

1. **Read the three pattern pages** (creational, structural, behavioral) once
2. **Implement 2-3 patterns in code** each (small examples)
3. **Do LLD problems** — you'll see the patterns emerge naturally
4. **Review** — come back to this section when a problem calls for a pattern

**Don't memorize.** Understand the **shape** of the problem each pattern solves. You'll recognize them in new problems.

---

## 🔗 Related Sections

- [How to Approach LLD](how-to-approach-lld.md) — step 4 is "Apply Design Patterns"
- [SOLID Principles](solid-principles.md) — patterns are SOLID in action
- [UML Basics](uml-basics.md) — how to diagram patterns
- [Concurrency Basics](concurrency-basics.md) — Singleton, Observer have thread-safety concerns

---

## 📌 Key Takeaways

- **Patterns are named solutions** — shared vocabulary, proven approach
- **Three categories** — Creational, Structural, Behavioral
- **Six patterns cover 90%** of LLD: Strategy, Factory, Singleton, Observer, State, Command
- **Apply when the pain is real** — no pattern for its own sake
- **Patterns are SOLID** — Strategy = OCP + DIP; Observer = OCP + DIP; Factory = OCP
- **Patterns appear across LLD problems** — see the pattern table above
- **Read the three pattern pages** to learn specifics, then practice via problems