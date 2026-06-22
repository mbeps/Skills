# Architecture & Design Analysis Module

Identifies unnecessary complexity, over-engineering, and excessive decoupling. Flags patterns that obscure logic without providing functional benefits.

## When to Use

Use this module when you need to:
- Assess the overall structural simplicity and complexity of a codebase
- Identify over-engineered components and unnecessary abstraction layers
- Find instances of Lasagna Code (excessive layering without transformation)
- Evaluate if decoupling mechanisms add meaningful value or just increase cognitive load
- Get Mermaid visualisations of current vs proposed simplified flow

## Key Analysis Areas

### Over-Engineering Detection
Instances where complex design patterns or multiple layers of abstraction are used for simple, straightforward tasks.

### Excessive Decoupling
Where the overhead of maintaining interfaces or events outweighs the benefit of separation.

### Indirection Debt
The number of steps required to reach core logic from an entry point. Higher numbers indicate complexity.

### Lasagna Code
Excessive layering where data passes through multiple classes without transformation.

### Interfaces for One
Interfaces or abstract classes with only a single concrete implementation and no likely future need for more.

## Quality Principles

- **KISS** (Keep It Simple, Stupid) – Could a junior developer follow the logic without jumping through multiple files?
- **YAGNI** (You Ain't Gonna Need It) – Does an abstraction support a "likely" future requirement or is it purely speculative?
- **Maintainability Over Sophistication** – Simple code that works is better than clever code that requires documentation
- **DRY Preservation** – Do not suggest flattening code if it results in duplication

## What This Module Does NOT Do

- Does not suggest massive architectural shifts (e.g. migrating from Monolith to Microservices)
- Does not suggest simplifications that violate DRY principles
- Does not suggest changes that conflict with framework conventions
- Does not provide refactored code—only high-level structural suggestions
- Does not flag standard architectural patterns required by specific frameworks

## Report Structure

Each finding includes:

- **Finding Title** – Clear name of the architectural issue
- **Status** – Over-engineered / Unnecessary Abstraction / High Indirection
- **Current Assessment** – Why this design is unnecessarily complex
- **Evidence** – File paths, call stack depth, specific pattern names
- **Proposed Simplification** – Small-scale, specific suggestion
- **Impact** – How the change simplifies the project
- **Visualisation** – Optional Mermaid diagram showing current vs simplified flow

## Example Findings

**Example 1: Shallow Generic Repository Layer**
- Status: Over-engineered
- Current Assessment: Generic `Repository<T>` abstraction used with only one implementation per entity
- Evidence: `src/repositories/`, used in exactly one place each (UserRepository, PostRepository)
- Proposed Simplification: Inline queries directly into service layer; remove generic abstraction
- Impact: Eliminates one indirection layer, reduces 150+ lines of boilerplate code

**Example 2: Event Bus for Local Communication**
- Status: Unnecessary Abstraction
- Current Assessment: Event system maintaining global state and subscription chains for in-process communication
- Evidence: All events published and consumed within same process; no async or multi-service requirements
- Proposed Simplification: Replace event bus with direct method calls; maintain event structure for testing
- Impact: Removes cognitive load; simplifies debugging and tracing

## Example Invocation

```
Analyse the architecture of [PROJECT_PATH] for over-engineering and unnecessary abstraction.
Identify:
- Components with high indirection debt
- Interfaces with single implementations
- Excessive layering (Lasagna Code)
- Decoupling mechanisms that add complexity without clear benefit

Provide Mermaid diagrams for complex paths and propose concrete simplifications.
Flag any patterns that conflict with framework requirements.
```
