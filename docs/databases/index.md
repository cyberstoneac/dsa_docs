# Databases

> **Context:** At 13 YOE, database questions are not "what's a JOIN?" They're about data modeling, indexing strategy, transaction isolation, replication, sharding, and the operational decisions that shape a system. This section covers the essentials of the two databases you'll most likely use: PostgreSQL and MongoDB.

## Mental Model

A database is not a black box. It is a **durability + query + concurrency** engine. Understanding the internals of these three pillars is what separates a senior engineer from a lead.

```d2
direction: right

db: "Database {\\n  storage: Storage\\n  query: Query Engine\\n  tx: Transactions\\n  repl: Replication\\n}"

storage -> query
query -> tx
tx -> repl
```

## The Two Databases

| Dimension | PostgreSQL | MongoDB |
|---|---|---|
| Model | Relational (tables, rows) | Document (collections, BSON) |
| Schema | Enforced, migrations | Flexible, per-document |
| Transactions | ACID across tables | Multi-document ACID since 4.0 |
| Joins | Native | `$lookup` (limited) |
| Query language | SQL | MQL / aggregation pipeline |
| Indexing | B-tree, GIN, GiST, BRIN, Hash | B-tree, text, geospatial, wildcard |
| Horizontal scale | Harder (Citus, sharding) | Native sharding |
| Consistency | Strong by default | Tunable (read/write concern) |
| Best for | Transactional, relational, integrity | Document-shaped, flexible schema, high write scale |

**Rule:** default to **PostgreSQL** for 95% of workloads. Choose MongoDB when the data is naturally document-shaped and access is key-based.

## What Every Lead Should Know About Databases

1. **Model the data first.** The schema constrains what's easy and what's painful forever.
2. **Index for reads, but know the write cost.** Every index slows writes.
3. **Transactions have isolation levels.** Know what they mean and their anomalies.
4. **Replication lag is real.** Reads from replicas can be stale.
5. **Sharding is hard.** Only do it when a single node can't keep up.
6. **Backups must be tested.** Restores are the real test.
7. **Observability first.** Slow query logs, connection pool metrics, replication lag.
8. **N+1 is the most common performance bug.** Fix it with joins or batch loads.

## Indexing Basics

An index is a data structure that speeds up reads at the cost of write throughput and storage.

| Type | Use |
|---|---|
| **B-tree** | Equality, range, sorting |
| **Hash** | Equality only |
| **GIN** | Full-text, JSONB, arrays |
| **GiST** | Geospatial, full-text |
| **BRIN** | Large, ordered tables (time-series) |
| **Composite** | Multi-column queries — order matters |

**Rules:**
- **Index the columns you filter and join on.**
- **Composite index order matters** — leftmost prefix rule.
- **Covering indexes** include all columns the query needs.
- **Every index costs write throughput and storage.**
- **Unused indexes are debt** — monitor and drop them.
- **Partial indexes** for selective queries (`WHERE status = 'active'`).

## Transactions and Isolation

The SQL standard defines four isolation levels:

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| Read uncommitted | Yes | Yes | Yes |
| Read committed | No | Yes | Yes |
| Repeatable read | No | No | Yes (Postgres: no) |
| Serializable | No | No | No |

**Postgres default:** Read Committed.
**MongoDB:** Tunable via read/write concerns.

**Rules:**
- **Read committed is the default** and correct for most OLTP.
- **Serializable for financial operations**, but expect retries on serialization failures.
- **Postgres `repeatable read`** actually prevents phantoms (stronger than the standard).
- **Know your anomalies:** dirty read, non-repeatable read, phantom, write skew, lost update.

## Replication

```d2
direction: right

primary: "Primary\\n(writes + reads)"
replica1: "Replica 1\\n(reads)"
replica2: "Replica 2\\n(reads)"

primary -> replica1
primary -> replica2
```

| Mode | Lag | Durability |
|---|---|---|
| Synchronous | None | Higher (waits for replica) |
| Asynchronous | Some | Lower (data loss on primary failure) |
| Quorum | Small | Balanced |

**Rules:**
- **Async replication = data loss on failover.** Acceptable for reads, not for writes.
- **Sync replication = higher write latency.** Needed for zero-RPO.
- **Replication lag causes stale reads.** Route reads that need freshness to primary.
- **Read replicas scale reads, not writes.**

## Sharding

Splitting data across multiple nodes.

| Strategy | Notes |
|---|---|
| **Range** | Simple, but hot spots |
| **Hash** | Uniform, but range queries suffer |
| **Directory** | Flexible, but requires lookup |
| **Geographic** | Data residency |

**Rules:**
- **Shard when a single node can't keep up** with writes.
- **Choose a shard key carefully.** It's hard to change.
- **Cross-shard queries are expensive.** Design access patterns around the shard key.
- **Cross-shard transactions require sagas.**
- **Resharding is painful.** Plan for it.

## Connection Pooling

Every DB connection is expensive. Pool them.

| Concept | Notes |
|---|---|
| Pool size | `connections = (cores * 2) + effective_spindles` (rough) |
| Too small | Requests queue |
| Too large | DB thrashes |
| PgBouncer | External pooler for Postgres |
| HikariCP | Default in Spring Boot |

**Rules:**
- **Every service has a connection pool.** Size it based on DB capacity, not client count.
- **PgBouncer** for many clients (transaction pooling).
- **Monitor pool utilization.** Saturation = latency.
- **Close connections properly.** Leaks kill DBs.

## Observability

| Metric | Why |
|---|---|
| Query latency (p50, p99) | User-facing performance |
| Slow queries | Where time goes |
| Connection pool usage | Saturation |
| Replication lag | Stale reads |
| Cache hit ratio | Buffer pool effectiveness |
| Write throughput | Capacity planning |
| Lock waits / deadlocks | Contention |

**Rules:**
- Enable slow query logging.
- Use `pg_stat_statements` (Postgres) for query analysis.
- Monitor replica lag — alert on > threshold.
- Track connection pool utilization.

## Anti-Patterns

- **N+1 queries** — the most common performance bug.
- **No indexes on foreign keys** — joins get slow.
- **Too many indexes** — writes slow.
- **Storing files in the DB** — use object storage.
- **Using the DB as a queue** — use Kafka/SQS.
- **Schema changes without migrations** — chaos.
- **Cross-shard joins** — architectural smell.
- **Unbounded queries** — always `LIMIT`.

## Tricky Corners ⚠️

- **Every index costs writes.** More isn't better.
- **Composite index order matters.** Leftmost prefix rule.
- **Query planner chooses the index** — statistics matter.
- **Replica lag causes stale reads.** Route critical reads to primary.
- **Async replication = data loss risk.**
- **Connection pool size is a DB capacity decision**, not a client count.
- **Transactions across shards require sagas.**
- **Schema migrations must be backward-compatible** (expand-contract).
- **Vacuuming matters in Postgres.** Autovacuum tuning is real.
- **MongoDB read/write concerns define durability.**
- **Backups must be tested.** An untested backup is not a backup.

## Key Interview Tips

- Lead with **"databases are durability + query + concurrency engines."**
- For "how do you choose SQL vs NoSQL?", answer **"default to Postgres; choose NoSQL for a specific reason — document-shaped data, huge write scale, or managed global scale."**
- For "how do you handle scale?", answer **"vertical first, read replicas, caching, partition, then shard — in that order."**
- For "how do you ensure data integrity?", answer **"transactions with the right isolation level, constraints, and idempotent writes."**
- For "how do you handle connection management?", answer **"connection pool per service, PgBouncer for many clients, monitor saturation."**
- For "how do you handle migrations?", answer **"expand-contract, backward-compatible with the running app."**
- Always mention **indexing costs**, **replication lag**, and **connection pool sizing**.

## Related

- [Databases index](index.md)
- [PostgreSQL Essentials](postgresql-essentials.md)
- [MongoDB Essentials](mongodb-essentials.md)
- [System Design Depth → Capacity Planning](../system-design-depth/capacity-planning.md)