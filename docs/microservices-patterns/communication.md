# Communication

> **Spring context:** Spring Cloud Gateway (API Gateway), OpenFeign (declarative HTTP), Spring Cloud LoadBalancer, Resilience4j (resilience), Spring Cloud Stream (async), `spring-boot-starter-webflux` (reactive), `spring-grpc` / `grpc-spring-boot-starter` (gRPC). Service Mesh (Istio/Linkerd) for transport-level concerns.

## Mental Model

Communication between services is a **contract** over an **unreliable transport**. Every choice is about which failure modes you accept:



- **Sync (request-response):** caller blocks, failure propagates, latency adds up along chains.
- **Async (events/messages):** caller doesn't block, failure is absorbed, eventual consistency.

```d2
direction: right

sync: Synchronous
s1: REST / gRPC / GraphQL
s2: Caller waits
s3: Failure propagates
async: Asynchronous
a1: "Events / Messages (Kafka)"
a2: Caller doesn't wait
a3: Failure absorbed

sync -> async
```

Default: **sync for reads and user-facing queries; async for cross-service state changes.**

## API Gateway

Single entry point for clients. Handles cross-cutting concerns: routing, auth, rate limiting, TLS termination, request/response transformation (minimal!).

```d2
direction: right

client: Clients
web: Web
mobile: Mobile
gw: API Gateway
auth: Auth
route: Routing
rate: Rate Limit
tls: TLS
svc: Services
orders: Orders
payments: Payments
users: Users

web -> auth
mobile -> auth
auth -> route
route -> orders
route -> payments
route -> users
```

Rules:
- **No business logic in the gateway.** It's transport, not a service.
- **Auth termination here.** Downstream services trust the gateway's identity headers (or use mTLS).
- **Rate limiting per client/route**, not per service.
- **Versioning strategy** decided at the gateway (URL vs header).

Spring Cloud Gateway (reactive) or Spring Cloud Gateway MVC (servlet). Config-based routing:

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: orders
          uri: lb://orders-service
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=2
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200
```

## Backend for Frontend (BFF)

A dedicated gateway per client type (web, mobile, partner). Each BFF aggregates and shapes responses for its client.

```d2
direction: right

web: Web Client
mobile: Mobile Client
webBff: Web BFF
mobileBff: Mobile BFF
svc: Domain Services
orders: Orders
users: Users
catalog: Catalog

web -> webBff
mobile -> mobileBff
webBff -> orders
webBff -> users
mobileBff -> catalog
mobileBff -> users
```

When to use BFF:
- Clients have very different data shapes/latency needs.
- Mobile needs fewer fields, more aggregation.
- You want independent evolution of client-facing APIs.

Cost: one more service per client type. Don't BFF for one client.

## Service Mesh

Transport-level concerns moved out of the app into a sidecar proxy: mTLS, retries, circuit breaking, tracing, traffic shifting.

| Concern | App-level (Resilience4j) | Mesh-level (Istio) |
|---|---|---|
| Retry | Code config | YAML VirtualService |
| Circuit breaker | Code config | DestinationRule |
| mTLS | App config | Automatic |
| Tracing | Manual instrumentation | Automatic (sidecar) |
| Traffic split | Feature flags / config | VirtualService weights |
| Language support | Per-language | Polyglot |

Rule: **use the mesh for uniform transport concerns, use the app for business-aware resilience.** Don't move business retries into the mesh.

## Sync vs Async: Decision Framework

| Question | Sync | Async |
|---|---|---|
| Caller needs result to proceed? | ✅ | ❌ |
| Latency budget tight? | Maybe | ✅ |
| Failure should propagate? | ✅ | ❌ |
| Fan-out to many consumers? | ❌ | ✅ |
| Cross-service state change? | ❌ | ✅ |
| User-facing query? | ✅ | ❌ |
| Long-running work? | ❌ | ✅ |

Rule: **sync for queries, async for commands that change state across services.**

## gRPC vs REST vs GraphQL

| Aspect | REST | gRPC | GraphQL |
|---|---|---|---|
| Transport | HTTP/1.1 or 2 | HTTP/2 | HTTP/1.1 or 2 |
| Payload | JSON | Protobuf (binary) | JSON |
| Schema | OpenAPI (optional) | .proto (required) | SDL (required) |
| Streaming | SSE, WebSocket (awkward) | Native (4 modes) | Subscriptions |
| Browser support | Native | Via grpc-web | Native |
| Latency | Higher | Lowest | Depends |
| Tooling | Mature | Strong (protoc) | Strong (Apollo) |
| Best for | Public APIs, CRUD | Internal service-to-service, streaming | Client-shaped queries, aggregation |

Rules:
- **REST** for public APIs and simple CRUD.
- **gRPC** for internal, high-throughput, streaming, polyglot.
- **GraphQL** for client-shaped queries and aggregation over multiple services.
- Never pick GraphQL "because it's modern." It moves complexity to the server and caching becomes hard.

## Request-Reply over Async

When you must use async but need a response (see `kafka/patterns.md`):

```d2
direction: right

client: Client
req: Request Topic
svc: Service
reply: Reply Topic

client -> req
req -> svc
svc -> reply
reply -> client
```

Use correlation ID + reply topic. Enforce client-side timeout. Prefer sync if latency budget allows.

## Saga: Choreography vs Orchestration

### Choreography

```d2
direction: right

order: Order Service
pay: Payment Service
stock: Stock Service
ship: Shipping Service

order -> pay
pay -> stock
stock -> ship
ship -> order
```



- Services react to events.
- No central coordinator.
- Hard to see the whole flow.
- Cyclic dependencies emerge.
- Best for 2-3 step flows.

### Orchestration

```d2
direction: right

orch: Orchestrator
pay: Payment
stock: Stock
ship: Shipping

orch -> pay
orch -> stock
orch -> ship
```



- Central orchestrator drives steps.
- Explicit flow, easy timeouts and compensations.
- Orchestrator is a new service to build/operate.
- Best for 4+ step flows with compensation.

Full details in [`data-management.md`](data-management.md).

## Contract Management

Every sync call is a contract. Treat it like one.

| Practice | Why |
|---|---|
| OpenAPI / .proto / GraphQL SDL | Machine-readable contract |
| Schema registry (Avro/Protobuf) for events | Versioned event contracts |
| Consumer-driven contract tests (Pact) | Catch breaking changes before deploy |
| Explicit deprecation windows | Give consumers time |
| Versioning strategy (URL vs header vs media type) | Consistent, documented |
| Backward-compatible changes only by default | Additive, never rename/remove |

Rule: **additive changes are safe; renames and removals are breaking.** Version when you must break.

## Tricky Corners ⚠️

- **Sync chains multiply latency and failure.** A→B→C→D with 99.9% each gives 99.6% end-to-end.
- **Timeouts must be shorter than the caller's timeout.** Otherwise you get cascading stalls.
- **Retries without idempotency = duplicates.** Always pair.
- **Circuit breakers need a fallback**, or they just fail fast.
- **API gateway ≠ service mesh.** Gateway is north-south; mesh is east-west.
- **BFF is not a general-purpose gateway.** One per client type.
- **gRPC over public internet is awkward** (browser support, proxies). Use grpc-web or REST.
- **GraphQL caching is hard.** N+1 queries and per-field caching require DataLoader and careful design.
- **Service mesh retries can amplify load** during incidents. Cap retries and use timeouts.
- **Async is not free.** You trade latency and coupling for eventual consistency and complexity.

## Common Pitfalls

- No timeouts on HTTP clients (default = infinite in many stacks).
- Retries on non-idempotent operations.
- Chatty services — one user action triggers 20 sync calls.
- Business logic in the API gateway.
- One BFF for all clients (defeats the purpose).
- Service mesh without understanding its retries and timeouts (double retries).
- GraphQL adopted for REST-shaped use cases.
- No contract tests, discovering breaking changes in prod.
- Sync chains 4+ deep with no async decoupling.

## Key Interview Tips

- Lead with **"sync for reads, async for state changes."**
- For "how do services talk?", answer with the decision table and name the trade-offs.
- For "how do you handle failure in a chain?", answer **"timeouts shorter than caller's, retries with idempotency, circuit breakers with fallbacks."**
- For "API gateway vs service mesh?", answer **"north-south vs east-west; gateway for clients, mesh for service-to-service transport."**
- For "gRPC vs REST?", answer **"gRPC for internal high-throughput/streaming, REST for public/simple, GraphQL for client-shaped aggregation."**
- For "how do you version APIs?", answer **"additive by default, version on breaking changes, contract tests + deprecation windows."**
- Always name one anti-pattern (chatty services, distributed monolith, god gateway).

## Related

- [Microservices Patterns index](index.md)
- [Decomposition](decomposition.md)
- [Data Management](data-management.md)
- [Reliability](reliability.md)
- [Security](security.md)
- [Kafka → Patterns](../kafka/patterns.md)