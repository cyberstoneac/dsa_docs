# PostgreSQL Essentials

> **Context:** PostgreSQL is the default OLTP database for 95% of use cases. At lead level, you should know its strengths, its internals at a useful level, its operational realities, and how to reason about performance.

## Mental Model

Postgres is a **process-per-connection, MVCC, WAL-based relational database**.



- **MVCC:** readers don't block writers; each transaction sees a snapshot.
- **WAL (Write-Ahead Log):** durability via a sequential log before data files.
- **Process-per-connection:** each connection is a backend process.
- **VACUUM:** reclaims dead tuples from MVCC.

```d2
direction: right

client: Client
postmaster: "Postmaster\\n(listens)"
backend: "Backend Process\\n(per connection)"
wal: "WAL\\n(sequential writes)"
heap: "Heap Files\\n(table storage)"
index: Indexes

client -> postmaster
postmaster -> backend
backend -> wal
backend -> heap
backend -> index
```

## Why Postgres Wins

- **ACID transactions** with strong isolation.
- **Rich SQL** — window functions, CTEs, JSONB, full-text.
- **Extensions:** PostGIS, TimescaleDB, pgvector, Citus.
- **JSONB** for flexible schema without leaving SQL.
- **Replication:** streaming, logical, synchronous.
- **Mature ecosystem:** every tool, every cloud.
- **Operational simplicity:** single binary, well-understood.

## Data Types You Should Know

| Type | Use |
|---|---|
| `BIGINT` | Primary keys (with identity) |
| `UUID` | Distributed IDs |
| `TIMESTAMPTZ` | Always timezone-aware |
| `JSONB` | Flexible, indexed with GIN |
| `TEXT` | Strings (no length limit needed) |
| `NUMERIC` | Money (never `FLOAT`) |
| `ARRAY` | Lists |
| `ENUM` | Fixed sets |
| `TSVECTOR` | Full-text search |

**Rules:**
- **Always use `TIMESTAMPTZ`**, never `TIMESTAMP`.
- **`NUMERIC` for money.** Floating point loses cents.
- **`JSONB` over `JSON`** — queryable, indexable.
- **`TEXT` over `VARCHAR(n)`** — the length check is rarely worth it.

## Indexing

| Type | Use |
|---|---|
| **B-tree** | Equality, range, sort (default) |
| **Hash** | Equality only |
| **GIN** | JSONB, arrays, full-text |
| **GiST** | Geospatial, ranges |
| **BRIN** | Large, ordered tables |
| **Partial** | Subset of rows |

### Composite index order

```sql
CREATE INDEX idx_orders_customer_status_created
  ON orders (customer_id, status, created_at DESC);
```

This index serves:
- `WHERE customer_id = ?`
- `WHERE customer_id = ? AND status = ?`
- `WHERE customer_id = ? AND status = ? ORDER BY created_at DESC`

It does **not** serve:
- `WHERE status = ?` (skips the leftmost column)

**Rule:** leftmost prefix rule. Order columns by selectivity and query pattern.

### Covering index

```sql
CREATE INDEX idx_orders_covering
  ON orders (customer_id, status) INCLUDE (total, created_at);
```

The query can be served entirely from the index (index-only scan).

### Partial index

```sql
CREATE INDEX idx_orders_active
  ON orders (customer_id, created_at)
  WHERE status = 'active';
```

Smaller, faster, only for the subset you query.

### Index anti-patterns

- Indexing every column.
- Indexing low-cardinality columns alone (e.g., boolean).
- Forgetting foreign key indexes.
- Not monitoring unused indexes (`pg_stat_user_indexes`).

## Transactions

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

### Isolation levels

| Level | Use |
|---|---|
| Read Committed (default) | Most OLTP |
| Repeatable Read | Consistent reads across a transaction |
| Serializable | Financial, invariants |

**Postgres specifics:**
- `READ COMMITTED` — each statement sees a fresh snapshot.
- `REPEATABLE READ` — the transaction sees one snapshot; prevents phantoms.
- `SERIALIZABLE` — uses SSI (Serializable Snapshot Isolation); expect retries.

**Rule:** use Serializable only when invariants require it; handle serialization failures with retry.

### Deadlocks

Postgres detects deadlocks and aborts one transaction. Handle with retry.

**Prevention:** access tables in consistent order, keep transactions short.

## Query Performance

### `EXPLAIN ANALYZE`

The single most important tool.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM orders WHERE customer_id = 42 AND status = 'active';
```

Read:
- **Seq Scan** — full table scan; bad for large tables.
- **Index Scan** — uses index.
- **Index Only Scan** — covering index; fastest.
- **Bitmap Heap Scan** — multiple index entries.
- **Nested Loop / Hash Join / Merge Join** — join strategies.
- **Rows estimate vs actual** — planner accuracy.

### Common performance issues

| Issue | Fix |
|---|---|
| Sequential scan on large table | Add index |
| Wrong index chosen | Update statistics (`ANALYZE`) |
| N+1 queries | Join or batch |
| Slow JSONB queries | GIN index |
| Missing index on FK | Add index |
| Bloated tables | `VACUUM` / `VACUUM FULL` |
| Long-running transactions | Shorten, retry |
| Lock contention | Reduce transaction scope |

### Statistics

```sql
ANALYZE orders;
```

The planner uses statistics to choose plans. Stale stats = bad plans.

## VACUUM and Bloat

MVCC keeps old versions until no transaction needs them. `VACUUM` reclaims space.



- **Autovacuum** is on by default; tune for high-write tables.
- **Bloat** — dead tuples not yet reclaimed.
- **Long-running transactions** block vacuum — they hold old snapshots.
- **`VACUUM FULL`** rewrites the table (locks); use rarely.

**Rules:**
- Monitor bloat.
- Tune autovacuum for hot tables.
- Avoid long-running idle transactions.

## Replication

### Streaming replication (physical)

- Byte-for-byte replica.
- Async or sync.
- Used for HA and read replicas.

### Logical replication

- Row-level, table-selective.
- Used for migrations, CDC, multi-master-ish setups.

**Rules:**
- **Async streaming = potential data loss** on primary failover.
- **Sync streaming = higher write latency** (waits for replica ack).
- **Replica lag causes stale reads.**
- **Read-your-writes** requires reading from primary or using session-based routing.

## Partitioning

Splitting large tables into smaller physical tables.

| Strategy | Use |
|---|---|
| Range | Time-series |
| List | Categorical (region) |
| Hash | Uniform distribution |

**Benefits:**
- Faster queries (partition pruning).
- Cheaper maintenance (drop old partitions).
- Parallel operations.

**Rules:**
- Partition when tables exceed ~100M rows or when retention requires it.
- Choose the partition key based on query patterns.
- Too many partitions hurt planner performance.

## Connection Management

- Postgres is process-per-connection — connections are expensive.
- **PgBouncer** for connection pooling (transaction mode).
- **HikariCP** in the app.
- **Pool size**: `connections = (cores * 2) + spindles`.

**Rule:** if you have 100 services × 10 connections = 1000 connections, you need PgBouncer.

## Backups and PITR

- **`pg_dump`** — logical backup; slow for large DBs.
- **`pg_basebackup`** — physical backup.
- **WAL archiving + PITR** — point-in-time recovery.
- **Managed services** (RDS, Cloud SQL) handle this.
- **Test restores quarterly.**

**Rule:** untested backup = no backup.

## Extensions Worth Knowing

| Extension | Use |
|---|---|
| **PostGIS** | Geospatial |
| **pgvector** | Vector search (AI/ML) |
| **TimescaleDB** | Time-series |
| **Citus** | Sharding |
| **pg_stat_statements** | Query analytics |
| **pgcrypto** | Encryption |
| **pg_trgm** | Fuzzy search |

**Rule:** Postgres is a platform. Many "we need a different database" problems are solved by an extension.

## Tricky Corners ⚠️

- **`TIMESTAMPTZ` always, never `TIMESTAMP`.**
- **`NUMERIC` for money, never `FLOAT`.**
- **B-tree composite index order matters.**
- **Leftmost prefix rule.**
- **Every index costs writes.**
- **`EXPLAIN ANALYZE` is your friend.**
- **Stale stats = bad plans.**
- **Long transactions block vacuum.**
- **Async replication can lose data.**
- **Replica reads can be stale.**
- **`VACUUM FULL` locks.**
- **Connection-per-process limits scale.**
- **`JSONB` is not a replacement for a schema.** Use it selectively.
- **Partitioning needs the right key.**
- **`SELECT *` breaks covering indexes and adds network.**

## Common Pitfalls

- `TIMESTAMP` instead of `TIMESTAMPTZ`.
- `FLOAT` for money.
- Missing index on foreign keys.
- Wrong composite index order.
- Too many indexes.
- `SELECT *` in hot queries.
- N+1 queries.
- Long-running transactions.
- Not analyzing stats.
- No PITR.
- No connection pooling.
- JSONB everywhere.

## Key Interview Tips

- Lead with **"Postgres is MVCC + WAL + process-per-connection."**
- For "how do you optimize a slow query?", answer **"EXPLAIN ANALYZE, check for seq scans, missing indexes, N+1, stale stats, bloat."**
- For "how do you choose an index?", answer **"query pattern first, then type: B-tree for equality/range, GIN for JSONB/full-text, partial for subsets, composite with the right column order."**
- For "how do you handle scale?", answer **"vertical first, then read replicas, caching, partitioning, and sharding as a last resort."**
- For "how do you ensure zero data loss?", answer **"synchronous replication + WAL archiving + tested PITR."**
- For "how do you handle connection pooling?", answer **"PgBouncer in transaction mode + HikariCP per service; size based on DB capacity."**
- Always mention **`TIMESTAMPTZ`**, **`NUMERIC`**, and **`EXPLAIN ANALYZE`**.

## Related

- [Databases index](index.md)
- [MongoDB Essentials](mongodb-essentials.md)
- [System Design Depth → Capacity Planning](../system-design-depth/capacity-planning.md)