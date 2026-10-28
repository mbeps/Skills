# Common Architectural Anti-Patterns

This reference catalogues common structural anti-patterns found in modern web and distributed applications, complete with root causes, architectural impacts, and concrete remedies.

---

## 1. The Split-Brain Cache / Competing State Engines

### Architectural Flaw
The application maintains two or more independent caching or storage mechanisms for the exact same entity domain without a unified invalidation protocol. For example, maintaining a global Zustand store for entities, a secondary custom pub/sub store with TTL timers for models, and local `useState` for another resource.

### Failure & Performance Impact
- Mutations in one component invalidate Cache A but leave Cache B with stale data.
- Multiple uncoordinated components mount and trigger duplicate simultaneous server queries for the identical dataset.
- Invalidation events clear in-memory state to empty collections without triggering re-fetches, causing intermittent blank screens.

### Remediation
Consolidate onto a single state architecture. Ensure all resource hydration passes through one coordinator with atomic deduplication of in-flight promises.

---

## 2. Dual-Write Drift without Outbox or Compensation

### Architectural Flaw
A service writes to Database A (e.g., PostgreSQL) and then writes to External Store B (e.g., S3 or a Vector Database) sequentially without a distributed transaction, transactional outbox, or compensating rollback handler.

### Failure & Performance Impact
- If Store B fails, Database A retains the committed record pointing to nonexistent assets.
- If Database A commits first and Store B is wrapped in a `try/catch` that swallows errors, the two datastores drift permanently out of sync.
- Read operations from Store B return stale or missing entities, breaking domain consistency.

### Remediation
- Use the **Compensating Transaction Pattern**: Write the database row first with a `"pending"` status, perform the external store operation, and flip to `"ready"` on success. In the `catch` block, immediately delete or mark `"failed"` the primary row.
- Periodically run an out-of-band reconciliation worker to clean up orphaned external assets.

---

## 3. Phantom Durability / False Workflow Checkpointing

### Architectural Flaw
A durable background workflow engine (e.g., Inngest, Temporal) wraps a multi-step pipeline in a single monolithic `step.run` checkpoint or embeds an uncheckpointed inner loop that executes all domain steps at once.

### Failure & Performance Impact
- If Step 4 fails, the engine retries the entire monolithic checkpoint from Step 1, repeating expensive side-effects, re-billing AI API tokens, and duplicating external mutations.
- When an inner loop handles a pause/review gate, resume mathematics calculates offsets from the outer step index, causing already completed steps to re-execute upon approval.

### Remediation
Map domain steps 1:1 to workflow checkpoints. Each atomic unit of work with external side-effects or latency $>5\text{s}$ must have its own isolated step checkpoint.

---

## 4. Premature Coordinator Flipping in Fan-Out Jobs

### Architectural Flaw
A coordinator function fans out $N$ concurrent child jobs and leaves parent status determination to individual child completion handlers using a query like `WHERE status != 'ready'`.

### Failure & Performance Impact
- If Child 1 completes before Children $2\dots N$ transition from `"ready"` (from a previous run) to `"processing"`, the query sees zero non-ready documents and prematurely marks the entire batch `"completed"` while work is still pending.
- Conversely, if Children $2\dots N$ are in progress, Child 1 marks the coordinator `"stale"` or `"failed"` while other children are running normally.
- Client polling loops observe premature `"stale"` states and re-trigger fan-out in an infinite re-index loop.

### Remediation
Atomically initialise all child records to `"pending"` within the same database transaction before dispatching the fan-out event. Transition the coordinator status only when checking that zero children remain in `"pending"` or `"processing"`.

---

## 5. Synchronous HTTP Blocking on Streaming Hot Paths

### Architectural Flaw
Streaming generation handlers emit every single token or delta by executing an `await` against an external HTTP pub/sub endpoint (or unthrottled `sessionStorage.setItem` on the client).

### Failure & Performance Impact
- Throughput is artificially capped at the network round-trip time of the pub/sub API (e.g., 20ms per token = max 50 tokens/sec), stalling the AI model's native inference stream.
- In client browsers, synchronous JSON serialisation of multi-megabyte thread histories on every incoming character freezes the UI thread ($O(N^2)$ serialisation cost).

### Remediation
- Buffer token streams on the server with a short micro-batch window (e.g., 30–50ms) or flush on word boundaries.
- On the client, throttle local storage caching to debounced intervals ($\ge 500\text{ms}$) and leverage asynchronous memory state for active rendering.

---

## 6. Over-Fetching Text Columns for Structural Metrics

### Architectural Flaw
Application queries select massive text, binary, or JSONB columns (e.g., file contents, prompt catalogues) solely to compute structural metrics like `octet_length`, item counts, or existence checks in application memory.

### Failure & Performance Impact
- Database connection pools saturate transferring megabytes of discarded text over the wire.
- Node.js event loops suffer garbage collection pauses allocating large temporary strings.

### Remediation
Push calculations into the database engine:
- Use `SELECT octet_length(content)` instead of `Buffer.byteLength(r.content)` in application code.
- Project only structural columns (`id, name, description`) when building navigation trees or tool catalogues, loading full content only upon explicit request.

---

## 7. Process-Local In-Memory Singletons in Multi-Instance or Serverless Deployments

### Architectural Flaw
Application services rely on Node.js module-scope variables, `Map`s, or in-memory sets to maintain global locking, abort registries, deduplication windows, or rate limiters across concurrent client requests.

### Failure & Performance Impact
- In serverless, containerised, or autoscaling environments, requests hit different isolated process instances. Process A cannot see or abort streams registered in Process B, leading to orphaned compute runs and broken mutual exclusion.

### Remediation
- For multi-instance deployments, back coordination primitives with centralized state stores (Redis distributed locks, PostgreSQL advisory locks, or database row statuses).
- In pragmatic single-deployment architectures, explicitly document the single-process constraint and provide a documented upgrade path for distributed scaling.
