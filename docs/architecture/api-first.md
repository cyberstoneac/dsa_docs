# API-First Design

> **JDK context:** Java 17+ — OpenAPI 3.1, Spring Boot 3, springdoc-openapi, grpc-java, GraphQL Java. This file is about *process and design*, not library tutorials.

## Mental Model

**API-first** means the API contract is designed and agreed **before** implementation, and is treated as a first-class artefact — versioned, reviewed, and published like code. The spec is the source of truth; code is generated or verified against it.

The opposite — **code-first** — is: write the code, annotate it, generate the spec afterwards. Fast for prototypes, dangerous for platforms.

```d2
direction: right

spec: "Contract\n(OpenAPI / .proto / SDL)"
consumer: "Consumer\n(clients, mobile, partners)"
provider: "Provider\n(Spring Boot service)"
tests: "Contract Tests\n(verify both sides)"

spec -> consumer: "client SDK\ngenerated"
spec -> provider: "server stubs\nor scaffolding"
consumer -> tests: "consumer\nexpectations"
provider -> tests: "provider\nverification"
```

The contract is a **shared artefact**, not one team's private documentation.

## Design-First vs Code-First

| Aspect | Design-First (API-First) | Code-First |
|---|---|---|
| Order of work | Contract → code | Code → contract |
| Source of truth | The spec | The code |
| Consumer feedback | Early, in design review | After first release |
| Breaking changes | Caught in design | Caught in production |
| Tooling | Codegen, validators, mock servers | Framework annotations, doc generators |
| Best for | Public APIs, partner APIs, multi-team platforms | Prototypes, internal tools, quick MVPs |
| Failure mode | Spec drift if codegen isn't enforced | "Docs are always stale" |

**Note:** both approaches can coexist. The key question is: *which artefact is authoritative when they disagree?* API-first says the spec; code-first says the code.

## Why API-First Pays Off

- **Parallel work.** Frontend, mobile, and backend can start together — consumers use a mock server generated from the spec.
- **Design pressure.** APIs are reviewed before anyone writes code. Cheap to change a line in a YAML file; expensive to change a shipped endpoint.
- **Contract tests free of charge.** The spec *is* the contract; tools verify both sides.
- **Consistent client SDKs.** Generate Java, TypeScript, Kotlin, Swift clients from one spec.
- **Documentation that doesn't rot.** Docs are rendered from the spec, not hand-written.

## OpenAPI 3.1

The dominant HTTP API description format. YAML or JSON. Supersedes Swagger 2.0.

```yaml
openapi: 3.1.0
info:
  title: Orders API
  version: 1.0.0
  description: Create and manage customer orders.
servers:
  - url: https://api.example.com/v1
paths:
  /orders:
    post:
      summary: Place a new order
      operationId: placeOrder
      tags: [Orders]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PlaceOrderRequest'
      responses:
        '201':
          description: Order created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Problem'
        '409':
          description: Conflict
    get:
      summary: List orders for a customer
      operationId: listOrders
      parameters:
        - name: customerId
          in: query
          required: true
          schema:
            type: string
            format: uuid
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        '200':
          description: Order list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Order'
components:
  schemas:
    PlaceOrderRequest:
      type: object
      required: [customerId, lines]
      properties:
        customerId:
          type: string
          format: uuid
        lines:
          type: array
          minItems: 1
          items:
            $ref: '#/components/schemas/OrderLine'
    OrderLine:
      type: object
      required: [productId, quantity]
      properties:
        productId:
          type: string
        quantity:
          type: integer
          minimum: 1
    Order:
      type: object
      required: [id, customerId, status, total]
      properties:
        id:
          type: string
          format: uuid
        customerId:
          type: string
          format: uuid
        status:
          type: string
          enum: [PENDING, PAID, SHIPPED, CANCELLED]
        total:
          type: object
          properties:
            cents:
              type: integer
            currency:
              type: string
              pattern: '^[A-Z]{3}$'
    Problem:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
```

**Design rules**

- **Every response has a schema.** No `type: object` with no properties.
- **Errors follow RFC 9457 (Problem Details).** `type`, `title`, `status`, `detail`, `instance`.
- **`operationId` set** — drives method names in generated clients.
- **Explicit `required`** — nullable ≠ optional.
- **`format` for known types** — `uuid`, `date-time`, `email`, `uri`.
- **Pagination is explicit** — cursor or offset, with a documented envelope.
- **Enums, not free-form strings** — where the set is closed.

## Contract-First Workflow

```d2
direction: right

draft: "Draft spec\n(in feature branch)"
review: "Design review\n(consumers + providers)"
publish: "Publish\n(spec repo / registry)"
generate: "Generate\n(client SDK + server stubs)"
implement: "Implement\n(provider)"
verify: "Contract test\n(both sides green)"
release: "Version + release"

draft -> review: "PR"
review -> publish: "approve"
publish -> generate: "CI"
generate -> implement: "scaffold"
implement -> verify: "same spec"
verify -> release: "publish artefact"
```

**Key practices**

- The spec lives in its **own repo** (or a `contracts/` directory with its own CI), not inside the service repo.
- Every change to the spec is a **pull request** reviewed by consumers and providers.
- **Mock server** auto-generated from the spec, so consumers can start before the provider exists.
- **Contract tests** verify both sides agree with the spec at build time (see `microservices-patterns/contract-testing.md`).
- **Versioning** — the spec version and the API version are explicit and tracked together.

## Spec-as-Source-of-Truth

Two directions of generation:

**Spec → server code**

- `openapi-generator` generates Spring `@RestController` interfaces + model classes.
- You implement the interface; you don't redefine endpoints.
- **Pro:** you cannot drift from the spec — the compiler enforces it.
- **Con:** generated code is less idiomatic; upgrades need careful review.

**Spec → client code**

- Generate typed Java/Kotlin/TypeScript/Go clients.
- Consumers get compile-time safety without hand-writing HTTP clients.
- Regenerate on every spec release; publish to your package registry.

**Runtime validation (alternative to codegen)**

- springdoc-openapi generates the spec *from* annotated code. This is technically code-first, with the spec as a generated artefact.
- A **gateway-level validator** (e.g. OpenAPI validator in the ingress) rejects requests that don't match the spec at runtime.

**Recommendation:** use codegen for **client SDKs** always. Use codegen for **server stubs** where the team values strictness over idiomatic control.

## gRPC: .proto as the Contract

For internal, high-performance service-to-service APIs, gRPC with Protocol Buffers is common.

```proto
syntax = "proto3";

package orders.v1;

option java_multiple_files = true;
option java_package = "com.example.orders.v1";

service OrderService {
  rpc PlaceOrder(PlaceOrderRequest) returns (Order);
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc WatchOrders(WatchOrdersRequest) returns (stream Order);
}

message PlaceOrderRequest {
  string customer_id = 1;
  repeated OrderLine lines = 2;
}

message OrderLine {
  string product_id = 1;
  int32 quantity = 2;
}

message Order {
  string id = 1;
  string customer_id = 2;
  OrderStatus status = 3;
  int64 total_cents = 4;
  string currency = 5;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_PAID = 2;
  ORDER_STATUS_SHIPPED = 3;
  ORDER_STATUS_CANCELLED = 4;
}

message GetOrderRequest { string id = 1; }
message WatchOrdersRequest { string customer_id = 1; }
```

**Contract rules for gRPC**

- **Never reuse field numbers.** Deprecate with `reserved` instead.
- **Always define enum 0 as `UNSPECIFIED`.** Proto3 default is 0; without it, unknown values silently default.
- **Add-only evolution.** Remove fields by `reserved`, never by reuse.
- **Package versioning** — `orders.v1`, `orders.v2` in the package name.
- **Buf** for linting and breaking-change detection in CI.

## GraphQL: SDL as the Contract

For consumer-shaped APIs where clients need to select fields.

```graphql
type Query {
  order(id: ID!): Order
  orders(customerId: ID!, first: Int = 20, after: String): OrderConnection!
}

type Mutation {
  placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
}

type Order {
  id: ID!
  customerId: ID!
  status: OrderStatus!
  total: Money!
  lines: [OrderLine!]!
}

type OrderLine {
  productId: ID!
  quantity: Int!
}

type Money {
  cents: Int!
  currency: String!
}

enum OrderStatus { PENDING PAID SHIPPED CANCELLED }

input PlaceOrderInput {
  customerId: ID!
  lines: [OrderLineInput!]!
}

input OrderLineInput {
  productId: ID!
  quantity: Int!
}

type PlaceOrderPayload {
  order: Order
  errors: [UserError!]!
}

type UserError { field: String!, message: String! }

type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
}

type OrderEdge { node: Order!, cursor: String! }

type PageInfo { hasNextPage: Boolean!, endCursor: String }
```

**SDL rules**

- **Nullable by default.** Mark non-null with `!`. Prefer non-null where the field is truly always present.
- **Relay-style pagination** (cursor-based) for lists.
- **Avoid deep nesting** — bounded depth prevents N+1 storms.
- **Mutations return a payload type**, not the entity directly, so errors can travel alongside the result.
- **Schema changes are contracts too** — use Apollo/GraphQL schema checks in CI.

## Versioning

| Style | Example | Notes |
|---|---|---|
| **URI versioning** | `/v1/orders` | Most visible, easiest to route, most common |
| **Header versioning** | `Accept: application/vnd.example.v2+json` | Cleaner URIs, harder to test manually |
| **Query parameter** | `/orders?version=2` | Discouraged, clutters cache keys |
| **Date-based** | `Stripe-Version: 2024-01-01` | Excellent for long-lived partner APIs |
| **No versioning, evolve only** | Additive changes forever | Works if you're disciplined |

**Rules**

- **Additive changes are safe:** new optional fields, new endpoints, new enum values **only if consumers tolerate unknown enum values**.
- **Breaking changes:** removing/renaming fields, changing types, tightening validation, changing semantics.
- **Deprecation:** mark deprecated in the spec, log usage, notify consumers, give a window (6–18 months for external APIs).
- **Sunset header** (RFC 8594) communicates end-of-life.
- **Never break silently.** A 400 response with a migration guide beats a 500 that "used to work".

## Consumer-Driven Contracts

Consumer-driven contract testing flips the direction: consumers declare what they need from the provider, and providers verify they satisfy every consumer. Pact and Spring Cloud Contract are the JVM choices. Full treatment in `microservices-patterns/contract-testing.md`.

## Tricky Corners ⚠️

- **Spec drift** is the number one failure mode of API-first. If codegen isn't enforced in CI, code and spec diverge. Automate the check.
- **`openapi: 3.1` vs `3.0`** — 3.1 aligns with JSON Schema 2020-12; 3.0 has subtle differences. Tooling support varies; check your validators.
- **Nullable in OpenAPI 3.0** uses `nullable: true`; in 3.1 you use JSON Schema `type: [string, "null"]`. Don't mix.
- **`operationId` collisions** break generated clients. Keep them unique across the whole spec.
- **Required ≠ non-nullable.** A field can be required and nullable (must be present, may be null) or optional and non-nullable (absent or a value).
- **Enum evolution:** adding an enum value is breaking for consumers that switch exhaustively. Document forward-compatibility expectations.
- **gRPC field numbers are forever.** Reusing one silently corrupts data. Use `reserved`.
- **GraphQL N+1** — a nested query can trigger thousands of DB calls. Use DataLoader/batching.
- **Pagination defaults** — always cap `limit` server-side, no matter what the client sends.
- **Idempotency** — for POSTs that create resources, accept an idempotency key so retries don't double-create.

## Common Pitfalls

- Hand-writing docs that drift; not generating from the spec.
- Designing the API from the database schema instead of from consumer needs.
- Breaking changes with no deprecation window.
- No mock server → consumers blocked until provider ships.
- No contract tests → spec is aspirational, not enforced.
- Versioning the URI but never actually releasing v2 — dead weight.
- Using `200 OK` with an error body (`{"success": false}`) — a REST anti-pattern.
- Exposing internal database IDs as public identifiers.
- Returning denormalized internals (JPA entities) directly — leaks schema.
- No rate-limit / pagination / error contract → every consumer implements it differently.

## Key Interview Tips

- **Lead with "who is the consumer?"** — public API, partner API, and internal API have different design constraints.
- **Define what "contract" means** — the shape, the semantics, the versioning, and the error model.
- **Name OpenAPI 3.1 by version.** Vague references to "Swagger" signal outdated knowledge.
- **Talk about mock servers and codegen** — the practical payoff of API-first.
- **Explain contract tests as the enforcement mechanism** — spec without tests drifts.
- **Distinguish gRPC vs REST vs GraphQL** by use case, not preference.
- **Deprecation strategy** — mention Sunset header, spec deprecation flags, and a real window.
- **Error contract** — RFC 9457 Problem Details is the modern default.
- **Idempotency keys** for POST — a senior-level detail.

## Related

- [HTTP Methods](http-methods.md)
- [Domain-Driven Design](domain-driven-design.md)
- [Twelve-Factor App](twelve-factor-app.md)
- [Contract Testing](../microservices-patterns/contract-testing.md)
- [Microservices Communication](../microservices-patterns/communication.md)