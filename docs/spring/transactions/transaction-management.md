# Transaction Management

> **Spring context:** Spring Boot 3.x, Spring Framework 6.x. Focus is on
> `@Transactional` internals, propagation, isolation, and the self-invocation
> trap.

## Mental Model

A **transaction** is a unit of work that either fully succeeds or fully rolls
back. Spring wraps the underlying JDBC/JPA transaction with declarative
`@Transactional`.

```d2
direction: right

client: "Client" {
  style.fill: "#e3f2fd"
}
proxy: "Proxy\n(@Transactional)" {
  style.fill: "#fff9c4"
}
tm: "PlatformTransactionManager" {
  style.fill: "#ffe0b2"
}
db: "Database\n(BEGIN / COMMIT / ROLLBACK)" {
  style.fill: "#c8e6c9"
}

client.proxy -> proxy: "call"
proxy.tm -> tm: "getTransaction()"
tm.db -> db: "BEGIN"
proxy.db -> db: "business ops"
proxy.tm -> tm: "commit() or rollback()"
```

**Key facts:**

1. `@Transactional` works through **AOP proxies** — self-invocation breaks it
2. The `PlatformTransactionManager` is the abstraction over JDBC, JPA,
   JTA, etc.
3. Rollback rules depend on the exception type — **checked exceptions don't
   roll back by default**

---

## `PlatformTransactionManager`

The central interface:

```java
public interface PlatformTransactionManager {
    TransactionStatus getTransaction(TransactionDefinition definition);
    void commit(TransactionStatus status);
    void rollback(TransactionStatus status);
}
```

### Common implementations

| Implementation | Use |
|---|---|
| `DataSourceTransactionManager` | Plain JDBC |
| `JpaTransactionManager` | JPA / Hibernate |
| `HibernateTransactionManager` | Native Hibernate |
| `JtaTransactionManager` | Distributed (JTA) |
| `ChainedTransactionManager` | Multiple resources (deprecated) |
| `ReactiveTransactionManager` | R2DBC / reactive |

Spring Boot auto-configures the right one when it detects the dependency.

---

## `@Transactional` on Methods vs Classes

### On a method

```java
@Service
public class OrderService {
    @Transactional
    public void placeOrder(Request req) { ... }
}
```

### On a class

```java
@Service
@Transactional
public class OrderService {
    public void placeOrder(Request req) { ... }   // inherits
    public void cancelOrder(long id) { ... }       // inherits

    @Transactional(readOnly = true)
    public Order find(long id) { ... }             // overrides
}
```

**Class-level** applies to all `public` methods. **Method-level** overrides.

### On an interface (avoid)

```java
public interface OrderService {
    @Transactional
    void placeOrder(Request req);   // works, but not recommended
}
```

Spring warns against interface-level `@Transactional`. Prefer concrete classes.

---

## Transaction Attributes

`@Transactional` accepts:

| Attribute | Default | Meaning |
|---|---|---|
| `propagation` | `REQUIRED` | How to participate in existing transactions |
| `isolation` | `DEFAULT` | DB isolation level |
| `timeout` | `-1` (none) | Max seconds before timeout |
| `readOnly` | `false` | Hint for read-only optimization |
| `rollbackFor` | `{}` | Exceptions that force rollback |
| `noRollbackFor` | `{}` | Exceptions that do NOT roll back |

```java
@Transactional(
    propagation = Propagation.REQUIRES_NEW,
    isolation = Isolation.READ_COMMITTED,
    timeout = 30,
    readOnly = false,
    rollbackFor = {ServiceException.class}
)
public void placeOrder(Request req) { ... }
```

---

## Propagation — The Most-Asked Topic

Propagation defines how a transactional method behaves when **another
transactional method calls it**.

| Propagation | Behavior |
|---|---|
| `REQUIRED` (default) | Join existing, or create new |
| `REQUIRES_NEW` | Always create new; suspend existing |
| `SUPPORTS` | Join existing, or run without a transaction |
| `NOT_SUPPORTED` | Run without a transaction; suspend existing |
| `MANDATORY` | Must have an existing transaction, else throw |
| `NEVER` | Must NOT have a transaction, else throw |
| `NESTED` | Create savepoint; outer rollback rolls back inner |

### `REQUIRED` — the default

```java
@Transactional
public void placeOrder(Request req) {
    saveOrder(req);          // joins the outer transaction
}

@Transactional(propagation = Propagation.REQUIRED)
public void saveOrder(Request req) {
    // same transaction as placeOrder
}
```

**Behavior:** same physical transaction. If the inner fails, the whole thing
rolls back.

### `REQUIRES_NEW` — separate transaction

```java
@Transactional
public void placeOrder(Request req) {
    try {
        auditLog.record(req);   // commits independently    } catch (Exception e) {
        log.warn("Audit failed", e);   // order still commits
    }
    saveOrder(req);
}

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void record(Request req) { ... }
```

**Behavior:** the outer transaction is **suspended**, a new one begins for the
inner method. When it commits, the outer resumes.

**Use for:** audit logs, notifications, metrics — things that should persist
even if the main transaction rolls back.

**Gotcha:** the outer transaction's locks are held while the inner runs. If
the inner needs the same rows, you can deadlock.

### `NESTED` — savepoints

```java
@Transactional
public void placeOrder(Request req) {
    saveOrder(req);   // savepoint
    // if saveOrder fails, only that part rolls back
}

@Transactional(propagation = Propagation.NESTED)
public void saveOrder(Request req) { ... }
```

**Behavior:** uses JDBC savepoints. Inner rollback returns to the savepoint;
outer can continue.

**Not the same as `REQUIRES_NEW`:**

| | `REQUIRES_NEW` | `NESTED` |
|---|---|---|
| Physical transaction | New | Same |
| Savepoint | ❌ | ✅ |
| Outer failure | Inner still commits | Inner rolled back |
| Inner failure | Outer continues | Outer can continue via savepoint |
| DB support | Always | Savepoints required |

### `MANDATORY`

```java
@Transactional(propagation = Propagation.MANDATORY)
public void saveOrder(Request req) {
    // throws IllegalTransactionStateException if no transaction
}
```

Useful to enforce that a method is only called within a transaction.

### `NEVER`

Throws if a transaction exists. Rare.

### `SUPPORTS` / `NOT_SUPPORTED`

- `SUPPORTS` — join if present, run without otherwise
- `NOT_SUPPORTED` — suspend any existing, run without a transaction

Both are rare.

### Quick decision table

| Need | Propagation |
|---|---|
| Default join behavior | `REQUIRED` |
| Independent commit | `REQUIRES_NEW` |
| Partial rollback | `NESTED` |
| Must have a transaction | `MANDATORY` |
| Must not have a transaction | `NEVER` |

---

## Isolation Levels

Isolation defines how concurrent transactions see each other's changes.

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| `READ_UNCOMMITTED` | ✅ possible | ✅ possible | ✅ possible |
| `READ_COMMITTED` | ❌ | ✅ possible | ✅ possible |
| `REPEATABLE_READ` | ❌ | ❌ | ✅ possible |
| `SERIALIZABLE` | ❌ | ❌ | ❌ |

### The problems

- **Dirty read:** read uncommitted data from another transaction
- **Non-repeatable read:** the same row read twice gives different values
  (another transaction committed in between)
- **Phantom read:** the same query returns different rows because another
  transaction inserted/deleted rows

### Spring's `DEFAULT`

`Isolation.DEFAULT` means "use the database's default." For most DBs:

- PostgreSQL: `READ_COMMITTED`
- MySQL InnoDB: `REPEATABLE_READ`
- Oracle: `READ_COMMITTED`

**Interview line:** *"Don't override isolation unless you have a specific
reason — the default is usually correct, and higher isolation reduces
concurrency."*

### Setting isolation

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public void placeOrder(Request req) { ... }
```

---

## Rollback Rules — The Classic Trap

**By default:**

- **Unchecked exceptions** (`RuntimeException`, `Error`) → rollback
- **Checked exceptions** → NO rollback

```java
@Transactional
public void placeOrder(Request req) throws IOException {
    orders.save(req);
    throw new IOException("network");   // ❌ transaction COMMITS
}
```

**Fix:**

```java
@Transactional(rollbackFor = IOException.class)
public void placeOrder(Request req) throws IOException { ... }
```

Or `rollbackFor = Exception.class` for all exceptions.

### Why this default?

Spring chose it based on EJB conventions: unchecked exceptions are usually
programming errors that should roll back; checked exceptions are usually
recoverable business exceptions the caller should handle.

**Interview line:** *"RuntimeException and Error roll back by default; checked
exceptions do not. Use `rollbackFor` to change this."*

### `noRollbackFor`

Force commit even on a `RuntimeException`:

```java
@Transactional(noRollbackFor = OptimisticLockException.class)
public void process(Long id) { ... }
```

Rarely useful — but shows up in interviews.

---

## `readOnly = true`

A hint to the transaction manager. Behavior varies:

| Underlying tech | Effect |
|---|---|
| Hibernate | Skips dirty checking; no flush on commit |
| JDBC | Sets connection read-only (some drivers) |
| PostgreSQL | Slight optimization |

```java
@Transactional(readOnly = true)
public Order find(long id) {
    return orders.findById(id).orElseThrow();
}
```

**Benefits:**

- Performance (Hibernate skips dirty checking)
- Safety (accidental writes fail fast in some drivers)

**Caution:** with `readOnly = true`, if you do write, Hibernate may skip the
flush and the write silently disappears.

---

## The Self-Invocation Trap

**Same problem as `@Async`, `@Cacheable`, `@PreAuthorize`:**
self-invocation bypasses the proxy.

```java
@Service
public class OrderService {

    public void placeOrder() {
        saveOrder();   // ❌ @Transactional IGNORED
    }

    @Transactional
    public void saveOrder() { ... }
}
```

**Fixes:**

1. **Move to another bean** — cleanest
2. **Inject self** — `@Autowired @Lazy OrderService self; self.saveOrder();`
3. **`AopContext.currentProxy()`** — requires `exposeProxy = true`
4. **`TransactionTemplate`** — programmatic

Covered in detail in [AOP & Proxies](../aop/aop-and-proxies.md#the-self-invocation-trap-).

---

## Common Patterns

### Service-layer transaction boundaries

```java
@Service
public class OrderService {

    @Transactional
    public Order placeOrder(PlaceOrderRequest req) {
        validate(req);
        Order order = orders.save(new Order(req));
        inventory.reserve(req.items());
        events.publish(new OrderPlaced(order.id()));
        return order;
    }
}
```

**One transaction, orchestrated at the service layer.** Repositories don't
need `@Transactional` if they're called within the service transaction.

### Audit log in a separate transaction

```java
@Transactional
public void placeOrder(Request req) {
    try {
        auditService.record("order-placed", req.userId());
    } catch (Exception e) {
        log.warn("Audit failed", e);   // swallow
    }
    orders.save(new Order(req));
}

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void record(String event, long userId) { ... }
```

Audit commits regardless of the order transaction's outcome.

### `@Transactional` on a `@Repository`

```java
@Repository
public class JpaOrderRepository {
    @PersistenceContext
    private EntityManager em;

    @Transactional
    public void save(Order order) {
        em.persist(order);
    }
}
```

**Generally unnecessary** — the service layer should own the transaction.

### Long-running transaction — anti-pattern

```java
@Transactional
public void placeOrder(Request req) {
    Order order = orders.save(new Order(req));
    paymentClient.charge(req.paymentInfo());   // ❌ remote call inside transaction
    emailClient.sendConfirmation(order);        // ❌ I/O inside transaction
}
```

**Problems:**

- Transaction held open during network I/O
- DB locks held longer than needed
- If the remote call fails, the DB rolls back — but the remote may have
  already succeeded (distributed consistency issue)

**Fix:** move non-DB work outside the transactional method, or use
transactional-outbox / saga.

---

## Programmatic Transactions

When you need finer control:

### `TransactionTemplate`

```java
@Service
public class OrderService {
    private final TransactionTemplate txTemplate;

    public OrderService(PlatformTransactionManager txManager) {
        this.txTemplate = new TransactionTemplate(txManager);
    }

    public Order placeOrder(Request req) {
        return txTemplate.execute(status -> {
            Order order = orders.save(new Order(req));
            if (someCondition) {
                status.setRollbackOnly();   // manual rollback
            }
            return order;
        });
    }
}
```

### `PlatformTransactionManager` directly

```java
TransactionStatus status = txManager.getTransaction(new DefaultTransactionDefinition());
try {
    // do work
    txManager.commit(status);
} catch (Exception e) {
    txManager.rollback(status);
    throw e;
}
```

**Rarely needed** — `TransactionTemplate` covers most cases.

---

## Tricky Corners ⚠️

**Checked exceptions don't roll back by default.** Use `rollbackFor`.

**Self-invocation bypasses `@Transactional`.** Same proxy reason as `@Async`.

**`@Transactional` on a private method silently does nothing.**

**`@Transactional` on an `interface` method** works but is fragile — prefer
concrete classes.

**`REQUIRES_NEW` holds the outer transaction's locks** while the inner runs.

**`NESTED` requires DB savepoint support.** Some databases (MySQL with
MyISAM, older versions) don't support it.

**`readOnly = true` + accidental writes = silent data loss** (Hibernate skips
flush).

**`timeout` isn't precise.** The transaction is rolled back at the next
statement, not at the exact timeout.

**Multiple `PlatformTransactionManager`s** require a `@Transactional`
`transactionManager` attribute or `@Primary`.

**`REQUIRES_NEW` + connection pool exhaustion.** Each nested new transaction
takes a connection. Concurrent outer calls can exhaust the pool.

**Rollback marks the transaction as rollback-only.** Catching the inner
exception and continuing doesn't help — the outer will still fail at commit
with `UnexpectedRollbackException`.

**Never catch an exception in an outer transaction without re-throwing it if
you want rollback.**

**`TransactionTemplate.executeWithoutResult`** for `void` methods.

**Long transactions cause phantom reads and deadlocks in other sessions.**
Keep transactions short.

**The 2-phase-commit (2PC) problem** — `@Transactional` doesn't span
multiple data sources by default. Use JTA or a saga.

---

## Common Pitfalls

- Assuming checked exceptions roll back.
- Self-invoking a `@Transactional` method.
- Holding transactions open during remote calls.
- Using `REQUIRES_NEW` without understanding connection pool implications.
- Forgetting `readOnly = true` on read methods.
- Trying to make `@Transactional` span multiple databases without JTA.
- Overriding isolation without a concrete reason.
- Making the whole service class `@Transactional` and never thinking about
  boundaries.

---

## Key Interview Tips

- Explain `@Transactional` as **AOP-based** — proxy wraps the method.
- Recite the propagation types, especially `REQUIRED`, `REQUIRES_NEW`,
  `NESTED`.
- Know the **rollback default: unchecked yes, checked no** — top trap.
- Say `readOnly = true` for reads — performance + safety.
- Describe the **self-invocation trap** and 3 fixes.
- Warn about **long transactions** with remote calls.
- Mention **`TransactionTemplate`** for programmatic control.
- Say "**`REQUIRES_NEW` suspends the outer, holds its locks**" — subtle but
  important.

---

## Related

- [AOP & Proxies](../aop/aop-and-proxies.md) — how `@Transactional` works
  internally
- [IoC & Dependency Injection](../core/ioc-and-di.md) — how the transaction
  manager is wired
- [Spring Data JPA](../data/spring-data-jpa.md) — the typical repository layer
- [Batch Processing](../data/batch-processing.md) — transaction boundaries in
  bulk operations