# Architectural Evaluation Rubric

Evaluate every system and cross-system boundary against four foundational architectural criteria.

---

## 1. Simplicity & Overengineering

Assess whether abstractions, layers, and data structures serve genuine operational requirements or introduce accidental complexity.

### Evaluation Checklist
- **Indirection Debt:**
  - Are there more than 3 layer hops between the public boundary (API route/Server Action) and the execution logic?
  - Do pass-through files merely forward arguments without validation, transformation, or domain logic?
- **Competing Engines & Split-Brain State:**
  - Are multiple storage engines or caching layers tracking the same logical entity (e.g., entity state stored in PostgreSQL, replicated in a vector database, and cached in a custom client-side store)?
  - Is there duplicate logic between synchronous actions and background worker functions?
- **YAGNI Violations:**
  - Are there configuration switches, enum values, or fields implemented and persisted but never read by execution logic (e.g., dead `dryRun` options)?
  - Are generic abstraction layers built for hypothetical multi-cloud or multi-database swaps where a single concrete implementation suffices?
- **Granularity & Single-Use Interfaces:**
  - Are single-line operations split across isolated files to satisfy arbitrary line-count rules rather than domain cohesion?

### Severity Heuristic
- **High Severity:** Multiple competing state stores requiring manual synchronisation across boundaries.
- **Medium Severity:** Redundant wrapper layers or dead configuration paths bloating maintenance cognitive load.
- **Low Severity:** Micro-file fragmentation without cross-boundary state risks.

---

## 2. State Synchronisation & Failure Resilience

Assess how subsystems maintain consistency across process boundaries, asynchronous queues, network hops, and browser storage.

### Evaluation Checklist
- **Dual-Write Drift & Compensation:**
  - When persisting across two stores (e.g., PostgreSQL + S3, or PostgreSQL + Qdrant), is there an atomic order of operations?
  - If store #2 fails, does store #1 compensate or roll back, or does it leave an unmonitored orphan?
- **Concurrency & Idempotency Controls:**
  - Are concurrent writes to the same aggregate protected by optimistic concurrency controls (version columns, `SELECT ... FOR UPDATE`), or do parallel mutations cause lost updates?
  - Do asynchronous jobs, webhooks, or execution actions enforce idempotency keys on `eventId` or `runId`, or can network retries execute duplicate mutations?
- **In-Flight & Lifecycle Orphaned State:**
  - If a user cancels, aborts, or navigates away mid-operation, does the server leave decoupled temporary rows (e.g., scratchpad entries, temporary attachments) permanently orphaned in the database?
  - Does stream disconnection terminate backend compute, or does compute run to completion unobserved?
- **Event-Driven Race Conditions:**
  - In fan-out workflows, do early completions prematurely flip coordinator states (e.g., marking a batch `"ready"` while sister workers are still `"pending"`)?
  - Can optimistic UI state clobber concurrent background stream updates on server action failure?
- **Timeout & Checkpointing Semantics:**
  - In durable workflows, do review gates or external events resolve to `null` on timeout, and does the code handle that `null` without assuming success?
  - Are step checkpoints genuinely granular, or are multiple steps collapsed into a single monolithic block?

### Severity Heuristic
- **Critical (P0):** Permanent data loss, silent state corruption, or infinite loop triggers under common failure modes.
- **High (P1):** Unhandled cancellations causing storage leakage or orphan buildup over time.
- **Medium (P2):** Transient UI desynchronisation resolved by manual page reload.

---

## 3. Failure Isolation & Degradation

Assess whether a failure in an auxiliary or supporting subsystem cascades into the primary value engine.

### Evaluation Checklist
- **Graceful Degradation:**
  - Can the core interaction loop proceed if an auxiliary service (vector search, memory cache, telemetry) fails?
  - Are non-critical operations wrapped in non-fatal boundaries (`try/catch` with fallback)?
- **Blast Radius Containment:**
  - Does an external third-party rate limit (e.g., LLM provider 429) bring down background workers, or is it isolated with backoff and user-facing status?
  - Are destructive actions guarded by transaction boundaries so partial failures do not commit broken state?
- **Input Validation & Tenancy at Boundaries:**
  - Are untrusted inputs sanitised at the earliest boundary before touching downstream network layers (e.g., SSRF checks before HTTP dispatch, path traversal checks before disk/S3 writes)?
  - Does tenancy, user ownership, and authorization context survive asynchronous queue dispatch and inter-service boundaries, or do background jobs run un-scoped?

---

## 4. Runtime Performance & Scale Bottlenecks

Assess computational throughput, network round-trips, and latency characteristics under production load.

### Evaluation Checklist
- **N+1 Database & Network Round-Trips:**
  - Are batched entities fetched via single `IN (...)` queries or iterated in sequential `for` loops with per-item `SELECT` queries?
  - Are discovery or metadata operations firing sequential HTTP requests instead of concurrent `Promise.all` batches?
- **Event-Loop Blocking:**
  - Are heavy synchronous operations (large ZIP decompression, image parsing, regexes on large buffers) executed on the main Node.js event loop?
- **Unthrottled Streaming Overhead:**
  - Does the server publish every single token delta over external HTTP pub/sub APIs, or are deltas batched/buffered into realistic frame intervals?
  - Does the client synchronously serialise large payloads (e.g., `JSON.stringify` to `sessionStorage`) on every incoming SSE chunk?
- **Over-Fetching:**
  - Are full multi-megabyte `text` or `jsonb` columns queried when only existence, counts, or byte sizes are needed?
