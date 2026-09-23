# Serialization Deep Dive

> **JDK context:** `Serializable` has been with Java since 1.1. `Externalizable`
> (Java 1.1) gives full control. Records (Java 16) can be serialized with
> restrictions. The Java serialization format has been criticized for
> security issues — many modern systems prefer JSON/Protobuf.

## Mental Model

Serialization converts an **object graph** into a **byte stream** and back.
It walks the object's fields, writes their values, and on deserialization
reconstructs the graph.

```d2
direction: right

obj: "Object in memory" {
  style.fill: "#e3f2fd"
  desc: "Graph of references"
}
bytes: "Byte stream" {
  style.fill: "#c8e6c9"
  desc: "Platform-independent format"
}
copy: "Reconstructed object" {
  style.fill: "#ffe0b2"
  desc: "New instance, same data"
}

obj.bytes -> bytes: "ObjectOutputStream\nwriteObject"
bytes.copy -> copy: "ObjectInputStream\nreadObject"
```

**Why serialization exists:**

- **Persist** objects to disk
- **Send** objects over a network (RMI, sockets, distributed caches)
- **Clone** objects (deep copy — see [Object Copying](../io-serialization/object-copying-and-cloning.md))
- **Cache** objects (session data, HTTP sessions in app servers)

---

## The `Serializable` Contract

```java
public interface Serializable {
    // Marker interface — no methods
}
```

Just implementing it opts your class in.

### Minimal example

```java
import java.io.*;

class User implements Serializable {
    private static final long serialVersionUID = 1L;

    private String name;
    private int age;

    User(String name, int age) {
        this.name = name;
        this.age = age;
    }

    @Override
    public String toString() { return name + " (" + age + ")"; }
}

public class Demo {
    public static void main(String[] args) throws Exception {
        User user = new User("Alice", 30);

        // Serialize
        try (ObjectOutputStream out =
                     new ObjectOutputStream(new FileOutputStream("user.ser"))) {
            out.writeObject(user);
        }

        // Deserialize
        try (ObjectInputStream in =
                     new ObjectInputStream(new FileInputStream("user.ser"))) {
            User restored = (User) in.readObject();
            System.out.println(restored);   // Alice (30)
        }
    }
}
```

---

## `serialVersionUID` — Why You Need It

When the JVM deserializes an object, it checks the class's `serialVersionUID`
against the one in the stream. Mismatch → `InvalidClassException`.

```java
class User implements Serializable {
    private static final long serialVersionUID = 1L;
    // ...
}
```

### If you don't declare it

The JVM computes a UID from:
- Class name
- Modifiers
- Field names and types
- Method names and signatures
- Interfaces

Add a field → UID changes → deserialization fails for existing streams.

### Best practice

**Always declare `serialVersionUID`.** Bump it deliberately when making
incompatible changes.

```java
private static final long serialVersionUID = 1L;
```

### Compatible vs incompatible changes

| Change | Compatible? |
|---|---|
| Add a field | ✅ (new field gets default value) |
| Remove a field | ✅ (extra field ignored) |
| Change field type | ❌ (`InvalidClassException`) |
| Change class to non-serializable | ❌ |
| Change inheritance hierarchy | ⚠️ sometimes |

With a **fixed** `serialVersionUID`, the first two are compatible.

---

## What Gets Serialized

Serialization walks the object graph:

1. The class of the object
2. The class's non-static, non-transient fields
3. Recursively, the objects referenced by those fields

```java
class Order implements Serializable {
    private String orderId;
    private List<Item> items;         // List must also be Serializable
    private Customer customer;        // Customer must be Serializable
    private transient String cache;   // skipped
    private static int count;         // static — not serialized
}
```

**If any referenced object isn't `Serializable`,** you get
`NotSerializableException` at runtime.

### `transient` — skip this field

```java
class Session implements Serializable {
    private String userId;
    private transient byte[] password;   // not persisted
    private transient Logger log;        // not persisted
}
```

On deserialization, `transient` fields get default values (`null`, `0`, `false`).

**Use cases:**
- Sensitive data
- Non-serializable dependencies (`Thread`, `Socket`, `Logger`)
- Derived/cached data

---

## Serialization Order

Fields are serialized **top-down** in the class hierarchy:

1. Superclass fields (if superclass is serializable)
2. Subclass fields

The JVM doesn't need constructors for deserialization.

---

## Deserialization Bypasses Constructors

**Critical fact:** `ObjectInputStream.readObject` **does not call** the
constructor of the class.

```java
class User implements Serializable {
    private String name;

    User(String name) {
        System.out.println("Constructor called");
        if (name == null) throw new IllegalArgumentException();
        this.name = name;
    }
}
```

Deserialization:
- Does **not** print "Constructor called"
- Does **not** run validation
- Can produce objects with invalid state if the stream is tampered with

### Fix — `readObject` for validation

```java
private void readObject(ObjectInputStream in)
        throws IOException, ClassNotFoundException {
    in.defaultReadObject();       // read fields normally
    if (name == null) {
        throw new InvalidObjectException("name required");
    }
}
```

The JVM calls `readObject` if you declare it (via reflection). This is the
only hook for validating after deserialization.

### Fix — `readResolve` for singletons / canonicalization

```java
protected Object readResolve() {
    return INSTANCE;   // ignore deserialized state, return the singleton
}
```

`readResolve` returns a replacement object — useful for ensuring singleton
invariants survive deserialization.

---

## `writeObject` — Custom Serialization

You can control exactly what gets written:

```java
class User implements Serializable {
    private String username;
    private transient String password;   // not auto-serialized
    private transient int loginCount;

    private void writeObject(ObjectOutputStream out) throws IOException {
        out.defaultWriteObject();                 // writes non-transient fields
        out.writeInt(loginCount);                 // manually add transient field
        out.writeUTF(encrypt(password));          // encrypt before writing
    }

    private void readObject(ObjectInputStream in)
            throws IOException, ClassNotFoundException {
        in.defaultReadObject();
        loginCount = in.readInt();
        password = decrypt(in.readUTF());
    }
}
```

**Rules:**

- `writeObject` and `readObject` must be `private void`
- Order of `writeXxx`/`readXxx` calls must match exactly
- Use `defaultWriteObject`/`defaultReadObject` to include the standard fields

### Common use cases

- Encrypting sensitive data
- Adding versioning
- Serializing derived fields that need recomputation
- Skipping fields that can't be serialized

---

## `Externalizable` — Full Control

`Externalizable extends Serializable` but gives you **total** control:

```java
public interface Externalizable extends Serializable {
    void writeExternal(ObjectOutput out) throws IOException;
    void readExternal(ObjectInput in) throws IOException, ClassNotFoundException;
}
```

### Example

```java
class User implements Externalizable {
    private String name;
    private int age;

    public User() {}   // MUST have public no-arg constructor

    public User(String name, int age) {
        this.name = name;
        this.age = age;
    }

    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeUTF(name);
        out.writeInt(age);
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException {
        name = in.readUTF();
        age = in.readInt();
    }
}
```

### `Externalizable` vs `Serializable`

| | `Serializable` | `Externalizable` |
|---|---|---|
| Control | JVM decides fields | You decide everything |
| `transient` | Skips fields | Irrelevant — you write manually |
| `serialVersionUID` | Required | Ignored |
| Constructor on deserialize | Not called | **Public no-arg constructor IS called** |
| Performance | Slower (reflection) | Faster (direct writes) |
| Flexibility | Limited | Complete |
| Boilerplate | Minimal | You write all I/O |

**Key difference:** `Externalizable` requires a **public no-arg constructor**,
and it **is called** during deserialization. Then `readExternal` fills in
the state.

**Use `Externalizable` when:**
- Performance matters (many objects)
- You need strict version control
- You want to serialize a subset of fields
- You need custom encoding

**Use `Serializable` when:**
- Default behavior is fine
- You want minimal code

---

## Superclass Rules — The Trap

### If superclass is NOT serializable

```java
class Parent {                        // not Serializable
    int x;
    Parent() { System.out.println("Parent ctor"); }
}

class Child extends Parent implements Serializable {
    int y;
}
```

When deserializing a `Child`:
- The `Parent` no-arg constructor **is called** (because parent fields
  can't be recovered from the stream)
- Parent fields get their **constructor-default values**, not the serialized ones
- Child fields are restored from the stream

**This means:** if `Parent` has state, it's lost on deserialization unless
`Parent` is also `Serializable`.

### If superclass IS serializable

```java
class Parent implements Serializable { int x; }
class Child extends Parent implements Serializable { int y; }
```

Both `Parent` and `Child` fields are serialized and restored. No constructor
called for either.

### If subclass is serializable but parent isn't

Common pattern: parent is a framework base class, child adds serializable state.

**Fix:** make the parent Serializable, or use `writeObject`/`readObject` in
the child to manually save/restore parent fields.

### Interview line

*"If the superclass isn't serializable, its no-arg constructor is called
during deserialization, and its fields are not restored. If the superclass
is serializable, neither the constructor is called nor are fields lost."*

---

## Sending Objects Over the Network

The classic pattern uses sockets + `ObjectOutputStream`:

```java
// Server
try (ServerSocket server = new ServerSocket(9000)) {
    Socket client = server.accept();

    try (ObjectInputStream in =
                 new ObjectInputStream(client.getInputStream())) {
        User user = (User) in.readObject();
        System.out.println("Received: " + user);
    }
}

// Client
try (Socket socket = new Socket("localhost", 9000);
     ObjectOutputStream out =
             new ObjectOutputStream(socket.getOutputStream())) {

    out.writeObject(new User("Alice", 30));
    out.flush();
}
```

### How `Connection` (JDBC) objects get passed over the network

**They don't.** `java.sql.Connection` is not `Serializable` — it wraps a
native socket and connection state.

The **correct pattern** is:

1. Serialize a **lightweight DTO** containing the data (URL, credentials, query params)
2. On the other side, **obtain a fresh `Connection`** using those parameters
3. Close the connection when done — connections are not shared across processes

```java
// Serializable DTO
record QueryRequest(String url, String user, String password, String sql)
        implements Serializable {}

// On the receiving side
QueryRequest req = ...; // from stream
try (Connection conn = DriverManager.getConnection(req.url(), req.user(), req.password());
     Statement stmt = conn.createStatement();
     ResultSet rs = stmt.executeQuery(req.sql())) {
    // process results
}
```

### Risks with network serialization

- **Security** — deserializing untrusted bytes is a known RCE vector
- **Versioning** — both ends must agree on class definitions
- **Firewalls** — Java's serialization protocol is not HTTP-friendly

### Modern alternatives

- **JSON** (Jackson, Gson) — human-readable, language-agnostic
- **Protobuf / Avro / Thrift** — compact, schema-driven
- **gRPC** — HTTP/2 + Protobuf

Java's native serialization is rarely the right choice in 2024+.

---

## Serialization and Records

Records (Java 16) can be serialized but with restrictions:

```java
record Point(int x, int y) implements Serializable {
    private static final long serialVersionUID = 1L;
}
```

- Records serialize their **components** in declaration order
- `writeObject`/`readObject` cannot be customized the same way
- `readResolve` works, but there's no `defaultWriteObject` custom path

**Records are a good fit** if you need simple serialization without custom
logic.

---

## Security — Why Not to Use Java Serialization

Java serialization has a **long history of vulnerabilities**:

- **Deserialization RCE** — malicious streams can execute arbitrary code via
  gadget chains (Apache Commons, Spring, etc.)
- **DoS** — crafted streams trigger enormous memory allocation
- **No authentication** — streams are trusted by default

### Mitigations (if you must use it)

1. **Never deserialize untrusted data**
2. Use a `ObjectInputFilter` to whitelist classes (Java 9+):

```java
ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
        "com.example.*;java.base/*;!*"
);

ObjectInputStream in = new ObjectInputStream(stream);
in.setObjectInputFilter(filter);
```

3. Set `jdk.serialFilter` globally via system property
4. Prefer a safer format (JSON, Protobuf)

**Interview line:** *"Java serialization is a security liability. Use JSON
or Protobuf for external data. If you must use it, apply
`ObjectInputFilter` and never deserialize untrusted streams."*

---

## `Serializable` vs `Cloneable`

Both are marker interfaces, but they're used differently:

| | `Serializable` | `Cloneable` |
|---|---|---|
| Purpose | Convert to/from bytes | Copy object |
| Method | None (marker) | `Object.clone()` (protected) |
| Deep vs shallow | Deep by design | Shallow by default |
| Constructor called | No | No |

**Serialization gives you deep cloning for free** — a common trick when
`Cloneable` is problematic.

Covered more in [Object Copying & Cloning](object-copying-and-cloning.md).

---

## Tricky Corners ⚠️

**Serialized data is a security risk.** Do not deserialize untrusted streams
without a filter.

**`serialVersionUID` mismatch = `InvalidClassException`.** Always declare it.

**Deserialization doesn't call constructors.** Use `readObject` for
validation.

**`transient` fields default to null/0/false** on deserialization.

**`static` fields are not serialized.** They're class-level.

**`final` fields can be problematic.** If `readObject` doesn't set them, they
stay at default. `Externalizable` avoids this by not touching them at all.

**Non-serializable superclass constructor runs on deserialization.** And
its fields are lost.

**`Externalizable` requires a public no-arg constructor** and calls it.

**Object graphs with cycles are handled** — the stream tracks objects to
avoid infinite recursion.

**Serialization preserves object identity within a stream.** If the same
object appears twice, one instance is restored (not two).

**Lambda expressions are not serializable by default.** You need a
`Serializable` functional interface, which is ugly.

**Inner (non-static) classes hold an outer reference.** They serialize the
outer too — often causing `NotSerializableException`.

**Make inner classes `static` if they need to be serializable.**

---

## Common Pitfalls

- Forgetting `serialVersionUID`.
- Assuming constructors run on deserialization.
- Trying to serialize `Thread`, `Socket`, `Connection` — not serializable.
- Not marking sensitive fields `transient`.
- Using serialization for network communication (RCE risk).
- Non-static inner classes as serializable — pulls the outer class.
- Sharing serialized data across different class versions without thought.

---

## Key Interview Tips

- Explain the `serialVersionUID` purpose and compatible vs incompatible changes.
- Say "deserialization does not call constructors" — top trap.
- Explain the superclass rule (constructor called iff superclass is not serializable).
- Mention `readObject` for validation and `readResolve` for singletons.
- Distinguish `Serializable` (auto) from `Externalizable` (manual, requires
  public no-arg ctor).
- Warn about security — deserialization RCE.

---

## Related

- [Object Copying & Cloning](object-copying-and-cloning.md) — deep copy via serialization
- [Keywords Deep Dive](../fundamentals/keywords-deep-dive.md) — `transient`
- [Memory References](../advanced/memory-references.md) — object graph reachability
- [Records & Enums](../fundamentals/records-and-enums.md) — records and serialization