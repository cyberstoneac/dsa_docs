# Kubernetes Core Concepts

> **Context:** This file goes deeper on the objects you'll actually use daily: Deployments, Services, Ingress, ConfigMaps, Secrets, StatefulSets, HPA. Awareness-level for a lead — enough to reason about production behavior, not to tune the control plane.

## Deployments

A Deployment manages ReplicaSets, which manage Pods. Rolling updates are the default.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels: { app: orders }
  template:
    metadata:
      labels: { app: orders }
    spec:
      containers:
        - name: orders
          image: registry/orders:1.4.2
          ports: [{ containerPort: 8080 }]
          resources:
            requests: { cpu: 500m, memory: 512Mi }
            limits:   { memory: 1Gi }
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8080 }
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
```

**Rules:**

- `maxUnavailable: 0` ensures capacity never drops.
- `maxSurge: 1` limits extra capacity.
- `minReadySeconds` adds a stability window before considering a pod ready.
- Rollback: `kubectl rollout undo deployment/orders`.

## Services

```yaml
apiVersion: v1
kind: Service
metadata:
  name: orders
spec:
  selector: { app: orders }
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

| Type | Use |
|---|---|
| ClusterIP | Internal only (default) |
| NodePort | Expose on node IP + port |
| LoadBalancer | Cloud LB |
| Headless | Direct pod DNS (StatefulSet) |

**Rule:** Services select pods by labels. Labels must match exactly.

## Ingress

HTTP routing into the cluster.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: orders
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: orders
                port: { number: 80 }
  tls:
    - hosts: [api.example.com]
      secretName: api-tls
```

**Rules:**

- Ingress = HTTP(S) routing; not for TCP/UDP (use LoadBalancer service).
- One Ingress controller per cluster (nginx, traefik, ALB).
- TLS termination at the Ingress.

## ConfigMaps and Secrets

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: orders-config }
data:
  LOG_LEVEL: INFO
  FEATURE_FLAG_X: "true"
```

```yaml
apiVersion: v1
kind: Secret
metadata: { name: orders-secrets }
type: Opaque
data:
  DB_PASSWORD: <base64>
```

**Rules:**

- ConfigMaps for non-sensitive config.
- Secrets are **base64**, not encrypted by default — enable etcd encryption at rest.
- For real secret management, use **External Secrets Operator** with Vault / cloud secret manager.
- Mount as env vars or volumes. Env vars are easier but not updated live; volumes are live.

## StatefulSets

For stateful workloads (databases, Kafka, Zookeeper).



- Stable network identity (`pod-0`, `pod-1`, ...).
- Stable storage (PVC per pod).
- Ordered rollout and scaling.
- Headless Service for DNS.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: kafka }
spec:
  serviceName: kafka-headless
  replicas: 3
  selector: { matchLabels: { app: kafka } }
  template:
    metadata: { labels: { app: kafka } }
    spec:
      containers:
        - name: kafka
          image: bitnami/kafka:3.7
          volumeMounts:
            - name: data
              mountPath: /bitnami/kafka
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOnce]
        resources: { requests: { storage: 100Gi } }
```

**Rules:**

- Use StatefulSet only when you need stable identity or storage.
- Pods are named `name-0`, `name-1`, ...
- Rollout is ordered (0 first, or reverse).
- Deletion of the StatefulSet does **not** delete PVCs (by default).

## Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: orders }
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

**Rules:**

- Requires **requests** set.
- Scale on the **right metric** (CPU is easy but not always right).
- For Kafka: use KEDA on consumer lag.
- `stabilizationWindowSeconds` prevents flapping.

## Vertical Pod Autoscaler

- Recommends or sets CPU/memory requests based on observed usage.
- Modes: Off (recommend only), Initial, Auto (restarts pods to apply).
- Useful for right-sizing; risky in Auto mode for latency-sensitive services.

## Pod Disruption Budget

Protects availability during voluntary disruptions (node drains, upgrades).

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: orders-pdb }
spec:
  minAvailable: 4
  selector: { matchLabels: { app: orders } }
```

**Rules:**

- Use `minAvailable` or `maxUnavailable`.
- Prevents eviction of all pods at once during a drain.
- Doesn't prevent node failures (those are involuntary).

## NetworkPolicy

Pod-level firewall.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: orders-allow }
spec:
  podSelector: { matchLabels: { app: orders } }
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector: { matchLabels: { app: gateway } }
      ports: [{ port: 8080 }]
  egress:
    - to:
        - podSelector: { matchLabels: { app: payments } }
```

**Rules:**

- Without a NetworkPolicy, all traffic is allowed.
- With a NetworkPolicy, only specified traffic is allowed for selected pods.
- Requires a CNI that supports policies (Calico, Cilium, Weave).

## Namespaces and RBAC

```yaml
apiVersion: v1
kind: Namespace
metadata: { name: orders }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { namespace: orders, name: orders-deployer }
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "update"]
```

**Rules:**

- Namespaces for grouping + RBAC + quotas.
- **Not a security boundary by themselves.** Combine with RBAC + NetworkPolicy.
- Use `Role`/`RoleBinding` for namespaced; `ClusterRole`/`ClusterRoleBinding` for cluster-wide.
- Avoid cluster-admin for services.

## Jobs and CronJobs

```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly-report }
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: registry/report:1.0
```

**Rules:**

- Jobs are one-shot; CronJobs are scheduled.
- `restartPolicy: OnFailure` retries failures.
- `concurrencyPolicy: Forbid` prevents overlapping runs.
- For complex workflows, use Argo Workflows instead.

## ConfigMap / Secret updates

- **Env-var mounted ConfigMaps/Secrets are not updated live** — pod restart needed.
- **Volume-mounted ConfigMaps/Secrets are updated** (eventually) — app must reload.
- For dynamic config, use Spring Cloud Config or a config service.

## Tricky Corners ⚠️

- **Deployments manage ReplicaSets, not pods directly.** Rolling updates create new ReplicaSets.
- **Service selector must match pod labels** exactly.
- **ClusterIP is internal.** External requires NodePort, LoadBalancer, or Ingress.
- **ConfigMap env-var mounts are not live.** Volume mounts are.
- **Secrets are base64, not encrypted.** Enable etcd encryption.
- **StatefulSet PVCs survive deletion** — clean up explicitly.
- **HPA needs requests and metrics.**
- **PDBs protect against voluntary disruptions only.**
- **NetworkPolicy requires a compatible CNI.**
- **Namespace is not a security boundary.**
- **Jobs need `restartPolicy: OnFailure` or `Never`** — `Always` is invalid.

## Common Pitfalls

- Missing resource requests.
- Missing memory limits.
- ConfigMap env vars not updating.
- Secrets in ConfigMaps.
- StatefulSet PVCs left behind.
- HPA without requests.
- No PDBs.
- No NetworkPolicy.
- Overly broad RBAC.
- Using StatefulSets for stateless workloads.
- Using Deployments for stateful workloads.

## Key Interview Tips

- Lead with **"Deployments for stateless, StatefulSets for stateful, DaemonSets for per-node, Jobs for one-shot."**
- For "how does a rolling update work?", answer **"new ReplicaSet created; pods shifted gradually; old ReplicaSet scaled down when new is healthy."**
- For "how do you drain a node safely?", answer **"cordon, drain, PDBs prevent mass eviction, workloads reschedule."**
- For "how do you do zero-downtime?", answer **"readiness probes + graceful shutdown + PDB + backward-compatible schema."**
- For "how do you autoscale Kafka consumers?", answer **"KEDA on consumer lag, not HPA on CPU."**
- Always mention **resource requests**, **PDBs**, and **NetworkPolicy** as production essentials.

## Related

- [Kubernetes index](index.md)
- [Kubernetes Production Essentials](production-essentials.md)
- [Docker](../docker/index.md)
- [Observability](../observability/index.md)