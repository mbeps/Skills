# Specification: `.agents/project-details.md`

Captures how the system works: architecture, subsystem interactions, state management, concurrency, security boundaries, and runtime mechanics. **This file captures system design; development process rules belong in `development.md`.**

Keep this file dense, high-signal, and architecture-focused. Document concise architectural invariants and subsystem contracts. **Do NOT bloat this file with trivia, tutorial prose, or full code dumps.** Capture concise invariants, ownership models, and failure boundaries.

---

## File Template

```markdown
---
description: Project-specific architectural details, system design decisions, and subsystem interactions. Load when working on features that span multiple subsystems or modifying system mechanics.
applyTo: '**/*'
---

# Project Details & Architecture

## 1. System Architecture & Subsystem Interactions
- Document how primary subsystems communicate across module boundaries.
- Trace end-to-end data flows for primary entity lifecycles.
- Document ownership boundaries and database/storage relationship scoping.

## 2. State Management & Lifecycle
- Define boundaries between persistent storage, cached data, and ephemeral client state.
- Define hydration lifecycles, store reset behaviour, and cache invalidation policies.

## 3. Concurrency, Async Execution & Cancellation
- Document cancellation mechanisms (e.g. AbortController registries, cooperative cancellation tokens).
- Define deduplication rules, idempotent database operations, and race condition mitigations.

## 4. Security & Trust Boundaries
- Document trust boundaries between client, application server, and external integrations.
- Enforce tenant and user scoping across all persistence and retrieval queries.
- Specify credential handling, encryption boundaries, and SSRF protections.

## 5. Runtime & Framework Mechanics
- Document framework-specific runtime mechanics (e.g. streaming chunk assembly, background job execution, ORM column mappings, IPC bridges).
```

