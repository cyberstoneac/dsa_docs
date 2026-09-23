# Batch Processing

> **Spring context:** Spring Boot 3.x with Hibernate 6.x. This file covers
> **JDBC-level batching** (Hibernate) and **Spring Batch** (job framework) —
> both are "batch processing" but solve different problems.

## Mental Model

Two distinct meanings of "batch":

```d2
direction: right

jdbc: "JDBC Batching\n(Hibernate)" {
  style.fill: "#bbdefb"
  desc: "Batch many INSERTs/UPDATEs\ninto one round-trip.\nSingle JVM, single job."
}
batch: "Spring Batch\n(framework)" {
  style.fill: "#c8e6c9"
  desc: "Job orchestration:\nsteps, chunking, retries,\nrestartability, scheduling."
}
```

- **JDBC batching** — a performance optimization for bulk writes
- **Spring Batch** — a job framework for processing millions of records with
  reliability

Most interviews focus on **both** — often in the same question.

---

## Part 1 — JDBC Batching with Hibernate

### The problem

Without batching:

```java
for (int i = 0; i < 10_000; i++) {
    repository.save(new User("user" + i));
}
```

Each `save()` issues an `INSERT`. That's 10,000 round-trips to the DB.

### Enabling batching

```properties
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
```

- **`batch_size`** — max statements per batch
- **`order_inserts`** — reorder INSERTs by entity type (helps Hibernate group)
- **`order_updates`** — same for UPDATEs

With `batch_size=50`, 10,000 inserts become 200 round-trips.

### The `IDENTITY` blocker

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;
```

**With `IDENTITY`, Hibernate must issue each INSERT immediately to learn the
generated key.** This **completely disables batching** for that entity.

**Fix:** use `SEQUENCE` with a non-default allocation size:

```java
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "user_seq")
@SequenceGenerator(name = "user_seq", sequenceName = "user_seq",
                   allocationSize = 50)
private Long id;
```

`allocationSize=50` lets Hibernate fetch 50 IDs at once and batch the inserts.

**Alternative:** `TABLE` generator (slower than `SEQUENCE`).

**Interview line:** *"`IDENTITY` disables JDBC batching because Hibernate needs
the generated key immediately. Use `SEQUENCE` with `allocationSize`."*

### The flush + clear pattern

Even with batching enabled, Hibernate keeps **all managed entities in memory**
until the transaction commits. For millions of rows, this OOMs.

**Solution — periodic flush and clear:**

```java
@Transactional
public void importUsers(List<UserCsvRow> rows) {
    int batchSize = 50;

    for (int i = 0; i < rows.size(); i++) {
        entityManager.persist(toEntity(rows.get(i)));

        if (i > 0 && i % batchSize == 0) {
            entityManager.flush();   // send the batch
            entityManager.clear();   // free memory
        }
    }

    entityManager.flush();
    entityManager.clear();
}
```

**Why both:**

- **`flush()`** — writes the queued SQL (the batch)
- **`clear()`** — detaches entities so they can be GC'd

**Without flush + clear, batching doesn't actually happen** — the entire
transaction just holds all entities, and at commit Hibernate still can't
batch (the JDBC driver already saw the SQL). The pattern forces Hibernate to
use the batch API.

**Interview line:** *"The flush + clear pattern is what makes batching
effective — it bounds memory and forces the batch to be sent."*

### How to verify batching is working

Enable Hibernate statistics:

```properties
spring.jpa.properties.hibernate.generate_statistics=true
logging.level.org.hibernate.stat=DEBUG
```

Look for:

```text
Session Metrics {
    ...
    1000000 JDBC batches executed
    ...
}
```

If `JDBC batches executed = 0`, batching isn't active — usually because of
`IDENTITY`, or because the JDBC driver parameter needs `rewriteBatchedStatements=true`
(MySQL).

### JDBC driver quirks

**MySQL:**

```properties
spring.datasource.url=jdbc:mysql://localhost/db?rewriteBatchedStatements=true
```

Without this, MySQL's JDBC driver sends each INSERT separately, defeating
batching.

**PostgreSQL:**

```properties
spring.datasource.url=jdbc:postgresql://localhost/db?reWriteBatchedInserts=true
```

Required since PostgreSQL 9.x to combine inserts.

**Oracle / SQL Server:** batching works out of the box.

**Interview line:** *"MySQL and PostgreSQL need explicit JDBC URL flags for
real batching."*

### `saveAll()` — does it batch?

```java
repository.saveAll(entities);
```

**Not always.** It calls `save()` in a loop. If the entity uses `IDENTITY`,
no batching. With `SEQUENCE` and `batch_size`, Hibernate accumulates and
batches at flush.

**Better:** use `persist()` directly in a `flush + clear` loop for full
control.

### `JdbcTemplate.batchUpdate`

For pure bulk operations (no entity lifecycle), skip JPA:

```java
@Autowired
private JdbcTemplate jdbc;

public void bulkInsert(List<User> users) {
    jdbc.batchUpdate(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        users,
        1000,   // batch size
        (ps, user) -> {
            ps.setString(1, user.name());
            ps.setString(2, user.email());
        }
    );
}
```

**Fastest option** — bypasses Hibernate entirely. Use when you don't need
entity features (dirty checking, cascades, lifecycle callbacks).

**Interview line:** *"For pure bulk inserts with no entity logic, `JdbcTemplate.batchUpdate`
is faster than JPA."*

---

## Part 2 — Spring Batch Framework

Spring Batch is a **framework for reliable batch jobs**. It adds:

- Chunk-oriented processing
- Restartability (skip failed items, resume from last commit)
- Retry / skip logic
- Partitioning and parallel steps
- Scheduling integration
- Job metadata (execution history)

### When to use Spring Batch

| Use Spring Batch | Use plain loop |
|---|---|
| Millions of records | Thousands |
| Restart needed after failure | Failure = start over |
| Complex job (multi-step) | Single operation |
| Scheduling required | Manual trigger |
| Auditing / execution history | Not needed |

### The core model

```d2
direction: right

job: "Job" {
  style.fill: "#bbdefb"
  desc: "The whole batch process"
}
step: "Step" {
  style.fill: "#c8e6c9"
  desc: "One unit of work"
}
reader: "ItemReader" {
  style.fill: "#fff9c4"
}
processor: "ItemProcessor" {
  style.fill: "#ffe0b2"
}
writer: "ItemWriter" {
  style.fill: "#ffcc80"
}

job.step -> step: "1..N"
step.reader -> reader: ""
reader.processor -> processor: ""
processor.writer -> writer: ""
```

**A Job** has one or more **Steps**. **A Step** runs a **chunk loop**:
read → process → write, in transactions of a configurable size.

### A minimal job

```java
@Configuration
public class UserImportJob {

    @Bean
    public Job importUserJob(JobRepository jobRepository,
                             Step importStep,
                             JobCompletionNotificationListener listener) {
        return new JobBuilder("importUserJob", jobRepository)
                .incrementer(new RunIdIncrementer())
                .listener(listener)
                .start(importStep)
                .build();
    }

    @Bean
    public Step importStep(JobRepository jobRepository,
                           PlatformTransactionManager txManager,
                           ItemReader<UserCsvRow> reader,
                           ItemProcessor<UserCsvRow, User> processor,
                           ItemWriter<User> writer) {
        return new StepBuilder("importStep", jobRepository)
                .<UserCsvRow, User>chunk(100, txManager)
                .reader(reader)
                .processor(processor)
                .writer(writer)
                .build();
    }
}
```

### Readers

**Flat file reader:**

```java
@Bean
public FlatFileItemReader<UserCsvRow> reader() {
    return new FlatFileItemReaderBuilder<UserCsvRow>()
            .name("userReader")
            .resource(new ClassPathResource("users.csv"))
            .delimited()
            .names("name", "email", "age")
            .targetType(UserCsvRow.class)
            .build();
}
```

**JPA reader (paging):**

```java
@Bean
public JpaPagingItemReader<User> reader(EntityManagerFactory emf) {
    return new JpaPagingItemReaderBuilder<User>()
            .name("userReader")
            .entityManagerFactory(emf)
            .queryString("SELECT u FROM User u WHERE u.processed = false")
            .pageSize(100)
            .build();
}
```

**Important:** `JpaPagingItemReader` uses `setFirstResult`/`setMaxResults`.
For huge tables, this is slow (offset scans). **Better:** cursor-based readers
or key-range paging.

### Processor

```java
@Bean
public ItemProcessor<UserCsvRow, User> processor() {
    return row -> {
        if (row.email() == null || row.email().isBlank()) {
            return null;   // skip this item
        }
        return new User(row.name(), row.email(), row.age());
    };
}
```

**Returning `null` filters out the item** — useful for validation.

### Writer

```java
@Bean
public JpaItemWriter<User> writer(EntityManagerFactory emf) {
    JpaItemWriter<User> writer = new JpaItemWriter<>();
    writer.setEntityManagerFactory(emf);
    return writer;
}
```

Or use `JdbcBatchItemWriter` for higher throughput:

```java
@Bean
public JdbcBatchItemWriter<User> writer(DataSource dataSource) {
    return new JdbcBatchItemWriterBuilder<User>()
            .dataSource(dataSource)
            .sql("INSERT INTO users (name, email, age) VALUES (:name, :email, :age)")
            .beanMapped()
            .build();
}
```

### Chunk size

```java
.<UserCsvRow, User>chunk(100, txManager)
```

- **Chunk size** — items processed per transaction
- Each chunk is: read N items → process each → write all → commit
- Larger chunks: fewer commits, more memory
- Smaller chunks: more commits, less memory

**Rule of thumb:** 100–1000 for typical imports. Tune based on memory and DB
round-trips.

### Skip / retry

```java
stepBuilder
    .<UserCsvRow, User>chunk(100, txManager)
    .reader(reader)
    .processor(processor)
    .writer(writer)
    .faultTolerant()
    .skip(InvalidRowException.class)
    .skipLimit(10)
    .retry(TransientException.class)
    .retryLimit(3)
    .build();
```

- **Skip** — continue on specific exceptions, up to a limit
- **Retry** — retry specific exceptions, up to a limit

**Interview line:** *"Skip for bad data, retry for transient failures."*

### Restartability

Batch jobs are **restartable by default**. Job metadata is stored in:

- `BATCH_JOB_INSTANCE`
- `BATCH_JOB_EXECUTION`
- `BATCH_STEP_EXECUTION`
- `BATCH_JOB_EXECUTION_CONTEXT`

If a job fails, restarting resumes from the last successful chunk.

**Requires:**

- `JobRepository` with persistent storage (Spring Boot auto-configures H2
  in-memory, or you point it at your DB)
- Idempotent `ItemReader` (usually the case with paging/cursor readers)

### Scheduling

**Spring `@Scheduled`:**

```java
@Component
public class ScheduledRunner {
    private final JobLauncher launcher;
    private final Job job;

    @Scheduled(cron = "0 0 2 * * *")   // 2 AM daily
    public void run() throws Exception {
        launcher.run(job, new JobParametersBuilder()
                .addLong("time", System.currentTimeMillis())
                .toJobParameters());
    }
}
```

**Spring Cloud Data Flow / Quartz** for more advanced scheduling.

### Partitioning

For very large jobs, partition the data:

```java
@Bean
public Step partitionedStep(Step workerStep, Partitioner partitioner) {
    return stepBuilder
            .partitioner("workerStep", partitioner)
            .step(workerStep)
            .gridSize(8)                 // 8 parallel partitions
            .taskExecutor(taskExecutor())
            .build();
}
```

Each partition is a step instance processing a slice of the data.

**Worker step** reads/processes/writes its partition.

**Partitioner** decides how to split — e.g., by ID range, by region, by file.

---

## Combining JDBC Batching + Spring Batch

For maximum throughput:

1. Use `JdbcBatchItemWriter` (bypasses Hibernate)
2. Set `hibernate.jdbc.batch_size` for any JPA you still use
3. Use `SEQUENCE` IDs
4. Chunk size ~1000
5. Partition if needed

```java
@Bean
public JdbcBatchItemWriter<User> writer(DataSource dataSource) {
    return new JdbcBatchItemWriterBuilder<User>()
            .dataSource(dataSource)
            .sql("INSERT INTO users (name, email, age) VALUES (?, ?, ?)")
            .itemPreparedStatementSetter((user, ps) -> {
                ps.setString(1, user.name());
                ps.setString(2, user.email());
                ps.setInt(3, user.age());
            })
            .build();
}
```

This combines chunked transactions with JDBC-level batching — the fastest
pattern for bulk inserts in Spring.

---

## Common Configuration Properties

```properties
# Hibernate batching
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
spring.jpa.properties.hibernate.jdbc.batch_versioned_data=true

# Statistics (to verify batching)
spring.jpa.properties.hibernate.generate_statistics=true

# Spring Batch
spring.batch.job.enabled=false           # don't auto-run jobs on startup
spring.batch.jdbc.initialize-schema=always
spring.batch.job.name=myJob              # run a specific job on startup
```

---

## Tricky Corners ⚠️

**`GenerationType.IDENTITY` disables JDBC batching.** Use `SEQUENCE` with
`allocationSize`.

**Without `flush()` + `clear()`, batching doesn't help.** The persistence
context holds everything.

**MySQL needs `rewriteBatchedStatements=true`** in the JDBC URL. Otherwise
no real batching.

**PostgreSQL needs `reWriteBatchedInserts=true`** since 9.x.

**`saveAll()` doesn't guarantee batching.** It's just a loop.

**`JpaPagingItemReader` uses offset paging — slow on huge tables.** Use
cursor readers or key-range.

**Spring Batch metadata tables are required for restartability.** Boot
auto-configures them for embedded DBs; for external DBs, run the schema
scripts.

**Don't skip the `RunIdIncrementer`** if you want to rerun the same job.
Without it, Spring Batch treats reruns as duplicate executions.

**`@Scheduled` runs on every instance** in a cluster. Use ShedLock or
Quartz clustering.

**Chunk size too large → memory pressure.** Too small → many commits and DB
round-trips.

**`entityManager.clear()` detaches entities**, so subsequent code touching
them triggers a reload.

**Transaction propagation matters** in chunked steps. Each chunk is its own
transaction (default).

**`ItemProcessor` returning `null` filters the item** — often used for
validation.

**Skip limits are per-step, not per-chunk.** Exceeding the limit fails the
step.

**Spring Batch jobs run single-threaded by default.** Enable async processors
or partitioning for parallelism.

---

## Common Pitfalls

- Using `IDENTITY` and wondering why batching does nothing.
- Forgetting `flush` + `clear` in a loop.
- Not setting MySQL/PostgreSQL URL flags.
- `saveAll()` on a million entities.
- Chunk size tuned without measuring.
- Using `JpaPagingItemReader` on huge tables without optimization.
- Skipping `RunIdIncrementer` and being unable to rerun a job.
- Running `@Scheduled` jobs in a cluster without locking.
- Ignoring Batch metadata tables in production.

---

## Key Interview Tips

- Say **"`IDENTITY` disables batching"** — the top trap.
- Explain the **flush + clear pattern** in one sentence.
- Mention **MySQL/PostgreSQL JDBC URL flags** for real batching.
- Know when to use **`JdbcTemplate.batchUpdate`** vs JPA.
- Explain **chunk-oriented processing** in Spring Batch: read → process →
  write in transactions.
- Say **"Spring Batch is restartable by default."**
- Mention **partitioning** for parallel execution.
- Know that **`ItemProcessor` returning `null` filters the item**.

---

## Related

- [Spring Data JPA](spring-data-jpa.md) — the JPA layer that batching optimizes
- [N+1 Problem](n-plus-one.md) — a common pitfall in batch reads
- [Transaction Management](../transactions/transaction-management.md) —
  chunk-level transaction boundaries
- [Configuration](../boot/configuration.md) — property binding