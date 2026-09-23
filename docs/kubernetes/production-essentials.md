# Kubernetes Production Essentials

> **Context:** Running Kubernetes in production is a different skill from writing manifests. This file covers what a lead needs to know: deployments, upgrades, secrets, observability, cost, and failure modes.

## The Production Checklist

```d2
direction: right

prod: "Production K8s {\\n  reliability: Reliability\\n  security: Security\\n  observability: Observability\\n  cost: Cost\\n  upgrades: Upgrades"

reliability -> security
security -> observability
observability -> cost
cost -> upgrades
```

### Reliability

- [ ] All workloads have resource requests and memory limits.
- [ ] All workloads have readiness and liveness probes.
- [ ] All workloads have PDBs.
- [ ] Graceful shutdown configured (`terminationGracePeriodSeconds`, `server.shutdown=graceful`).
- [ ] Pod anti-affinity spreads across AZs.
- [ ] Multi-AZ node groups.
- [ ] Rolling updates with `maxUnavailable: 0`.
- [ ] etcd backed up (managed clusters do this; verify).
- [ ] Cluster autoscaler configured.
- [ ] Node drain tested.

### Security

- [ ] RBAC least-privilege; no cluster-admin for services.
- [ ] NetworkPolicy deny-by-default, allow explicitly.
- [ ] PodSecurity Standards `restricted`.
- [ ] Non-root containers (`runAsNonRoot: true`).
- [ ] Read-only root filesystem where possible.
- [ ] Secrets via External Secrets Operator, not base64 in git.
- [ ] etcd encryption at rest enabled.
- [ ] Image scanning in CI (Trivy, Snyk).
- [ ] No `latest` tags; pin digests.
- [ ] Audit logging enabled.

### Observability

- [ ] Metrics from all workloads (Prometheus scrape).
- [ ] Structured logs with correlation IDs.
- [ ] Distributed tracing with sampling.
- [ ] Cluster-level dashboards (node, pod, deployment).
- [ ] Alerts on SLO burn rate, not just resource thresholds.
- [ ] Pod restart alerts.
- [ ] OOMKilled alerts.
- [ ] Node pressure alerts.

### Cost

- [ ] Right-sized requests (VPA recommendations).
- [ ] Spot instances for stateless workloads.
- [ ] Cluster autoscaler with scale-down.
- [ ] Namespace quotas to prevent runaway.
- [ ] Idle workload detection.
- [ ] Storage class lifecycle (delete unused PVCs).
- [ ] Reserved capacity for steady state.
- [ ] $/request tracked, not just total spend.

### Upgrades

- [ ] Kubernetes version upgrade plan (quarterly).
- [ ] Node image updates.
- [ ] Deprecated API usage tracked (`kubectl api-resources`).
- [ ] Add-on version management (Ingress, CNI, CSI).
- [ ] Test upgrades in staging first.
- [ ] PDBs to protect during node drains.

## Deployment Patterns

### Rolling Update

Standard for stateless workloads.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
minReadySeconds: 10
```

### Blue-Green

Two Deployments, one Service. Flip the Service selector.

```d2
direction: right

svc: Service
blue: Deployment blue
green: Deployment green

svc -> blue
svc -> green
```

### Canary

Use Argo Rollouts or Flagger for weighted canary.

```yaml
strategy:
  canary:
    steps:
      - setWeight: 10
      - pause: { duration: 5m }
      - setWeight: 50
      - pause: { duration: 10m }
      - setWeight: 100
    analysis:
      templates:
        - templateName: success-rate
```

## Secrets Management

**Base64 ≠ encryption.** K8s Secrets are base64 by default.

Options:
1. **etcd encryption at rest** — must be enabled explicitly.
2. **External Secrets Operator** — sync from Vault / AWS Secrets Manager.
3. **Sealed Secrets** — encrypted in git, decrypted in cluster.
4. **CSI Secrets Store** — mount secrets from cloud providers directly.

**Rules:**
- Never commit secrets to git.
- Rotate credentials.
- Scope secrets per namespace/service.
- Audit secret access.

## Observability Stack

```d2
direction: right

app: Workloads
prom: "Prometheus\\n(scrape metrics)"
loki: "Loki\\n(logs)"
tempo: "Tempo\\n(traces)"
grafana: "Grafana\\n(dashboards)"
alerts: Alertmanager

app -> prom
app -> loki
app -> tempo
prom -> grafana
loki -> grafana
tempo -> grafana
grafana -> alerts
```

**Rules:**
- Prometheus scrape via ServiceMonitor (Prometheus Operator).
- Logs via Fluent Bit / Promtail → Loki.
- Traces via OTLP → Tempo / Jaeger.
- Alerts on SLO burn rate, not raw CPU.

## Resource Management

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    memory: 1Gi
```

**Rules:**
- Requests for scheduling.
- Memory limits to prevent OOM.
- Avoid CPU limits for latency-sensitive workloads (throttling).
- Right-size with VPA recommendations.
- Set namespace ResourceQuotas to prevent runaway.

## Autoscaling

- **HPA** for pods (CPU, memory, custom metrics).
- **KEDA** for event-driven (Kafka lag, queue depth, cron).
- **Cluster Autoscaler** for nodes.
- **VPA** for right-sizing requests.

**Kafka consumers:** scale on **lag**, not CPU.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: orders-consumer }
spec:
  scaleTargetRef: { name: orders-consumer }
  minReplicaCount: 2
  maxReplicaCount: 30
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        consumerGroup: orders-svc
        topic: orders
        lagThreshold: "1000"
```

## High Availability

- **Multi-AZ node groups** for node failures.
- **Pod anti-affinity** to spread replicas.
- **Topology spread constraints** for even distribution.
- **PDBs** to protect during drains.
- **PodDisruptionBudget** example:
  ```yaml
  spec:
    minAvailable: 4
    selector: { matchLabels: { app: orders } }
  ```

## Multi-Region

At lead level, know the options:

| Pattern | Complexity | Failover |
|---|---|---|
| Single region | Low | N/A |
| Active-passive | Medium | Minutes |
| Active-active | High | Seconds |

**Rules:**
- Active-passive is the default.
- Active-active requires conflict resolution and per-region data residency.
- Most apps start with single-region + multi-AZ.

## Cost Optimization

| Lever | Savings |
|---|---|
| Right-size requests (VPA) | 20–40% |
| Spot instances | 60–80% (stateless) |
| Reserved capacity | 30–50% |
| Cluster autoscaler | 20–40% |
| Namespace quotas | Prevents runaway |
| Storage lifecycle | Delete unused PVCs |
| Vertical scaling before horizontal | Cheaper for small workloads |

**Rule:** track **$/request** and **$/service**, not just total spend.

## Failure Modes

| Failure | Effect | Mitigation |
|---|---|---|
| Node failure | Pods rescheduled | Multi-AZ, PDBs |
| Control plane failure | No new changes; existing pods run | Managed K8s, HA control plane |
| etcd loss | Cluster lost | Backups, managed K8s |
| Image pull failure | Pod stuck pending | Registry HA, image pull secrets |
| OOMKilled | Pod restarts | Memory limits + right-size |
| CrashLoopBackOff | Pod restarts repeatedly | Fix liveness, check logs |
| Resource exhaustion | Pods pending | Cluster autoscaler, quotas |
| Network policy misconfig | Traffic blocked | Test policies in staging |
| Secret rotation | Pods with stale secrets | Volume mounts, reload strategy |

## Tricky Corners ⚠️

- **etcd is the source of truth.** Back it up (or verify your managed K8s does).
- **Secrets are base64, not encrypted.**
- **Liveness checking downstreams = cascading restarts.**
- **No PDBs = all pods drained at once.**
- **No NetworkPolicy = flat network.**
- **CPU limits cause throttling** — set requests only for latency-sensitive.
- **Memory limits cause OOMKilled** — set them.
- **HPA without requests doesn't work.**
- **Kafka consumers need KEDA on lag**, not HPA on CPU.
- **`latest` tags break reproducibility.**
- **PVCs survive StatefulSet deletion** — clean up.
- **ConfigMap env-var mounts don't update live.**
- **Node upgrades need PDBs to protect.**
- **Cluster autoscaler doesn't help if PDBs block scheduling.**

## Common Pitfalls

- No resource requests.
- No memory limits.
- No PDBs.
- No NetworkPolicy.
- Secrets in git.
- `latest` image tags.
- Cluster-admin for services.
- No etcd backups.
- HPA on CPU for Kafka consumers.
- No cost visibility.
- No upgrade plan.
- No multi-AZ.

## Key Interview Tips

- Lead with **"production K8s is about reliability, security, observability, cost, and upgrades — not YAML."**
- For "how do you make K8s production-ready?", walk the checklist: **requests/limits, probes, PDBs, NetworkPolicy, RBAC, secrets, observability, cost.**
- For "how do you do zero-downtime deploys?", answer **"rolling update + graceful shutdown + readiness + PDB + backward-compatible schema."**
- For "how do you manage secrets?", answer **"External Secrets Operator + Vault or cloud secret manager; enable etcd encryption; never base64 in git."**
- For "how do you autoscale Kafka consumers?", answer **"KEDA on consumer lag, not HPA on CPU."**
- For "how do you handle node failures?", answer **"multi-AZ, pod anti-affinity, PDBs, cluster autoscaler."**
- For "how do you optimize cost?", answer **"right-size, spot for stateless, cluster autoscaler, track $/request."**
- Always mention **etcd backups** — it's the mark of a production-minded engineer.

## Related

- [Kubernetes index](index.md)
- [Kubernetes Core Concepts](core-concepts.md)
- [Docker](../docker/index.md)
- [Observability](../observability/index.md)
- [Microservices Patterns → Deployment](../microservices-patterns/deployment.md)