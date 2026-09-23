# Exception Mastery

> **JDK context:** try-with-resources arrived in Java 7, along with multi-catch.
> `AutoCloseable` was added in Java 7 as the resource contract. `Throwable`
> has been a class since Java 1.0.

## Mental Model

Exceptions in Java come in **two families** — checked and unchecked — divided
by one class in the hierarchy: `RuntimeException`.

```d2
direction: down

throwable: Throwable {
  style.fill: "#ffcdd2"

  error: Error {
    style.fill: "#ef9a9a"
    desc: "JVM-level failures\nOutOfMemoryError, StackOverflowError\nDo not catch"
  }

  exception: Exception {
    style.fill: "#c8e6c9"

    runtime: RuntimeException {
      style.fill: "#a5d6a7"
      desc: "Unchecked\nNPE, IAE, IndexOutOfBounds\nProgrammer errors"
    }

    checked: "Checked Exceptions" {
      style.fill: "#81c784"
      desc: "IOException, SQLException\nRecoverable, must declare"
    }
  }
}
```

**Rule of thumb:**
- **Checked** — external failures the caller can recover from (I/O, DB, network)
- **Unchecked** — programming bugs (null deref, bad index, illegal argument)
- **Error** — JVM is broken; don't catch, let it propagate

---

## Throwable — Class or Interface?

**`Throwable` is a class**, not an interface. It's the root of the exception
hierarchy.

```java
public class Throwable implements Serializable { ... }
```

Only `Throwable` and its subclasses can be thrown by the JVM.

You **could** extend `Throwable` directly, but it's strongly discouraged —
you'd be outside the checked/unchecked distinction and `catch (Exception e)`
wouldn't catch your type.

---

## Checked vs Unchecked

| | Checked | Unchecked |
|---|---|---|
| **Extends** | `Exception` (not `RuntimeException`) | `RuntimeException` |
| **Must declare?** | ✅ `throws` in method signature | ❌ |
| **Must catch?** | ✅ or declare | ❌ |
| **Typical** | `IOException`, `SQLException` | `NullPointerException`, `IllegalArgumentException` |
| **Who's responsible** | Caller | Programmer |
| **Recovery** | Often possible | Usually a bug |

### Why unchecked exists

Checked exceptions force callers to handle or propagate. That's good for
recoverable failures. For bugs (null deref, bad argument), forcing a `catch`
everywhere is noise. Unchecked exceptions signal *"you wrote this wrong"*.

Modern Java style (including Spring, JPA) leans toward unchecked exceptions
for most application-level errors.

---

## `throw` vs `throws`

| | `throw` | `throws` |
|---|---|---|
| **Where** | Inside a method body | On the method signature |
| **What** | Throws an exception instance | Declares what might be thrown |
| **Syntax** | `throw new FooException();` | `void m() throws FooException` |

```java
void read() throws IOException {           // declares
    if (bad) throw new IOException();      // throws
}
```

---

## Custom Exception

```java
public class InsufficientBalanceException extends Exception {
    private final BigDecimal shortfall;

    public InsufficientBalanceException(BigDecimal shortfall) {
        super("Insufficient balance: short by " + shortfall);
        this.shortfall = shortfall;
    }

    public InsufficientBalanceException(String msg, Throwable cause) {
        super(msg, cause);
        this.shortfall = null;
    }

    public BigDecimal getShortfall() { return shortfall; }
}
```

### Best practices

- Extend `Exception` for checked, `RuntimeException` for unchecked
- Provide **at least two constructors**: `(String)` and `(String, Throwable)`
- Add domain-specific fields (e.g. `shortfall`) for programmatic handling
- Override `getMessage()` only if you can't pass it via `super`
- Make it `Serializable` — it already is via `Throwable`; add `serialVersionUID`

---

## `try` / `catch` / `finally`

### Execution order

```java
try {
    A();       // if A() throws, jump to catch
    B();
} catch (SomeException e) {
    C();       // runs if A() or B() threw
} finally {
    D();       // always runs
}
```

### When does `finally` NOT execute?

**Almost never.** The only cases:

| Case | Why |
|---|---|
| `System.exit(0)` called | JVM shuts down immediately |
| JVM crashes / killed (`kill -9`) | Process dies, no unwinding |
| Infinite loop or deadlock in `try` | Never reaches `finally` |
| `Runtime.getRuntime().halt(0)` | Skips shutdown hooks and finalizers |

**Note:** `return`, `break`, `continue`, or an exception inside `try` do **not**
skip `finally`. It runs before the method actually returns.

---

## Return Value Precedence (the classic trap)

```java
int f() {
    try {
        return 1;
    } finally {
        return 2;
    }
}
// f() returns 2 — finally wins
```

```java
int f() {
    int x = 1;
    try {
        return x;         // evaluates to 1, stored for return
    } finally {
        x = 2;            // modifies local, doesn't affect return
    }
}
// f() returns 1 — the return value was captured before finally
```

```java
int f() {
    try {
        return 1;
    } finally {
        throw new RuntimeException();
    }
}
// f() throws — the finally exception replaces the return
```

**Interview line:** *"A `return` in `finally` overrides the try's return. A
mutation of a local in `finally` doesn't affect an already-captured return
value. An exception in `finally` replaces any pending return or exception."*

---

## try-with-resources

Since Java 7.

```java
try (BufferedReader br = Files.newBufferedReader(path);
     BufferedWriter bw = Files.newBufferedWriter(out)) {
    bw.write(br.readLine());
}   // both closed in reverse order, exceptions suppressed as needed
```

### `AutoCloseable`

The resource must implement `AutoCloseable` (or `Closeable`):

```java
public interface AutoCloseable {
    void close() throws Exception;
}
```

`Closeable` is the I/O-specific variant:

```java
public interface Closeable extends AutoCloseable {
    void close() throws IOException;   // narrower throws
}
```

### Suppressed exceptions

If the `try` body throws and `close()` also throws, the close exception is
attached to the primary one via `addSuppressed`:

```java
try (Resource r = new Resource()) {
    throw new IOException("primary");
}
// close() throws → attached as suppressed

// Retrieve with:
catch (IOException e) {
    for (Throwable s : e.getSuppressed()) {
        System.err.println("suppressed: " + s);
    }
}
```

---

## Exception Propagation

If a method doesn't catch an exception, it propagates up the call stack.

```d2
direction: down

caller: "main()" {
  style.fill: "#bbdefb"
}
m1: "methodA()\n(no catch)" {
  style.fill: "#c8e6c9"
}
m2: "methodB()\n(no catch)" {
  style.fill: "#fff9c4"
}
m3: "methodC()\n(throws)" {
  style.fill: "#ffcdd2"
}

caller.m1 -> caller.m2: "calls"
caller.m2 -> caller.m3: "calls"
```

The stack trace shows where the exception originated and every method it
propagated through.

**Rethrowing and wrapping:**

```java
try {
    riskyOp();
} catch (IOException e) {
    throw new ServiceException("failed", e);   // preserve cause
}
```

Always pass the original as `cause` — losing it makes debugging painful.

---

## Multi-catch (Java 7+)

```java
try {
    riskyOp();
} catch (IOException | SQLException e) {
    log.error("failed", e);
    throw new RuntimeException(e);
}
```

**Rules:**

- Catch types must be **disjoint** — no `IOException | FileNotFoundException`
- The caught variable is implicitly `final`
- You cannot reassign `e` inside the block

---

## Why We Don't `catch (Throwable t)`

`Throwable` includes `Error` and its subclasses. `Error` means the JVM is in a
broken state (`OutOfMemoryError`, `StackOverflowError`, `LinkageError`).

Catching `Error`:
- Masks critical failures
- Leaves the JVM in an undefined state
- Prevents shutdown mechanisms from working

**Exception:** frameworks that isolate user code (e.g. a plugin host) may catch
`Throwable` to prevent one bad plugin from killing the process. They then
rethrow if it's an `Error` they can't handle.

---

## Overriding and Exception Hierarchy

When overriding a method, the subclass **cannot throw broader checked exceptions
than the superclass declared**.

```java
class Base {
    void m() throws IOException { }
}

class Sub extends Base {
    // void m() throws Exception { }   // compile error — broader
    // void m() throws SQLException { } // compile error — different branch
    void m() throws FileNotFoundException { }  // OK — narrower
    // void m() { }                    // OK — no throws is fine
}
```

**Unchecked exceptions are unrestricted:**

```java
class Sub extends Base {
    void m() throws IllegalStateException { }   // always allowed
}
```

---

## `ClassNotFoundException` vs `NoClassDefFoundError`

| | `ClassNotFoundException` | `NoClassDefFoundError` |
|---|---|---|
| **Type** | Checked exception | Error |
| **Trigger** | `Class.forName()`, `ClassLoader.loadClass()` fails to find class | Class failed to load when JVM needed it (linkage or initialization) |
| **Recoverable** | Yes (dynamically load an alternative) | Usually no |
| **Root cause** | Missing from classpath or custom classloader can't find it | Class was present at compile time, absent or failed to initialize at runtime |

**Typical scenario for `NoClassDefFoundError`:** A static initializer threw
an exception the first time the class was loaded. Subsequent references to
the class trigger `NoClassDefFoundError` (not the original exception).

---

## Tricky Corners ⚠️

**`catch` order matters.** `catch (Exception e)` before `catch (IOException e)`
is a compile error — the specific case is unreachable.

```java
try { ... }
catch (IOException e) { }      // OK — specific first
catch (Exception e) { }        // OK — general after
```

**The `finally` block runs even if the `try` returns.** Return value is
captured first.

**`try-with-resources` closes in reverse order** — last declared closes first.

**A `NullPointerException` on `close()`** — if the resource variable was set to
`null` before `close`, or `close()` itself dereferences something null.

**`throw null;`** is legal Java — it throws a `NullPointerException`, not a
"null exception." Confusing but true.

**Wrapping without cause loses the original stack trace.** Always pass the
cause.

**`StackOverflowError` and `OutOfMemoryError` are `Error`s**, not exceptions.
Don't try to catch them for recovery.

**`getMessage()` may return `null`.** No-arg constructor leaves it null.

---

## Common Pitfalls

- Catching `Exception` (or `Throwable`) as a catch-all — masks bugs.
- Swallowing exceptions (empty catch block).
- Losing the original cause when wrapping.
- Assuming `finally` runs on `System.exit()`.
- Using `return` in `finally` — hides exceptions.
- Declaring `throws Exception` on every method — forces callers to handle everything.

---

## Key Interview Tips

- Know `Throwable` is a **class**, not an interface.
- Explain the "finally return" precedence with the three cases.
- Mention suppressed exceptions in try-with-resources.
- Wrapping should always include the cause.
- `NoClassDefFoundError` vs `ClassNotFoundException` — the difference is
  **checked exception vs error** and **dynamic lookup vs JVM loading**.

---

## Related

- [Reflection & Classloaders](../advanced/reflection-and-classloaders.md) — `ClassNotFoundException` details
- [Generics & Wildcards](../generics/generics-and-wildcards.md) — generic exceptions rules
- [Serialization Deep Dive](../io-serialization/serialization-deep-dive.md) — `Serializable` and exception classes