# Architecture Diagnostic Report Template

Use this standard template when documenting an architectural audit of a project.

---

```markdown
# Architectural & Design Audit: [Project Name]

## 1. Executive Summary & Architectural Verdict
- **Overall Architectural Health:** [Grade A / B / C / D / Critical]
- **Core Architectural Stance:** [1-2 sentences on whether architecture matches operational needs or suffers from overengineering/under-specification]
- **Key Risk Hotspots:** [Top 2-3 highest-risk cross-system boundaries]

---

## 2. System Inventory & Criticality Hierarchy

Systems identified across the codebase, ranked strictly from most critical (Tier 1) to least critical (Tier 4):

| Rank | System / Subsystem Name | Primary Responsibility | Criticality Tier | Criticality Score | Primary Datastore |
|---|---|---|---|---|---|
| 1 | [e.g., Core Interactive Chat Engine] | Real-time user turn execution & state of record | Tier 1 (Mission-Critical) | 4.8 / 5.0 | PostgreSQL |
| 2 | [e.g., Durable Workflow Execution] | Asynchronous multi-step step orchestration | Tier 2 (Business-Critical) | 3.6 / 5.0 | Inngest + S3 |
| 3 | [e.g., Semantic Vector Retrieval & RAG] | Document chunking, indexing & similarity search | Tier 2 (Business-Critical) | 3.2 / 5.0 | Qdrant |
| 4 | [e.g., Long-Term User Memory] | Ambient user preference recall | Tier 3 (Operational) | 2.5 / 5.0 | PostgreSQL |
| 5 | [e.g., Dev Run Inspector & Telemetry] | Development job logs & local inspection | Tier 4 (Auxiliary) | 1.4 / 5.0 | Ephemeral |

---

## 3. Subsystem Deep-Dive Audits

[Repeat this section for each major subsystem in order of criticality]

### Subsystem [N]: [Subsystem Name] ([Tier X])
**Files Audited:** `[exact file paths]`

#### What Is Sound
- **[Pattern Name]:** [Specific design decision that is appropriate, resilient, and well-executed with file citations].

#### Architectural Flaws & Identified Risks
##### 1. [Flaw Title] ([Category: Overengineering / Failure Risk / Performance])
- **File & Location:** `[exact file path:line numbers]` (`[functionName]`)
- **Architectural Flaw:** [Technical description of the design defect or anti-pattern].
- **Failure & Performance Impact:** [Concrete consequences: data loss, race condition, infinite loop, memory leak, network stall].
- **Concrete Simplification / Fix:** [Direct, pragmatic architectural fix].

---

## 4. Cross-System Boundary & Synchronisation Matrix

Audit the interactions between disparate storage layers, queues, and runtimes:

| Boundary | Interaction Type | Synchronisation Mechanism | Identified Risk / Flaw | Remediation |
|---|---|---|---|---|
| PostgreSQL $\leftrightarrow$ S3 | File upload / deletion | Compensating DB write | S3 deleted before DB; orphaned files | Invert order; delete DB first |
| Inngest $\leftrightarrow$ Client Store | Realtime streaming | HTTP pub/sub over SSE | Per-token HTTP requests stall stream | Micro-batch deltas (30ms window) |
| PostgreSQL $\leftrightarrow$ Qdrant | Dual-write vector index | Application-level write | Stale payloads on failed update | Consolidate or transactional outbox |

---

## 5. Prioritised Remediation Roadmap

Rank all recommended architectural improvements by Return on Investment (ROI) and risk reduction:

### Priority 0: Critical Integrity & Control-Flow Hazards
- [ ] **[Action Item]:** [Location] — [Impact & Concrete Fix]

### Priority 1: High-Risk Boundary & Security Deficiencies
- [ ] **[Action Item]:** [Location] — [Impact & Concrete Fix]

### Priority 2: Performance Hotspots & Scale Bottlenecks
- [ ] **[Action Item]:** [Location] — [Impact & Concrete Fix]

### Priority 3: Overengineering & Code Simplification
- [ ] **[Action Item]:** [Location] — [Impact & Concrete Fix]
```
