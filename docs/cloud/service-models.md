# Cloud Service Models

> **Spring context:** Spring Boot 3.x deployable as IaaS VM, PaaS app, container on CaaS, or function on FaaS. Same code, different operational surface. This file is about *responsibility boundaries* and *when to choose which*.

## Mental Model

The service models describe **who manages what**. The higher up the stack you go, the more the provider manages and the less control you have.

```d2
direction: up

iaas: "IaaS\nVMs, network, storage"
paas: "PaaS\nruntime, app server"
caas: "CaaS\ncontainers, orchestration"
faas: "FaaS\nfunctions, event-driven"
saas: "SaaS\nfully managed app"

iaas -> paas: "provider takes more"
paas -> caas: "provider takes more"
caas -> faas: "provider takes more"
faas -> saas: "provider takes more"
```

**Key insight:** every step up trades **control** for **convenience**. The right choice depends on what your team can uniquely own and where the provider's leverage is real.

## The Responsibility Matrix

For a typical JVM service:

| Layer | On-Prem | IaaS | CaaS | PaaS | FaaS | SaaS |
|---|---|---|---|---|---|---|
| Application code | You | You | You | You | You | Provider |
| Runtime (JVM) | You | You | You | Provider | Provider | Provider |
| Container / packaging | You | You | You | Provider | Provider | Provider |
| OS patching | You | You | Provider | Provider | Provider | Provider |
| Virtualization | You | Provider | Provider | Provider | Provider | Provider |
| Servers / hardware | You | Provider | Provider | Provider | Provider | Provider |
| Network / datacenter | You | Provider | Provider | Provider | Provider | Provider |

**Reading the matrix:** as you move right, the provider absorbs more operational work. Your job shrinks to *application code plus configuration*.

## IaaS — Infrastructure as a Service

You rent **virtual machines, networks, and storage**; you manage everything above the hypervisor.

**Examples (awareness level):** AWS EC2, GCP Compute Engine, Azure VMs, DigitalOcean Droplets.

**What the provider manages:** physical hosts, hypervisor, network fabric, storage hardware.

**What you manage:** OS patching, runtime, app server, deployment, scaling, security, backups, monitoring.

**Pros**
- Maximum control — kernel tuning, custom OS, exotic runtimes.
- Lift-and-shift friendly — existing VMs move in unchanged.
- Predictable cost for steady-state workloads (especially with reservations).
- No vendor-specific runtime semantics.

**Cons**
- Highest operational burden of the managed models.
- Scaling, patching, and HA are your problem.
- Security baseline is on you (CIS hardening, patching cadence).
- Slower to adopt new capabilities.

**When to use**
- Legacy applications that can't be containerized yet.
- Specialized workloads needing kernel modules, GPU drivers, or specific OSes.
- Compliance regimes requiring full control of the host.
- Steady, predictable load where reserved instances are cheapest.

## PaaS — Platform as a Service

You deploy an **application artifact** (jar, war, zip); the provider runs and scales it.

**Examples:** Heroku, AWS Elastic Beanstalk, Google App Engine, Azure App Service, Red Hat OpenShift (as a managed platform).

**What the provider manages:** OS, runtime, app server, scaling, load balancing, TLS termination, health checks.

**What you manage:** application code and its configuration.

**Pros**
- Fastest path from code to running service.
- Built-in scaling, health checks, and TLS.
- Minimal operational burden.
- Built-in add-ons (databases, queues, caches) with a few clicks.

**Cons**
- Limited control over runtime and OS.
- Opinionated — some frameworks and configurations don't fit.
- Cost can be higher per unit of compute than IaaS.
- Migration between PaaS providers is not trivial.

**When to use**
- Standard web applications with conventional deployment needs.
- Teams without dedicated platform engineering.
- Rapid prototyping and small-to-medium production workloads.
- The default when you don't have a specific reason to go lower.

## CaaS — Containers as a Service

You deploy **container images**; the provider runs the orchestration platform (Kubernetes or equivalent).

**Examples:** AWS EKS/ECS, GCP GKE, Azure AKS, managed Kubernetes offerings.

**What the provider manages:** control plane, worker node OS, orchestration, network fabric.

**What you manage:** images, deployments, service definitions, autoscaling policies, ingress, secrets, observability configuration.

**Pros**
- Best balance of control and convenience for microservices.
- Portability — Kubernetes runs anywhere.
- Rich ecosystem (Helm, operators, service mesh, policy engines).
- Fine-grained resource control and autoscaling.

**Cons**
- Kubernetes complexity — a nontrivial learning curve.
- You own more than you think: ingress, cert management, secrets, RBAC.
- Cost of running the control plane (or managing it yourself) is real.
- Easy to over-engineer for a small app.

**When to use**
- Microservices architectures.
- Multi-service platforms needing shared ingress, service mesh, and policy.
- Teams with platform engineering capability, or willing to build it.
- Anywhere portability and fine-grained control matter.

## FaaS — Functions as a Service

You deploy **functions** (single-purpose handlers); the provider runs them on events, scaling to zero.

**Examples:** AWS Lambda, GCP Cloud Functions, Azure Functions, Cloudflare Workers.

**What the provider manages:** everything except the function code and its config.

**What you manage:** the function, its triggers, and its dependencies.

**Pros**
- True pay-per-invocation — scale to zero when idle.
- No server management at all.
- Naturally event-driven — S3 events, queue messages, HTTP, schedules.
- Instant scaling for spiky workloads.

**Cons**
- **Cold starts** are real — JVM FaaS can have 1–3 s cold starts without mitigations.
- Execution time limits (typically 15 minutes max).
- Stateless by design — no local state between invocations.
- Debugging and local development are harder.
- Vendor lock-in — event sources and runtime are provider-specific.
- Cost can explode under sustained load versus containers or VMs.

**When to use**
- Event-driven workloads: file processing, webhooks, scheduled tasks.
- Spiky traffic with long idle periods.
- Glue code between managed services.
- **Not** for sustained high-throughput request/response services — cost and cold starts dominate.

**JVM-specific tips**
- **SnapStart** (Lambda) or provisioned concurrency reduces cold starts.
- **GraalVM native image** boots in tens of milliseconds — good fit for FaaS.
- Keep the handler light; heavy frameworks (full Spring Boot) cost cold-start time.
- Spring Cloud Function + `spring-cloud-function-adapter-aws` lets you write functions with Spring idioms.

## SaaS — Software as a Service

You consume a **fully managed application**; the provider runs everything.

**Examples:** Salesforce, Workday, GitHub, Slack, Datadog, PagerDuty.

**What the provider manages:** everything — app, data model, upgrades, availability.

**What you manage:** your data and configuration within the product.

**Pros**
- No infrastructure, no code, no operations.
- Fast to adopt, predictable subscription cost.
- Provider handles upgrades, security, and compliance certifications.

**Cons**
- Limited customization — you fit the product's model.
- Data lives in the provider's environment (residency and sovereignty questions).
- Integration surfaces are what the provider exposes.
- Price scales with seats/usage; can become expensive.

**When to use**
- Non-differentiating capabilities — CRM, HR, monitoring, CI/CD.
- Anything where building it yourself is a distraction from your core product.
- Small teams that can't run their own version of the tool.

## Choosing a Model

Decision heuristics:

| Situation | Model |
|---|---|
| Standard web app, small team, no special requirements | **PaaS** |
| Microservices platform, need portability | **CaaS** |
| Legacy VM workload not yet containerized | **IaaS** |
| Event-driven glue, spiky traffic, scale-to-zero | **FaaS** |
| Non-differentiating capability (CRM, monitoring) | **SaaS** |
| Extremely steady, high-volume compute | **IaaS** (with reservations) |
| Global, low-latency edge compute | **FaaS at the edge** (Cloudflare Workers, Lambda@Edge) |

**Rule:** start one level above what you think you need. It's easier to move down (more control) than up (less operational burden).

## Total Cost of Ownership

The cheapest invoice is rarely the cheapest system. TCO includes:

- **Compute** — instance hours, vCPU-hours, invocations.
- **Storage** — GB-months, IOPS, requests.
- **Network** — egress, cross-AZ, cross-region.
- **Managed services** — databases, queues, caches, logging.
- **Operational cost** — SRE time, on-call, tooling, training.
- **Engineering cost** — time spent building what a managed service would give you.
- **Opportunity cost** — features you didn't ship because you were maintaining infrastructure.

**Comparison example (order of magnitude)**

| Model | Monthly cost for a modest API | Operational burden |
|---|---|---|
| IaaS (2 VMs + LB + RDS) | Low compute, medium ops | High — patching, scaling, monitoring |
| CaaS (K8s + nodes + managed DB) | Medium compute, medium ops | Medium — cluster ops, ingress, secrets |
| PaaS (App Service + managed DB) | Medium compute, low ops | Low |
| FaaS (Lambda + DynamoDB) | Very low at idle, can be high at load | Very low |

At low traffic, FaaS wins on cost. At sustained high traffic, IaaS or CaaS wins. PaaS sits in the middle with low operational burden.

**Hidden cost traps**
- **Egress** — biggest surprise on cloud bills.
- **Log volume** — verbose logs at scale are expensive to ingest and store.
- **Idle resources** — orphaned volumes, unused load balancers, forgotten environments.
- **Cross-AZ chatter** — chatty services spread across AZs pay per GB.

## Lock-In Trade-offs

| Model | Lock-in risk | Mitigation |
|---|---|---|
| IaaS | Low | Standard OS, standard tooling |
| CaaS | Low | Kubernetes is portable; avoid provider-specific CRDs where possible |
| PaaS | Medium | Heroic effort to migrate; abstraction layer helps |
| FaaS | High | Runtime APIs, event sources, and cold-start behaviour are provider-specific |
| SaaS | High | Data export formats, APIs; the product's model is the lock-in |

**Practical strategy**

- **Portable by default** for compute (containers, Kubernetes).
- **Accept lock-in** for services where the provider's leverage is real (managed databases, managed identity).
- **Hexagonal architecture** — provider-specific code in adapters, not in the domain.
- **Data as the escape hatch** — use open formats (Parquet, Avro, Protobuf), not proprietary storage engines for anything you might need to move.

## Tricky Corners ⚠️

- **CaaS ≠ PaaS.** Managed Kubernetes is not Heroku. You still own ingress, secrets, RBAC, and scaling policies.
- **Serverless is not free at scale.** Lambda under sustained high traffic is often more expensive than containers or VMs. Model both.
- **Cold starts are workload-dependent.** A JVM Lambda with Spring Boot cold-starts in seconds. A GraalVM native function boots in milliseconds.
- **FaaS execution limits** (15 min on Lambda) shape design. Long-running batch jobs need a different model.
- **PaaS cost scales super-linearly** with instance size in some providers. Watch the pricing curve.
- **SaaS "free tier"** disappears fast at scale. Model the pricing tier you'll actually be in.
- **Managed Kubernetes** still requires Kubernetes expertise. The control plane is free; the operational burden is not.
- **Egress from FaaS to a VPC** can be surprising — cross-AZ and NAT Gateway charges add up.
- **Multi-model is normal.** A realistic architecture uses CaaS for services, FaaS for glue, SaaS for CRM, and IaaS for a legacy workload. One size does not fit all.

## Common Pitfalls

- Choosing FaaS because it's trendy, then discovering cold starts kill the p99.
- Choosing Kubernetes for a single small service — massive over-engineering.
- Assuming PaaS is always cheapest — it's cheapest at low-to-medium scale.
- Ignoring egress until the first big invoice.
- Building a database when a managed service would do.
- Using IaaS when PaaS would have run the same app with far less operational burden.
- Letting a legacy VM linger "just in case" — pay for it every month.
- Treating SaaS as free of lock-in — the data model is the lock-in.
- Over-abstracting for portability when the provider's leverage was the point.

## Key Interview Tips

- **Define each model in one sentence**, then move to trade-offs.
- **The responsibility matrix is the vocabulary.** Who patches the OS? Who scales? Who monitors?
- **Give the "start one level above" heuristic.** It shows judgement.
- **FaaS is not universally cheaper.** Say "under sustained load, cost crosses over to containers".
- **Cold starts for JVM FaaS** — know SnapStart and GraalVM native image.
- **Multi-model architecture is normal.** Real systems mix CaaS, FaaS, SaaS, and managed services.
- **TCO includes operations, not just the invoice.** Senior interviewers want this.
- **Lock-in trade-offs** — name one where you'd accept lock-in (managed DB) and one where you'd avoid it (event sources).
- **Kubernetes is CaaS, not PaaS.** Common conflation.
- **Link to twelve-factor** — the app-side principles don't change across service models.

## Related

- [Cloud-Native Foundations](index.md)
- [Twelve-Factor App](../architecture/twelve-factor-app.md)
- [Microservices Deployment](../microservices-patterns/deployment.md)
- [Infrastructure — Kubernetes](../kubernetes/index.md)
- [Infrastructure — Docker](../docker/index.md)