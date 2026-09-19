# Low-Level Design (LLD)

Master object-oriented design, SOLID principles, design patterns, and machine coding rounds. **30 carefully chosen problems** from Parking Lot to Thread-Safe LRU Cache, plus a complete framework for approaching any LLD interview.

Whether you're preparing for machine coding rounds, LLD interviews, or just want to write cleaner object-oriented code, this guide gives you the tools, patterns, and worked examples.

[🚀 How to Approach LLD](how-to-approach-lld.md){ .md-button .md-button--primary }
[🧩 Design Patterns](design-patterns/index.md){ .md-button }
[📐 UML Basics](uml-basics.md){ .md-button }

---

## 📖 How This Section Is Organized

### 1. Fundamentals

| Topic | What You'll Learn |
|---|---|
| [How to Approach LLD](how-to-approach-lld.md) | 6-step framework: clarify, entities, relationships, patterns, code, deep dive |
| [SOLID Principles](solid-principles.md) | SRP, OCP, LSP, ISP, DIP with Java examples and counterexamples |
| [UML Basics](uml-basics.md) | Class diagrams, sequence diagrams, PlantUML notation |
| [Concurrency Basics](concurrency-basics.md) | Threads, locks, Java `java.util.concurrent`, common patterns |

### 2. Design Patterns

| Category | Patterns |
|---|---|
| [Creational](design-patterns/creational.md) | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| [Structural](design-patterns/structural.md) | Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight |
| [Behavioral](design-patterns/behavioral.md) | Strategy, Observer, State, Command, Template Method, Iterator, Chain of Responsibility |

### 3. Problems (30 Total)

Organized into **6 categories**. Each problem follows the same 13-section framework with class diagrams, working Java code, concurrency analysis, and extensibility discussion.

#### 🔹 Category A — Classic OOP / Machine Coding

| # | Problem | Key Patterns |
|---|---|---|
| 01 | [Parking Lot](problems/01-parking-lot.md) | Strategy, Factory, Singleton |
| 02 | [Vending Machine](problems/02-vending-machine.md) | State, Strategy, Singleton |
| 03 | [ATM](problems/03-atm.md) | State, Chain of Responsibility |
| 04 | [Elevator System](problems/04-elevator-system.md) | Strategy, Observer, State |
| 05 | [Library Management System](problems/05-library-management.md) | Strategy, Observer |
| 06 | [Hotel Management System](problems/06-hotel-management.md) | Strategy, Factory, Observer |

#### 🔹 Category B — Games

| # | Problem | Key Patterns |
|---|---|---|
| 07 | [Snake and Ladder](problems/07-snake-and-ladder.md) | Strategy, Observer |
| 08 | [Tic-Tac-Toe](problems/08-tic-tac-toe.md) | Strategy, State |
| 09 | [Chess](problems/09-chess.md) | Strategy, Command, Factory |
| 10 | [Splitwise](problems/10-splitwise.md) | Strategy, Observer |

#### 🔹 Category C — Booking & Scheduling

| # | Problem | Key Patterns |
|---|---|---|
| 11 | [Movie Ticket Booking](problems/11-movie-ticket-booking.md) | Strategy, State, Observer |
| 12 | [Cab Booking](problems/12-cab-booking.md) | Strategy, Observer, State |
| 13 | [Food Delivery Order Management](problems/13-food-delivery-order.md) | State, Observer, Strategy |
| 14 | [Meeting Scheduler](problems/14-meeting-scheduler.md) | Strategy, Observer |
| 15 | [Airline Reservation](problems/15-airline-reservation.md) | Strategy, State, Observer |

#### 🔹 Category D — Real-World Services

| # | Problem | Key Patterns |
|---|---|---|
| 16 | [Coffee Machine](problems/16-coffee-machine.md) | State, Strategy, Template Method |
| 17 | [Car Rental System](problems/17-car-rental.md) | Strategy, Factory, Observer |
| 18 | [Shopping Cart](problems/18-shopping-cart.md) | Strategy, Observer, Command |
| 19 | [Restaurant Ordering](problems/19-restaurant-ordering.md) | State, Observer, Strategy |
| 20 | [Logging Framework](problems/20-logging-framework.md) | Singleton, Strategy, Chain of Responsibility |
| 21 | [Rate Limiter (LLD)](problems/21-rate-limiter-lld.md) | Strategy, Factory, Singleton |

#### 🔹 Category E — Concurrency / Multithreading

| # | Problem | Key Patterns |
|---|---|---|
| 22 | [Producer-Consumer](problems/22-producer-consumer.md) | Producer-Consumer, BlockingQueue |
| 23 | [Thread-Safe LRU Cache](problems/23-lru-cache.md) | LRU, Read-Write Lock, ConcurrentHashMap |
| 24 | [Thread Pool Executor](problems/24-thread-pool.md) | Worker Pool, BlockingQueue, Future |
| 25 | [Reader-Writer Lock](problems/25-reader-writer-lock.md) | Read-Write Lock, Semaphore |
| 26 | [Dining Philosophers](problems/26-dining-philosophers.md) | Lock ordering, Resource hierarchy |

#### 🔹 Category F — Framework / Infra LLD

| # | Problem | Key Patterns |
|---|---|---|
| 27 | [Cache with Eviction Policies](problems/27-cache-eviction.md) | Strategy, Factory, Singleton |
| 28 | [Message Queue (LLD)](problems/28-message-queue-lld.md) | Producer-Consumer, Observer, Strategy |
| 29 | [URL Shortener (LLD)](problems/29-url-shortener-lld.md) | Strategy, Factory, Repository |
| 30 | [Pub-Sub System (LLD)](problems/30-pub-sub-lld.md) | Observer, Strategy, Factory |

---

## 🎯 The 13-Section Framework

Every LLD problem in this section follows the same structure:

1. **Problem Statement** — clear scope + example flow
2. **Requirements** — functional, non-functional, out of scope
3. **Use Cases** — step-by-step user flows
4. **Core Entities** — nouns → classes
5. **Class Diagram** — PlantUML UML
6. **Design Patterns Used** — with justification
7. **Java Implementation** — working code
8. **Concurrency Considerations** — thread safety
9. **Extensibility** — how to add features
10. **SOLID Principles Applied** — which, how
11. **Common Pitfalls** — what to avoid
12. **Follow-up Questions** — interviewer extensions
13. **Key Takeaways** — summary

---

## 🔑 Shared Pattern Reference

Many LLD problems share the same core structure. Once you've studied one, the rest are variations.

| Base Pattern | LLD Problems That Share It |
|---|---|
| State Machine | Vending Machine, ATM, Elevator, Coffee Machine, Order flows |
| Strategy (algorithm swap) | Parking Lot pricing, Rate Limiter, Chess moves, Logger output |
| Observer (pub-sub) | Elevator, Parking Lot, Order notifications, Pub-Sub |
| Factory (create entities) | Parking Lot, Chess pieces, Logger appenders, Cache evictors |
| Singleton (global services) | Parking Lot, Logger, Rate Limiter, Cache Manager |
| Repository (data access) | All booking systems, URL Shortener |
| Producer-Consumer | Message Queue, Thread Pool, Pub-Sub |
| Read-Write Lock | LRU Cache, Reader-Writer Lock, Config Store |

---

## 🎓 Recommended Study Order

If you're preparing for interviews:

1. **Fundamentals first** — How to Approach LLD, SOLID, UML, Concurrency Basics
2. **Patterns** — read all three pattern pages (creational, structural, behavioral)
3. **Category A** (Classic OOP) — 6 problems, ~1 week
4. **Category B** (Games) — 4 problems, ~3 days
5. **Category C** (Booking) — 5 problems, ~4 days
6. **Category D** (Real-World) — 6 problems, ~1 week
7. **Category E** (Concurrency) — 5 problems, ~1 week
8. **Category F** (Framework) — 4 problems, ~3 days

**Total:** ~4-5 weeks, 1-2 hours per problem.

**Interview readiness:** After Category C, you should handle most LLD rounds.

---

## 🛠️ Tech Stack Used in This Section

- **PlantUML** for class diagrams, sequence diagrams, state diagrams
- **Java 17** for code examples (records, sealed classes where appropriate)
- **MkDocs Material** for rendering

---

## 📌 Conventions Used

- **Code**: Working, compilable Java 17; imports omitted for brevity
- **Thread safety**: Explicitly discussed for every problem
- **Patterns**: Named using the GoF catalog; justification given when applied
- **Diagrams**: PlantUML with Cerulean theme (consistent with HLD section)
- **Extensibility**: Every design shown how to extend without breaking existing code

---

## 🚀 Where to Go Next

- **Practice machine coding** — pick a problem, code it in 90 minutes
- **Study real codebases** — read Java libraries (Guava, Spring, Apache Commons)
- **Combine with HLD** — pair LLD problems with their System Design counterparts:
  - Parking Lot (LLD) → no direct HLD, but relates to Booking Systems
  - Rate Limiter (LLD) → [Rate Limiter (HLD)](../system-design/problems/02-rate-limiter.md)
  - URL Shortener (LLD) → [URL Shortener (HLD)](../system-design/problems/01-url-shortener.md)
  - Pub-Sub (LLD) → [Pub/Sub System (HLD)](../system-design/problems/05-pub-sub-system.md)
  - Message Queue (LLD) → [Distributed Message Queue (HLD)](../system-design/problems/06-distributed-message-queue.md)
  - Cache (LLD) → [Distributed Cache (HLD)](../system-design/problems/07-distributed-cache.md)

---

**Total problems:** 30
**Total categories:** 6
**Estimated study time:** 4-5 weeks
**Best for:** Machine coding rounds, LLD interviews, writing cleaner OOP code