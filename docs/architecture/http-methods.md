# HTTP Methods

> **JDK context:** Java 17+ — Jakarta REST, Spring MVC/WebFlux, `java.net.http.HttpClient`. This file is about HTTP semantics, not framework annotations.

## Mental Model

HTTP methods describe **intent**. Two properties define almost every design decision:

- **Safe** — the method does not change server state. Calling it produces no side effects (except logging, metrics).
- **Idempotent** — calling it N times has the same *effect* on server state as calling it once. The response may differ (e.g. a 201 on first call, 200 on subsequent), but the state is the same.

These two properties are what make caching, retries, and parallel requests safe. Get them wrong and you break the web's core guarantees.

```d2
direction: right

safe: "Safe\n(no state change)"
idempotent: "Idempotent\n(N calls = 1 call)"
neither: "Neither\n(side effects every call)"

safe -> idempotent: "GET, HEAD, OPTIONS"
idempotent -> neither: "PUT, DELETE"
neither -> neither: "POST, PATCH"
```

| Method | Safe | Idempotent | Request body | Typical status codes |
|---|---|---|---|---|
| **GET** | ✅ | ✅ | Should not have one | 200, 304, 404 |
| **HEAD** | ✅ | ✅ | No | 200, 404 |
| **OPTIONS** | ✅ | ✅ | No | 200, 204 |
| **PUT** | ❌ | ✅ | Yes (full representation) | 200, 201, 204, 409 |
| **PATCH** | ❌ | Not necessarily | Yes (partial) | 200, 204, 400, 409, 422 |
| **DELETE** | ❌ | ✅ | Optional | 200, 202, 204, 404 |
| **POST** | ❌ | ❌ (unless idempotency key) | Yes | 200, 201, 202, 400, 409 |

**Key insight:** PUT and DELETE are idempotent — retrying them is safe. POST is not — retrying can create duplicates unless you provide an **idempotency key**.

## GET

Retrieves a representation of a resource.

**Rules**

- No request body. Some clients reject it; intermediaries may drop it.
- Safe and idempotent.
- Cacheable by default (subject to `Cache-Control`, `ETag`, `Last-Modified`).
- Should not have side effects — no "increment view count" as a side effect of GET, no "delete via link".

```http
GET /orders/123 HTTP/1.1
Host: api.example.com
Accept: application/json
If-None-Match: "abc123"

HTTP/1.1 304 Not Modified
ETag: "abc123"
```

**Anti-pattern:** using GET for actions.

```http
# BAD
GET /orders/123/delete
GET /users/42/promote
GET /incrementCounter
```

These break caching, prefetching, and any tool that assumes GET is safe. Use POST/PUT/PATCH/DELETE.

## HEAD

Same as GET but returns only headers. Used for existence checks and content-length discovery.

```http
HEAD /files/report.pdf HTTP/1.1
Host: api.example.com

HTTP/1.1 200 OK
Content-Length: 1048576
Content-Type: application/pdf
ETag: "v7"
```

**Common uses:** verify a resource exists without downloading it, validate a cached copy is still current via `ETag`, ping a large endpoint cheaply.

## OPTIONS

Describes communication options for a target resource. Common uses:

- **CORS preflight.** Browsers send `OPTIONS` before a cross-origin `POST`/`PUT` with custom headers.
- **API discovery.** Return `Allow: GET, POST, PUT` to advertise supported methods.
- **Capability negotiation.**

```http
OPTIONS /orders HTTP/1.1
Host: api.example.com
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type

HTTP/1.1 204 No Content
Allow: GET, POST
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 86400
```

**Note:** CORS preflight is not always required — "simple" requests (GET/HEAD/POST with safe headers) skip it.

## POST

Creates a new resource or performs a non-idempotent action.

**Uses**

- **Create** a subordinate resource: `POST /orders` creates a new order.
- **Non-idempotent action:** `POST /payments` executes a payment.
- **Complex query** where GET's URL length limit or body restriction is a problem: `POST /orders/search`.

**Status codes**

- `201 Created` + `Location: /orders/123` — resource created.
- `200 OK` — success, no new resource.
- `202 Accepted` — accepted for async processing, `Location` points to a status resource.
- `400 Bad Request` — malformed.
- `409 Conflict` — e.g. duplicate key.
- `422 Unprocessable Entity` — well-formed but semantically invalid.

```http
POST /orders HTTP/1.1
Host: api.example.com
Content-Type: application/json
Idempotency-Key: 7a2f8c1e-...

{"customerId":"...","lines":[{"productId":"p-1","quantity":2}]}

HTTP/1.1 201 Created
Location: /orders/ord-42
Content-Type: application/json

{"id":"ord-42","status":"PENDING", ...}
```

**Idempotency key** (Stripe-style): client supplies a unique key; the server returns the same response for retries with the same key. Essential for payments and any POST that must not double-create.

## PUT

Replaces a resource **entirely** at a known URL. Idempotent.

**Rules**

- The client knows the full target URL: `PUT /orders/ord-42`.
- The body is the **complete** new representation.
- Fields omitted from the body are set to their defaults / removed — unlike PATCH.
- Idempotent: two identical PUTs leave the same state.

```http
PUT /orders/ord-42 HTTP/1.1
Content-Type: application/json
If-Match: "v3"

{"customerId":"c-7","lines":[{"productId":"p-1","quantity":3}]}

HTTP/1.1 200 OK
ETag: "v4"
```

**PUT is not always "update"** — it's "put this representation here". If the URL identifies a resource and the body is the new state, PUT is right. If the client doesn't know the URL (server generates the ID), use POST.

**Conditional PUT** — `If-Match: "v3"` with an ETag enables optimistic concurrency. If the current ETag differs, respond `412 Precondition Failed`.

## PATCH

Applies a **partial modification** to a resource.

**Two main formats**

- **JSON Merge Patch** (`application/merge-patch+json`, RFC 7386) — simple; `null` removes a field; recursive merge.
- **JSON Patch** (`application/json-patch+json`, RFC 6902) — a list of operations (`add`, `remove`, `replace`, `move`, `copy`, `test`).

```http
PATCH /orders/ord-42 HTTP/1.1
Content-Type: application/merge-patch+json

{"status":"PAID"}
```

```http
PATCH /orders/ord-42 HTTP/1.1
Content-Type: application/json-patch+json

[
  {"op":"replace","path":"/status","value":"PAID"},
  {"op":"add","path":"/tags/-","value":"priority"}
]
```

**PATCH is not automatically idempotent.** `{"op":"add","path":"/tags/-","value":"x"}` appends each call. `{"op":"replace","path":"/status","value":"PAID"}` is idempotent. Document which patches are safe to retry.

**PATCH vs PUT** — the classic interview question:

| Aspect | PUT | PATCH |
|---|---|---|
| Semantics | Replace entire resource | Partial modification |
| Body | Full representation | Only changed fields (or ops) |
| Idempotent | Yes (by spec) | Depends on patch content |
| Use when | You have the full state | You have only deltas |
| Risk | Lost updates if concurrent editors | Ambiguous semantics if not documented |

**When in doubt, prefer PUT** for internal APIs. PATCH is powerful but easy to get wrong.

## DELETE

Removes a resource.

**Status codes**

- `204 No Content` — deleted, nothing to say.
- `200 OK` — deleted with a body (e.g. `{"deleted":true}`).
- `202 Accepted` — deletion accepted for async processing.
- `404 Not Found` — resource doesn't exist. **Debate:** some APIs return `404`; others return `204` to be idempotent. Both are defensible; document your choice.
- `409 Conflict` — cannot delete due to constraints.

**Idempotent semantics:** DELETE on an already-deleted resource should not fail the second time. `204` on both calls is the cleanest.

**Soft delete vs hard delete** — an implementation detail, not an HTTP one. From the API's perspective, DELETE removes the resource. Whether the row is marked `deleted_at` or dropped is invisible to the consumer.

**Anti-pattern:** body-carrying DELETE. Rarely supported reliably by intermediaries. Use POST `/resources/{id}/delete` if you truly need a body.

## Status Codes

The status code is a **contract**. Get it right.

| Code | Meaning | Common use |
|---|---|---|
| 200 | OK | Success with body |
| 201 | Created | POST/PUT created a resource; include `Location` |
| 202 | Accepted | Async work accepted |
| 204 | No Content | Success, no body |
| 301 / 308 | Moved Permanently | Permanent URL change |
| 302 / 307 | Found / Temporary Redirect | Temporary redirect (307 preserves method) |
| 304 | Not Modified | Conditional GET hit cache |
| 400 | Bad Request | Malformed syntax, invalid params |
| 401 | Unauthorized | Missing or invalid credentials |
| 403 | Forbidden | Authenticated but not permitted |
| 404 | Not Found | Resource doesn't exist |
| 405 | Method Not Allowed | Method not supported on this URL; include `Allow` |
| 406 | Not Acceptable | Cannot produce requested `Accept` type |
| 409 | Conflict | Concurrency / uniqueness conflict |
| 410 | Gone | Resource permanently deleted |
| 412 | Precondition Failed | `If-Match` / `If-Unmodified-Since` failed |
| 415 | Unsupported Media Type | Wrong `Content-Type` |
| 422 | Unprocessable Entity | Semantically invalid (valid syntax) |
| 428 | Precondition Required | Server requires conditional request |
| 429 | Too Many Requests | Rate limited; include `Retry-After` |
| 500 | Internal Server Error | Unhandled server fault |
| 502 | Bad Gateway | Upstream error |
| 503 | Service Unavailable | Temporarily unavailable; include `Retry-After` |
| 504 | Gateway Timeout | Upstream timed out |

**Rules**

- 4xx = client's fault; 5xx = server's fault. Don't return 200 with `{"error": "..."}` — that breaks every client, cache, and metric.
- 401 vs 403: 401 means "authenticate first"; 403 means "you're authenticated but not allowed".
- 404 vs 403 for security: sometimes deliberately return 404 to avoid leaking resource existence.
- 429 with `Retry-After` — cooperate with clients instead of letting them hammer you.

## REST Maturity Model (Richardson)

| Level | Description |
|---|---|
| 0 | One endpoint, RPC over HTTP (`POST /api` with `{"action": "getOrder"}`) |
| 1 | Resources (`/orders/123`) |
| 2 | HTTP verbs + status codes (GET/POST/PUT/DELETE with proper codes) |
| 3 | HATEOAS — hypermedia controls link to next actions |

Most "REST" APIs live at level 2. Level 3 (HATEOAS) is rare in practice — powerful in theory (self-describing, evolvable) but expensive in tooling and consumer implementation.

**Practical guidance:** aim for level 2, treat level 3 as optional and only when a consumer genuinely benefits (e.g. a state machine API where next actions depend on current state).

## Common Mistakes

- **GET with side effects.** `GET /logout`, `GET /orders/delete`, `GET /view?count++`.
- **POST for everything.** Leads to un-cacheable, un-safe-looking APIs and breaks retry semantics.
- **200 OK with an error body.** Clients can't distinguish success from failure via status.
- **PUT used as PATCH.** Missing fields get wiped, or the server silently merges — both wrong.
- **PATCH without documenting idempotency.** Consumers retry and duplicate side effects.
- **No `Location` header on 201.** Consumers can't find the created resource.
- **404 for validation errors.** Should be 400 or 422.
- **500 for client errors.** Should be 4xx; 5xx pages on-call for the wrong reason.
- **DELETE that fails on second call.** Breaks idempotency; retries become errors.
- **Ignoring `If-Match` / `ETag`.** Concurrent updates silently overwrite each other.
- **No `Retry-After` on 429/503.** Clients hammer you.
- **URLs that leak internal structure** (`/db/table/row/42`).

## Tricky Corners ⚠️

- **HTTP method case matters.** Methods are uppercase by convention; some servers are case-sensitive.
- **`OPTIONS *`** (asterisk-form) is valid for server-wide options — rarely supported in frameworks.
- **`TRACE` and `CONNECT`** exist but should generally be disabled in public APIs (XST attacks, proxy misuse).
- **Idempotency of PUT does not mean the response is identical.** `200` first, `204` second is fine.
- **`PATCH` with `Content-Type: application/json`** is ambiguous — always use `application/merge-patch+json` or `application/json-patch+json`.
- **Conditional requests** (`If-None-Match`, `If-Match`) require ETag support on the server; without it, the headers are ignored.
- **CDNs may cache POST** in exotic configurations — don't rely on it.
- **Retries and non-idempotent methods.** HTTP clients should not auto-retry POST without an idempotency key.
- **`PUT` with a client-generated ID** is fine if the server accepts it — but it changes ownership of ID generation.
- **`HEAD` on some frameworks is auto-derived from GET.** Good. On others it's not implemented — verify.

## Key Interview Tips

- **Start with safe vs idempotent.** It's the vocabulary that unlocks every follow-up.
- **PUT vs PATCH** — the classic. State replace-vs-partial clearly.
- **POST is not idempotent** unless you add an idempotency key. Mention retry safety.
- **DELETE idempotency** — second call should still be 204, not 404, for clean retries.
- **Status codes** — 401 vs 403, 404 vs 410, 422 vs 400, 409 for conflicts.
- **Don't return 200 with an error body.** Mention this without prompting.
- **Optimistic concurrency** — ETag + `If-Match` + 412.
- **Rate limiting** — 429 with `Retry-After`.
- **REST maturity** — know levels 0–3; don't oversell HATEOAS.
- **Link to API-first** — HTTP methods are half of the contract; the spec is the other half.

## Related

- [API-First Design](api-first.md)
- [Twelve-Factor App](twelve-factor-app.md)
- [Microservices Communication](../microservices-patterns/communication.md)
- [Security — OWASP & AppSec](../security/owasp-and-appsec.md)