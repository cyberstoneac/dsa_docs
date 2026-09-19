# Reddit-style Forum

## Problem Statement

Design a Reddit-style forum where users create communities (subreddits), post content (links, text, images), vote on posts and comments, and have threaded discussions. The system ranks content by a combination of votes and time (hot ranking), supports nested comments, and handles millions of communities, billions of posts, and billions of votes per day.

**Example:**

```
User Priya visits r/technology:

Flow:
  1. Loads subreddit feed (hot, new, top, rising)
  2. Sees ranked posts:
     - Post 1: 15K upvotes, 2 hours old (hot score: 0.87)
     - Post 2: 8K upvotes, 30 min old (hot score: 0.82)
     - Post 3: 22K upvotes, 8 hours old (hot score: 0.65)
  3. Clicks a post → loads comments (threaded)
  4. Top comment: 3K upvotes, 200 replies nested
  5. Votes on post → score updates
  6. Votes on comment → score updates
  7. Comments nested up to N levels deep

Key challenges:
  - Hot ranking (votes + time decay)
  - Nested comments (deep trees)
  - Vote manipulation (bots, brigading)
  - Scaling to millions of communities
  - Real-time score updates
  - Search and discovery
  - Moderation (community-specific rules)

Scale:
  - 500M MAU, 50M DAU
  - 10M communities
  - 1B posts, 50B comments
  - 10B votes/day (~116K/sec avg, 580K/sec peak)
  - 100M comments/day
```

**Real-world systems:** Reddit, Hacker News, Lobsters, Discourse, Voat.

**Why it's interesting:**

- **Hot ranking algorithm** — votes + time, logarithmic scaling
- **Nested comments** — tree structure, deep recursion
- **Vote manipulation** — bots, brigading, sock puppets
- **Community moderation** — distributed moderators, custom rules
- **Massive scale** — millions of communities, billions of votes
- **Real-time scoring** — score updates in near-real-time
- **Sorting modes** — hot, new, top, rising, controversial
- **Search** — across communities and content
- **Moderation** — both automated and human
- **Long-tail communities** — most communities are small

---

## 1. Requirements Clarification

### Functional Requirements
- **Communities (subreddits)**: Create, join, moderate
- **Posts**: Link, text, image, video, poll
- **Comments**: Nested (threaded), edit, delete
- **Votes**: Upvote, downvote, unvote (posts and comments)
- **Sorting**: Hot, New, Top, Rising, Controversial
- **Feed**: Personalized home feed (from joined communities)
- **Search**: Posts, comments, communities, users
- **Moderation**: Community rules, remove, ban, sticky
- **User profile**: Karma, post history, comments
- **Awards**: Give awards to posts/comments (optional)
- **Cross-posting**: Post to multiple communities
- **Notifications**: Replies, mentions, upvotes

### Non-Functional Requirements
- **Scale**: 500M MAU, 10M communities, 1B posts, 50B comments
- **Votes**: 10B votes/day (~116K/sec avg, 580K/sec peak)
- **Latency**: Feed load < 500 ms p99; post/comment < 500 ms
- **Availability**: 99.99%
- **Consistency**: Eventual (score updates within seconds)
- **Ordering**: Hot ranking computed; new = chronological
- **Vote integrity**: Prevent manipulation
- **Moderation**: Multi-layer (ML + human + community)
- **Durability**: Posts, comments, votes persisted

### Out of Scope
- Real-time chat (Reddit Chat is separate)
- Reddit Ads (mentioned briefly)
- Reddit Premium (payments)
- Avatar/NFT systems

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Users                = 500,000,000 (MAU)
  DAU                  = 50,000,000
  Communities          = 10,000,000
  Posts                = 1,000,000,000
  Comments             = 50,000,000,000
  Votes/day            = 10,000,000,000
  Comments/day         = 100,000,000
  Posts/day            = 5,000,000
  Feed views/day       = 5,000,000,000
  Peak multiplier      = 5x

Average QPS:
  Votes     = 10B / 86,400 = ~115,740/sec
  Comments  = 100M / 86,400 = ~1,157/sec
  Posts     = 5M / 86,400 = ~58/sec
  Feed      = 5B / 86,400 = ~57,870/sec

Peak QPS (5x):
  Votes     = ~578,700/sec
  Feed      = ~289,350/sec

Vote write pattern:
  Bursty (viral post, brigading)
  Hot posts can get 100K votes/hour
```

### Storage

```
Posts:
  1B posts x 1 KB (metadata) = ~1 TB
  5 years: ~2.5 TB

Post content:
  1B x 5 KB (text, links) = ~5 TB
  5 years: ~12 TB

Media (images, videos):
  20% of posts have media
  200M media x 500 KB = ~100 TB
  For 5 years: ~500 TB

Comments:
  50B comments x 500 bytes = ~25 TB
  5 years: ~125 TB

Votes:
  10B votes/day x 365 x 5 = 18.25T votes
  Per vote: ~50 bytes (user_id, post_id, direction, ts)
  Total: ~912 TB
  With compression: ~300 TB

Community metadata:
  10M communities x 5 KB = ~50 GB

User data:
  500M users x 2 KB = ~1 TB

Ranking scores:
  Per post/comment: ~50 bytes
  51B items x 50 bytes = ~2.5 TB

Search index:
  ~30% of content size
  ~50 TB

Total: ~400 TB (hot) + ~500 TB (cold)
Media (S3): ~1 PB
```

### Bandwidth

```
Feed responses:
  57,870/sec x 50 KB = ~2.9 GB/sec = ~23 Gbps

Media (CDN):
  Peak: ~100 Gbps

Votes (write):
  578,700/sec x 100 bytes = ~58 MB/sec = ~464 Mbps

Total peak: ~125 Gbps
```

### Latency Budget

```
Feed load (hot):
  Client → API:               ~50 ms
  Auth:                        ~10 ms
  Redis feed cache:            ~5 ms
  Hydrate posts:               ~50 ms
  Enrich (scores, comments):   ~30 ms
  Rank (if fresh):             ~50 ms
  Serialize:                   ~30 ms
  Total:                       ~225 ms

Post creation:
  Client → API:               ~50 ms
  Auth + rate limit:           ~20 ms
  Spam check:                  ~100 ms
  Persist to DB:               ~50 ms
  Queue for fan-out:           ~10 ms
  Return:                      ~50 ms
  Total:                       ~280 ms

Vote:
  Client → API:               ~30 ms
  Auth:                        ~10 ms
  Idempotency check:           ~5 ms
  Write to Kafka:              ~5 ms (async)
  Return:                      ~30 ms
  Total:                       ~80 ms

Vote score propagation:
  Kafka → aggregation:         ~500 ms
  Score update:                ~200 ms
  Cache update:                ~100 ms
  Total:                       ~1 sec (eventual)
```

---

## 3. High-Level Design

```d2
direction: down

user: User {shape: person}
cdn: CDN {shape: cloud}
lb: Edge LB {shape: hexagon}
api: API Gateway {shape: hexagon}

post: Post Service {shape: rectangle}
comment: Comment Service {shape: rectangle}
vote: Vote Service {shape: rectangle}
feed: Feed Service {shape: rectangle}
community: Community Service {shape: rectangle}
user_svc: User Service {shape: rectangle}
search: Search Service {shape: rectangle}
mod: Moderation Service {shape: rectangle}
ranking: Ranking Service {shape: rectangle}
notif: Notification Service {shape: rectangle}

kafka: Kafka {shape: queue}

pdb: "PostgreSQL (users, communities)" {shape: cylinder}
posts: "Post Store (Cassandra)" {shape: cylinder}
comments: "Comment Store (Cassandra)" {shape: cylinder}
votes: "Vote Store (Cassandra)" {shape: cylinder}
redis: "Redis (feed, scores, hot)" {shape: cylinder}
es: "Elasticsearch (search)" {shape: cylinder}
s3: "S3 (media)" {shape: cylinder}
ch: "ClickHouse (analytics)" {shape: cylinder}

user -> cdn
cdn -> lb
lb -> api

api -> post
api -> comment
api -> vote
api -> feed
api -> community
api -> user_svc
api -> search

post -> posts
post -> kafka
post -> pdb

comment -> comments
comment -> kafka

vote -> kafka
vote -> redis

feed -> redis
feed -> posts
feed -> ranking

ranking -> redis
ranking -> ch

kafka -> notif
kafka -> search
kafka -> ranking
kafka -> mod

community -> pdb
user_svc -> pdb

search -> es
post -> s3
comment -> s3
```

### Component Responsibilities

| Component | Role |
|---|---|
| CDN | Static assets, media thumbnails |
| Edge LB | Anycast routing |
| API Gateway | Auth, rate limiting, routing |
| Post Service | Create, edit, delete posts |
| Comment Service | Create, edit, delete comments (nested) |
| Vote Service | Handle upvotes, downvotes |
| Feed Service | Serve home, community, user feeds |
| Community Service | Manage communities, memberships |
| User Service | User profiles, karma |
| Search Service | Full-text search |
| Moderation Service | Content moderation |
| Ranking Service | Compute hot/top/controversial scores |
| Notification Service | Replies, mentions, upvotes |
| Kafka | Event bus |
| PostgreSQL | Users, communities (relational) |
| Cassandra | Posts, comments, votes (write-heavy) |
| Redis | Feed cache, hot scores, sessions |
| Elasticsearch | Search index |
| S3 | Media |
| ClickHouse | Analytics, ranking |

### Why This Architecture

- **Cassandra** for posts, comments, votes (write-heavy, time-series)
- **Redis** for feed cache + hot scores (sub-ms reads)
- **Kafka** for vote events (decouple write from aggregation)
- **PostgreSQL** for communities, users (relational, ACID)
- **ClickHouse** for ranking and analytics
- **S3 + CDN** for media
- **Ranking Service** computes scores asynchronously

---

## 4. API Design

### Community

```http
POST /v1/communities
{
  "name": "technology",
  "description": "Tech news and discussion",
  "type": "public",
  "nsfw": false
}

GET /v1/communities/technology
POST /v1/communities/technology/join
DELETE /v1/communities/technology/join
```

### Post

```http
POST /v1/communities/technology/posts
Content-Type: application/json
Authorization: Bearer <user-token>
Idempotency-Key: post-uuid-xyz

{
  "type": "link",
  "title": "New breakthrough in AI",
  "url": "https://example.com/ai-breakthrough",
  "body": "Discussion thread",
  "flair": "News"
}
```

**Response 201:**
```json
{
  "post_id": "post-123",
  "community_id": "c-tech",
  "author_id": "u-456",
  "type": "link",
  "title": "New breakthrough in AI",
  "url": "https://example.com/ai-breakthrough",
  "created_at": "2026-09-19T10:00:00Z",
  "score": 1,
  "upvote_ratio": 1.0,
  "comment_count": 0
}
```

### Get Post

```http
GET /v1/posts/post-123
```

**Response:**
```json
{
  "post_id": "post-123",
  "title": "New breakthrough in AI",
  "url": "https://example.com/ai-breakthrough",
  "body": "",
  "community": {"name": "technology", "id": "c-tech"},
  "author": {"username": "alice", "karma": 12450},
  "created_at": "2026-09-19T10:00:00Z",
  "score": 1247,
  "upvote_ratio": 0.94,
  "comment_count": 89,
  "user_vote": 1,
  "is_saved": false
}
```

### Get Comments (Nested)

```http
GET /v1/posts/post-123/comments?sort=best&limit=100
```

**Response:**
```json
{
  "post_id": "post-123",
  "comments": [
    {
      "comment_id": "cmt-1",
      "parent_id": null,
      "author_id": "u-789",
      "body": "This is huge!",
      "score": 342,
      "created_at": "...",
      "depth": 0,
      "replies": [
        {
          "comment_id": "cmt-2",
          "parent_id": "cmt-1",
          "body": "Agreed!",
          "score": 89,
          "depth": 1,
          "replies": []
        }
      ]
    }
  ],
  "total_comments": 89
}
```

### Add Comment

```http
POST /v1/posts/post-123/comments
{
  "body": "Great discussion",
  "parent_id": null
}
```

### Vote

```http
POST /v1/votes
{
  "target_type": "post",         // or comment
  "target_id": "post-123",
  "direction": 1                 // 1 up, -1 down
}
```

**Response 200:**
```json
{
  "vote_id": "v-abc",
  "target_id": "post-123",
  "direction": 1,
  "score": 1248
}
```

### Feed

```http
GET /v1/feed/home?sort=hot&limit=25&cursor=xyz
GET /v1/r/technology/hot?limit=25&cursor=xyz
GET /v1/r/technology/new
GET /v1/r/technology/top?time=day
GET /v1/r/technology/rising
GET /v1/r/technology/controversial
```

### Search

```http
GET /v1/search?q=AI+breakthrough&type=posts&subreddit=technology&sort=relevance
```

### Moderator Actions

```http
POST /v1/mod/remove
{
  "target_type": "post",
  "target_id": "post-123",
  "reason": "spam",
  "mod_note": "Removed as spam"
}

POST /v1/mod/ban
{
  "user_id": "u-456",
  "community_id": "c-tech",
  "duration_days": 7,
  "reason": "harassment"
}
```

---

## 5. Database Design

### PostgreSQL Schema (Users, Communities)

```sql
-- Users
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    post_karma BIGINT DEFAULT 0,
    comment_karma BIGINT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Communities (subreddits)
CREATE TABLE communities (
    community_id BIGINT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200),
    description TEXT,
    type VARCHAR(20) DEFAULT 'public',    -- public, restricted, private
    nsfw BOOLEAN DEFAULT FALSE,
    creator_id BIGINT REFERENCES users(user_id),
    subscriber_count INT DEFAULT 0,
    is_quarantined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_communities_name ON communities(name);

-- Community members
CREATE TABLE community_members (
    community_id BIGINT REFERENCES communities(community_id),
    user_id BIGINT REFERENCES users(user_id),
    role VARCHAR(20) DEFAULT 'member',    -- member, mod, admin
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);
CREATE INDEX idx_community_members_user ON community_members(user_id);

-- Community rules
CREATE TABLE community_rules (
    rule_id BIGINT PRIMARY KEY,
    community_id BIGINT REFERENCES communities(community_id),
    title VARCHAR(200),
    description TEXT,
    display_order INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Moderator actions
CREATE TABLE mod_actions (
    action_id BIGINT PRIMARY KEY,
    community_id BIGINT,
    actor_id BIGINT,
    target_type VARCHAR(20),              -- post, comment, user
    target_id BIGINT,
    action VARCHAR(50),                   -- remove, approve, ban, mute
    reason VARCHAR(200),
    mod_note TEXT,
    duration_hours INT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_mod_actions_community ON mod_actions(community_id, created_at DESC);
```

### Cassandra Schema (Posts, Comments, Votes)

```sql
-- Posts (partition by community, time-bucketed)
CREATE TABLE posts (
    community_id BIGINT,
    bucket INT,                         -- week number
    post_id TIMEUUID,
    author_id BIGINT,
    type TEXT,                          -- link, text, image, video, poll
    title TEXT,
    url TEXT,
    body TEXT,
    media_id BIGINT,
    flair TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_removed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    PRIMARY KEY ((community_id, bucket), post_id)
) WITH CLUSTERING ORDER BY (post_id DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_size': 7, 'compaction_window_unit': 'DAYS'};

-- Posts by ID
CREATE TABLE posts_by_id (
    bucket INT,
    post_id TIMEUUID,
    community_id BIGINT,
    author_id BIGINT,
    type TEXT,
    title TEXT,
    url TEXT,
    body TEXT,
    media_id BIGINT,
    is_deleted BOOLEAN,
    is_removed BOOLEAN,
    created_at TIMESTAMP,
    PRIMARY KEY ((bucket), post_id)
);

-- Comments (partition by post_id, clustering by parent + time)
CREATE TABLE comments (
    post_id TIMEUUID,
    comment_id TIMEUUID,
    parent_id TIMEUUID,                  -- null for top-level
    author_id BIGINT,
    body TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_removed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    PRIMARY KEY ((post_id), comment_id)
) WITH CLUSTERING ORDER BY (comment_id ASC);

-- Comments by parent (for threaded view)
CREATE TABLE comments_by_parent (
    post_id TIMEUUID,
    parent_id TIMEUUID,
    comment_id TIMEUUID,
    author_id BIGINT,
    body TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY ((post_id, parent_id), comment_id)
) WITH CLUSTERING ORDER BY (comment_id ASC);

-- Votes (immutable log)
CREATE TABLE votes (
    target_type TEXT,                    -- post, comment
    target_id TIMEUUID,
    user_id BIGINT,
    direction SMALLINT,                  -- 1 or -1
    created_at TIMESTAMP,
    PRIMARY KEY ((target_type, target_id), user_id)
);

-- User's votes (for "my votes" view)
CREATE TABLE user_votes (
    user_id BIGINT,
    target_type TEXT,
    target_id TIMEUUID,
    direction SMALLINT,
    created_at TIMESTAMP,
    PRIMARY KEY ((user_id), created_at, target_id)
) WITH CLUSTERING ORDER BY (created_at DESC);

-- Post/comment scores (denormalized)
CREATE TABLE scores (
    target_type TEXT,
    target_id TIMEUUID,
    upvotes BIGINT,
    downvotes BIGINT,
    score BIGINT,
    hot_score DOUBLE,
    updated_at TIMESTAMP,
    PRIMARY KEY ((target_type), target_id)
);
```

### Redis Data Structures

```
-- Hot ranking (per community, per sort type)
Key: ranking:{community_id}:hot
Type: Sorted Set
Value: post_id (score = hot_score)
TTL: 1 hour

-- Hot ranking (personalized home feed)
Key: ranking:{user_id}:home
Type: Sorted Set
Value: post_id (score = personalized_hot_score)
TTL: 30 min

-- Post/comment score (real-time)
Key: score:{target_type}:{target_id}
Type: Hash
Fields: upvotes, downvotes, score
TTL: 24 hours

-- User's vote (fast lookup for user_vote)
Key: vote:{user_id}:{target_type}:{target_id}
Value: direction (1 or -1)
TTL: 7 days

-- Comment tree cache
Key: comments:{post_id}:top
Type: List of comment_ids (top 100)
TTL: 5 min

-- Karma counter (async updated)
Key: karma:{user_id}
Type: Hash
Fields: post_karma, comment_karma
TTL: 1 hour

-- Rate limiting
Key: ratelimit:{user_id}:votes
Value: count
TTL: 1 min

-- Vote dedup (prevent double-vote)
Key: voted:{user_id}:{target_type}:{target_id}
TTL: 1 hour
```

### ClickHouse (Ranking, Analytics)

```sql
-- Aggregated vote counts (materialized)
CREATE TABLE vote_aggregates (
    target_type String,
    target_id UInt64,
    upvotes UInt64,
    downvotes UInt64,
    score Int64,
    hour DateTime,
    PRIMARY KEY (target_type, target_id, hour)
);

-- Vote events stream (for real-time aggregation)
CREATE TABLE vote_events (
    user_id UInt64,
    target_type String,
    target_id UInt64,
    direction Int8,
    community_id UInt64,
    country String,
    event_time DateTime
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(event_time)
ORDER BY (target_type, target_id, event_time)
TTL event_time + INTERVAL 90 DAY;

-- Materialized view: hourly vote counts
CREATE MATERIALIZED VIEW hourly_votes AS
SELECT
    target_type,
    target_id,
    toStartOfHour(event_time) AS hour,
    countIf(direction = 1) AS upvotes,
    countIf(direction = -1) AS downvotes,
    sum(direction) AS score
FROM vote_events
GROUP BY target_type, target_id, hour;
```

### S3 Buckets

```
s3://forum-media/{community_id}/{yyyy}/{mm}/{media_id}/
  - original
  - thumb
  - medium
```

### Elasticsearch

```json
{
  "mappings": {
    "properties": {
      "post_id": {"type": "keyword"},
      "community_id": {"type": "keyword"},
      "author_id": {"type": "keyword"},
      "title": {"type": "text", "boost": 3},
      "body": {"type": "text"},
      "url": {"type": "keyword"},
      "flair": {"type": "keyword"},
      "created_at": {"type": "date"},
      "score": {"type": "integer"},
      "comment_count": {"type": "integer"},
      "is_deleted": {"type": "boolean"},
      "nsfw": {"type": "boolean"}
    }
  }
}
```

---

## 6. Deep Dive: Hot Ranking Algorithm

### The Challenge

Reddit's "hot" ranking balances:
- **Votes**: More votes = higher rank
- **Time**: Newer posts get a boost
- **Logarithmic scaling**: Prevents 10K-vote posts from dominating forever

### Reddit's Hot Formula

```
score = log10(max(|upvotes - downvotes|, 1))
        + sign(upvotes - downvotes) * seconds / 45000

Where:
  seconds = post_age_in_seconds (from epoch)
  sign = +1 if net positive, -1 if net negative
```

**Observations:**

- Log10 of votes: 10 votes → 1, 100 votes → 2, 1000 votes → 3
- Time term dominates as post ages
- Newer posts with few votes can outrank older posts with many

### Walkthrough

**Post A**: 10,000 upvotes, 2 hours old
```
score = log10(10000) + (epoch_now - 7200) / 45000
     = 4.0 + (epoch_now - 7200) / 45000
```

**Post B**: 100 upvotes, 30 min old
```
score = log10(100) + (epoch_now - 1800) / 45000
     = 2.0 + (epoch_now - 1800) / 45000
```

**Difference**: Post A is +2 higher from log term, but Post B is +0.12 higher from time (5400 sec / 45000).

**Net**: Post A still ranks higher (2.0 - 0.12 = 1.88 higher).

**At 24 hours old**, Post A's time term is much smaller relative to Post B. If B gained 500 upvotes in 24h:
```
A: log10(10000) + (epoch - 86400) / 45000
B: log10(600) + (epoch - 300) / 45000
```

B might overtake A due to freshness.

### Tuning Parameters

- **Log base**: 10 (Reddit). Base 2 or e also common.
- **Time divisor**: 45000 sec (~12.5 hours). Higher = slower decay.
- **Sign**: Preserves sign for negative scores.

### Hot Score Computation

**When?**
- On each vote (async)
- Periodically (every 5 min) for active posts
- On feed load (if stale)

**Where?**
- **In Redis**: Fast read, updated async
- **In ClickHouse**: Materialized for analytics

**Implementation:**
```
1. Vote event arrives → Kafka
2. Aggregator consumes, updates Redis score
3. Every 5 min, Ranking Service:
   - Reads top 1000 posts per community
   - Recomputes hot score
   - Updates Redis sorted set
4. On feed load:
   - ZREVRANGE ranking:{community}:hot 0 100
   - Hydrate posts
```

### Other Sorting Modes

**New:** Chronological (post_id DESC, which encodes time).
**Top:** Score DESC (filtered by time window: hour, day, week, month, year, all).
**Rising:** Recent posts with high vote velocity.
**Controversial:** Posts with high upvote AND downvote counts.

### Controversial Score

```
controversial_score = min(upvotes, downvotes) / max(1, upvotes + downvotes)
```

High when upvotes ≈ downvotes (contested content).

### Rising Score

```
rising_score = votes_last_hour / age_hours
```

Detects posts gaining traction fast.

### Personalized Hot

For home feed, personalize the score:
```
personalized_score = hot_score
                   * (1 + author_affinity * 0.3)
                   * (1 + community_affinity * 0.2)
```

Where `author_affinity` and `community_affinity` are user-specific.

### Score Updates at Scale

**Problem:** 10B votes/day → 116K score updates/sec.

**Solution:**
- **Sharded counters** in Redis (per post)
- **Aggregate via Kafka**: Votes → Kafka → Aggregator → Redis
- **Batch updates**: Each aggregator consumes a partition, updates a batch
- **Deduplication**: Only count each user once per target

**Handling vote changes:**
```
User A upvotes post → +1
User A changes to downvote → -2 (remove upvote, add downvote)
User A unvotes → -1
```

**Implementation**: Store user's current vote; on change, apply delta.

---

## 7. Deep Dive: Nested Comments

### The Challenge

Comments are hierarchical:
- Top-level comments (parent = post)
- Replies to comments
- Replies to replies (recursive)

**Depth:** Reddit allows ~10-20 levels deep (practically).
**Ordering:** "Best" ranking (by score, adjusted for depth).

### Storage Strategies

**Option 1: Adjacency list (parent_id)**
```
comment: { id, parent_id, ... }
```
- Simple, flexible
- Query: recursive (`WITH RECURSIVE`)
- Slow for deep trees

**Option 2: Materialized path**
```
comment: { id, path: "1/2/5/8" }
```
- Fast ancestor queries
- Update cost on move

**Option 3: Nested sets**
- Fast subtree queries
- Expensive writes

**Option 4: Closure table**
```
comment_closure: { ancestor_id, descendant_id, depth }
```
- Fast ancestor/descendant queries
- More storage

**Recommendation: Adjacency + materialized path** for Reddit-style.

### Cassandra Schema for Comments

```sql
-- Comments by post (top-level)
CREATE TABLE comments_by_post (
    post_id TIMEUUID,
    comment_id TIMEUUID,
    parent_id TIMEUUID,
    author_id BIGINT,
    body TEXT,
    score BIGINT,
    depth INT,
    created_at TIMESTAMP,
    PRIMARY KEY ((post_id), comment_id)
) WITH CLUSTERING ORDER BY (comment_id ASC);

-- Comments by parent (for tree traversal)
CREATE TABLE comments_by_parent (
    post_id TIMEUUID,
    parent_id TIMEUUID,
    comment_id TIMEUUID,
    author_id BIGINT,
    body TEXT,
    score BIGINT,
    depth INT,
    created_at TIMESTAMP,
    PRIMARY KEY ((post_id, parent_id), comment_id)
) WITH CLUSTERING ORDER BY (comment_id ASC);
```

### Fetching Comments

**Approach: Load top N, expand on demand**

```
1. Fetch top 100 top-level comments (by hot score)
2. Hydrate each with author, score
3. For each, include reply count
4. Client expands on click → fetch replies
```

**Why:** Loading full tree is expensive. Load progressively.

**Preloading:**
For "best" sort, preload 3-5 levels deep for top comments.

**Cache:**
- Top comments per post: Redis (5 min TTL)
- Full tree: only on demand

### Comment Ranking ("Best" Sort)

**Default:** Best (highest score, adjusted for time)
**Options:** New, Controversial, Old

**Best score:**
```
best_score = score / (age_hours + 2)^1.5
```

Similar to Reddit's comment sort.

### Comment Tree Traversal

For deep threads:
- **Recursive fetch**: Query children of each node
- **BFS**: Level-by-level
- **Materialized path**: Query by prefix

**Recommendation:** BFS with depth limit.

```
1. Fetch top-level comments (parent_id = null)
2. For each, fetch children (parent_id = comment_id)
3. Continue until depth limit or no children
4. Assemble tree
```

**Latency:** For 100 top-level + 500 total comments: ~100-200 ms.

### Comment Ordering

Within a thread:
- **Top replies first** (best)
- **Chronological for "new"**
- **Controversial for "controversial"**

### Collapsing

**Deep threads** collapse:
- Show first 3 levels
- "View more replies" for deeper
- Count remaining

**Prevents:**
- Cognitive overload
- Page slowness

### Comment Editing

- **Window**: 5 min after post
- **Mark**: "edited" flag
- **History**: Not shown (usually)

### Comment Deletion

- **User deletes**: soft delete (show "[deleted]")
- **Moderator removes**: show "[removed]"
- **Children preserved**: replies still visible

### Spam/Abuse in Comments

- **Rate limit**: 1 comment per 10 sec, 50/day for new accounts
- **Karma gate**: Minimum karma to comment in some communities
- **Automod**: Community rules enforced
- **ML**: Spam/hate detection
- **Reports**: User reports

---

## 8. Deep Dive: Vote Integrity and Anti-Manipulation

### The Threat

- **Bot votes**: Automated upvote/downvote
- **Sock puppets**: Multiple accounts by one person
- **Brigading**: Cross-community coordinated voting
- **Vote rings**: Groups upvoting each other
- **Bought votes**: Paid upvotes
- **Shadow banning**: Silent restriction

### Detection Strategies

**1. Account age and karma**
- New accounts (< 7 days): limited votes
- Low karma: some votes don't count
- Verified accounts: full weight

**2. Voting patterns**
- Fast voting (many votes/sec): suspicious
- Consistent voting for one user: suspicious
- Voting only on their own content: suspicious

**3. IP / device signals**
- Multiple accounts from same IP: suspicious
- VPN/proxy: reduced weight
- Device fingerprint matching: same actor

**4. Network analysis**
- Graph of who votes for whom
- Detect vote rings
- Detect sock puppets (linked accounts)

**5. Content signals**
- Votes on removed content: ignored
- Votes on quarantined content: reduced
- Votes during brigading: ignored

### Vote Weighting

Not all votes are equal:

```
vote_weight = base_weight
            * account_age_factor
            * karma_factor
            * reputation_factor
            * (1 - suspicious_penalty)
```

**Example:**
- New account: weight 0.1
- Normal account: weight 1.0
- High-karma account: weight 1.2
- Flagged account: weight 0.0 (vote ignored)

### Shadow Banning

**What:** Restrict user's visibility without notifying them.

**Why:** Prevents banned users from creating new accounts immediately.

**Implementation:**
- User's posts still appear to them
- Not visible to others
- User's votes don't count
- User thinks they're still active

**Controversy:** Sometimes called "censorship"; platforms defend as spam prevention.

### Brigading Detection

**Scenario:** A large community invades another via cross-post, mass upvoting/downvoting.

**Detection:**
- Cross-community traffic spike
- Unusual vote patterns on target
- Same source IPs
- Temporal clustering

**Response:**
- Flag votes as brigading
- Ignore those votes
- Quarantine target content
- Temporary account restrictions

### Vote Ring Detection

**Scenario:** Group of users upvoting each other's posts.

**Detection:**
- Graph analysis (who votes for whom)
- Bipartite graph: users ↔ content
- Dense subgraph = vote ring

**Algorithm:**
- Build graph
- Compute modularity
- Detect clusters
- Flag suspicious clusters

### Vote Manipulation Metrics

- **Vote-brigade rate**: % votes flagged as brigading
- **Bot detection rate**: % bots identified
- **Shadow ban rate**: % accounts shadow banned
- **Appeal reversal rate**: % shadow bans reversed
- **False positive rate**: legit users flagged

### Mitigation

- **Slow voting**: Limit votes per minute
- **Confirmation**: CAPTCHA for suspicious activity
- **Verification**: Email/phone verification
- **Karma gates**: Subreddits can require X karma to vote
- **Community moderation**: Mods can restrict voting

### Privacy vs Detection

Detecting manipulation requires signals:
- IP, device, behavior

**Trade-off:** More detection = less privacy.

**Approach:** Minimize data collection; use only for anti-abuse.

---

## 9. Deep Dive: Community Scaling

### The Long Tail

Most communities are small:
- 100K communities have < 100 members
- 1K communities have > 1M members
- Top 100 communities drive 50%+ of traffic

**Implication:** Design for both small (long-tail) and large (top) communities.

### Sharding

**By community_id**: Each community's data on one shard.
- Pros: Local consistency, simple
- Cons: Large communities need dedicated shards

**Hybrid:**
- Small communities: shared shards
- Large communities: dedicated shards

**Threshold:** ~1M members → dedicated shard.

### Feed Generation

**Small community:** Simple `SELECT * ORDER BY hot` (fast).

**Large community:** Pre-computed hot ranking (Redis), paginated.

**Personalized feed:** Merge top posts from user's communities, rank by personalization.

### Cross-Community Content

- **Cross-posting**: One post appears in multiple communities
- **Multireddits**: User groups communities
- **r/all**: Global feed across all communities
- **r/popular**: Filtered global feed

### Moderation at Scale

- **AutoMod**: Community-configurable rules (regex, karma, account age)
- **Bot moderators**: Community bots enforce rules
- **Human moderators**: Volunteer per community
- **Admin intervention**: For severe violations across communities

### Community Discovery

- **Search**: Full-text search
- **Trending**: Rising communities
- **Similar**: ML-based recommendation
- **r/all**: Sorted by hot
- **Home feed**: From joined communities

### Community Health

- **Active users**: DAU/MAU per community
- **Moderation ratio**: Reports vs content
- **Growth rate**: New subscribers
- **Content quality**: Upvote ratio, engagement

### Abandoned Communities

- **Inactive mods**: Platform intervention
- **Reddit request**: Users can request abandoned subs
- **Quarantine**: For problematic subs

---

## 10. Deep Dive: Search and Discovery

### Search Requirements

- **Posts**: By title, body, URL
- **Comments**: Full-text
- **Communities**: By name, description
- **Users**: By username, display name
- **Filters**: Subreddit, date, score, NSFW, flair
- **Sort**: Relevance, Top, New, Comments

### Elasticsearch Index

**Posts index:**
- title (boosted)
- body
- URL
- author
- community
- flair
- score
- comment_count
- created_at

**Comments index:**
- body
- author
- post_id
- community_id
- score
- created_at

**Communities index:**
- name
- title
- description
- subscriber_count

### Ranking

**Text relevance** (BM25) + **engagement** (score, comments) + **recency** + **community authority**.

### Real-Time Indexing

- Post created → Kafka → Indexer → Elasticsearch (within 5 sec)
- Comment created → similar
- Score updates: batched every 1 min

### Search UI

- **Autocomplete**: As you type
- **Filters**: Sidebar for community, date, sort
- **Subreddit filter**: "in r/technology"
- **Boolean**: "AND", "OR", "NOT"
- **Exact phrase**: "in quotes"

### Discovery

**Trending**: Rising posts across communities.
**Recommended communities**: ML-based from user's activity.
**Related communities**: Co-membership patterns.

### Search Latency

- **Autocomplete**: < 100 ms
- **Full search**: < 500 ms
- **Deep filters**: < 1 sec

---

## 11. Deep Dive: Moderation

### Community Moderation Model

- **Volunteer moderators**: Users run communities
- **Community rules**: Custom per community
- **Automod**: Community-configured rules
- **Platform policy**: Overrides community rules

### Mod Actions

- **Remove post/comment**: Mark as removed
- **Approve**: Override auto-removal
- **Ban user**: Temporary or permanent
- **Mute user**: Cannot message mods
- **Lock thread**: No new comments
- **Distinguish**: Mod comments highlighted
- **Sticky**: Pin post at top

### Mod Tools

- **Mod queue**: Reports pending review
- **Mod log**: History of actions
- **Modmail**: Mod-user messaging
- **Ban list**: Banned users
- **Approved submitters**: Whitelist

### AutoMod

Community-configurable rules:
```yaml
rules:
  - name: "Block spam domains"
    action: remove
    conditions:
      - url_contains: ["spam.com", "scam.net"]
  
  - name: "Require flair"
    action: remove
    conditions:
      - post_type: link
      - missing_flair: true
  
  - name: "New account restriction"
    action: filter
    conditions:
      - account_age_days: < 7
      - karma: < 100
```

### Platform-Level Moderation

- **Content moderation**: ML for hate, spam, CSAM
- **Ban evasion**: Detecting banned users returning
- **Quarantine**: For controversial communities
- **Ban community**: For severe violations

### Moderation Transparency

- **Public mod log**: Users see actions
- **Mod notes**: Explain decisions
- **Appeal process**: Via modmail
- **Admin escalation**: For mod abuse

### Mod Abuse Prevention

- **Moderator Code of Conduct**: Platform-wide rules
- **Mod removal**: For abuse
- **Community takeover**: For abandoned communities

### Cost

- **Volunteer mods**: Free (but need tools)
- **Automod**: Cheap (rules engine)
- **Admin**: Paid staff for platform moderation
- **ML**: For platform-wide scanning

---

## 12. Scaling Considerations

### Read Scaling

- **Redis** for hot rankings (per community)
- **Read replicas** for PostgreSQL
- **Cassandra** for posts, comments (linear scale)
- **CDN** for media
- **Elasticsearch** for search

### Write Scaling

- **Kafka** for votes (decouple)
- **Cassandra** for posts, comments (write-heavy)
- **Sharded aggregators** for vote counting

### Sharding

**Cassandra:**
- Posts: partition by `(community_id, bucket)`
- Comments: partition by `post_id`
- Votes: partition by `(target_type, target_id)`

**PostgreSQL:**
- Users: shard by `user_id`
- Communities: shard by `community_id`

**Kafka:**
- Votes: partition by `target_id`
- Posts: partition by `community_id`

### Multi-Region

```d2
direction: down

us: "US Region" {
  shape: cloud
}
eu: "EU Region" {
  shape: cloud
}
apac: "APAC Region" {
  shape: cloud
}

usdb: "US Data" {
  shape: cylinder
}
eudb: "EU Data" {
  shape: cylinder
}
apacdb: "APAC Data" {
  shape: cylinder
}

registry: "User Registry" {
  shape: cylinder
}

us -> usdb
eu -> eudb
apac -> apacdb
us -> registry
eu -> registry
apac -> registry
```

**User home region** for personal data.
**Public posts** replicated globally.
**Compliance:** EU (GDPR), India (DPDP).

### Peak Handling

**Events:**
- Breaking news: 5-10x
- Elections: 20x
- Sports finals: 10x
- Reddit "hug of death": site gets overwhelmed by traffic from a post

**Mitigations:**
- Kafka buffers
- Auto-scale
- Rate limit
- Degrade non-critical features

### Cost Optimization

| Component | Optimization |
|---|---|
| Media | CDN caching, compression |
| Vote aggregation | Batch, sample |
| Feed | Redis with TTL |
| Storage | Tiering to Glacier |
| Compute | Reserved + spot |
| Search | Sampling for analytics |

---

## 13. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Hot ranking | Log10(votes) + time | Tuning parameters |
| Vote aggregation | Kafka + Redis counters | Eventual consistency |
| Nested comments | Adjacency + materialized path | Storage, complexity |
| Vote integrity | Multi-signal detection | Complexity, privacy |
| Community moderation | Volunteer + automod | Quality variance |
| Large communities | Dedicated shards | Cost |
| Real-time scores | Async aggregation | 1-5 sec lag |
| Search freshness | Near-real-time indexing | Small lag |
| Media storage | S3 + CDN | Cost |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Post store | Cassandra (partition by community) | Write-heavy, time-series |
| Vote aggregation | Kafka + Redis counters | High throughput |
| Hot ranking | Log10 + time, Redis sorted set | Fast reads |
| Comment storage | Adjacency + materialized path | Tree traversal |
| Vote integrity | Multi-signal ML + rules | Robust |
| Communities | PostgreSQL (sharded) | Relational |
| Multi-region | Home region + global public | Compliance, latency |
| Moderation | Multi-layer (auto + human + platform) | Scale + accuracy |

---

## 14. Failure Scenarios

### Vote Aggregator Down

**Impact:** Scores stop updating.

**Mitigation:**
- Kafka buffers
- Auto-scale aggregators
- Replay on recovery
- Alert ops

### Redis Down

**Impact:** Feed cache misses; scores unavailable.

**Mitigation:**
- Redis Sentinel for HA
- Fall back to Cassandra/ClickHouse (slower)
- Alert ops

### Cassandra Node Down

**Impact:** Some posts/comments temporarily unavailable.

**Mitigation:**
- Replication factor 3
- Quorum reads/writes
- Auto-recovery

### Kafka Down

**Impact:** Vote aggregation stops; search indexing lags.

**Mitigation:**
- Buffer in Vote Service
- Retry on recovery
- Fallback to direct DB

### Ranking Service Down

**Impact:** Fall back to chronological.

**Mitigation:**
- Cache last rankings
- Fallback to `new` sort
- Alert ops

### Brigading Attack

**Impact:** Vote manipulation on target.

**Mitigation:**
- Real-time detection
- Ignore brigading votes
- Quarantine target
- Alert moderation

### Search Index Down

**Impact:** Search unavailable.

**Mitigation:**
- Fall back to PostgreSQL LIKE (slow)
- Cache recent queries
- Alert ops

### Mod Queue Overload

**Impact:** Reports backlog.

**Mitigation:**
- Auto-remove high-confidence cases
- Recruit more mods
- Alert community

### Community Takeover

**Impact:** Malicious mods control community.

**Mitigation:**
- Admin intervention
- Mod removal
- Community re-creation
- Transparency

### Data Breach

**Impact:** User data exposed.

**Mitigation:**
- Encryption at rest + transit
- Access controls
- Anomaly detection
- Incident response

### Hug of Death

**Impact:** A linked site gets overwhelmed by Reddit traffic.

**Mitigation:**
- Cache-friendly headers
- Reddit's crawler respects robots.txt
- Educational content for site owners
- (This is the external site's problem, not Reddit's)

---

## 15. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Feed load p99 | < 500 ms | > 1.5 sec |
| Post creation p99 | < 500 ms | > 1.5 sec |
| Vote p99 | < 100 ms | > 300 ms |
| Vote aggregation lag | < 5 sec | > 30 sec |
| Comment load p99 | < 500 ms | > 1.5 sec |
| Search p99 | < 500 ms | > 2 sec |
| Cache hit ratio (feed) | > 90% | < 80% |
| Vote manipulation rate | < 1% | > 5% |
| Mod queue depth | < 100K | > 1M |
| Bot detection rate | > 95% | < 90% |

### Dashboards

- **Traffic**: Posts, comments, votes, feed loads
- **Latency**: p50/p95/p99 per operation
- **Ranking**: Hot scores, sorting modes, cache hits
- **Votes**: Aggregation rate, brigading detection
- **Comments**: Tree depth, load time
- **Moderation**: Reports, actions, queue depth
- **Search**: Query rate, latency, zero-result
- **Infrastructure**: Cassandra, Redis, Kafka health
- **Business**: DAU, communities, posts/user, retention

### Alerts

- **P0**: Vote aggregator down, Cassandra cluster down, brigading attack
- **P1**: Feed p99 > 1.5 sec, aggregation lag > 30 sec
- **P2**: Mod queue > 1M, search p99 > 2 sec, bot detection < 90%
- **P3**: High brigading rate, abandoned communities

### Business KPIs

- **DAU/MAU** ratio
- **Posts per DAU**
- **Comments per DAU**
- **Votes per DAU**
- **Communities joined per user**
- **Time on site**
- **Retention** (D1, D7, D30)
- **Community health** (active %, growth)

---

## 16. Cost Estimation

Rough monthly cost (AWS, us-east-1) for 50M DAU:

| Component | Spec | Cost/month |
|---|---|---|
| API servers | 300 x c6g.large | ~$18,000 |
| Vote aggregators | 100 x c6g.large | ~$6,000 |
| Ranking Service | 50 x c6g.large | ~$3,000 |
| Feed Service | 150 x c6g.large | ~$9,000 |
| Cassandra | 200 x i3.2xlarge | ~$200,000 |
| PostgreSQL | 20 shards x db.r6g.4xlarge | ~$95,000 |
| Read replicas | 40 x db.r6g.2xlarge | ~$84,000 |
| Redis cluster | 100 x cache.r6g.2xlarge | ~$50,000 |
| Kafka (MSK) | 30 brokers | ~$15,000 |
| ClickHouse | 30 x i3.2xlarge | ~$30,000 |
| Elasticsearch | 50 x r6g.2xlarge | ~$90,000 |
| S3 (media) | 500 TB | ~$11,500 |
| S3 Glacier (archive) | 1 PB | ~$4,000 |
| CDN | 50 PB/month | ~$1,000,000 |
| Monitoring | Datadog | ~$40,000 |
| **Total** | | **~$1.65M/month** |

**Per user:** ~$0.033/month.

**Cost optimization:**
- **CDN dominates** (60%+) — media optimization
- **Cassandra** is next (12%) — right-size, tiering
- **Reserved instances** — 30-40% savings
- **Spot for batch** — aggregators, indexing

**Note:** Reddit's cost per user is high due to media and CDN. This is why premium/ads are important.

---

## 17. Extensions and Follow-ups

### Awards

- Users buy awards (Reddit Coins)
- Awarded to posts/comments
- Visual badge + perks
- Monetization

### Premium

- Ad-free browsing
- Custom avatars
- Exclusive communities
- Subscription revenue

### Reddit Chat

- Real-time 1:1 and group
- WebSocket (like messaging app)
- Separate service

### Live Threads

- Real-time updates for events
- Multi-contributor
- Chronological feed
- Notifications

### Polls

- Native poll posts
- Single or multiple choice
- Results after voting

### Predictions

- Bet on outcomes
- Community tournaments
- Gamification

### Wiki

- Community wiki pages
- Collaborative editing
- Version history

### Multireddits

- Custom groupings of communities
- Shared feed
- Personal or public

### Cross-Posting

- Share a post to multiple communities
- Unified comments (optional)

### r/Place

- Collaborative pixel art
- Real-time canvas
- Time-limited events
- Huge traffic spikes

### Tipping

- Send crypto tips
- Content creator monetization

### NFT Avatars

- Collectible avatars
- Blockchain-based
- Recent Reddit experiment

### Community Points

- Tokens for community engagement
- Governance
- (Discontinued by Reddit in 2023)

### Reddit Answers (AI)

- LLM-powered search
- Summarize threads
- "Ask Reddit"
- Recent feature

### Podcasts

- Audio posts
- Creator monetization

### Reddit Recap

- End-of-year summary
- Personalized stats
- Shareable cards

### Chat Channels

- Community-wide chat
- Real-time
- Mod tools

---

## 18. Summary

| Aspect | Decision |
|---|---|
| Post store | Cassandra (partition by community) |
| Comment store | Cassandra (adjacency + materialized path) |
| Vote aggregation | Kafka + Redis counters |
| Hot ranking | log10(votes) + time, in Redis sorted set |
| Communities | PostgreSQL (sharded) |
| Search | Elasticsearch (near-real-time) |
| Vote integrity | Multi-signal ML + rules |
| Moderation | Volunteer mods + automod + platform |
| Scale | 50M DAU, 10M communities, 10B votes/day |
| Latency | Feed < 500 ms, post < 500 ms |
| Availability | 99.99% |
| Cost | ~$1.65M/month (CDN dominates) |

**Key takeaways:**

- **Hot ranking** = log10(votes) + time decay — balances popularity and freshness
- **Vote aggregation** via Kafka decouples write from score computation
- **Nested comments** use adjacency list + materialized path for traversal
- **Vote integrity** requires multi-signal detection (age, karma, patterns, IPs)
- **Brigading detection** via graph analysis and temporal clustering
- **Community moderation** is volunteer-driven with platform oversight
- **AutoMod** enables community-specific rules (regex, karma, account age)
- **Sharding by community** supports both long-tail and top communities
- **Multi-region** for compliance and latency
- **CDN dominates cost** — media optimization is critical
- **Search is near-real-time** with small indexing lag
- **Community health** metrics (active %, growth) drive moderation focus

### Similar Pattern Problems

- Content Sharing / Microblog (feed, ranking)
- Social Feed / Timeline (feed, ranking)
- News Feed Ranking (ranking algorithms)
- Content Moderation (moderation pipeline)
- Voting / Polling System (vote aggregation)
- Notification System (event fan-out)
- Search Autocomplete (search infrastructure)
- Product Catalog (ranking, personalization)