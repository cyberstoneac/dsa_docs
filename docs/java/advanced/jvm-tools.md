# JVM Tools & Diagnostics

> **JDK context:** `jps`, `jmap`, `jstack`, `jstat`, and `jconsole` shipped
> with early JDKs. `jcmd` (Java 7) unified them. JFR (Java 11 for production)
> is the modern low-overhead profiler. GC logging format changed in Java 9.

## Mental Model

When a Java application misbehaves in production, you need to answer **one of
five questions**:

```d2
direction: right

tools: "Diagnostic Tools" {
  style.fill: "#f5f5f5"

  q1: "Which JVMs are running?" {
    style.fill: "#bbdefb"
  }
  q2: "How is memory/GC behaving?" {
    style.fill: "#c8e6c9"
  }
  q3: "Why is it stuck?" {
    style.fill: "#fff9c4"
  }
  q4: "What is using CPU?" {
    style.fill: "#ffe0b2"
  }
  q5: "What flags is it running with?" {
    style.fill: "#f8bbd0"
  }

  jps: "jps" {
    style.fill: "#a5d6a7"
  }
  jstat: "jstat / jmap / GC logs" {
    style.fill: "#a5d6a7"
  }
  jstack: "jstack / jcmd Thread.print" {
    style.fill: "#a5d6a7"
  }
  jfr: "jcmd JFR / async-profiler" {
    style.fill: "#a5d6a7"
  }
  jinfo: "jinfo / jcmd VM.flags" {
    style.fill: "#a5d6a7"
  }
}

tools.q1.tools.jps -> tools.jps: ""
tools.q2.tools.jstat -> tools.jstat: ""
tools.q3.tools.jstack -> tools.jstack: ""
tools.q4.tools.jfr -> tools.jfr: ""
tools.q5.tools.jinfo -> tools.jinfo: ""
```

Each question has a **primary tool** and a set of fallbacks. Knowing which
tool answers which question is 80% of the work.

---

## JVM Options — The Three Families

| Family | Prefix | Purpose | Example |
|---|---|---|---|
| **Standard** | `-X` | Commonly used, portable | `-Xms`, `-Xmx`, `-Xss` |
| **Non-standard** | `-XX` | Implementation-specific (usually HotSpot) | `-XX:MaxGCPauseMillis` |
| **System properties** | `-D` | Passed to `System.getProperty()` | `-Dfile.encoding=UTF-8` |

### Standard `-X` options

| Flag | Meaning | Default |
|---|---|---|
| `-Xms<size>` | Initial heap size | 1/64 of physical RAM |
| `-Xmx<size>` | Maximum heap size | 1/4 of physical RAM |
| `-Xss<size>` | Thread stack size | ~512 KB–1 MB |
| `-Xmn<size>` | Young generation size | Computed from NewRatio |
| `-Xlog:<tags>` | Unified logging (Java 9+) | — |

**Rule for production:** set `-Xms` = `-Xmx` to avoid heap resizing pauses.

### Non-standard `-XX` options

| Flag | Meaning |
|---|---|
| `-XX:NewRatio=<n>` | Ratio of Old:Young generation (default 2) |
| `-XX:SurvivorRatio=<n>` | Ratio of Eden:Survivor (default 8) |
| `-XX:MaxMetaspaceSize=<size>` | Cap on Metaspace |
| `-XX:MaxGCPauseMillis=<ms>` | Target max pause (G1) |
| `-XX:GCTimeRatio=<n>` | Throughput target (Parallel) |
| `-XX:+UseG1GC` | Select G1 collector |
| `-XX:+UseZGC` | Select ZGC (Java 15+) |
| `-XX:+UseParallelGC` | Select Parallel collector |
| `-XX:+HeapDumpOnOutOfMemoryError` | Dump heap on OOM |
| `-XX:HeapDumpPath=<path>` | Where to write the dump |
| `-XX:+ExitOnOutOfMemoryError` | Exit on OOM (vs hang) |
| `-XX:+TieredCompilation` | Enable tiered JIT |
| `-XX:TieredStopAtLevel=1` | C1 only (faster startup) |

### Boolean flags

- `-XX:+FlagName` — enable
- `-XX:-FlagName` — disable
- `-XX:FlagName=value` — set numeric or string value

### System properties `-D`

```bash
-Dfile.encoding=UTF-8
-Duser.timezone=UTC
-Dmyapp.cache.size=10000
```

Accessed via `System.getProperty("myapp.cache.size")`.

### Common production starter set

```bash
java \
  -Xms4g -Xmx4g \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:MaxMetaspaceSize=512m \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/var/log/myapp/ \
  -XX:+ExitOnOutOfMemoryError \
  -Xlog:gc*:file=/var/log/myapp/gc.log:time,uptime,level,tags \
  -jar myapp.jar
```

---

## Heap Sizing — The Rules of Thumb

### Set `-Xms` = `-Xmx` in production

```bash
-Xms4g -Xmx4g
```

**Why:** the JVM doesn't need to grow the heap, avoiding resize pauses. The
OS allocates memory upfront.

### How to choose the size?

1. **Start with `-Xmx` = 25–50% of container memory.**
2. **Leave headroom** for Metaspace, thread stacks, JIT code cache, direct buffers.
3. **Watch RSS** — `-Xmx` is just the heap, not total JVM memory.

```text
Total JVM memory ≈ heap + metaspace + thread stacks + JIT code cache + direct buffers
```

A JVM with `-Xmx4g` might use 5–6 GB of physical memory.

### Metaspace

```bash
-XX:MaxMetaspaceSize=512m
```

Cap it to catch classloader leaks. Without a cap, Metaspace can grow until
native memory is exhausted.

### Stack size

```bash
-Xss1m
```

Increase if you have deep recursion; decrease if you have many threads.

---

## GC Selection

| Collector | Flag | Best for |
|---|---|---|
| Serial | `-XX:+UseSerialGC` | Small heaps, single-core |
| Parallel | `-XX:+UseParallelGC` | Throughput-oriented batch |
| G1 | `-XX:+UseG1GC` | General purpose (default) |
| ZGC | `-XX:+UseZGC` | Huge heaps, ultra-low latency |
| Shenandoah | `-XX:+UseShenandoahGC` | Similar to ZGC |

### G1 tuning

```bash
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200         # target 200ms pauses
-XX:G1HeapRegionSize=16m         # region size (auto-tuned usually)
-XX:InitiatingHeapOccupancyPercent=45   # when to start concurrent marking
```

### ZGC tuning

```bash
-XX:+UseZGC
-XX:+ZGenerational               # Java 21+, better throughput
-Xmx16g                          # ZGC shines above 8GB heap
```

---

## GC Logging — Modern Syntax (Java 9+)

Old syntax (deprecated):

```bash
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:gc.log
```

New syntax:

```bash
-Xlog:gc*:file=gc.log:time,uptime,level,tags
```

### Breakdown

| Part | Meaning |
|---|---|
| `-Xlog:gc*` | All GC-related tags |
| `:file=gc.log` | Write to file |
| `:time,uptime,level,tags` | Include these decorators |
| `:filecount=5,filesize=10m` | Rotate logs (5 files, 10MB each) |

### Common variants

```bash
# Basic GC log
-Xlog:gc:file=gc.log

# Detailed GC with heap info
-Xlog:gc*:file=gc.log:time,level,tags

# Rotating logs
-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=20m
```

### Reading a GC log line

```text
[2024-01-15T10:23:45.123+0000][info][gc] GC(42) Pause Young (Normal) (G1 Evacuation Pause) 512M->128M(4096M) 15.234ms
```

| Field | Meaning |
|---|---|
| `GC(42)` | 42nd GC event |
| `Pause Young (Normal)` | Young generation collection |
| `512M->128M` | Heap before → after |
| `(4096M)` | Total heap |
| `15.234ms` | Pause duration |

### When to worry

- **Frequent full GCs** — heap too small or leak
- **Long pause times** — large heap, wrong collector, too many live objects
- **High promotion rate** — objects not dying young (allocation issue)
- **"GC overhead limit exceeded"** — GC using >98% CPU with <2% reclaimed

---

## `jps` — List Java Processes

```bash
jps                    # PIDs + short class names
jps -l                 # full class names
jps -v                 # with JVM args
jps -m                 # with main args
```

**Example output:**

```text
12345 Jps
23456 MyApplication
34567 org.apache.catalina.startup.Bootstrap
```

**Note:** `jps` only shows JVMs started by the same user (or all if root).

---

## `jinfo` — View/Modify JVM Flags

```bash
jinfo <pid>                  # all flags + system properties
jinfo -flags <pid>           # only JVM flags
jinfo -sysprops <pid>        # only system properties
jinfo -flag MaxHeapSize <pid>  # a single flag
```

**Example:**

```bash
jinfo -flag MaxHeapSize 23456
# -XX:MaxHeapSize=4294967296
```

**Limit:** you can only **modify** flags marked as "manageable" at runtime.
Most flags are read-only after startup.

---

## `jmap` — Heap Analysis

### Heap histogram — what classes are consuming memory

```bash
jmap -histo <pid>                  # top of the list is biggest
jmap -histo:live <pid>             # only live objects (triggers a GC!)
jmap -histo <pid> | head -20
```

**Example output:**

```text
 num     #instances         #bytes  class name
------------------------------------------------
   1:       2345678       112345678  [B          # byte arrays
   2:        890123        56789012  [C          # char arrays
   3:        456789        23456789  java.lang.String
   ...
```

**Reading it:**

- `#instances` — count of objects
- `#bytes` — total memory
- `[B`, `[C`, `[I`, `[J` — primitive array types (`byte[]`, `char[]`, `int[]`, `long[]`)

### Heap dump

```bash
jmap -dump:format=b,file=heap.hprof <pid>
jmap -dump:live,format=b,file=heap.hprof <pid>   # triggers GC first
```

**The `live` variant triggers a full GC** — don't use it on production
without understanding the impact.

### Automatic heap dump on OOM

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/log/dumps/
```

### Analyzing heap dumps

| Tool | Purpose |
|---|---|
| **Eclipse MAT** | Free, powerful, dominant-tree analysis |
| **JProfiler** | Commercial, GUI |
| **YourKit** | Commercial, GUI |
| **jvisualvm** | Built-in, basic |
| **jhat** | Deprecated since Java 9 |

**Standard workflow:** open `.hprof` in Eclipse MAT → find dominators → find
leak suspects → trace reference paths to GC roots.

---

## `jstat` — GC Statistics Streaming

```bash
jstat -gc <pid> <interval_ms>         # GC stats every interval
jstat -gcutil <pid> 1000              # utilization percentages
jstat -gccapacity <pid> 1000          # capacity in KB
jstat -gcnew <pid> 1000               # young gen
jstat -gcold <pid> 1000               # old gen
```

### Example — `jstat -gcutil`

```text
  S0     S1     E      O      M     CCS    YGC     YGCT    FGC    FGCT     GCT
  0.00  50.00  45.12  23.45  95.12  92.34   1234    5.678     5    1.234   6.912
```

| Column | Meaning |
|---|---|
| `S0`/`S1` | Survivor space utilization % |
| `E` | Eden utilization % |
| `O` | Old gen utilization % |
| `M` | Metaspace utilization % |
| `YGC` | Young GC count |
| `YGCT` | Young GC total time (seconds) |
| `FGC` | Full GC count |
| `FGCT` | Full GC total time |
| `GCT` | Total GC time |

**Interpretation:**

- High `O` and rising `FGC` → likely a leak
- Long `FGCT` → increase heap or tune collector
- `S0`/`S1` swapping shows promotion behavior

**Tip:** streaming `jstat -gcutil <pid> 1000` is the lightest way to watch
GC in production without overhead.

---

## `jstack` — Thread Dump

```bash
jstack <pid>                # full thread dump
jstack -l <pid>             # with lock info (ownable synchronizers)
jstack -F <pid>             # force (if JVM is unresponsive)
```

### What's in a thread dump

```text
"worker-1" #12 prio=5 os_prio=0 tid=0x00007f8c0c0a8000 nid=0x5e0a waiting on condition [0x00007f8c0f5e5000]
   java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for  <0x000000076ab...> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:194)
        at java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:433)
        at com.example.Worker.run(Worker.java:42)
```

| Field | Meaning |
|---|---|
| `"worker-1"` | Thread name |
| `nid=0x5e0a` | Native thread ID (matches OS thread) |
| `State: WAITING` | Thread state |
| Stack frames | Where the thread is |

### Thread states you'll see

- **RUNNABLE** — executing or ready
- **BLOCKED** — waiting on a monitor lock
- **WAITING** — `wait()`, `join()`, `park()`
- **TIMED_WAITING** — same with timeout

### Finding deadlocks

`jstack` detects deadlocks automatically:

```text
Found one Java-level deadlock:
=============================
"Thread-0":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object),
  which is held by "Thread-1"
"Thread-1":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object),
  which is held by "Thread-0"
```

### Finding CPU hogs

```bash
# On Linux/macOS
top -H -p <pid>              # top threads by CPU
# Note the OS thread ID (e.g. 24074)

# Convert to hex — matches jstack nid
printf '%x\n' 24074          # 5e0a

# Find in jstack
jstack <pid> | grep -A 20 "nid=0x5e0a"
```

**On Windows:** use Process Explorer or `jcmd <pid> Thread.print` combined
with Task Manager details.

---

## `jcmd` — The Unified Tool

`jcmd` (Java 7+) is the modern replacement for most individual tools.

### Usage

```bash
jcmd                               # list all JVMs
jcmd <pid> help                    # list all available commands
jcmd <pid> <command> [args]
```

### Common commands

| Command | Purpose |
|---|---|
| `VM.version` | JVM version info |
| `VM.flags` | Active flags |
| `VM.system_properties` | System properties |
| `VM.command_line` | Command line |
| `GC.heap_info` | Heap summary |
| `GC.class_histogram` | Heap histogram (like `jmap -histo`) |
| `GC.heap_dump <file>` | Heap dump |
| `Thread.print` | Thread dump (like `jstack`) |
| `Thread.print -l` | With lock info |
| `JFR.start` | Start JFR recording |
| `JFR.dump` | Dump JFR recording |
| `JFR.stop` | Stop JFR |
| `VM.native_memory` | Native memory tracking |

### Examples

```bash
# Thread dump with lock info
jcmd 23456 Thread.print -l > threads.txt

# Heap histogram
jcmd 23456 GC.class_histogram | head -20

# Heap dump
jcmd 23456 GC.heap_dump /tmp/heap.hprof

# Active flags
jcmd 23456 VM.flags

# Native memory summary (requires -XX:NativeMemoryTracking=summary)
jcmd 23456 VM.native_memory summary
```

### Why `jcmd` is preferred

- **One tool** for many tasks
- **Consistent output format**
- Actively maintained — new features land here first
- Works on any HotSpot-based JVM

---

## JFR — Java Flight Recorder

Low-overhead (1–2%) always-on profiler. Open-sourced in Java 11.

### Starting a recording

```bash
# At JVM startup
-XX:StartFlightRecording=filename=recording.jfr,duration=60s,settings=profile

# On a running JVM via jcmd
jcmd <pid> JFR.start name=myrec duration=60s filename=recording.jfr

# Dump without stopping
jcmd <pid> JFR.dump name=myrec filename=snapshot.jfr

# Stop
jcmd <pid> JFR.stop name=myrec
```

### What JFR records

- **CPU samples** — method-level hotspots
- **Allocation samples** — where objects are allocated
- **GC events** — pauses, promotions, phases
- **Thread events** — starts, stops, blocked states
- **Lock contention** — where threads block
- **File/socket I/O** — reads and writes
- **Exceptions** — thrown exceptions
- **Method profiling** — call traces

### Analyzing JFR files

- **JDK Mission Control (JMC)** — free, powerful GUI
- **`jfr` CLI** — `jfr print --events CPULoad recording.jfr`

**JFR is the modern standard** for production profiling. It's the successor
to `jstack` + `jmap` + `jstat` combined for many cases.

---

## `jconsole` and `jvisualvm` — GUI Monitoring

### `jconsole`

```bash
jconsole <pid>
# or
jconsole         # shows a list of local JVMs
```

Shows:
- Heap/threads/classes overview
- GC activity
- Thread states
- MBean browser

**Uses JMX** — can connect to remote JVMs with JMX enabled.

### `jvisualvm`

```bash
jvisualvm
```

More powerful than `jconsole`:
- CPU/memory sampling
- Heap dump analysis
- Thread dump analysis
- Plugin ecosystem (MBeans, JFR)
- Remote JMX

**Note:** removed from the JDK in Java 9. Download from
`visualvm.github.io`.

---

## Diagnostic Workflows

### "The app is slow"

1. **`jcmd <pid> Thread.print > dump.txt`** — find RUNNABLE threads
2. **`jcmd <pid> GC.heap_info`** — check heap and GC
3. **`jstat -gcutil <pid> 1000`** — watch GC over time
4. **`jcmd <pid> JFR.start duration=60s`** — capture a JFR
5. **Open JFR in JMC** — find CPU hotspots

### "The app hangs / doesn't respond"

1. **`jstack <pid>`** — dump all threads
2. **Look for BLOCKED threads** — waiting on a lock
3. **Look for deadlocks** — jstack detects them
4. **Check the main thread** — often at the top of the dump
5. **`jcmd <pid> Thread.print -l`** — with lock info

### "OutOfMemoryError"

1. **Check the OOM type** — Java heap space? Metaspace? GC overhead?
2. **If heap — analyze the heap dump:**
   - `-XX:+HeapDumpOnOutOfMemoryError` should already be set
   - Open `.hprof` in Eclipse MAT
   - Find dominators and leak suspects
3. **If Metaspace — classloader leak:**
   - Look for repeated classloading
   - Check redeployed webapps
4. **`jcmd <pid> GC.class_histogram`** — top classes by count

### "High CPU"

1. **`top -H -p <pid>`** (Linux/macOS) — find high-CPU thread ID
2. **`printf '%x\n' <tid>`** — convert to hex
3. **`jstack <pid> | grep -A 30 "nid=0x<hex>"`** — find the stack
4. **`jcmd <pid> JFR.start duration=30s`** — CPU profile

### "Memory leak suspected"

1. **`jstat -gcutil <pid> 1000`** — watch old gen grow over time
2. **Take two heap dumps** minutes apart
3. **Compare in MAT** — objects growing in count/size are suspects
4. **Trace reference chains** to GC roots
5. **`jcmd <pid> GC.class_histogram`** — top offenders

---

## Remote Diagnostics

To diagnose a remote JVM:

```bash
# On the remote machine
java -Dcom.sun.management.jmxremote \
     -Dcom.sun.management.jmxremote.port=9999 \
     -Dcom.sun.management.jmxremote.authenticate=false \
     -Dcom.sun.management.jmxremote.ssl=false \
     -jar app.jar

# On your machine
jconsole <remote-host>:9999
```

**Warning:** do not expose unauthenticated JMX to the network. Use SSH
tunnels or authenticated JMX.

### SSH tunnel (safer)

```bash
ssh -L 9999:localhost:9999 user@remote-host
jconsole localhost:9999
```

---

## Native Memory Tracking (NMT)

Track JVM memory *outside* the heap:

```bash
-XX:NativeMemoryTracking=summary
# or detailed for more info
-XX:NativeMemoryTracking=detail
```

Then:

```bash
jcmd <pid> VM.native_memory summary
```

**Output shows:**

- Java Heap
- Class (Metaspace)
- Thread (stacks)
- Code (JIT)
- GC
- Compiler
- Internal
- Symbol
- Native Memory Tracking
- Arena Chunk
- Logging
- Arguments
- Module
- Safepoint
- Synchronization
- Serviceability
- Metaspace

**Use when:** heap looks fine but RSS is high. Tells you which non-heap
area is growing.

---

## Common Production Flags

```bash
# Heap
-Xms4g -Xmx4g

# GC
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200

# Metaspace
-XX:MaxMetaspaceSize=512m

# Diagnostics
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/log/app/
-XX:+ExitOnOutOfMemoryError

# GC logging
-Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags:filecount=5,filesize=20m

# JFR (optional, low overhead)
-XX:StartFlightRecording=filename=/var/log/app/recording.jfr,duration=300s,settings=profile

# Network / DNS tuning (occasional)
-Djava.net.preferIPv4Stack=true
-Dsun.net.inetaddr.ttl=60
```

---

## Tricky Corners ⚠️

**`-Xmx` is not total JVM memory.** Add ~500MB–1GB for Metaspace, thread
stacks, JIT code cache, and direct buffers.

**`jmap -histo:live` triggers a full GC.** Do not run on production
frequently.

**`jmap -dump` (without `live`) captures garbage too.** `.hprof` files can
be huge. Use `-dump:live` if you can afford the GC.

**`jstack -F` is a last resort.** Forced dumps can be incomplete.

**The `nid` in `jstack` is hex.** Use `printf '%x\n' <tid>` to convert
thread IDs from `top -H`.

**`jcmd` requires the same user** (or root) as the target JVM.

**`jinfo -flag` can only modify "manageable" flags.** Most are read-only
after startup.

**JFR overhead is low but not zero.** ~1–2%. Fine for production; be aware
of disk space for recordings.

**`Xlog` syntax changed in Java 9.** Old `-XX:+PrintGCDetails` flags are
removed or deprecated.

**Native memory leaks don't show in heap dumps.** Use NMT.

**JMX remote exposure without auth is a security hole.** Always use
authentication + SSL, or SSH tunnels.

---

## Common Pitfalls

- Forgetting `-XX:+HeapDumpOnOutOfMemoryError` — the OOM happens once, then
  the evidence is gone.
- Not setting `-Xms` = `-Xmx` — resize pauses.
- Running `jmap -histo:live` in production without understanding the GC trigger.
- Ignoring JFR because "profiling is heavy" — JFR is cheap.
- Treating heap usage as the whole story — Metaspace, threads, direct buffers
  also matter.
- Missing `-Xlog:gc` — you can't tune GC without data.
- Using `jconsole` on a remote JVM without a tunnel.
- Confusing `-Xmn` (fixed young size) with GC-era tuning — most modern setups
  don't need it.

---

## Key Interview Tips

- Know the four families: `-X`, `-XX`, `-D`, and how they differ.
- Say "`-Xms` = `-Xmx` in production" without hesitation.
- Name the tools by question: `jps` (which), `jstat` (GC), `jstack` (threads),
  `jmap` (heap), `jcmd` (all).
- Explain JFR as "1–2% overhead, always-on-capable, the modern way to profile."
- For "how do you diagnose a memory leak?", the answer is a workflow:
  `jstat` → two heap dumps → MAT comparison.
- For "how do you find a CPU hog?", `top -H` + `jstack` nid match.
- Mention `jcmd` as the unified tool that supersedes individual commands.

---

## Related

- [JVM Architecture](../fundamentals/jvm-architecture.md) — memory areas and classloaders
- [Memory References](memory-references.md) — GC collectors and tuning
- [Deadlock & Liveness](../concurrency/deadlock-and-liveness.md) — thread dumps for deadlocks
- [Threads Basics](../concurrency/threads-basics.md) — thread lifecycle