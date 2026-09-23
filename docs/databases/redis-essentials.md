# Redis Essentials

> **JDK context:** Java 17+ — Lettuce, Jedis, Spring Data Redis, Redisson. This file covers *data modelling, persistence, and patterns*; client-library syntax lives in each library's docs.

## Mental Model

Redis is an **in-memory data structure server**. That phrasing matters:

- **In-memory** — data lives in RAM by default; persistence is optional and best-effort.
- **Data structure** — it's not a plain key-value store; it ships with strings, hashes, lists, sets, sorted sets, streams, bitmaps, HyperLogLog, and geospatial indexes.
- **Server** — it's a network service, not a library. Clients talk to it over TCP.

**The core trade-off:** extreme speed and rich data structures, at the cost of memory being the primary constraint. Redis is not a general-purpose database; it is a *very fast special-purpose* one.

```d2
direction: down

client: "Client\n(Lettuce, Jedis, Redisson)"
server: "Redis Server\n(single-threaded command execution)"
memory: "In-Memory Dataset"
rdb: "RDB Snapshots\n(point-in-time)"
aof: "AOF Log\n(append-only)"
replica: "Replicas\n(async replication)"

client -> server: "RESP protocol"
server -> memory: "read/write"
memory -> rdb: "periodic"
memory -> aof: "every write (configurable)"
server -> replica: "replicate"
```

**Key insight:** Redis commands are executed **single-threaded**. Every command is atomic. This is why Redis is simple to reason about — no locks, no race conditions between commands. But it also means a slow command blocks everything.

## Data Types

### Strings

The most basic type. Values up to 512 MB. Used for counters, caches, locks, and serialized objects.

```bash
SET user:42:name "Alice"
GET user:42:name
# "Alice"

SET counter 100
INCR counter
# 101
INCRBY counter 10
# 111

SETEX session:abc 3600 "user-data"    # TTL in seconds
SETNX lock:order:42 "owner-1"          # set if not exists (atomic)
```

**Common uses:** caching serialized JSON/protobuf, rate-limit counters, session data, distributed locks (with `SET NX EX`).

### Hashes

A map of field → value. Efficient for objects with many fields.

```bash
HSET user:42 name "Alice" age 30 email "alice@example.com"
HGET user:42 name
# "Alice"
HGETALL user:42
# name=Alice, age=30, email=alice@example.com
HINCRBY user:42 age 1
# 31
```

**Advantages over strings:** update individual fields without reading/writing the whole object. Lower memory overhead for objects with few fields.

**Common uses:** user profiles, session data, config maps, product catalog entries.

### Lists

Ordered, doubly-linked lists. O(1) push/pop at either end.

```bash
LPUSH queue:jobs "job-1" "job-2" "job-3"
RPOP queue:jobs
# "job-1"  (FIFO if you LPUSH + RPOP)

LRANGE queue:jobs 0 -1
# ["job-2", "job-3"]

BLPOP queue:jobs 5     # blocking pop, 5s timeout
```

**Common uses:** simple queues, activity feeds (capped with `LTRIM`), recent items.

**Warning:** no consumer groups, no acknowledgement, no dead-letter. For real message queue semantics, use **Streams**.

### Sets

Unordered collections of unique strings. Set operations (union, intersection, difference).

```bash
SADD tags:post:1 "java" "redis" "backend"
SADD tags:post:2 "java" "spring"
SINTER tags:post:1 tags:post:2
# "java"
SUNION tags:post:1 tags:post:2
# "java", "redis", "backend", "spring"
SCARD tags:post:1
# 3
```

**Common uses:** tags, unique visitors, friend lists (intersection = mutual friends), deduplication.

### Sorted Sets (ZSets)

Set with a **score** per member. Ordered by score. O(log N) insert and lookup.

```bash
ZADD leaderboard 100 "alice" 85 "bob" 92 "carol"
ZREVRANGE leaderboard 0 2 WITHSCORES
# carol 92, alice 100... (ordered by score desc)
ZRANGEBYSCORE leaderboard 90 100
ZRANK leaderboard "alice"
ZINCRBY leaderboard 5 "alice"
```

**Common uses:** leaderboards, rate limiters (sliding window), priority queues, time-series with timestamps as scores.

### Streams

Append-only log with consumer groups. Redis's answer to Kafka-lite.

```bash
XADD orders * customerId cust-1 amount 5000
XADD orders * customerId cust-2 amount 7500
XLEN orders
# 2

XGROUP CREATE orders order-processors $ MKSTREAM
XREADGROUP GROUP order-processors consumer-1 COUNT 10 STREAMS orders >
```

**Common uses:** event streams, audit logs, inter-service messaging (lightweight), work queues with ack semantics.

**Features:** consumer groups, `XACK` for acknowledgement, `XPENDING` for unacknowledged messages, `XCLAIM` for reassignment.

### Bitmaps, HyperLogLog, Geospatial

- **Bitmaps** — bit-level operations on strings. Great for "user was active on day X" flags, feature flags per user.
- **HyperLogLog** — approximate cardinality (unique counts) in ~12 KB regardless of set size. Error ~0.81%.
- **Geospatial** — coordinates with radius queries. Built on sorted sets.

```bash
SETBIT user:42:activity:2024-01-01 0 1
BITCOUNT user:42:activity:2024-01-01

PFADD unique:visitors "user-42" "user-43"
PFCOUNT unique:visitors

GEOADD stores -122.4194 37.7749 "sf-store"
GEOSEARCH stores FROMMEMBER "sf-store" BYRADIUS 10 km ASC
```

## Persistence

Redis persistence is best-effort by design. Understanding the trade-offs is essential.

### RDB (Redis Database) — Point-in-time snapshots

- Periodic snapshots to disk (e.g. every 5 minutes if 100 keys changed).
- **Fast** to save and load.
- **Compact** — small file size.
- **Risk:** lose all writes since the last snapshot on crash.

```conf
save 900 1     # snapshot if 1+ keys changed in 900s
save 300 10    # snapshot if 10+ keys changed in 300s
save 60 10000  # snapshot if 10000+ keys changed in 60s
```

### AOF (Append-Only File) — Write-ahead log

- Logs every write command; replays on startup.
- **Durable** — configurable fsync policy.
- **Larger** file, **slower** restart than RDB.
- **Rewrite** (`BGREWRITEAOF`) compacts the log periodically.

```conf
appendonly yes
appendfsync everysec    # fsync once per second (recommended)
# appendfsync always    # fsync every write (slow, most durable)
# appendfsync no        # let OS decide (fastest, least durable)
```

### RDB + AOF together

Redis 4+ supports **hybrid persistence** — RDB for fast restart, AOF for durability. On restart, Redis loads RDB and replays the AOF tail.

### Choosing a persistence policy

| Use case | RDB | AOF | Neither |
|---|---|---|---|
| Cache (can be rebuilt) | ✅ | Optional | ✅ Best |
| Session store | ⚠️ | ✅ Recommended | ❌ |
| Rate limiter counters | ⚠️ | ✅ | ❌ |
| Distributed lock | ❌ | ❌ | ✅ (locks are ephemeral) |
| Event stream / source of truth | ❌ | ✅ | ❌ |

**Rule:** if the data can be regenerated from another source, treat Redis as a cache and disable persistence (or use RDB for faster restart). If the data is authoritative, use AOF with `everysec` and accept the ~1s write-loss window.

## Expiration & Eviction

### Expiration (per-key TTL)

```bash
SETEX session:abc 3600 "data"    # set with TTL
EXPIRE session:abc 7200          # change TTL
TTL session:abc                  # seconds remaining (-1 = no TTL)
PERSIST session:abc              # remove TTL
```

**Lazy + active expiration:** Redis checks TTL lazily on access, plus periodically scans for expired keys. An expired key is not always immediately removed — it's removed on access or during the active cycle.

### Eviction (memory pressure)

When Redis hits `maxmemory`, it applies the configured policy:

| Policy | Behaviour | Best for |
|---|---|---|
| **noeviction** | Reject writes when memory is full | Authoritative data (with alerts) |
| **allkeys-lru** | Evict least-recently-used keys (any key) | Pure cache |
| **allkeys-lfu** | Evict least-frequently-used keys | Cache with popularity skew |
| **volatile-lru** | Evict LRU keys with TTL set | Mixed cache + persistent |
| **volatile-lfu** | Evict LFU keys with TTL set | Same, LFU variant |
| **allkeys-random** | Random eviction | Uniform access pattern |
| **volatile-ttl** | Evict keys closest to expiry | Time-sensitive cache |

**Rule:** `allkeys-lru` for caches; `noeviction` for authoritative stores with monitoring.

```conf
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 5   # LRU approximation sample size
```

## Clustering & High Availability

### Replication (master-replica)

- Async replication. Replicas serve reads, but may lag.
- **Failover requires Sentinel or Cluster.**
- **Do not use replicas as backup** — they share the same failure mode (e.g. a bad `FLUSHALL` propagates).

### Redis Sentinel

- Monitors masters and replicas.
- Automatically promotes a replica on master failure.
- Provides service discovery: clients ask Sentinel for the current master.

**Use when:** single-shard dataset fits on one node, you need HA but not horizontal scaling.

### Redis Cluster

- **Sharding** across up to 1000 nodes.
- **16384 hash slots** distributed across masters.
- Key routing via `CRC16(key) % 16384`.
- **Hash tags** `{user:42}:profile` force keys into the same slot.
- Multi-key operations require all keys in the same slot.

**Use when:** dataset exceeds one node's memory, or write throughput requires sharding.

**Trade-offs:**
- Multi-key operations constrained by hash slots.
- More complex client-side handling (cluster-aware clients).
- Cross-slot transactions not supported.

## Pub/Sub & Streams

### Pub/Sub

Fire-and-forget messaging. Subscribers only receive messages published while connected.

```bash
SUBSCRIBE notifications
PUBLISH notifications "order placed"
```

**Not for reliable messaging** — no persistence, no delivery guarantee, no replay.

### Streams (reliable messaging)

```bash
XADD events * type order.placed orderId ord-1
XGROUP CREATE events processors $ MKSTREAM
XREADGROUP GROUP processors worker-1 COUNT 10 BLOCK 5000 STREAMS events >
XACK events processors <message-id>
```

**Streams give you:** persistence, consumer groups, ack, pending list, replay from any ID.

**Use Streams over Pub/Sub** for anything that matters.

## Lua Scripting

Atomic multi-command operations. Redis executes Lua scripts single-threadedly — no interleaving.

```lua
-- rate-limit.lua: sliding window rate limiter
-- KEYS[1] = rate limit key, ARGV[1] = window seconds, ARGV[2] = max requests
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
    return 0
end
return 1
```

```java
// Java invocation
DefaultRedisScript<Long> script = new DefaultRedisScript<>(luaText, Long.class);
Long allowed = redisTemplate.execute(script,
        List.of("ratelimit:user:42"),
        "60", "100");
// Expected: 1 (allowed) while under 100 requests in 60s
```

**Rules**
- Scripts must be **deterministic** (Redis 7+ enforces this).
- Keep scripts **short** — they block the single-threaded event loop.
- Use `EVALSHA` with pre-loaded scripts for efficiency.

## Common Patterns

### Cache-Aside

The most common cache pattern.

```java
// Read: check cache first, fall back to DB, populate cache
public User getUser(String id) {
    String key = "user:" + id;
    String cached = redis.opsForValue().get(key);
    if (cached != null) return deserialize(cached);

    User user = userRepo.findById(id).orElseThrow();
    redis.opsForValue().set(key, serialize(user), Duration.ofMinutes(10));
    return user;
}

// Write: invalidate the cache
public void updateUser(User user) {
    userRepo.save(user);
    redis.delete("user:" + user.getId());
}
```

**Rules**
- **Cache the read path**, invalidate on write (do not try to write-through unless consistency matters).
- Set **TTLs** even on cached values — as a safety net against stale data.
- **Stampede protection** — a popular key that expires can cause a thundering herd. Use jittered TTLs, or a short lock on miss.

### Rate Limiter (sliding window)

```lua
-- See Lua section above
```

Or with sorted sets for exact sliding windows:

```bash
ZADD ratelimit:user:42 <now_ms> <request_id>
ZREMRANGEBYSCORE ratelimit:user:42 0 <now_ms - 60000>
ZCARD ratelimit:user:42
```

### Leaderboard

```bash
ZADD leaderboard 100 "alice"
ZINCRBY leaderboard 5 "alice"
ZREVRANGE leaderboard 0 9 WITHSCORES    # top 10
ZREVRANK leaderboard "alice"             # alice's rank
```

### Distributed Lock

```java
// Simple lock — SET NX EX
String lockKey = "lock:order:" + orderId;
String ownerId = UUID.randomUUID().toString();
Boolean acquired = redis.opsForValue()
        .setIfAbsent(lockKey, ownerId, Duration.ofSeconds(30));
if (Boolean.TRUE.equals(acquired)) {
    try {
        // critical section
    } finally {
        // release only if we still own it (Lua for atomicity)
        redis.execute(new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
            "  return redis.call('del', KEYS[1]) " +
            "else return 0 end", Long.class),
            List.of(lockKey), ownerId);
    }
}
```

**Warning:** naive Redis locks have subtle failure modes (clock drift, GC pauses, network partitions). For correctness-critical locking, use **Redisson** (which implements Redlock-style logic), or better, use a coordination service like **ZooKeeper** or **etcd**. Interviewers love this nuance.

### Session Store

```java
// Spring Session + Redis
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)
public class SessionConfig {
    // Spring auto-configures Redis-backed sessions
}
```

Sessions survive app restarts; multiple app instances share session state — required for stateless scaling.

### Cache Stampede Protection

```java
public User getUserWithLock(String id) {
    String key = "user:" + id;
    String cached = redis.opsForValue().get(key);
    if (cached != null) return deserialize(cached);

    String lockKey = "lock:user:" + id;
    if (Boolean.TRUE.equals(redis.opsForValue()
            .setIfAbsent(lockKey, "1", Duration.ofSeconds(5)))) {
        try {
            User user = userRepo.findById(id).orElseThrow();
            redis.opsForValue().set(key, serialize(user),
                    Duration.ofMinutes(10).plusSeconds(random.nextInt(60)));
            return user;
        } finally {
            redis.delete(lockKey);
        }
    }
    // Another thread is loading; wait briefly and retry
    sleep(50);
    return getUserWithLock(id);
}
```

## Redis vs Memcached

| Aspect | Redis | Memcached |
|---|---|---|
| Data structures | Strings, hashes, lists, sets, zsets, streams, ... | Strings only |
| Persistence | RDB, AOF | None |
| Replication | Yes (async) | No (client-side sharding) |
| Clustering | Redis Cluster | Client-side / proxy |
| Pub/Sub | Yes | No |
| Transactions | MULTI/EXEC | No |
| Lua scripting | Yes | No |
| Memory efficiency (small values) | Higher overhead | Better |
| Multi-threaded | No (single-threaded core) | Yes |
| Typical use | Feature-rich cache, sessions, queues, counters | Pure cache where strings suffice |

**Rule:** default to Redis. Choose Memcached only when you need pure string caching at extreme scale and Redis's per-key overhead is the bottleneck.

## Tricky Corners ⚠️

- **Redis is single-threaded for commands.** A slow command (e.g. `KEYS *` on a large dataset) blocks everything. Use `SCAN` instead of `KEYS`.
- **`KEYS` in production is forbidden.** Use `SCAN` with a cursor.
- **Replicas are async.** A failover can lose recent writes.
- **Replicas are not backups.** A `FLUSHALL` propagates. Use snapshots or `redis-cli --rdb` for backup.
- **No cross-slot operations in Cluster.** Multi-key commands require all keys in the same hash slot. Use hash tags `{user:42}:...`.
- **`EXPIRE` is not immediate.** Expired keys are removed lazily + actively — a stale key can survive briefly past its TTL.
- **`MULTI/EXEC` is not a real transaction.** No rollback. Commands are queued and executed, but errors during execution don't roll back earlier commands.
- **Lua scripts block the event loop.** Keep them short and deterministic.
- **Naive distributed locks are unsafe** under GC pauses or clock drift. Use Redisson, or use a coordination service for correctness-critical locking.
- **Memory limits are per-instance.** Cluster total memory = nodes × per-node limit, but data distribution is not uniform.
- **Big keys (e.g. a 1 GB hash)** are a performance and operational hazard. Design small keys; shard large ones.
- **`MONITOR` in production** is dangerous — it prints every command and slows the server.
- **Persistence is not a substitute for backups.** Files can corrupt, ops can misconfigure. Back up regularly.

## Common Pitfalls

- Using Redis as the primary database without persistence or backups.
- Storing unbounded data with no TTL — memory grows without limit.
- `KEYS *` in production.
- Big keys / big values — a single slow operation stalls the server.
- Relying on Pub/Sub for reliable messaging (use Streams).
- Ignoring replication lag — reads from replicas can return stale data.
- Naive distributed locks without ownership check on release.
- Cache stampede on a hot key expiry.
- No memory limit configured (`maxmemory`) — Redis can consume all RAM and trigger OOM kills.
- Ignoring the difference between `allkeys-lru` and `volatile-lru` — leads to unexpected eviction or writes being rejected.
- Assuming `MULTI/EXEC` provides ACID rollback.

## Key Interview Tips

- **Redis is in-memory with optional persistence** — say this explicitly. It's not "a database" in the same sense as PostgreSQL.
- **Single-threaded command execution** — the reason for atomicity, and the reason slow commands are catastrophic.
- **RDB vs AOF** — RDB is fast and compact but loses recent writes; AOF is durable at a cost. The recommended default is RDB + AOF (hybrid).
- **Cache-aside is the default pattern.** Talk about TTL, invalidation, stampede.
- **Distributed locks are subtle.** Mention Redisson and the caveats — this separates senior candidates.
- **Redis Cluster uses hash slots.** Multi-key operations need hash tags.
- **Streams vs Pub/Sub** — Streams for reliability, Pub/Sub for fire-and-forget.
- **Leaderboard, rate limiter, session store** — know one pattern per data type.
- **Replicas are not backups.** Common pitfall interviewers probe.
- **`KEYS` is forbidden in prod.** Say `SCAN`.
- **Redis vs Memcached** — one-line answer: Redis for features, Memcached for pure string caching.
- **Link to system design** — cache-aside, leaderboards, rate limiters show up in almost every system design interview.

## Related

- [System Design — Distributed Cache](../system-design/problems/07-distributed-cache.md)
- [System Design — Rate Limiter](../system-design/problems/02-rate-limiter.md)
- [System Design — Distributed Lock](../system-design/problems/04-distributed-lock.md)
- [Microservices Data Management](../microservices-patterns/data-management.md)
- [PostgreSQL Essentials](postgresql-essentials.md)