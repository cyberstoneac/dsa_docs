# Spring Data JPA

> **Spring context:** Spring Boot 3.x with Hibernate 6.x as the default JPA
> provider. Focus is on repository patterns, query types, and the
> performance-sensitive corners.

## Mental Model

Spring Data JPA sits on top of JPA (Hibernate) and eliminates boilerplate
repository code. You declare an interface; Spring generates the implementation.

```d2
direction: right

app: "Your Service" {
  style.fill: "#e3f2fd"
}
repo: "OrderRepository\n(interface)" {
  style.fill: "#c8e6c9"
  desc: "You write nothing — Spring\ncreates the implementation"
}
jpa: "JPA / EntityManager" {
  style.fill: "#fff9c4"
}
hib: "Hibernate\n(SQL generation,\ncaching, dirty checking)" {
  style.fill: "#ffe0b2"
}
db: "Database" {
  style.fill: "#f8bbd0"
}

app.repo -> repo: "calls"
repo.jpa -> jpa: ""
jpa.hib -> hib: ""
hib.db -> db: "SQL"
```

**The win:** you write `findByEmail(String)`, Spring writes the query.

---

## Repository Hierarchy

```d2
direction: down

root: Repository {
  style.fill: "#e3f2fd"
  desc: "Marker interface"
}
crud: CrudRepository {
  style.fill: "#bbdefb"
  desc: "save, findById,\nexistsById, count,\ndelete, findAll"
}
paging: PagingAndSortingRepository {
  style.fill: "#c8e6c9"
  desc: "findAll(Sort),\nfindAll(Pageable)"
}
jpa: JpaRepository {
  style.fill: "#fff9c4"
  desc: "flush, saveAndFlush,\ndeleteInBatch,\nfindAll (List)"
}

root.crud -> crud: ""
crud.paging -> paging: ""
paging.jpa -> jpa: ""
```

| Interface | Adds |
|---|---|
| `Repository<T, ID>` | Marker only — no methods |
| `CrudRepository<T, ID>` | `save`, `findById`, `delete`, `count`, `existsById`, `findAll` |
| `PagingAndSortingRepository<T, ID>` | `findAll(Sort)`, `findAll(Pageable)` |
| `JpaRepository<T, ID>` | `flush`, `saveAndFlush`, `deleteAllInBatch`, `getReferenceById` |

**Almost always extend `JpaRepository`.** It's a superset and includes
everything you'll need.

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(long userId);
}
```

---

## Derived Query Methods

Spring generates queries from **method names**.

### The grammar

```text
findBy + [Property] + [Operator] + [And/Or] + ...
```

### Common keywords

| Keyword | Query |
|---|---|
| `findByEmail(String)` | `WHERE email = ?` |
| `findByEmailAndActive(String, boolean)` | `WHERE email = ? AND active = ?` |
| `findByEmailOrPhone(String, String)` | `WHERE email = ? OR phone = ?` |
| `findByAgeBetween(int, int)` | `WHERE age BETWEEN ? AND ?` |
| `findByAgeLessThan(int)` | `WHERE age < ?` |
| `findByAgeLessThanEqual(int)` | `WHERE age <= ?` |
| `findByAgeGreaterThan(int)` | `WHERE age > ?` |
| `findByNameIsNull()` | `WHERE name IS NULL` |
| `findByNameIsNotNull()` | `WHERE name IS NOT NULL` |
| `findByNameContaining(String)` | `WHERE name LIKE '%?%'` |
| `findByNameStartingWith(String)` | `WHERE name LIKE '?%'` |
| `findByNameEndingWith(String)` | `WHERE name LIKE '%?'` |
| `findByNameIgnoreCase(String)` | `WHERE LOWER(name) = LOWER(?)` |
| `findByStatusIn(Collection)` | `WHERE status IN (...)` |
| `findByStatusNotIn(Collection)` | `WHERE status NOT IN (...)` |
| `findByCreatedAtAfter(Instant)` | `WHERE created_at > ?` |
| `findByOrderByCreatedAtDesc()` | `ORDER BY created_at DESC` |
| `findTop3ByStatus(...)` | `LIMIT 3` |
| `findFirstByOrderByCreatedAtDesc()` | `LIMIT 1` |
| `existsByEmail(String)` | Returns `boolean` |
| `countByStatus(Status)` | Returns `long` |
| `deleteByStatus(Status)` | `DELETE WHERE status = ?` |

### Nested property traversal

```java
List<Order> findByCustomerEmail(String email);
// → WHERE customer.email = ?
```

Use underscore to disambiguate: `findByCustomer_Email(String)`.

### Return types

| Return type | Meaning |
|---|---|
| `List<T>` | All matches |
| `Optional<T>` | Zero or one (throws if multiple) |
| `T` | Zero or one (null if none) |
| `Page<T>` | Paginated + total count |
| `Slice<T>` | Paginated without total count |
| `Stream<T>` | Lazy iteration |
| `boolean` | For `existsBy` |
| `long` | For `countBy` |
| `void` | For delete/modifying queries |

### When to use derived queries

- **Simple lookups** — a few conditions
- **Common patterns** — findBy + a property
- **Readable names** — `findByActiveTrueAndRoleAdmin()`

**Avoid** for:
- Complex joins
- Aggregations
- Multi-line logic
- Anything needing explicit SQL tuning

Use `@Query` for those.

---

## `@Query` — Explicit JPQL or Native

### JPQL (portable)

```java
@Query("SELECT o FROM Order o WHERE o.status = :status AND o.total > :minTotal")
List<Order> findLargeOrders(@Param("status") OrderStatus status,
                            @Param("minTotal") BigDecimal minTotal);
```

JPQL talks about **entities and fields**, not tables and columns.

### Native SQL (database-specific)

```java
@Query(value = "SELECT * FROM orders WHERE total > :minTotal",
       nativeQuery = true)
List<Order> findLargeOrdersNative(@Param("minTotal") BigDecimal minTotal);
```

**Native is more powerful** (window functions, CTEs) but **less portable** and
**bypasses JPA's caching**.

### Positional vs named parameters

```java
// Positional (brittle)
@Query("SELECT o FROM Order o WHERE o.status = ?1 AND o.total > ?2")

// Named (preferred)
@Query("SELECT o FROM Order o WHERE o.status = :status AND o.total > :min")
```

**Use named.**

### SpEL in `@Query`

```java
@Query("SELECT o FROM Order o WHERE o.tenantId = #{principal.tenantId}")
List<Order> findForCurrentTenant();
```

Powerful but rare. `#{...}` is SpEL; `:...` is a parameter.

### Projections

**Interface-based:**

```java
public interface OrderSummary {
    Long getId();
    BigDecimal getTotal();
    String getStatus();
}

@Query("SELECT o.id AS id, o.total AS total, o.status AS status FROM Order o")
List<OrderSummary> findSummaries();
```

**Class-based (records):**

```java
public record OrderSummary(Long id, BigDecimal total, String status) { }

@Query("SELECT new com.example.OrderSummary(o.id, o.total, o.status) FROM Order o")
List<OrderSummary> findSummaries();
```

Projections fetch only the needed columns — **big performance win** on wide
tables.

### `@Modifying` — for UPDATE/DELETE

```java
@Modifying
@Query("UPDATE Order o SET o.status = :status WHERE o.id IN :ids")
int updateStatus(@Param("ids") List<Long> ids, @Param("status") OrderStatus status);
```

**Must be used with `@Modifying`** — otherwise Spring expects a SELECT and
throws.

**Return type:** `int` (rows affected) or `void`.

**Transaction:** `@Modifying` queries need a transaction — either on the
service method or the repository method with `@Transactional`.

**Cache/session flush:**

```java
@Modifying(clearAutomatically = true, flushAutomatically = true)
@Query("DELETE FROM Order o WHERE o.status = 'CANCELLED'")
int deleteCancelled();
```

- `flushAutomatically = true` — flush pending changes before running
- `clearAutomatically = true` — clear the persistence context after running

**Why it matters:** bulk updates bypass the persistence context. Without
`clearAutomatically`, cached entities go stale.

---

## Pagination and Sorting

### `Pageable`

```java
Page<Order> page = repository.findAll(
        PageRequest.of(0, 20, Sort.by("createdAt").descending())
);

page.getContent();       // List<Order>
page.getTotalElements(); // long
page.getTotalPages();    // int
page.hasNext();
page.hasPrevious();
```

### With `@Query`

```java
@Query("SELECT o FROM Order o WHERE o.status = :status")
Page<Order> findByStatus(@Param("status") OrderStatus status, Pageable pageable);
```

**Page** needs a `countQuery` if the query is complex:

```java
@Query(
    value = "SELECT o FROM Order o WHERE o.status = :status",
    countQuery = "SELECT COUNT(o) FROM Order o WHERE o.status = :status"
)
Page<Order> findByStatus(@Param("status") OrderStatus status, Pageable pageable);
```

### `Slice` vs `Page`

| | `Page<T>` | `Slice<T>` |
|---|---|---|
| Total count | ✅ | ❌ |
| Extra query | Count query | None |
| Use when | UI shows total pages | Infinite scroll |
| Performance | Slower on large tables | Fast |

**For infinite-scroll UIs, prefer `Slice`.** No count query.

### `Sort`

```java
Sort sort = Sort.by("lastName").ascending().and(Sort.by("firstName"));

List<Order> orders = repository.findAll(sort);
```

### Web layer integration

```java
@GetMapping("/orders")
public Page<Order> list(@PageableDefault(size = 20) Pageable pageable) {
    return repository.findAll(pageable);
}
```

Spring MVC binds `?page=0&size=20&sort=createdAt,desc` automatically.

---

## Entity Relationships & Fetching

### `@ManyToOne` — default EAGER

```java
@Entity
public class Order {
    @ManyToOne(fetch = FetchType.LAZY)   // override to LAZY
    private Customer customer;
}
```

**Default is EAGER** for `@ManyToOne` and `@OneToOne`. This often causes
N+1 problems — override to LAZY.

### `@OneToMany` — default LAZY

```java
@Entity
public class Customer {
    @OneToMany(mappedBy = "customer", fetch = FetchType.LAZY)
    private List<Order> orders = new ArrayList<>();
}
```

**Default is LAZY** for `@OneToMany` and `@ManyToMany`. Good.

### The `mappedBy` rule

`mappedBy` indicates the field that owns the relationship — the one with the
foreign key. **Only the owning side updates the DB.**

```java
// Owning side
@ManyToOne
@JoinColumn(name = "customer_id")
private Customer customer;

// Inverse side
@OneToMany(mappedBy = "customer")
private List<Order> orders;
```

### Cascades

```java
@OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Order> orders;
```

- `CascadeType.ALL` — propagate all operations (persist, merge, remove, etc.)
- `orphanRemoval = true` — remove children when detached from parent

**Use cascades carefully** — cascading remove on `@ManyToOne` can delete
shared data.

### `@Embedded` / `@Embeddable`

```java
@Embeddable
public class Address {
    private String street;
    private String city;
    private String zip;
}

@Entity
public class Customer {
    @Embedded
    private Address address;
}
```

Value objects stored inline in the same table.

---

## `EntityManager` and Persistence Context

The `EntityManager` manages a **persistence context** — a first-level cache
of managed entities.

### Entity states

| State | Meaning |
|---|---|
| **New / Transient** | Not associated with a persistence context |
| **Managed / Persistent** | In the persistence context; changes tracked |
| **Detached** | Was managed, no longer is |
| **Removed** | Marked for deletion |

### State transitions

```java
Order order = new Order();              // New
em.persist(order);                       // Managed (INSERT queued)
order.setStatus(PAID);                   // Dirty — will UPDATE at flush
em.detach(order);                        // Detached
em.merge(order);                         // Back to Managed (copy)
em.remove(order);                        // Removed
```

### Dirty checking

Hibernate tracks changes to managed entities. On flush (commit), it issues
UPDATEs.

```java
@Transactional
public void updateStatus(Long id) {
    Order order = repo.findById(id).orElseThrow();
    order.setStatus(SHIPPED);   // no explicit save needed!
}
```

**No `save()` call needed** — the entity is managed, and the change is
flushed at transaction commit.

**Interview line:** *"Within a transaction, changes to managed entities are
automatically persisted — that's dirty checking."*

### Flush vs commit

- **Flush** — synchronize the persistence context with the DB (issue SQL)
- **Commit** — end the transaction (and flush first if needed)

Flush happens:
- At transaction commit
- Before a query on the same entity (auto-flush)
- When you call `em.flush()` or `repo.flush()`

---

## `save()` vs `saveAndFlush()`

```java
repository.save(entity);          // queue INSERT/UPDATE
repository.saveAndFlush(entity);  // queue + flush immediately
```

**`save()` in a transaction** doesn't hit the DB until commit or flush.

**`saveAndFlush()`** forces a flush — useful when you need the generated ID
immediately, or when you want to catch constraint violations early.

**Interview note:** `save()` is not the same as `INSERT`. For a `New` entity,
it calls `persist`; for a `Detached` entity, it calls `merge`.

---

## Custom Repository Implementations

When derived + `@Query` aren't enough:

```java
public interface OrderRepositoryCustom {
    List<Order> findRecentLargeOrders(int days, BigDecimal minTotal);
}

public class OrderRepositoryCustomImpl implements OrderRepositoryCustom {
    @PersistenceContext
    private EntityManager em;

    @Override
    public List<Order> findRecentLargeOrders(int days, BigDecimal minTotal) {
        return em.createQuery("""
                SELECT o FROM Order o
                WHERE o.createdAt > :cutoff AND o.total > :min
                """, Order.class)
                .setParameter("cutoff", Instant.now().minus(days, ChronoUnit.DAYS))
                .setParameter("min", minTotal)
                .getResultList();
    }
}

public interface OrderRepository
        extends JpaRepository<Order, Long>, OrderRepositoryCustom { }
```

Spring wires `OrderRepositoryCustomImpl` into `OrderRepository` automatically.
**Naming convention matters:** `{Interface}Impl`.

---

## Tricky Corners ⚠️

**`save()` on a detached entity does a `merge`** — it may issue a SELECT first.

**Derived query names can silently do more work** than expected. Always check
the generated SQL via `spring.jpa.show-sql=true`.

**`findByEmailAndPhone`** vs **`findByEmailOrPhone`** — precedence is
left-to-right, but it's easy to misread. Parenthesize logically.

**`@Modifying` requires a transaction.** Otherwise `TransactionRequiredException`.

**`@Modifying` bulk updates bypass the persistence context.** Use
`clearAutomatically = true` to avoid stale entities.

**`@Query` with `List<Object[]>`** is a sign you should use a projection
instead.

**`Page` runs two queries** (data + count) by default. Use `Slice` when you
don't need the total.

**`Sort` on a field of an association** requires a join — use
`Sort.by("customer.name")` carefully.

**Entity equals/hashCode should not use `id` if it's generated.** Before
persist, `id` is null. Use a business key or don't override equals at all.

**Lazy loading outside a transaction** throws `LazyInitializationException`.
Either keep the transaction open (via `OpenSessionInView` — anti-pattern) or
fetch eagerly where needed.

**`getReferenceById`** returns a proxy without hitting the DB — good for
setting foreign keys without a SELECT.

**`count()` on a huge table is slow.** Consider `Slice` or a cached count.

**`@Modifying` `DELETE` doesn't cascade in the persistence context.** Bulk
deletes skip JPA's cascade rules. Use `repo.deleteAll()` for entity-level
cascade, or handle cascades manually in the DB.

**`@Transactional(readOnly = true)`** on repository methods is a small
optimization (Hibernate skips dirty checking) — but skip it if the same
service method writes.

**Spring Data JPA's `existsBy`** uses a `SELECT 1 ... LIMIT 1` — cheap.

**`findAll(Pageable)` without a sort is non-deterministic** on many DBs.
Always specify a sort.

---

## Common Pitfalls

- Using `@ManyToOne` without `LAZY` — causes N+1.
- Assuming `save()` always inserts — it may merge.
- Forgetting `@Modifying` on UPDATE/DELETE queries.
- Relying on `findAll()` without pagination on large tables.
- Using native queries when JPQL would work.
- Overriding `equals`/`hashCode` on `id` for JPA entities.
- Lazy loading in a DTO mapper outside a transaction.
- Adding cascade on `@ManyToOne` — dangerous deletes.
- Missing a count query for `Page` on a complex `@Query`.

---

## Key Interview Tips

- Recite the repository hierarchy: `Repository` → `CrudRepository` →
  `PagingAndSortingRepository` → `JpaRepository`.
- Explain derived query naming rules with 2–3 examples.
- Know `@Modifying` + `clearAutomatically` for bulk updates.
- Explain `Page` vs `Slice` — count query vs no count query.
- Say **"`@ManyToOne` is EAGER by default; override to LAZY."**
- Explain dirty checking — no explicit `save()` needed inside a transaction.
- Mention projections for read-only queries.

---

## Related

- [Batch Processing](batch-processing.md) — bulk inserts/updates and batching
- [N+1 Problem](n-plus-one.md) — lazy loading gone wrong
- [Transaction Management](../transactions/transaction-management.md) —
  `@Transactional` interaction with repositories
- [Configuration](../boot/configuration.md) — `spring.jpa.*` properties