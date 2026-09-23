# Kubernetes

> **Context:** At 13 YOE, Kubernetes interviews are rarely about YAML syntax — they're about **operational reasoning**: how does a pod get scheduled, what happens on node failure, how do rolling updates actually work, what breaks in production. This section covers awareness-level depth for a lead who runs services on K8s but doesn't tune the control plane.

## Mental Model

Kubernetes is a **declarative, level-triggered reconciliation system**. You declare desired state (a YAML manifest). Controllers run in a loop comparing desired to actual, and take action to converge.

```d2
direction: right

desired: "Desired State\\n(YAML in etcd)"
actual: "Actual State\\n(running containers)"
controller: "Controller\\n(reconciliation loop)"
act: "Act\\n(create/delete/update)"

desired -> controller
actual -> controller
controller -> act
act -> actual
```

**Rule:** you don't tell Kubernetes what to do; you tell it what you want. It figures out how.

This is the same mental model as Kafka's controller, Spring's `@Scheduled`, or any operator pattern. Once you internalize it, every "how does K8s do X?" question answers itself: "some controller reconciles toward the declared state."

## What Kubernetes Is (and Isn't)

| It is | It isn't |
|---|---|
| Container orchestrator | A PaaS |
| Declarative config system | A deployment tool (that's Helm/Argo) |
| A cluster of nodes + control plane | A single machine |
| Extensible via CRDs | A platform for every workload |
| For stateless + stateful workloads | For long-running batch (that's Argo Workflows, Spark) |

## The Control Plane

```d2
direction: right

cp: Control Plane
api: "API Server\\n(entry point, validation)"
etcd: "etcd\\n(cluster state)"
sched: "Scheduler\\n(pick node for pod)"
cm: "Controller Manager\\n(reconciliation loops)"
nodes: Worker Nodes
kubelet: "kubelet\\n(runs pods)"
proxy: "kube-proxy\\n(service networking)"
runtime: "Container Runtime\\n(containerd)"

api -> etcd
sched -> api
cm -> api
api -> kubelet
kubelet -> runtime
kubelet -> proxy
```

| Component | Role |
|---|---|
| **API Server** | Front door; validates and persists to etcd |
| **etcd** | Distributed KV store; the source of truth |
| **Scheduler** | Assigns pods to nodes based on resources, affinity, taints |
| **Controller Manager** | Runs reconciliation loops (ReplicaSet, Deployment, Node, etc.) |
| **kubelet** | Node agent; runs pods, reports status |
| **kube-proxy** | Implements Service networking (iptables/IPVS) |
| **Container runtime** | containerd/CRI-O; runs containers |

**Rule:** if the API server is down, existing pods keep running but nothing changes. If etcd is lost, the cluster is lost (unless restored from backup).

## Worker Nodes

- **kubelet** — the node's agent. Gets pod specs, ensures containers run, reports status.
- **kube-proxy** — routes Service traffic (ClusterIP, NodePort, LoadBalancer).
- **Container runtime** — actually runs containers.
- **Pods** — the smallest deployable unit. One or more containers sharing network + storage.

```d2
direction: right

node: Node
pod1: "Pod A {\\n  app: App container\\n  sidecar: Sidecar\\n}"
pod2: "Pod B {\\n  app: App container"

node -> pod1
node -> pod2
```

## The Object Model

| Object | Purpose |
|---|---|
| **Pod** | One or more containers, shared network + volumes |
| **ReplicaSet** | Ensures N replicas of a pod |
| **Deployment** | Declarative rolling updates on top of ReplicaSets |
| **StatefulSet** | Stable identity + storage for stateful workloads |
| **DaemonSet** | One pod per node (log shippers, node agents) |
| **Job** | Run to completion |
| **CronJob** | Scheduled Job |
| **Service** | Stable virtual IP + DNS for a set of pods |
| **Ingress** | HTTP routing into the cluster |
| **ConfigMap** | Non-secret config |
| **Secret** | Sensitive config (base64, not encrypted by default) |
| **Namespace** | Logical isolation |
| **HPA / VPA** | Horizontal / vertical autoscaling |
| **PDB** | Pod Disruption Budget (min available during disruptions) |
| **NetworkPolicy** | Pod-level firewall |

**Rule:** Deployments for stateless, StatefulSets for stateful, DaemonSets for per-node, Jobs for one-shot.

## Pods and Lifecycle

```d2
direction: right

pending: "Pending\\n(scheduled, pulling image)"
running: "Running\\n(containers up)"
ready: "Ready\\n(passing readiness)"
terminating: "Terminating\\n(SIGTERM sent)"

pending -> running
running -> ready
ready -> terminating
```

States:
- **Pending** — accepted but not yet running (scheduling, image pull).
- **Running** — at least one container is up.
- **Succeeded / Failed** — for Jobs.
- **Unknown** — node communication lost.

**Graceful shutdown sequence:**
1. Pod marked for deletion.
2. Removed from Service endpoints (readiness fails).
3. `SIGTERM` sent to containers.
4. `terminationGracePeriodSeconds` (default 30s) to exit.
5. `SIGKILL` if still running.

**Rule:** your app must handle SIGTERM and finish in-flight work. Spring Boot's `server.shutdown=graceful` does this.

## Services and Networking

| Service type | Use |
|---|---|
| **ClusterIP** | Internal-only virtual IP (default) |
| **NodePort** | Exposes on each node's IP + port |
| **LoadBalancer** | Cloud LB in front |
| **ExternalName** | DNS CNAME to external service |
| **Headless** | No cluster IP; DNS returns pod IPs (for StatefulSets) |

```d2
direction: right

client: Client
svc: "Service\\n(ClusterIP)"
p1: Pod 1
p2: Pod 2
p3: Pod 3

client -> svc
svc -> p1
svc -> p2
svc -> p3
```

**Rule:** Services are load balancers over pods. Pod IPs are ephemeral; Service IPs are stable. Ingress is HTTP routing on top of Services.

## Scheduling

The scheduler picks a node based on:



- **Resource requests/limits** — CPU, memory.
- **Node selectors / node affinity** — "run on GPU nodes."
- **Pod affinity / anti-affinity** — "spread across AZs" or "co-locate."
- **Taints and tolerations** — "only dedicated workloads."
- **Topology spread constraints** — even distribution.

**Rule:** always set requests. Without them, the scheduler can't place pods well, and one greedy pod can starve a node.

## Autoscaling

| Type | Scales |
|---|---|
| **HPA** (Horizontal Pod Autoscaler) | Pod count based on CPU/memory/custom metrics |
| **VPA** (Vertical Pod Autoscaler) | Pod resource requests |
| **Cluster Autoscaler** | Node count |
| **KEDA** | Pod count based on external events (Kafka lag, queue depth) |

**Rules:**
- HPA needs **requests** set, or it can't calculate utilization.
- Scale on the **right metric** — CPU isn't always the bottleneck.
- Kafka consumers scale on **lag**, not CPU. Use KEDA.
- Cap max replicas to avoid runaway scaling.
- Cluster autoscaler adds nodes; HPA adds pods. Both are needed.

## Resource Management

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

| | Requests | Limits |
|---|---|---|
| Meaning | Guaranteed minimum | Hard ceiling |
| Used for | Scheduling | Throttling / OOM |
| CPU exceeded | Throttled | Throttled |
| Memory exceeded | (n/a) | OOMKilled |

**Rules:**
- **Requests = what you need; limits = what you'll accept.**
- **Never set CPU limit if you don't have to** — it causes throttling. Set requests.
- **Always set memory limits** to prevent node OOM.
- **Requests should be near actual usage**, not aspirational.
- **Right-size regularly** — VPA or manual review.

## Health Checks

| Probe | Purpose | On failure |
|---|---|---|
| **Liveness** | Is the pod alive? | Restart |
| **Readiness** | Can it serve traffic? | Remove from Service |
| **Startup** | Has it finished initializing? | Delay liveness/readiness checks |

**Rules:**
- **Liveness must be cheap** and not depend on downstreams.
- **Readiness can check critical dependencies.**
- **Startup probe** for slow-booting apps.
- **Fail readiness during shutdown** so traffic drains.

```yaml
livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8080 }
  periodSeconds: 5
  failureThreshold: 2
```

See [`microservices-patterns/observability.md`](../microservices-patterns/observability.md).

## Namespaces and Isolation

- **Namespaces** — logical grouping; not a security boundary.
- **RBAC** — who can do what.
- **NetworkPolicy** — pod-level firewall (allow/deny traffic).
- **ResourceQuota / LimitRange** — cap resources per namespace.
- **PodSecurity Standards** — baseline / restricted.

**Rule:** namespaces + RBAC + NetworkPolicy together provide isolation. Namespaces alone do not.

## Tricky Corners ⚠️

- **etcd is the source of truth.** Back it up. Losing it loses the cluster.
- **Pods are ephemeral.** Never store state in a pod's filesystem.
- **Pod IPs change.** Never hardcode them; use Services.
- **Requests vs limits** — requests schedule, limits throttle/OOM.
- **CPU limits cause throttling.** Prefer requests only for latency-sensitive workloads.
- **Memory limits cause OOMKilled.** Always set them.
- **Readiness failing during shutdown** is what drains traffic. Don't skip it.
- **`terminationGracePeriodSeconds` must exceed longest request.** Otherwise requests are killed.
- **StatefulSet pods are not interchangeable.** They have stable identity.
- **HPA needs requests and metrics.** Otherwise it can't scale.
- **Kafka consumers should scale on lag**, not CPU. Use KEDA.
- **PDBs prevent mass eviction** during node drains.
- **NetworkPolicy is deny-by-default only if applied** — otherwise all traffic is allowed.
- **Secrets are base64, not encrypted** at rest by default.

## Common Pitfalls

- No resource requests → scheduler can't place pods well.
- No memory limits → OOM a node.
- Liveness checking downstreams → cascading restarts.
- Readiness not failing during shutdown → dropped requests.
- Hardcoded pod IPs.
- Stateful workloads without StatefulSets.
- No PDBs → deployments drain all pods at once.
- Secrets in ConfigMaps.
- No NetworkPolicy → flat network.
- HPA without requests.
- Scaling Kafka consumers on CPU.
- No etcd backups.

## Key Interview Tips

- Lead with **"Kubernetes is a declarative reconciliation system; you declare desired state, controllers converge."**
- For "how does a pod get scheduled?", answer **"API server persists; scheduler picks node based on requests, affinity, taints; kubelet runs it."**
- For "what happens when a node fails?", answer **"pods are marked failed; controllers reschedule on healthy nodes; StatefulSet pods reattach to their volumes; PDBs prevent mass eviction during drains."**
- For "liveness vs readiness?", answer **"liveness = restart; readiness = remove from LB. Never check downstreams in liveness."**
- For "how do you do zero-downtime deploys?", answer **"rolling update + graceful shutdown + readiness + PDB + backward-compatible schema."**
- For "how do you scale Kafka consumers?", answer **"KEDA on consumer lag, not HPA on CPU."**
- Always mention **resource requests** and **etcd backups** as operational essentials.

## Related

- [Kubernetes Core Concepts](core-concepts.md)
- [Kubernetes Production Essentials](production-essentials.md)
- [Docker](../docker/index.md)
- [Observability](../observability/index.md)
- [Microservices Patterns → Deployment](../microservices-patterns/deployment.md)