# Task Management Tool (Trello / Asana)

## Problem Statement

Design a collaborative task management tool like Trello, Asana, or Linear. Users organize work into boards, lists (columns), and cards (tasks). Multiple users collaborate in real time — moving cards, editing tasks, commenting, assigning. The system must handle CRUD, real-time sync, permissions, notifications, and search.

**Example:**
```
User Alice creates a board: "Q4 Marketing"
  Lists: [Backlog, In Progress, Review, Done]
  Cards in Backlog:
    - "Design new landing page" (assigned to Bob)
    - "Write blog post on AI" (assigned to Carol, due Sept 25)

Bob moves "Design new landing page" from Backlog -> In Progress.
Carol comments on it: "Wireframes ready, let's review tomorrow."

All changes sync in real-time to Alice, Bob, Carol (and 5 other collaborators).
```

**Real-world apps:** Trello, Asana, Linear, Monday.com, Jira, ClickUp, Notion.

**Why it's interesting:**

- **Real-time collaboration** — multiple users editing same board
- **Hierarchical data model** (board -> list -> card -> subtask)
- **Ordering** — cards have a position; drag-and-drop must be fast
- **Permissions** — board members, guests, public boards
- **Notifications** — @mentions, assignments, due dates
- **Search** — find cards across boards
- **Undo / version history** — user expects to revert
- **Offline support** — mobile app works without connectivity

---

## 1. Requirements Clarification

### Functional Requirements
- **Boards**: Create, edit, delete, archive
- **Lists (columns)**: Create, edit, reorder, delete
- **Cards (tasks)**: Create, edit, move, archive
- **Card details**: Title, description, due date, assignees, labels, checklist, attachments
- **Comments**: Threaded discussion on cards
- **Real-time collaboration**: See others' changes instantly
- **Drag-and-drop**: Reorder cards and lists
- **Search**: Full-text across boards
- **Notifications**: Email, push, in-app
- **Permissions**: Owner, admin, member, guest, public
- **Activity feed**: Recent changes on board/card
- **Templates**: Pre-defined board templates
- **Integrations**: Slack, GitHub, Google Drive
- **Attachments**: Files, images, links
- **Labels**: Color-coded tags
- **Due dates**: With reminders
- **Subtasks**: Checklist inside cards
- **Multi-board view**: "My cards" across boards

### Non-Functional Requirements
- **Scale**: 50M users, 10M boards, 500M cards
- **Latency**: Card move < 200 ms p99; real-time update < 500 ms p99
- **Availability**: 99.99% — collaboration must not drop
- **Consistency**: Strong for card ordering; eventual for notifications
- **Real-time**: WebSocket for live updates
- **Offline**: Mobile app works offline; syncs on reconnect
- **Concurrency**: Handle 100+ users on a single board simultaneously
- **Durability**: Never lose a card or comment

### Out of Scope
- Time tracking (Toggl-style)
- Resource capacity planning
- Gantt charts (advanced)
- Financial/budget features

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Users                = 50,000,000
  DAU                  = 20,000,000
  Boards               = 10,000,000
  Cards                = 500,000,000
  Active boards/day    = 2,000,000
  Card updates/user/day = 50 (creates, edits, moves, comments)
  Board views/user/day  = 10

Average QPS:
  Writes (updates) = 20M x 50 / 86,400 = ~11,574 writes/sec
  Reads (views)    = 20M x 10 / 86,400 = ~2,315 reads/sec

Real-time (WebSocket) updates:
  Concurrent connections = 1,000,000
  Update events/sec      = 50,000

Peak QPS (5x during work hours):
  Writes = ~58,000/sec
  Reads  = ~11,500/sec
  WS events = ~250,000/sec

High write-to-read ratio (5:1) — this is unusual.
```

### Storage

```
Boards:
  10M x 2 KB = ~20 GB

Lists:
  10M x 4 lists x 500 bytes = ~20 GB

Cards:
  500M x 2 KB (with metadata) = ~1 TB

Card content (descriptions, rich text):
  500M x 5 KB avg = ~2.5 TB

Comments:
  500M cards x 20% have comments x 5 comments = ~500M comments
  500M x 500 bytes = ~250 GB

Attachments:
  500M cards x 10% have attachments = 50M attachments
  Avg 1 MB = ~50 TB in S3

Activity log:
  500M cards x 20 changes each = 10B events
  Per event: ~200 bytes
  Total: ~2 TB

Real-time state (Redis):
  Active sessions: ~1M
  Board state cache: ~100 GB

Total DB: ~6 TB, S3: ~50 TB, Redis: ~100 GB
```

### Bandwidth

```
Read bandwidth:
  11,500 x 20 KB (board view) = ~230 MB/sec = ~1.8 Gbps

Write bandwidth:
  58,000 x 2 KB = ~116 MB/sec = ~928 Mbps

WebSocket traffic:
  250,000 events/sec x 1 KB = ~250 MB/sec = ~2 Gbps

Peak total: ~5 Gbps
```

### Latency Budget

```
Target: < 200 ms p99 for card move; < 500 ms p99 for real-time update

Card move:
  Client -> API:          ~50 ms
  Auth check:             ~20 ms
  Validate move:          ~10 ms
  Update position (DB):   ~30 ms
  Publish event (Kafka):  ~10 ms
  Return:                 ~50 ms
  Total:                  ~170 ms

Real-time propagation:
  Kafka consumer lag:     ~50 ms
  WebSocket push:         ~100 ms
  Client render:          ~50 ms
  Total:                  ~200 ms
```

---

## 3. High-Level Design

```d2
direction: down

web: "Web Client" {shape: person}
mobile: "Mobile Client" {shape: person}
cdn: "CDN (static)" {shape: cloud}
gw: "API Gateway" {shape: hexagon}
bs: "Board Service" {shape: rectangle}
cs: "Card Service" {shape: rectangle}
cms: "Comment Service" {shape: rectangle}
ps: "Permission Service" {shape: rectangle}
ss: "Search Service" {shape: rectangle}
ns: "Notification Service" {shape: rectangle}
ws: "WebSocket Gateway" {shape: rectangle}
as: "Activity Service" {shape: rectangle}
pg: "PostgreSQL (boards, cards)" {shape: cylinder}
redis: "Redis (cache, presence)" {shape: cylinder}
kafka: "Kafka (events)" {shape: queue}
es: "Elasticsearch (search)" {shape: cylinder}
s3: "S3 (attachments)" {shape: cylinder}

web -> cdn
mobile -> cdn
cdn -> gw
gw -> bs
gw -> cs
gw -> cms
gw -> ps
gw -> ss
web <-> ws: WebSocket
mobile <-> ws: WebSocket
bs -> pg
cs -> pg
cms -> pg
ps -> pg
ss -> es
bs -> redis
cs -> redis
bs -> kafka
cs -> kafka
cms -> kafka
kafka -> ns
kafka -> as
kafka -> ws
cs -> s3
```

### Component Responsibilities

| Component | Role |
|---|---|
| API Gateway | Entry, auth, rate limit |
| Board Service | Board CRUD, member management |
| Card Service | Card CRUD, moves, assignment |
| Comment Service | Comments, mentions, threading |
| Permission Service | ACL checks |
| Search Service | Full-text search |
| Notification Service | Email, push, in-app |
| WebSocket Gateway | Real-time updates to connected clients |
| Activity Service | Activity feed, audit log |
| PostgreSQL | Primary store |
| Redis | Cache, presence, rate limit |
| Kafka | Event bus |
| Elasticsearch | Search index |
| S3 | Attachments, avatars |

### Why This Architecture

- **PostgreSQL** for boards/cards (relational, ACID)
- **Redis** for presence (who's viewing a board) + cache
- **Kafka** for event fan-out (notifications, real-time, audit)
- **WebSocket** for real-time updates
- **Elasticsearch** for search (cards, comments)
- **S3** for attachments (cost-effective, CDN-ready)

---

## 4. API Design

### Boards

```http
POST   /v1/boards                       # create board
GET    /v1/boards                       # list my boards
GET    /v1/boards/{id}                  # board details (with lists + cards)
PATCH  /v1/boards/{id}                  # update board
DELETE /v1/boards/{id}                  # archive
POST   /v1/boards/{id}/members          # add member
DELETE /v1/boards/{id}/members/{user}   # remove member
```

### Lists

```http
POST   /v1/boards/{id}/lists            # create list
PATCH  /v1/lists/{id}                    # rename/reorder
DELETE /v1/lists/{id}                    # archive
```

### Cards

```http
POST   /v1/lists/{id}/cards             # create card
GET    /v1/cards/{id}                    # card details
PATCH  /v1/cards/{id}                    # update card
DELETE /v1/cards/{id}                    # archive
POST   /v1/cards/{id}/move               # move to another list/position
POST   /v1/cards/{id}/assign             # assign user
POST   /v1/cards/{id}/comments           # add comment
GET    /v1/cards/{id}/comments           # list comments
POST   /v1/cards/{id}/attachments        # upload
```

### Card Move (the tricky operation)

```http
POST /v1/cards/card-123/move
Content-Type: application/json
If-Match: "v42"    # optimistic concurrency

{
  "to_list_id": "list-456",
  "position": 3
}
```

**Response 200:**
```json
{
  "card_id": "card-123",
  "list_id": "list-456",
  "position": 3,
  "version": 43
}
```

**Response 409 (concurrent move detected):**
```json
{
  "error": "concurrent_modification",
  "current_version": 44,
  "message": "Card was moved by another user"
}
```

### Board Sync (Real-Time)

```http
GET /v1/boards/{id}/sync?since=version-42
```

**Response:**
```json
{
  "version": 50,
  "changes": [
    {"type": "card.created", "card_id": "c-1", "list_id": "l-1", "version": 43},
    {"type": "card.moved", "card_id": "c-2", "from_list": "l-1", "to_list": "l-2", "position": 0, "version": 44},
    {"type": "card.updated", "card_id": "c-3", "fields": ["title"], "version": 45},
    {"type": "comment.created", "card_id": "c-1", "comment_id": "cm-1", "version": 46},
    {"type": "member.joined", "user_id": "u-5", "version": 47}
  ],
  "server_version": 50
}
```

### WebSocket Protocol

```
CLIENT -> SERVER:
  {"type": "subscribe", "board_id": "b-1", "last_version": 42}
  {"type": "presence", "board_id": "b-1", "cursor": {"x": 100, "y": 200}}

SERVER -> CLIENT:
  {"type": "card.moved", "card_id": "c-2", "from_list": "l-1", "to_list": "l-2", "position": 0, "version": 44, "user_id": "u-3"}
  {"type": "presence", "user_id": "u-3", "name": "Alice", "cursor": {"x": 100, "y": 200}}
  {"type": "user_joined", "user_id": "u-5", "name": "Bob"}
  {"type": "user_left", "user_id": "u-5"}
```

### Search

```http
GET /v1/search?q=landing+page&type=cards&board_id=b-1
```

**Response:**
```json
{
  "cards": [
    {
      "card_id": "card-123",
      "title": "Design new landing page",
      "board_id": "b-1",
      "board_name": "Q4 Marketing",
      "list_name": "In Progress",
      "snippet": "...new <em>landing page</em> for Q4 launch...",
      "assignees": ["Bob"],
      "due_date": "2026-09-25"
    }
  ],
  "total": 1
}
```

---

## 5. Database Design

### Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Boards
CREATE TABLE boards (
    board_id BIGINT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    visibility VARCHAR(20) DEFAULT 'private',
    created_by BIGINT REFERENCES users(user_id),
    is_archived BOOLEAN DEFAULT FALSE,
    version BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_boards_created_by ON boards(created_by);
CREATE INDEX idx_boards_visibility ON boards(visibility) WHERE visibility = 'public';

-- Board members
CREATE TABLE board_members (
    board_id BIGINT REFERENCES boards(board_id),
    user_id BIGINT REFERENCES users(user_id),
    role VARCHAR(20) NOT NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (board_id, user_id)
);
CREATE INDEX idx_board_members_user ON board_members(user_id);

-- Lists (columns)
CREATE TABLE lists (
    list_id BIGINT PRIMARY KEY,
    board_id BIGINT REFERENCES boards(board_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    position DOUBLE PRECISION NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    version BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_lists_board_position ON lists(board_id, position);

-- Cards
CREATE TABLE cards (
    card_id BIGINT PRIMARY KEY,
    list_id BIGINT REFERENCES lists(list_id) ON DELETE CASCADE,
    board_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    position DOUBLE PRECISION NOT NULL,
    due_date TIMESTAMPTZ,
    due_date_completed BOOLEAN DEFAULT FALSE,
    cover_color VARCHAR(20),
    is_archived BOOLEAN DEFAULT FALSE,
    version BIGINT DEFAULT 0,
    created_by BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_cards_list_position ON cards(list_id, position);
CREATE INDEX idx_cards_board ON cards(board_id) WHERE is_archived = FALSE;
CREATE INDEX idx_cards_due ON cards(due_date) WHERE due_date IS NOT NULL AND due_date_completed = FALSE;

-- Card assignees
CREATE TABLE card_assignees (
    card_id BIGINT REFERENCES cards(card_id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(user_id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (card_id, user_id)
);
CREATE INDEX idx_card_assignees_user ON card_assignees(user_id);

-- Labels
CREATE TABLE labels (
    label_id BIGINT PRIMARY KEY,
    board_id BIGINT REFERENCES boards(board_id) ON DELETE CASCADE,
    name VARCHAR(50),
    color VARCHAR(20) NOT NULL
);
CREATE INDEX idx_labels_board ON labels(board_id);

-- Card labels
CREATE TABLE card_labels (
    card_id BIGINT REFERENCES cards(card_id) ON DELETE CASCADE,
    label_id BIGINT REFERENCES labels(label_id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, label_id)
);

-- Comments
CREATE TABLE comments (
    comment_id BIGINT PRIMARY KEY,
    card_id BIGINT REFERENCES cards(card_id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(user_id),
    content TEXT NOT NULL,
    parent_comment_id BIGINT REFERENCES comments(comment_id),
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_comments_card ON comments(card_id, created_at);

-- Checklist items
CREATE TABLE checklist_items (
    item_id BIGINT PRIMARY KEY,
    card_id BIGINT REFERENCES cards(card_id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    position DOUBLE PRECISION NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_checklist_card ON checklist_items(card_id, position);

-- Attachments
CREATE TABLE attachments (
    attachment_id BIGINT PRIMARY KEY,
    card_id BIGINT REFERENCES cards(card_id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(user_id),
    filename VARCHAR(500),
    s3_key VARCHAR(500),
    size_bytes BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_attachments_card ON attachments(card_id);

-- Activity log (append-only)
CREATE TABLE activity_log (
    activity_id BIGINT PRIMARY KEY,
    board_id BIGINT NOT NULL,
    card_id BIGINT,
    user_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    payload JSONB,
    version BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_activity_board_version ON activity_log(board_id, version);
CREATE INDEX idx_activity_card ON activity_log(card_id, created_at DESC);

-- Mentions (for notifications)
CREATE TABLE mentions (
    mention_id BIGINT PRIMARY KEY,
    comment_id BIGINT REFERENCES comments(comment_id) ON DELETE CASCADE,
    mentioned_user_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_mentions_user ON mentions(mentioned_user_id, created_at DESC);
```

### Fractional Indexing for Card Position

**Problem:** Reordering cards in a list requires updating positions of many cards.

**Naive approach:** Integer positions (1, 2, 3...) — moving one card requires updating all cards below.

**Solution: Fractional indexing** (also called LexoRank).

**How it works:**
- Cards have position values like 1.0, 2.0, 3.0
- To insert between 1.0 and 2.0, use 1.5
- To insert between 1.5 and 2.0, use 1.75

**Problem:** Floating-point precision limits (~52 bits).

**Better solution: String-based fractional indexing (LexoRank)**

Positions are strings: "a", "b", "c". Insert between "a" and "b" -> "am".

```
Initial: ["a", "b", "c"]
Move between a and b: "am"
["a", "am", "b", "c"]

Insert between a and am: "ad"
["a", "ad", "am", "b", "c"]
```

**Benefits:**
- No precision limit
- Each move updates only 1 card
- Atomic per-card update

**Formula for cards:**
```sql
UPDATE cards SET position = ?, version = version + 1 WHERE card_id = ?;
```

**Libraries:** `fractional-indexing` (JS), `lexorank` (Java).

### Versioning for Sync

Each board has a monotonically increasing `version`. Every change increments it.

```sql
-- On any change (card move, edit, etc.)
BEGIN;
  UPDATE boards SET version = version + 1, updated_at = NOW()
  WHERE board_id = ? RETURNING version;
  
  INSERT INTO activity_log (board_id, card_id, user_id, action, payload, version)
  VALUES (?, ?, ?, ?, ?, ?);
COMMIT;
```

**Client sync:**
```
1. Client has last_version = 42
2. Requests GET /boards/{id}/sync?since=42
3. Server returns all changes with version 43+
4. Client applies changes, updates local version to 50
5. If gap detected (e.g., server_version jumped), client does full refresh
```

### Redis Data Structures

```
-- Board version cache
Key: board:{board_id}:version
Value: 50

-- Active users on a board (presence)
Key: board:{board_id}:presence
Type: Hash (user_id -> {name, avatar, cursor, last_seen})
TTL: 30 seconds (refreshed by heartbeat)

-- User's active boards
Key: user:{user_id}:active_boards
Type: Set

-- Cache hot cards
Key: card:{card_id}
Value: JSON
TTL: 5 minutes

-- Rate limiting (per user)
Key: ratelimit:{user_id}:{endpoint}
```

---

## 6. Deep Dive: Real-Time Collaboration

### WebSocket Architecture

```d2
direction: down

user: User {shape: person}
ws1: "WebSocket Gateway 1" {shape: rectangle}
ws2: "WebSocket Gateway 2" {shape: rectangle}
ws3: "WebSocket Gateway 3" {shape: rectangle}
k: "Kafka (board events)" {shape: queue}
bs: "Board Service" {shape: rectangle}
redis: "Redis (pub/sub)" {shape: cylinder}

user -> ws1: connect
bs -> k: publish board.updated
k -> ws1: fan-out
k -> ws2: fan-out
k -> ws3: fan-out
ws1 -> user: push update
ws1 <-> redis: cross-node pub/sub
ws2 <-> redis: cross-node pub/sub
ws3 <-> redis: cross-node pub/sub
```

**Flow:**
1. User's board is updated (card moved, comment added)
2. Board Service writes to PostgreSQL
3. Board Service publishes event to Kafka (topic: `board-events`)
4. Each WebSocket Gateway consumes events for boards it has subscribers to
5. Gateway pushes updates to connected clients

**Cross-node coordination:**
- Each user is connected to ONE WebSocket Gateway
- Gateway subscribes to Kafka for boards it has users on
- When a user joins a board, gateway subscribes
- When last user leaves, gateway unsubscribes

### Presence

**Show who's online on a board:**

```
1. User opens board -> WebSocket connects -> sends "subscribe b-1"
2. Gateway records presence in Redis:
   HSET board:b-1:presence user-123 '{"name": "Alice", "joined_at": ...}'
   EXPIRE board:b-1:presence 30
3. Client sends heartbeat every 15s (renews TTL)
4. Other users on board see presence via WebSocket
5. When user disconnects or TTL expires, presence removed
```

**Cursor tracking (optional):**
- Client sends cursor position on mousemove (throttled)
- Broadcast to others (with throttling)
- Show colored cursor for each user (like Figma)

### Optimistic UI

To make drag-and-drop feel instant:

```
1. User drags card to new position
2. Client optimistically moves card in local state
3. Client sends request to server
4. Server validates, updates DB, publishes event
5. If server rejects (version conflict), client rolls back
6. If success, client confirms (usually silent)
```

**Trade-off:** Fast UX but requires rollback handling.

### Conflict Resolution

**Scenario:** Alice and Bob both drag the same card to different positions at the same time.

**Approach 1: Last-Write-Wins (LWW)**
- Server accepts the second request
- First user's move is overridden
- Both users see final state (Bob's move)

**Approach 2: Optimistic Concurrency**
- Client sends `If-Match: version-42`
- Server checks version; if stale, rejects with 409
- Client re-fetches and retries

**Approach 3: CRDT for ordering**
- Use operation-based CRDT (RGA or LSEQ) for position
- Both moves merge deterministically
- More complex but no conflicts

**Recommendation:** Optimistic concurrency for card moves (simple, works well). LWW for small edits (title change).

### Kafka Event Schema

```json
{
  "event_id": "evt-abc123",
  "event_type": "card.moved",
  "board_id": "b-1",
  "version": 44,
  "user_id": "u-123",
  "timestamp": "2026-09-17T10:00:00Z",
  "payload": {
    "card_id": "c-2",
    "from_list_id": "l-1",
    "to_list_id": "l-2",
    "position": "am"
  }
}
```

**Partition key:** `board_id` (ensures events for a board are ordered).

---

## 7. Deep Dive: Permissions

### Role Hierarchy

| Role | Permissions |
|---|---|
| Owner | Full control, delete board, transfer ownership |
| Admin | Manage members, edit settings, everything except delete |
| Member | Create/edit/move cards, comment |
| Guest | View + comment (limited boards only) |
| Public (no account) | View only (for public boards) |

### Permission Checks

**On every API call:**
```
1. Extract user_id from JWT
2. Extract board_id from URL or card's parent
3. Look up board_members(user_id, board_id) -> role
4. Check if role has permission for action
```

**Caching:**
- Cache permissions in Redis: `perms:{user_id}:{board_id}` -> role
- TTL: 5 minutes
- Invalidate on membership change

### Efficient Permission Lookup

```sql
-- For a board action
SELECT role FROM board_members
WHERE board_id = ? AND user_id = ?;

-- For "my boards" listing
SELECT b.board_id, b.name, bm.role
FROM boards b
JOIN board_members bm ON b.board_id = bm.board_id
WHERE bm.user_id = ?;
```

**Denormalization:** Store `board_id` on cards for fast permission check without joining to list.

### Guest Access

Guests can access specific boards without being org members.

```sql
CREATE TABLE board_guests (
    board_id BIGINT REFERENCES boards(board_id),
    email VARCHAR(255),
    invited_by BIGINT REFERENCES users(user_id),
    invited_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (board_id, email)
);
```

Guest receives link, creates account, joins board.

### Public Boards

Public boards are view-only for anyone with the link:
```
https://trello.com/b/abc123/board-name
```

- Not indexed by search engines
- Read-only for anonymous users
- Can be made private by owner anytime

---

## 8. Deep Dive: Notifications

### Events That Trigger Notifications

| Event | Notify | Channel |
|---|---|---|
| @mentioned in comment | Mentioned user | Push + Email |
| Assigned to card | Assignee | Push |
| Card moved to "Done" | Watchers | In-app |
| Due date approaching | Assignee | Push + Email |
| New comment on watched card | Watchers | Push |
| Added to board | New member | Email |
| Card due today | Assignee | Push (morning) |

### Watcher Model

Users can "watch" cards and boards:
- Automatically watch cards they create, are assigned to, or comment on
- Can explicitly watch/unwatch
- Board members watch the board by default

```sql
CREATE TABLE watchers (
    watchable_type VARCHAR(20),
    watchable_id BIGINT,
    user_id BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (watchable_type, watchable_id, user_id)
);
CREATE INDEX idx_watchers_user ON watchers(user_id);
```

### Notification Pipeline

```d2
direction: down

k: "Kafka (board events)" {shape: queue}
nw: "Notification Worker" {shape: rectangle}
prefs: "User Preferences" {shape: cylinder}
push: "Push Service" {shape: rectangle}
email: "Email Service" {shape: rectangle}
log: "Notification Log" {shape: cylinder}

k -> nw: consume event
nw -> nw: find watchers
nw -> prefs: check preferences
nw -> push: if push enabled
nw -> email: if email enabled
nw -> log: record
```

### Digest Notifications

Batch multiple updates into one notification:

```
User's board has 10 card moves in 5 min.
Send one digest: "10 updates on Q4 Marketing board"
```

**Rules:**

- Immediate: if action is critical (mention, assignment)
- Digest (5 min): if user is idle
- Daily digest: if user has notifications disabled in real-time

### Mention Parsing

Comment: `"@alice can you review this @bob?"`

```
1. Parse mentions using regex: @[a-z]+
2. Resolve to user IDs (by board member names)
3. Insert into mentions table
4. Publish notification event
```

**Handling ambiguity:** "alice" could be multiple users. Use autocomplete in UI, store user_id.

---

## 9. Deep Dive: Search

### What to Index

- **Cards**: title, description, checklist items
- **Comments**: content (with mentions stripped)
- **Boards**: name, description
- **Attachments**: filename (OCR for images optional)

### Elasticsearch Mapping

```json
{
  "mappings": {
    "properties": {
      "card_id": {"type": "keyword"},
      "board_id": {"type": "keyword"},
      "list_id": {"type": "keyword"},
      "title": {"type": "text", "analyzer": "standard"},
      "description": {"type": "text"},
      "assignees": {"type": "keyword"},
      "labels": {"type": "keyword"},
      "due_date": {"type": "date"},
      "created_at": {"type": "date"},
      "updated_at": {"type": "date"},
      "comments": {
        "type": "nested",
        "properties": {
          "comment_id": {"type": "keyword"},
          "content": {"type": "text"}
        }
      }
    }
  }
}
```

### Indexing Pipeline

- **CDC (Change Data Capture)** from PostgreSQL
- Debezium -> Kafka -> Elasticsearch consumer
- Near-real-time (~1 sec lag)

**Alternative:** Application writes to both PostgreSQL and Elasticsearch (dual write). Faster but more code.

### Search Queries

**Simple search:**
```json
{
  "query": {
    "multi_match": {
      "query": "landing page",
      "fields": ["title^3", "description", "comments.content"]
    }
  },
  "filter": [
    {"term": {"board_id": "b-1"}},
    {"term": {"is_archived": false}}
  ]
}
```

**Filter by assignee + due date:**
```json
{
  "query": {
    "bool": {
      "must": [{"match": {"title": "landing"}}],
      "filter": [
        {"term": {"assignees": "u-123"}},
        {"range": {"due_date": {"gte": "now", "lte": "now+7d"}}}
      ]
    }
  }
}
```

### Global Search vs Board Search

- **Board search**: fast, scoped, frequent
- **Global search**: slower, across user's boards

**Optimization:** For global search, filter by board membership first, then search.

```
1. Query user's board IDs (cached in Redis)
2. Filter Elasticsearch by these board IDs
3. Return results
```

### Personalization

Boost results:
- Cards assigned to user
- Cards the user recently viewed
- Cards in user's active boards

---

## 10. Deep Dive: Offline Support (Mobile)

### Why Offline Matters

Users on subways, planes, or poor connections still want to see and edit their boards.

### Local-First Architecture

```d2
direction: down

ui: "Mobile App UI" {shape: rectangle}
local: "Local DB (SQLite)" {shape: cylinder}
sync: "Sync Engine" {shape: rectangle}
ws: "WebSocket Client" {shape: rectangle}
api: "Cloud API" {shape: rectangle}

ui -> local: read/write
local -> sync: pending changes
sync -> api: push changes
api -> sync: pull changes
ws -> sync: real-time events
sync -> local: apply
```

**Approach:**
- All reads come from local SQLite (fast, no network)
- Writes go to local SQLite immediately
- Sync engine pushes changes when online
- WebSocket receives real-time updates from server

### Sync Protocol

```
1. On connect: send last_server_version
2. Server: returns all changes since that version
3. Client: applies changes to local DB
4. Client: sends list of pending local changes
5. Server: validates, applies, returns new version
6. Client: marks local changes as synced, updates version
```

**Idempotency:** Every local change has a UUID; server dedupes.

### Conflict Resolution for Offline Edits

**Scenario:** Alice edits a card offline; Bob edits same card online.

**On sync:**
- If Alice edited title, Bob edited description -> merge both
- If both edited title -> last-write-wins (by edit timestamp)
- If Alice moved card, Bob moved it -> last-write-wins

**Notification:** Show "Some of your offline changes conflicted and were resolved" banner.

### Offline Queue

```
Operations queued locally:
  [create card, update card, move card, add comment]

On reconnect:
  Send in order
  Server processes sequentially
  Client updates local state with server responses
```

**If server rejects:** Mark operation as failed, prompt user.

### Storage Limits

Mobile devices have limited storage. Sync only:
- Boards user is member of
- Cards not archived
- Last 6 months of activity
- Attachments: on-demand (thumbnails cached)

### Background Sync

- iOS: `BGAppRefreshTask`
- Android: `WorkManager`
- Sync every 15 min when on WiFi

---

## 11. Scaling Considerations

### Read Scaling

- **CDN**: Static assets (CSS, JS, avatars)
- **Redis**: Board state cache, presence
- **Read replicas**: PostgreSQL for read-heavy queries
- **Elasticsearch**: Search (naturally distributed)

### Write Scaling

**Writes are high (~58K/sec peak).** PostgreSQL handles with sharding.

**Sharding strategy:** Shard by `board_id` (all data for a board on one shard).

```
shard_id = hash(board_id) % N
```

**Why board_id?**
- Board is the unit of collaboration
- All card moves, comments happen within a board
- Enables local consistency (no cross-shard transactions)

**Cross-board operations:**
- "My cards across all boards" -> query all shards (fan-out)
- Cache result in Redis

### Hot Board Problem

**Problem:** A board with 1000 concurrent users (large team, public board).

**Mitigations:**
- Dedicated WebSocket connections (up to 10K per node)
- Fan-out via Kafka (not direct)
- Rate limit updates per user (e.g., 10/sec)
- Throttle real-time updates (batch every 200 ms)

### WebSocket Scaling

- **Connection limit**: ~10K per node (memory-bound)
- **100K concurrent users** -> 10+ WebSocket nodes
- **1M concurrent users** -> 100 nodes
- Use consistent hashing to route users to nodes

**Session persistence:** Store WebSocket state in Redis; if node fails, user reconnects to another node.

### Kafka Scaling

- **Partition by `board_id`**: Ensures ordered delivery per board
- **Consumer groups**: WebSocket gateways consume in parallel
- **Retention**: 7 days (allows replay for bug recovery)

### Elasticsearch Scaling

- **Shard by board_id**: Each board's cards on one shard
- **Replicas**: 1-2 for HA and query throughput
- **Index lifecycle**: Hot-warm-cold for old data

### Database Sharding

As data grows:
- **Shard 1**: Board IDs 0-1M
- **Shard 2**: Board IDs 1M-2M
- ...

**Cross-shard queries:** Avoid by scoping user queries to their boards.

**Data model change:** User's board memberships must be on all shards (or cached).

---

## 12. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Card ordering | Fractional indexing | Complexity |
| Real-time sync | WebSocket + Kafka | Infra complexity |
| Concurrent edits | Optimistic concurrency | Rollback UX |
| Presence | Redis TTL | Missed on rapid disconnect |
| Search latency | Elasticsearch + CDC | Index lag |
| Hot board | Fan-out throttling | Slight delay |
| Cross-board queries | Fan-out + cache | Slow, cache misses |
| Offline conflicts | Merge + LWW | Data loss possible |
| Permissions | Cache with TTL | Stale on rapid changes |
| Attachments | S3 + CDN | Egress cost |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Primary DB | PostgreSQL | ACID, relational |
| Sharding | By board_id | Local consistency |
| Ordering | Fractional indexing (LexoRank) | O(1) moves |
| Real-time | WebSocket + Kafka | Scalable fan-out |
| Presence | Redis with TTL | Fast, self-healing |
| Sync | Version-based delta sync | Efficient |
| Search | Elasticsearch + CDC | Near-real-time |
| Offline | Local SQLite + sync engine | Mobile-first |
| Concurrency | Optimistic (version-based) | Simple, effective |
| Permissions | Cached in Redis | Fast checks |

---

## 13. Failure Scenarios

### WebSocket Node Fails

**Impact:** Users connected to it disconnect.

**Mitigation:**
- Client auto-reconnects to another node
- New node subscribes to user's boards
- Sync engine catches up missing events via version-based sync
- **Downtime:** ~2 sec (reconnect + sync)

### Kafka Down

**Impact:** Real-time updates stop; notifications delayed.

**Mitigation:**
- Buffer events in WebSocket gateway (bounded queue)
- Fall back to polling every 30 sec
- Alert ops
- **Recovery:** On Kafka restart, replay from last offset

### PostgreSQL Primary Down

**Impact:** All writes fail.

**Mitigation:**
- Multi-AZ failover (~30 sec)
- Reads from replicas during failover
- WebSocket continues delivering cached state
- Client shows "saving..." state
- **Alert:** Immediate P0

### Concurrent Card Move Conflict

**Impact:** Two users move same card; one loses.

**Mitigation:**
- Optimistic concurrency (version check)
- Server returns 409 to loser
- Client re-fetches, shows notification "Card was moved by X"
- User retries

### Offline Sync Conflict

**Impact:** User's offline edits conflict with online edits.

**Mitigation:**
- Field-level merge when possible
- LWW for same field
- Notify user of conflict
- Audit log for disputes

### Redis Down (Presence)

**Impact:** No presence indication; TTL-based eviction stops.

**Mitigation:**
- Fall back to no presence (graceful degradation)
- Reconnect uses cached list
- Non-critical feature

### Search Index Out of Sync

**Impact:** Search shows stale results.

**Mitigation:**
- CDC pipeline with monitoring
- Alert if lag > 5 min
- Weekly full reindex
- Fallback to DB search for critical queries

### Attachment Upload Fails

**Impact:** User can't attach file.

**Mitigation:**
- Chunked upload with resume
- Retry with exponential backoff
- Store locally until upload succeeds
- Alert if S3 unavailable

### Rate Limit Hit

**Impact:** User's operations rejected.

**Mitigation:**
- Return `429` with `Retry-After`
- Client queues operations
- Show UI: "Too many actions, please wait"
- Tiered limits (power users get higher limits)

---

## 14. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Card move p99 | < 200 ms | > 500 ms |
| Real-time update latency p99 | < 500 ms | > 2 sec |
| WebSocket connection count | baseline | spike > 2x |
| WebSocket errors | < 0.1% | > 1% |
| DB write p99 | < 50 ms | > 200 ms |
| Kafka consumer lag | < 1 sec | > 10 sec |
| Search query p99 | < 300 ms | > 1 sec |
| Cache hit ratio (board) | > 90% | < 80% |
| Permission check failures | < 0.01% | > 0.1% |
| Optimistic lock conflicts | < 1% | > 5% |
| Sync error rate | < 0.1% | > 1% |

### Dashboards

- **Real-time**: WebSocket connections, events/sec, latency
- **Traffic**: Card moves, comments, board views
- **Latency**: p50/p95/p99 per endpoint
- **Concurrency**: Optimistic lock conflicts, rate limit hits
- **Collaboration**: Active boards, active users per board
- **Sync**: Offline sync queue depth, error rate
- **Infrastructure**: DB, Redis, Kafka, Elasticsearch health
- **Search**: Query rate, latency, hit ratio

### Alerts

- **P0**: DB primary down, WebSocket gateway down, Kafka cluster down
- **P1**: Real-time latency > 2 sec, DB write p99 > 200 ms
- **P2**: Search index lag > 5 min, cache hit < 80%
- **P3**: High conflict rate, high rate limit hits

### Business Metrics

- **DAU/MAU** per board
- **Cards created** per day
- **Cards completed** per day
- **Average session duration**
- **Time to first action** (onboarding)
- **Collaboration index** (users per board)
- **Retention** (users active after 7/30 days)

---

## 15. Cost Estimation

Rough monthly cost (AWS, us-east-1) for 50M users:

| Component | Spec | Cost/month |
|---|---|---|
| API servers | 80 x c6g.large | ~$5,000 |
| WebSocket gateways | 30 x c6g.large | ~$2,000 |
| PostgreSQL | 16 shards x db.r6g.4xlarge | ~$75,000 |
| Read replicas | 32 x db.r6g.2xlarge | ~$70,000 |
| Redis cluster | 20 x cache.r6g.2xlarge | ~$10,000 |
| Kafka (MSK) | 6 brokers | ~$2,500 |
| Elasticsearch | 10 x r6g.xlarge | ~$3,000 |
| S3 (attachments) | 50 TB | ~$1,200 |
| CDN | 100 TB/month | ~$8,500 |
| Monitoring | Datadog | ~$15,000 |
| **Total** | | **~$192,000/month** |

**Per user:** ~$0.004/month/user.

**Cost optimization:**
- Reserved instances (30-40% savings)
- Tiered storage for old boards
- Right-size shards (start with fewer)
- Self-hosted observability

---

## 16. Extensions and Follow-ups

### Automation Rules

"Butler"-style automation:
```
WHEN card moves to "Done"
THEN mark due date complete, notify watchers

WHEN card is created with label "Urgent"
THEN assign to on-call engineer, set due date to +24h
```

**Implementation:** Event-driven rules engine (Kafka consumer + expression evaluator).

### Templates

Board templates for common workflows:
- Agile sprint
- Marketing campaign
- Personal to-do
- Bug tracker

**Implementation:** Template boards stored as JSON; instantiated on new board.

### Integrations

- **Slack**: Post updates to channels
- **GitHub**: Link PRs to cards
- **Google Drive**: Attach files
- **Zapier**: Connect to 5000+ apps

**Implementation:** Webhook outbound + OAuth inbound.

### Custom Fields

Per-board custom fields:
- Priority (Low/Medium/High/Urgent)
- Story points (numeric)
- Sprint (dropdown)
- Client (text)

**Implementation:** JSONB column on cards, indexed for filters.

### Views

- **Kanban**: Default (lists as columns)
- **List view**: Table of cards
- **Calendar view**: By due date
- **Timeline**: Gantt-style
- **Dashboard**: Charts and metrics

**Implementation:** Different frontend renders of same data.

### AI Features

- **Smart suggestions**: Assign cards based on history
- **Auto-categorization**: Detect card type from description
- **Summary**: "What happened on this board this week?"
- **Duplicate detection**: Warn if similar card exists

**Implementation:** LLM integration with embeddings + vector search.

### Time Tracking

- Start/stop timer per card
- Track time per user per board
- Reports: hours by project, by user

**Implementation:** `time_entries` table (card_id, user_id, started_at, ended_at).

### Comments with Rich Text

- Markdown support
- Emoji reactions
- Code blocks
- @mentions with autocomplete

**Implementation:** Store as Markdown, sanitize on render.

### Advanced Permissions

- **Custom roles** per board
- **Field-level permissions** (only admins can edit due dates)
- **Read-only** for certain members
- **Guest** with limited access

**Implementation:** Policy engine (OPA, Cedar) or extended role model.

### Multi-Region

**Data residency:** EU users' data stays in EU.

**Home region:** Each user has a home region; boards belong to the creator's region.

**Cross-region collaboration:** Eventual consistency via Kafka replication.

**Trade-off:** Cross-region board latency could be 200+ ms.

### Public API

REST API for external developers:
- OAuth2 for auth
- Rate limits per plan
- Webhook subscriptions
- SDKs (Python, JavaScript, etc.)

**Implementation:** Same backend, separate API key management, versioned.

---

## 17. Summary

| Aspect | Decision |
|---|---|
| Primary DB | PostgreSQL (sharded by board_id) |
| Card ordering | Fractional indexing (LexoRank) |
| Real-time | WebSocket + Kafka fan-out |
| Presence | Redis with TTL |
| Sync | Version-based delta |
| Search | Elasticsearch + CDC |
| Offline | Local SQLite + sync engine |
| Concurrency | Optimistic (version check) |
| Permissions | Cached in Redis |
| Notifications | Kafka + watchers model |
| Scale | 20M DAU, 500M cards |
| Latency | < 200 ms card move, < 500 ms real-time |
| Availability | 99.99% |
| Cost | ~$192K/month for 50M users |

**Key takeaways:**

- **Fractional indexing** is the key to fast card reordering — no bulk updates
- **Version-based sync** enables both real-time and offline scenarios
- **Kafka + WebSocket** scale real-time to millions of users
- **Optimistic concurrency** keeps edits fast while preventing lost updates
- **Watchers model** for notifications avoids spamming all board members
- **Presence via Redis TTL** self-heals on disconnect
- **Sharding by board_id** localizes writes and enables consistency
- **Offline support** via local SQLite + sync engine is table stakes for mobile
- **CDC to Elasticsearch** keeps search near-real-time with low coupling
- **Board-centric design** matches the mental model and simplifies sharding

**Similar Pattern Problems:**

- Collaborative Document Editor (real-time + offline sync)
- Social Feed (real-time updates, fan-out)
- Notification System (watcher model)
- Calendar / Scheduling (time-based reminders)
- Chat / Messaging App (real-time WebSocket)
- File Storage Service (S3 attachments, offline sync)