# Example: `.agents/plan.md`

Below is a canonical example of `.agents/plan.md` for a full-stack Next.js web application:

```markdown
---
description: Load when creating, refining, reviewing, or structuring implementation plans, technical designs, or architectural proposals.
applyTo: '**/*'
---

# Planning Instructions & Architectural Guidelines

## 1. Skills
Follow these skills as the single source of truth for planning and design:
- `writing-plans` — Implementation plan structure, file mapping, interface boundaries, and bite-sized task decomposition.
- `ponytail` — Radical simplicity and YAGNI. Minimum code that works, zero unnecessary abstractions, deletion over addition.
- `brainstorming` — Collaborative problem exploration, requirements clarification, and iterative design before committing to code.
- `karpathy-guidelines` — Think before coding, surface assumptions, surgical changes, and goal-driven verifiable execution.

## 2. Core Philosophy & Engineer Audience
Plans in this repository are written directly for engineers. They must respect the reader's time and technical competence:
- **High-Level Overview First**: Always lead with the high-level architecture, design summary, and mental model before descending into file-level tasks. Keep descending shallow: each task states intent and constraints before any implementation detail.
- **Concrete Technical Specifics**: Do not abstract away the details that change the design. Specify exact file paths, API route contracts, function signatures, state mutations, and error codes — then state the invariant and the constraint that a reader would otherwise guess wrong.
- **Prefer Spec Over Listing**: A block of source in a plan is a second source of truth that drifts from the code and is harder to review than prose. Show source only where the failure mode is a runtime one the compiler cannot catch.
- **Edge-Cases Must Be Addressed**: Explicitly identify potential failure modes, boundary conditions, empty/error states, race conditions, and migration edge-cases before writing code.
- **Codebase Simplification Opportunities**: Actively evaluate whether the changes can simplify the existing codebase—look for opportunities to delete redundant code, collapse unnecessary indirections, consolidate duplicate utilities, or retire obsolete abstractions.
- **Anti-Bloat & Zero Fluff**: Plans must not be bloated or unnecessarily lengthy. Strip out tutorial-like prose, obvious explanations of standard framework mechanics, and generic boilerplate — in both directions: tutorial filler, and full implementations pasted in place of a clear specification.
- **Avoid Overcomplication**: Reject speculative configurability, premature factories, or multi-layered indirections. The best design solves the stated problem with the fewest files and simplest construct.
- **Follow Conventions**: Plans MUST follow codeabase conventions and guidelines. 

## 3. Alternative Approaches & Justification
Every non-trivial design or plan must document alternative approaches evaluated:
- Present 2–3 viable approaches with concise trade-offs (pros and cons).
- Clearly identify the recommended approach.
- State explicitly **why each alternative was NOT chosen** (e.g. YAGNI violation, state desync risk, unnecessary DB migrations, leaky abstractions).

## 4. Plan Structure & Content Contract
When authoring an implementation plan, follow this standard structure:

### 4.1 High-Level Overview
- **Goal**: Exactly 1–2 sentences explaining what is being built or fixed.
- **High-Level Architecture**: Conceptual design, data flow, and component relationships (include a concise Mermaid diagram where it clarifies boundaries).
- **Global Constraints**: Inviolable technical limits (runtime constraints, zero-Git commit policy, podman container usage, auth rules).

### 4.2 Alternatives Evaluated
- Table or compact list of evaluated architectures with trade-offs.
- Explicit justification for why the selected approach is superior.

### 4.3 Proposed Changes (File & Interface Breakdown)
- Group changes logically (e.g., Config/Schema -> Backend/Lib -> Frontend/Components -> Tests).
- Categorise touched files using `[NEW]`, `[MODIFY]`, or `[DELETE]`.
- State the **signature, invariant, and constraint** for each unit. Include a code block only where a reader would otherwise guess wrong: a wire format or schema validated by something stricter than TypeScript, a counter-intuitive constraint, or a literal boundary value. Boilerplate, imports, and straightforward control flow get a sentence, not a listing.
- **Codebase Simplification**: Highlight any code or abstractions that are being deleted, consolidated, or retired as part of this implementation.

### 4.4 Edge Cases & Failure Modes
- Enumerate edge cases, boundary conditions, and error paths (e.g. auth expiry, network drops, empty states, concurrency, partial failures).
- Detail how each edge case is handled cleanly without adding bloated defensive machinery.

### 4.5 Task Decomposition
- Break work into bite-sized, independently reviewable steps (2–5 minute actions).
- Include verification checkpoints for each task (e.g. failing test -> pass test -> lint).

### 4.6 Verification Plan
- **Automated Tests**: Exact commands to run targeted unit/integration tests (`pnpm test -- <path>`).
- **Typecheck & Lint**: Verification commands (`pnpm check`, `pnpm lint`).
- **Manual Verification**: Step-by-step checklist to test the behaviour in the browser/client.

## 5. Simplicity Guardrails
- **The Simplicity Ladder**: Stop at the first rung that solves the problem (YAGNI -> stdlib -> native platform -> existing vetted dependency -> minimal concrete code).
- **Blast Radius Discipline**: Map all callers and dependents before modifying shared contracts.
- **Codebase Simplification over Addition**: Prefer solutions that leave the codebase smaller and simpler than before.
- **YAGNI Ruthlessly**: Build only what is requested today. If a future extension might need X, leave room for it in clean boundaries without implementing X today.
```

