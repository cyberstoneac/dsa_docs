# Contract Testing

> **Spring context:** Spring Boot 3.x — Pact JVM, Spring Cloud Contract, JUnit 5, Testcontainers. This file covers *strategy and workflow*; framework setup lives in the respective library docs.

## Mental Model

In a microservices architecture, **integration tests that boot both services are slow, brittle, and expensive**. Contract testing solves a narrower problem: *does the consumer's expectation of a provider's API still match what the provider actually offers?*

The contract is a **shared, versioned artefact** describing the requests a consumer will make and the responses it expects. Both sides verify against the same contract — independently.

```d2
direction: right

consumer: "Consumer\n(order-service)"
contract: "Contract\n(pact file)"
provider: "Provider\n(payment-service)"
broker: "Pact Broker\nor registry"

consumer -> contract: "generate from tests"
contract -> broker: "publish"
broker -> provider: "fetch + verify"
provider -> broker: "publish verification"
broker -> consumer: "can-i-deploy?"
```

**What contract testing is not:**
- Not a replacement for integration tests (they catch real infra issues).
- Not a replacement for E2E tests (they catch user-journey issues).
- Not a schema validator (that's OpenAPI/Protobuf validation — complementary).

**What contract testing is:**
- A fast, deterministic way to catch breaking API changes *before* deploy.
- A **consumer-driven** specification of what each consumer actually needs from the provider.

## Consumer-Driven Contracts

The **consumer** declares what it needs; the **provider** verifies it can satisfy every consumer. This is the opposite of provider-driven contracts (where the provider publishes a spec and consumers adapt).

**Why consumer-driven matters:**
- The contract reflects *actual* usage, not aspirational API design.
- Providers know which changes would break which consumers.
- Additive changes can be made safely; breaking changes are detected before merge.

**Terminology**

| Term | Meaning |
|---|---|
| **Consumer** | A service that calls another service's API |
| **Provider** | A service that exposes an API |
| **Pact** | The contract file produced by consumer tests |
| **Interaction** | One request/response pair in a pact |
| **Verification** | The provider replaying the interactions to prove it satisfies them |
| **Pact Broker** | A repository where pacts and verification results are stored |
| **Can-I-Deploy** | A query to the broker: "is this version safe to release?" |

## Pact (JVM)

Pact is the dominant consumer-driven contract testing framework. JVM support is mature.

### Consumer side

The consumer writes a test that:
1. Sets up an **expected interaction** (given state, upon request, will respond).
2. Calls its HTTP client against a mock server.
3. Asserts on the response.
4. Publishes the pact to a broker (in CI).

```java
@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "payment-service", port = "8080")
class PaymentClientContractTest {

    @Pact(consumer = "order-service")
    public V4Pact payOrder(PactBuilder builder) {
        return builder
            .given("a customer with a valid card")
            .uponReceiving("a request to charge an order")
                .path("/payments")
                .method("POST")
                .headers("Content-Type", "application/json")
                .body(new PactDslJsonBody()
                    .stringType("orderId", "ord-123")
                    .numberType("amountCents", 5000)
                    .stringType("currency", "USD"))
            .willRespondWith()
                .status(201)
                .headers("Content-Type", "application/json")
                .body(new PactDslJsonBody()
                    .stringType("paymentId", "pay-456")
                    .stringValue("status", "CAPTURED"))
            .toPact(V4Pact.class);
    }

    @Test
    @PactTestFor(pactMethod = "payOrder")
    void chargesOrder(MockServer mockServer) {
        PaymentClient client = new PaymentClient(mockServer.getUrl());
        PaymentResponse response = client.charge(new ChargeRequest("ord-123", 5000, "USD"));
        assertEquals("CAPTURED", response.status());
        // Expected: CAPTURED
    }
}
```

**Key rules for consumer tests**
- Test only the **shape** you consume — don't assert on fields you don't use.
- Use **matchers**, not literal values, for anything dynamic (IDs, timestamps, money amounts).
- Include **provider states** (`given(...)`) to describe required data.
- **One interaction per concern** — a pact with 40 interactions is hard to maintain.

### Provider side

The provider:
1. Fetches the pacts for its consumers from the broker (or filesystem).
2. For each interaction, sets up the given state, replays the request, and verifies the response matches the contract.

```java
@Provider("payment-service")
@PactBroker(url = "https://pact-broker.internal",
            authentication = @PactBrokerAuth(token = "${PACT_BROKER_TOKEN}"))
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PaymentProviderContractTest {

    @LocalServerPort int port;

    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifyPact(PactVerificationContext context) {
        context.verifyInteraction();
    }

    @BeforeEach
    void before(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", port));
    }

    @State("a customer with a valid card")
    void customerHasValidCard() {
        // seed the DB with the state the consumer expects
        cardRepo.save(new Card("cust-1", "valid", LocalDate.now().plusYears(1)));
    }
}
```

**Key rules for provider tests**
- Every `@State` must be implemented — a missing state is a broken contract.
- Provider states should be *independent* — setup shouldn't rely on ordering.
- Use an isolated test database (Testcontainers) so state setup is deterministic.
- Publish verification results to the broker so consumers know they can deploy.

### Matchers vs literal values

```java
// WRONG — literal values, contract breaks every time the data changes
.stringValue("paymentId", "pay-456")
.numberValue("amountCents", 5000)

// RIGHT — matchers, contract describes shape and constraints
.stringType("paymentId")                 // any non-null string
.integerType("amountCents")              // any integer
.decimalType("amount", 50.0)             // a decimal with 2 digits
.timestamp("createdAt", "yyyy-MM-dd'T'HH:mm:ss'Z'")
.stringMatcher("currency", "USD|EUR|GBP", "USD")  // regex
```

**Rule:** use the loosest matcher that still captures the contract. Over-specifying is the #1 cause of brittle contracts.

## Pact Broker

A service that:
- **Stores** pacts and verification results.
- **Queries** which provider versions satisfy which consumer versions.
- **Enables Can-I-Deploy** — the gate that stops a breaking change from shipping.
- **Visualizes** the consumer-provider graph.
- **Webhooks** — trigger provider builds when a consumer publishes a new pact.

**Open-source options:** `pactfoundation/pact-broker` (Docker), or SaaS (`pactflow.io`).

**Key API calls**

```bash
# Consumer: publish a pact after tests
pact-broker publish ./pacts \
  --consumer-app-version=$(git rev-parse --short HEAD) \
  --branch=main \
  --broker-base-url=https://pact-broker.internal \
  --broker-token=$PACT_BROKER_TOKEN

# Provider: verify against all consumers of this provider
pact-provider-verifier ./pacts \
  --provider-app-version=$(git rev-parse --short HEAD) \
  --provider=papayment-service \
  --pact-broker-base-url=https://pact-broker.internal

# Both sides: can I deploy this version?
pact-broker can-i-deploy \
  --pacticipant=order-service \
  --version=$(git rev-parse --short HEAD) \
  --to-environment=production
```

**Can-I-Deploy** returns non-zero if the version hasn't been verified against all consumers (or providers) currently deployed to the target environment. This is the enforcement mechanism that makes contract testing actually work.

## Pact Flow: End-to-End

```d2
direction: down

consumerTest: "1. Consumer test\n(generate pact)"
publish: "2. Publish pact\nto broker"
webhook: "3. Webhook triggers\nprovider build"
providerTest: "4. Provider verifies\nagainst pact"
verifyPub: "5. Publish\nverification result"
canIDeploy: "6. Can-I-Deploy\ngate on both sides"
deploy: "7. Deploy\n(both sides safe)"

consumerTest -> publish
publish -> webhook
webhook -> providerTest
providerTest -> verifyPub
verifyPub -> canIDeploy
canIDeploy -> deploy
```

**The critical piece:** both consumer and provider CI pipelines call `can-i-deploy` before deploying. That's what turns the contract from documentation into a gate.

## Contract Versioning

| Strategy | How it works | When to use |
|---|---|---|
| **Git SHA as version** | `--consumer-app-version=$(git rev-parse --short HEAD)` | Default — every commit is a version |
| **Semantic version** | `1.4.2` | When you publish artefacts (jars, images) with semver |
| **Branch/tag tracking** | `--branch=main` records the branch | Required for `can-i-deploy --to-environment` |
| **Environment tracking** | Record deployments to environments | Enables `can-i-deploy --to-environment=production` |

**Rules**
- Version every pact with a unique identifier (git SHA is simplest).
- Track **which environments** each version is deployed to — otherwise `can-i-deploy` can't reason about compatibility.
- Publish **both pacts and verification results** with the same versioning scheme.

## When Contract Tests Beat Integration Tests

| Concern | Contract test | Integration test |
|---|---|---|
| API shape compatibility | ✅ Best fit | Also works but slower |
| Real network/infra issues | ❌ Misses | ✅ Catches |
| Consumer-specific expectations | ✅ Explicit | Implicit |
| Speed | Fast (seconds) | Slow (minutes) |
| Flakiness | Very low | Higher |
| Coverage of business logic | ❌ No | Yes |

**Rule of thumb:** contract tests for **API shape**, integration tests for **wiring and infra**, E2E for **critical user journeys**. Each layer has a distinct job.

**Anti-pattern:** replacing integration tests with contract tests and discovering later that your serialization, transactions, and connection pools were broken in prod.

## CI Integration

**Consumer pipeline**

```yaml
- name: Unit tests + contract tests
  run: ./mvnw test
- name: Publish pacts
  if: branch == 'main'
  run: |
    pact-broker publish target/pacts \
      --consumer-app-version=$GIT_SHA \
      --branch=$BRANCH \
      --broker-base-url=$PACT_BROKER_URL \
      --broker-token=$PACT_BROKER_TOKEN
- name: Can I deploy?
  run: |
    pact-broker can-i-deploy \
      --pacticipant=order-service \
      --version=$GIT_SHA \
      --to-environment=production
- name: Deploy
  if: success()
  run: ./deploy.sh
- name: Record deployment
  run: |
    pact-broker record-deployment \
      --pacticipant=order-service \
      --version=$GIT_SHA \
      --environment=production
```

**Provider pipeline**

```yaml
- name: Verify pacts from broker
  run: |
    pact-provider-verifier \
      --provider-app-version=$GIT_SHA \
      --provider=payment-service \
      --pact-broker-base-url=$PACT_BROKER_URL
- name: Can I deploy?
  run: |
    pact-broker can-i-deploy \
      --pacticipant=payment-service \
      --version=$GIT_SHA \
      --to-environment=production
- name: Deploy
  if: success()
  run: ./deploy.sh
- name: Record deployment
  run: |
    pact-broker record-deployment \
      --pacticipant=payment-service \
      --version=$GIT_SHA \
      --environment=production
```

**Webhooks:** configure the broker to trigger the provider build when a consumer publishes a new pact. Without webhooks, verification happens only on the provider's schedule — breaking changes can slip through.

## Spring Cloud Contract (Alternative)

Spring Cloud Contract takes a **provider-driven** approach — the provider writes contract definitions (Groovy DSL or YAML), and the framework generates:
- **Provider-side** tests that verify the provider meets the contract.
- **Consumer-side** stubs (WireMock) that consumers can test against.

```groovy
// Provider-side contract: src/test/resources/contracts/payments/charge.groovy
Contract.make {
    description "charge an order"
    request {
        method POST()
        url "/payments"
        headers { contentType(applicationJson()) }
        body([orderId: "ord-123", amountCents: 5000, currency: "USD"])
    }
    response {
        status CREATED()
        headers { contentType(applicationJson()) }
        body([paymentId: $(anyNonBlankString()), status: "CAPTURED"])
    }
}
```

**When to prefer Spring Cloud Contract**
- Provider team wants to control the contract format.
- You want generated stubs for consumers.
- You don't want a Pact Broker dependency.

**When to prefer Pact**
- Consumer needs drive the contract.
- Multiple consumers with different expectations.
- Cross-language (JVM + Node + Python).

**They are not mutually exclusive.** Some teams use Spring Cloud Contract for provider-side stub generation and Pact for cross-team verification.

## Tricky Corners ⚠️

- **Provider states must be independent.** A state that assumes another state ran will break when Pact runs them in a different order.
- **Over-specified matchers** kill the value of contract testing. Use the loosest matcher that captures the shape.
- **Pact tests are not integration tests.** They use a mock server (consumer side) and an in-process test (provider side). Real network behaviour isn't tested.
- **The mock server doesn't validate your HTTP client's behaviour** — it just serves the expected response. Bugs in retry logic, auth headers, or timeouts slip through.
- **Verification state setup must be deterministic.** Use a fresh database per test run (Testcontainers) or a state-reset endpoint.
- **`can-i-deploy` requires environment tracking.** If you don't record deployments, the broker can't reason about compatibility.
- **Publishing must happen for every consumer version**, not just tagged releases. Git SHA is the simplest versioning.
- **Pact files are language-neutral.** JSON format — JVM, Node, Python, Go all produce compatible pacts.
- **Breaking change in a field the consumer doesn't use** is not a breaking change for that consumer. Consumer-driven contracts are precisely scoped.
- **Async contracts (messages):** Pact supports message pacts for Kafka/RabbitMQ. Same model — consumer defines expected message shape, provider verifies it produces matching messages.
- **Don't contract-test internal implementation details.** Contract tests describe the *API*, not internal call sequences.

## Common Pitfalls

- Treating contract tests as integration tests and dropping real integration coverage.
- Over-specifying pacts (exact IDs, timestamps, counts) so they break on every data change.
- No Pact Broker — pacts shared via filesystem or git, with no version tracking.
- No `can-i-deploy` gate — contract tests run but never block a deploy.
- Missing provider states — verification fails with "state not found" and people disable the check.
- Webhooks not configured — provider only runs verification when it feels like it.
- Publishing pacts only on release tags — regular commits go unverified.
- Consumers and providers in the same repo — often a sign the services should be one.
- Forgetting async contracts — Kafka/RabbitMQ producers and consumers drift silently.

## Key Interview Tips

- **Lead with the problem:** "integration tests across services are slow and flaky; contract tests give the same confidence for API shape at a fraction of the cost."
- **Consumer-driven vs provider-driven** — know the distinction. Pact is consumer-driven; Spring Cloud Contract is provider-driven.
- **Pact Broker is the enforcement mechanism.** Without it, contract tests are documentation, not a gate.
- **`can-i-deploy`** is the killer feature — name it.
- **Matchers, not literals** — this is the practical discipline that makes contracts stable.
- **Contract tests ≠ integration tests** — state the boundary clearly.
- **Async contracts for Kafka** — many candidates forget messaging.
- **Provider states must be independent** — a favourite follow-up.
- **Version with git SHA**; track environments; publish both pacts and verifications.
- **Link to API-first** — OpenAPI describes the API; Pact verifies consumers' actual usage.

## Related

- [API-First Design](../architecture/api-first.md)
- [Microservices Communication](communication.md)
- [Microservices Deployment](deployment.md)
- [Testing Strategy](../testing/index.md)
- [TDD, BDD & ATDD](../testing/tdd-bdd-atdd.md)