# Dead Code Analysis Module

Identifies unreachable logic, unused exports, zombie code, phantom event dispatchers, and obsolete migration assets that add maintenance overhead and obscure codebase navigability.

For complete smell mappings and diagnostic criteria, see [Code Smells Matrix](references/code-smells-matrix.md).

## When to Use

Use this module when you need to:
- Trace execution graphs from primary entry points to find unreachable functions and branches
- Identify unused public exports, classes, and types across the repository (Export Minimization)
- Locate "zombie code"—syntactically valid logic whose triggers, routes, or callers have been removed
- Detect phantom event dispatching—events emitted with zero registered listeners
- Identify obsolete ephemeral migration assets and one-off backfill scripts
- Flag speculative domain model bloat and dead type definitions
- Assess side effects and verify safety prior to dead code pruning

## Key Analysis Areas

### 1. Entry Point Tracing & Unreachable Logic
Traverse call graphs starting from primary entry points (API route handlers, CLI commands, HTTP server bootstrap, main entry). Detect functions, methods, or blocks with zero inbound references.

### 2. Unused Public Exports (Export Minimization)
Files exporting functions, classes, constants, or types that are never imported anywhere within the repository.
- Distinguish between application internal modules (where unused exports are dead code) and published library packages intended for external consumers.

### 3. Phantom Event Dispatching
Producers broadcasting events via EventEmitter, Redis Pub/Sub, or Webhook dispatches where zero consumers or event handlers listen for the event name. Generates misleading logs, unnecessary serialization overhead, and false maintenance assumptions.

### 4. Zombie Code
Code that is syntactically correct and fully compiled, but functionally inert because its triggering condition (e.g. a removed feature flag, deprecated API version, or retired payment provider) can never evaluate to true.

### 5. Speculative Domain Model Bloat (Anticipatory Dead Types)
Complex TypeScript interfaces, union types, or database entity models defined for hypothetical future features that have no corresponding production runtime usage.

### 6. Zombie Migration Scripts & Ephemeral Assets
One-off schema migration backfills, CSV import bridges, or data sanitization scripts left permanently in `scripts/` or `migrations/` long after production execution.

### 7. Side Effect Assessment
Audit candidate code for side effects (e.g. self-executing module-level expressions, global variable mutations, dynamic reflection calls, telemetry beacons) to evaluate whether removal is 100% safe.

---

## Quality Principles

- **Trace Before Calling Dead** – Inspect dynamic invocation patterns (reflection, string-keyed property access, dependency injection containers) before declaring a symbol dead.
- **Library vs Application Distinction** – Only flag public exports as dead if the repository is an application, not a shared reusable package.
- **Side-Effect Verification** – Ensure candidate symbols do not perform global module-level side effects on import.

---

## What This Module Does NOT Do

- Does not delete or comment out code
- Does not flag framework-required entrypoints (e.g. Next.js page components, framework lifecycles)
- Does not flag exports in designated public library SDKs
- Does not treat commented-out notes as active code

---

## Report Structure

Each finding includes:

- **Identifier / Symbol Name** – Function, variable, export, or script name
- **Location** – File path and line numbers
- **Dead Code Category** – Unreachable Logic / Unused Export / Phantom Event / Zombie Code / Ephemeral Migration Asset / Speculative Type Bloat
- **Justification & Trace** – Evidence proving absence of callers or subscribers
- **Side Effect Assessment** – Analysis of module initialization or runtime side effects
- **Consensus Status** – Confirmed / Potentially Dead / Dynamic Ambiguity

---

## Example Findings

**Example 1: Phantom Event Dispatching**
- **Identifier**: `OrderRefundedEvent`
- **Location**: `src/services/RefundService.ts`, line 64
- **Dead Code Category**: Phantom Event
- **Justification**: `eventEmitter.emit('order.refunded', payload)` is executed on refund completion. Repository-wide search confirms 0 active listeners (`on('order.refunded')` or `once('order.refunded')`) exist anywhere in the codebase.
- **Side Effect Assessment**: In-memory event emission with no registered listeners produces zero state change; safe to remove.
- **Consensus Status**: Confirmed

**Example 2: Unused Public Domain Models (Speculative Type Bloat)**
- **Identifier**: `IOrganizationHierarchy`, `OrganizationTierEnum`
- **Location**: `src/types/organizations.ts`, lines 15–48
- **Dead Code Category**: Speculative Type Bloat
- **Justification**: 6 complex interfaces and 2 enums defined for hierarchical multi-tenancy. AST grep reveals zero imports or references across all source and test files.
- **Side Effect Assessment**: Pure TypeScript type definitions; zero runtime footprint.
- **Consensus Status**: Confirmed

---

## Example Invocation

```
Audit [PROJECT_PATH] for dead code, unused exports, and obsolete assets.
Identify:
- Unused public exports across all modules
- Unreachable logic and zombie functions
- Phantom event emissions with no subscribers
- Ephemeral migration scripts left in the repository
- Speculative types and interfaces with zero production usage

Assess side effects for each candidate and provide specific file paths and line numbers.
```
