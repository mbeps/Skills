# System Criticality Ranking Framework

This reference defines the methodology for decomposing any software project into its constituent systems and ranking them objectively from most important to least important.

---

## 1. The 4-Tier Criticality Taxonomy

Every project consists of interconnected systems that serve distinct operational roles. Categorise every identified system into one of four tiers:

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: Core Value Engine & Primary State of Record   │
│  (Data integrity, primary transactions, core business) │
├────────────────────────────────────────────────────────┤
│  Tier 2: Supporting Domain Services & Durable Workflows│
│  (Background pipelines, asynchronous jobs, search/RAG) │
├────────────────────────────────────────────────────────┤
│  Tier 3: Peripheral Capabilities, Aggregations & Caches│
│  (Read-model caches, notifications, export formatting) │
├────────────────────────────────────────────────────────┤
│  Tier 4: Auxiliary, Ephemeral & Developer Tooling      │
│  (Dev harnesses, seeders, debug mocks, admin helpers)  │
└────────────────────────────────────────────────────────┘
```

### Tier 1: Core Value Engine & Primary State of Record (Mission-Critical)
- **Definition:** The fundamental business logic and data store that defines why the application exists. If this tier fails or suffers corruption, the business cannot operate and data is permanently compromised.
- **Typical Components:**
  - Primary relational/transactional database (PostgreSQL, MySQL, primary document store)
  - Core domain models, transactional boundaries, and state transition engines
  - Security, authentication, identity, and tenancy isolation boundaries
  - Real-time user interaction loop (e.g., interactive chat generation, checkout engine, live streaming controller)
- **Impact of Failure:** Immediate revenue loss, irreversible data corruption, compliance violation, or complete user lockout.

### Tier 2: Supporting Domain Services & Durable Workflows (Business-Critical)
- **Definition:** Asynchronous, heavy-lifting, or stateful subsystems that execute core business workflows out-of-band or enrich the core value engine.
- **Typical Components:**
  - Durable workflow orchestrators and queue workers (Inngest, Temporal, BullMQ, Celery)
  - Vector indexing, semantic search, and RAG ingestion pipelines (Qdrant, pgvector, Milvus)
  - Third-party core integrations and connectors (external AI model APIs, payment gateways, MCP clients)
  - Persistent artifact and file storage management (S3, MinIO, GCS)
- **Impact of Failure:** Delayed background processing, degraded search relevance, deferred workflow execution. Core interactive loop remains functional with graceful degradation.

### Tier 3: Peripheral Capabilities, Aggregations & Caching (Operational)
- **Definition:** Non-transactional capabilities, read-side performance optimisations, and secondary features that enhance user experience.
- **Typical Components:**
  - Read-model caches and in-memory key-value stores (Redis cache, client-side session stores)
  - Reporting, analytics, event telemetry, and audit logging sinks
  - Batch export/import formatters (CSV, XLSX, PDF serialisers)
  - Secondary user notifications and transactional email dispatchers
- **Impact of Failure:** Slower page renders, missing non-critical notifications, temporary inability to download reports. Core domain data and workflows remain fully intact.

### Tier 4: Auxiliary, Ephemeral & Developer Tooling (Non-Critical)
- **Definition:** Infrastructure, utilities, and scaffolding that support development, testing, inspection, or administration but do not serve end-user business traffic directly.
- **Typical Components:**
  - Local container compose setups and mock services
  - Database seeding scripts and demo fixtures
  - In-memory scratchpads, dev-only run inspectors, and telemetry consoles
  - Code generators, migration CLI wrappers, and internal test harnesses
- **Impact of Failure:** Developer friction or broken test runners. Zero end-user or production impact.

---

## 2. Objective Criticality Scoring Matrix

When sorting systems within and across tiers, score each subsystem across five dimensions (1 = lowest, 5 = highest):

| Dimension | Weight | 1 (Low) | 3 (Moderate) | 5 (Critical) |
|---|---|---|---|---|
| **Blast Radius ($B$)** | 25% | Single isolated component | Entire peripheral feature | Global application outage |
| **Data Integrity Risk ($D$)** | 30% | Ephemeral / easily re-computed | Recoverable with background replay | Irreversible state corruption / data loss |
| **User Value Immediacy ($V$)** | 20% | Admin / dev-facing only | Async background value | Real-time interactive blocking loop |
| **Recovery Complexity ($R$)** | 15% | Automatic restart / zero state | Cache warm-up / job re-try | Manual database restoration / reconciliation |
| **Replacement Cost ($C$)** | 10% | Trivial utility | Standard library swap | Deep structural re-architecture |

$$\text{Criticality Score} = 0.30D + 0.25B + 0.20V + 0.15R + 0.10C$$

- **Score $\ge 4.0$:** Tier 1 (Mission-Critical)
- **Score $3.0 - 3.9$:** Tier 2 (Business-Critical)
- **Score $2.0 - 2.9$:** Tier 3 (Operational)
- **Score $< 2.0$:** Tier 4 (Auxiliary)

---

## 3. Step-by-Step System Decomposition Process

1. **Map Entrypoints & Data Stores:**
   - Scan routing boundaries (HTTP routes, RPCs, WebSocket/SSE endpoints, Inngest triggers).
   - Enumerate all state storage engines (PostgreSQL, Qdrant, S3/MinIO, Redis, LocalStorage).

2. **Group Code into Bounded Subsystems:**
   - Cluster files by cohesion and ownership (e.g., `lib/chat` + `app/api/chat` + `drizzle/schemas/chat` = "Interactive Chat & Branching Subsystem").
   - Define the explicit boundary, responsibilities, and inputs/outputs of each cluster.

3. **Calculate Criticality Scores:**
   - Apply the 5-dimension rubric to every cluster.
   - Resolve ties by prioritising Data Integrity Risk ($D$) over User Value Immediacy ($V$).

4. **Construct the System Hierarchy Tree:**
   - Order the list strictly descending by score.
   - Explicitly document downstream dependencies (e.g., System A depends on System B).
