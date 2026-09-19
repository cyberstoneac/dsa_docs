# Web Crawler (Googlebot / Bingbot / Common Crawl)

## Problem Statement

Design a web crawler that systematically browses the internet, downloads web pages, extracts links, and stores content for indexing. The system must crawl billions of pages per day, respect robots.txt and politeness policies, handle duplicate content, avoid infinite loops, scale horizontally, and provide fresh content for search engines. This is the foundation of search engines — Googlebot crawls 100B+ pages.

**Example:**

```
Crawl flow:
  1. Seed URLs added to frontier (e.g., top 1M sites)
  2. URL scheduler picks URLs by priority
  3. Fetcher downloads page (HTTP GET)
  4. Parser extracts:
     - Content (for indexing)
     - Links (for next frontier)
     - Metadata (title, description)
  5. Deduplication:
     - URL seen before? Skip
     - Content duplicate? Skip
  6. Politeness check: Respect robots.txt + crawl-delay
  7. Content stored in document store
  8. Links added to frontier (with priority)
  9. Repeat

Challenges:
  - Scale: 100B pages, 1B pages/day
  - Politeness: Don't overwhelm sites
  - Freshness: Re-crawl changing pages
  - Duplication: Same content, different URLs
  - Dynamic content: JS-rendered pages
  - Traps: Infinite calendars, session IDs
  - Malicious: Malware, phishing
  - Cost: Bandwidth, storage, compute

Scale:
  - 10B+ URLs discovered
  - 100B+ pages in index
  - 1B pages crawled/day (~11,574/sec avg, 57,870/sec peak)
  - 100K sites in frontier
  - 10 PB content/month
  - 1000+ crawler nodes
  - 50 countries
```

**Real-world systems:** Googlebot, Bingbot, Common Crawl, Ahrefs, Moz, Semrush, Scrapy (framework).

**Why it's interesting:**

- **Politeness** — robots.txt, crawl-delay, per-domain rate limits
- **Frontier management** — priority queue of URLs
- **Duplicate detection** — URL + content (SimHash, MinHash)
- **Dynamic content** — JS rendering (headless browser)
- **Traps** — infinite loops, spider traps
- **Freshness** — re-crawl scheduling
- **Scale** — billions of URLs, petabytes of content
- **Cost** — bandwidth, storage, compute dominate
- **Ethics** — respect site owners, avoid abuse
- **Legal** — copyright, terms of service

---

## 1. Requirements Clarification

### Functional Requirements
- **URL discovery**: Start from seeds, follow links
- **Fetch pages**: HTTP/HTTPS, handle redirects
- **Parse content**: HTML, extract text + links
- **Store content**: For indexing
- **Extract links**: Add to frontier
- **Robots.txt**: Respect rules
- **Politeness**: Per-domain rate limit
- **Deduplication**: URLs + content
- **Priority**: Important sites first
- **Freshness**: Re-crawl changed pages
- **Dynamic content**: JS rendering
- **Media**: Images, videos (basic)
- **Sitemaps**: XML sitemaps
- **RSS/Atom**: Feeds

### Non-Functional Requirements
- **Scale**: 1B pages/day, 10B URLs, 100B pages indexed
- **Latency**: Crawl within 24h of discovery (fresh content)
- **Availability**: 99.9%
- **Politeness**: Respect robots.txt, crawl-delay (default 1 req/sec/domain)
- **Throughput**: 1B pages/day = ~11,574/sec avg, 57,870/sec peak
- **Storage**: 10 PB content/month, 100+ PB total
- **Cost**: Bandwidth + storage dominate
- **Compliance**: robots.txt, copyright, GDPR
- **Robustness**: Handle failures, timeouts, malicious sites

### Out of Scope
- Search ranking (separate problem)
- Indexing (separate)
- Ad serving
- Full JS-heavy SPAs (partial support)

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Pages/day            = 1,000,000,000
  Avg page size        = 100 KB
  Peak multiplier      = 5x
  Concurrent crawlers  = 100,000 (peak)

Average QPS:
  Page fetches = 1B / 86,400 = ~11,574/sec
  Peak: ~57,870/sec

Per page:
  DNS lookup: ~20 ms
  TCP connect: ~30 ms
  TLS handshake: ~50 ms
  HTTP GET: ~100-500 ms
  Parse: ~50 ms
  Store: ~20 ms
  Total: ~300-800 ms

Concurrency per crawler: ~100 parallel fetches
Crawlers needed: 57,870 / 100 = ~579 (peak)
```

### Storage

```
Pages (raw):
  1B/day x 100 KB = ~100 TB/day
  Retained 30 days: ~3 PB
  Retained 1 year: ~36 PB

Parsed content:
  30% of raw = ~30 TB/day
  Retained 1 year: ~10 PB

URL frontier:
  10B URLs x 200 bytes = ~2 TB (Redis/DB)

URL metadata:
  10B URLs x 500 bytes = ~5 TB

Content hashes (dedup):
  10B x 64 bytes = ~640 GB

Link graph:
  1T edges x 50 bytes = ~50 TB

Robots.txt:
  100M domains x 5 KB = ~500 GB

Sitemaps:
  100M domains x 100 KB = ~10 TB

Analytics:
  1B fetches x 500 bytes = ~500 GB/day
  1 year: ~182 TB

Total hot: ~50 TB (frontier, cache)
Total cold: ~50 PB
```

### Bandwidth

```
Download:
  1B pages/day x 100 KB = ~100 TB/day
  = ~1.16 GB/sec avg = ~9.3 Gbps
  Peak: ~46 Gbps

Upload:
  Negligible (only HTTP headers)

DNS queries:
  1B x 1 KB = ~1 TB/day

Total: ~50 Gbps peak
```

### Latency Budget

```
Per page fetch:
  DNS lookup:                   ~20 ms
  TCP connect:                  ~30 ms
  TLS handshake:                ~50 ms
  HTTP request:                 ~5 ms
  Server response:              ~100-500 ms (varies)
  Parse:                        ~50 ms
  Store:                        ~20 ms
  Total:                        ~275-675 ms

Target: < 1 sec per page (p99).

Frontier operations:
  Add URL:                      ~5 ms
  Pop URL (priority):           ~10 ms
  Check dedup:                  ~5 ms
  Total:                        ~20 ms
```

---

## 3. High-Level Design

```d2
direction: down

seeds: "Seed URLs" {shape: cloud}
sitemaps: "Sitemaps" {shape: cloud}
web: "Web (external sites)" {shape: cloud}

lb: Load Balancer {shape: hexagon}
api: "Crawler API" {shape: hexagon}

frontier: "URL Frontier" {shape: rectangle}
scheduler: "URL Scheduler" {shape: rectangle}
fetcher: "Fetcher" {shape: rectangle}
parser: "Parser" {shape: rectangle}
dedup: "Deduplication" {shape: rectangle}
robot: "Robots.txt Cache" {shape: rectangle}
dns: "DNS Cache" {shape: rectangle}
storage: "Content Storage" {shape: rectangle}
link: "Link Extractor" {shape: rectangle}
priority: "Priority Service" {shape: rectangle}
analytics: "Analytics" {shape: rectangle}

kafka: Kafka {shape: queue}

frontier_db: "Frontier (Redis + Cassandra)" {shape: cylinder}
content_db: "Content (S3 + Cassandra)" {shape: cylinder}
url_db: "URL Registry (Cassandra)" {shape: cylinder}
link_db: "Link Graph (HBase)" {shape: cylinder}
redis: "Redis (cache, queues)" {shape: cylinder}
ch: "ClickHouse (analytics)" {shape: cylinder}

seeds -> scheduler
sitemaps -> scheduler
scheduler -> frontier
frontier -> scheduler
scheduler -> fetcher
fetcher -> dns
fetcher -> robot
fetcher -> web
web -> fetcher
fetcher -> parser
parser -> link
parser -> storage
link -> priority
priority -> scheduler
storage -> content_db
fetcher -> url_db
scheduler -> frontier_db

kafka -> analytics
analytics -> ch
```

### Component Responsibilities

| Component | Role |
|---|---|
| Crawler API | Entry for manual URL submission |
| URL Frontier | Priority queue of URLs to crawl |
| URL Scheduler | Pick next URLs respecting politeness |
| Fetcher | HTTP client; download pages |
| Parser | Parse HTML, extract links + content |
| Deduplication | Check URL + content duplicates |
| Robots.txt Cache | Cache robots.txt per domain |
| DNS Cache | Cache DNS lookups |
| Content Storage | Store parsed content |
| Link Extractor | Extract + normalize links |
| Priority Service | Score URLs (importance) |
| Analytics | Metrics, dashboards |
| Kafka | Event bus |
| Frontier DB | URL queue (Redis + Cassandra) |
| Content DB | Content (S3 + Cassandra) |
| URL Registry | URL metadata (Cassandra) |
| Link Graph | Links between pages (HBase) |
| Redis | Hot cache + queues |
| ClickHouse | Analytics |

### Why This Architecture

- **Redis** for frontier (fast queue operations)
- **Cassandra** for URL registry (write-heavy)
- **S3** for content (cheap, scalable)
- **HBase** for link graph (wide-column, huge scale)
- **Kafka** for events
- **ClickHouse** for analytics
- **Distributed fetchers** for scale

---

## 4. Deep Dive: URL Frontier

### What is a Frontier?

The **URL frontier** is a priority queue of URLs waiting to be crawled. It's the heart of the crawler.

### Requirements

- **Priority**: Important URLs first
- **Politeness**: Per-domain rate limit
- **Freshness**: Re-crawl schedule
- **Scale**: 10B+ URLs
- **Durability**: Never lose URLs
- **Speed**: Fast push/pop

### Architecture

```
Frontier = Multiple queues by priority
         + Per-domain rate limit
         + Re-crawl scheduling
```

### Priority Levels

- **P0**: Breaking news, high-value sites
- **P1**: Popular sites (high PageRank)
- **P2**: Medium popularity
- **P3**: Low priority
- **P4**: Rarely crawled

**Score = f(PageRank, update frequency, user demand)**

### Per-Domain Queues

**Politeness:** One queue per domain; only one URL fetched at a time per domain.

```
frontier:mumbai-times.com  → [url1, url2, url3]
frontier:ndtv.com          → [url4, url5]
frontier:example.com       → [url6]
```

**Scheduler:** Round-robin across domains, respecting rate limit.

### Frontier Storage

**Redis (hot):**
```
Key: frontier:{domain}
Type: List (FIFO) or Sorted Set (priority)
TTL: Persistent

Key: domain:last_crawled:{domain}
Value: timestamp
TTL: 1 hour
```

**Cassandra (durable):**
```sql
CREATE TABLE url_frontier (
    domain TEXT,
    priority INT,
    url TEXT,
    added_at TIMESTAMP,
    next_crawl_at TIMESTAMP,
    PRIMARY KEY ((domain), priority, added_at)
) WITH CLUSTERING ORDER BY (priority ASC, added_at ASC);
```

### Scheduler

- **Round-robin** across domains
- **Respect rate limit** (1 req/sec/domain default)
- **Priority** within domain
- **Freshness** (re-crawl based on change frequency)

### Re-crawl Scheduling

**Change frequency estimation:**
- **High** (news): Re-crawl every hour
- **Medium** (blogs): Daily
- **Low** (static): Weekly/monthly

**Adaptive:** Based on observed change rate.

### Frontier Scale

```
10B URLs in frontier
~1M domains
~10K URLs per domain (avg)
~100 priority levels

Redis: ~100 shards
Cassandra: ~50 nodes
```

---

## 5. Deep Dive: Politeness and robots.txt

### Why Politeness?

- **Respect site owners**: Don't overwhelm servers
- **Avoid bans**: IP blocked = no more crawling
- **Ethical**: Web is shared resource
- **Legal**: Terms of service

### robots.txt

Standard file at `https://example.com/robots.txt`:
```
User-agent: *
Disallow: /admin/
Disallow: /private/
Crawl-delay: 2
Sitemap: https://example.com/sitemap.xml

User-agent: Googlebot
Allow: /
```

### robots.txt Rules

- **User-agent**: Which crawler (specific or *)
- **Disallow**: Paths not to crawl
- **Allow**: Exceptions
- **Crawl-delay**: Min seconds between requests
- **Sitemap**: Location of sitemap

### robots.txt Cache

```
Key: robots:{domain}
Value: parsed rules + crawl_delay
TTL: 24 hours
```

**Fetch:** Once per domain per day.
**Respect:** Before every URL fetch.

### Crawl Delay

- **Default**: 1 req/sec/domain
- **Respect** robots.txt: Custom delay
- **Adaptive**: If server slow, increase
- **Per-domain** state in Redis

### Rate Limiting

```
Key: rate:{domain}
Type: Token bucket (refill 1/sec)
TTL: Session

Before fetch: check token available
```

### Politeness Algorithm

```
1. Fetch robots.txt (if not cached)
2. Parse rules
3. Check if URL allowed
4. Check crawl-delay (sleep if needed)
5. Acquire domain token
6. Fetch URL
7. Release token
8. Update last-crawl time
```

### Handling 429 (Too Many Requests)

- **Back off**: Exponential
- **Reduce rate**: For that domain
- **Alert**: If persistent

### Handling 403 (Forbidden)

- **Respect**: Don't crawl that path
- **Update robots.txt cache**

### Politeness Scale

```
1M domains
Per-domain state in Redis
Fetches/sec: ~11,574 avg
```

---

## 6. Deep Dive: Deduplication

### Why Dedup?

- **Same URL**: Multiple paths lead to same page
- **Same content**: Different URLs, same content
- **Save bandwidth + storage**

### URL Deduplication

**Normalize URLs:**
- **Lowercase** scheme + host
- **Remove** default ports (80, 443)
- **Remove** fragment (#section)
- **Sort** query parameters
- **Remove** tracking params (utm_*, fbclid)
- **Remove** session IDs (jsessionid)

**Bloom filter:**
- Probabilistic set membership
- "Definitely not seen" OR "maybe seen"
- **False positives**: OK (skip some URLs)
- **No false negatives**: Never skip a seen URL

**Storage:**
```
Bloom filter: ~10 GB for 10B URLs (1% false positive)
```

### Content Deduplication

**SimHash:**
- 64-bit hash of content
- Similar content → similar hash (Hamming distance)
- Threshold: ≤ 3 bits different = duplicate

**MinHash + LSH:**
- For near-duplicate detection
- Locality-Sensitive Hashing

**Exact hash:**
- SHA-256 of content
- Exact duplicates only

**Storage:**
```
SimHash store: 10B hashes x 8 bytes = ~80 GB
Index: HBase (SimHash → URL)
```

### Deduplication Flow

```
1. Compute canonical URL
2. Check URL bloom filter
   - If seen: skip
   - If new: add, continue
3. Fetch page
4. Compute content hash (SHA-256)
5. Check content store
   - If duplicate: skip storing
   - If new: store
6. Compute SimHash for near-dup
7. Check SimHash index
   - If near-dup: mark as duplicate
   - If new: add to index
```

### Dedup Scale

```
1B URLs/day processed
Bloom filter: ~10 GB
Content hashes: ~80 GB
SimHash index: ~500 GB

HBase: ~50 nodes
```

---

## 7. Deep Dive: Fetching and Parsing

### Fetcher

**Requirements:**
- **HTTP/1.1 + HTTP/2**: Modern protocols
- **TLS**: HTTPS support
- **Redirects**: Follow (up to 5)
- **Timeouts**: 10 sec connect, 30 sec total
- **User-Agent**: Identifiable (e.g., "Googlebot/2.1")
- **Compression**: Accept gzip, Brotli
- **Cookies**: Optional (for some sites)
- **Robots.txt**: Check before
- **Rate limit**: Per domain

### Fetcher Implementation

**Distributed:** Thousands of fetcher instances.

**Each fetcher:**
- Async HTTP client (aiohttp, asyncio)
- 100-500 concurrent connections
- Per-domain rate limit
- DNS cache
- TLS session reuse

### Dynamic Content (JS)

**Problem:** Many sites render via JavaScript (React, Vue).

**Solutions:**
- **Headless browser**: Puppeteer, Playwright (expensive)
- **Service worker**: Pre-render
- **API extraction**: Find underlying API
- **Static pre-render**: Use prerender.io

**Trade-off:** Headless = 10x slower, 100x more resource-intensive.

**Strategy:** Use headless only for high-value sites.

### Parser

**Parse HTML:**
- **BeautifulSoup / lxml**: Python
- **Cheerio**: Node.js
- **Nokogiri**: Ruby
- **jsoup**: Java

**Extract:**
- **Text content**: For indexing
- **Links**: `<a href>`, `<area>`
- **Metadata**: title, description, og tags
- **Images**: `<img src>`
- **Structured data**: JSON-LD, microdata

### Link Extraction

**Normalize:**
- Resolve relative URLs
- Handle redirects
- Remove fragments

**Filter:**
- Skip non-HTML (PDF, images) — basic
- Skip known bad (ads, trackers)
- Skip already-seen (bloom filter)

### Parsing Scale

```
1B pages/day
Parse time: ~50 ms per page
Parsers: ~600 instances
```

---

## 8. Deep Dive: Content Storage

### Storage Layers

**Raw HTML:**
- **S3**: Cheap, durable
- **Compressed**: gzip (5x smaller)
- **Retention**: 30-90 days

**Parsed content:**
- **Cassandra**: Fast queries
- **Text + metadata**
- **Retention**: 1+ year

**Link graph:**
- **HBase**: Wide-column, huge scale
- **Retention**: Permanent

### S3 Layout

```
s3://crawler-raw/{domain}/{yyyy}/{mm}/{dd}/{hash}.html.gz
s3://crawler-parsed/{domain}/{yyyy}/{mm}/{dd}/{hash}.json
s3://crawler-metadata/{domain}/{yyyy}/{mm}/{dd}/{hash}.meta
```

### Content Model

```json
{
  "url": "https://example.com/page",
  "url_hash": "abc123...",
  "content_hash": "def456...",
  "title": "Page Title",
  "description": "Meta description",
  "content_text": "Extracted text...",
  "language": "en",
  "links": ["https://example.com/a", "https://other.com/b"],
  "images": ["https://example.com/img.jpg"],
  "metadata": {
    "og_title": "...",
    "og_image": "...",
    "author": "..."
  },
  "crawled_at": "2026-09-19T10:00:00Z",
  "status_code": 200,
  "content_type": "text/html; charset=utf-8",
  "size_bytes": 102400
}
```

### Retention

- **Raw HTML**: 30-90 days
- **Parsed**: 1+ year
- **Metadata**: Forever
- **Link graph**: Forever

### Storage Tiers

- **Hot (30d)**: S3 Standard
- **Warm (1y)**: S3 IA
- **Cold (5y)**: S3 Glacier

### Content Scale

```
1B pages/day x 100 KB = 100 TB/day (raw)
Compressed: ~20 TB/day
Parsed: ~30 TB/day
Total: ~50 TB/day = ~18 PB/year
```

---

## 9. Deep Dive: Priority and Freshness

### Priority Scoring

**URL priority = f(site authority, page importance, freshness, user demand)**

**Signals:**
- **PageRank**: Link-based authority
- **Domain authority**: Site reputation
- **Update frequency**: How often page changes
- **User demand**: Search volume
- **Freshness**: Last crawl time

### PageRank

- **Algorithm**: Iterative (link-based)
- **Computed**: Periodically (weekly)
- **Uses**: Link graph (HBase)
- **Scale**: 100B pages, 1T edges
- **Distributed**: MapReduce / Spark

### Freshness

**Change frequency:**
- **Estimate**: From historical crawl diffs
- **Adaptive**: Update based on observed changes
- **Re-crawl**: When due

**Example:**
- News site homepage: every 5 min
- Blog post: weekly
- Corporate site: monthly

### Re-crawl Scheduling

```
next_crawl_at = last_crawl + expected_interval

Where expected_interval = f(change_history)
```

**Categories:**
- **Hot**: 1 hour
- **Warm**: 1 day
- **Cold**: 1 week
- **Frozen**: 1 month

### Priority Queue

**Multi-level:**
- **P0** (news): Every minute
- **P1** (popular): Hourly
- **P2** (medium): Daily
- **P3** (low): Weekly
- **P4** (rare): Monthly

**Scheduler picks:**
- Highest priority first
- Within priority, FIFO
- Respect politeness

### Freshness Metrics

- **Average age** of content
- **Staleness** (% pages older than expected)
- **Re-crawl rate** (pages/sec)
- **Coverage** (% of known pages crawled recently)

### Priority Scale

```
10B URLs
Priority computed weekly
Re-crawl scheduling: hourly
```

---

## 10. Deep Dive: Crawl Traps and Malicious Sites

### Crawl Traps

**Infinite loops:**
- Calendar with infinite next months
- Session IDs creating infinite URLs
- Faceted search combinations

**Solutions:**
- **URL depth limit**: Max 10 levels
- **URL count per domain**: Max 100K
- **Path pattern detection**: `/calendar/2026/09/19/...`
- **Content similarity**: Stop if too similar to previous

### Session IDs

**Problem:** `?sid=abc123` changes on every request → infinite URLs.

**Detection:**
- Query params that change per request
- Same content, different URLs

**Solution:**
- **URL normalization**: Strip known session IDs
- **Similarity**: If content 99% same, skip

### Infinite Facets

**Problem:** `/shoes?color=red&size=10&brand=nike` → millions of combinations.

**Solution:**
- **Limit parameter combinations**
- **Skip low-value facets**
- **Canonical**: Pick one canonical URL per product

### Malicious Sites

**Malware:**
- Scan downloads with AV
- Check against URL blocklist
- Sandbox rendering

**Phishing:**
- ML detection
- Blocklist
- Don't index

**Spam:**
- Content analysis
- Link analysis
- Don't index

**DDoS:**
- Rate limit per domain
- Block if site returns errors
- Pause crawling

### Trap Detection

```
Per domain:
  If URLs > 100K → flag
  If depth > 10 → flag
  If URL length > 2000 → flag
  If query params > 10 → flag
```

### Malicious Detection

- **URL blocklist**: Google Safe Browsing
- **Content ML**: Detect phishing, malware
- **Sandbox**: Execute JS in sandbox
- **Report**: To site owner, security team

---

## 11. Deep Dive: Distributed Crawling

### Architecture

- **Thousands of fetcher nodes**
- **Each node**: 100-500 concurrent fetches
- **Coordination**: Central frontier
- **Sharding**: By domain (same domain → same node)

### Sharding by Domain

**Why?** Politeness per domain; same domain handled by same node.

```
shard = hash(domain) % N
```

**Benefit:** No cross-node coordination for politeness.

### Coordinator

- **Frontier manager**: Distributes URLs
- **Load balancer**: Routes to fetchers
- **Health check**: Removes dead fetchers
- **Re-assignment**: On fetcher failure

### Fetcher Node

- **HTTP client**: Async, HTTP/2
- **DNS resolver**: Cached
- **TLS**: Session reuse
- **Robots cache**: Local + Redis
- **Rate limiter**: Per domain
- **Parser**: Local
- **Storage client**: S3, Cassandra

### Failure Handling

- **Fetcher crash**: URLs re-queued
- **Timeout**: Mark failed, retry
- **Network error**: Retry with backoff
- **DNS failure**: Cache miss, retry

### Load Balancing

- **Frontier** sends URLs to fetchers
- **Fetcher** processes
- **Reports** status
- **Frontier** schedules more

### Scale

```
1B pages/day
Fetchers: ~600-1000
Concurrent per fetcher: 100
Total concurrent: 100K
```

### Multi-Region

- **Regions**: US, EU, APAC
- **Local fetchers**: Lower latency
- **Local storage**: Data residency
- **Global frontier**: Shared state

---

## 12. Deep Dive: Metrics and Analytics

### Metrics

- **Fetches/sec**: Total, by domain
- **Success rate**: 200, 301, 404, 500
- **Latency**: p50, p95, p99 per fetch
- **Bandwidth**: Ingress
- **Storage**: Content added
- **Dedup rate**: % duplicates
- **Trap rate**: % detected
- **Freshness**: Avg age, staleness

### Dashboards

- **Traffic**: Pages/sec, URLs discovered
- **Latency**: p50/p95/p99
- **Errors**: By status code
- **Domains**: Top crawled
- **Content**: Size, type distribution
- **Dedup**: URL, content, near-dup
- **Robots**: % respected, % crawl-delay
- **Traps**: Detected, avoided
- **Storage**: S3, Cassandra, HBase

### Alerts

- **P0**: Crawler down, storage full
- **P1**: Success rate < 95%, latency p99 > 5 sec
- **P2**: Dedup rate < 30%, trap rate > 1%
- **P3**: Freshness degradation

### Business Metrics

- **Coverage**: % of known URLs crawled
- **Freshness**: Avg age of content
- **Cost per page**: Bandwidth + storage
- **Throughput**: Pages/hour

### Analytics

- **ClickHouse** for high-volume events
- **Hourly/daily aggregations**
- **Per-domain metrics**
- **Trends** (new sites, dying sites)

---

## 13. Scaling Considerations

### Read Scaling

- **Redis** for frontier, cache
- **Read replicas** for Cassandra
- **CDN** for popular content (rare)

### Write Scaling

- **Cassandra** for URLs, content (write-heavy)
- **S3** for content (unlimited)
- **HBase** for link graph
- **Kafka** for events

### Sharding

**Frontier:** By domain.
**URL Registry:** By URL hash.
**Content:** By URL hash.
**Link Graph:** By source URL hash.
**Kafka:** By domain.

### Multi-Region

- **Per-region** crawlers
- **Shared frontier** or regional
- **Data residency** (GDPR)
- **Local DNS** for speed

### Peak Handling

- **News spikes**: 10x
- **New site launches**: 5x
- **Sitemaps published**: 10x
- **Bot detection**: Slow down

### Cost Optimization

| Component | Optimization |
|---|---|
| Bandwidth | Compression, dedup |
| Storage | Tiering, compression |
| Compute | Spot instances |
| DNS | Caching |

### Cost

```
Bandwidth: ~$0.02/GB x 100 TB/day = $2M/day = $60M/month
Storage: ~$0.02/GB x 50 PB = $1M/month
Compute: ~$5M/month
Total: ~$66M/month
```

**Rough cost:** ~$60-70M/month for 1B pages/day.

---

## 14. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Politeness | Per-domain rate limit | Slower crawls |
| Dedup | Bloom filter + SimHash | False positives |
| Priority | Multi-level queue | Complexity |
| Freshness | Adaptive re-crawl | Resource cost |
| JS rendering | Headless browser | 10x cost |
| Storage | S3 tiering | Retrieval latency |
| Scale | Distributed | Coordination |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Frontier | Redis + Cassandra | Fast + durable |
| Content | S3 + Cassandra | Cheap + fast |
| Link graph | HBase | Huge scale |
| Dedup | Bloom + SimHash | Efficient |
| Fetcher | Distributed, async | Scale |
| Politeness | Per-domain state | Respect |
| Priority | Multi-level | Important first |
| Storage tiering | S3 lifecycle | Cost |

---

## 15. Failure Scenarios

### Frontier Down

**Impact:** No new URLs.

**Mitigation:**
- Redis Sentinel
- Cassandra durable
- Alert ops

### Fetcher Node Down

**Impact:** URLs delayed.

**Mitigation:**
- Re-queue
- Auto-restart
- Alert ops

### Storage Down

**Impact:** Can't store content.

**Mitigation:**
- Buffer in local
- Retry
- Alert ops

### DNS Failure

**Impact:** Can't resolve.

**Mitigation:**
- Cache last known
- Fallback DNS
- Alert ops

### robots.txt Unavailable

**Impact:** Don't know rules.

**Mitigation:**
- Default to allow (or block?)
- **Conservative: block**
- Retry with backoff

### Rate Limit (429)

**Impact:** Site blocks us.

**Mitigation:**
- Back off
- Reduce rate
- Alert ops

### Crawl Trap

**Impact:** Wasted resources.

**Mitigation:**
- Detection
- Stop domain
- Alert ops

### Malicious Site

**Impact:** Security risk.

**Mitigation:**
- Sandbox
- Blocklist
- Alert security

### Data Breach

**Impact:** User data exposed.

**Mitigation:**
- Encryption
- Access controls
- Incident response
- Notify users

### Regulatory Action

**Impact:** Legal issues.

**Mitigation:**
- Compliance team
- Respect robots.txt
- Copyright checks

### DDoS

**Impact:** Service unavailable.

**Mitigation:**
- CDN/WAF
- Rate limiting
- Anycast
- Alert ops

---

## 16. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Fetch success rate | > 95% | < 90% |
| Fetch p99 | < 1 sec | > 5 sec |
| Crawl rate | 1B/day | < 500M/day |
| Dedup rate | > 30% | < 10% |
| Trap rate | < 0.1% | > 1% |
| Robots compliance | 100% | < 100% |
| Freshness (avg age) | < 7 days | > 30 days |
| Frontier depth | baseline | > 10x |
| Storage growth | baseline | spike |
| Cost per page | baseline | +50% |

### Dashboards

- **Traffic**: Fetches/sec, URLs discovered
- **Latency**: p50/p95/p99
- **Errors**: By status code
- **Domains**: Top, failed
- **Content**: Size, type, language
- **Dedup**: URL, content, near-dup
- **Robots**: Compliance, crawl-delay
- **Traps**: Detected, blocked
- **Storage**: S3, Cassandra
- **Cost**: Bandwidth, storage

### Alerts

- **P0**: Crawler down, storage full, security incident
- **P1**: Success < 90%, latency > 5 sec
- **P2**: High traps, low dedup
- **P3**: Freshness degradation

### Business KPIs

- **Coverage**: % known URLs crawled
- **Freshness**: Avg age
- **Cost per page**
- **Throughput**

---

## 17. Cost Estimation

Rough monthly cost (AWS, us-east-1) for 1B pages/day:

| Component | Spec | Cost/month |
|---|---|---|
| Fetcher nodes | 1,000 x c6g.2xlarge | ~$240,000 |
| Parser nodes | 200 x c6g.2xlarge | ~$48,000 |
| Frontier (Redis) | 100 x cache.r6g.2xlarge | ~$50,000 |
| Frontier (Cassandra) | 30 x i3.2xlarge | ~$30,000 |
| URL Registry | 50 x i3.2xlarge | ~$50,000 |
| Content (S3 hot) | 3 PB | ~$70,000 |
| Content (S3 archive) | 36 PB | ~$145,000 |
| Link Graph (HBase) | 50 x i3.2xlarge | ~$50,000 |
| Kafka (MSK) | 30 brokers | ~$15,000 |
| ClickHouse | 20 x i3.2xlarge | ~$20,000 |
| Bandwidth | ~46 Gbps peak | ~$2,500,000 |
| Monitoring | Datadog | ~$50,000 |
| **Total** | | **~$3.27M/month** |

**Per page:** ~$0.0001.

**Cost breakdown:**
- **Bandwidth**: ~76%
- **Storage**: ~7%
- **Compute**: ~12%
- **Other**: ~5%

**Cost optimization:**
- **Compression** (5x smaller)
- **Dedup** (30%+ savings)
- **Tiering** (Glacier for old)
- **Cheap egress** (peering)

---

## 18. Extensions and Follow-ups

### Deep Crawling

- Follow links recursively
- Depth control
- Priority by depth

### Focused Crawling

- Topic-specific
- Classifier for relevance
- Domain-specific

### Incremental Crawling

- Only changed pages
- Change detection
- Efficient

### Distributed Crawling

- Multiple machines
- Shared frontier
- Load balancing

### Real-Time Crawling

- News sites
- Social media
- Fast updates

### Mobile Crawling

- Mobile-friendly pages
- Different UA
- App crawling

### API Crawling

- JSON APIs
- GraphQL
- OAuth

### Dark Web

- Tor crawler
- Special handling
- Security

### Structured Data

- Schema.org
- JSON-LD
- Microdata

### AI-Powered

- LLM for parsing
- Visual understanding
- Semantic extraction

### Privacy

- GDPR compliance
- Right to be forgotten
- Data retention

### Web3

- IPFS crawling
- Decentralized
- Blockchain

---

## 19. Summary

| Aspect | Decision |
|---|---|
| Frontier | Redis (hot) + Cassandra (durable) |
| Content | S3 + Cassandra |
| Link Graph | HBase |
| Dedup | Bloom filter + SimHash |
| Fetcher | Distributed, async |
| Politeness | Per-domain rate limit |
| Priority | Multi-level queue |
| Scheduling | Round-robin per domain |
| Robots.txt | Cached per domain |
| Scale | 1B pages/day, 10B URLs |
| Latency | < 1 sec per fetch (p99) |
| Availability | 99.9% |
| Cost | ~$3.27M/month |

**Key takeaways:**

- **Frontier** is the heart — priority queue + politeness
- **Per-domain rate limit** respects sites
- **robots.txt** — always respected
- **Deduplication** — URL (Bloom), content (SimHash)
- **Priority** — PageRank + freshness
- **Re-crawl scheduling** — adaptive based on change frequency
- **JS rendering** — only for high-value sites
- **Traps** — URL depth, count, pattern detection
- **Distributed** — thousands of fetchers
- **Storage tiering** — S3 lifecycle for cost
- **Bandwidth is 76% of cost** — optimize aggressively

### Similar Pattern Problems

- Search Autocomplete — index building
- Social Feed — content ingestion
- Log Ingestion — event ingestion at scale
- Metrics / Monitoring — high-volume ingestion
- Content Moderation — URL/content filtering
- Recommendation Engine — content features
- Product Catalog — data ingestion