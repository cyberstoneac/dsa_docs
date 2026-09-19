# CDN (Content Delivery Network)

## Problem Statement

Design a Content Delivery Network that serves content (static and dynamic) from edge servers located close to end users. The CDN caches content at the edge, reducing latency, origin load, and bandwidth costs. When content isn't in the edge cache, it fetches from a regional cache or the origin, then caches for future requests.

**Example:**
```
User in Mumbai  -> Edge PoP in Mumbai (5 ms) -> Content cached
User in New York -> Edge PoP in Virginia (10 ms) -> Content cached
User in London  -> Edge PoP in London (8 ms) -> Cache miss -> Regional (Frankfurt, 40 ms) -> Origin (US, 200 ms) -> cache propagates back
```

**Real-world CDNs:** Cloudflare, Akamai, AWS CloudFront, Fastly, Google Cloud CDN, Azure CDN, Bunny CDN.

**Why it matters:**
- Latency: 200 ms cross-continent vs 10 ms from edge
- Bandwidth: offload 90%+ of origin traffic
- Availability: origin failure doesn't kill the site
- Cost: CDN egress cheaper than origin egress

---

## 1. Requirements Clarification

### Functional Requirements
- **Cache static content**: Images, JS, CSS, video segments, fonts
- **Cache dynamic content**: HTML pages, API responses (with short TTL)
- **Cache invalidation**: Purge by URL, tag, or all
- **SSL/TLS termination**: HTTPS from edge to user
- **HTTP/2 and HTTP/3**: Modern protocols
- **Compression**: Brotli, gzip at edge
- **Range requests**: For video seeking
- **Signed URLs**: Time-limited access to private content
- **Origin shield**: Regional cache to protect origin
- **Edge computing**: Run code at edge (Cloudflare Workers, Lambda@Edge)
- **DDoS protection**: Absorb attacks at edge
- **WAF**: Block known attack patterns

### Non-Functional Requirements
- **Scale**: 1M+ requests/sec across all PoPs, 10 TB+ cached
- **Latency**: Cache hit < 50 ms at p99 (from nearest PoP)
- **Availability**: 99.99% — CDN must not be a SPOF
- **Hit ratio**: > 90% for static, > 50% for dynamic
- **Coverage**: 100+ PoPs globally, 50+ countries
- **Freshness**: Cache TTL from seconds to years
- **Consistency**: Eventual — stale content acceptable with TTL
- **Cost**: Cheaper than origin egress at scale

### Out of Scope
- Video transcoding (that's a separate system)
- Origin content management
- Real-time streaming (that's a specialized CDN layer)

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Total requests           = 1,000,000,000/day = ~11,574/sec avg
  Peak multiplier          = 5x (evening, events)
  Average object size      = 500 KB (images, video segments)
  Average cache hit ratio  = 90%

Peak requests:
  11,574 x 5 = ~58,000 req/sec

But CDNs are much larger:
  Cloudflare: 60M+ req/sec
  Akamai: 100+ Tbps peak
  CloudFront: 100+ Tbps peak

For this design, target 1M req/sec (mid-size CDN).
```

### Storage

```
Total cacheable content:
  Unique objects       = 100M (popular set)
  Average object size  = 500 KB
  Raw storage          = 50 TB

With replication across PoPs:
  PoPs                 = 200
  Average cache per PoP = 1 TB (smaller PoPs cache less)
  Total edge storage    = 200 TB

Regional caches (10 PoPs):
  Storage per region   = 10 TB
  Total regional       = 100 TB

Total CDN storage: ~300 TB
```

### Bandwidth

```
Total egress:
  1M req/sec x 500 KB = 500 GB/sec = 4 Tbps peak

Per PoP (avg):
  1M / 200 PoPs = 5,000 req/sec
  5,000 x 500 KB = 2.5 GB/sec = 20 Gbps per PoP

Large PoPs (NYC, London):
  10x average = 200 Gbps
```

### Latency Budget

```
Target: < 50 ms p99 for cached content

Breakdown:
  Client -> Edge PoP:        ~5-20 ms
  TLS handshake (cached):    ~5 ms (resumption)
  Cache lookup (in memory):  ~1 ms
  Response transfer:         ~10 ms
  Total:                     ~20-30 ms

For cache miss:
  + Regional fetch:          ~40 ms
  + Origin fetch:            ~200 ms
  Total (worst):             ~300 ms
```

### Cache Economics

```
Origin offload: 90% hit ratio
  Origin serves 10% of requests
  Origin bandwidth: 4 Tbps x 0.10 = 400 Gbps
  Cost savings: ~$X millions/month on origin egress

CDN cost:
  ~$0.02-0.08 per GB egress
  At 4 Tbps x 86400 x 30 days = ~1.3 EB/month
  CDN cost: ~$26M-100M/month (large scale)
```

---

## 3. High-Level Design

```d2
direction: down

user: "End User" {shape: person}
edge: "Edge PoP (200 global)" {shape: cloud}
regional: "Regional Cache (10 global)" {shape: cloud}
shield: "Origin Shield" {shape: cloud}
origin: "Origin Server" {shape: database}
cp: "Control Plane" {shape: rectangle}
config: "Config Store (etcd)" {shape: cylinder}
mon: "Metrics / Logs" {shape: cylinder}
purge: "Purge API" {shape: rectangle}

user -> edge: HTTPS request
edge -> user: cached response
edge -> regional: cache miss
regional -> shield: cache miss
shield -> origin: cache miss
origin -> shield: response
shield -> regional: cache
regional -> edge: cache
edge -> user: response
cp -> config: route config, TLS certs
purge -> cp: invalidate
cp -> edge: invalidate
edge -> mon: metrics
```

### Component Responsibilities

| Component | Role |
|---|---|
| Edge PoP | Closest to user; caches content; serves most requests |
| Regional Cache | Mid-tier cache; protects origin; consolidates requests |
| Origin Shield | Single entry per region to origin; reduces origin load |
| Origin Server | Source of truth (customer's server or S3) |
| Control Plane | Manages config, TLS certs, routing rules |
| Config Store | Distributed config (etcd, Consul) |
| Purge API | Invalidates cached content across PoPs |
| Metrics | Per-PoP metrics, hit ratio, latency |

### PoP Architecture (Inside One Edge PoP)

```d2
direction: down

net: Internet {shape: cloud}
lb: "Edge LB (Anycast BGP)" {shape: hexagon}
tls: "TLS Terminator" {shape: rectangle}
http: "HTTP/2, HTTP/3 Server" {shape: rectangle}
cache: "Cache Layer (RAM + SSD)" {shape: cylinder}
compute: "Edge Compute (Workers)" {shape: rectangle}
fetch: "Origin Fetcher" {shape: rectangle}
log: "Log Shipper" {shape: rectangle}

net -> lb
lb -> tls
tls -> http
http -> cache
http -> compute
cache -> fetch: miss
fetch -> log: log
```

**Inside each PoP:**
- **Anycast BGP**: Same IP advertised from all PoPs; BGP routes user to nearest
- **TLS terminator**: Handles HTTPS handshake (with OCSP stapling)
- **HTTP server**: HTTP/1.1, HTTP/2, HTTP/3 (QUIC)
- **Cache**: Two-tier (RAM for hot, SSD for warm)
- **Edge compute**: Run custom code (Cloudflare Workers)
- **Origin fetcher**: Fetches from regional/origin on miss
- **Log shipper**: Async logs to central system

---

## 4. API Design

### Client-Facing (Standard HTTP)

The CDN is transparent to clients — they use standard HTTP:

```http
GET /images/hero.jpg HTTP/2
Host: cdn.example.com
Accept-Encoding: br, gzip
```

**Response 200 (cache hit):**
```http
HTTP/2 200 OK
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000, immutable
ETag: "a1b2c3d4"
X-Cache: HIT
X-Cache-PoP: mumbai-01
Age: 3600
```

**Response 200 (cache miss):**
```http
HTTP/2 200 OK
X-Cache: MISS
X-Cache-PoP: mumbai-01
X-Origin-Fetch-Time: 45ms
```

### Purge API

```http
POST /api/v1/purge
Content-Type: application/json
Authorization: Bearer <api-token>

{
  "type": "url",
  "urls": [
    "https://cdn.example.com/images/hero.jpg",
    "https://cdn.example.com/css/main.css"
  ]
}
```

**Purge by tag:**
```json
{
  "type": "tag",
  "tags": ["product-12345", "category-electronics"]
}
```

**Purge all:**
```json
{
  "type": "all",
  "confirm": "PURGE-ALL"
}
```

**Response 202:**
```json
{
  "purge_id": "prg-a1b2c3",
  "estimated_completion": "2026-09-17T10:00:05Z",
  "affected_pops": 200
}
```

### Signed URLs

For private content:

```
https://cdn.example.com/private/video.mp4
  ?Expires=1633024800
  &Signature=abc123def456
  &Key-Pair-Id=APKAEXAMPLE
```

**Validation at edge:**
1. Check `Expires` (reject if past)
2. Verify signature using public key
3. Serve if valid; else 403

### Control Plane API

```http
POST /api/v1/zones/{zone_id}/config
{
  "origins": [
    {"hostname": "origin.example.com", "weight": 100}
  ],
  "cache_rules": [
    {
      "match": "*.jpg",
      "ttl_seconds": 31536000,
      "ignore_query": true
    },
    {
      "match": "/api/*",
      "ttl_seconds": 0,
      "bypass_cache": true
    }
  ],
  "tls": {
    "certificate": "auto",
    "min_version": "TLSv1.2"
  }
}
```

---

## 5. Storage Design

### Cache Storage Architecture

```d2
direction: down

epc: "Edge PoP Cache" {shape: rectangle}
ram: "L1: RAM Cache (256 GB)" {shape: cylinder}
ssd: "L2: SSD Cache (10 TB)" {shape: cylinder}
meta: "Metadata (in-memory index)" {shape: cylinder}
note: "RAM: Hot objects (top 1%), ~30 us lookup | SSD: Warm objects (top 10%), ~200 us lookup" {shape: rectangle}

epc -> ram
epc -> ssd
epc -> meta
ram -> note
```

**Two-tier cache:**
- **L1 (RAM)**: Hottest 1% of objects, sub-100 µs lookup
- **L2 (SSD)**: Warm 10% of objects, sub-ms lookup
- **Metadata index**: In-memory hash map (key -> object location)

### Cache Key Design

```
key = method + ":" + host + ":" + path + ":" + query_string + ":" + variant

Where variant includes:
  - Accept-Encoding (br, gzip, identity)
  - Accept-Language (en, hi, ...)
  - User-Agent class (mobile, desktop, bot)
  - Custom vary headers
```

**Example keys:**
```
GET:cdn.example.com:/images/hero.jpg:
GET:cdn.example.com:/api/products:page=1&limit=20
GET:cdn.example.com:/index.html:VARY_EN=gzip,VARY_LANG=en,VARY_UA=desktop
```

### Eviction Policy

- **LRU (Least Recently Used)** for general objects
- **LFU (Least Frequently Used)** for hot objects
- **TTL-based** — objects expire per `Cache-Control` or rule
- **Size-based** — large objects (>100 MB) bypass RAM, go to SSD

**W-TinyLFU** is the modern best-in-class (used by Caffeine, Ristretto).

### Object Format

Each cached object contains:
```
{
  "key": "...",
  "body": <bytes>,
  "headers": {...},
  "status": 200,
  "cached_at": "2026-09-17T10:00:00Z",
  "expires_at": "2026-09-17T11:00:00Z",
  "etag": "a1b2c3d4",
  "content_type": "image/jpeg",
  "size_bytes": 524288,
  "hit_count": 42
}
```

### Metadata Store (Distributed)

Cache metadata (key → object) is stored locally per PoP. No global metadata store needed — CDNs are eventual.

For **purge coordination**, use a central event bus (Kafka) that broadcasts purges to all PoPs.

---

## 6. Deep Dive: Cache Hierarchy and Origin Shield

### Why Multiple Tiers?

Without tiers:
```
200 PoPs x 10 requests/sec to origin = 2,000 req/sec to origin
```

With regional cache:
```
200 PoPs x 10 req/sec = 2,000 req/sec
  -> 10 regional caches (dedup 10x) -> 200 req/sec to origin
```

With origin shield:
```
  -> 1 shield per region (dedup 5x) -> 40 req/sec to origin
```

**Origin shield** consolidates all PoPs in a region through one cache, dramatically reducing origin load.

### Request Flow

```d2
direction: down

user: User {shape: person}
edge: "Edge PoP" {shape: cloud}
regional: "Regional Cache" {shape: cloud}
shield: "Origin Shield" {shape: cloud}
origin: Origin {shape: database}

user -> edge: request
edge -> user: HIT (1 ms)
edge -> regional: MISS -> fetch
regional -> edge: HIT (40 ms)
edge -> user: response
regional -> shield: MISS -> fetch
shield -> regional: HIT (80 ms)
shield -> origin: MISS -> fetch
origin -> shield: response (200 ms)
shield -> regional: cache
regional -> edge: cache
edge -> user: response
```

### Cache Tier Hit Ratios (Typical)

| Tier | Hit Ratio | Response Time |
|---|---|---|
| Edge L1 (RAM) | 60% | ~1 ms |
| Edge L2 (SSD) | 30% | ~5 ms |
| Regional | 5% | ~40 ms |
| Origin shield | 3% | ~80 ms |
| Origin | 2% | ~200 ms |

**Combined edge hit ratio: 90%** (L1 + L2).

### Origin Shield Benefits

- **Deduplication**: 200 PoPs → 1 shield → origin sees 1x load
- **Consistency**: Single cache per region avoids inconsistencies
- **Cost**: Fewer origin fetches = lower egress cost
- **Resilience**: Shield survives origin hiccups

**Cost:** Adds ~20 ms latency on regional miss.

**Recommendation:** Enable for high-traffic zones; disable for low-traffic or latency-critical zones.

---

## 7. Deep Dive: Cache Invalidation

### TTL-Based Invalidation (Default)

```
Cache-Control: public, max-age=31536000, immutable
```

**Pros:** No control plane needed; self-healing.
**Cons:** Stale data up to TTL.

**Best practice:** Version static assets (`app.a1b2c3.js`) with infinite TTL.

### Purge API

```
POST /api/v1/purge
{
  "urls": ["https://cdn.example.com/breaking-news.html"]
}
```

**Flow:**
1. Purge request hits control plane
2. Control plane publishes to Kafka topic `purges`
3. All PoPs subscribe and invalidate locally
4. Propagation: < 1 second globally

### Purge Types

| Type | Speed | Cost | Use Case |
|---|---|---|---|
| URL purge | Fast | Low | Specific file updates |
| Tag purge | Medium | Medium | Category updates |
| Wildcard purge | Slow | High | Bulk invalidation |
| Full purge | Slowest | Highest | Emergency |
| Versioned URLs | Instant | Zero | Static assets |

### Tag-Based Purging

Content is served with tags:
```http
Cache-Tag: product-12345, category-electronics
```

Purge by tag:
```json
{
  "type": "tag",
  "tags": ["product-12345"]
}
```

**Implementation:** Maintain an inverted index (tag → [cache keys]) per PoP.

### Soft Purge (Stale-While-Revalidate)

```http
Cache-Control: public, max-age=60, stale-while-revalidate=3600
```

- After 60s: object is "stale" but still served
- Background refresh fetches new version
- User never sees a slow response

**Benefits:** Zero-latency refreshes; smooth origin load.
**Trade-off:** Slightly stale data for the revalidation window.

### Versioned URLs (Best Practice)

```
Before: https://cdn.example.com/app.js
After:  https://cdn.example.com/app.a1b2c3.js
```

- Content hash in filename
- Cache-Control: `immutable, max-age=31536000`
- No invalidation needed (content changes → new URL)
- Update references in HTML to point to new URL

**Why this wins:** Zero control plane calls; infinite cache; perfect correctness.

---

## 8. Deep Dive: Routing and Anycast

### Anycast BGP

```d2
direction: down

net: "Internet (BGP)" {shape: cloud}
mum: "Edge PoP - Mumbai" {shape: cloud}
fra: "Edge PoP - Frankfurt" {shape: cloud}
vir: "Edge PoP - Virginia" {shape: cloud}
note: "All PoPs advertise the same IP: 1.2.3.4 | BGP routes user to nearest PoP" {shape: rectangle}

net -> mum
net -> fra
net -> vir
net -> note
```

**How it works:**
- All PoPs advertise the same IP prefix via BGP
- BGP routing sends user traffic to the geographically nearest PoP
- No DNS lookup needed; instant failover if a PoP goes down

**Benefits:**
- Lowest latency (routes via shortest AS path)
- Instant failover (BGP withdraws route)
- DDoS absorption (attacks spread across PoPs)

**Challenges:**
- Route flaps cause transient disruptions
- Some ISPs use suboptimal routes
- Cannot easily do geo-specific content (need DNS)

### DNS-Based Routing

```d2
direction: down

user: User {shape: person}
dns: GeoDNS {shape: cloud}
us: "US PoP" {shape: cloud}
eu: "EU PoP" {shape: cloud}

user -> dns: resolve cdn.example.com
dns -> user: 1.2.3.4 (US) or 5.6.7.8 (EU)
user -> us: US users
user -> eu: EU users
```

**GeoDNS** returns different IPs based on client location.

**Pros:** Fine-grained control (per-country, per-ISP).
**Cons:** DNS caching limits agility; TTL trade-off.

**Recommendation:** Anycast for most traffic; DNS for geo-specific routing.

### Multi-CDN

For very high availability, use multiple CDN providers:
- Primary CDN serves most traffic
- Secondary CDN as failover
- DNS-based switching based on health

**Tools:** NS1, Cedexis, Cloudflare Load Balancer.

**Trade-off:** Complexity, split cache, higher cost.

---

## 9. Deep Dive: Edge Computing

### Why Edge Compute?

Run code at the edge, closer to users:
- Personalization (user-specific content)
- A/B testing
- Authentication (JWT validation at edge)
- Request/response transformation
- API aggregation (BFF at edge)

**Tools:** Cloudflare Workers, AWS Lambda@Edge, Fastly Compute@Edge, Deno Deploy.

### Edge Worker Lifecycle

```d2
direction: down

user: User {shape: person}
w: "Edge Worker" {shape: rectangle}
c: Cache {shape: database}
o: Origin {shape: rectangle}

user -> w: request
w -> w: run JavaScript/WASM
w -> c: check cache (KV store)
c -> w: data
w -> o: origin fetch (if needed)
o -> w: response
w -> w: transform
w -> user: response
```

**Runtime:** V8 isolates (Cloudflare) or WASM (Fastly).

**Constraints:**
- CPU time limit (50 ms on Cloudflare)
- Memory limit (128 MB)
- No filesystem access
- Limited outbound connections

### Edge KV Store

Distributed key-value store replicated to edge:
- Cloudflare KV, Fastly Config Store
- Eventually consistent (global replication in < 60 sec)
- Ideal for config, feature flags, session data

### Edge Database

For stateful edge apps:
- Cloudflare D1 (SQLite at edge)
- Turso (libSQL)
- CockroachDB Serverless

**Trade-off:** Higher latency than origin DB, but no round-trip.

### Edge Use Cases

| Use Case | Latency Saved | Value |
|---|---|---|
| A/B testing | 100 ms | Faster experimentation |
| Auth (JWT verify) | 50 ms | No origin round-trip |
| Personalization | 200 ms | User-specific pages |
| Request routing | 100 ms | Smart origin selection |
| Image resizing | 50 ms | On-the-fly variants |
| Bot detection | 30 ms | Block before origin |

---

## 10. Deep Dive: Security

### TLS Termination

- TLS 1.2, 1.3 at edge
- Certificates auto-provisioned (Let's Encrypt, ACME)
- TLS session resumption (fast reconnect)
- OCSP stapling (faster validation)
- HSTS (force HTTPS)

### DDoS Protection

CDN absorbs DDoS attacks naturally:
- **Volume**: Traffic spread across 200+ PoPs
- **Anycast**: BGP distributes attack traffic
- **Rate limiting**: Per-IP, per-session at edge
- **WAF**: Block known attack patterns
- **Challenge-response**: CAPTCHA, JS challenge for suspicious traffic

**Layers of defense:**
1. **L3/L4**: Anycast absorbs volumetric attacks
2. **L7**: WAF rules block SQL injection, XSS
3. **Rate limiting**: Block brute force
4. **Bot detection**: Behavioral analysis, device fingerprinting

### WAF (Web Application Firewall)

Rules for common attacks:
- SQL injection
- XSS (cross-site scripting)
- Path traversal
- Command injection
- Known CVE patterns

**ModSecurity** is the open-source standard; managed rules from Cloudflare/AWS/Akamai.

### Signed URLs and Cookies

**Signed URLs**: Time-limited access:
```
https://cdn.example.com/private/video.mp4
  ?Expires=1633024800
  &Signature=abc123
  &Key-Pair-Id=APKAEXAMPLE
```

**Signed Cookies**: For many files:
```
CloudFront-Policy=...
CloudFront-Signature=...
CloudFront-Key-Pair-Id=...
```

**Verification at edge:**
1. Parse policy (URL, expiration, IP range)
2. Verify HMAC signature
3. Check expiration
4. Allow/deny

### Origin Authentication

CDN → origin must be authenticated:
- **Shared secret header** (simple)
- **mTLS** (strong)
- **AWS Sig V4** (if origin is S3)
- **IP allowlist** (CDN egress IPs at origin)

**Why it matters:** Prevents attackers from bypassing CDN and hitting origin directly.

### Bot Mitigation

- **JavaScript challenges**: Bots fail to execute JS
- **CAPTCHA**: For suspicious traffic
- **Fingerprinting**: Browser characteristics
- **Behavioral**: Request rate, patterns
- **Reputation**: IP blocklists

---

## 11. Scaling Considerations

### Global PoP Expansion

```d2
direction: down

na: "North America (30 PoPs)" {shape: cloud}
eu: "Europe (40 PoPs)" {shape: cloud}
as: "Asia (50 PoPs)" {shape: cloud}
sa: "South America (20 PoPs)" {shape: cloud}
af: "Africa (20 PoPs)" {shape: cloud}
oc: "Oceania (10 PoPs)" {shape: cloud}
```

- **~200 PoPs** globally for good coverage
- Deploy in IXPs (Internet Exchange Points) for peering
- 50+ countries covered
- CapEx: ~$10-50M per PoP (depends on size)

### Scaling Within a PoP

- **Horizontal**: Add more servers behind LB
- **Vertical**: Bigger servers (more RAM, faster SSD)
- **Bandwidth**: Add more transit/peering capacity

### Regional Caches

- **~10-20 regional caches** globally
- Each regional cache serves 10-20 edge PoPs
- Caches larger, less latency-sensitive
- Consolidates origin fetches

### Origin Shield

- **One shield per region** (5-10 globally)
- Serves as single point of contact with origin
- Reduces origin load by 10x-100x
- Critical for small origins

### Edge Compute Scaling

- Workers scale automatically
- Cold starts: < 5 ms (V8 isolates)
- CPU/memory limits keep abuse in check
- Distributed counters for rate limiting

### Cache Warming

For predictable traffic spikes (product launches, live events):
- **Pre-warm**: Fetch content to edge before demand
- **Manual warm**: API to push URLs to specific PoPs
- **Predictive warm**: Based on historical patterns

---

## 12. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Origin load | Origin shield | +20 ms latency |
| Cache hit ratio | Larger caches, tiered storage | Cost |
| Latency | More PoPs (closer to users) | CapEx |
| Purge propagation | Kafka event bus | Sub-second vs minutes |
| Stale content | Short TTL, soft purge | More origin fetches |
| DDoS | Anycast + WAF | Complexity |
| TLS overhead | Session resumption, HTTP/3 | Client support |
| Edge compute | V8 isolates | CPU/memory limits |
| Multi-CDN | DNS failover | Split cache, cost |
| Consistency | Eventual | Stale windows |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Routing | Anycast BGP | Lowest latency, DDoS absorption |
| Cache tiers | Edge → Regional → Shield → Origin | Balance latency and origin load |
| Cache storage | RAM + SSD | Speed for hot, capacity for warm |
| Eviction | LRU / W-TinyLFU | Best general-purpose |
| Protocol | HTTP/2 + HTTP/3 | Multiplexing, faster handshake |
| TLS | 1.3 with session resumption | Security + speed |
| Invalidation | Versioned URLs + purge API | Zero-cost for static |
| Origin protection | Origin shield | 10x origin reduction |
| Security | WAF + DDoS + signed URLs | Layered defense |
| Edge compute | V8 isolates | Fast cold starts |

---

## 13. Failure Scenarios

### Origin Down

**Impact:** Cache misses fail; cached content still served.

**Mitigation:**
- Origin shield caches responses; some traffic unaffected
- Stale-while-revalidate keeps serving stale content
- **Failover origin**: Configure secondary origin (S3, backup server)
- **Custom error page**: Serve last-known-good HTML

### PoP Down

**Impact:** Users routed to that PoP are affected.

**Mitigation:**
- BGP withdraws route; traffic goes to next-nearest PoP
- Downtime: < 60 sec (BGP convergence)
- DNS-based failover for extra reliability

### Cache Poisoning

**Impact:** Attackers inject malicious content into cache.

**Mitigation:**
- Validate `Host` header
- Ignore `X-Forwarded-*` from untrusted sources
- Use cache keys that include all relevant headers
- WAF rules for known poisoning patterns

### Cache Stampede (Thundering Herd)

**Impact:** Popular object expires; thousands of PoPs simultaneously fetch from origin.

**Mitigation:**
- **Origin shield**: Consolidates requests (5-10 requests instead of 1000s)
- **Request collapsing**: Multiple requests for same URL share one origin fetch
- **Soft purge**: Revalidate in background
- **Stale-while-revalidate**: Serve stale while refreshing

### DDoS Attack

**Impact:** Edge PoPs overwhelmed.

**Mitigation:**
- Anycast spreads attack across PoPs
- Rate limiting per IP
- WAF rules block patterns
- Scrubbing centers absorb volumetric attacks
- **Traffic filtering**: Drop obvious bad traffic at IXP

### Certificate Expiry

**Impact:** TLS handshakes fail; users see security warnings.

**Mitigation:**
- Auto-renewal (ACME)
- Monitor expiry; alert 30 days before
- Support multiple certs during rotation

### Purge API Down

**Impact:** Can't invalidate content; stale data persists.

**Mitigation:**
- Queue purge requests in Kafka
- Retry on failure
- Versioned URLs as fallback (content changes → new URL)
- Manual purge as emergency

### Regional Cache Failure

**Impact:** Edge PoPs must fetch from origin directly.

**Mitigation:**
- Origin shield absorbs the load
- Circuit breaker prevents origin overload
- Fall back to serving stale content

### Config Propagation Failure

**Impact:** Some PoPs run old config.

**Mitigation:**
- etcd watch ensures eventual consistency
- Version config; detect skew
- Alert if PoP runs stale config > 5 min

---

## 14. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Edge cache hit ratio | > 90% | < 80% |
| Regional cache hit ratio | > 95% | < 85% |
| Origin fetch p99 latency | < 200 ms | > 500 ms |
| Edge response p99 | < 50 ms | > 100 ms |
| TLS handshake p99 | < 20 ms | > 100 ms |
| PoP error rate (5xx) | < 0.01% | > 0.1% |
| Purge propagation time | < 1 sec | > 5 sec |
| Origin egress | baseline | sudden spike |
| Attack traffic | < 1% | > 10% |
| Cert expiry | > 30 days | < 30 days |

### Dashboards

- **Global**: QPS, throughput, cache hit, error rate
- **Per-PoP**: Same metrics, plus CPU, memory, disk, network
- **Per-zone**: Hit ratio, origin offload, latency
- **Origin**: Requests, bandwidth, errors (should be ~10% of edge)
- **Security**: Blocked attacks, WAF hits, bot traffic
- **Purges**: Rate, propagation time, failures

### Alerts

- **P0**: Multiple PoPs down, origin unreachable, cache hit ratio < 50%
- **P1**: Cert expiry < 7 days, purge propagation > 5 sec
- **P2**: Origin egress spike, DDoS in progress
- **P3**: PoP running stale config, high error rate in one PoP

---

## 15. Cost Estimation

Rough monthly cost for a mid-size CDN (1M req/sec, 4 Tbps peak):

### CDN Operator Perspective (Building a CDN)

| Component | Spec | Cost/month |
|---|---|---|
| PoP infrastructure | 200 PoPs x 10 servers | ~$5M CapEx (amortized ~$200K) |
| Transit/peering | 4 Tbps | ~$500K |
| Storage (SSD) | 300 TB | ~$30K |
| Control plane | etcd, monitoring, CI/CD | ~$20K |
| Engineering team | 30 engineers | ~$500K |
| **Total** | | **~$1.3M/month** |

### Customer Perspective (Using a CDN)

| Component | Spec | Cost/month |
|---|---|---|
| Egress (4 Tbps peak) | ~1.3 EB/month | ~$26M-100M |
| Requests | 1B/day x 30 = 30B | ~$3M |
| Origin shield | Included | $0 |
| WAF | Included | $0 |
| Edge compute | 1B invocations | ~$500K |
| **Total** | | **~$30M-100M/month** |

**Cost optimization:**
- Multi-CDN for negotiating power (10-30% savings)
- Reserved capacity contracts (20-40% savings)
- Edge caching for API responses (fewer origin calls)
- Compression (Brotli saves 20% bandwidth)
- Image optimization (WebP saves 30% bandwidth)

**Note:** CDN economics favor large providers. Small companies often start with Cloudflare (fixed price) or AWS CloudFront (pay-per-use).

---

## 16. Extensions and Follow-ups

### Video Streaming Optimization

For video CDNs:
- **HLS/DASH segmentation**: Small chunks (2-10 sec)
- **Adaptive bitrate**: Client switches quality based on bandwidth
- **Multi-tier caching**: Edge for popular segments, regional for long tail
- **Live streaming**: Low-latency variants (LL-HLS, WebRTC)

### Image Optimization at Edge

- **WebP/AVIF**: Automatic format conversion
- **Resizing**: On-the-fly variants (`?w=800&h=600`)
- **Lazy loading**: Serve placeholders, load full image on scroll
- **Quality**: Adaptive based on device

**Tools:** Cloudflare Images, Imgix, Cloudinary.

### Real-Time Edge (WebRTC)

For low-latency interactive apps:
- **Edge SFU**: Selective Forwarding Unit for video calls
- **TURN servers**: NAT traversal
- **Edge signaling**: Fast WebRTC signaling

**Latency target:** < 200 ms end-to-end.

### Edge ML Inference

Run ML models at edge:
- **Cloudflare Workers AI**: Run models on edge GPUs
- **Fastly Compute**: WASM-based inference
- **Use cases**: Image moderation, recommendations, personalization

**Trade-off:** Smaller models (edge hardware limited).

### Multi-Cloud CDN

Use multiple CDNs for resilience:
- **DNS-based**: Route based on CDN health
- **Anycast-aware**: Different anycast IPs per CDN
- **Cache coherence**: Hard across CDNs

**Tools:** NS1, Cedexis, AWS Global Accelerator.

### Origin Shield Advanced

- **Dedicated shield**: Single shield for a zone
- **Shared shield**: Multiple zones share a shield
- **Regional shields**: Multiple per continent
- **Custom shield location**: Pick where it runs

**Trade-off:** Cost vs origin load reduction.

### HTTP/3 (QUIC)

Benefits:
- **0-RTT resumption**: Faster reconnects
- **Multiplexing**: No head-of-line blocking
- **Connection migration**: Survives IP change
- **Better on lossy networks**

**CDN support:** Cloudflare, Fastly, Akamai, AWS CloudFront (all support HTTP/3).

### Edge Storage (S3-Compatible)

Newer CDNs offer edge storage:
- **Cloudflare R2**: S3-compatible, no egress fees
- **Bunny Storage**: Cheap, fast
- **Fastly Object Storage**: Beta
- **Use case**: Serve user-uploaded content without origin egress

### WebAssembly at Edge

- **Fastly Compute@Edge**: WASM-based edge
- **Cloudflare Workers**: V8 + WASM
- **Fermyon Spin**: Open-source WASM runtime

**Benefits:** Language-agnostic; sandboxed; near-native performance.

### Purge Prediction

Machine learning to predict purge patterns:
- Pre-emptive cache invalidation based on deploy webhooks
- Adaptive TTLs based on change frequency
- Reduces stale content and origin load

---

## 17. Summary

| Aspect | Decision |
|---|---|
| Architecture | Edge (200 PoPs) + Regional (10) + Origin Shield |
| Routing | Anycast BGP (DNS fallback) |
| Cache storage | Two-tier (RAM + SSD) |
| Eviction | LRU / W-TinyLFU |
| Protocol | HTTP/1.1, HTTP/2, HTTP/3 |
| TLS | 1.3 with session resumption |
| Hit ratio | > 90% edge, > 95% regional |
| Invalidation | Versioned URLs + purge API |
| Security | WAF + DDoS + signed URLs |
| Edge compute | V8 isolates |
| Scale | 1M req/sec, 4 Tbps peak |
| Latency | < 50 ms p99 for cached |
| Availability | 99.99% |
| Cost | ~$30M-100M/month egress |

**Key takeaways:**

- **Anycast BGP** routes users to the nearest PoP; instant failover
- **Multi-tier caching** (edge → regional → shield → origin) balances latency and origin load
- **Origin shield** reduces origin load by 10x-100x
- **Versioned URLs** eliminate most invalidation needs
- **Purge via Kafka** propagates globally in < 1 sec
- **Signed URLs** protect private content
- **WAF + DDoS** protection is layered at the edge
- **Edge compute** enables personalization without origin round-trips
- **Video CDNs** need specialized streaming protocols (HLS, DASH)
- **CDN economics** favor large scale; most companies buy CDN, not build it

**Similar Pattern Problems:**

- Video Streaming Platform (uses CDN for delivery)
- File Storage Service (CDN for download acceleration)
- Social Feed (CDN for images, static assets)
- Content Sharing / Microblog (CDN for media)
- Music Streaming (CDN for audio)
- E-Commerce Product Catalog (CDN for product images)
- Live Streaming (uses CDN for live video)