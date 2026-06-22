# Dead Code Analysis Module

Identifies unreachable, unused, and redundant code that can be safely removed to reduce technical debt.

## When to Use

Use this module when you need to:
- Trace from entry points to find unreachable logic
- Identify unused variables, imports, private methods, and classes
- Find public functions never consumed within the codebase
- Locate "zombie code"—syntactically correct but functionally obsolete logic
- Assess removal safety by identifying side effects

## Analysis Approach

### Entry Point Tracing
Analyse call graphs from primary entry points (main, index, API routes) to identify unreachable code.

### Unused Detection
Find variables, imports, private methods, and classes with no references.

### Zombie Code
Logic that is syntactically valid but functionally obsolete—its triggers or dependencies have been removed.

### Side Effect Assessment
Determine if code has global state changes, I/O operations, or other side effects that complicate safe removal.

### Consensus Verification
Subagent debate to confirm code is truly dead rather than rarely used or dynamically invoked.

## Quality Criteria

- Do not flag code used in dynamic calls (reflection, string-based lookups) unless proven dead
- Do not flag boilerplate required by frameworks or external APIs
- Do not flag code in public-facing libraries meant for external consumption
- Distinguish between "Dead Code" (unreachable) and "Redundant Code" (executed but produces no effect)

## What This Module Does NOT Do

- Does not suggest removal of code used in dynamic invocation
- Does not flag framework-required boilerplate
- Does not flag code in public APIs or external libraries
- Does not modify or delete any code
- Does not consider comments or documentation as usage

## Report Structure

Each finding includes:

- **Finding Name/Identifier** – Clear description of the dead code
- **Location** – File path, line numbers, export name
- **Category** – Unreachable Logic / Unused Variable / Zombie Code / Unused Export
- **Justification** – Why this is considered dead (e.g. "No inbound references", "Unreachable after line X")
- **Side Effect Assessment** – Potential risks or global state impacts if removed
- **Consensus Status** – Confirmed / Potentially Dead / Ambiguous

## Example Findings

**Example 1: Unreachable Legacy Function**
- Location: `src/services/PaymentService.ts`, lines 234–256
- Category: Unreachable Logic
- Justification: Function `processLegacyPayment()` is private and has zero inbound references; unused after refactor (commit abc123)
- Side Effect Assessment: No global state or I/O; safe to remove
- Consensus Status: Confirmed

**Example 2: Unused Import**
- Location: `src/controllers/UserController.ts`, line 3
- Category: Unused Variable
- Justification: `import { deprecatedValidator }` imported but never referenced in file
- Side Effect Assessment: No side effects
- Consensus Status: Confirmed

**Example 3: Zombie Code**
- Location: `src/handlers/webhook-handler.ts`, lines 78–95
- Category: Zombie Code
- Justification: Code waits for `event.deprecated_flag` which was removed in v2.0 (ref: CHANGELOG); trigger can never fire
- Side Effect Assessment: Logs to console; no I/O or state changes
- Consensus Status: Confirmed

## Example Invocation

```
Analyse [PROJECT_PATH] to identify unreachable, unused, and redundant code.
Trace from entry points to find unreachable logic.
Identify unused variables, imports, private methods, and classes.
For each finding, provide:
- Location (file path, line numbers)
- Category classification
- Clear justification with evidence
- Side effect assessment
- Consensus status

Facility debate to confirm dead code before reporting.
```
