# Service Discovery

> **Spring context:** Spring Cloud 2022.x/2023.x with Netflix Eureka (still
> widely used) or Consul. Spring Cloud Netflix Eureka entered maintenance
> mode, but Eureka itself is stable and supported. Focus is on the
> **concept** and how Spring integrates.

## Mental Model

In a microservices world, service instances come and go. Their IPs and ports
change. **Service discovery** solves "how does service A find service B?"

```d2
direction: right

without: "Without Discovery" {
  style.fill: "#ffcdd2"
  svcA: "Service A" {
    style.fill: "#ef9a9a"
  }
  cfg: "Hardcoded URLs\n(user-svc:8080)" {
    style.fill: "#ef9a9a"
  }
  svcB: "Service B" {
    style.fill: "#ef9a9a"
  }
  svcA.cfg -> cfg: ""
  cfg.svcB -> svcB: "❌ breaks on scale/restart"
}

with: "With Discovery" {
  style.fill: "#c8e6c9"
  svcA2: "Service A" {
    style.fill: "#a5d6a7"
  }
  registry: "Service Registry\n(Eureka)" {
    style.fill: "#81c784"
  }
  svcB2: "Service B\n(instance 1..N)" {
    style.fill: "#a5d6a7"
  }
  svcA2.registry -> registry: "1. lookup B"
  registry.svcB2 -> svcB2: "2. get instances"
  svcA2.svcB2 -> svcB2: "3. call one"
}
```

**Key idea:** services register themselves; clients look up instances
dynamically. No hardcoded URLs.

---

## Client-Side vs Server-Side Discovery

### Client-side discovery (Eureka)

- Client queries the registry and picks an instance
- Client-side load balancing (Ribbon, Spring Cloud LoadBalancer)
- Used by Netflix Eureka

### Server-side discovery (AWS ALB, Kubernetes)

- Client calls a stable hostname
- Load balancer / kube-proxy routes to a healthy instance
- Client doesn't know about individual instances

**Interview line:** *"Eureka is client-side discovery; Kubernetes Services
are server-side."*

---

## Eureka Architecture

```d2
direction: right

svcA: "Service A\n(client)" {
  style.fill: "#bbdefb"
}
eureka1: "Eureka Server 1" {
  style.fill: "#c8e6c9"
}
eureka2: "Eureka Server 2" {
  style.fill: "#a5d6a7"
}
svcB1: "Service B\ninstance 1" {
  style.fill: "#fff9c4"
}
svcB2: "Service B\ninstance 2" {
  style.fill: "#ffe0b2"
}

svcA.eureka1 -> eureka1: "lookup"
eureka1.svcB1 -> svcB1: "return instance"
svcB1.eureka1 -> eureka1: "register + heartbeat"
svcB2.eureka1 -> eureka1: "register + heartbeat"
eureka1.eureka2 -> eureka2: "replicate"
```

### Key behaviors

| Mechanism | Purpose |
|---|---|
| **Register** | Service announces itself to Eureka at startup |
| **Heartbeat** | Service sends periodic "I'm alive" (default every 30s) |
| **Eviction** | If heartbeats stop for 90s, Eureka removes the instance |
| **Fetch registry** | Clients periodically fetch the list of instances (default every 30s) |
| **Replication** | Eureka servers sync state with each other |

### Self-preservation mode

If Eureka loses too many heartbeats (network partition, or too many services
dying at once), it **stops evicting instances** to avoid wrongly removing
healthy services.

**Trade-off:** stale instances may be returned. In dev, this can cause
"phantom" registrations — restart often.

**Interview line:** *"Self-preservation means Eureka prefers stale data over
evicting everything on a network hiccup."*

---

## Setting Up Eureka Server

### Dependencies

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
</dependency>
```

### Server application

```java
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
```

### `application.yml`

```yaml
server:
  port: 8761

eureka:
  client:
    register-with-eureka: false    # server doesn't register with itself
    fetch-registry: false
  server:
    enable-self-preservation: false   # dev only
```

Dashboard at `http://localhost:8761`.

---

## Setting Up a Eureka Client

### Dependencies

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

### Application

```java
@SpringBootApplication
@EnableDiscoveryClient   // optional in newer Spring Cloud
public class UserServiceApplication { }
```

### `application.yml`

```yaml
spring:
  application:
    name: user-service

eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
  instance:
    prefer-ip-address: true
    lease-renewal-interval-in-seconds: 30
    lease-expiration-duration-in-seconds: 90
```

The `spring.application.name` is the identifier other services use to find
this one.

---

## Discovering Services — Three Ways

### 1. `DiscoveryClient` — low-level

```java
@Service
public class UserClient {
    private final DiscoveryClient discoveryClient;

    public UserClient(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    public User getUser(long id) {
        List<ServiceInstance> instances =
                discoveryClient.getInstances("user-service");

        ServiceInstance instance = instances.get(0);
        String url = instance.getUri() + "/users/" + id;

        return restTemplate.getForObject(url, User.class);
    }
}
```

**Rarely used directly** — you'd have to implement load balancing yourself.

### 2. `RestTemplate` + `@LoadBalanced` — classic

```java
@Configuration
public class RestTemplateConfig {
    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
```

```java
@Service
public class UserClient {
    private final RestTemplate restTemplate;

    public UserClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public User getUser(long id) {
        // "user-service" is the service name registered in Eureka
        return restTemplate.getForObject(
                "http://user-service/users/{id}",
                User.class, id);
    }
}
```

**The magic:** `@LoadBalanced` makes `RestTemplate` resolve `user-service` to
an actual instance via the registry and load balance across instances.

### 3. Feign — declarative (recommended)

```java
@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/users/{id}")
    User getUser(@PathVariable long id);
}
```

**Feign integrates with Eureka automatically.** Covered in
[Feign & Tracing](feign-and-tracing.md).

---

## Load Balancing

Spring Cloud LoadBalancer (replaces Ribbon, which is deprecated).

### Default strategy

Round-robin across healthy instances.

### Custom strategy

```java
@Configuration
public class LoadBalancerConfig {

    @Bean
    public ReactorLoadBalancer<ServiceInstance> randomLoadBalancer(
            Environment env,
            LoadBalancerClientFactory factory) {
        String name = env.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
        return new RandomLoadBalancer(
                factory.getLazyProvider(name, ServiceInstanceListSupplier.class),
                name);
    }
}
```

### Per-client config

```java
@FeignClient(name = "user-service", configuration = UserClientConfig.class)
public interface UserClient { ... }
```

---

## Consul — The Alternative

HashiCorp Consul provides service discovery + KV store + health checks +
service mesh.

### Comparison

| | Eureka | Consul |
|---|---|---|
| Type | AP (self-preservation) | CP (strong consistency) |
| Health check | Heartbeat | Active HTTP/TCP/gRPC probes |
| Multi-datacenter | Limited | ✅ native |
| KV store | ❌ | ✅ |
| Maturity | Very stable (Netflix) | Modern |

### Spring Cloud Consul setup

```yaml
spring:
  cloud:
    consul:
      host: localhost
      port: 8500
      discovery:
        service-name: user-service
```

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-consul-discovery</artifactId>
</dependency>
```

**Interview line:** *"Consul is CP with active health checks and a KV store;
Eureka is AP with heartbeats."*

---

## Kubernetes Services — The Modern Default

If you're on Kubernetes, you may not need Eureka at all. K8s Services provide
server-side discovery natively:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 80
      targetPort: 8080
```

Other services just call `http://user-service/users/1`. No registry client
needed.

**When to still use Spring Cloud Discovery:**
- Multi-cluster / hybrid cloud
- Non-Kubernetes deployments
- Need for client-side load balancing

---

## Health Checks

Eureka relies on heartbeats, not HTTP health. To integrate Spring Boot
Actuator health:

```yaml
eureka:
  client:
    healthcheck:
      enabled: true
```

Now Eureka checks `/actuator/health` before considering the instance healthy.

**Interview line:** *"Eureka uses heartbeats by default; you can enable
Actuator-based health checks for finer control."*

---

## Instance Metadata

Register custom metadata with an instance:

```yaml
eureka:
  instance:
    metadata-map:
      zone: us-east-1a
      version: v2
```

Consumers can read it via `ServiceInstance.getMetadata()`.

**Use case:** zone-aware routing, canary deployments.

---

## Service-to-Service Communication Patterns

### Synchronous

- `RestTemplate` + `@LoadBalanced`
- `WebClient` (reactive)
- Feign

### Asynchronous

- Message queues (Kafka, RabbitMQ)
- Events (Spring Cloud Stream)

### Best practices

| Practice | Reason |
|---|---|
| Timeouts on every call | Don't block forever |
| Circuit breaker per dependency | Isolate failures |
| Retry with backoff | Handle transient failures |
| Bulkheads | Limit concurrent calls |
| Tracing | Follow requests across services |

See [Circuit Breaker](circuit-breaker.md) and [Feign & Tracing](feign-and-tracing.md).

---

## Tricky Corners ⚠️

**Eureka is AP, not CP.** During partitions, it prefers availability over
consistency — you may get stale instances.

**Self-preservation can cause "ghost" instances** in dev if a service
crashes without deregistering.

**Deregistration on shutdown is not guaranteed.** If the JVM is killed
(`kill -9`), Eureka won't know until the lease expires (90s default).

**`@LoadBalanced` only works on beans Spring manages.** A manually
instantiated `RestTemplate` won't resolve service names.

**`RestTemplate` is deprecated in favor of `WebClient`.** `RestTemplate`
still works but isn't getting new features.

**`spring.application.name` is required.** Without it, the service registers
under `application` and other services can't find it.

**Multiple instances share the same service name.** That's the point — the
name identifies the service, not the instance.

**Heartbeat intervals affect failover speed.** Lower → faster detection, more
network traffic. Higher → slower detection, less chatter.

**`eureka.client.fetch-registry=true` is required** for clients to see other
services.

**Eureka server should run in a cluster** (2–3 nodes) for production. A
single server is a SPOF.

**Zone-aware routing requires zone configuration** in both provider and
consumer.

**Kubernetes DNS makes Eureka often unnecessary.** Don't add Eureka just
because "microservices."

**Consul's strong consistency** can cause temporary unavailability during
leader elections — the opposite trade-off from Eureka.

**Health check endpoints must be exposed** if Actuator-based checks are
enabled.

**Metadata is per-instance, not per-service.** Don't rely on it for
configuration.

---

## Common Pitfalls

- Hardcoding service URLs while also using Eureka.
- Missing `spring.application.name`.
- Not setting `prefer-ip-address` in containers (hostnames may not resolve).
- Running a single Eureka server in production.
- Forgetting to disable self-preservation in dev.
- Assuming deregistration happens instantly on shutdown.
- Using Eureka on Kubernetes without a reason.
- Not setting timeouts on `RestTemplate`/Feign clients.

---

## Key Interview Tips

- Explain **client-side vs server-side discovery** in one sentence.
- Say **"Eureka is AP; Consul is CP."**
- Explain **self-preservation** — the trade-off it makes.
- Know the three ways to consume services: `DiscoveryClient`,
  `@LoadBalanced`, Feign.
- Say **"Kubernetes Services are the modern default for discovery."**
- Mention **heartbeats vs Actuator health checks**.
- Know **`spring.application.name` identifies the service**.

---

## Related

- [API Gateway](api-gateway.md) — routing to discovered services
- [Circuit Breaker](circuit-breaker.md) — resilience for service calls
- [Feign & Tracing](feign-and-tracing.md) — declarative clients and tracing
- [Config Server](config-server.md) — externalized configuration