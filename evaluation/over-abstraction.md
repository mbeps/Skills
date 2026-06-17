# Over-Abstraction Audit Module

Identifies unnecessary layers, complex design patterns used for simple tasks, and abstractions that obscure logic without functional benefit.

## When to Use

Use this module when you need to:
- Identify "shallow" abstraction layers adding no functional value
- Find "Interfaces for One"—interfaces with only a single implementation
- Detect "Lasagna Code"—excessive layering without data transformation
- Flag logic fragmented across too many files, making execution hard to follow
- Assess if decoupling mechanisms provide genuine value or just increase cognitive load
- Evaluate whether an abstraction truly reduces duplication or merely adds complexity

## Key Concepts

### Cognitive Load
Does the abstraction make the logic harder to find or follow? Can a developer understand the flow without reading multiple files?

### Indirection Tracing
Count the files a single data point touches before being processed. Higher indirection = higher complexity.

### Rule of Three
Abstraction should generally be justified by at least three distinct use cases.

### YAGNI Principle
Does the abstraction support an actual, present requirement or is it speculative future-proofing?

### Open-Closed Principle
Balance between being "closed for modification" and not over-engineering for unlikely changes.

## Analysis Approach

### Trace Paths
Identify sequences of files/classes involved in processing a single request or data transformation.

### Inheritance Trees
Evaluate whether inheritance hierarchies provide organisation or just add layers.

### Shallow Implementations
Flag interfaces or abstract classes where the concrete implementation adds trivial logic.

### Data Flow Obscuring
Find cases where simple operations require jumping between multiple files and abstractions.

### Debate & Consensus
Distinguish between "genuinely unnecessary" and "framework-required" patterns.

## What This Module Does NOT Do

- Does not suggest flattening code if it results in duplication
- Does not flag standard patterns required by specific frameworks (Controllers/Services in Spring/NestJS)
- Does not rewrite or refactor any code
- Does not use subjective language—relies on concrete evidence and design principles

## Report Structure

Each finding includes:

- **Finding Name/Design Pattern** – Clear description of the over-abstraction
- **Status** – Confirmed Over-abstraction / Subjective / Framework Required
- **Trace Path** – Sequential list of files/classes involved in the indirection
- **Complexity Justification** – Concrete evidence of why this layer is unnecessary
- **Logic Fragmentation** – How the execution flow is obscured
- **Simplification Suggestion** – Guidance on flattening or consolidating logic
- **Impact Assessment** – How this change improves readability without sacrificing centralisation

## Example Findings

**Example 1: Shallow Adapter Pattern**
- Status: Confirmed Over-abstraction
- Trace Path: `UserController` → `UserServiceAdapter` → `UserService` → `UserRepository`
- Complexity Justification: `UserServiceAdapter` is empty pass-through; adds no logic or translation
- Logic Fragmentation: Developer must trace through four files to understand basic user retrieval
- Simplification Suggestion: Remove adapter; call `UserService` directly from controller
- Impact: Eliminates one layer; reduces cognitive load without losing centralisation

**Example 2: Interface for One Implementation**
- Status: Confirmed Over-abstraction
- Trace Path: `PaymentService` implements `IPaymentService` (no other implementations)
- Complexity Justification: No actual decoupling achieved; no alternative implementations exist or are planned
- Logic Fragmentation: Developers must find the interface definition, then locate the single implementation
- Simplification Suggestion: Remove interface; use concrete class directly
- Impact: Reduces cognitive load; preserves all functionality

**Example 3: Over-Engineered Factory**
- Status: Subjective Design Choice: Requires Senior Review
- Trace Path: `UserFactory` → `UserBuilder` → `User` constructor
- Complexity Justification: Factory creates simple objects with standard properties; builder is rarely used
- Logic Fragmentation: Object creation spread across three files
- Simplification Suggestion: Use direct constructor calls for simple cases; keep builder only if actually used elsewhere
- Impact: Depends on usage patterns; requires team discussion

## Example Invocation

```
Analyse [PROJECT_PATH] for over-abstraction and unnecessary indirection.
Identify:
- Shallow abstraction layers with no functional logic
- Interfaces with single implementations
- Excessive layering (Lasagna Code)
- Decoupling mechanisms that add complexity without clear benefit
- Logic fragmented across too many files

For each finding, trace the data flow and assess cognitive load.
Provide simplification suggestions that preserve DRY principles.
Flag patterns that are framework-required versus genuinely unnecessary.
```
