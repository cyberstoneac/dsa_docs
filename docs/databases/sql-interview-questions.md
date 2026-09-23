# SQL Interview Questions

> **JDK context:** Not applicable — this file is database-specific. Tested against PostgreSQL 15+. Most queries also work on MySQL 8 with minor syntax differences, noted where relevant.

## Mental Model

SQL interview questions fall into five buckets:

```d2
direction: right

basics: "Basics\nSELECT, WHERE, ORDER BY, LIMIT"
aggregation: "Aggregation\nGROUP BY, HAVING, aggregate functions"
joins: "Joins\nINNER, LEFT, self-joins"
windows: "Window Functions\nROW_NUMBER, RANK, LAG, LEAD"
advanced: "Advanced\nCTEs, recursive CTEs, pivots"
coalesce: "Query Patterns\nNth highest, duplicates, gaps, top-N per group"

basics -> aggregation
aggregation -> joins
joins -> windows
windows -> advanced
advanced -> coalesce
```

**Rule:** most "hard" SQL interview questions are one of these five patterns in disguise. Once you can recognize which bucket a question belongs to, the answer is usually 3–6 lines.

## The Standard Schema

All examples below use this schema. Assume it's populated with realistic data.

```sql
CREATE TABLE employees (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  department  TEXT NOT NULL,
  salary      NUMERIC(12, 2) NOT NULL,
  manager_id  BIGINT REFERENCES employees(id),
  hired_on    DATE NOT NULL
);

CREATE TABLE departments (
  name        TEXT PRIMARY KEY,
  location    TEXT NOT NULL
);

CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL,
  status      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 1. Second Highest Salary

**Question:** Find the second highest salary from the `employees` table.

**Answer (with window function — preferred):**

```sql
SELECT salary
FROM (
  SELECT salary,
         DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
  FROM employees
) ranked
WHERE rnk = 2;
```

**Why `DENSE_RANK` and not `ROW_NUMBER`?**

| Function | Ties | Result for salaries `[100, 100, 90]`, Nth = 2 |
|---|---|---|
| `ROW_NUMBER()` | Arbitrary tiebreak | Returns 100 (second row) |
| `RANK()` | Same rank for ties, gaps after | Returns 90 (rank 3) |
| `DENSE_RANK()` | Same rank for ties, no gaps | Returns 90 (rank 2) |

**Rule:** "Nth highest salary" almost always means **Nth distinct value** → `DENSE_RANK`.

**Answer (without window functions — classic):**

```sql
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

**Edge cases:**

- If there's only one distinct salary, both queries return no rows (or NULL).
- To return NULL instead of no rows:

```sql
SELECT (
  SELECT salary
  FROM (
    SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
    FROM employees
  ) r
  WHERE rnk = 2
  LIMIT 1
) AS second_highest;
```

**Follow-up: Nth highest salary (parameterized)** — see section 7.

## 2. Nth Highest Salary

**Question:** Find the Nth highest salary, where N is a parameter.

```sql
-- PostgreSQL: parameterize with a CTE or a function
CREATE OR REPLACE FUNCTION nth_highest_salary(n INT)
RETURNS NUMERIC AS $$
  SELECT salary
  FROM (
    SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
    FROM employees
  ) r
  WHERE rnk = n
  LIMIT 1;
$$ LANGUAGE SQL;
```

```sql
SELECT nth_highest_salary(3);
```

**Rule:** `DENSE_RANK` + `WHERE rnk = n` is the canonical answer. `LIMIT 1 OFFSET n-1` is wrong in the presence of ties.

## 3. Top N Salaries per Department

**Question:** For each department, find the top 2 highest-paid employees.

```sql
SELECT department, name, salary
FROM (
  SELECT department, name, salary,
         ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
  FROM employees
) ranked
WHERE rn <= 2
ORDER BY department, salary DESC;
```

**Why `ROW_NUMBER` here and not `DENSE_RANK`?**

- "Top 2 employees" means 2 **rows**, not 2 distinct salaries.
- If two employees tie for first, `ROW_NUMBER` still returns 2 rows.

**Variation — top 2 distinct salaries per department:**

```sql
SELECT department, name, salary
FROM (
  SELECT department, name, salary,
         DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rnk
  FROM employees
) ranked
WHERE rnk <= 2;
```

**Rule:** "top N rows" → `ROW_NUMBER`. "top N distinct values" → `DENSE_RANK`.

## 4. Find Duplicates

**Question:** Find all duplicate email addresses in a `users` table.

```sql
SELECT email, COUNT(*) AS occurrences
FROM users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;
```

**Question:** Delete duplicates, keeping the row with the smallest `id`.

```sql
DELETE FROM users
WHERE id NOT IN (
  SELECT MIN(id)
  FROM users
  GROUP BY email
);
```

**Postgres alternative (more efficient on large tables):**

```sql
DELETE FROM users u
USING users d
WHERE u.email = d.email
  AND u.id > d.id;
```

**Rule:** duplicates are always "GROUP BY + HAVING COUNT(*) > 1" or "self-join on the key + keep one row."

## 5. Employees Earning More Than Their Manager

**Question:** Find employees who earn more than their manager.

```sql
SELECT e.name AS employee, e.salary AS emp_salary,
       m.name AS manager,  m.salary AS mgr_salary
FROM employees e
JOIN employees m ON e.manager_id = m.id
WHERE e.salary > m.salary;
```

**Rule:** this is a **self-join** — the same table joined to itself under two aliases. Self-joins are the answer for any "compare a row to another row in the same table" question.

## 6. Department with the Highest Average Salary

**Question:** Which department has the highest average salary?

```sql
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department
ORDER BY avg_salary DESC
LIMIT 1;
```

**Variation — return all departments tied for the highest:**

```sql
SELECT department, avg_salary
FROM (
  SELECT department,
         AVG(salary) AS avg_salary,
         RANK() OVER (ORDER BY AVG(salary) DESC) AS rnk
  FROM employees
  GROUP BY department
) r
WHERE rnk = 1;
```

**Rule:** when a question says "the highest" and ties are possible, use `RANK` or `DENSE_RANK` over the aggregate.

## 7. Employees with No Manager (or No Department)

**Question:** Find employees with no manager.

```sql
SELECT name
FROM employees
WHERE manager_id IS NULL;
```

**Question:** Find departments with no employees.

```sql
SELECT d.name
FROM departments d
LEFT JOIN employees e ON e.department = d.name
WHERE e.id IS NULL;
```

**Rule:** "find rows with no matching rows" = `LEFT JOIN ... WHERE right.id IS NULL`, or `NOT EXISTS`.

```sql
-- Equivalent with NOT EXISTS (usually faster on large tables)
SELECT d.name
FROM departments d
WHERE NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.department = d.name
);
```

## 8. Running Total

**Question:** Show each employee's salary and the running total of salaries, ordered by hire date.

```sql
SELECT name, hired_on, salary,
       SUM(salary) OVER (ORDER BY hired_on, id) AS running_total
FROM employees
ORDER BY hired_on, id;
```

**With reset per department:**

```sql
SELECT name, department, salary,
       SUM(salary) OVER (
         PARTITION BY department
         ORDER BY hired_on, id
       ) AS dept_running_total
FROM employees
ORDER BY department, hired_on, id;
```

**Rule:** `SUM(...) OVER (ORDER BY ...)` = running total. Add `PARTITION BY` to reset per group.

## 9. Rank Without Gaps vs With Gaps

**Question:** Rank employees by salary within their department.

```sql
SELECT name, department, salary,
       ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
       RANK()       OVER (PARTITION BY department ORDER BY salary DESC) AS rnk,
       DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_rnk
FROM employees;
```

Example output for salaries `[100, 100, 90]`:

| name | salary | row_num | rnk | dense_rnk |
|---|---|---|---|---|
| A | 100 | 1 | 1 | 1 |
| B | 100 | 2 | 1 | 1 |
| C | 90 | 3 | 3 | 2 |

**Rule:** choose based on whether ties should share a rank and whether the next rank should skip a number.

## 10. Year-over-Year Comparison

**Question:** Show each employee's salary and the previous year's salary (assume a `salaries` table with `employee_id`, `year`, `amount`).

```sql
SELECT employee_id, year, amount,
       LAG(amount) OVER (PARTITION BY employee_id ORDER BY year) AS prev_amount,
       amount - LAG(amount) OVER (PARTITION BY employee_id ORDER BY year) AS delta
FROM salaries
ORDER BY employee_id, year;
```

**Rule:** `LAG` / `LEAD` for "compare to previous/next row." Add `PARTITION BY` for per-entity comparisons.

## 11. Consecutive Numbers

**Question:** Find all numbers that appear at least three times consecutively in a `logs` table.

```sql
SELECT DISTINCT num AS consecutive_num
FROM (
  SELECT num,
         LAG(num, 1) OVER (ORDER BY id) AS prev1,
         LAG(num, 2) OVER (ORDER BY id) AS prev2
  FROM logs
) t
WHERE num = prev1 AND num = prev2;
```

**Rule:** "N consecutive" = N-1 `LAG` calls compared to the current row.

## 12. Median Salary

**Question:** Find the median salary.

**Postgres (built-in):**

```sql
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median
FROM employees;
```

**Portable (window functions):**

```sql
SELECT AVG(salary) AS median
FROM (
  SELECT salary,
         ROW_NUMBER() OVER (ORDER BY salary) AS rn,
         COUNT(*)     OVER ()                  AS total
  FROM employees
) t
WHERE rn IN ((total + 1) / 2, (total + 2) / 2);
```

**Rule:** for an even number of rows, the median is the average of the two middle values.

## 13. Cumulative Distribution / Percentile

**Question:** For each employee, show what percentile their salary is in.

```sql
SELECT name, salary,
       PERCENT_RANK() OVER (ORDER BY salary) AS pct_rank,
       CUME_DIST()    OVER (ORDER BY salary) AS cume_dist,
       NTILE(4)       OVER (ORDER BY salary) AS quartile
FROM employees;
```

| Function | Meaning |
|---|---|
| `PERCENT_RANK` | `(rank - 1) / (total - 1)` — 0 to 1 |
| `CUME_DIST` | Fraction of rows ≤ current row |
| `NTILE(n)` | Bucket number (1..n) |

## 14. Employees Who Joined in the Last 30 Days

```sql
SELECT name, hired_on
FROM employees
WHERE hired_on >= CURRENT_DATE - INTERVAL '30 days';
```

**Rule:** use `CURRENT_DATE` and `INTERVAL` in Postgres. In MySQL, use `DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)`.

## 15. Pivot Rows to Columns

**Question:** Count employees per department per year, one row per department, one column per year.

```sql
SELECT
  department,
  COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM hired_on) = 2024) AS hires_2024,
  COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM hired_on) = 2025) AS hires_2025,
  COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM hired_on) = 2026) AS hires_2026
FROM employees
GROUP BY department;
```

**Rule:** Postgres supports `FILTER` on aggregates, which is the cleanest way to pivot without `CASE WHEN` gymnastics.

```sql
-- Portable version using CASE
SELECT
  department,
  SUM(CASE WHEN EXTRACT(YEAR FROM hired_on) = 2024 THEN 1 ELSE 0 END) AS hires_2024,
  SUM(CASE WHEN EXTRACT(YEAR FROM hired_on) = 2025 THEN 1 ELSE 0 END) AS hires_2025
FROM employees
GROUP BY department;
```

## 16. Recursive CTE: Employee Hierarchy

**Question:** Print the management chain from a given employee up to the CEO.

```sql
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 0 AS level
  FROM employees
  WHERE id = 42

  UNION ALL

  SELECT e.id, e.name, e.manager_id, c.level + 1
  FROM employees e
  JOIN chain c ON e.id = c.manager_id
)
SELECT * FROM chain ORDER BY level;
```

**Rule:** recursive CTEs are the answer for hierarchies, org charts, category trees, and graph traversal.

## 17. Gaps in a Sequence

**Question:** Find missing IDs in the `orders` table between the min and max.

```sql
SELECT gs.id AS missing_id
FROM generate_series(
  (SELECT MIN(id) FROM orders),
  (SELECT MAX(id) FROM orders)
) AS gs(id)
LEFT JOIN orders o ON o.id = gs.id
WHERE o.id IS NULL;
```

**Rule:** `generate_series` (Postgres) or a numbers table makes gap-finding trivial.

## 18. Running Distinct Count

**Question:** For each day, count the number of **distinct** customers who ordered.

```sql
SELECT
  DATE(created_at) AS day,
  COUNT(DISTINCT customer_id) AS distinct_customers
FROM orders
GROUP BY DATE(created_at)
ORDER BY day;
```

**Window version — cumulative distinct customers:**

```sql
SELECT DISTINCT
  DATE(created_at) AS day,
  COUNT(DISTINCT customer_id) OVER (
    ORDER BY DATE(created_at)
  ) AS cumulative_distinct_customers
FROM orders
ORDER BY day;
```

**Rule:** `COUNT(DISTINCT ...) OVER (...)` is supported in Postgres but not all databases. In MySQL, use a two-step CTE.

## 19. Find the Latest Row per Group

**Question:** For each customer, find their most recent order.

```sql
SELECT DISTINCT ON (customer_id)
  customer_id, id, amount, created_at
FROM orders
ORDER BY customer_id, created_at DESC;
```

**Postgres-only** — `DISTINCT ON` is fast and clean.

**Portable version with window function:**

```sql
SELECT customer_id, id, amount, created_at
FROM (
  SELECT customer_id, id, amount, created_at,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
  FROM orders
) t
WHERE rn = 1;
```

**Rule:** "latest/earliest row per group" is one of the most common interview questions. Know both forms.

## 20. Cumulative Sum with a Condition

**Question:** Show orders for a customer, with a running total of only `PAID` orders.

```sql
SELECT id, customer_id, status, amount,
       SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END)
         OVER (PARTITION BY customer_id ORDER BY created_at, id) AS paid_running_total
FROM orders
ORDER BY customer_id, created_at, id;
```

**Rule:** combine `CASE` inside an aggregate window function to conditionally sum.

## 21. Delete vs Truncate vs Drop

**Question:** What's the difference?

| Command | Removes | Rollback? | Resets identity? | Triggers? |
|---|---|---|---|---|
| `DELETE` | Rows matching `WHERE` | Yes (in a tx) | No | Yes (row triggers) |
| `TRUNCATE` | All rows | In Postgres, yes | Yes | No (statement triggers only) |
| `DROP` | Table + data + schema | In a tx, yes | N/A | N/A |

**Rule:** use `DELETE` when you need row triggers or selective removal; `TRUNCATE` for fast bulk clearing; `DROP` to remove the table.

## 22. Index-Only vs Full Scan

**Question:** How do you know if a query is using an index?

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT name FROM employees WHERE department = 'Engineering';
```

Look for:

- `Index Scan` / `Index Only Scan` — good.
- `Seq Scan` on a large table — probably needs an index.
- `Bitmap Heap Scan` — combining multiple indexes.
- `Rows Removed by Filter` — index isn't selective enough.

**Rule:** always run `EXPLAIN ANALYZE`, look at estimated vs actual rows, and check for sequential scans on large tables.

## 23. Transaction Isolation Levels

**Question:** What are the SQL isolation levels and their anomalies?

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| Read uncommitted | Yes | Yes | Yes |
| Read committed (Postgres default) | No | Yes | Yes |
| Repeatable read | No | No | Yes (Postgres: no) |
| Serializable | No | No | No |

**Rule:** `READ COMMITTED` is the default and correct for most OLTP. `SERIALIZABLE` for financial invariants, with retries on serialization failures.

## 24. N+1 Query Detection

**Question:** What is an N+1 query and how do you detect it?

N+1: one query to fetch N parent rows, then N more queries to fetch children (one per parent).

**Detection:**

- Enable query logging and look for repeated identical queries with different IDs.
- Use Postgres `pg_stat_statements` — high `calls` count with small `mean_exec_time`.
- In Spring/Hibernate, enable `spring.jpa.show-sql` and count.

**Fix:**

- Use `JOIN FETCH` in JPQL or a single query with a join.
- Use `@EntityGraph` in Spring Data JPA.
- Use batch loading (`@BatchSize`, `hibernate.default_batch_fetch_size`).

## 25. Slow Query Triage

**Question:** A query is slow. How do you debug it?

1. `EXPLAIN (ANALYZE, BUFFERS)` — actual plan, not estimated.
2. Look for sequential scans on large tables → add an index.
3. Check for stale statistics → `ANALYZE table`.
4. Look for a bad join order → hints, rewrite, or add statistics.
5. Check for lock contention → `pg_locks`, `pg_stat_activity`.
6. Check for bloat → `VACUUM`, tune autovacuum.
7. Check connection pool saturation → PgBouncer.
8. Check for N+1 → app-level fix.

**Rule:** always start with `EXPLAIN ANALYZE`. Never tune blind.

## Tricky Corners ⚠️

- **`ROW_NUMBER` vs `RANK` vs `DENSE_RANK`** — the single most common interview trap. Know the difference cold.
- **`COUNT(*)` vs `COUNT(col)`** — `COUNT(*)` counts rows; `COUNT(col)` counts non-null values of `col`.
- **`NULL` comparisons** — `NULL = NULL` is `NULL` (unknown), not true. Use `IS NULL`.
- **`NULL` in aggregates** — `SUM`, `AVG`, `COUNT` ignore NULLs. `COUNT(*)` does not.
- **`GROUP BY` with `HAVING`** — `WHERE` filters rows before grouping; `HAVING` filters groups after.
- **`DISTINCT` + `ORDER BY`** — in some databases, the `ORDER BY` column must be in the `SELECT` list.
- **`LIMIT` without `ORDER BY`** — non-deterministic. Always `ORDER BY` before `LIMIT`.
- **`NOT IN` with NULLs** — `x NOT IN (1, 2, NULL)` is always unknown → no rows. Prefer `NOT EXISTS`.
- **Self-join needs aliases** — and be careful with `ON` vs `WHERE` conditions.
- **Recursive CTEs can infinite-loop** — always have a termination condition or a depth limit.
- **`EXPLAIN` vs `EXPLAIN ANALYZE`** — the former estimates, the latter actually runs the query (and can be slow / have side effects on writes).
- **`FILTER` is Postgres-only** — portable code uses `CASE WHEN`.

## Common Pitfalls

- Using `LIMIT 1 OFFSET n-1` for "Nth highest salary" — breaks on ties.
- Using `ROW_NUMBER` when `DENSE_RANK` was intended (or vice versa).
- Forgetting `PARTITION BY` in window functions — the window runs over the whole table.
- Using `NOT IN` with a subquery that can return NULL.
- Writing a self-join with `WHERE` instead of `ON` — turns an outer join into an inner join.
- Assuming all databases support `DISTINCT ON`, `FILTER`, or `PERCENTILE_CONT` — most don't.
- Writing `SELECT *` in a hot query — breaks covering indexes.
- Comparing dates as strings — always use date/timestamp types.
- Using `HAVING` when `WHERE` would do — `WHERE` filters earlier and is cheaper.
- Forgetting that `AVG` ignores NULLs — the denominator is non-null rows.

## Key Interview Tips

- For "Nth highest" — answer with **`DENSE_RANK`**, then explain the tie behavior.
- For "top N per group" — answer with **`ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)`** and filter `rn <= N`.
- For "duplicates" — answer with **`GROUP BY ... HAVING COUNT(*) > 1`**.
- For "compare a row to another row in the same table" — answer with **self-join**.
- For "latest row per group" — answer with **`DISTINCT ON` (Postgres)** or **`ROW_NUMBER`**.
- For "running total / running average" — answer with **`SUM/AVG(...) OVER (ORDER BY ...)`**.
- For "consecutive" — answer with **`LAG` compared to current row**.
- For "hierarchies" — answer with **recursive CTE**.
- For "pivot" — answer with **`FILTER` (Postgres)** or **`CASE WHEN`**.
- For "slow query" — always start with **`EXPLAIN ANALYZE`**.
- Mention **`NULL` handling**, **tie behavior**, and **database portability** as the follow-ups to expect.

## Related

- [Databases index](index.md)
- [PostgreSQL Essentials](postgresql-essentials.md)
- [MongoDB Essentials](mongodb-essentials.md)
- [System Design Depth → Capacity Planning](../system-design-depth/capacity-planning.md)
- [Spring Data → N+1 Problem](../spring/data/n-plus-one.md)