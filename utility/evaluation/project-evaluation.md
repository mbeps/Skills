# Project Evaluation Module

Produces a comprehensive evaluation of a codebase covering all quality dimensions: Architecture, Code Quality, Design, Security, Testing, Dependencies, and Documentation.

## When to Use

Use this module when you need a complete health check of a project—a single, authoritative assessment across all critical dimensions without focusing on specific areas.

## Workflow

The evaluation follows a four-phase process:

### Phase 1: Discovery
Analyse different dimensions systematically:
- **Architecture** – Project structure, separation of concerns, module boundaries, layering
- **Code Quality** – Readability, naming, function/class size, nesting depth, duplication, over-abstraction
- **Design** – Use of patterns, abstractions, interfaces, composition vs inheritance, cohesion/coupling
- **Security** – Input validation, authentication/authorisation, secrets handling, dependency vulnerabilities
- **Testing** – Test coverage, quality, mocks, integration vs unit balance, missing critical tests
- **Dependencies** – Outdated packages, unnecessary packages, conflicting versions, licence risks
- **Documentation** – README quality, inline comments, API docs, onboarding clarity

### Phase 2: Clarification (Optional)
If findings are ambiguous or require context only the user can provide (e.g. intended architecture, known trade-offs), ask targeted questions grouped by theme. Wait for answers before proceeding.

### Phase 3: Evaluation
Produce scored assessments for each dimension based on Phase 1 findings and Phase 2 answers. Each dimension is assigned a rating (Poor / Fair / Good / Excellent) with specific findings and file references.

### Phase 4: Report
Compile all evaluation results into a final report. Structure by dimension and end with a prioritised action list of the most impactful improvements, focusing on simplicity, clarity, and correctness.

## Key Principles

- **Simplicity-First Lens** – Do not recommend adding complexity, patterns, or abstractions unless solving a concrete problem
- **Evidence-Based Findings** – Every finding must reference specific files, patterns, or behaviour
- **No Code Changes** – This module is diagnostic only; do not generate any code modifications
- **Assumption Clarification** – Ask about intentional design decisions rather than assuming poor design

## Quality Criteria by Dimension

### Architecture
- Project structure clarity and navigability
- Proper separation of concerns and module boundaries
- Appropriate monolith vs service split (if applicable)
- Logical layering without unnecessary indirection

### Code Quality
- Function and class size (single responsibility)
- Nesting depth and cognitive load
- Naming clarity and consistency
- Absence of unnecessary duplication
- No over-abstraction or overengineering

### Design
- Appropriate use of design patterns
- Cohesion within modules, loose coupling between modules
- Composition over inheritance where applicable
- Interface design for actual, not speculative, future needs

### Security
- Input validation and sanitisation
- Proper authentication and authorisation mechanisms
- Secrets handling (no hardcoded credentials)
- Dependency vulnerabilities and known exploits
- OWASP Top 10 exposure assessment

### Testing
- Adequate test coverage of critical paths
- Test quality (not just quantity)
- Appropriate mocking and isolation
- Balance between unit and integration tests
- Coverage of edge cases and error conditions

### Dependencies
- No outdated or deprecated packages
- No unnecessary packages (dependency bloat)
- No conflicting or incompatible versions
- Licence compliance

### Documentation
- Clear, accurate README
- Minimal, necessary inline comments
- API documentation where applicable
- Onboarding clarity for new contributors

## What This Module Does NOT Do

- Does not suggest code fixes or refactoring
- Does not penalise simple, straightforward implementations
- Does not assume design choices are mistakes (clarifies instead)
- Does not recommend adding tools, frameworks, or dependencies unless genuinely necessary
- Does not produce vague findings—every assessment is backed by concrete evidence
- Does not repeat findings across dimensions

## Expected Output

A structured report containing:

1. **Executive Summary** – High-level health status by dimension (score + key concerns)
2. **Detailed Findings** – Specific issues per dimension with file references
3. **Prioritised Action List** – Top improvements ranked by impact
4. **Dimension Summaries** – Architecture, Code Quality, Design, Security, Testing, Dependencies, Documentation

## Example Invocation

```
Run a comprehensive codebase evaluation on [PROJECT_PATH].
Use the project-evaluation module.
Provide Phase 1 findings, ask Phase 2 clarification questions if needed,
then produce a Phase 4 final report with ratings and prioritised actions.
```
