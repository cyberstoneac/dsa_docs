# Decomposition

> **Spring context:** Spring Modulith 1.x lets you enforce module boundaries inside a monolith with `@ApplicationModule` and verify them with `ApplicationModules.of(App.class).verify()`. This is the pragmatic first step before extracting microservices.

## Mental Model

Decomposition is not about making services small. It is about **aligning service boundaries with business boundaries** so that changes to one business capability do not ripple across services.

Two complementary lenses:



- **Business capability** — what the business does (Orders, Payments, Inventory, Shipping).
- **DDD bounded context** — where a domain model has a single, unambiguous meaning (in Orders, "customer" means buyer; in Shipping, "customer" means recipient).

A service should own **one bounded context**, expose a **stable API**, and hide its internal model.

```d2
direction: right

biz: Business Capabilities
orders: Orders
payments: Payments
inventory: Inventory
shipping: Shipping
ctx: Bounded Contexts
o: "Order Context\\n(\"order\" = purchase)"
p: "Payment Context\\n(\"payment\" = charge)"
i: "Inventory Context\\n(\"stock\" = availability)"
s: "Shipping Context\\n(\"shipment\" = delivery)"

orders -> o
payments -> p
inventory -> i
shipping -> s
```

Rule of thumb: **if two capabilities share a noun but mean different things, they are different bounded contexts and different services.**

## Decompose by Business Capability

Start from the org chart of *what the business does*, not *how the code is structured*.

| Capability | Service | Owns |
|---|---|---|
| Order capture | Order Service | Order lifecycle, order state |
| Payment | Payment Service | Charges, refunds, payment methods |
| Inventory | Inventory Service | Stock levels, reservations |
| Shipping | Shipping Service | Shipments, carriers, tracking |
| Notification | Notification Service | Email, SMS, push |

Anti-pattern: technical layers (`user-service`, `order-service`, `notification-service`) that all touch the same data.

## DDD Building Blocks

| Concept | Meaning | Service-level meaning |
|---|---|---|
| Ubiquitous Language | Shared vocabulary within a context | Service API uses domain terms |
| Bounded Context | Boundary where a model is consistent | Service boundary |
| Aggregate | Cluster of entities with one root | Transactional consistency unit |
| Aggregate Root | The only entry point to the aggregate | The entity that owns invariants |
| Domain Event | Something meaningful happened | Published to Kafka |
| Repository | Persistence abstraction for aggregates | Owned by the service |

### Aggregates: the transactional boundary

An aggregate is the **unit of consistency**. One transaction modifies one aggregate. Cross-aggregate consistency is eventual (via events).

```d2
direction: right

order: Order Aggregate
root: "Order (root)"
items: OrderItems
addr: ShippingAddress
payment: Payment Aggregate
proot: "Payment (root)"
txns: Transactions

root -> items
root -> addr
proot -> txns
root -> proot
```

**Rule:** reference other aggregates by ID, not by object. This is what lets you split them into separate services later.

### Bounded Context vs Aggregate

| Bounded Context | Aggregate |
|---|---|
| Service-sized boundary | Transaction-sized boundary |
| One per service | Many per service |
| Defines meaning of terms | Defines consistency invariants |
| Enforced by team ownership | Enforced by transaction scope |

## Strangler Fig

Incrementally replace a legacy system by routing traffic to new services while the old system still serves the rest.

```d2
direction: right

client: Client
proxy: "Routing Layer\\n(gateway / facade)"
legacy: Legacy System
new: New Services

client -> proxy
proxy -> legacy
proxy -> new
```

Phases:
1. **Facade** — put a routing layer in front of the legacy system. No behavior change.
2. **Extract** — carve out one capability at a time into a new service. Route its traffic.
3. **Retire** — when the legacy path has no traffic, delete it.

Rules:
- One capability at a time. No big bang.
- The facade must be able to route per-request, not per-deployment.
- Data migration is the hard part — see `data-management.md` and `architecture/evolution-and-migration.md`.
- Measure progress by **traffic migrated**, not services created.

## Sidecar

Attach a helper container/process to the main service for cross-cutting concerns (proxy, logging, metrics, mTLS).

```d2
direction: right

pod: Pod
app: App Container
side: "Sidecar\\n(Envoy / proxy / agent)"

app -> side
```

Spring angle: Service Mesh (Istio, Linkerd) injects a sidecar proxy. The app doesn't know about mTLS, retries, or tracing — the sidecar handles them.

Trade-offs:
- Pro: language-agnostic, uniform across services.
- Con: extra hop, extra resource, extra thing to operate.
- When NOT to use: small service counts, no polyglot, no mesh team.

## Modular Monolith First

Before extracting services, try Spring Modulith:

```java
@SpringBootApplication
public class App { public static void main(String[] a) { SpringApplication.run(App.class, a); } }

// module: orders
@ApplicationModule(displayName = "Orders")
package com.example.orders;

// module: payments
@ApplicationModule(displayName = "Payments")
package com.example.payments;
```

```java
// Verify module boundaries at build time
ApplicationModules.of(App.class).verify();
```

Rules:
- One package per bounded context.
- Cross-module calls only via published interfaces or events.
- No shared entities.
- No cyclic dependencies between modules.

When a module needs to be scaled or deployed independently, extract it into a service. The boundary already exists in code.

## Choosing Service Boundaries: Checklist

| Question | Yes → | No → |
|---|---|---|
| Different deploy cadence from neighbors? | Separate service | Keep together |
| Different scaling profile? | Separate service | Keep together |
| Different data store needs? | Separate service | Keep together |
| Different team ownership? | Separate service | Keep together |
| Different failure tolerance? | Separate service | Keep together |
| Same ubiquitous language? | Keep together | Separate service |
| Same aggregate transaction? | Keep together | Separate service |
| Same bounded context? | Keep together | Separate service |

**Rule:** separate when the forces above diverge; keep together when they align.

## Common Decomposition Mistakes

| Mistake | Why it hurts |
|---|---|
| Technical layers as services | Every change touches every service |
| Entity services (`user-service`) | Shared DB, chatty, distributed monolith |
| Nanoservices | Network overhead > business value |
| Splitting before domain clarity | Reorg every quarter |
| Shared database | Coupling through schema |
| Reusing entities across services | Implicit coupling, breaks bounded contexts |
| Big-bang rewrite | Never ships |

## Tricky Corners ⚠️

- **A service is not a class.** If it doesn't have its own data and lifecycle, it's a library.
- **Aggregates define transaction boundaries.** One transaction, one aggregate.
- **Bounded contexts are not modules.** A module inside a monolith is a candidate context, not a service.
- **Conway's Law is a design tool, not a bug.** Align services to teams or reorganize teams to services — pick one.
- **Shared libraries are coupling.** Cross-cutting only (logging, metrics); never domain logic.
- **Strangler Fig is about traffic routing, not code copying.** Don't fork the legacy code.
- **Sidecar solves transport, not semantics.** You still need app-level retries and timeouts.
- **"Microservice" without independent deployability is a distributed monolith.**

## Common Pitfalls

- Splitting by noun instead of capability.
- Building services around the current org chart without validating bounded contexts.
- Extracting a service but keeping the shared DB "for now."
- Reusing DTOs/entities across service boundaries.
- Ignoring data migration in the strangler plan.
- Skipping the facade step and rewriting directly.
- Choosing a service mesh before you have enough services to justify it.

## Key Interview Tips

- Lead with **"boundaries follow business capabilities and bounded contexts, not technical layers."**
- For "how do you decide?", walk the checklist: deploy cadence, scaling, data, team, failure tolerance.
- For "how do you get there?", answer **"Strangler Fig, one capability at a time, measured by traffic migrated."**
- For "what about consistency?", answer **"aggregates define transaction boundaries; cross-aggregate consistency is eventual."**
- For "monolith or microservices?", answer **"modular monolith first, extract when a force demands it."**
- Mention **Spring Modulith** as the pragmatic intermediate step.

## Related

- [Microservices Patterns index](index.md)
- [Communication](communication.md)
- [Data Management](data-management.md)
- [Architecture → Evolution & Migration](../architecture/evolution-and-migration.md)
- [Architecture → Trade-off Analysis](../architecture/trade-off-analysis.md)