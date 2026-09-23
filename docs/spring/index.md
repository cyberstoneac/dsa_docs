# 🌱 Spring Framework — Interview Revision

A concept-dense **Spring** reference for engineers preparing for Java backend
interviews. Covers **19 deep-dive documents** across Spring Core, AOP,
Transactions, Spring Boot, Spring Data JPA, Security, MVC, and Microservices.

Every document follows the same shape:

- **Mental model** — intuition first
- **Internals** — how Spring actually wires things
- **Tricky corners** — the edge cases interviewers love
- **Common pitfalls** and **Key interview tips** at the bottom

[🏠 Home](../index.md){ .md-button }
[☕ Core Java](../java/index.md){ .md-button }
[🏛️ System Design](../system-design/index.md){ .md-button }

---

## 🗺️ How This Section Is Organized

```d2
direction: down

root: Spring Framework {
  style.fill: "#e8f5e9"
  style.stroke: "#2e7d32"

  core: Core {
    style.fill: "#c8e6c9"
    ioc: IoC & DI
    bean: Bean Lifecycle
    circ: Circular Dependencies
  }

  aop: AOP {
    style.fill: "#b2dfdb"
    prox: AOP & Proxies
  }

  tx: Transactions {
    style.fill: "#fff9c4"
    txMgmt: Transaction Management
  }

  boot: Spring Boot {
    style.fill: "#ffe0b2"
    auto: Auto-Configuration
    cfg: Configuration
  }

  data: Data {
    style.fill: "#ffccbc"
    jpa: Spring Data JPA
    batch: Batch Processing
    nplus: N+1 Problem
  }

  sec: Security {
    style.fill: "#f8bbd0"
    secBasics: Security Basics
    jwt: JWT & OAuth2
    method: Method Security
  }

  mvc: Web {
    style.fill: "#d1c4e9"
    springMvc: Spring MVC
  }

  micro: Microservices {
    style.fill: "#b39ddb"
    discovery: Service Discovery
    gateway: API Gateway
    cb: Circuit Breaker
    configSrv: Config Server
    feign: Feign & Tracing
  }
}

root.core -> root.aop: "foundation"
root.aop -> root.tx: "proxy mechanics"
root.tx -> root.boot: "app structure"
root.boot -> root.data: "persistence"
root.data -> root.sec: "web layer"
root.sec -> root.mvc: "authz"
root.mvc -> root.micro: "distributed"
```

### 🌱 Core (IoC, Beans, DI)
| Topic | What You'll Learn |
|-------|-------------------|
| [IoC & Dependency Injection](core/ioc-and-di.md) | IoC container, `BeanFactory` vs `ApplicationContext`, constructor vs setter vs field injection, `@Autowired` vs `@Resource` |
| [Bean Lifecycle](core/bean-lifecycle.md) | Full lifecycle with `BeanPostProcessor`, `Aware` interfaces, `@PostConstruct`, scopes (singleton, prototype, request, session) |
| [Circular Dependencies](core/circular-dependencies.md) | Three-level cache, when circular deps can be resolved, when they can't, `@Lazy` workaround |

### 🎭 AOP
| Topic | What You'll Learn |
|-------|-------------------|
| [AOP & Proxies](aop/aop-and-proxies.md) | JDK Dynamic Proxy vs CGLIB, `@Around` advice, **why `@Transactional` fails on self-invocation** |

### 💰 Transactions
| Topic | What You'll Learn |
|-------|-------------------|
| [Transaction Management](transactions/transaction-management.md) | `@Transactional` internals, propagation types, isolation levels, rollback rules, `readOnly`, self-invocation trap |

### 🚀 Spring Boot
| Topic | What You'll Learn |
|-------|-------------------|
| [Auto-Configuration](boot/auto-configuration.md) | `@SpringBootApplication` composition, `@ConditionalOn*`, `spring.factories`, starters, how Spring Boot "just works" |
| [Configuration](boot/configuration.md) | Properties vs YAML, profiles, `@ConfigurationProperties` vs `@Value`, property loading order, `@PropertySource` |

### 🗄️ Data (JPA & Hibernate)
| Topic | What You'll Learn |
|-------|-------------------|
| [Spring Data JPA](data/spring-data-jpa.md) | Repository hierarchy, derived queries, JPQL vs native, projections, pagination, `@Modifying` |
| [Batch Processing](data/batch-processing.md) | `hibernate.jdbc.batch_size`, `order_inserts`, flush+clear loop, why `IDENTITY` disables batching |
| [N+1 Problem](data/n-plus-one.md) | LAZY vs EAGER, detecting N+1, fixes (`JOIN FETCH`, `@EntityGraph`, batch fetching) |

### 🔐 Security
| Topic | What You'll Learn |
|-------|-------------------|
| [Security Basics](security/spring-security-basics.md) | Authentication vs authorization, filter chain, `SecurityContextHolder`, `PasswordEncoder` |
| [JWT & OAuth2](security/jwt-and-oauth2.md) | JWT structure, stateless auth, OAuth2 flows, gateway-level token validation |
| [Method Security](security/method-security.md) | `@PreAuthorize`, `@PostAuthorize`, `@Secured`, role-based access, SpEL |

### 🕸️ Web (MVC)
| Topic | What You'll Learn |
|-------|-------------------|
| [Spring MVC](mvc/spring-mvc.md) | `DispatcherServlet` flow, `@Controller` vs `@RestController`, `@RequestMapping` vs HTTP-specific, `@ControllerAdvice` |

### 🌐 Microservices
| Topic | What You'll Learn |
|-------|-------------------|
| [Service Discovery](microservices/service-discovery.md) | Eureka architecture, client-side registration, self-preservation, Consul comparison |
| [API Gateway](microservices/api-gateway.md) | Spring Cloud Gateway, routing, filters, gateway-level auth |
| [Circuit Breaker](microservices/circuit-breaker.md) | CLOSED/OPEN/HALF_OPEN, Resilience4j, fallbacks, when to use |
| [Config Server](microservices/config-server.md) | Spring Cloud Config, Git-backed config, `@RefreshScope`, bootstrap order |
| [Feign & Tracing](microservices/feign-and-tracing.md) | OpenFeign for REST clients, Sleuth + Zipkin, MDC propagation |

---

## 📌 Recommended Reading Order

```d2
direction: right

s1: "1. Core\nIoC + Beans\n+ Circular" {
  style.fill: "#c8e6c9"
}
s2: "2. AOP\nProxies + Advice" {
  style.fill: "#b2dfdb"
}
s3: "3. Transactions\n@Transactional" {
  style.fill: "#fff9c4"
}
s4: "4. Boot\nAuto-config\n+ Config" {
  style.fill: "#ffe0b2"
}
s5: "5. Data\nJPA + Batch\n+ N+1" {
  style.fill: "#ffccbc"
}
s6: "6. Web & Security\nMVC + Auth" {
  style.fill: "#f8bbd0"
}
s7: "7. Microservices\nDiscovery, Gateway,\nCircuit Breaker" {
  style.fill: "#b39ddb"
}

s1 -> s2 -> s3 -> s4 -> s5 -> s6 -> s7
```

| Stage | Focus | Files |
|-------|-------|-------|
| **1. Core** | IoC container & lifecycle | `ioc-and-di`, `bean-lifecycle`, `circular-dependencies` |
| **2. AOP** | Proxies — foundation for transactions | `aop-and-proxies` |
| **3. Transactions** | The #1 production bug source | `transaction-management` |
| **4. Spring Boot** | Auto-configuration & configuration | `auto-configuration`, `configuration` |
| **5. Data** | JPA, batch, N+1 | `spring-data-jpa`, `batch-processing`, `n-plus-one` |
| **6. Web & Security** | MVC & authentication | `spring-mvc`, `spring-security-basics`, `jwt-and-oauth2`, `method-security` |
| **7. Microservices** | Distributed systems | `service-discovery`, `api-gateway`, `circuit-breaker`, `config-server`, `feign-and-tracing` |

**Tip:** Stages 1–3 are the highest-yield — most Spring interviews focus
there. Stages 4–6 are asked in 50–70% of interviews. Stage 7 is
microservices-specific.

---

## ✨ Highlights

- ✅ **19 deep-dive documents** — concepts, not Q&A
- ✅ **Internals-focused** — three-level cache, proxy mechanics, filter chain
- ✅ **Tricky corners** — self-invocation, `IDENTITY` batching, circular deps
- ✅ **Working code examples** with expected behavior
- ✅ **Spring Boot 3.x** baseline (Jakarta namespace, Java 17+)
- ✅ **D2 + PlantUML diagrams** for container, proxy, and filter-chain flows
- ✅ **Interview tips** and **common pitfalls** in every doc

---

## 🗂️ Full File List (19 Documents)

### Core (3)
- [IoC & Dependency Injection](core/ioc-and-di.md)
- [Bean Lifecycle](core/bean-lifecycle.md)
- [Circular Dependencies](core/circular-dependencies.md)

### AOP (1)
- [AOP & Proxies](aop/aop-and-proxies.md)

### Transactions (1)
- [Transaction Management](transactions/transaction-management.md)

### Spring Boot (2)
- [Auto-Configuration](boot/auto-configuration.md)
- [Configuration](boot/configuration.md)

### Data (3)
- [Spring Data JPA](data/spring-data-jpa.md)
- [Batch Processing](data/batch-processing.md)
- [N+1 Problem](data/n-plus-one.md)

### Security (3)
- [Security Basics](security/spring-security-basics.md)
- [JWT & OAuth2](security/jwt-and-oauth2.md)
- [Method Security](security/method-security.md)

### Web (1)
- [Spring MVC](mvc/spring-mvc.md)

### Microservices (5)
- [Service Discovery](microservices/service-discovery.md)
- [API Gateway](microservices/api-gateway.md)
- [Circuit Breaker](microservices/circuit-breaker.md)
- [Config Server](microservices/config-server.md)
- [Feign & Tracing](microservices/feign-and-tracing.md)

---

## 📊 Progress Tracker

Track your Spring revision across all 19 documents.

| Stage | Topic | Done? |
|-------|-------|:-----:|
| 1 | IoC & Dependency Injection | [ ] |
| 1 | Bean Lifecycle | [ ] |
| 1 | Circular Dependencies | [ ] |
| 2 | AOP & Proxies | [ ] |
| 3 | Transaction Management | [ ] |
| 4 | Auto-Configuration | [ ] |
| 4 | Configuration | [ ] |
| 5 | Spring Data JPA | [ ] |
| 5 | Batch Processing | [ ] |
| 5 | N+1 Problem | [ ] |
| 6 | Spring MVC | [ ] |
| 6 | Security Basics | [ ] |
| 6 | JWT & OAuth2 | [ ] |
| 6 | Method Security | [ ] |
| 7 | Service Discovery | [ ] |
| 7 | API Gateway | [ ] |
| 7 | Circuit Breaker | [ ] |
| 7 | Config Server | [ ] |
| 7 | Feign & Tracing | [ ] |

---

> 📍 _Every file is self-contained. Start with the mental model, skim the
> internals, then focus on the "Tricky Corners" and "Common Pitfalls"
> sections for rapid revision._