# Domain-Driven Design (DDD)

> **JDK context:** Java 17+ — records, sealed interfaces, `Optional`, Spring Boot 3 for repository wiring. DDD is a modelling discipline; the examples use Spring only where it clarifies the pattern.

## Mental Model

DDD is the practice of **aligning software models with business reality**. It exists because the hardest part of complex software is not the technology — it is the *language* and the *boundaries* between different parts of the business.

Two levels, often confused:

- **Strategic DDD** — how the whole system is partitioned: bounded contexts, ubiquitous language, context maps. Organization- and architecture-level.
- **Tactical DDD** — how a single bounded context is modelled: entities, value objects, aggregates, domain events, repositories. Class- and package-level.

Get strategic wrong, and no amount of tactical purity saves you. Get strategic right, and you can implement tactical patterns pragmatically.

```d2
direction: down

strategic: "Strategic DDD\nbounded contexts, ubiquitous language"
tactical: "Tactical DDD\nentities, value objects, aggregates, domain events"
infra: "Infrastructure\nrepositories, messaging, persistence"

strategic -> tactical: "each context\nowned separately"
tactical -> infra: "persistence and\nintegration details"
```

## Ubiquitous Language

A **single shared vocabulary** used by domain experts and developers — in conversations, in code, in tests, in docs. Not a glossary bolted on afterwards. The code *is* the language.

**Bad (translation layer between business and code):**

```java
// Business says "Policy". Code says "InsuranceRecord".
class InsuranceRecord {
    private String policyHolderId; // business: "policyholder"
    private BigDecimal coverage;   // business: "sum insured"
}
```

**Good (code speaks the business language):**

```java
public class Policy {
    private PolicyholderId policyholder;
    private Money sumInsured;

    public void increaseCoverage(Money delta) {
        this.sumInsured = this.sumInsured.plus(delta);
    }
}
```

**Rules**

- Same word means the same thing *inside one bounded context*.
- Same word may mean different things in different contexts — that's fine, contexts define meaning.
- If the code has "Manager", "Helper", "Util", "Service" everywhere, it does not have a language.

## Bounded Contexts

A **bounded context** is a boundary inside which one model and one language are consistent. Contexts are **not** the same as microservices — one microservice can host multiple contexts; one context can span multiple services. They are **model boundaries**, not deployment units.

```d2
direction: right

sales: "Sales Context\nCustomer = buyer\nProduct = sellable item"
support: "Support Context\nCustomer = ticket raiser\nProduct = subject of issue"
billing: "Billing Context\nCustomer = payer\nProduct = invoiced line"

sales -> support: "Customer ID shared"
support -> billing: "Account ID shared"
sales -> billing: "Order ID → Invoice"
```

**Discovery questions**

- Where does the business use different words for the same thing? (boundary signal)
- Where does the same word mean different things? (boundary signal)
- Where do different teams own different parts of the process? (boundary signal)
- Where do transaction boundaries not need to be atomic together? (boundary signal)

**Anti-pattern:** a single `Customer` class shared by all services. It becomes a god object with nullable fields nobody understands. Each context models its own `Customer`.

## Context Mapping

Context maps describe how bounded contexts relate. Common patterns:

| Pattern | Meaning | When to use |
|---|---|---|
| **Partnership** | Two contexts evolve together, coordinated | Tight collaboration, shared roadmap |
| **Shared Kernel** | Small shared model, joint ownership | Rare; risky if ownership drifts |
| **Customer / Supplier** | Upstream supplies, downstream consumes, negotiated | Clear producer/consumer |
| **Conformist** | Downstream adopts upstream model as-is | Upstream won't change; cost of translation too high |
| **Anticorruption Layer (ACL)** | Downstream translates upstream into its own model | Legacy or third-party upstream |
| **Open Host Service** | Upstream exposes a stable API for many consumers | Many downstreams |
| **Published Language** | Well-documented interchange format (e.g. Avro, Protobuf, JSON schema) | Cross-team integration |
| **Separate Ways** | No integration — duplicate functionality | Cost of integration > duplication |

The **Anticorruption Layer** is the most impactful: it protects your clean domain model from a legacy or foreign model.

```java
// ACL example — legacy upstream returns "CUST_T" with cryptic fields.
// Your context models Customer cleanly; the translator lives at the boundary.

public class CustomerTranslator {

    public Customer toDomain(LegacyCustomerDto dto) {
        return new Customer(
                new CustomerId(dto.getCustId()),
                new FullName(dto.getFirstNm(), dto.getLastNm()),
                EmailAddress.parse(dto.getEmailAddr())
        );
    }
}
```

## Tactical Building Blocks

### Entity

An object with **identity** that persists over time and across state changes. Two entities are equal if their IDs are equal, even if all other fields differ.

```java
public class Order {
    private final OrderId id;
    private OrderStatus status;
    private List<OrderLine> lines = new ArrayList<>();

    public Order(OrderId id) { this.id = id; this.status = OrderStatus.DRAFT; }

    public void addLine(ProductId product, int qty, Money unitPrice) {
        if (status != OrderStatus.DRAFT) {
            throw new IllegalStateException("Cannot modify a placed order");
        }
        lines.add(new OrderLine(product, qty, unitPrice));
    }

    public Money total() {
        return lines.stream().map(OrderLine::subtotal)
                    .reduce(Money.zero("USD"), Money::plus);
    }

    @Override public boolean equals(Object o) {
        return o instanceof Order other && id.equals(other.id);
    }
    @Override public int hashCode() { return id.hashCode(); }
}
```

### Value Object

An object defined by its **values**, not identity. Immutable. Two value objects with the same values are equal.

```java
public record Money(long cents, String currency) {

    public Money {
        if (cents < 0) throw new IllegalArgumentException("negative money");
        Objects.requireNonNull(currency);
    }

    public static Money of(long cents, String currency) { return new Money(cents, currency); }
    public static Money zero(String currency) { return new Money(0, currency); }

    public Money plus(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException("currency mismatch");
        }
        return new Money(cents + other.cents, currency);
    }
}

// Usage
Money total = Money.of(1000, "USD").plus(Money.of(250, "USD"));
System.out.println(total);
// Expected: Money[cents=1250, currency=USD]
```

**Rule:** prefer value objects over primitives. `Money` beats `long`. `EmailAddress` beats `String`. `DateRange` beats two `Instant`s.

### Aggregate

A **cluster of entities and value objects with one root** — the aggregate root. All access from outside goes through the root. The aggregate is the **transactional consistency boundary**.

```d2
direction: down

order: "Order (root)\nidentity: OrderId"
line1: "OrderLine\n(entity inside)"
line2: "OrderLine\n(entity inside)"
address: "ShippingAddress\n(value object)"

order -> line1: "contains"
order -> line2: "contains"
order -> address: "uses"
```

**Rules**

- One aggregate = one transaction. Don't update two aggregates in one transaction — use domain events and eventual consistency.
- Reference other aggregates **by ID**, not by object reference.
- Keep aggregates small. Large aggregates hurt concurrency and consistency.
- The root enforces all invariants of the aggregate.

```java
// Invariant: an order cannot exceed 100 lines.
public class Order {
    private static final int MAX_LINES = 100;

    public void addLine(ProductId product, int qty, Money price) {
        if (lines.size() >= MAX_LINES) {
            throw new DomainException("Order line limit reached");
        }
        lines.add(new OrderLine(product, qty, price));
    }
}
```

### Domain Event

Something **that happened in the domain** that other parts of the system care about. Past tense. Immutable. Published after the aggregate state change commits.

```java
public sealed interface DomainEvent
        permits OrderPlaced, OrderShipped, PaymentReceived {
    Instant occurredAt();
    OrderId orderId();
}

public record OrderPlaced(OrderId orderId, CustomerId customerId,
                          Money total, Instant occurredAt) implements DomainEvent {}
```

Publishing strategies (see `microservices-patterns/data-management.md` for depth):

- **In-process** — a `DomainEventPublisher` that synchronously or asynchronously hands events to handlers.
- **Outbox pattern** — events written to an outbox table inside the same transaction; a relay publishes them. Reliable across process crashes.
- **Event sourcing** — the events *are* the persistence model.

### Repository

A **collection-like abstraction** for aggregates. Persistence is hidden. One repository per aggregate root.

```java
public interface OrderRepository {
    Optional<Order> findById(OrderId id);
    void save(Order order);
    void delete(OrderId id);
}
```

**Rules**

- One repository per **aggregate root**, not per entity.
- Return domain types, not JPA entities leaking through.
- Never query through a repository for read models — use a separate read path (CQRS-lite). See `microservices-patterns/data-management.md`.
- The repository interface belongs to the **domain**; the implementation belongs to **infrastructure**.

### Domain Service

Stateless operation that doesn't naturally belong to an entity or value object — often involving multiple aggregates.

```java
public class TransferService {

    public void transfer(Account from, Account to, Money amount) {
        from.debit(amount);
        to.credit(amount);
        // Note: this is only safe if both accounts are in the same aggregate,
        // which they usually aren't — see the saga pattern for the real solution.
    }
}
```

**Rule:** reach for a domain service only when the operation spans multiple aggregates or has no natural home. Resist the urge to make "service classes" for everything — that path ends in an anaemic model.

### Anaemic Domain Model (anti-pattern)

Classes with only getters/setters, and all logic in `*Service` classes. It's not OOP — it's procedural code wearing object-shaped clothes. DDD's tactical patterns exist to avoid this.

**Symptom:** your domain classes are pure data carriers; every business rule lives in a `FooService`.

**Fix:** move invariants and behaviour onto the entities and value objects that own the data.

## DDD in Spring Boot

Practical layering:

```d2
direction: down

api: "api\n(controllers, DTOs)"
app: "application\n(use cases, orchestration)"
domain: "domain\n(entities, value objects, aggregates, events, repository interfaces)"
infra: "infrastructure\n(JPA, messaging, external clients)"

api -> app: "commands and queries"
app -> domain: "invoke"
app -> infra: "via interfaces"
infra -> domain: "implements repositories"
```

**Rules**

- **domain/** has no Spring, no JPA, no framework imports. Plain Java.
- **application/** orchestrates. It may use `@Service`, `@Transactional`. It calls domain methods and repositories.
- **infrastructure/** implements repository interfaces and external clients using Spring Data, JPA, Kafka, HTTP.
- **api/** is the transport layer — controllers, DTO mappers. It never leaks domain objects outside.

```java
// application layer — orchestrates, no business logic
@Service
public class PlaceOrderUseCase {

    private final OrderRepository orders;
    private final DomainEventPublisher events;

    public PlaceOrderUseCase(OrderRepository orders, DomainEventPublisher events) {
        this.orders = orders;
        this.events = events;
    }

    @Transactional
    public OrderId handle(PlaceOrderCommand cmd) {
        Order order = new Order(OrderId.next());
        cmd.lines().forEach(l -> order.addLine(l.productId(), l.qty(), l.unitPrice()));
        order.place();
        orders.save(order);
        events.publish(new OrderPlaced(order.id(), cmd.customerId(),
                order.total(), Instant.now()));
        return order.id();
    }
}
```

## When to Use DDD

**Use DDD when**
- The domain is genuinely complex (finance, insurance, logistics, healthcare).
- Domain experts exist and are willing to collaborate.
- The system will live and evolve for years.
- Multiple teams need clear model boundaries.

**Don't use DDD when**
- The system is CRUD over a well-understood schema (most internal tools).
- There is no domain expert to talk to.
- The system is a thin layer over an existing system (integration-only).
- The team has no bandwidth to build the discipline.

**DDD-Lite** — strategic patterns (bounded contexts, ubiquitous language) without full tactical purity — is often the right answer for a small team.

## Tricky Corners ⚠️

- **Bounded context ≠ microservice.** One context can be one module inside a monolith. Don't split services just because you drew context boundaries.
- **Aggregate size.** Large aggregates cause optimistic-locking contention under load. Keep them small; reference other aggregates by ID.
- **Two aggregates in one transaction** is a distributed-transaction problem in disguise. Prefer domain events + saga.
- **Value objects must be immutable.** A mutable value object breaks reference transparency and hides bugs.
- **Domain events are facts, not commands.** Name them in past tense (`OrderPlaced`), not imperative (`PlaceOrder` — that's a command).
- **Repositories are for aggregates, not read queries.** Complex queries belong in a query service with plain SQL/projections.
- **Rich domain model with JPA** can get awkward — lazy-loading, proxies, and equals/hashCode on entities bite. Consider mapping between domain objects and JPA entities, or using Spring Data's support for records carefully.
- **Beware DDD theatre.** If your "aggregates" are JPA entities with getters/setters and your "domain events" are Kafka topics, you have DDD vocabulary without DDD.

## Common Pitfalls

- Applying tactical DDD before strategic DDD — modelling entities before knowing where the boundaries are.
- Ubiquitous language that lives only in a wiki, not in the code.
- One `Customer` shared across contexts — the road to a god object.
- Anaemic domain model — all logic in services.
- Aggregate per table — modelling persistence, not behaviour.
- Ignoring domain events until "later" — retrofitting event flows is painful.
- Using DDD to justify microservices you don't need.
- Treating DDD as a full-time job — it's a lens, not a religion.

## Key Interview Tips

- **Ask first: is the domain complex enough for DDD?** Senior interviewers want to hear when you *wouldn't* use it.
- **Distinguish strategic from tactical** immediately. Most candidates only know the tactical patterns.
- **Bounded context ≠ microservice** — a favourite trap.
- **Aggregate = transactional boundary** — be precise. One aggregate per transaction, other aggregates coordinated by events.
- **Give a concrete example of an anticorruption layer** you've built or would build (legacy or third-party upstream).
- **Mention the anaemic domain model** as the anti-pattern DDD fights against.
- **Map DDD to Spring layering** — domain/application/infrastructure/api — and note the domain layer has no Spring.
- **Link DDD to microservices decomposition** (`microservices-patterns/decomposition.md`) and to event-driven data management (`microservices-patterns/data-management.md`).

## Related

- [API-First Design](api-first.md)
- [Twelve-Factor App](twelve-factor-app.md)
- [Microservices Decomposition](../microservices-patterns/decomposition.md)
- [Microservices Data Management](../microservices-patterns/data-management.md)
- [System Design Depth — Evolution Stories](../system-design-depth/evolution-stories.md)