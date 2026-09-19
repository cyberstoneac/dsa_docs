# System Design

A structured collection of system design notes — fundamentals, building blocks, and **52 practice problems** covering everything from URL shorteners to distributed tracing.

## 📖 How This Section Is Organized

### 1. Fundamentals
Core concepts every system design interview expects:

- [Back of Envelope Estimation](fundamentals/back-of-envelope.md) — QPS, storage, bandwidth, cache sizing
- [Database Design](fundamentals/database-design.md) — SQL vs NoSQL, sharding, replication, indexing
- [Building Blocks](fundamentals/building-blocks.md) — Load balancers, caches, queues, rate limiters, CDNs, circuit breakers

### 2. Problems (52 Total)
Full walkthroughs organized into **7 progressive phases**. Start with Phase 1 (foundations) and work through to Phase 7 (distributed systems).

Every problem follows the same 16-section framework:

1. Problem Statement
2. Requirements Clarification
3. Back-of-Envelope Estimation
4. High-Level Design (with diagrams)
5. API Design
6. Database / Storage Design
7. Deep Dives (the tricky parts)
8. Scaling Considerations
9. Bottlenecks & Trade-offs
10. Failure Scenarios
11. Monitoring & Alerts
12. Cost Estimation
13. Extensions & Follow-ups
14. Summary
15. Key Takeaways
16. Similar Pattern Problems

---

## 🎯 Phase 1 — Foundations

Infrastructure building blocks used everywhere. Complete these first.

| # | Problem | Tags |
|---|---|---|
| 01 | [URL Shortener](problems/01-url-shortener.md) | Caching, Snowflake ID, Read-heavy |
| 02 | [Rate Limiter](problems/02-rate-limiter.md) | Token bucket, Redis, Distributed |
| 03 | [Distributed Unique ID Generator](problems/03-distributed-id-generator.md) | Snowflake, Time-sortable |
| 04 | [Distributed Lock](problems/04-distributed-lock.md) | etcd, Fencing tokens, Raft |
| 05 | [Pub/Sub System](problems/05-pub-sub-system.md) | Kafka, Fan-out, Log-based |
| 06 | [Distributed Message Queue](problems/06-distributed-message-queue.md) | At-least-once, DLQ, Visibility timeout |
| 07 | [Distributed Cache](problems/07-distributed-cache.md) | Consistent hashing, LRU, Redis |
| 08 | [Service Discovery](problems/08-service-discovery.md) | Consul, etcd, Health checks |
| 09 | [API Gateway](problems/09-api-gateway.md) | JWT, Routing, Circuit breaker |
| 10 | [CDN](problems/10-cdn.md) | Anycast, Edge caching, Origin shield |

---

## 🎯 Phase 2 — Simple Products

Moderate complexity. Reinforces Phase 1 fundamentals.

| # | Problem | Tags |
|---|---|---|
| 11 | [Cash Split](problems/11-cash-split.md) | Idempotency, Double-entry, Greedy |
| 12 | [Calendar / Scheduling](problems/12-calendar-scheduling.md) | RRULE, Timezones, Recurrence |
| 13 | [Show / Ticket Booking](problems/13-show-ticket-booking.md) | Seat lock, Concurrency, Payment |
| 14 | [Task Management](problems/14-task-management.md) | Trello, Real-time, LexoRank |
| 15 | [Voting / Polling](problems/15-voting-polling.md) | Idempotency, Fraud, Sharded counters |
| 16 | [Hospital Appointment Booking](problems/16-hospital-appointment-booking.md) | Slot lock, Teleconsult, HIPAA |
| 17 | [Insurance Platform](problems/17-insurance-platform.md) | Quotes, Underwriting, Claims |
| 18 | [Product Catalog](problems/18-product-catalog.md) | Elasticsearch, Facets, CDC |
| 19 | [Job Search Platform](problems/19-job-search-platform.md) | Resume parsing, Matching, ATS |
| 20 | [Search Autocomplete](problems/20-search-autocomplete.md) | Trie/FST, Trending, Edge caching |

---

## 🎯 Phase 3 — Communication

Real-time and messaging systems. Heavy on WebSocket and fan-out.

| # | Problem | Tags |
|---|---|---|
| 21 | [Notification System](problems/21-notification-system.md) | Multi-channel, WebSocket, Batching |
| 22 | [Online Messaging App](problems/22-online-messaging-app.md) | WhatsApp, E2EE, Offline queue |
| 23 | [Mail Sharing](problems/23-mail-sharing.md) | Gmail, SMTP/IMAP, Spam filter |
| 24 | [Content Sharing / Microblog](problems/24-content-sharing-microblog.md) | Twitter, Fan-out, Trending |
| 25 | [Social Feed / Timeline](problems/25-social-feed-timeline.md) | Facebook, Ranking, Hybrid fan-out |
| 26 | [News Feed Ranking](problems/26-news-feed-ranking.md) | ML ranking, Position bias, Multi-task |
| 27 | [Content Moderation](problems/27-content-moderation.md) | ML + Human, Appeals, DSA compliance |
| 28 | [Reddit-style Forum](problems/28-reddit-style-forum.md) | Hot ranking, Nested comments, Vote integrity |
| 29 | [Video Conferencing](problems/29-video-conferencing.md) | WebRTC, SFU, Simulcast |

---

## 🎯 Phase 4 — Media & Content

High-bandwidth systems. Exabyte-scale storage, CDN-heavy.

| # | Problem | Tags |
|---|---|---|
| 30 | [Video Streaming (VOD)](problems/30-video-streaming-vod.md) | YouTube, Transcoding, HLS/DASH |
| 31 | [Music Streaming](problems/31-music-streaming.md) | Spotify, Royalties, Offline |
| 32 | [Live Streaming](problems/32-live-streaming.md) | Twitch, RTMP, LL-HLS |
| 33 | [Recommendation Engine](problems/33-recommendation-engine.md) | Two-tower, Feature store, Online learning |
| 34 | [File Storage Service](problems/34-file-storage-service.md) | Dropbox, Chunked upload, Dedup |
| 35 | [Collaborative Document Editor](problems/35-collaborative-document-editor.md) | Google Docs, OT/CRDT, Offline |

---

## 🎯 Phase 5 — Location & Mobility

Geospatial systems. Real-time location, matching, routing.

| # | Problem | Tags |
|---|---|---|
| 36 | [Proximity Service](problems/36-proximity-service.md) | Yelp, Geohash, Nearby search |
| 37 | [Ride Booking](problems/37-ride-booking.md) | Uber, Redis GEO, Surge pricing |
| 38 | [Food Delivery](problems/38-food-delivery.md) | Swiggy, 3-sided, Partner assignment |
| 39 | [Dating App](problems/39-dating-app.md) | Tinder, Swipe, Photo verification |
| 40 | [Proximity Matchmaking](problems/40-proximity-matchmaking.md) | Real-time matching, Distributed locks |

---

## 🎯 Phase 6 — Fintech

Money systems. ACID, idempotency, compliance dominate.

| # | Problem | Tags |
|---|---|---|
| 41 | [Payment System](problems/41-payment-system.md) | Stripe, Idempotency, Double-entry |
| 42 | [Digital Wallet](problems/42-digital-wallet.md) | Paytm, RBI PPI, KYC limits |
| 43 | [E-Commerce Checkout](problems/43-ecommerce-checkout.md) | Amazon, Inventory, Idempotency |
| 44 | [Travel Booking](problems/44-travel-booking.md) | IRCTC, Multi-provider, Seat hold |
| 45 | [Trading Platform](problems/45-trading-platform.md) | Zerodha, Real-time, Risk |
| 46 | [Fraud Detection](problems/46-fraud-detection.md) | Stripe Radar, ML + Rules, Graph |

---

## 🎯 Phase 7 — Distributed Systems

Internal infrastructure. Highest complexity, most abstract.

| # | Problem | Tags |
|---|---|---|
| 47 | [Web Crawler](problems/47-web-crawler.md) | Googlebot, Politeness, Dedup |
| 48 | [Distributed Task Scheduler](problems/48-distributed-task-scheduler.md) | Airflow, Cron, At-least-once |
| 49 | [Log Ingestion System](problems/49-log-ingestion-system.md) | ELK, Kafka, Tiered storage |
| 50 | [Metrics / Monitoring](problems/50-metrics-monitoring.md) | Prometheus, Time-series, Alerting |
| 51 | [Distributed Tracing](problems/51-distributed-tracing.md) | Jaeger, Spans, Sampling |
| 52 | [Online Judge](problems/52-online-judge.md) | LeetCode, Sandbox, Real-time leaderboard |

---

## 🔑 Shared Pattern Reference

Many problems share the same architectural pattern. Once you've studied one, the rest are variations.

| Base Pattern | Apps That Share It |
|---|---|
| Ride Booking | Uber, Ola, Rapido, Lyft, Bolt, Grab |
| Food Delivery | Swiggy, Zomato, Blinkit, Zepto, DoorDash |
| Video Streaming (VOD) | YouTube, Netflix, Hotstar, Prime Video, Dailymotion |
| Music Streaming | Spotify, Gaana, JioSaavn, Apple Music |
| Microblog | Twitter, Threads, Mastodon, Bluesky |
| Social Feed | Instagram, Facebook, LinkedIn feed |
| Messaging | WhatsApp, Slack, Telegram, Signal, Discord, Snapchat |
| Payment | PhonePe, GPay, Paytm, BHIM, Cred, Stripe, PayPal |
| Trading | Zerodha, Groww, Robinhood, Coinbase |
| Collaborative Editor | Google Docs, Notion, Confluence, Quip |
| Task Management | Trello, Asana, Jira, Linear, ClickUp, Monday |
| File Storage | Dropbox, Google Drive, OneDrive, Box |
| Video Conferencing | Zoom, Teams, Google Meet, Webex |
| Mail | Gmail, Outlook, Yahoo Mail, ProtonMail |
| Show / Ticket Booking | BookMyShow, Ticketmaster, Fandango |
| Travel Booking | IRCTC, Air India, Expedia, MakeMyTrip |
| Job Search | LinkedIn, Naukri, Monster, Indeed |
| Dating | Tinder, Bumble, Hinge, OkCupid |
| Forum | Reddit, Discourse, Hacker News |
| Hospital Booking | Practo, Apollo, Zocdoc, 1mg |
| Log Ingestion | ELK, Splunk, Datadog, Fluentd |
| Metrics | Prometheus, Datadog, Grafana |
| Tracing | Jaeger, Zipkin, OpenTelemetry |

---

## 🎓 Recommended Study Order

If you're preparing for interviews:

1. **Week 1** — Fundamentals (Back of Envelope, Database Design, Building Blocks)
2. **Week 2** — Phase 1 (Foundations) — all 10 problems
3. **Week 3** — Phase 2 (Simple Products) — 10 problems
4. **Week 4** — Phase 3 (Communication) — 9 problems
5. **Week 5** — Phase 4 (Media & Content) — 6 problems
6. **Week 6** — Phase 5 (Location & Mobility) — 5 problems
7. **Week 7** — Phase 6 (Fintech) — 6 problems
8. **Week 8** — Phase 7 (Distributed Systems) — 6 problems

**Total:** ~8 weeks, 2-4 hours per problem.

---

## 🛠️ Tech Stack Used in This Section

- **MkDocs** + **Material for MkDocs**
- **PlantUML** for component, sequence, and state diagrams (Cerulean theme)
- **D2** for architecture diagrams (`direction: down`)
- **Mermaid** for DSA docs (unchanged)

---

## 📌 Conventions Used

- **Back-of-envelope estimates** use `~100,000 seconds per day` shortcut
- **Peak multiplier** of 2x-10x depending on system type
- **Storage estimates** include replication and backup overhead
- **Latency numbers** are p99 unless otherwise noted
- **Cost estimates** are AWS us-east-1 rough figures (2026)
- **Code examples** are pseudocode or Java/Python unless language-specific

---

## 🚀 Where to Go Next

- **Practice mock interviews** — pick a random problem, design in 45 min
- **Build small versions** — implement key parts (rate limiter, URL shortener)
- **Read real systems** — engineering blogs from Uber, Netflix, Stripe
- **Study distributed systems** — DDIA by Martin Kleppmann

---

**Total problems:** 52
**Total phases:** 7
**Estimated study time:** 8-12 weeks
**Interview readiness:** After completing Phase 5, you should be ready for most mid-senior interviews