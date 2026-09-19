# Calendar / Scheduling

## Problem Statement

Design a calendar and scheduling system like Google Calendar or Calendly. Users create events, invite attendees, check availability, and schedule meetings. The system must handle recurring events, time zones, conflicts, reminders, and external calendar sync.

**Example:**
```
User Alice creates event:
  Title: "Team Standup"
  When: Every weekday at 9:00 AM IST (recurring)
  Duration: 30 min
  Attendees: alice@, bob@, carol@
  Location: Google Meet link
  Reminder: 5 min before

System must:
  - Expand recurrence for display
  - Convert to each attendee's time zone
  - Send invites and reminders
  - Detect conflicts
  - Sync with Google/Outlook calendars
  - Handle exceptions (skipped, rescheduled occurrences)
```

**Real-world apps:** Google Calendar, Outlook Calendar, Apple Calendar, Calendly, Cal.com, Zoom Scheduler.

**Why it's interesting:**

- **Recurring events** are deceptively complex (RFC 5545, RRULE)
- **Time zones** are tricky (DST transitions, historical zones)
- **Availability search** requires fast interval overlap queries
- **External sync** involves conflict resolution across systems
- **Reminders** need reliable scheduling at scale

---

## 1. Requirements Clarification

### Functional Requirements
- **Events**: Create, read, update, delete events
- **Recurring events**: Daily, weekly, monthly, custom (RRULE)
- **Exceptions**: Skip, reschedule, modify individual occurrences
- **Attendees**: Invite, accept, decline, tentative
- **Time zones**: Per-event and per-user time zones
- **Reminders**: Email, push, SMS at configurable times
- **Availability**: Check when attendees are free
- **Calendars**: Multiple calendars per user (work, personal)
- **Sharing**: Share calendars, view-only or edit
- **External sync**: Google, Outlook, iCloud
- **Search**: Find events by title, attendee, date range
- **Notifications**: Real-time updates to attendees

### Non-Functional Requirements
- **Scale**: 500M users, 5B events, 100M events/day created
- **Latency**: Event creation < 300 ms p99
- **Calendar view**: < 500 ms p99 for a month view
- **Availability check**: < 200 ms p99
- **Availability**: 99.99% — users expect access anytime
- **Consistency**: Strong for event writes; eventual for external sync
- **Correctness**: Never lose an event; never double-book
- **Time zone accuracy**: Handle DST transitions correctly (historical and future)
- **Reminder reliability**: 99.9% of reminders fire within 1 min of target

### Out of Scope
- Video conferencing (that's Zoom/Teams)
- Room booking (that's a separate resource booking system)
- Expense tracking for events
- Advanced analytics (attendance patterns, etc.)

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Users                = 500,000,000
  DAU                  = 100,000,000
  Events created/day   = 100,000,000
  Calendar views/user  = 5/day
  Availability checks  = 20,000,000/day (mostly Calendly-style)
  Peak multiplier      = 3x

Average QPS:
  Writes (event create) = 100M / 86,400 = ~1,157/sec
  Reads (view)          = 100M x 5 / 86,400 = ~5,787/sec
  Availability checks   = 20M / 86,400 = ~231/sec
  Total                 = ~7,175 ops/sec

Peak QPS:
  ~21,500 ops/sec

Moderate throughput — correctness and time zones matter more than raw scale.
```

### Storage

```
Events table:
  5B events x 1 KB (with metadata) = ~5 TB

Event attendees:
  5B events x 3 attendees x 100 bytes = ~1.5 TB

Recurring rules:
  1B recurring events x 200 bytes = ~200 GB

Reminders:
  Events with reminders x 5 = ~5B reminders
  Per reminder: ~200 bytes
  Total: ~1 TB

External sync metadata:
  200M synced events x 500 bytes = ~100 GB

Search index (Elasticsearch):
  ~500 GB

Total: ~8-9 TB raw, ~25 TB with replication
```

### Bandwidth

```
Read bandwidth:
  21,500 x 5 KB (calendar view) = ~107 MB/sec = ~860 Mbps

Write bandwidth:
  3,500 x 2 KB = ~7 MB/sec = ~56 Mbps

Peak: ~1 Gbps
Small compared to video/media systems.
```

### Latency Budget

```
Target: < 300 ms p99 for event creation

Breakdown:
  Client -> API:               ~50 ms
  Auth check:                  ~20 ms
  Validate event:              ~10 ms
  Expand recurrence:           ~20 ms
  Write event + attendees:     ~30 ms (transaction)
  Queue reminders:             ~10 ms
  Queue notifications:         ~10 ms
  Return:                      ~50 ms
  Total:                       ~200 ms

Calendar view (month):
  Query events:                ~50 ms
  Expand recurrences:          ~100 ms
  Convert time zones:          ~30 ms
  Render:                      ~50 ms
  Total:                       ~230 ms
```

---

## 3. High-Level Design

```d2
direction: down

mobile: "Mobile App" {shape: person}
web: "Web App" {shape: person}
cdn: CDN {shape: cloud}
gw: "API Gateway" {shape: hexagon}
es: "Event Service" {shape: rectangle}
re: "Recurrence Engine" {shape: rectangle}
as: "Availability Service" {shape: rectangle}
rs: "Reminder Service" {shape: rectangle}
sync: "Sync Service" {shape: rectangle}
ns: "Notification Service" {shape: rectangle}
pg: "PostgreSQL (events, calendars)" {shape: cylinder}
redis: "Redis (cache, locks)" {shape: cylinder}
kafka: "Kafka (events bus)" {shape: queue}
es_search: "Elasticsearch (search)" {shape: cylinder}
s3: "S3 (attachments, ICS)" {shape: cylinder}
ext: "External APIs" {shape: cloud}

mobile -> cdn
web -> cdn
cdn -> gw
gw -> es
gw -> as
es -> re
es -> pg
es -> redis
es -> kafka
es -> rs
as -> pg
as -> redis
rs -> kafka
kafka -> ns
kafka -> sync
sync -> ext
es -> es_search
es -> s3
```

### Component Responsibilities

| Component | Role |
|---|---|
| API Gateway | Entry point, auth, rate limiting |
| Event Service | CRUD for events, master data |
| Recurrence Engine | Expand RRULE, handle exceptions |
| Availability Service | Find free/busy slots |
| Reminder Service | Schedule and fire reminders |
| Sync Service | Two-way sync with external calendars |
| Notification Service | Email, push, SMS |
| PostgreSQL | Primary store (events, calendars, attendees) |
| Redis | Cache for hot data, distributed locks |
| Kafka | Event bus for async processing |
| Elasticsearch | Full-text search |
| S3 | Attachments, ICS exports |

### Why This Architecture

- **PostgreSQL** for events (ACID, complex queries with time ranges)
- **Recurrence Engine** as a library/service (compute RRULE expansions)
- **Redis** for calendar view cache (huge performance win)
- **Kafka** for event fan-out (invites, reminders, sync)
- **Elasticsearch** for search (title, attendee, full-text)
- **Separate Availability Service** (Calendly-style features are different from calendar view)

---

## 4. API Design

### Calendars

```http
POST   /v1/calendars              # create calendar
GET    /v1/calendars              # list my calendars
GET    /v1/calendars/{id}         # calendar details
PATCH  /v1/calendars/{id}         # update (name, color, timezone)
DELETE /v1/calendars/{id}         # delete
POST   /v1/calendars/{id}/share   # share with user/group
```

### Events

```http
POST   /v1/calendars/{id}/events          # create event
GET    /v1/calendars/{id}/events          # list events (with time range)
GET    /v1/events/{id}                     # event details
PATCH  /v1/events/{id}                     # update event
DELETE /v1/events/{id}                     # delete event
POST   /v1/events/{id}/respond             # RSVP (accept/decline/tentative)
POST   /v1/events/{id}/occurrences/{date}  # modify single occurrence
```

### Availability

```http
POST /v1/availability/check
{
  "attendees": ["alice@example.com", "bob@example.com"],
  "duration_minutes": 30,
  "time_range": {
    "start": "2026-09-18T00:00:00Z",
    "end": "2026-09-22T00:00:00Z"
  },
  "working_hours": {
    "start": "09:00",
    "end": "18:00",
    "timezone": "Asia/Kolkata",
    "days": ["mon", "tue", "wed", "thu", "fri"]
  }
}
```

**Response:**
```json
{
  "available_slots": [
    {"start": "2026-09-18T09:00:00+05:30", "end": "2026-09-18T09:30:00+05:30"},
    {"start": "2026-09-18T09:30:00+05:30", "end": "2026-09-18T10:00:00+05:30"},
    {"start": "2026-09-19T14:00:00+05:30", "end": "2026-09-19T14:30:00+05:30"}
  ],
  "busy_slots": [
    {"start": "2026-09-18T10:00:00+05:30", "end": "2026-09-18T11:00:00+05:30", "reason": "busy"},
    {"start": "2026-09-18T15:00:00+05:30", "end": "2026-09-18T16:00:00+05:30", "reason": "busy"}
  ]
}
```

### Event Creation with Recurrence

```http
POST /v1/calendars/cal-123/events
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "title": "Team Standup",
  "description": "Daily sync",
  "start": "2026-09-18T09:00:00+05:30",
  "end": "2026-09-18T09:30:00+05:30",
  "timezone": "Asia/Kolkata",
  "location": "Google Meet",
  "attendees": ["bob@example.com", "carol@example.com"],
  "recurrence": {
    "rule": "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "until": "2027-09-18T00:00:00Z",
    "count": null,
    "exceptions": ["2026-12-25"]
  },
  "reminders": [
    {"type": "push", "minutes_before": 5},
    {"type": "email", "minutes_before": 15}
  ]
}
```

**Response 201:**
```json
{
  "event_id": "evt-456",
  "calendar_id": "cal-123",
  "occurrences_count": 260,
  "first_occurrence": "2026-09-18T09:00:00+05:30",
  "last_occurrence": "2027-09-17T09:00:00+05:30",
  "created_at": "2026-09-17T10:00:00Z"
}
```

### Calendar View (Month)

```http
GET /v1/calendars/cal-123/events?start=2026-09-01T00:00:00Z&end=2026-09-30T23:59:59Z&expand=true
```

**Response:**
```json
{
  "events": [
    {
      "event_id": "evt-456",
      "occurrence_id": "evt-456_2026-09-18",
      "title": "Team Standup",
      "start": "2026-09-18T09:00:00+05:30",
      "end": "2026-09-18T09:30:00+05:30",
      "attendees": [...]
    }
  ],
  "recurrence_exceptions": {
    "evt-456": ["2026-09-20", "2026-09-21"]
  }
}
```

### ICS Export

```http
GET /v1/calendars/cal-123/export.ics
```

Returns an RFC 5545-compliant ICS file for external apps.

---

## 5. Database Design

### Schema (PostgreSQL)

```sql
-- Calendars
CREATE TABLE calendars (
    calendar_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    timezone VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_calendars_user ON calendars(user_id);

-- Events (master record)
CREATE TABLE events (
    event_id BIGINT PRIMARY KEY,
    calendar_id BIGINT REFERENCES calendars(calendar_id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    start_timezone VARCHAR(50) NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'confirmed',
    created_by BIGINT NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_events_calendar_start ON events(calendar_id, start_time);
CREATE INDEX idx_events_created_by ON events(created_by);

-- Recurring event rules
CREATE TABLE recurring_rules (
    recurrence_id BIGINT PRIMARY KEY,
    event_id BIGINT REFERENCES events(event_id) ON DELETE CASCADE,
    rrule TEXT NOT NULL,
    dtstart TIMESTAMPTZ NOT NULL,
    until TIMESTAMPTZ,
    count INTEGER,
    exdates TIMESTAMPTZ[],
    rdates TIMESTAMPTZ[],
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_rrules_event ON recurring_rules(event_id);

-- Individual occurrence modifications (reschedule, edit)
CREATE TABLE event_occurrences (
    occurrence_id BIGINT PRIMARY KEY,
    event_id BIGINT REFERENCES events(event_id) ON DELETE CASCADE,
    original_start TIMESTAMPTZ NOT NULL,
    new_start TIMESTAMPTZ,
    new_end TIMESTAMPTZ,
    override_title VARCHAR(500),
    override_description TEXT,
    override_location TEXT,
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (event_id, original_start)
);
CREATE INDEX idx_occurrences_event ON event_occurrences(event_id, original_start);

-- Attendees
CREATE TABLE event_attendees (
    event_id BIGINT REFERENCES events(event_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    role VARCHAR(20) DEFAULT 'required',
    responded_at TIMESTAMP,
    PRIMARY KEY (event_id, email)
);
CREATE INDEX idx_attendees_user ON event_attendees(user_id, status);
CREATE INDEX idx_attendees_email ON event_attendees(email);

-- Reminders
CREATE TABLE reminders (
    reminder_id BIGINT PRIMARY KEY,
    event_id BIGINT REFERENCES events(event_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    minutes_before INTEGER NOT NULL,
    fire_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    fired_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_reminders_fire ON reminders(fire_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_event ON reminders(event_id);

-- Calendar sharing
CREATE TABLE calendar_shares (
    calendar_id BIGINT REFERENCES calendars(calendar_id),
    shared_with_user BIGINT,
    shared_with_email VARCHAR(255),
    permission VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (calendar_id, shared_with_email)
);

-- External sync state
CREATE TABLE external_sync (
    sync_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(50) NOT NULL,
    external_calendar_id VARCHAR(255) NOT NULL,
    sync_token VARCHAR(255),
    last_synced_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    UNIQUE (user_id, provider, external_calendar_id)
);
CREATE INDEX idx_external_sync_user ON external_sync(user_id);
```

### Why PostgreSQL with `TIMESTAMPTZ`

- **`TIMESTAMPTZ`** stores in UTC but respects time zone context
- Conversion happens at display time
- Index-friendly for range queries
- Handles DST correctly

**Key design:** Always store UTC + original timezone. Never store local time.

### Indexing for Calendar Views

The most common query:
```sql
SELECT * FROM events
WHERE calendar_id = ?
  AND start_time < :range_end
  AND end_time > :range_start;
```

Index `(calendar_id, start_time)` handles this well. For overlap queries, `end_time` matters too — but a range scan on `start_time` is usually sufficient.

### Recurrence Storage

**Option A: Store RRULE, expand on read** (recommended)

- Store the rule as text
- Expand when displaying calendar
- Fast writes, slower reads

**Option B: Pre-expand all occurrences** (avoid)

- Create one row per occurrence
- Fast reads, slow writes
- Storage explosion (daily recurring × 5 years = 1825 rows)

**Recommendation:** Store RRULE, expand on read. Cache expanded results.

---

## 6. Deep Dive: Recurrence (RFC 5545)

### RRULE Format

```
FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20271231T235959Z
```

**Components:**
- **FREQ**: DAILY, WEEKLY, MONTHLY, YEARLY, HOURLY, MINUTELY, SECONDLY
- **INTERVAL**: Every N units (default 1)
- **COUNT**: Number of occurrences
- **UNTIL**: End date
- **BYDAY**: Days of week (MO, TU, WE, TH, FR, SA, SU)
- **BYMONTHDAY**: Days of month (1-31, -1 for last)
- **BYMONTH**: Months (1-12)
- **BYSETPOS**: Nth occurrence in set (e.g., 3rd Tuesday)

### Common Examples

| Rule | Meaning |
|---|---|
| `FREQ=DAILY` | Every day |
| `FREQ=WEEKLY;BYDAY=MO,WE,FR` | Mon, Wed, Fri |
| `FREQ=MONTHLY;BYMONTHDAY=15` | 15th of every month |
| `FREQ=MONTHLY;BYDAY=1MO` | First Monday of every month |
| `FREQ=MONTHLY;BYDAY=-1FR` | Last Friday of every month |
| `FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=17` | Every Sept 17 |
| `FREQ=WEEKLY;INTERVAL=2;BYDAY=TU` | Every other Tuesday |

### Recurrence Expansion Algorithm

```
function expandRecurrence(event, rangeStart, rangeEnd):
    rule = parseRRULE(event.rrule)
    occurrences = []
    cursor = max(event.dtstart, rangeStart)
    
    while cursor <= min(event.until or rangeEnd, rangeEnd):
        if matchesRule(rule, cursor):
            if cursor not in event.exdates:
                override = findOverride(event.event_id, cursor)
                if override:
                    if not override.is_cancelled:
                        occurrences.add(override)
                else:
                    occurrences.add(event with start=cursor, duration=event.duration)
        cursor = nextCandidate(rule, cursor)
    
    for rdate in event.rdates:
        if rangeStart <= rdate <= rangeEnd:
            occurrences.add(event with start=rdate)
    
    return occurrences
```

**Complexity:** O(occurrences in range), not O(total occurrences).

### Optimization: Fast-Forward

For rules like `FREQ=DAILY` starting 5 years ago, don't iterate 1825 times to find today's occurrence. **Fast-forward** using math:

```
For FREQ=DAILY;INTERVAL=1:
  Skip to: dtstart + ceil((rangeStart - dtstart) / 1 day) * 1 day

For FREQ=WEEKLY;BYDAY=MO,WE,FR:
  Compute the number of matching days between dtstart and rangeStart
  Jump directly to the first matching day >= rangeStart
```

**Impact:** Reducing 1825 iterations to 1 is a huge win for long-lived recurrences.

### Handling DST Transitions

**Problem:** An event at 9:00 AM local time should remain at 9:00 AM even when DST shifts.

**Solution:** Store the **wall-clock time** + timezone. Convert to UTC per occurrence.

```
Event: daily 9:00 AM IST
  Sep 17: 9:00 IST = 3:30 UTC
  Nov 1:  9:00 IST = 3:30 UTC (IST has no DST)
  
Event: daily 9:00 AM EST
  Oct 15: 9:00 EDT = 13:00 UTC
  Nov 15: 9:00 EST = 14:00 UTC
  Wall clock stays 9:00 AM; UTC shifts by 1 hour at DST transition.
```

**Key insight:** Time zones are the ground truth. UTC is derived.

### Exceptions (EXDATE, RDATE)

**EXDATE:** Remove occurrences from the recurrence.

```
FREQ=DAILY;EXDATE=20261225T090000Z
```

**RDATE:** Add extra occurrences not in the rule.

```
FREQ=WEEKLY;BYDAY=MO;RDATE=20260917T090000Z
```

**Override:** Change one occurrence (title, time, location).

```
Store in event_occurrences table with original_start + overrides
```

### Recurrence Engine Complexity

Given the various rules (FREQ, INTERVAL, BYDAY, BYMONTHDAY, BYSETPOS, WKST), expansion is non-trivial. **Use a battle-tested library:**

- **Java**: `ical4j`, `google-rfc-2445`
- **Python**: `python-dateutil` (`rrule`)
- **JavaScript**: `rrule.js`
- **Go**: `teambition/rrule-go`
- **Rust**: `rrule`

**Do not write your own RRULE parser** unless you have a specific need.

---

## 7. Deep Dive: Time Zones

### Time Zone Data (IANA)

- **597 time zones** (e.g., `Asia/Kolkata`, `America/New_York`)
- **Historical changes**: DST rules change over time
- **Future changes**: Governments announce changes; libraries updated frequently

**Rule:** Use the **IANA tzdata** database. Update monthly.

### Storage Rules

1. **Always store UTC** for `start_time` and `end_time`
2. **Always store the original timezone** (`start_timezone`)
3. **Never store local time as a string** in the DB
4. **Store the RRULE's `dtstart` in the original timezone**

### Conversion Example

```
User in New York creates event at 3:00 PM EST on Nov 15, 2026.
  Original: 2026-11-15T15:00:00 EST (America/New_York)
  UTC:      2026-11-15T20:00:00Z

Stored:
  start_time = 2026-11-15T20:00:00Z
  start_timezone = "America/New_York"
  
When Alice (in India) views it:
  Convert UTC to Asia/Kolkata: 2026-11-16T01:30:00+05:30
  Display: Nov 16, 1:30 AM IST
```

### DST Edge Cases

**Case 1: Event falls in the "skipped hour"**

On DST spring-forward, 2:00 AM becomes 3:00 AM. An event scheduled at 2:30 AM doesn't exist.

**Solution:** Move to 3:00 AM (first valid time after skipped hour).

**Case 2: Event falls in the "repeated hour"**

On DST fall-back, 1:00 AM occurs twice. Which one?

**Solution:** Default to the first occurrence (DST), unless user specifies.

**Case 3: Recurring event spans DST**

```
Weekly meeting at 9:00 AM EST (America/New_York).
  Mar 8:  9:00 EST  = 14:00 UTC
  Mar 15: 9:00 EDT  = 13:00 UTC (after DST)
```

The user sees "9:00 AM" every week (wall clock preserved), even though UTC shifts.

### Time Zone Library

Use a robust library:
- **Java**: `java.time.ZonedDateTime`
- **Python**: `pytz`, `zoneinfo` (Python 3.9+)
- **JavaScript**: `luxon`, `date-fns-tz`
- **Go**: `time.LoadLocation`

### User Time Zone

Store per-user:
```sql
ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
```

Detect from browser/mobile automatically; let user override.

---

## 8. Deep Dive: Availability Search (Calendly-Style)

### The Problem

Given N attendees and a time range, find common free slots.

```
Alice (IST, 9-6)  |  Bob (EST, 9-6)  |  Carol (PST, 9-6)
Find 30-min slots this week
```

### Algorithm

**Step 1: Determine each attendee's busy slots**

For each attendee:
```sql
SELECT start_time, end_time FROM events
WHERE user_id = ?
  AND start_time < :range_end
  AND end_time > :range_start
  AND status != 'cancelled';
```

Include recurring events (expand within range).

**Step 2: Convert working hours to UTC**

```
Alice: 9:00-18:00 IST = 3:30-12:30 UTC
Bob:   9:00-18:00 EST = 14:00-23:00 UTC
Carol: 9:00-18:00 PST = 17:00-02:00 UTC
```

**Intersection of working hours:** Find overlap.

```
Alice: 3:30 - 12:30
Bob:   14:00 - 23:00
Carol: 17:00 - 02:00 (next day)

No overlap! (This is why time zones are hard.)
```

**Step 3: Merge busy slots**

Union all busy slots from all attendees. Sort and merge overlaps.

**Step 4: Subtract from working hours**

Free slots = working hours - busy slots.

**Step 5: Filter by duration**

Only return slots >= requested duration.

**Step 6: Return top N slots**

Rank by preference (e.g., earliest, mid-day, etc.).

### Interval Merge Algorithm

```java
public List<Interval> mergeBusySlots(List<Interval> intervals) {
    intervals.sort(Comparator.comparing(i -> i.start));
    List<Interval> merged = new ArrayList<>();
    Interval current = intervals.get(0);
    
    for (int i = 1; i < intervals.size(); i++) {
        Interval next = intervals.get(i);
        if (next.start.isBefore(current.end) || next.start.equals(current.end)) {
            current = new Interval(current.start, max(current.end, next.end));
        } else {
            merged.add(current);
            current = next;
        }
    }
    merged.add(current);
    return merged;
}
```

**Complexity:** O(M log M) where M is total busy slots.

### Optimization: Caching

For Calendly-style public booking pages:
- Cache a user's busy slots for 5 minutes
- Invalidate on event create/update
- Reduces DB queries

### Free/Busy API (CalDAV)

Standard protocol for sharing availability:

```http
POST /freebusy
Content-Type: application/xml

<?xml version="1.0"?>
<C:free-busy-query>
  <C:time-range start="20260918T000000Z" end="20260922T000000Z"/>
</C:free-busy-query>
```

**Response:**
```xml
<C:schedule-response>
  <C:response>
    <C:recipient>alice@example.com</C:recipient>
    <C:request-status>2.0;Success</C:request-status>
    <C:calendar-data>
      <C:freebusy>
        <C:fb>
          <C:fbtype>BUSY</C:fbtype>
          <C:start>20260918T140000Z</C:dtstart>
          <C:end>20260918T150000Z</C:dtend>
        </C:fb>
      </C:freebusy>
    </C:calendar-data>
  </C:response>
</C:schedule-response>
```

**No user identity exposed** — only busy/free status. Privacy-preserving.

### Scheduling Polls

"Doodle"-style: propose multiple slots, attendees vote.

```json
{
  "poll_id": "poll-123",
  "slots": [
    {"start": "...", "end": "...", "votes": ["alice", "bob"]},
    {"start": "...", "end": "...", "votes": ["carol"]}
  ]
}
```

Once a slot has unanimous votes, create the event.

---

## 9. Deep Dive: Reminders at Scale

### The Problem

5B reminders need to fire within 1 minute of target time. This is a scheduling problem.

### Approach 1: Cron Job Scanning DB (Simple)

```
Every minute:
  SELECT * FROM reminders
  WHERE fire_at BETWEEN now() AND now() + interval '1 minute'
    AND status = 'pending'
  
  For each reminder: send and update status
```

**Pros:** Simple.
**Cons:** Doesn't scale; DB gets hammered every minute.

### Approach 2: Time-Bucketed Queues (Recommended)

```
Redis sorted set per time bucket (e.g., per minute)
  ZADD reminders:202609171030 <fire_at_unix> reminder_id
  
Every minute:
  ZRANGEBYSCORE reminders:current_bucket -inf +inf
  Process all, move to next bucket if not due yet
```

**Why it works:**
- O(log N) inserts
- O(K) for K due reminders
- Buckets auto-expire after processing

### Approach 3: Distributed Scheduler with Lease

Multiple worker nodes, each grabs a time bucket:

```d2
direction: down

pg: "PostgreSQL (reminders)" {shape: cylinder}
k: "Kafka (time-bucket topics)" {shape: queue}
w1: "Worker 1" {shape: rectangle}
w2: "Worker 2" {shape: rectangle}
w3: "Worker 3" {shape: rectangle}

pg -> k: publish buckets
k -> w1: bucket 10:30
k -> w2: bucket 10:31
k -> w3: bucket 10:32
```

Each bucket has exactly one worker. If a worker dies, the lease expires and another picks up.

### Approach 4: Delay Queue (RabbitMQ)

```
Publisher: send message with TTL = time until fire
Queue: delay queue with DLX (dead letter exchange)
When TTL expires, message routed to processing queue
```

**Pros:** No polling.
**Cons:** Limited TTL precision (ms), memory-heavy for long delays.

### Recommended Hybrid

- **Short delays** (< 1 hour): Redis sorted sets
- **Long delays** (> 1 hour): Time-bucketed DB, promoted to Redis when close
- **Recurring reminders**: Pre-computed for next N occurrences

### Reliability Guarantees

**At-least-once delivery:**
- Worker marks reminder as "processing" (lease)
- Sends notification
- On success: mark "fired"
- On crash: lease expires; retry

**Idempotency:** Each reminder has a unique ID; duplicate sends are deduped by notification service.

### Batching

For a meeting with 100 attendees, don't send 100 individual reminders. Batch:
- Send one notification per user (grouped by user_id)
- Use multicast for push (FCM supports up to 1000 devices per call)

### Failure Handling

- **Notification service down:** Retry with backoff, up to 3 attempts
- **User's device offline:** Queue push (FCM/APNS handles this)
- **Email bounce:** Log, don't retry
- **SMS failure:** Fallback to email

---

## 10. Deep Dive: External Calendar Sync

### Why Sync Matters

Users have events across Google Calendar, Outlook, Apple Calendar, and your app. They want one view.

### Sync Architecture

```d2
direction: down

sync: "Sync Service" {shape: rectangle}
state: "External Sync State" {shape: cylinder}
local: "Local Events" {shape: cylinder}
google: "Google Calendar API" {shape: cloud}
outlook: "Outlook Graph API" {shape: cloud}
k: Kafka {shape: queue}

sync -> state: read cursor
sync -> google: incremental sync
sync -> outlook: incremental sync
google -> sync: deltas
outlook -> sync: deltas
sync -> local: apply changes
local -> k: publish events
k -> sync: trigger outbound
```

### Two-Way Sync

**Inbound:** External event created -> mirror in local DB
**Outbound:** Local event created -> push to external API

**Conflict:** Same event edited on both sides.

### Sync Protocol (Google Calendar)

Google provides **incremental sync** with `syncToken`:

```
1. First call: GET /calendars/primary/events?syncToken=null
2. Response includes `nextSyncToken`
3. Next call: GET /calendars/primary/events?syncToken=<token>
4. Returns only changes since last sync
5. 410 Gone means token expired; do full resync
```

**Push notifications:** Google offers webhooks (channel subscriptions):
- Register a channel; Google POSTs to your endpoint on changes
- Channels expire (max 7 days); renew before expiry

### Conflict Resolution

**Approaches:**
1. **Last-Write-Wins**: The most recent edit wins (loses one side)
2. **Merge non-conflicting fields**: Both edited different fields
3. **Manual**: Show conflict to user in UI
4. **Server-wins**: Local loses, re-sync

**Recommended:** Field-level merge. If same field edited, last-write-wins with audit log.

**Example:**
```
External edit: changed title to "Team Standup (NEW)"
Local edit:    changed location to "Room 5"

Merge result: title="Team Standup (NEW)", location="Room 5"
```

### Sync Rate Limits

Google Calendar API:
- 1,000,000 queries/day per project
- 600 queries/min/user
- Push channels have limits

**Mitigation:**
- Use incremental sync (fewer calls)
- Batch multiple event updates
- Respect `Retry-After` headers
- Back off exponentially on errors

### Sync Cursors

Store per-provider cursor:
```sql
UPDATE external_sync
SET sync_token = ?, last_synced_at = NOW()
WHERE sync_id = ?;
```

On restart, resume from cursor.

### Handling Deleted Events

- **Local delete:** Mark deleted, push delete to external (soft delete)
- **External delete:** Sync detects missing event; soft-delete locally
- **Conflict:** Both deleted -> hard delete eventually

### Sync Priorities

- Sync interval: 15 minutes (default)
- Faster for primary calendar (5 min)
- Real-time via webhooks (Google, Outlook)

---

## 11. Scaling Considerations

### Read Scaling

- **Redis cache** for calendar views (most common read)
- **Read replicas** for PostgreSQL
- **CDN** for static assets (avatars, CSS)
- **Elasticsearch** for search

**Cache invalidation:** Invalidate a user's calendar cache when any of their events change.

### Write Scaling

**Writes are moderate (~1,157/sec peak ~3,500/sec).** PostgreSQL handles this with sharding.

**Sharding strategy:** Shard by `user_id` (each user's calendar is independent).

```
shard_id = hash(user_id) % N
```

**Cross-user operations (meetings with attendees):**
- Primary shard owns the event
- Attendees' shards get a mirrored copy (denormalized)
- Updates propagate via Kafka

### Recurrence Expansion Cost

For a user with 100 recurring events, expanding a month view:
- Naive: 100 events × 30 days = 3,000 operations
- Optimized (fast-forward): 100 operations

**Cache the expanded view** per user per month. Invalidate on event change.

### Time Zone Data Updates

IANA publishes updates (typically 2-4x per year). Deploy updates:
- Rolling deploy across services
- Recompute cached events (may shift times)
- Notify users of significant changes (e.g., government changes DST)

### Search Scaling

Elasticsearch for:
- Event title search
- Attendee search
- Description full-text

Index fields:
```json
{
  "event_id": "...",
  "user_id": "...",
  "title": "Team Standup",
  "description": "Daily sync",
  "attendees": ["alice@", "bob@"],
  "location": "Google Meet",
  "start_time": "..."
}
```

### Multi-Region

**Data residency:** Users in EU stay in EU (GDPR).

**Home region:** Each user has a home region based on signup location.

**Cross-region meetings:** Event stored in the organizer's region. Attendees get mirrored copies.

**Replication:** Async, eventual consistency acceptable for calendar views.

---

## 12. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Recurring expansion cost | Fast-forward, cache | Memory |
| DST correctness | Store UTC + timezone | Complexity |
| Availability search | Merge intervals, cache free/busy | Stale data |
| Reminders at scale | Time-bucketed queues | Complexity |
| External sync | Incremental + webhooks | Rate limits |
| Conflict resolution | Field-level merge | Complexity |
| Cache invalidation | Pub/sub on change | Latency |
| Sharding | By user_id | Cross-shard attendees |
| Multi-region | Home region | Cross-region latency |
| Time zone updates | Deploy + recompute | Downtime risk |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Primary DB | PostgreSQL with TIMESTAMPTZ | Range queries, time zones |
| Recurrence storage | Store RRULE, expand on read | Storage efficiency |
| Recurrence engine | Library (ical4j, rrule.js) | Battle-tested |
| Time zone | IANA tzdata, store UTC + original TZ | Correctness |
| Calendar view cache | Redis | Huge read speedup |
| Availability | Merge intervals | O(M log M) |
| Reminders | Time-bucketed queues | Reliable, scalable |
| Sync | Incremental + webhooks | Rate limit-friendly |
| Conflicts | Field-level merge | Preserves user intent |
| Sharding | By user_id | Natural isolation |

---

## 13. Failure Scenarios

### Recurrence Expansion Fails

**Impact:** Calendar view shows error or missing events.

**Mitigation:**
- Fall back to showing master event only
- Alert ops
- Fix RRULE parsing bug

### DST Transition Bug

**Impact:** Events show at wrong time (off by 1 hour).

**Mitigation:**
- Comprehensive DST test suite
- Monitor for time zone anomalies
- Users can manually correct

### Reminder Not Fired

**Impact:** User misses meeting.

**Mitigation:**
- At-least-once delivery
- Lease-based processing (crash recovery)
- Alert if reminder fire rate < 99.9%

### External Sync Conflict

**Impact:** User sees duplicate or wrong events.

**Mitigation:**
- Field-level merge
- Audit log of all changes
- User-visible conflict resolution UI

### DB Replica Lag

**Impact:** User sees stale calendar view.

**Mitigation:**
- Read from primary for writes
- Short replica lag (< 1 sec target)
- Alert if lag > 5 sec

### Time Zone Database Outdated

**Impact:** Events in recently-changed zones show wrong time.

**Mitigation:**
- Auto-update tzdata (monthly)
- Monitor for IANA announcements
- Test suite with recent changes

### Notification Storm

**Impact:** Meeting with 1000 attendees floods notifications.

**Mitigation:**
- Batch per recipient
- Rate limit notifications
- Use multicast push (FCM)

### Idempotency Key Collision

**Impact:** Different events treated as duplicates.

**Mitigation:**
- UUID v4 (collision probability negligible)
- Scope keys per-user per-endpoint
- TTL: 24 hours

### Shard Failure

**Impact:** Users on that shard can't access calendars.

**Mitigation:**
- Shard replica with automatic failover
- Reroute reads to replica
- Recovery in ~30 sec

---

## 14. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Event creation p99 | < 300 ms | > 1 sec |
| Calendar view p99 | < 500 ms | > 1.5 sec |
| Availability check p99 | < 200 ms | > 500 ms |
| Reminder fire rate | > 99.9% | < 99% |
| Reminder fire latency | < 1 min | > 5 min |
| Sync success rate | > 99% | < 95% |
| Sync lag (external) | < 15 min | > 1 hour |
| Cache hit ratio | > 85% | < 70% |
| Recurrence expansion p99 | < 100 ms | > 500 ms |
| API error rate | < 0.1% | > 1% |

### Dashboards

- **Traffic**: Events/sec, views/sec, sync ops/sec
- **Latency**: p50/p95/p99 per endpoint
- **Recurrence**: Expansion count, cache hits
- **Reminders**: Fired, pending, failed per minute
- **Sync**: Inbound/outbound ops, conflict rate
- **Errors**: 4xx/5xx by endpoint
- **Infrastructure**: DB, Redis, Kafka health

### Alerts

- **P0**: DB down, reminder fire rate < 99%, sync failures > 10%
- **P1**: p99 latency > 1 sec, cache hit ratio < 70%
- **P2**: Sync lag > 1 hour, high conflict rate
- **P3**: Time zone DB outdated, high API error rate

### Specialized Monitoring

- **Time zone anomalies**: Track events that shift unexpectedly
- **Recurring event health**: Sample recurring events, verify expansion
- **Reminder audit**: Weekly report on fired/pending/failed

---

## 15. Cost Estimation

Rough monthly cost (AWS, us-east-1) for 500M users:

| Component | Spec | Cost/month |
|---|---|---|
| PostgreSQL | 16 shards x db.r6g.4xlarge | ~$75,000 |
| Read replicas | 32 x db.r6g.2xlarge | ~$70,000 |
| Redis cluster | 30 x cache.r6g.2xlarge | ~$15,000 |
| API servers | 100 x c6g.large | ~$6,000 |
| Kafka (MSK) | 6 brokers | ~$2,500 |
| Elasticsearch | 10 x r6g.large | ~$3,000 |
| S3 | 10 TB | ~$250 |
| CDN | 5 TB/month | ~$500 |
| Monitoring | Datadog (500 hosts) | ~$15,000 |
| Data transfer | Cross-region | ~$10,000 |
| **Total** | | **~$197,000/month** |

**Per user:** ~$0.0004/month/user.

**Cost optimization:**
- Reserved instances (30-40% savings)
- Right-size shards
- Tiered storage for old events
- Self-hosted monitoring (Prometheus + Grafana)

---

## 16. Extensions and Follow-ups

### Room / Resource Booking

Extend to book rooms, equipment:
- Resources as special attendees
- Availability check includes resource calendars
- Recurring room bookings

### Video Conferencing Integration

Auto-generate meeting links:
- Google Meet / Zoom / Teams
- Inject link into event location
- Update on reschedule

### Smart Scheduling

ML-based suggestions:
- "Best time for this meeting" based on past patterns
- Focus time protection (block deep work)
- Travel time buffer between meetings

### Focus Time Blocks

Automatically block time for deep work:
- Based on user preferences
- Adaptive to calendar load
- ML to predict optimal blocks

### Team Calendar

Aggregate view for teams:
- See everyone's availability
- Group events (standups, syncs)
- Shared team calendar

### Calendar Analytics

Insights for users:
- Meeting load per week
- Time in meetings vs focus time
- Top collaborators
- Meeting cost (time × hourly rate)

### AI Assistant

Natural language event creation:
- "Schedule lunch with Alice next Tuesday"
- Parse date, time, attendee
- Auto-detect conflicts
- Suggest alternatives

### Offline Calendar

Local-first mobile app:
- Full calendar in SQLite
- Sync engine
- Works without connectivity
- Push when back online

### Calendar Federation

Cross-organization calendar sharing:
- CalDAV, iCalendar standards
- Federated free/busy
- Cross-company scheduling

### Public Calendar Pages

Like Calendly:
- Public URL for booking
- Configurable availability rules
- Custom form fields
- Automatic confirmation email

### Time Zone Traveler Mode

Detect user's location; auto-adjust display time zone:
- "You're in Tokyo"
- "Events shown in JST"
- Option to keep home time zone

---

## 17. Summary

| Aspect | Decision |
|---|---|
| Primary DB | PostgreSQL with TIMESTAMPTZ |
| Recurrence storage | Store RRULE, expand on read |
| Recurrence engine | Library (ical4j, rrule.js) |
| Time zone handling | Store UTC + original TZ, use IANA tzdata |
| Cache | Redis for calendar views |
| Availability | Interval merge (O(M log M)) |
| Reminders | Time-bucketed queues + leases |
| External sync | Incremental + webhooks |
| Conflict resolution | Field-level merge |
| Sharding | By user_id |
| Multi-region | Home region per user |
| Scale | 100M events/day, 5B total events |
| Latency | < 300 ms p99 for writes, < 500 ms for views |
| Availability | 99.99% |
| Cost | ~$197K/month for 500M users |

**Key takeaways:**

- **Time zones are the hardest part** — always store UTC + original TZ; use IANA tzdata
- **Recurring events need a proper RRULE engine** — don't roll your own
- **Fast-forward expansion** is critical for long-lived recurrences
- **Store RRULE, expand on read** — pre-expansion explodes storage
- **Availability search uses interval merge** — O(M log M) beats naive O(N × M)
- **Reminders need time-bucketed queues** — DB polling doesn't scale
- **External sync uses incremental APIs + webhooks** — don't poll
- **Field-level merge** resolves most sync conflicts without user intervention
- **Shard by user_id** — calendars are naturally user-scoped
- **Cache calendar views aggressively** — the same view is requested many times

**Similar Pattern Problems:**

- Show / Ticket Booking (time-based resource availability)
- Hospital Appointment Booking (similar scheduling problem)
- Distributed Task Scheduler (uses time-bucketed triggers)
- Notification System (scheduled reminders)
- Ride Booking (time-based availability)