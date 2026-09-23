# TDD, BDD & ATDD

> **JDK context:** Java 17+ — JUnit 5, AssertJ, Mockito, Cucumber-JVM, Spring Boot Test. This file is about the *disciplines*, not the frameworks.

## Mental Model

Three related ideas, often conflated:

| Discipline | Question it answers | Written by | Reads like | Primary output |
|---|---|---|---|---|
| **TDD** (Test-Driven Development) | "Does this unit behave correctly?" | Developer | Code with assertions | Clean design, fast feedback |
| **BDD** (Behaviour-Driven Development) | "Does the system do what the business asked for?" | Dev + QA + BA | Given/When/Then in business language | Shared understanding, living docs |
| **ATDD** (Acceptance Test-Driven Development) | "How will we know this story is *done*?" | Whole team | Acceptance criteria before code | Agreed definition of done |

They overlap. TDD is a *design* discipline at the unit level. BDD and ATDD are *collaboration* disciplines at the feature level. You can practise TDD without BDD, and BDD without strict TDD — but together they form a coherent story.

```d2
direction: down

discovery: Discovery\n(what are we building?)
formulation: Formulation\n(how will we know it works?)
automation: Automation\n(prove it continuously)

discovery -> formulation: "shared examples"
formulation -> automation: "executable specs"
automation -> discovery: "feedback\n(new examples)"
```

This is the **three practices of BDD** (Discovery, Formulation, Automation). TDD lives mostly in Automation; ATDD spans Formulation and Automation.

## Test-Driven Development (TDD)

### The cycle: Red → Green → Refactor

```d2
direction: right

red: "🔴 Red\nwrite a failing test"
green: "🟢 Green\nmake it pass, simplest way"
refactor: "🔵 Refactor\nclean up, keep tests green"

red -> green: "minimal code"
green -> refactor: "tests still green"
refactor -> red: "next behaviour"
```

**Rules (Kent Beck)**

1. Write a failing test first. If it passes, it doesn't test anything new.
2. Write only enough production code to make the failing test pass. No speculation.
3. Refactor continuously. Both production and test code.
4. Run the whole suite after every change.

### Why it works

- **Design pressure.** You can't write a test for a class that doesn't have a callable interface — so the interface gets designed first, from the caller's perspective.
- **Fast feedback.** Failures surface in seconds, not at integration time.
- **Regression net.** Every bug fix starts with a failing test that reproduces the bug.
- **Confidence to refactor.** If you're afraid to refactor, your tests are doing their job poorly.

### Worked example: a `Money` value object

```java
// Step 1 — 🔴 Red: write the test first, it fails to compile (no Money class)
class MoneyTest {

    @Test
    void addsSameCurrency() {
        Money a = Money.of(10, "USD");
        Money b = Money.of(5, "USD");
        assertEquals(Money.of(15, "USD"), a.plus(b));
    }

    @Test
    void rejectsDifferentCurrencies() {
        Money a = Money.of(10, "USD");
        Money b = Money.of(5, "EUR");
        assertThrows(IllegalArgumentException.class, () -> a.plus(b));
    }
}
// Expected (first run): compile error — Money does not exist

// Step 2 — 🟢 Green: minimal implementation
public record Money(long amount, String currency) {

    public static Money of(long amount, String currency) {
        return new Money(amount, currency);
    }

    public Money plus(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException("currency mismatch");
        }
        return new Money(amount + other.amount, currency);
    }
}
// Expected: both tests pass

// Step 3 — 🔵 Refactor: e.g. replace String with a Currency enum,
// add negative-amount guard, add equals hash-consistency via record.
// Tests stay green throughout.
```

### TDD in Spring Boot

TDD works at the **unit boundary** even in Spring apps. Don't start with `@SpringBootTest` — start with plain classes and constructor injection, then verify wiring with a thin slice test.

```java
// Unit-level TDD: service with injected repository
class OrderServiceTest {

    private final OrderRepository repo = new InMemoryOrderRepository(); // fake
    private final OrderService service = new OrderService(repo);

    @Test
    void marksOrderPaidAndEmitsEvent() {
        Order o = service.place("cust-1", 50);
        service.markPaid(o.id());
        assertEquals(OrderStatus.PAID, repo.findById(o.id()).orElseThrow().status());
        // Expected: PAID
    }
}
```

Then a slice test confirms it's wired into Spring correctly:

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mvc;
    @MockBean OrderService service;

    @Test
    void returns201OnPlace() throws Exception {
        when(service.place(any(), anyLong())).thenReturn(new Order("o-1", OrderStatus.PENDING));
        mvc.perform(post("/orders").contentType(APPLICATION_JSON)
                .content("""{"customer":"c-1","cents":100}"""))
           .andExpect(status().isCreated());
        // Expected: 201 Created
    }
}
```

### When TDD is hard (and what to do)

| Situation | Reason | Workaround |
|---|---|---|
| Exploring unknown API | You don't know what to assert yet | Spike, delete, then TDD |
| UI/frontend | Assertions are DOM-flavoured | Test behaviour, not markup; use Testing Library |
| Legacy code with no seams | No constructor injection | Add a seam (Sprout/Wrap), test around it, then TDD new behaviour |
| Performance-critical inner loops | Microbenchmark, not unit test | JMH benchmark tests in CI, not TDD |
| Throwaway scripts | No long-term value | Skip |

**Rule:** TDD is a tool for code you intend to keep.

## Behaviour-Driven Development (BDD)

BDD extends TDD from "does this unit work?" to "does this *feature* behave as the business expects?". The core artefact is a **scenario** written in **Given / When / Then** form, ideally in **Gherkin** so it can be executed.

### Gherkin anatomy

```gherkin
Feature: Withdraw cash from ATM

  Scenario: Successful withdrawal with sufficient balance
    Given the account balance is 500
    And the card is valid
    When the user requests 200
    Then the ATM dispenses 200
    And the account balance is 300

  Scenario: Rejected withdrawal when balance is insufficient
    Given the account balance is 100
    And the card is valid
    When the user requests 200
    Then the ATM rejects the request with "Insufficient funds"
    And the account balance is 100
```

- **Feature** — one user-facing capability.
- **Scenario** — one example of behaviour.
- **Given** — precondition (world state).
- **When** — the action under test.
- **Then** — observable outcome.
- **And / But** — continuation of the previous keyword.

### Executable BDD with Cucumber-JVM

**Feature file** `src/test/resources/features/withdraw.feature`:

```gherkin
Feature: Withdraw cash

  Scenario: Sufficient funds
    Given an account with balance 500
    When I withdraw 200
    Then the dispensed amount is 200
    And the balance is 300
```

**Step definitions**:

```java
public class WithdrawSteps {

    private Account account;
    private int dispensed;

    @Given("an account with balance {int}")
    public void anAccountWithBalance(int balance) {
        this.account = new Account(balance);
    }

    @When("I withdraw {int}")
    public void iWithdraw(int amount) {
        this.dispensed = account.withdraw(amount);
    }

    @Then("the dispensed amount is {int}")
    public void dispensedIs(int expected) {
        assertEquals(expected, dispensed);
    }

    @Then("the balance is {int}")
    public void balanceIs(int expected) {
        assertEquals(expected, account.balance());
    }
}
```

**Run with JUnit 5 platform:** annotate a runner class `@Suite @IncludeEngines("cucumber")` and point it at the glue + feature path.

### Living documentation

Well-written scenarios are readable by non-developers and serve as **living documentation** — the spec is the test; the test is the spec. When behaviour changes, the test fails, and the documentation updates itself by definition.

**Anti-pattern:** scenarios written in code-like language ("Given a POST to /orders with JSON body...") — that's an integration test wearing a Gherkin costume. Keep scenarios in business language.

### BDD anti-patterns

| Anti-pattern | Smell | Fix |
|---|---|---|
| Imperative scenarios | Steps read like clicks: "When I click the button" | Describe intent: "When I submit the order" |
| Too many scenarios | Dozens per feature | Collapse to a table of examples where behaviour is the same |
| Step-definition soup | Hundreds of tiny step defs, no reuse | Collapse to a reusable DSL; use `Scenario Outline` |
| Gherkin as test script | Dev writes scenarios alone | Whole team (Three Amigos) writes scenarios |
| Skipping Discovery | Scenarios go straight to automation | Run a Three Amigos session first |

## ATDD

ATDD (also called **Story Test-Driven Development**) is the practice of writing **acceptance criteria as tests before coding starts**, agreed by the whole team. It focuses on *what "done" means* for a user story.

### Workflow

```d2
direction: right

story: User Story\n(written by PO)
criteria: Acceptance Criteria\n(refined by team)
examples: Concrete Examples\n(Three Amigos)
tests: Executable Tests\n(automated or manual)
code: Implementation
verify: Verify Acceptance

story -> criteria: "clarify"
criteria -> examples: "make concrete"
examples -> tests: "express as tests"
tests -> code: "drive development"
code -> verify: "prove done"
```

### Example

**User story:** "As a customer, I can apply a discount code at checkout."

**Acceptance criteria** (before code):

- Given a valid code `SAVE10` and cart ≥ $50, checkout shows 10% off.
- Given an expired code, checkout shows "Code expired".
- Given a code used more than 5 times, checkout shows "Code already used".
- Given a valid code and cart < $50, checkout shows "Minimum order not met".

These criteria **become** the acceptance tests — automated or scripted — and drive implementation. When they all pass, the story is done.

### Three Amigos

A short, structured conversation before development:

- **Business (PO / BA)** — brings intent, examples, edge cases.
- **Development** — brings feasibility, cost, technical constraints.
- **Testing (QA)** — brings the "what could go wrong?" mindset.

Goal: agree on concrete examples that express the acceptance criteria. Output feeds directly into BDD scenarios and acceptance tests.

## How They Fit Together

```d2
direction: down

atdd: "ATDD\n(whole-team, story level)"
bdd: "BDD\n(Given/When/Then, feature level)"
tdd: "TDD\n(red/green/refactor, unit level)"

atdd -> bdd: "acceptance criteria\nbecome scenarios"
bdd -> tdd: "scenarios drive\nunit-level cycle"
tdd -> atdd: "working code\nsatisfies story"
```

A concrete flow for one story:

1. **Three Amigos** agrees acceptance criteria (ATDD).
2. Criteria are written as **Gherkin scenarios** (BDD formulation).
3. Each scenario needs new units — dev starts a **TDD cycle** for each.
4. Scenarios are **automated** with Cucumber/step defs (BDD automation).
5. Feature ships when all scenarios are green.

## When to Use Each

| Context | TDD | BDD | ATDD |
|---|---|---|---|
| Greenfield business logic | ✅ | Optional | ✅ if team includes PO/QA |
| Library / internal util | ✅ | ❌ | ❌ |
| Regulated domain (finance, health) | ✅ | ✅ (audit trail) | ✅ |
| Frontend SPA | ✅ (logic) | ✅ (journeys) | ✅ |
| Data pipelines | ✅ (transforms) | Sometimes | Sometimes |
| Prototypes / spikes | ❌ | ❌ | ❌ |
| Legacy hotfix | ✅ (reproduce bug) | ❌ | ❌ |

**Rule of thumb:** TDD always pays off for code you keep. BDD/ATDD pay off when multiple roles need to agree on behaviour.

## Tricky Corners ⚠️

- **TDD ≠ unit test coverage.** Writing tests after the code is fine — it's just not TDD, and it doesn't drive design the same way.
- **BDD ≠ Cucumber.** Gherkin is a format; BDD is a conversation. Cucumber without discovery/formulation is just slow integration testing.
- **Scenarios should be independent.** A failing scenario shouldn't leave state that breaks the next one. Clean the world between scenarios.
- **Step definitions must be reusable.** If every scenario has a unique step, you're writing prose, not a DSL.
- **`@SpringBootTest` + Cucumber** is very slow. Prefer a lightweight container (e.g. `@CucumberContextConfiguration` with a slice test context).
- **Don't TDD frameworks.** If you're testing framework behaviour, you're writing the wrong test.
- **BDD scenario count matters.** A feature with 40 scenarios is usually one with 4 scenarios and a table of examples.
- **ATDD is not a checklist.** If PO/QA/dev don't actually *talk*, it's a document, not a practice.

## Common Pitfalls

- Writing tests *after* code and calling it TDD.
- Skipping Refactor — the cycle without refactor degrades into messy, over-engineered code.
- Mocking everything so the tests pass but the integration doesn't work.
- Gherkin scenarios in code language ("Given a POST with JSON…") — not BDD.
- Using BDD for internal libraries — no business audience to serve.
- ATDD acceptance criteria as vague bullet points ("should work fast") instead of concrete examples.
- Three Amigos meetings that become design reviews instead of example-gathering.
- Cucumber suites that take 20+ minutes — usually a sign scenarios are doing what integration tests should do.

## Key Interview Tips

- **Distinguish TDD from "write tests after".** TDD's value is design pressure + refactor safety, not just coverage.
- **Explain Red/Green/Refactor in one sentence each.** Interviewers want the discipline, not the ceremony.
- **Use BDD to talk about the whole team**, not just a tool. Mention Three Amigos.
- **State when you *wouldn't* use BDD.** Libraries, utilities, internal APIs — usually not worth the overhead.
- **Cite a concrete win**: "We moved acceptance criteria into Gherkin and cut rework on stories by ~30% because edge cases were caught at refinement."
- **Mention ATDD as the umbrella practice** that drives BDD scenarios and TDD cycles from the same story.
- **Name the anti-patterns.** "Test script BDD" and "mock everything TDD" show you've actually shipped.

## Related

- [Testing Strategy](index.md)
- [Contract Testing](../microservices-patterns/contract-testing.md)
- [Shift-Left](../leadership/shift-left.md)
- [SDLC Lifecycle](../leadership/sdlc-lifecycle.md)
- [Agile Ceremonies](../leadership/agile-ceremonies.md)