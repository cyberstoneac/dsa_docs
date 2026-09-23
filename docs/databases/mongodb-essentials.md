# MongoDB Essentials

> **Context:** MongoDB is the right choice when data is naturally document-shaped, access is key-based, and schema varies. At lead level, you should know its data model, indexing, replication, sharding, consistency knobs, and the operational realities.

## Mental Model

MongoDB is a **document store with flexible schema, native sharding, and tunable consistency**.



- **Documents** — BSON objects, nested.
- **Collections** — groups of documents.
- **Databases** — groups of collections.
- **Replica sets** — HA via primary + secondaries.
- **Sharded clusters** — horizontal scale via shards + config servers + mongos.

```d2
direction: right

app: Application
mongos: "mongos\\n(query router)"
shard1: "Shard 1\\n(replica set)"
shard2: "Shard 2\\n(replica set)"
config: "Config Servers\\n(metadata)"

app -> mongos
mongos -> shard1
mongos -> shard2
mongos -> config
```

## When to Use MongoDB

| Use MongoDB when | Use Postgres when |
|---|---|
| Data is document-shaped (nested, variable) | Data is relational |
| Access is key-based | Complex joins, ad-hoc queries |
| Schema varies per record | Schema is stable |
| Massive write scale | ACID across tables |
| Horizontal scaling required | Single-node scale sufficient |
| Geo-distributed | Centralized |

**Rule:** MongoDB is not "Postgres without schema." It's a document store with different trade-offs.

## Data Modeling

MongoDB modeling is **access-pattern-driven**. You embed or reference based on how you read.

### Embed vs Reference

| Embed when | Reference when |
|---|---|
| Data is read together | Data is read separately |
| Child is small | Child is large |
| Child doesn't change often | Child changes frequently |
| 1:few relationship | 1:many or many:many |
| Bounded growth | Unbounded growth |

```json
// Embedded (order with line items)
{
  "_id": "o-9001",
  "customerId": "c-42",
  "status": "SHIPPED",
  "items": [
    { "sku": "A1", "qty": 2, "price": 19.99 },
    { "sku": "B2", "qty": 1, "price": 49.99 }
  ],
  "createdAt": "2026-06-14T10:00:00Z"
}
```

```json
// Referenced (order references customer)
{
  "_id": "o-9001",
  "customerId": "c-42",
  "status": "SHIPPED",
  "items": [...],
  "createdAt": "..."
}
```

**Rules:**
- **Embed what you read together.**
- **Reference what you read separately.**
- **Watch the 16 MB document limit.**
- **Unbounded arrays are a time bomb** (like order history in a user document).
- **Denormalize for reads; accept write complexity.**

## Indexing

MongoDB indexes are similar to Postgres B-trees but with specific types.

| Type | Use |
|---|---|
| **Single field** | Equality, sort |
| **Compound** | Multi-field queries (order matters) |
| **Multikey** | Array fields |
| **Text** | Full-text |
| **Geospatial** (`2dsphere`) | Location queries |
| **Wildcard** | Unknown fields |
| **TTL** | Auto-delete documents |

```javascript
// Compound index
db.orders.createIndex({ customerId: 1, status: 1, createdAt: -1 })

// TTL index (delete after 30 days)
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 })

// Partial index
db.orders.createIndex(
  { customerId: 1 },
  { partialFilterExpression: { status: "active" } }
)
```

**Rules:**
- **ESR rule for compound indexes:** Equality → Sort → Range.
- **Covered queries** — all fields in the index; no document fetch.
- **`explain("executionStats")`** to analyze.
- **TTL indexes** for ephemeral data (sessions, caches).
- **Wildcard indexes are expensive** — use sparingly.

## Replication (Replica Sets)

```d2
direction: right

primary: "Primary\\n(writes + reads)"
secondary1: "Secondary 1\\n(reads)"
secondary2: "Secondary 2\\n(reads)"

primary -> secondary1
primary -> secondary2
```



- **Primary** — accepts writes.
- **Secondaries** — replicate via oplog; can serve reads.
- **Arbiter** — votes in elections, holds no data (rarely recommended).
- **Election** — if primary fails, a secondary is promoted.

### Write concern

```javascript
db.orders.insertOne(doc, { writeConcern: { w: "majority", j: true } })
```

| `w` | Meaning |
|---|---|
| 1 | Primary acknowledged |
| majority | Majority of replica set |
| n | n nodes |

**Rules:**
- **`w: "majority"` for durability.**
- **`j: true` for journaled writes.**
- **`w: 1` is fast but risks data loss on failover.**

### Read concern

| Level | Meaning |
|---|---|
| local | Reads from local node (may be stale) |
| majority | Data acknowledged by majority |
| linearizable | Strongest, slowest |
| snapshot | Consistent snapshot across reads |

**Rule:** `majority` read concern for data that must be consistent.

### Read preference

| Preference | Use |
|---|---|
| primary | Read from primary (consistent) |
| primaryPreferred | Primary unless unavailable |
| secondary | Read from secondary (may be stale) |
| secondaryPreferred | Secondary unless unavailable |
| nearest | Lowest latency |

**Rule:** reads that need freshness → primary; reads that can tolerate staleness → secondary.

## Sharding

Horizontal scaling via a shard key.

| Concept | Meaning |
|---|---|
| **Shard key** | Field(s) used to distribute data |
| **Chunks** | Range of shard key values |
| **Balancer** | Moves chunks between shards |
| **mongos** | Query router |
| **Config servers** | Store cluster metadata |

### Shard key strategies

| Strategy | Use |
|---|---|
| **Hashed** | Uniform distribution; range queries suffer |
| **Ranged** | Range queries efficient; hot spots possible |
| **Compound** | Combine cardinality and query pattern |
| **Zoned** | Data residency, tiering |

**Rules:**
- **High cardinality** — many distinct values.
- **Low frequency** — no single value dominates.
- **Non-monotonic** — avoid `_id` or timestamp alone (hot shard).
- **Query pattern** — shard key should be in most queries.
- **Shard key is hard to change.** Choose carefully.

## Consistency Knobs

MongoDB lets you tune consistency per operation:

| Knob | Faster | Safer |
|---|---|---|
| Write concern | `w: 1` | `w: "majority", j: true` |
| Read concern | `local` | `majority` or `linearizable` |
| Read preference | `secondary` | `primary` |

**Rule:** tune per operation. Not every read needs strong consistency; not every write needs `majority`.

## Aggregation Pipeline

MongoDB's query language for complex transformations.

```javascript
db.orders.aggregate([
  { $match: { status: "SHIPPED", createdAt: { $gte: ISODate("2026-01-01") } } },
  { $group: { _id: "$customerId", total: { $sum: "$total" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])
```

**Rules:**
- **`$match` early** to reduce pipeline size.
- **Indexes can be used by `$match` and `$sort`.**
- **`$lookup` is a left outer join** — expensive on large collections.
- **Prefer embedding over `$lookup`** for frequently read data.

## Transactions

Multi-document ACID since 4.0.

```javascript
const session = client.startSession();
session.startTransaction();
try {
  await accounts.updateOne({ _id: 1 }, { $inc: { balance: -100 } }, { session });
  await accounts.updateOne({ _id: 2 }, { $inc: { balance: 100 } }, { session });
  await session.commitTransaction();
} catch (e) {
  await session.abortTransaction();
} finally {
  session.endSession();
}
```

**Rules:**
- **Transactions have a 60-second default limit.**
- **Transactions are slower than single-document operations.**
- **Prefer single-document atomicity** — design documents so updates are atomic.
- **Multi-document transactions are a fallback**, not the default.

## Performance

### `explain("executionStats")`

```javascript
db.orders.find({ customerId: "c-42", status: "active" })
  .explain("executionStats")
```

Look for:
- **COLLSCAN** — collection scan; add index.
- **IXSCAN** — index scan; good.
- **totalDocsExamined vs nReturned** — ratio shows index efficiency.
- **executionTimeMillis** — actual time.

### Common issues

| Issue | Fix |
|---|---|
| COLLSCAN | Add index |
| Large `totalDocsExamined` | Better index |
| `$lookup` on large collections | Denormalize |
| Unbounded arrays | Split into collection |
| Large documents | Normalize |

## Operations

| Area | Practice |
|---|---|
| Backups | `mongodump` / cloud snapshots |
| Monitoring | `mongostat`, `mongotop`, Atlas metrics |
| Slow queries | Profiler (`db.setProfilingLevel`) |
| Replication lag | `rs.printSecondaryReplicationInfo()` |
| Sharding | Balancer status, chunk distribution |
| Indexes | `db.collection.getIndexes()`, `$indexStats` |
| Connection pooling | Driver settings |

## Anti-Patterns

- MongoDB as a relational database (joins via `$lookup` everywhere).
- Unbounded arrays growing forever.
- No indexes; every query is COLLSCAN.
- Too many indexes; writes slow.
- `w: 1` for critical data.
- Sharding with a monotonic shard key.
- Large documents hitting the 16 MB limit.
- Using MongoDB as a queue.
- Transactions for every operation.

## Tricky Corners ⚠️

- **16 MB document limit.** Plan for it.
- **Unbounded arrays kill performance and hit the limit.** Cap or split.
- **`$lookup` is expensive.** Denormalize if read-heavy.
- **Shard key is hard to change.**
- **Monotonic shard keys create hot shards.**
- **`w: 1` risks data loss** on primary failover.
- **Secondary reads can be stale.**
- **Transactions have a 60s limit.**
- **TTL indexes run every 60s** — not instantaneous.
- **Indexes cost writes and storage.**
- **Schema flexibility is a trap** — validate at the app layer (JSON Schema).

## Common Pitfalls

- Schema-less in production (no validation).
- No indexes.
- Too many indexes.
- Unbounded documents.
- `$lookup` everywhere.
- Sharding too early.
- Bad shard key.
- `w: 1` for money.
- Secondary reads for read-your-writes.
- Using MongoDB when Postgres is the right tool.

## Key Interview Tips

- Lead with **"MongoDB is document-shaped, key-based access, native sharding — not Postgres without schema."**
- For "embed vs reference?", answer **"embed what you read together, reference what you read separately, watch document size and array growth."**
- For "how do you shard?", answer **"high-cardinality, low-frequency, non-monotonic shard key; hashed for uniform, ranged for query patterns."**
- For "how do you ensure durability?", answer **"`w: majority` + `j: true` + `readConcern: majority` for critical data."**
- For "how do you model data?", answer **"access-pattern-driven; embed for reads, reference for shared/unbounded data."**
- For "how do you handle transactions?", answer **"single-document atomicity first; multi-document transactions only when necessary, with a 60s limit."**
- For "how do you tune performance?", answer **"`explain('executionStats')`, ESR compound indexes, avoid COLLSCAN, avoid `$lookup` on large collections."**
- Always mention **document size limit** and **shard key strategy**.

## Related

- [Databases index](index.md)
- [PostgreSQL Essentials](postgresql-essentials.md)
- [System Design Depth → Capacity Planning](../system-design-depth/capacity-planning.md)