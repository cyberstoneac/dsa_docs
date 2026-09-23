# ThreadLocal & Scoped Values

> **JDK context:** `ThreadLocal` has been with Java since 1.2.
> `InheritableThreadLocal` since 1.2. Scoped Values are a preview feature
> in Java 20 and 21. Structured Concurrency is a preview in Java 19–21.
> This file assumes Java 21 for the scoped value syntax.

## Mental Model

Contextual data — user identity, request ID, transaction, tenant, security
context — needs to travel with a thread *implicitly*. Three mechanisms:

```d2
direction: right

mechanisms: "Context Propagation" {
  style.fill: "#f5f5f5"

  threadlocal: "ThreadLocal\nMutable, per-thread\nInheritance via copying\nLeaks in pools" {
    style.fill: "#bbdefb"
  }

  inheritable: "InheritableThreadLocal\nCopies parent's value\nat thread creation\nBroken by pools" {
    style.fill: "#fff9c4"
  }

  scoped: "ScopedValue (Java 20+)\nImmutable, per-scope\nAutomatic inheritance\nNo leaks" {
    style.fill: "#c8e6c9"
  }
}
```

**The problem they solve:** passing a `UserContext` parameter down 10 method
calls just to reach the bottom.

**The problem they cause:** memory leaks in thread pools, subtle bugs across
async boundaries, test contamination.

---

# Part 1 — ThreadLocal

## Basics

```java
ThreadLocal<String> CURRENT_USER = new ThreadLocal<>();

CURRENT_USER.set("alice");
System.out.println(CURRENT_USER.get());   // alice

CURRENT_USER.remove();                     // cleanup
```

Each thread has its own value. Threads don't see each other's.

### Static final — the correct pattern

```java
private static final ThreadLocal<String> CURRENT_USER = new ThreadLocal<>();
```

- `static` — one instance shared; the *value* is per-thread
- `final` — the reference never changes

### `withInitial` — default value

```java
private static final ThreadLocal<List<String>> BUFFER =
        ThreadLocal.withInitial(ArrayList::new);

BUFFER.get().add("item");   // creates a new list per thread on first access
```

Avoids null checks.

### `set`, `get`, `remove`, `set(null)`

```java
threadLocal.set(value);        // set for current thread
threadLocal.get();             // read (null if not set)
threadLocal.remove();          // delete entry entirely
threadLocal.set(null);         // sets value to null but keeps the entry
```

**`remove()` vs `set(null)`:**

- `remove()` deletes the map entry — frees memory
- `set(null)` keeps the entry pointing to null — still leaks the entry

**Always prefer `remove()` in `finally`.**

---

## How ThreadLocal Works Internally

Each `Thread` holds a `ThreadLocalMap` (a custom hash map):

```java
public class Thread {
    ThreadLocal.ThreadLocalMap threadLocals;
}

static class ThreadLocalMap {
    Entry[] table;   // Entry extends WeakReference<ThreadLocal<?>>
    Object value;    // the per-thread value
}
```

**Key facts:**

- The map is **per-thread** — one map per thread
- The **key** is a `ThreadLocal` instance (weak reference)
- The **value** is your data (strong reference)
- The map lives as long as the thread

This is the source of the leak problem (see below).

---

## The ThreadLocal Leak

**Scenario:**

1. A thread from a pool handles a request
2. `CURRENT_USER.set(userContext)` is called
3. Request completes, thread returns to pool
4. The thread — and its `ThreadLocalMap` — persists
5. Next request reuses the thread; the old value is still there
6. If the value references large objects, they leak until the next set/remove

**The classic mistake:**

```java
// BAD — no cleanup
try {
    CURRENT_USER.set(user);
    processRequest();
} finally {
    // nothing
}
```

**The fix:**

```java
// GOOD — always remove
try {
    CURRENT_USER.set(user);
    processRequest();
} finally {
    CURRENT_USER.remove();
}
```

### Why the leak happens even with weak keys

- The key (ThreadLocal instance) is weak — collected when no strong refs exist
- The value (your data) is **strong** — held until the thread dies or the entry is cleaned
- The cleanup of stale entries happens lazily — only when the map is accessed
- Threads that idle after one use keep the map and stale values forever

**Rule:** always call `remove()` in a `finally`.

---

## Real-World Uses of ThreadLocal

### 1. Request context

```java
public class RequestContext {
    private static final ThreadLocal<RequestContext> CURRENT = new ThreadLocal<>();

    private final String requestId;
    private final String userId;

    private RequestContext(String requestId, String userId) {
        this.requestId = requestId;
        this.userId = userId;
    }

    public static void set(String requestId, String userId) {
        CURRENT.set(new RequestContext(requestId, userId));
    }

    public static RequestContext get() { return CURRENT.get(); }

    public static void clear() { CURRENT.remove(); }

    public String requestId() { return requestId; }
    public String userId() { return userId; }
}

// In a servlet filter
public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
        throws IOException, ServletException {
    try {
        RequestContext.set(req.getHeader("X-Request-Id"),
                            req.getHeader("X-User-Id"));
        chain.doFilter(req, res);
    } finally {
        RequestContext.clear();
    }
}

// Anywhere deep in the code
String id = RequestContext.get().requestId();
```

### 2. Transaction context

Frameworks track the current transaction per thread:

```java
public class TransactionManager {
    private static final ThreadLocal<Transaction> CURRENT = new ThreadLocal<>();

    public static void begin() { CURRENT.set(new Transaction()); }
    public static Transaction current() { return CURRENT.get(); }
    public static void commit() { CURRENT.get().commit(); CURRENT.remove(); }
    public static void rollback() { CURRENT.get().rollback(); CURRENT.remove(); }
}
```

Spring's `@Transactional` uses exactly this pattern.

### 3. Non-thread-safe objects (SimpleDateFormat)

`SimpleDateFormat` is not thread-safe. Before `java.time`, the idiom was:

```java
private static final ThreadLocal<SimpleDateFormat> FMT =
        ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));
```

Each thread gets its own formatter. **Modern replacement:** use `DateTimeFormatter`,
which *is* thread-safe.

### 4. User security context

Spring Security stores the authenticated principal in a `ThreadLocal` under
`SecurityContextHolder`.

---

## InheritableThreadLocal

Passes values from parent to child thread at **creation time**.

```java
ThreadLocal<String> parentOnly = new ThreadLocal<>();
ThreadLocal<String> inheritable = new InheritableThreadLocal<>();

parentOnly.set("set-in-parent");
inheritable.set("set-in-parent");

Thread child = new Thread(() -> {
    System.out.println("parentOnly: " + parentOnly.get());       // null
    System.out.println("inheritable: " + inheritable.get());     // "set-in-parent"
});
child.start();
child.join();
```

### How inheritance happens

At thread creation, the child copies the parent's `InheritableThreadLocal` map.

### The pool problem

```java
// Thread pools create threads ONCE and reuse them
ExecutorService pool = Executors.newFixedThreadPool(4);

inheritable.set("request-1");
pool.submit(() -> System.out.println(inheritable.get()));   // may or may not see "request-1"

inheritable.set("request-2");
pool.submit(() -> System.out.println(inheritable.get()));   // could be stale value!
```

The pool's worker threads were created before the values were set. They
either don't see the value or see the wrong one.

**InheritableThreadLocal and thread pools don't mix.** This is exactly the
problem scoped values solve.

---

## Best Practices for ThreadLocal

| Rule | Why |
|---|---|
| Make it `static final` | One instance per class; values are per-thread |
| Always `remove()` in `finally` | Prevent leaks |
| Use `withInitial` for defaults | Avoid null checks |
| Never use for async / parallel streams | Value doesn't propagate |
| Prefer `ScopedValue` if on Java 20+ | Immutable, leak-free |

### Dangerous contexts

- **Thread pools** — must remove
- **`parallelStream()`** — value doesn't propagate to worker threads
- **`CompletableFuture` with custom executor** — doesn't propagate
- **Reactive code (WebFlux, RxJava)** — different threads execute different stages
- **Virtual threads** — one per task; leaks are bounded but still possible

---

# Part 2 — Scoped Values (Java 20+ Preview)

## The Motivation

ThreadLocal's problems:

1. **Mutable** — anyone can overwrite anyone else's value
2. **Leaks** — no automatic cleanup
3. **Doesn't work with virtual threads well** — millions of ThreadLocals is expensive
4. **Inheritance doesn't work with pools**

Scoped values fix all four.

## Basics

```java
public static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.where(CURRENT_USER, user).run(() -> {
    handleRequest();   // CURRENT_USER.get() returns `user`
});
// After the block, CURRENT_USER is no longer bound
```

### Properties

- **Immutable** — you can't `set()` a scoped value
- **Lexically scoped** — bound for the duration of a `where().run()` block
- **Automatically inherited** — child threads spawned inside the block see the value
- **Automatically cleaned up** — no `remove()` needed
- **Cheap** — no per-thread map; binding is a stack-frame concept

### Nesting

```java
ScopedValue.where(CURRENT_USER, alice).run(() -> {
    System.out.println(CURRENT_USER.get());   // alice

    ScopedValue.where(CURRENT_USER, bob).run(() -> {
        System.out.println(CURRENT_USER.get());   // bob (nested rebind)
    });

    System.out.println(CURRENT_USER.get());   // alice (outer restored)
});
```

### Multiple bindings

```java
ScopedValue
        .where(CURRENT_USER, user)
        .where(TENANT_ID, tenant)
        .where(REQUEST_ID, reqId)
        .run(() -> handleRequest());
```

### Handling exceptions

```java
try {
    ScopedValue.where(CURRENT_USER, user).call(() -> {
        return riskyOperation();   // can throw checked exceptions
    });
} catch (Exception e) {
    // handle
}
```

Use `call()` instead of `run()` when the body throws checked exceptions or
returns a value.

### Checking if bound

```java
if (CURRENT_USER.isBound()) {
    User u = CURRENT_USER.get();
}
```

Calling `get()` when unbound throws `NoSuchElementException`.

---

## Scoped Values with Virtual Threads

### Automatic inheritance

```java
ScopedValue.where(CURRENT_USER, user).run(() -> {
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        // All submitted tasks see CURRENT_USER
        for (int i = 0; i < 10_000; i++) {
            executor.submit(() -> {
                User u = CURRENT_USER.get();   // works
                process(u);
            });
        }
    }
});
```

Child threads automatically inherit the scoped value — no copying, no map.

### Why this is a big deal

- **ThreadLocal with 10,000 virtual threads** = 10,000 `ThreadLocalMap` entries
- **ScopedValue with 10,000 virtual threads** = a single binding, shared

Memory and performance win.

### Rebinding in a child

```java
ScopedValue.where(CURRENT_USER, alice).run(() -> {
    Thread.ofVirtual().start(() -> {
        // Inherits alice
        ScopedValue.where(CURRENT_USER, bob).run(() -> {
            // Local rebind to bob; parent still sees alice
        });
    });
});
```

---

## ScopedValue vs ThreadLocal

| Aspect | ThreadLocal | ScopedValue |
|---|---|---|
| Mutability | Mutable (`set`, `remove`) | Immutable (bind at `where`) |
| Scope | Thread lifetime | Lexical block |
| Cleanup | Manual `remove()` | Automatic |
| Inheritance | `InheritableThreadLocal` (fragile) | Automatic |
| Virtual threads | Expensive per-thread map | Cheap |
| Leak risk | High in pools | None |
| API style | Imperative | Functional (`where().run()`) |
| Status | Since Java 1.2 | Preview (Java 20+) |

### When to use which

| Use ThreadLocal | Use ScopedValue |
|---|---|
| Java < 20 | Java 20+ and willing to use preview |
| Mutable state per thread | Immutable context propagation |
| Complex lifecycle | Lexical scope fits |
| Existing framework code | New code |

**Direction:** ScopedValue is the future. Frameworks like Spring and
Micronaut are migrating toward it as virtual threads become standard.

---

# Part 3 — Structured Concurrency (Java 19+ Preview)

## The Motivation

```java
// Without structured concurrency
Future<User> userFuture = executor.submit(() -> fetchUser(userId));
Future<Order> orderFuture = executor.submit(() -> fetchOrder(orderId));

User user = userFuture.get();       // what if this hangs?
Order order = orderFuture.get();    // what if this fails and the other leaks?
```

Problems:

- If one task fails, the other keeps running (leak)
- If the parent thread is interrupted, children aren't cancelled
- Stack traces don't tell you which tasks belong to which request

## `StructuredTaskScope`

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User> userTask = scope.fork(() -> fetchUser(userId));
    Subtask<Order> orderTask = scope.fork(() -> fetchOrder(orderId));

    scope.join();              // wait for all subtasks
    scope.throwIfFailed();     // propagate the first failure

    return new Response(userTask.get(), orderTask.get());
}
// Both subtasks are cancelled if any fails
```

### Key properties

- **Structured** — subtasks can't outlive the scope
- **Cancellation propagates** — one failure cancels siblings
- **Interruption propagates** — parent interrupted → children interrupted
- **Observability** — thread dumps group subtasks by scope

## Two flavors

### `ShutdownOnFailure`

Cancel all if **any** subtask fails.

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    scope.fork(() -> fetchUser());
    scope.fork(() -> fetchOrder());
    scope.join();
    scope.throwIfFailed();
}
```

### `ShutdownOnSuccess`

Cancel all as soon as **one** succeeds.

```java
try (var scope = new StructuredTaskScope.ShutdownOnSuccess<String>()) {
    scope.fork(() -> fetchFromPrimary());
    scope.fork(() -> fetchFromBackup());
    scope.join();

    String result = scope.result();   // whichever won
}
```

Use case: hedging requests against multiple replicas.

---

## Combining Scoped Values + Structured Concurrency

```java
public Response handleRequest(User user, String userId, String orderId) {
    return ScopedValue.where(CURRENT_USER, user).call(() -> {
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            var userTask = scope.fork(() -> fetchUser(userId));       // inherits CURRENT_USER
            var orderTask = scope.fork(() -> fetchOrder(orderId));    // inherits CURRENT_USER

            scope.join();
            scope.throwIfFailed();

            return new Response(userTask.get(), orderTask.get());
        }
    });
}
```

Every subtask — running on any virtual thread — sees `CURRENT_USER`. No
plumbing. No ThreadLocal leaks. Automatic cancellation.

**This is the modern Java concurrency story.**

---

## Migration Path

| Step | From | To |
|---|---|---|
| 1 | `ThreadLocal<Context>` | `ScopedValue<Context>` |
| 2 | `executor.submit(task)` | `scope.fork(task)` |
| 3 | `future.get()` | `scope.join()` + `subtask.get()` |
| 4 | Manual cancellation | Automatic propagation |
| 5 | Manual ThreadLocal cleanup | Automatic scope cleanup |

For new code on Java 21, prefer **virtual threads + ScopedValue + Structured
Concurrency** over thread pools + ThreadLocal.

---

## Tricky Corners ⚠️

**`ThreadLocal.remove()` is not optional in thread pools.** Leaked values
persist for the lifetime of the pooled thread.

**`set(null)` is not the same as `remove()`.** The entry stays in the map.

**`InheritableThreadLocal` doesn't work with thread pools.** Threads are
created once; inheritance happens at creation time.

**`ThreadLocal` doesn't propagate across `parallelStream()` workers.** Each
worker has its own map.

**`ThreadLocal` in virtual threads is cheap but not free.** Millions of
virtual threads with ThreadLocals still consume memory.

**ScopedValue rebinding is lexically scoped.** Rebinding inside a nested
`where()` doesn't affect the outer scope after the inner block exits.

**`ScopedValue.get()` throws if not bound.** Use `isBound()` or wrap in
`where().run()`.

**ScopedValue requires structural refactoring.** You can't "set" a value
imperatively; you must wrap code in `where().run()`.

**Structured concurrency is preview** as of Java 21. API may change.

**Subtask `get()` requires the scope to be joined first.** Calling before
`join()` may block or throw.

**`throwIfFailed()` propagates the first failure** and cancels siblings.
Order of failures isn't guaranteed.

**Interruption cleanup in structured scopes is automatic** — this is one of
the biggest wins over manual `Future.get()`.

**Preview features require `--enable-preview`.** Not for production until
they standardize.

---

## Common Pitfalls

- Forgetting `ThreadLocal.remove()` in `finally`.
- Using `InheritableThreadLocal` with thread pools.
- Assuming ThreadLocal propagates to `parallelStream()` or async executors.
- Testing code that relies on ThreadLocal without proper cleanup (test
  contamination).
- Using `ScopedValue` when the value needs to mutate (use a holder).
- Not checking `isBound()` before `get()`.
- Mixing structured concurrency with manual `Future` handling.
- Using preview features in production.

---

## Key Interview Tips

- Explain the **ThreadLocal leak** mechanism in one sentence: weak keys, strong
  values, per-thread map, pooled threads.
- Say **"always call `remove()` in `finally`."**
- Mention **`InheritableThreadLocal` breaks with pools** — threads are created
  once.
- Explain **ScopedValue** as immutable, lexically scoped, auto-inherited,
  leak-free.
- Describe **Structured Concurrency** as "child tasks can't outlive the scope."
- Know `ShutdownOnFailure` vs `ShutdownOnSuccess`.
- Mention that **virtual threads + ScopedValue + structured concurrency** is
  the modern Java concurrency stack.

---

## Related

- [Threads Basics](../concurrency/threads-basics.md) — the thread model
- [Synchronization](../concurrency/synchronization.md) — locks and visibility
- [Virtual Threads](../concurrency/virtual-threads.md) — the new concurrency model
- [Executors & Futures](../concurrency/executors-and-futures.md) — thread pools and `CompletableFuture`
- [Memory References](memory-references.md) — ThreadLocal leaks and GC