# Back of Envelope Estimation

## Key Concepts
- **Rough-order calculations** done on paper or in your head to size a system before designing it
- **Powers of 2 and 10**: Memorize key values so you can multiply/divide quickly
- **Read:Write ratio**: Shapes caching, replication, and sharding decisions
- **Peak vs Average**: Peak is typically 2x–10x average; always design for peak
- **80/20 rule**: 20% of data serves 80% of traffic — drives cache sizing
- **Storage growth**: Estimate for 1 day, then scale to 1 year, 5 years
- **Bandwidth**: Ingress (writes) vs egress (reads) — egress usually dominates
- **Precision is not the goal**: Getting within 2x–5x is enough to guide architecture

## Why It Matters
- Guides database choice (SQL vs NoSQL vs cache)
- Determines sharding strategy and shard count
- Tells you how many servers, how much cache, how much storage
- Exposes bottlenecks (read-heavy? write-heavy? both?)
- In interviews: shows you can reason about scale, not just recite designs

## Common Problems
- Design Twitter / Instagram (feed, timeline)
- Design YouTube / Netflix (video storage and delivery)
- Design WhatsApp / Slack (messaging)
- Design a URL shortener (Bitly)
- Design a rate limiter
- Design a notification system
- Design Uber / Ola (ride booking)
- Design a web crawler

## Techniques / Patterns
- **QPS calculation** from DAU × actions per user
- **Peak multiplier** (2x–10x) for capacity planning
- **Storage per day** then extrapolate to 1/5 years
- **Cache sizing** using the 80/20 rule
- **Bandwidth estimation** for both ingress and egress
- **Server count** from peak QPS ÷ per-server capacity
- **Read:Write ratio** to pick the right data layer

---

## 🔹 Basic Template

### The 6-Step Framework
```text
1. Clarify scale         -> DAU, MAU, actions/user/day
2. Compute average QPS   -> DAU x actions / 86400
3. Compute peak QPS      -> average x peak factor (2-10x)
4. Compute storage       -> per day, then 1y / 5y
5. Compute bandwidth     -> QPS x avg payload size
6. Compute servers/cache -> peak QPS / per-server capacity
```

### Back-of-Envelope Decision Flow

```d2
direction: right

start: Start {shape: circle}
clarify: "Clarify scale (DAU, actions/user)" {shape: rectangle}
avg_qps: "Compute average QPS" {shape: rectangle}
peak: "Apply peak factor (2x-10x)" {shape: rectangle}
storage: "Compute storage per day" {shape: rectangle}
extrapolate: "Extrapolate to 1y / 5y" {shape: rectangle}
bandwidth: "Compute bandwidth (ingress + egress)" {shape: rectangle}
cache: "Size cache (80/20 rule)" {shape: rectangle}
servers: "Estimate servers needed" {shape: rectangle}
bottleneck: "Identify bottleneck (read/write/both)" {shape: rectangle}
end: End {shape: circle}

start -> clarify
clarify -> avg_qps
avg_qps -> peak
peak -> storage
storage -> extrapolate
extrapolate -> bandwidth
bandwidth -> cache
cache -> servers
servers -> bottleneck
bottleneck -> end
```

---

## 🔹 Numbers Every Engineer Should Know

### Latency Numbers

| Operation | Latency | Relative |
|---|---|---|
| L1 cache reference | 0.5 ns | 1x |
| Branch mispredict | 5 ns | 10x |
| L2 cache reference | 7 ns | 14x |
| Mutex lock/unlock | 25 ns | 50x |
| Main memory reference | 100 ns | 200x |
| Compress 1 KB with Zippy | 10 us | 20,000x |
| Send 1 KB over 1 Gbps network | 10 us | 20,000x |
| Read 4 KB randomly from SSD | 150 us | 300,000x |
| Read 1 MB sequentially from memory | 250 us | 500,000x |
| Round trip within same datacenter | 0.5 ms | 1,000,000x |
| Read 1 MB sequentially from SSD | 1 ms | 2,000,000x |
| Disk seek (HDD) | 10 ms | 20,000,000x |
| Read 1 MB sequentially from disk | 20 ms | 40,000,000x |
| Send packet CA -> Netherlands -> CA | 150 ms | 300,000,000x |

**Rule of thumb**: Memory is fast, disk is slow, network is slower, cross-continent is slowest.

### Storage Units

| Unit | Bytes | Common Example |
|---|---|---|
| 1 KB | 1,000 | Short text message |
| 1 MB | 1,000 KB | Small image, MP3 snippet |
| 1 GB | 1,000 MB | SD movie, large DB table |
| 1 TB | 1,000 GB | Large production DB |
| 1 PB | 1,000 TB | YouTube-scale video storage |

### Time Conversions

| Period | Seconds | Approx |
|---|---|---|
| 1 minute | 60 | 10^2 |
| 1 hour | 3,600 | ~4 x 10^3 |
| 1 day | 86,400 | ~10^5 |
| 1 month | 2,592,000 | ~2.5 x 10^6 |
| 1 year | 31,536,000 | ~3.15 x 10^7 |

**Shortcut**: When dividing by 86,400, just use **~100,000** (10^5). The error is under 15%, which is fine for estimation.

### Powers of 2

| Power | Value | Approx |
|---|---|---|
| 2^10 | 1,024 | ~1 thousand (1 KB) |
| 2^20 | 1,048,576 | ~1 million (1 MB) |
| 2^30 | ~1.07 billion | ~1 billion (1 GB) |
| 2^40 | ~1.1 trillion | ~1 trillion (1 TB) |
| 2^50 | ~1.1 quadrillion | ~1 PB |

### Character Encoding

| Type | Bytes per char |
|---|---|
| ASCII | 1 |
| UTF-8 (English) | 1 |
| UTF-8 (CJK) | 3 |
| UTF-16 | 2-4 |

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Estimate QPS for a Twitter-like Feed**

**Problem Description:**
Twitter has ~500M DAU. Each user reads 100 tweets and posts 2 tweets per day. Estimate average and peak QPS for reads and writes.

**Step-by-step:**

```text
Given:
  DAU              = 500,000,000
  Reads / user     = 100 tweets
  Writes / user    = 2 tweets
  Seconds in a day = 86,400 (use ~100,000)

Step 1 - Read QPS:
  Total reads/day = 500M x 100 = 50,000M = 5 x 10^10
  Read QPS        = 5 x 10^10 / 10^5 = 5 x 10^5 = 500,000 QPS

Step 2 - Write QPS:
  Total writes/day = 500M x 2 = 1,000M = 10^9
  Write QPS        = 10^9 / 10^5 = 10^4 = 10,000 QPS

Step 3 - Peak (assume 3x factor):
  Peak reads  = 500,000 x 3 = 1,500,000 QPS
  Peak writes = 10,000 x 3 = 30,000 QPS

Read:Write ratio = 500,000 : 10,000 = 50:1
```

**Why It Works:**
- Splitting reads and writes shows where the load is concentrated
- 50:1 read-heavy ratio immediately tells us: cache aggressively, use read replicas
- Peak factor of 3x is conservative for a social platform (evenings, events)

**Time Complexity of Estimation**: O(1) — just multiplication and division
**Key Takeaway**: Read-heavy systems prioritize caching and read replicas

**Follow-up Questions:**
- If each read returns 100 tweets x 300 bytes = 30 KB, what's the egress bandwidth?
- How much cache do you need to hold the hot 20%?

---

#### 2. **Estimate Storage for a URL Shortener**

**Problem Description:**
Bitly receives 100M new URLs per day. Each row stores a short code, long URL, timestamp, and user ID. Estimate storage for 5 years.

**Step-by-step:**

```text
Given:
  Writes / day    = 100,000,000
  Row size (raw)  = short_code (8 B) + long_url (~100 B) + timestamp (8 B) + user_id (8 B)
                  = ~124 B
  Add index overhead (~2x) -> ~250 B / row
  Retention       = 5 years

Step 1 - Rows over 5 years:
  5 years x 365 days = ~1,825 days
  Rows = 100M x 1,825 = ~1.825 x 10^11 = ~182 billion rows

Step 2 - Storage:
  182 x 10^9 rows x 250 B = 45.5 x 10^12 B
                         = ~45 TB

Step 3 - With replication factor 3:
  Raw storage   = 45 TB
  Replicated    = 45 x 3 = 135 TB
  Plus backups  = ~270 TB total
```

**Why It Works:**
- Index overhead is easy to forget — it roughly doubles the row size
- Replication factor multiplies storage (typically 3x)
- Backups add another 1x–2x depending on policy

**Key Takeaway**: Always include index overhead + replication + backups in storage estimates

**Follow-up Questions:**
- If 80% of reads hit 20% of URLs, how much cache do you need?
- At 115,000 read QPS, what's the Redis cluster size needed?

---

#### 3. **Estimate Bandwidth for Video Streaming**

**Problem Description:**
A YouTube-like service has 200M DAU. Each user watches 30 minutes of video per day at 5 Mbps. Estimate egress bandwidth (average and peak).

**Step-by-step:**

```text
Given:
  DAU            = 200,000,000
  Watch time     = 30 min = 1,800 sec
  Bitrate        = 5 Mbps = 5 x 10^6 bits/sec
  Peak factor    = 3x

Step 1 - Total daily bytes:
  Per user       = 1,800 sec x 5 x 10^6 bits/sec
                 = 9 x 10^9 bits = 9 Gbits
                 = ~1.125 GB per user per day

  Total daily    = 200M x 1.125 GB
                 = 225 x 10^6 GB
                 = 225 PB/day

Step 2 - Average egress bandwidth:
  Seconds/day    = 86,400
  Avg bandwidth  = 225 x 10^15 bytes / 86,400 sec
                 = ~2.6 x 10^12 bytes/sec
                 = ~2.6 TB/sec
                 = ~20.8 Tbps (bits)

Step 3 - Peak egress bandwidth:
  Peak = 20.8 Tbps x 3 = ~62 Tbps
```

**Why It Works:**
- Video traffic is dominated by egress (download), not ingress (upload)
- Conversions between bits/bytes matter — ISP bandwidth is in bits
- 5 Mbps is roughly 480p–720p; 4K would be 25 Mbps (5x higher)

**Key Takeaway**: Video services need massive CDN egress — this is why Netflix pays ISPs directly

**Follow-up Questions:**
- Where does the content get served from? (Origin vs edge CDN)
- How many edge PoPs would you need at 62 Tbps peak?

---

### Medium

#### 4. **Estimate QPS and Storage for WhatsApp**

**Problem Description:**
WhatsApp has 2B users, 1B DAU. Each user sends 40 messages/day. Each message is ~100 bytes. Estimate QPS, storage/day, and 5-year storage.

**Step-by-step:**

```text
Given:
  DAU             = 1,000,000,000
  Messages / user = 40
  Message size    = 100 bytes
  Retention       = 5 years

Step 1 - Write QPS (average):
  Total messages  = 1B x 40 = 40 x 10^9 = 4 x 10^10
  Write QPS       = 4 x 10^10 / 10^5 = 4 x 10^5 = 400,000 QPS

Step 2 - Peak write QPS:
  Peak factor 3x  -> ~1.2 million QPS

Step 3 - Storage per day:
  4 x 10^10 msgs x 100 B = 4 x 10^12 B = 4 TB/day
  With metadata + indexes (~3x) = 12 TB/day

Step 4 - 5-year storage:
  5 x 365 = 1,825 days
  12 TB x 1,825 = ~21.9 PB
  With replication 3x = ~65 PB
```

**Why It Works:**
- Messaging is write-heavy compared to social feeds
- Metadata (sender, receiver, timestamp, delivery status) often exceeds message body
- 40 msgs/day is realistic for active users

**Key Takeaway**: Messaging systems need write-optimized storage (Cassandra, HBase)

**Follow-up Questions:**
- How would you handle offline messages?
- What's the read QPS if each message is read 1.5 times on average?

---

#### 5. **Estimate Cache Size Using 80/20 Rule**

**Problem Description:**
A social feed service has 10M active posts per day. 20% of posts generate 80% of traffic. Each post is ~2 KB. How much cache do you need for the hot 20%?

**Step-by-step:**

```text
Given:
  Daily posts     = 10,000,000
  Hot %           = 20%
  Post size       = 2 KB

Step 1 - Hot posts count:
  Hot posts = 10M x 0.20 = 2,000,000

Step 2 - Cache size (raw):
  2M x 2 KB = 4,000,000 KB = 4 GB

Step 3 - With overhead (keys, TTL, metadata ~2x):
  4 GB x 2 = 8 GB

Step 4 - Add replica (for HA):
  8 GB x 2 = 16 GB

Step 5 - Real world (30% headroom):
  16 GB x 1.3 = ~21 GB
```

**Why It Works:**
- 80/20 rule usually holds for read-heavy systems
- Cache overhead is significant (Redis stores metadata per key)
- HA replicas double cache footprint

**Key Takeaway**: Even for large systems, hot data cache can fit in tens of GB

**Follow-up Questions:**
- What eviction policy would you use? (LRU usually)
- What's the cache hit ratio if you cache 40% instead of 20%?

---

#### 6. **Estimate Servers Needed for a Web Service**

**Problem Description:**
A service receives 500,000 peak QPS. Each server can handle 5,000 QPS (with reasonable latency). Estimate the number of servers needed with 50% headroom.

**Step-by-step:**

```text
Given:
  Peak QPS        = 500,000
  Per-server QPS  = 5,000
  Headroom        = 50% (1.5x)

Step 1 - Raw servers:
  500,000 / 5,000 = 100 servers

Step 2 - With headroom:
  100 x 1.5 = 150 servers

Step 3 - With N+1 per AZ (3 AZs):
  Per AZ: 150 / 3 = 50 servers
  N+1 per AZ: 50 + 1 = 51
  Total: 51 x 3 = 153 servers
```

**Why It Works:**
- Headroom absorbs traffic spikes and rolling deployments
- Multi-AZ spreads risk across datacenters
- N+1 ensures AZ can survive one server loss

**Key Takeaway**: Always plan for 1.5x–2x headroom + N+1 per AZ

**Follow-up Questions:**
- How does adding a cache tier reduce server count?
- What if QPS doubles in 6 months? (Plan for growth)

---

### Hard

#### 7. **Estimate QPS, Storage, and Cost for a Video Platform**

**Problem Description:**
Design the estimates for a YouTube competitor. 100M DAU, 500K new videos/day, average 10 min per video, 4K at 25 Mbps. Each user watches 1 hour/day. Estimate QPS (uploads/views), storage (5 years), bandwidth (egress), and rough monthly cost.

**Step-by-step:**

```text
Given:
  DAU             = 100,000,000
  New videos/day  = 500,000
  Video length    = 10 min = 600 sec
  Upload bitrate  = 25 Mbps (4K)
  Watch time      = 1 hour = 3,600 sec / user
  Watch bitrate   = 5 Mbps (typical 720p)

Step 1 - Upload QPS:
  Uploads/sec = 500,000 / 86,400 = ~5.8 uploads/sec
  Peak (3x)   = ~17 uploads/sec

Step 2 - View QPS:
  Assume avg view = 30 sec
  Total views/day = 100M x 3,600 / 30 = 1.2 x 10^10
  View QPS        = 1.2 x 10^10 / 10^5 = 120,000 QPS
  Peak (3x)       = 360,000 QPS

Step 3 - Storage per day (uploads only):
  Per video (raw) = 600 sec x 25 Mbps / 8
                  = 600 x 25 x 10^6 / 8
                  = 1.875 x 10^9 bytes
                  = ~1.875 GB
  Per day         = 500,000 x 1.875 GB = ~937 TB/day
  Multiple resolutions (assume avg 1.5x after transcoding) -> ~1.4 PB/day

Step 4 - 5-year storage:
  1.4 PB x 365 x 5 = ~2,555 PB = ~2.5 EB
  With replication 3x = ~7.5 EB

Step 5 - Egress bandwidth:
  Avg = 100M x 3,600 sec x 5 Mbps / 86,400 sec
      = 100M x 3,600 x 5 x 10^6 / (8 x 86,400)
      = ~2.6 x 10^12 bytes/sec
      = ~2.6 TB/sec
      = ~20.8 Tbps
  Peak (3x) = ~62 Tbps

Step 6 - Rough monthly cost (very rough):
  Storage: 7.5 EB x $0.02/GB/month / 1000 = $150M/month (S3-like)
  Egress:  20.8 Tbps -> assume $0.05/GB
          20.8 Tbps x 86,400 x 30 / 8 / 10^12 GB
          = ~6,700 PB/month
          = 6.7 EB/month
          x $0.05/GB -> $335B/month (way too high)
  (This shows why YouTube/Netflix pay ISPs directly, not per-GB CDN fees)
```

**Why It Works:**
- Storage is huge but manageable — the real cost is egress
- CDN peering deals (not per-GB) are essential at this scale
- Multiple resolutions inflate storage beyond raw upload size

**Key Takeaway**: At video scale, **egress bandwidth is the bottleneck and cost driver**

**Follow-up Questions:**
- How would a CDN change the egress cost model?
- What's the impact of adaptive bitrate streaming?
- How much cache at the edge would you need?

---

#### 8. **Estimate a Notification System**

**Problem Description:**
A social app with 500M DAU sends notifications on likes, comments, follows. Each user receives ~20 notifications/day. 60% are push, 30% in-app, 10% email. Estimate QPS per channel and total daily delivery.

**Step-by-step:**

```text
Given:
  DAU              = 500,000,000
  Notifications/user = 20
  Push:InApp:Email = 60:30:10

Step 1 - Total notifications:
  500M x 20 = 10,000M = 10^10 notifications/day

Step 2 - Per channel:
  Push  = 10^10 x 0.60 = 6 x 10^9
  InApp = 10^10 x 0.30 = 3 x 10^9
  Email = 10^10 x 0.10 = 1 x 10^9

Step 3 - Average QPS per channel:
  Push  = 6 x 10^9 / 10^5 = 60,000 QPS
  InApp = 3 x 10^9 / 10^5 = 30,000 QPS
  Email = 1 x 10^9 / 10^5 = 10,000 QPS

Step 4 - Peak QPS (assume 5x for push storms):
  Push  peak = 300,000 QPS
  InApp peak = 150,000 QPS
  Email peak = 50,000 QPS

Step 5 - Storage (notification log):
  Assume 200 bytes per record
  10^10 x 200 B = 2 x 10^12 B = 2 TB/day
  30-day retention = 60 TB
  With indexes + replication 3x = ~200 TB
```

**Why It Works:**
- Push dominates because it's the default channel
- Peak factor is higher for push (events trigger bursts)
- Log storage is small compared to messaging systems

**Key Takeaway**: Push notification systems need queue-based buffering for burst handling

**Follow-up Questions:**
- How would you handle a celebrity posting to 50M followers?
- What's the retry strategy for failed push deliveries?

---

## 📌 Key Tips & Tricks

### 1. **Use ~100,000 for Seconds per Day**
```text
86400 -> round to 10^5
Error < 15%, acceptable for estimation
```

### 2. **Peak Factor Rules of Thumb**
| System | Peak Factor |
|---|---|
| Social feed | 2x–3x |
| Messaging | 2x–4x |
| Video streaming | 3x–5x |
| Push notifications | 5x–10x |
| E-commerce (sales) | 10x+ |

### 3. **Storage Per Day Formula**
```text
Storage/day = Writes/day x Row size x Overhead factor
  Overhead factor ~2x (indexes)
  Replication factor ~3x (HA)
  Backups ~2x (retention)
  Total ~12x raw row size
```

### 4. **Bandwidth Formula**
```text
Bandwidth (bytes/sec) = QPS x Avg response size
Bandwidth (bits/sec)  = Bandwidth bytes x 8
Tbps                  = bits/sec / 10^12
```

### 5. **Cache Sizing with 80/20**
```text
Cache size = Daily active items x 20% x Item size x 2 (overhead)
Always add 30% headroom
```

### 6. **Read:Write Ratio Guides Architecture**
| Ratio | Architecture |
|---|---|
| 1:1 | Balanced, standard DB |
| 10:1 | Read replicas + cache |
| 100:1 | Heavy cache + CDN |
| 1000:1 | Aggressive caching, denormalized |

### 7. **Convert Units Carefully**
```text
Bits vs Bytes      -> x8 or /8
KB vs KiB          -> 1000 vs 1024 (use 1000 for estimation)
Mbps vs MBps       -> 1 MBps = 8 Mbps
TB vs TiB          -> 1000 vs 1024
```

---

## 🎯 Common Pitfalls to Avoid

- Forgetting to multiply by 8 when converting bytes to bits
- Using 1,000,000 seconds per day instead of ~100,000
- Ignoring index overhead and replication in storage estimates
- Designing for average instead of peak
- Forgetting to include metadata (timestamps, IDs, headers)
- Mixing up read and write paths (they have different QPS)
- Assuming a single server can handle millions of QPS
- Not accounting for cache miss paths (hit source of truth)
- Forgetting that egress > ingress for read-heavy systems
- Not considering cross-region replication costs
- Overestimating per-server capacity (real-world is lower than benchmark)
- Ignoring cost entirely (especially egress and cross-region traffic)

---

## 🔹 Estimation Cheat Sheet

### Quick Reference Table

| Metric | Formula | Notes |
|---|---|---|
| Average QPS | DAU x actions / 10^5 | 10^5 ~ seconds/day |
| Peak QPS | Avg QPS x peak factor | 2x–10x depending on system |
| Storage/day | Writes/day x row size x 12 | Includes index, replica, backup |
| 5-year storage | Storage/day x 1,825 | 365 x 5 |
| Bandwidth | QPS x payload x 8 | In bits/sec |
| Cache size | Daily items x 0.2 x size x 2 x 1.3 | 80/20 + overhead + headroom |
| Servers | Peak QPS / per-server QPS x 1.5 | 50% headroom |

### System Archetypes

| System | Read:Write | Peak Factor | Dominant Resource |
|---|---|---|---|
| URL Shortener | 100:1 | 3x | Read cache, storage |
| Twitter Feed | 50:1 | 3x | Read cache, egress |
| WhatsApp | 1:1 | 3x | Write throughput, storage |
| YouTube | 1000:1 | 3x | Egress bandwidth, storage |
| Uber | 1:1 | 5x | Geo indexing, real-time |
| Notification | 1:1 | 5x–10x | Queue depth, push throughput |
| E-commerce | 10:1 | 10x | Read cache, inventory |