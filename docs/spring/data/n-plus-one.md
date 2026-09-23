# The N+1 Problem

> **Spring context:** Spring Boot 3.x with Hibernate 6.x. This is **the
#1 performance issue** in JPA-backed applications and a top interview topic.

## Mental Model

**N+1** = 1 query to fetch N parent entities + N additional queries to fetch
their lazy-loaded children.

```d2
direction: down

q1: "SELECT * FROM customers" {
  style.fill: "#bbdefb"
  desc: "1 query — returns N customers"
}
q2: "SELECT * FROM orders WHERE customer_id = 1" {
  style.fill: "#ffcdd2"
}
q3: "SELECT * FROM orders WHERE customer_id = 2" {
  style.fill: "#ffcdd2"
}
q4: "SELECT * FROM orders WHERE customer_id = 3" {
  style.fill: "#ffcdd2"
}
q5: "... × N more" {
  style.fill: "#ffcdd2"
}

q1.q2 -> q2: ""
q1.q3 -> q3: ""
q1.q4 -> q4: ""
q1.q5 -> q5: ""
```

For 1,000 customers: **1 + 1,000 = 1,001 queries**. For 10,000: 10,001.

**Interview line:** *"N+1 is 1 query for parents, N queries for children —
usually caused by lazy loading in a loop."*

---

## How N+1 Happens

### The setup

```java
@Entity
public class Customer {
    @Id
    private Long id;

    private String name;

    @OneToMany(mappedBy = "customer", fetch = FetchType.LAZY)
    private List<Order> orders = new ArrayList<>();
}

@Entity
public class Order {
    @Id
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;

    private BigDecimal total;
}
```

### The trigger

```java
List<Customer> customers = customerRepo.findAll();

for (Customer c : customers) {
    System.out.println(c.getName() + ": " + c.getOrders().size());
}
```

**Generated SQL:**

```sql
SELECT * FROM customers;                                          -- 1 query
SELECT * FROM orders WHERE customer_id = 1;                       -- N queries
SELECT * FROM orders WHERE customer_id = 2;
SELECT * FROM orders WHERE customer_id = 3;
-- ... one per customer
```

**Why:** `orders` is lazy. Accessing it triggers a load **per parent**, in
the loop.

### The many-to-one variant

```java
List<Order> orders = orderRepo.findAll();

for (Order o : orders) {
    System.out.println(o.getCustomer().getName());   // N+1 on the other side
}
```

**Same pattern**, different direction.

---

## Detecting N+1

### 1. Enable SQL logging

```properties
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
```

Look for repeated `SELECT ... WHERE parent_id = ?` queries.

### 2. Hibernate statistics

```properties
spring.jpa.properties.hibernate.generate_statistics=true
logging.level.org.hibernate.stat=DEBUG
```

Look for high `Query execution count` after a single repository call.

### 3. P6Spy / datasource-proxy

Both log the actual SQL sent to the DB, including parameters.

### 4. Dev tools

- **Hibernate Profiler** — visual N+1 detection
- **Spring Boot Actuator + Micrometer** — track query counts
- **Datadog / New Relic** — production APM detects N+1 patterns

### 5. Code review heuristic

**If you loop over entities and access a lazy collection inside the loop,
you have N+1.**

```java
for (Order o : orders) {
    o.getCustomer();   // ⚠️ N+1 if lazy
    o.getItems();      // ⚠️ N+1 if lazy
}
```

---

## Solutions

Five approaches, in order of preference.

### 1. `JOIN FETCH` — the primary fix

```java
@Query("SELECT c FROM Customer c JOIN FETCH c.orders")
List<Customer> findAllWithOrders();
```

**Generated SQL:**

```sql
SELECT c.*, o.* FROM customers c
JOIN orders o ON o.customer_id = c.id;
```

**One query.** Fixed.

**Caveat:** `JOIN FETCH` on a `@OneToMany` duplicates parent rows. Hibernate
deduplicates by default but the wire traffic is higher.

**Caveat:** pagination with `JOIN FETCH` on a collection is broken — Hibernate
warns `firstResult/maxResults specified with collection fetch; applying in
memory`.

**Fix for pagination + JOIN FETCH:**

1. Fetch the IDs paginated, then join-fetch by IDs in a second query
2. Or use `@EntityGraph` with `@BatchSize` instead

### 2. `@EntityGraph` — declarative join fetch

```java
@EntityGraph(attributePaths = "orders")
List<Customer> findAll();
```

Or on a repository method:

```java
@EntityGraph(attributePaths = {"orders"})
Optional<Customer> findWithOrdersById(Long id);
```

**Equivalent to `JOIN FETCH`** but declarative — no query string needed.

**Multiple paths:**

```java
@EntityGraph(attributePaths = {"orders", "orders.items"})
List<Customer> findWithOrdersAndItems();
```

**Best for:** keeping queries in the repository interface, no JPQL.

### 3. `@BatchSize` — batched fetching

Instead of one query per parent, fetch children in batches of N.

**On the entity:**

```java
@Entity
public class Customer {
    @OneToMany(mappedBy = "customer")
    @BatchSize(size = 25)
    private List<Order> orders;
}
```

**Globally in properties:**

```properties
spring.jpa.properties.hibernate.default_batch_fetch_size=25
```

**Generated SQL:**

```sql
SELECT * FROM customers;
SELECT * FROM orders WHERE customer_id IN (1, 2, 3, ..., 25);
SELECT * FROM orders WHERE customer_id IN (26, 27, ..., 50);
-- ... one per 25 customers
```

For 1,000 customers, this is 1 + 40 queries = 41 (vs 1,001).

**Best for:** lazy loading that can't be join-fetched (e.g., paginated
results).

**Interview line:** *"`@BatchSize` reduces N+1 to N/batchSize + 1 — not as
good as join fetch, but works with pagination."*

### 4. Projections / DTOs — fetch only what you need

```java
public record OrderSummary(Long id, BigDecimal total, String customerName) { }

@Query("""
    SELECT new com.example.OrderSummary(o.id, o.total, c.name)
    FROM Order o JOIN o.customer c
    """)
List<OrderSummary> findSummaries();
```

**One query, one projection.** Bypasses the entity graph entirely.

**Best for:** read-only views, reporting, API responses.

### 5. `@Subselect` / views / native queries

For complex cases, define a read-only view:

```java
@Entity
@Subselect("SELECT c.id, c.name, COUNT(o.id) AS order_count " +
           "FROM customers c LEFT JOIN orders o ON o.customer_id = c.id " +
           "GROUP BY c.id, c.name")
@Synchronize({"customers", "orders"})
public class CustomerWithOrderCount { ... }
```

Rare. Prefer projections.

---

## `JOIN FETCH` vs `@EntityGraph` vs `@BatchSize`

| Approach | Queries | Pagination | Best for |
|---|---|---|---|
| `JOIN FETCH` | 1 | ❌ (in-memory paging) | Small result sets, must-fetch-children |
| `@EntityGraph` | 1 | ❌ (same issue) | Repository-level declarative |
| `@BatchSize` | 1 + N/size | ✅ | Paginated results, collections |
| Projections | 1 | ✅ | Read-only DTOs |
| Lazy (default) | 1 + N | ✅ | When you don't access children |

**Interview line:** *"`JOIN FETCH` fixes N+1 but breaks pagination; `@BatchSize`
fixes N+1 and keeps pagination."*

---

## Complete Example — Before and After

### Before (N+1)

```java
// Repository
List<Customer> customers = customerRepo.findAll();

// Service
List<CustomerDto> dtos = customers.stream()
        .map(c -> new CustomerDto(c.getName(), c.getOrders().size()))
        .toList();
```

**SQL:**

```sql
SELECT * FROM customers;                         -- 1
SELECT * FROM orders WHERE customer_id = 1;      -- N
SELECT * FROM orders WHERE customer_id = 2;
SELECT * FROM orders WHERE customer_id = 3;
-- ...
```

### After (JOIN FETCH)

```java
// Repository
@Query("SELECT DISTINCT c FROM Customer c LEFT JOIN FETCH c.orders")
List<Customer> findAllWithOrders();

// Service
List<CustomerDto> dtos = customerRepo.findAllWithOrders().stream()
        .map(c -> new CustomerDto(c.getName(), c.getOrders().size()))
        .toList();
```

**SQL:**

```sql
SELECT DISTINCT c.*, o.*
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```

**1 query.**

### After (Projection — even better for read-only)

```java
public record CustomerSummary(String name, long orderCount) { }

@Query("""
    SELECT new com.example.CustomerSummary(c.name, COUNT(o))
    FROM Customer c
    LEFT JOIN c.orders o
    GROUP BY c.id, c.name
    """)
List<CustomerSummary> findCustomerSummaries();
```

**1 query, only the needed columns.**

---

## Pagination + N+1 — The Tricky Case

```java
@Query("SELECT c FROM Customer c JOIN FETCH c.orders")
Page<Customer> findAllWithOrders(Pageable pageable);
```

**Hibernate warning:**

```text
HHH90003004: firstResult/maxResults specified with collection fetch; applying in memory
```

**Why:** Hibernate can't push `LIMIT`/`OFFSET` to the DB when the parent rows
are duplicated by the join. It fetches everything and paginates in memory —
often worse than N+1.

### The correct pattern

**Step 1:** Paginate IDs (or parents without the collection):

```java
@Query("SELECT c.id FROM Customer c")
Page<Long> findCustomerIds(Pageable pageable);
```

**Step 2:** Fetch parents + children by IDs:

```java
@Query("SELECT DISTINCT c FROM Customer c LEFT JOIN FETCH c.orders WHERE c.id IN :ids")
List<Customer> findByIdsWithOrders(@Param("ids") List<Long> ids);
```

**Two queries total** (plus one count for `Page`). No in-memory paging.

### Alternative — `@BatchSize` with pagination

```java
@EntityGraph(attributePaths = "orders")
Page<Customer> findAll(Pageable pageable);
```

This works if Hibernate can push the limit — usually only for `@ManyToOne`,
not `@OneToMany`.

**Best rule:** paginate parents with `@ManyToOne` fetch joins (safe);
paginate parents with `@OneToMany` using `@BatchSize`.

---

## Bidirectional Relationship Pitfalls

```java
@Entity
public class Customer {
    @OneToMany(mappedBy = "customer", cascade = ALL)
    private List<Order> orders;
}

@Entity
public class Order {
    @ManyToOne(fetch = LAZY)
    private Customer customer;
}
```

**Both sides default to loading each other's state.** If you fetch customers
and access `orders`, then for each order access `customer`, you get a cascade
of N+1.

**Fix:** use projections for the DTO layer. Never expose entities directly to
the web.

---

## The DTO-Only Rule

**The single most effective N+1 prevention:**

**Never return JPA entities from controllers.** Always map to DTOs inside
the transactional service, using a query that fetches exactly what's needed.

```java
@Transactional(readOnly = true)
public List<OrderDto> getOrders(long customerId) {
    return orderRepo.findDtosByCustomerId(customerId);
}
```

```java
@Query("""
    SELECT new com.example.OrderDto(o.id, o.total, o.customer.name)
    FROM Order o
    WHERE o.customer.id = :customerId
    """)
List<OrderDto> findDtosByCustomerId(@Param("customerId") long customerId);
```

**One query. No lazy loading. No N+1. No accidental data exposure.**

---

## Jackson Serialization N+1

**The hidden trap:** you return entities with lazy collections from a
controller, and **Jackson serializes them**. Jackson touches every lazy
collection → N+1 → or `LazyInitializationException` if the session is
closed.

**Fix:** DTOs. Or `@JsonIgnore` on lazy fields. Or `spring.jpa.open-in-view=false`
+ DTOs.

**Interview line:** *"Jackson serialization can trigger N+1 if you return
entities with lazy collections."*

---

## `spring.jpa.open-in-view`

Spring Boot defaults this to `true`. It keeps the Hibernate session open
during the entire request — including view rendering and Jackson serialization.

**Pros:** no `LazyInitializationException` in the controller.

**Cons:**

- Hides N+1 (lazy loads happen quietly during serialization)
- Holds DB connections longer
- Makes transactions implicit

**Recommendation:** set `spring.jpa.open-in-view=false` and use DTOs. This
forces you to fetch what you need explicitly.

**Interview line:** *"`open-in-view=true` hides N+1 — it's a common default
that experienced teams turn off."*

---

## Tricky Corners ⚠️

**`JOIN FETCH` + `Pageable` on a collection = in-memory paging.** Hibernate
warns about this. Use the two-step ID-then-fetch pattern.

**`@EntityGraph` with pagination** has the same limitation as `JOIN FETCH`
on `@OneToMany`.

**`@ManyToOne` is EAGER by default.** This can cause N+1 from the other side
— override to LAZY.

**`@OneToMany` is LAZY by default** — good.

**Jackson serializing entities** triggers lazy loads during serialization.

**`spring.jpa.open-in-view=true`** hides N+1 (silently loads lazy fields).

**`@BatchSize` on a collection** needs a global default or entity-level
annotation — it doesn't apply by itself.

**`default_batch_fetch_size`** is the property that enables batch fetching
globally. Boot doesn't set it by default.

**Bidirectional cycles in JSON** cause infinite recursion — use `@JsonIgnore`
or `@JsonManagedReference`/`@JsonBackReference`.

**`DISTINCT` in JPQL with `JOIN FETCH`** on `@OneToMany` avoids duplicate
parent rows (Hibernate deduplicates by default; `DISTINCT` helps some DBs).

**N+1 isn't only about `@OneToMany`** — `@ManyToOne`, `@OneToOne`,
`@ElementCollection` all have the same issue.

**`findAll()` on a `@ManyToMany`** can be even worse — cartesian products.

**Second-level cache** (Ehcache, Redis) doesn't prevent N+1 on cold caches.

---

## Common Pitfalls

- Not knowing what `open-in-view` does.
- Returning entities from controllers (Jackson triggers N+1).
- Using `JOIN FETCH` with `Pageable` on collections.
- Forgetting `@BatchSize` on a lazy collection that's accessed in a loop.
- Over-fetching with `@EntityGraph` — pulls more data than needed.
- Assuming `findAll()` is one query.
- Not enabling SQL logging in development.
- Ignoring `LazyInitializationException` by turning on `open-in-view`.
- Testing with small datasets (N+1 doesn't hurt) and shipping to prod
  (10,000x slower).

---

## Key Interview Tips

- Define N+1 in one sentence.
- Explain the **four main fixes** in order: `JOIN FETCH`, `@EntityGraph`,
  `@BatchSize`, projections.
- Say **"`JOIN FETCH` breaks pagination on `@OneToMany`."**
- Explain the two-step ID-then-fetch pattern for paginated joins.
- Know that `open-in-view=true` hides N+1 — turn it off for serious apps.
- Mention that **DTOs prevent N+1** — the most robust approach.
- Say "Jackson serialization of entities triggers N+1."
- Know that `default_batch_fetch_size` is required for global batch fetching.

---

## Related

- [Spring Data JPA](spring-data-jpa.md) — repository patterns and `@Query`
- [Batch Processing](batch-processing.md) — bulk operations and flushing
- [Transaction Management](../transactions/transaction-management.md) — lazy
  loading requires a session
- [Configuration](../boot/configuration.md) — `spring.jpa.open-in-view` and
  related properties