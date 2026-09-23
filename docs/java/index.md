# ☕ Core Java — Interview Revision

Welcome to the **Core Java** revision section. This is not a tutorial — it's a
concept-dense reference written for engineers who already write Java daily and
want to sharpen the *why* before interviews.

Every document here follows the same shape:

- **Mental model** — intuition first
- **Internals** — what the JVM / compiler actually does
- **Tricky corners** — the edge cases interviewers love
- **Common pitfalls** and **Key interview tips** at the bottom

---

## 🗺️ How This Section Is Organized

```d2
direction: down

root: Core Java Revision {
  style.fill: "#e3f2fd"
  style.stroke: "#1565c0"

  fund: Fundamentals {
    style.fill: "#bbdefb"
    jvm: JVM Architecture
    obj: Object Lifecycle
    oop: OOP Principles
    kw: Keywords Deep Dive
    nest: Nested Classes
    rec: Records & Enums
    ver: Java Versions
  }

  sem: Language Semantics {
    style.fill: "#c8e6c9"
    str: String Internals
    exc: Exception Mastery
    gen: Generics & Wildcards
  }

  coll: Collections {
    style.fill: "#fff9c4"
    cov: Collections Overview
    hm: HashMap Internals
    lst: List Implementations
    st: Set & Sorted
    cc: Concurrent Collections
    stream: Streams & Functional
  }

  conc: Concurrency {
    style.fill: "#ffe0b2"
    tb: Threads Basics
    sync: Synchronization
    exec: Executors & Futures
    util: Concurrency Utilities
    dl: Deadlock & Liveness
    vt: Virtual Threads
  }

  io: I/O & Serialization {
    style.fill: "#d1c4e9"
    ser: Serialization Deep Dive
    copy: Object Copying & Cloning
  }

  pat: Design Patterns {
    style.fill: "#b2dfdb"
    patterns: Patterns in Java
    immut: Immutable Objects
  }

  adv: Advanced {
    style.fill: "#f8bbd0"
    refl: Reflection & Classloaders
    mem: Memory References
    misc: Misc Tricky Corners
  }
}

root.fund -> root.sem: "language first"
root.sem -> root.coll: "then data"
root.coll -> root.conc: "then threads"
root.conc -> root.io: "then IO"
root.io -> root.pat: "then patterns"
root.pat -> root.adv: "then depth"
```

### 🧱 Fundamentals
| Topic | What You'll Learn |
|-------|-------------------|
| [JVM Architecture](fundamentals/jvm-architecture.md) | Class loaders, runtime memory areas, bytecode execution, JDK vs JRE vs JVM |
| [Object Lifecycle](fundamentals/object-lifecycle.md) | Creation paths, `this`, GC roots, reachability, strong/weak/soft/phantom refs |
| [OOP Principles](fundamentals/oop-principles.md) | Encapsulation, inheritance, polymorphism, composition, up/downcasting |
| [Keyword Deep Dive](fundamentals/keywords-deep-dive.md) | `final`, `super`, `this`, `static`, `transient`, `volatile`, `var` |
| [Nested Classes](fundamentals/nested-classes.md) | Static nested, inner, local, anonymous classes; `this$0`; memory leaks |
| [Records & Enums](fundamentals/records-and-enums.md) | Records, canonical constructors, enums with abstract methods, sealed types |
| [Java Versions](fundamentals/java-versions.md) | JDK 7 → 21 feature evolution with rationale |

### 🧵 Language Semantics
| Topic | What You'll Learn |
|-------|-------------------|
| [String Internals](strings/string-internals.md) | String pool, immutability, object counts, `intern()`, encoding vs encryption |
| [Exception Mastery](exceptions/exception-mastery.md) | Hierarchy, checked vs unchecked, try/catch/finally edge cases, try-with-resources |
| [Generics & Wildcards](generics/generics-and-wildcards.md) | Type erasure, bounded types, PECS, why generics exist in collections |

### 📦 Collections
| Topic | What You'll Learn |
|-------|-------------------|
| [Collections Overview](collections/collections-overview.md) | Hierarchy, List/Set/Map/Queue, when to use what |
| [HashMap Internals](collections/hashmap-internals.md) | Buckets, hashing, collisions, resize, treeify, `hashCode`/`equals` contract |
| [List Implementations](collections/list-implementations.md) | ArrayList vs LinkedList vs Vector, fail-fast vs fail-safe |
| [Set & Sorted Collections](collections/set-and-sorted.md) | HashSet, TreeSet, LinkedHashSet, Comparable vs Comparator, `EnumSet` |
| [Concurrent Collections](collections/concurrent-collections.md) | ConcurrentHashMap, CopyOnWrite, BlockingQueue, bucket-level sync |
| [Streams & Functional](collections/streams-and-functional.md) | Full Streams deep dive (JDK 21), lambdas, functional interfaces, collectors |

### ⚙️ Concurrency
| Topic | What You'll Learn |
|-------|-------------------|
| [Threads Basics](concurrency/threads-basics.md) | Thread lifecycle, Runnable vs Thread vs Callable, join, daemon, interrupts |
| [Synchronization](concurrency/synchronization.md) | `synchronized`, `volatile`, wait/notify, ReentrantLock |
| [Executors & Futures](concurrency/executors-and-futures.md) | ExecutorService, Future, CompletableFuture, thread pool tuning |
| [Concurrency Utilities](concurrency/concurrency-utilities.md) | Semaphore, CountDownLatch, CyclicBarrier, AtomicInteger, CAS |
| [Deadlock & Liveness](concurrency/deadlock-and-liveness.md) | Detection, prevention, starvation, livelock, thread dumps |
| [Virtual Threads](concurrency/virtual-threads.md) | Java 21 virtual threads, pinning, structured concurrency |

### 🔌 I/O & Serialization
| Topic | What You'll Learn |
|-------|-------------------|
| [Serialization Deep Dive](io-serialization/serialization-deep-dive.md) | Serializable, Externalizable, custom serialization, transient, superclass rules, network transfer |
| [Object Copying & Cloning](io-serialization/object-copying-and-cloning.md) | Shallow vs deep copy, `Cloneable`, copy constructors, serialization-based deep copy |

### 🎨 Design Patterns
| Topic | What You'll Learn |
|-------|-------------------|
| [Patterns in Java](design-patterns-java/patterns-in-java.md) | Singleton (thread-safe), Builder, Factory, Observer, Strategy, Proxy |
| [Immutable Objects](design-patterns-java/immutable-objects.md) | Five rules of immutability, defensive copies, prevent cloning/serialization |

### 🔬 Advanced
| Topic | What You'll Learn |
|-------|-------------------|
| [Reflection & Classloaders](advanced/reflection-and-classloaders.md) | Reflection API, `MethodHandle`, classloader hierarchy, `ClassNotFoundException` vs `NoClassDefFoundError` |
| [Memory References](advanced/memory-references.md) | Strong/Weak/Soft/Phantom refs, `WeakHashMap`, GC collectors, tuning |
| [Misc Tricky Corners](advanced/misc-tricky.md) | Array comparison, pass-by-value, 2D arrays, null static access, method hiding, autoboxing traps |

---

## 📌 Recommended Reading Order

```d2
direction: right

s1: "1. Core Semantics\nOOP + Keywords\n+ Object Lifecycle" {
  style.fill: "#bbdefb"
}
s2: "2. Data Handling\nStrings + Exceptions\n+ Generics" {
  style.fill: "#c8e6c9"
}
s3: "3. Collections\nHashMap + List + Set\n+ Concurrent" {
  style.fill: "#fff9c4"
}
s4: "4. Modern Java\nStreams + Lambdas" {
  style.fill: "#ffe0b2"
}
s5: "5. Concurrency\nThreads + Sync\n+ Executors" {
  style.fill: "#ffccbc"
}
s6: "6. Advanced\nJVM + Serialization\n+ References" {
  style.fill: "#f8bbd0"
}

s1 -> s2 -> s3 -> s4 -> s5 -> s6
```

| Stage | Focus | Files |
|-------|-------|-------|
| **1. Core semantics** | Language foundation | `oop-principles`, `keywords-deep-dive`, `nested-classes`, `object-lifecycle` |
| **2. Data handling** | Strings, exceptions, generics | `string-internals`, `exception-mastery`, `generics-and-wildcards` |
| **3. Collections mastery** | The #1 interview area | `hashmap-internals`, `list-implementations`, `set-and-sorted`, `concurrent-collections` |
| **4. Modern Java** | Streams, lambdas, records | `streams-and-functional`, `records-and-enums` |
| **5. Concurrency** | Threading essentials | `threads-basics`, `synchronization`, `executors-and-futures`, `concurrency-utilities` |
| **6. Advanced** | Depth & gotchas | `jvm-architecture`, `serialization-deep-dive`, `memory-references`, `reflection-and-classloaders` |

---

## 🧭 JDK Feature Timeline (Quick Reference)

```d2
direction: right

jdk7: "JDK 7\n2011" {
  style.fill: "#e1f5fe"
  f1: "try-with-resources"
  f2: "diamond <>"
  f3: "strings in switch"
  f4: "ForkJoinPool"
}
jdk8: "JDK 8\n2014" {
  style.fill: "#b3e5fc"
  f1: "Lambdas"
  f2: "Streams"
  f3: "Optional"
  f4: "default methods"
  f5: "CompletableFuture"
  f6: "Date/Time API"
}
jdk9: "JDK 9\n2017" {
  style.fill: "#81d4fa"
  f1: "JPMS modules"
  f2: "jshell"
  f3: "ofNullable/takeWhile"
}
jdk10: "JDK 10\n2018" {
  style.fill: "#4fc3f7"
  f1: "var"
}
jdk11: "JDK 11\n2018 LTS" {
  style.fill: "#29b6f6"
  f1: "HTTP/2 client"
  f2: "String.isBlank/lines"
}
jdk14: "JDK 14\n2020" {
  style.fill: "#03a9f4"
  f1: "Switch expressions"
}
jdk16: "JDK 16\n2021" {
  style.fill: "#039be5"
  f1: "Records"
  f2: "instanceof pattern"
  f3: "Stream.toList()"
}
jdk17: "JDK 17\n2021 LTS" {
  style.fill: "#0288d1"
  f1: "Sealed classes"
  f2: "switch pattern (preview)"
}
jdk21: "JDK 21\n2023 LTS" {
  style.fill: "#01579b"
  style.font-color: white
  f1: "Virtual threads"
  f2: "Sequenced collections"
  f3: "switch pattern (std)"
  f4: "Record patterns"
  f5: "Generational ZGC"
}

jdk7 -> jdk8 -> jdk9 -> jdk10 -> jdk11 -> jdk14 -> jdk16 -> jdk17 -> jdk21
```

| JDK | Headline Features |
|-----|-------------------|
| **7** | try-with-resources, diamond operator, strings in switch, `ForkJoinPool` |
| **8** | Lambdas, Streams, `Optional`, default methods, `CompletableFuture`, new Date/Time API |
| **9** | JPMS (modules), `jshell`, `Stream.ofNullable`, `takeWhile`/`dropWhile`, private interface methods |
| **10** | `var` (local variable type inference) |
| **11** | HTTP/2 client, `var` in lambdas, `String.isBlank/lines/repeat` |
| **14** | Switch expressions (standard) |
| **16** | Records, pattern matching for `instanceof`, `Stream.toList()` |
| **17** | Sealed classes, pattern matching for switch (preview) |
| **18** | Simple web server for static files |
| **21** | Virtual threads, sequenced collections, pattern matching for switch (standard), record patterns, ZGC generational |

Full breakdown in [Java Versions](fundamentals/java-versions.md).

---

## ✨ Highlights

- ✅ **31 deep-dive documents** — concepts, not Q&A
- ✅ **Internals-focused** — bytecode, memory layout, JVM behavior
- ✅ **Tricky corners** called out explicitly in every file
- ✅ **Working code examples** with expected output
- ✅ **Java 17 baseline** with Java 21 coverage where it matters
- ✅ **JDK version context** for every modern feature
- ✅ **Interview tips** and **common pitfalls** in every doc
- ✅ **D2 + PlantUML diagrams** for every non-trivial concept

---

## 🗂️ Full File List (31 Documents)

### Fundamentals (7)
- [JVM Architecture](fundamentals/jvm-architecture.md)
- [Object Lifecycle](fundamentals/object-lifecycle.md)
- [OOP Principles](fundamentals/oop-principles.md)
- [Keyword Deep Dive](fundamentals/keywords-deep-dive.md)
- [Nested Classes](fundamentals/nested-classes.md)
- [Records & Enums](fundamentals/records-and-enums.md)
- [Java Versions](fundamentals/java-versions.md)

### Language Semantics (3)
- [String Internals](strings/string-internals.md)
- [Exception Mastery](exceptions/exception-mastery.md)
- [Generics & Wildcards](generics/generics-and-wildcards.md)

### Collections (6)
- [Collections Overview](collections/collections-overview.md)
- [HashMap Internals](collections/hashmap-internals.md)
- [List Implementations](collections/list-implementations.md)
- [Set & Sorted Collections](collections/set-and-sorted.md)
- [Concurrent Collections](collections/concurrent-collections.md)
- [Streams & Functional](collections/streams-and-functional.md)

### Concurrency (6)
- [Threads Basics](concurrency/threads-basics.md)
- [Synchronization](concurrency/synchronization.md)
- [Executors & Futures](concurrency/executors-and-futures.md)
- [Concurrency Utilities](concurrency/concurrency-utilities.md)
- [Deadlock & Liveness](concurrency/deadlock-and-liveness.md)
- [Virtual Threads](concurrency/virtual-threads.md)

### I/O & Serialization (2)
- [Serialization Deep Dive](io-serialization/serialization-deep-dive.md)
- [Object Copying & Cloning](io-serialization/object-copying-and-cloning.md)

### Design Patterns (2)
- [Patterns in Java](design-patterns-java/patterns-in-java.md)
- [Immutable Objects](design-patterns-java/immutable-objects.md)

### Advanced (3)
- [Reflection & Classloaders](advanced/reflection-and-classloaders.md)
- [Memory References](advanced/memory-references.md)
- [Misc Tricky Corners](advanced/misc-tricky.md)

---

## 📊 Progress Tracker

Track your revision across all 31 documents.

| Stage | Topic | Done? |
|-------|-------|:-----:|
| 1 | JVM Architecture | [ ] |
| 1 | Object Lifecycle | [ ] |
| 1 | OOP Principles | [ ] |
| 1 | Keywords Deep Dive | [ ] |
| 1 | Nested Classes | [ ] |
| 1 | Records & Enums | [ ] |
| 1 | Java Versions | [ ] |
| 2 | String Internals | [ ] |
| 2 | Exception Mastery | [ ] |
| 2 | Generics & Wildcards | [ ] |
| 3 | Collections Overview | [ ] |
| 3 | HashMap Internals | [ ] |
| 3 | List Implementations | [ ] |
| 3 | Set & Sorted Collections | [ ] |
| 3 | Concurrent Collections | [ ] |
| 4 | Streams & Functional | [ ] |
| 5 | Threads Basics | [ ] |
| 5 | Synchronization | [ ] |
| 5 | Executors & Futures | [ ] |
| 5 | Concurrency Utilities | [ ] |
| 5 | Deadlock & Liveness | [ ] |
| 5 | Virtual Threads | [ ] |
| 6 | Serialization Deep Dive | [ ] |
| 6 | Object Copying & Cloning | [ ] |
| 6 | Patterns in Java | [ ] |
| 6 | Immutable Objects | [ ] |
| 6 | Reflection & Classloaders | [ ] |
| 6 | Memory References | [ ] |
| 6 | Misc Tricky Corners | [ ] |

---

> 📍 _Every file is self-contained. Start with the mental model, skim the internals, then focus on the "Tricky Corners" and "Common Pitfalls" sections for rapid revision._