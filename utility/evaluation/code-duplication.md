# Code Duplication Module

Rigorously identifies code duplication, structural redundancy, and missed reuse opportunities across the codebase.

## When to Use

Use this module when you need to:
- Find exact, line-for-line code duplications
- Identify similar code blocks that can be parameterised into a single function
- Spot instances where an existing shared function is ignored in favour of duplicate logic
- Locate repeated logical patterns or workflows that should be extracted
- Understand redundancy impact on maintainability

## Analysis Approach

### Exact Match Detection
Identify identical code blocks, possibly with renamed variables or whitespace changes.

### Functional Similarity
Find code with different syntax or naming but identical underlying logic and data flow.

### Ignored Shared Utilities
Cases where an existing shared function is available but new duplicate logic is written instead.

### Pattern Extraction Opportunities
Identify repeated workflows or logical sequences that should be centralised.

### Semantic Equivalence
Analyse Abstract Syntax Trees (AST) to find disguised duplications that look different but do the same work.

## Quality Criteria

- Extract duplications only if they improve maintainability without introducing tight coupling
- Distinguish between necessary boilerplate (e.g. standard interfaces, basic getters) and true duplication
- Evaluate if abstracting the duplication violates Single Responsibility Principle
- Consider if extracted code genuinely benefits from centralisation

## What This Module Does NOT Do

- Does not write refactored code or new shared functions
- Does not flag boilerplate as duplication
- Does not suggest over-abstractions that harm readability
- Does not report similar code that serves fundamentally different purposes
- Does not count commented-out or dead code as duplication

## Report Structure

Each finding includes:

- **Duplication Name/Logic Pattern** – Clear description of the duplicated logic
- **Status** – Confirmed / Disputed Duplication
- **Type** – Exact Match / Functional Similarity / Ignored Shared Utility / Pattern
- **Locations** – File paths and line numbers for each occurrence
- **Explanation** – Why the duplication is redundant and its architectural impact
- **Proposed Extraction** – High-level suggestion for a shared function or parameterised utility
- **Impact** – Estimated lines saved and benefit to maintainability

## Example Findings

**Example 1: Duplicated Validation Logic**
- Status: Confirmed Duplication
- Type: Exact Match
- Locations:
  - `src/services/UserService.ts` (lines 45–60)
  - `src/services/AdminService.ts` (lines 32–47)
- Explanation: Identical email validation logic appears in two services
- Proposed Extraction: Create `ValidationUtils.validateEmail()` shared utility
- Impact: Saves ~15 lines of code; centralises validation rules

**Example 2: Overlooked Shared Function**
- Status: Confirmed Duplication
- Type: Ignored Shared Utility
- Locations:
  - `src/handlers/order-handler.ts` (lines 88–110) – new custom implementation
  - `src/utils/formatting.ts` (line 45) – existing `formatCurrency()` already available
- Explanation: Custom currency formatting logic duplicates existing utility
- Proposed Extraction: Use existing `formatCurrency()`; remove custom logic
- Impact: Eliminates 25 lines; standardises formatting across codebase

## Example Invocation

```
Identify all code duplication in [PROJECT_PATH].
Cross-reference modules for overlapping logic.
Analyse semantic equivalence (beyond exact text matches).
For each duplication, provide:
- Specific file paths and line numbers
- Classification (Exact Match / Functional Similarity / Ignored Utility)
- Rationale for extraction and estimated impact

Verify duplications to ensure accuracy before reporting.
```
