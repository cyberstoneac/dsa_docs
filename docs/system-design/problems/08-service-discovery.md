# Service Discovery

## Problem Statement

Design a service discovery system that allows services in a distributed environment to find each other dynamically. In modern microservices and Kubernetes environments, service instances are ephemeral — they start, stop, scale, and fail constantly. Hardcoded IP addresses don't work. Services need a way to register themselves and discover others without manual configuration.

**Example:**
```
Service "order-service" needs to call "payment-service".
Naive approach: hardcode http://10.0.1.42:8080
Problem: payment-service has 20 instances, IPs change, autoscaling happens.

With service discovery:
  order-service -> registry lookup "payment-service"
  -> [10.0.1.42:8080, 10.0.1.43:8080, ...]
  -> pick one (load balance) -> call it
```

**Real-world systems:** Consul, etcd, Eureka, ZooKeeper, Kubernetes DNS, AWS Cloud Map, Istio.

**Why it matters:**
- Autoscaling changes IPs constantly
- Containers restart with new IPs
- Multi-region deployments
- Zero-downtime deployments
- Health-based routing (skip unhealthy instances)

---

## 1. Requirements Clarification

### Functional Requirements
- **Register**: A service instance registers itself (name, IP, port, metadata)
- **Deregister**: On graceful shutdown, remove self
- **Heartbeat**: Periodic health signal; missing heartbeats trigger eviction
- **Discover**: Client queries for instances of a service
- **Watch**: Clients can subscribe to changes (push notifications)
- **Health checks**: Active (ping) or passive (heartbeat) health verification
- **Metadata**: Tags, version, region, zone, weight (for routing)
- **Multi-environment**: dev, staging, prod isolated

### Non-Functional Requirements
- **Scale**: 100K+ service instances registered
- **Latency**: Discovery lookup < 10 ms at p99
- **Availability**: 99.99% — services must always find each other
- **Consistency**: Strong for registration; eventual for discovery reads is OK
- **Freshness**: Changes propagate within 1 second
- **Fault tolerance**: Registry survives node failures
- **Multi-region**: Cross-region replication

### Out of Scope
- Load balancing (that's the client's job or a separate proxy)
- Service mesh (that's Istio/Linkerd, which uses discovery internally)
- Configuration management (that's etcd/Consul KV)

---

## 2. Back-of-Envelope Estimation

### Traffic

```
Given:
  Service instances      = 100,000
  Heartbeat interval     = 10 seconds
  Discovery lookups/sec  = 500,000 (across all services)
  Watch notifications    = 50,000/sec
  Peak multiplier        = 3x

Registration traffic:
  100,000 / 10 sec = 10,000 heartbeats/sec

Discovery traffic:
  500,000 lookups/sec (peak: 1.5M)

Total operations:
  ~2M ops/sec at peak
```

### Storage

```
Per service instance:
  - Service name: 50 bytes
  - IP + port: 20 bytes
  - Metadata (tags, version): 200 bytes
  - Health status: 20 bytes
  - Last heartbeat: 8 bytes
  Total: ~300 bytes

Total registrations:
  100,000 x 300 bytes = ~30 MB

With indexes, versioning, history:
  ~300 MB

Plus historical data (30 days of changes):
  ~10 GB
```

### Bandwidth

```
Heartbeat bandwidth:
  10,000 x 300 bytes = ~3 MB/sec

Lookup bandwidth:
  500,000 x 500 bytes (response with instance list) = ~250 MB/sec

Peak:
  ~750 MB/sec
```

### Latency Budget

```
Target: < 10 ms p99 for discovery lookup

Breakdown:
  Client -> registry:   ~1 ms
  Registry read:        ~1 ms
  Response:             ~1 ms
  Total:                ~3 ms

With watch (cached locally): ~0.1 ms
```

---

## 3. High-Level Design

```d2
direction: down

si: "Service Instance" {shape: person}
cs: "Client Service" {shape: person}
api: "Service Registry API" {shape: hexagon}
store: "Registry Store (etcd/Consul)" {shape: cylinder}
hc: "Health Checker" {shape: rectangle}
notif: "Change Notifier" {shape: rectangle}
meta: "Metadata DB (Postgres)" {shape: cylinder}
mon: "Metrics" {shape: cylinder}

si -> api: register + heartbeat
cs -> api: discover(name)
cs -> api: watch(name)
api -> store: write
api -> meta: audit log
hc -> si: active health check
hc -> store: mark unhealthy
store -> notif: change event
notif -> cs: push notification
api -> mon: metrics
```

### Component Responsibilities

| Component | Role |
|---|---|
| Service Registry API | Exposes register/deregister/discover/watch endpoints |
| Registry Store | Durable key-value store with watch capability (etcd/Consul) |
| Health Checker | Actively pings services to verify health |
| Change Notifier | Pushes updates to watchers |
| Metadata DB | Audit log, historical data, cross-region sync |
| Metrics | Monitors registry health and propagation latency |

### Why etcd/Consul Instead of Building from Scratch?

- **Consensus**: Raft ensures consistency across registry nodes
- **Watch**: Native push notification API
- **Leases**: TTL-based auto-deregistration
- **Battle-tested**: Powers Kubernetes, Consul, Vault

**Recommendation:** Use etcd/Consul as the storage layer. Build the API + health checker on top.

---

## 4. API Design

### Register

```http
POST /v1/services/{service_name}/instances
Content-Type: application/json

{
  "instance_id": "order-svc-pod-xyz",
  "ip": "10.0.1.42",
  "port": 8080,
  "metadata": {
    "version": "1.2.3",
    "region": "us-east-1",
    "zone": "us-east-1a",
    "weight": 100,
    "tags": ["canary"]
  },
  "health_check": {
    "type": "http",
    "endpoint": "/health",
    "interval_seconds": 10,
    "timeout_seconds": 3
  },
  "ttl_seconds": 30
}
```

**Response 201:**
```json
{
  "instance_id": "order-svc-pod-xyz",
  "registered_at": "2026-09-17T10:00:00Z"
}
```

### Heartbeat

```http
POST /v1/services/{service_name}/instances/{instance_id}/heartbeat
```

**Response 200:**
```json
{
  "alive": true,
  "ttl_remaining": 28
}
```

If heartbeat not received within TTL, instance is marked unhealthy and eventually removed.

### Deregister (Graceful Shutdown)

```http
DELETE /v1/services/{service_name}/instances/{instance_id}
```

**Response 200:**
```json
{
  "deregistered": true
}
```

### Discover

```http
GET /v1/services/{service_name}/instances?healthy=true&region=us-east-1
```

**Response 200:**
```json
{
  "service": "payment-service",
  "instances": [
    {
      "instance_id": "pay-1",
      "ip": "10.0.2.10",
      "port": 8080,
      "metadata": {"version": "2.1.0", "zone": "us-east-1a"},
      "healthy": true
    },
    {
      "instance_id": "pay-2",
      "ip": "10.0.2.11",
      "port": 8080,
      "metadata": {"version": "2.1.0", "zone": "us-east-1b"},
      "healthy": true
    }
  ]
}
```

### Watch (Push Notifications)

```http
GET /v1/services/{service_name}/watch
Accept: text/event-stream

event: instances_changed
data: {"service": "payment-service", "version": 42, "instances": [...]}

event: instances_changed
data: {"service": "payment-service", "version": 43, "instances": [...]}
```

Clients receive a stream of changes; no polling needed.

### gRPC Alternative

For high-throughput clients, gRPC streaming:

```protobuf
service ServiceDiscovery {
  rpc Register(RegisterRequest) returns (RegisterResponse);
  rpc Heartbeat(HeartbeatRequest) returns (HeartbeatResponse);
  rpc Deregister(DeregisterRequest) returns (DeregisterResponse);
  rpc Discover(DiscoverRequest) returns (DiscoverResponse);
  rpc Watch(WatchRequest) returns (stream WatchResponse);
}
```

---

## 5. Storage Design

### Registry Store Schema (etcd)

```
Key: /services/{service_name}/instances/{instance_id}
Value: {
  "ip": "10.0.1.42",
  "port": 8080,
  "metadata": {...},
  "lease_id": 1234567890,
  "registered_at": "2026-09-17T10:00:00Z"
}
Lease: TTL 30 seconds (renewed on heartbeat)
```

When the lease expires (no heartbeat), etcd automatically deletes the key.

### Watch Mechanism (etcd)

```
GET /services/payment-service/instances?watch=true

etcd delivers:
  PUT /services/payment-service/instances/pay-3 -> new instance
  DELETE /services/payment-service/instances/pay-1 -> instance removed
  PUT (metadata change)
```

Clients maintain a local cache + index by service name.

### Historical / Audit Schema (Postgres)

```sql
CREATE TABLE service_registrations (
    id BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    ip INET NOT NULL,
    port INT NOT NULL,
    metadata JSONB,
    registered_at TIMESTAMPTZ NOT NULL,
    deregistered_at TIMESTAMPTZ,
    deregistration_reason VARCHAR(50),
    INDEX idx_service_time (service_name, registered_at DESC)
);
```

Used for audit, debugging, and analytics.

### Cross-Region Replication

```d2
direction: down

us: "US Region" {shape: cloud}
eu: "EU Region" {shape: cloud}
apac: "APAC Region" {shape: cloud}
ur: "US Registry" {shape: cylinder}
er: "EU Registry" {shape: cylinder}
ar: "APAC Registry" {shape: cylinder}

us -> ur
eu -> er
apac -> ar
ur <-> er: bidirectional sync
er <-> ar: bidirectional sync
ar <-> us: bidirectional sync
```

**Approach:**
- Each region has its own registry (CP within region)
- Cross-region replication is eventual
- Clients query their local region; fall back to remote if needed

**Trade-off:** Cross-region discovery may lag by seconds.

---

## 6. Deep Dive: Registration Patterns

### 6.1 Self-Registration (Client-Side)

```d2
direction: down

si: "Service Instance" {shape: person}
r: Registry {shape: hexagon}
hc: "Health Checker" {shape: rectangle}

si -> r: register (startup)
si -> r: heartbeat (every 10s)
si -> r: deregister (shutdown)
hc -> si: health check
```

**Pros:** Simple, instance controls its own lifecycle.
**Cons:** Instance must know registry location; language-specific client.

### 6.2 Third-Party Registration (Sidecar/Platform)

```d2
direction: down

si: "Service Instance" {shape: person}
reg: "Registrar (K8s, Nomad)" {shape: rectangle}
r: Registry {shape: hexagon}

si -> reg: instance starts
reg -> r: register on behalf
reg -> r: heartbeat
reg -> r: deregister on shutdown
```

**Pros:** Language-agnostic; platform handles registration.
**Cons:** Platform dependency; less control.

### When to Use Which

| Scenario | Pattern |
|---|---|
| Bare metal / VMs | Self-registration |
| Kubernetes | Third-party (via Endpoints API) |
| Multi-cloud | Hybrid |
| Serverless | Platform-managed |

---

## 7. Deep Dive: Health Checks

### Active Health Checks

The registry (or a separate health checker) periodically pings each instance:

```http
GET http://10.0.1.42:8080/health
```

**Configuration:**
- **Interval**: 10 seconds
- **Timeout**: 3 seconds
- **Healthy threshold**: 2 consecutive successes
- **Unhealthy threshold**: 3 consecutive failures

**Pros:** Registry knows health without relying on instance to report.
**Cons:** Additional network traffic; needs network access to instances.

### Passive Health Checks (Heartbeat)

The instance periodically sends a heartbeat to the registry. Missing heartbeats = unhealthy.

**Configuration:**
- **TTL**: 30 seconds
- **Heartbeat interval**: 10 seconds (1/3 of TTL)

**Pros:** No extra connections from registry.
**Cons:** Requires instance to actively heartbeat; failure detection is slower.

### Combined Approach (Recommended)

1. Instance registers with a TTL lease (30s)
2. Instance heartbeats every 10s
3. Registry also actively checks `/health` every 10s
4. If either fails, instance is marked unhealthy
5. After N failures, instance is deregistered

**Result:** Fast detection + high confidence.

### Health Check Types

| Type | Endpoint | Use Case |
|---|---|---|
| HTTP | `GET /health` | Most common |
| TCP | Connect to port | Simple services |
| gRPC | `grpc.health.v1.Health/Check` | gRPC services |
| Command | Run script | Legacy services |
| TTL | Heartbeat only | Can't be pinged |

### Graceful Degradation

```
1. Instance receives SIGTERM
2. Deregister self from registry
3. Wait N seconds for clients to notice
4. Drain in-flight requests
5. Shutdown
```

**Why it matters:** Prevents "connection refused" errors during deploys.

---

## 8. Deep Dive: Discovery Patterns

### 8.1 Client-Side Discovery

```d2
direction: down

c: Client {shape: person}
r: "Service Registry" {shape: hexagon}
i1: "Instance 1" {shape: rectangle}
i2: "Instance 2" {shape: rectangle}

c -> r: discover("payment-service")
r -> c: [I1, I2]
c -> c: pick one (load balance)
c -> i1: request
```

**Pros:** Client chooses load-balancing strategy; no extra hop.
**Cons:** Client code complexity; language-specific.

### 8.2 Server-Side Discovery

```d2
direction: down

c: Client {shape: person}
lb: "Load Balancer / Router" {shape: hexagon}
r: "Service Registry" {shape: hexagon}
i1: "Instance 1" {shape: rectangle}
i2: "Instance 2" {shape: rectangle}

c -> lb: request
lb -> r: discover("payment-service")
r -> lb: [I1, I2]
lb -> i1: route
```

**Pros:** Client is simple; routing centralized.
**Cons:** Extra network hop; LB is SPOF (mitigated by clustering).

### 8.3 Service Mesh (Sidecar)

```d2
direction: down

c: "Client App" {shape: person}
cs: "Client Sidecar" {shape: rectangle}
r: "Service Registry" {shape: hexagon}
s: "Server App" {shape: rectangle}
ss: "Server Sidecar" {shape: rectangle}

c -> cs: local call
cs -> r: discover
r -> cs: instances
cs -> ss: proxy (mTLS, retry)
ss -> s: forward
```

**Pros:** Language-agnostic; advanced traffic management (retries, timeouts, circuit breakers).
**Cons:** Complex; adds latency; sidecar overhead.

### Pattern Comparison

| Pattern | Complexity | Latency | Language Support | Advanced Features |
|---|---|---|---|---|
| Client-side | Medium | Lowest | Per-language | Basic LB |
| Server-side | Low | +1 hop | Any | LB only |
| Service Mesh | High | +2 hops | Any | Full |

**Recommendation:** Client-side for microservices; server-side for simple apps; service mesh for complex organizations.

### DNS-Based Discovery

Simpler alternative:
```
payment-service.internal -> 10.0.2.10, 10.0.2.11, 10.0.2.12
```

- **Pros:** No client library needed; standard DNS.
- **Cons:** DNS TTL limitations (caching), no metadata, no health-awareness.

**Kubernetes uses this:** `payment-service.default.svc.cluster.local`.

---

## 9. Deep Dive: Consistency and Failure Handling

### Registry Consistency

**Within a region:**
- etcd/Consul provide strong consistency (Raft)
- All reads see latest writes
- Leader-based; followers forward writes

**Across regions:**
- Eventual consistency
- Propagation lag: seconds to minutes
- Conflicts resolved by timestamp or region priority

### Failure Scenarios

**Registry node fails:**
- etcd cluster (3-5 nodes) tolerates 1-2 failures
- Leader election in < 1 sec
- Clients reconnect transparently

**Client can't reach registry:**
- Use cached instance list (with TTL)
- Fall back to secondary registry (other region)
- Degraded mode: retry with backoff

**Registry entirely down:**
- Clients continue using cached lists
- Health checks stop updating (stale)
- Recovery: registry comes back, health checks resume

### Split-Brain

**Problem:** Network partition splits registry into two groups, both think they're primary.

**Mitigation:**
- Raft quorum (N/2 + 1)
- Minority partition becomes read-only
- When healed, minority reconciles from majority

### Stale Cache Window

Clients cache instance lists. If cache isn't invalidated promptly, clients may route to dead instances.

**Mitigation:**
- Short cache TTL (10-30s)
- Watch API for push invalidation
- Client-side retry on connection failure

---

## 10. Deep Dive: Load Balancing Algorithms

Once a client has a list of instances, which one to pick?

### Round Robin
```
Cycles through instances: 1, 2, 3, 1, 2, 3, ...
```
**Pros:** Simple, even distribution.
**Cons:** Doesn't account for instance health, weight, or load.

### Weighted Round Robin
```
Instance A (weight 3): 3 requests per cycle
Instance B (weight 1): 1 request per cycle
```
**Pros:** Handles heterogeneous instances.
**Cons:** Static weights.

### Least Connections
```
Route to instance with fewest active connections.
```
**Pros:** Adapts to instance load.
**Cons:** Needs connection tracking.

### Consistent Hashing
```
hash(request_key) % N -> instance
```
**Pros:** Sticky routing for cache affinity.
**Cons:** Imbalance if keys unevenly distributed.

### Power of Two Choices (P2C)
```
Pick 2 random instances; route to the less loaded one.
```
**Pros:** Much better balance than random, cheap.
**Cons:** Slightly more computation.

### Zone-Aware Routing
```
Prefer instances in the same zone (low latency).
Fall back to other zones if none available.
```
**Pros:** Low cross-zone traffic, resilience.
**Cons:** Requires zone metadata.

### Recommended for Service Discovery
- **Default:** Round robin
- **Heterogeneous:** Weighted round robin
- **Latency-sensitive:** P2C with latency scoring
- **Cache affinity:** Consistent hashing

---

## 11. Scaling Considerations

### Read Scaling
- Discovery reads dominate (500K/sec)
- Cache instance lists in client (with TTL)
- Watch API avoids polling
- Shard registry by service name if needed

### Write Scaling
- Registration/heartbeat is ~10K/sec
- etcd handles this easily
- Batch heartbeats for many instances in one API call

### Sharding Registry

```d2
direction: down

r: Router {shape: hexagon}
a: "Registry Shard A (services A-H)" {shape: cylinder}
b: "Registry Shard B (services I-P)" {shape: cylinder}
c: "Registry Shard C (services Q-Z)" {shape: cylinder}

r -> a
r -> b
r -> c
```

Shard by **service name prefix**. Each shard is its own etcd cluster.

**Trade-off:** Cross-shard queries need fan-out. Rare for discovery.

### Multi-Region

```d2
direction: down

us: "US Region" {shape: cloud}
eu: "EU Region" {shape: cloud}
apac: "APAC Region" {shape: cloud}
ur: "US Registry" {shape: cylinder}
er: "EU Registry" {shape: cylinder}
ar: "APAC Registry" {shape: cylinder}
cr: "Cross-region Replicator" {shape: rectangle}

us -> ur
eu -> er
apac -> ar
ur -> cr: change events
cr -> er
cr -> ar
```

**Approach:**
- Each region has a full registry (no cross-region lookups on critical path)
- Regional registries replicate to each other asynchronously
- Clients query local region

**Trade-off:** Cross-region discovery lag of seconds.

---

## 12. Bottlenecks and Trade-offs

| Concern | Solution | Trade-off |
|---|---|---|
| Registry SPOF | etcd cluster (3-5 nodes) | Complexity |
| Discovery latency | Client-side cache + watch | Stale window |
| Cross-region latency | Region-local registry | Replication lag |
| Hot service (many instances) | Sharding by service name | Cross-shard queries |
| Heartbeat storm | Batch heartbeats | Slightly slower detection |
| Stale instances | Short TTL + active checks | More traffic |
| Client library complexity | Server-side / mesh | Extra hop |
| Registry storage growth | TTL-based cleanup | History loss |

### Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Store | etcd (Raft) | Consensus, watch, leases |
| Registration | Self-registration + heartbeats | Simple, language-agnostic |
| Health checks | Active + passive | High confidence |
| Discovery | Client-side with cache | Lowest latency |
| Watch | SSE / gRPC stream | Push, not poll |
| TTL | 30 sec, heartbeat every 10 sec | 3x safety margin |
| Deregistration | Explicit on shutdown | Prevents connection refused |
| Multi-region | Region-local | Simplicity, latency |
| Load balancing | Round robin + zone-aware | Default behavior |

---

## 13. Failure Scenarios

### Service Instance Crash

**Impact:** Instance stops heartbeating.

**Detection:** TTL expires (30 sec) or active health check fails (3 attempts).

**Recovery:** Registry removes instance; clients get updated list.

**Grace period:** Clients may still route to dead instance for a few seconds. Client should retry with another instance.

### Registry Node Down

**Impact:** etcd cluster loses a node.

**Mitigation:**
- 3-node cluster: tolerates 1 failure
- 5-node cluster: tolerates 2 failures
- Leader election in < 1 second

**Client impact:** Transparent; clients reconnect.

### Registry Cluster Down

**Impact:** No new registrations; no discovery updates.

**Mitigation:**
- Clients use cached instance lists
- Health checks stop; stale instances may persist
- Alert immediately

**Recovery:** Registry comes back; health checks resume; stale instances evicted.

### Network Partition

**Impact:** Registry split into two groups.

**Mitigation:**
- Raft quorum (majority group continues)
- Minority group becomes read-only
- Clients in minority region fall back to their cache

### Thundering Herd on Registry Restart

**Impact:** 100K instances all re-register at once.

**Mitigation:**
- Exponential backoff with jitter on registration retry
- Staggered heartbeat schedules
- Rate limit registration endpoint

### Slow Watch Propagation

**Impact:** Clients take longer to learn about new instances.

**Mitigation:**
- Monitor propagation latency
- Alert if > 1 second
- Add more watch endpoints if bottleneck

### Cross-Region Replication Lag

**Impact:** Client in EU sees stale US instance list.

**Mitigation:**
- Region-local registries for regional services
- Acceptable for global services
- Use a central registry for truly global services (rare)

---

## 14. Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|---|---|---|
| Registration p99 latency | < 10 ms | > 50 ms |
| Discovery p99 latency | < 10 ms | > 50 ms |
| Watch propagation p99 | < 1 sec | > 5 sec |
| Registry uptime | 99.99% | < 99.9% |
| Active instances per service | baseline | sudden drop > 50% |
| Heartbeat miss rate | < 0.1% | > 1% |
| Cross-region replication lag | < 10 sec | > 60 sec |
| etcd leader changes | 0/day | > 1/hour |
| Discovery cache hit ratio | > 95% | < 85% |

### Dashboards

- **Traffic**: Registrations, discoveries, watches per second
- **Latency**: p50/p95/p99 for each operation
- **Topology**: Services, instances, health status
- **Registry health**: etcd node status, leader, lag
- **Propagation**: Change detection to client notification time
- **Errors**: Registration failures, discovery failures

### Alerts

- **P0**: Registry cluster down, propagation latency > 30 sec
- **P1**: Watch propagation > 5 sec, cross-region lag > 60 sec
- **P2**: Registration failure rate > 1%, cache hit ratio < 85%
- **P3**: etcd leader change, high reconnect rate

---

## 15. Cost Estimation

Rough monthly cost (AWS, us-east-1) for 100K instances:

| Component | Spec | Cost/month |
|---|---|---|
| etcd cluster (3 nodes) | 3 x m6i.xlarge | ~$450 |
| Registry API servers | 10 x c6g.large | ~$600 |
| Health checker fleet | 5 x c6g.large | ~$300 |
| Cross-region replication | Data transfer | ~$500 |
| Monitoring (Datadog) | 20 hosts | ~$1,500 |
| **Total** | | **~$3,350/month** |

**Cost optimization:**
- Smaller instances for etcd (c6g.large is fine)
- Consolidate with other etcd uses
- Self-hosted Prometheus + Grafana
- Reserved instances for steady state

**Note:** Discovery cost is tiny compared to compute. Service discovery is cheap.

---

## 16. Extensions and Follow-ups

### Service Mesh Integration

Service meshes (Istio, Linkerd) use discovery internally:
- Sidecar proxies subscribe to registry
- Advanced features: retries, timeouts, circuit breakers, mTLS
- No application changes required

**Trade-off:** Sidecar overhead (~5-10 ms latency, ~50 MB RAM).

### DNS-Based Discovery (Kubernetes)

Kubernetes Service API provides:
- ClusterIP (virtual IP)
- Headless services (DNS returns all pod IPs)
- `service.namespace.svc.cluster.local`

**Pros:** No client library needed; works with any language.
**Cons:** DNS caching delays updates; limited metadata.

### gRPC Service Discovery

gRPC has built-in name resolution:
- `dns:///payment-service`
- `xds:///payment-service` (Envoy-based)
- Custom resolvers (Consul, etcd)

**Pros:** Built into gRPC; language-agnostic.
**Cons:** gRPC-specific.

### Multi-Cluster Discovery

For multi-cluster setups:
- **Federated registry**: Each cluster registers with a global registry
- **Cluster DNS**: Cross-cluster DNS zones
- **Mesh federation**: Service mesh handles cross-cluster discovery

### Metadata for Traffic Management

Use metadata for:
- **Canary deployments**: Route 5% traffic to `version=2.0`
- **A/B testing**: Route by user cohort
- **Blue-green**: Instant switch by tag
- **Compliance**: Route EU users to EU instances

### Health Check Escalation

Graduated responses:
1. First miss: mark warning
2. Second miss: reduce weight (partial traffic)
3. Third miss: mark unhealthy (no traffic)
4. Fifth miss: deregister

Provides graceful degradation.

### Discovery for Serverless

For Lambda/Functions:
- Functions register with a "health" endpoint
- Auto-scaling triggers re-registration
- Cold start requires lazy registration

**Tools:** AWS Cloud Map, Consul on ECS.

### Zone-Aware and Region-Aware Routing

```
Client in us-east-1a:
  Prefer instances in us-east-1a
  Fall back to us-east-1b, us-east-1c
  Never cross region unless necessary
```

**Benefits:** Lower latency, fewer cross-AZ charges, resilience.

### Service Dependency Graph

Track who calls whom:
- Discovery logs reveal call graph
- Useful for capacity planning and incident response
- Enables dependency-aware deployments

---

## 17. Summary

| Aspect | Decision |
|---|---|
| Store | etcd (Raft-based, watch, leases) |
| Registration | Self-registration with heartbeats |
| Health checks | Active + passive (combined) |
| Discovery | Client-side with watch + cache |
| TTL | 30 sec, heartbeat every 10 sec |
| Deregistration | Explicit on graceful shutdown |
| Load balancing | Round robin + zone-aware |
| Multi-region | Region-local registries + async replication |
| Latency | < 10 ms p99 for lookup |
| Scale | 100K+ instances |
| Availability | 99.99% |
| Cost | ~$3,350/month for 100K instances |

**Key takeaways:**

- **etcd/Consul** as the storage layer beats building from scratch (consensus, watch, leases)
- **Self-registration + heartbeats** is the standard pattern
- **Combined active + passive health checks** gives fast, reliable failure detection
- **Client-side discovery with watch** is the lowest-latency pattern
- **TTL of 30s + heartbeat every 10s** balances freshness and traffic
- **Explicit deregistration** on shutdown prevents connection refused errors
- **Region-local registries** beat a global registry for latency
- **Zone-aware routing** reduces latency and cross-AZ costs
- **Service discovery is cheap** — focus on correctness, not cost

**Similar Pattern Problems:**

- API Gateway (uses discovery to find backends)
- Distributed Lock (uses registry for leader election)
- Service Mesh (builds on discovery)
- Distributed Cache (uses discovery to find cache nodes)
- Pub/Sub System (uses discovery for broker lookup)
- Kubernetes Services (uses discovery internally)