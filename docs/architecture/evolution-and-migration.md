# Evolution & Migration

> **Context:** At lead level, you rarely design greenfield. You inherit systems and evolve them while the business keeps running. This file covers how to migrate databases, services, and architectures without stopping delivery — using incremental techniques like strangler fig, expand-contract, and parallel runs.

## Mental Model

Systems evolve. The two failure modes are:



1. **Frozen systems** — no one touches them out of fear.
2. **Big-bang rewrites** — months of parallel work, then a risky cutover.

The lead's job is to make evolution **continuous, incremental, and reversible**.

```d2
direction: right

old: Legacy System
new: New System
traffic: Traffic Router
users: Users

users -> traffic
traffic -> old
traffic -> new
```

**Rule:** the only safe way to replace a system is to route traffic to it incrementally while both run. Everything else is a bet.

## Strangler Fig

Named after the vine that grows around a tree, gradually replacing it. The pattern:



1. **Facade** — put a routing layer in front of the legacy system.
2. **Extract** — carve out one capability at a time into a new implementation.
3. **Route** — direct traffic to the new implementation for that capability.
4. **Retire** — when the legacy path has no traffic, delete it.

```d2
direction: right

client: Client
facade: Facade / Router
legacy: Legacy Monolith
newA: New Service A
newB: New Service B

client -> facade
facade -> legacy
facade -> newA
facade -> newB
```

### Rules

- **One capability at a time.** No big bang.
- **The facade must be able to route per-request**, not per-deployment.
- **Data migration is the hard part.** Plan it explicitly.
- **Measure by traffic migrated**, not by lines of new code.
- **Keep the legacy path alive** until the new one is proven.
- **Rollback is a router flip**, not a redeploy.

### What to migrate first

- **Peripheral capabilities** — notifications, reports.
- **High-churn capabilities** — where the legacy is slow to change.
- **Low-risk capabilities** — where failure has little user impact.

Avoid migrating the **core transactional path** first — it's the riskiest and slowest.

## Expand-Contract (Parallel Change)

The pattern for changing a **shared contract** without breaking consumers.

Three phases:



1. **Expand** — add the new shape alongside the old. Both work.
2. **Migrate** — update consumers to use the new shape.
3. **Contract** — remove the old shape.

```d2
direction: right

expand: "1. Expand\\n(old + new coexist)"
migrate: "2. Migrate\\n(consumers move to new)"
contract: "3. Contract\\n(remove old)"

expand -> migrate
migrate -> contract
```

### Example: renaming a column

```sql
-- Phase 1: Expand
ALTER TABLE orders ADD COLUMN customer_id UUID;
UPDATE orders SET customer_id = customer_uuid;
-- Trigger or app code keeps both in sync

-- Phase 2: Migrate
-- App reads/writes customer_id; customer_uuid still updated

-- Phase 3: Contract
ALTER TABLE orders DROP COLUMN customer_uuid;
```

### Example: changing an API field

```
Phase 1: Response includes both `user_id` and `customer_id`
Phase 2: Clients migrate to `customer_id`; monitor usage of `user_id`
Phase 3: Remove `user_id` from response
```

**Rules:**

- Every change is additive first.
- Never rename or remove in one step.
- Monitor usage of the old field before removing.
- Automate the sync if possible (triggers, dual writes).

## Database Migrations

The riskiest part of any migration. Always expand-contract.

| Change | Safe approach |
|---|---|
| Add column | Add nullable, backfill, make NOT NULL later |
| Rename column | Add new, dual-write, migrate reads, drop old |
| Change type | Add new column, dual-write, migrate, drop old |
| Split table | Add new, dual-write, backfill, migrate reads, drop old |
| Merge tables | Same as split |
| Add index | `CREATE INDEX CONCURRENTLY` (Postgres) |
| Drop column | Stop writing, wait, stop reading, drop |

**Rules:**

- **Never lock the table** in a hot path. Use `CONCURRENTLY` where available.
- **Backfill in batches** with rate limiting.
- **Dual-write** during transition, with a reconciliation job.
- **Verify** old and new match before cutting over.
- **Keep the old shape** until rollback window closes.

### Expand-contract with Flyway/Liquibase

```sql
-- V1__add_customer_id.sql (expand)
ALTER TABLE orders ADD COLUMN customer_id UUID;

-- V2__backfill_customer_id.sql (backfill in batches via app job)

-- V3__not_null_customer_id.sql (after backfill complete)
ALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL;

-- V4__drop_customer_uuid.sql (contract, weeks later)
ALTER TABLE orders DROP COLUMN customer_uuid;
```

Each migration is backward-compatible with the previous app version. **Never deploy a migration that breaks the currently running app.**

## Service Extraction

Extracting a service from a monolith:



1. **Identify the boundary** (bounded context, capability).
2. **Create the service** with its own DB (initially a copy or read replica).
3. **Route reads** to the new service (low risk).
4. **Dual-write** or **CDC** to keep data in sync.
5. **Route writes** to the new service.
6. **Remove the old code** from the monolith.
7. **Delete the shared tables** (carefully).

**Rules:**

- Extract **reads first**, writes second.
- Keep the old path alive as a fallback until proven.
- Use CDC or outbox, not dual-write-in-app, if possible.
- Measure: latency, error rate, correctness (old vs new).
- Migrate one consumer at a time.

## Parallel Run

Run old and new systems side-by-side and compare outputs.

```d2
direction: right

input: Input
old: Old System
new: New System
compare: Comparator
result: "Result (old wins)"

input -> old
input -> new
old -> compare
new -> compare
compare -> result
```

**Use cases:**
- Rewriting a complex algorithm.
- Migrating a data pipeline.
- Changing a computation.

**Rules:**

- New system's output is **discarded** (or shadowed).
- Compare outputs continuously, alert on divergence.
- Run in production-like load.
- Cut over only after sustained zero divergence.

## Feature Flags for Migration

Feature flags let you route users/requests to old or new implementations without deploying.

```java
if (flags.isEnabled("new-pricing-engine", user)) {
    return newPricingEngine.calculate(order);
} else {
    return legacyPricingEngine.calculate(order);
}
```

**Rules:**

- **Per-user or per-tenant** rollout, not just global.
- **Always safe default** (old behavior) if the flag service is down.
- **Log which path was taken** for observability.
- **Remove the flag** when migration is complete.

**Anti-pattern:** permanent flags. A flag without an expiry is technical debt.

## Multi-Phase Migrations

For large migrations (database engine, cloud provider, monolith → services), plan phases:

| Phase | Goal | Duration |
|---|---|---|
| 0. Discovery | Map dependencies, data, consumers | Weeks |
| 1. Foundation | Set up target, tooling, observability | Weeks |
| 2. Dual-run | Old + new, compare | Weeks to months |
| 3. Incremental cutover | Per-capability or per-tenant | Months |
| 4. Full cutover | All traffic on new | Days |
| 5. Decommission | Remove old | Weeks |

**Rules:**

- **Every phase has a rollback plan.**
- **Every phase has a clear exit criterion.**
- **Communicate status** to stakeholders weekly.
- **Don't skip the dual-run phase.** It's where you find the bugs.

## Communication During Migration

Migrations affect stakeholders, other teams, and customers. Communicate:



- **What** is changing.
- **When** it will be done.
- **What** is expected of consumers (API changes, deprecations).
- **What** rollback looks like.
- **How** to contact the migration team.

Deprecation timeline example:
- **T-90 days:** announce deprecation.
- **T-60 days:** stop supporting new consumers.
- **T-30 days:** stop writing the old field.
- **T-0:** remove.

**Rule:** consumers need time. Rushing a deprecation creates outages.

## Anti-Patterns

- **Big-bang rewrite** — high risk, low success rate.
- **Big-bang database migration** — even riskier.
- **Dual-write without reconciliation** — silent divergence.
- **Migration without observability** — you can't tell if it's working.
- **Migration without rollback** — one-way bet.
- **Migration without consumers' input** — surprises downstream.
- **Permanent flags** — tech debt disguised as migration.
- **Copying legacy bugs** — sometimes intentional, sometimes accidental.

## Tricky Corners ⚠️

- **Data migration is the hard part**, not code migration.
- **Dual-writes can diverge silently.** Reconcile continuously.
- **CDC is at-least-once.** Consumers must be idempotent.
- **Expand-contract requires all consumers to migrate.** Track them.
- **Rollback windows are finite.** After the window, forward-fix is the only option.
- **Schema changes must be backward-compatible** with the currently deployed app.
- **Feature flags must default safe.** Flag service down ≠ new behavior on.
- **Parallel runs double your cost** during the migration. Budget for it.
- **Consumers will not migrate without a deadline.** Deprecation needs teeth.
- **Migrations take longer than planned.** Plan for 2x.

## Common Pitfalls

- Underestimating data migration.
- Skipping the dual-run phase.
- Dual-write without reconciliation.
- No observability for old vs new comparison.
- No rollback plan.
- Not communicating with consumers.
- Permanent feature flags.
- Deploying an incompatible schema change.
- Cutover during peak traffic (or a Friday).
- Celebrating cutover before decommission.

## Key Interview Tips

- Lead with **"the only safe way to replace a system is incremental — strangler fig, expand-contract, parallel runs."**
- For "how do you migrate a monolith to microservices?", answer **"strangler fig: facade, extract one capability at a time, route traffic incrementally, decommission when empty."**
- For "how do you rename a column in production?", answer **"expand-contract: add new, dual-write, migrate reads, drop old after rollback window."**
- For "how do you rewrite an algorithm?", answer **"parallel run: old and new side-by-side, compare outputs, cut over after sustained zero divergence."**
- For "how do you roll back a migration?", answer **"router flip for services; for data, keep the old shape until the rollback window closes."**
- For "how do you get consumers to migrate?", answer **"deprecation timeline, communication, and actual removal — a deadline with teeth."**
- Always mention **observability** and **rollback** in your migration plan.

## Related

- [Architecture index](index.md)
- [Decision Frameworks](decision-frameworks.md)
- [Trade-off Analysis](trade-off-analysis.md)
- [ADRs & Documentation](adrs-and-documentation.md)
- [Microservices Patterns → Decomposition](../microservices-patterns/decomposition.md)
- [Leadership → Technical Debt](../leadership/technical-debt.md)