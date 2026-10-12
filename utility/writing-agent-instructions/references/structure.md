# Structure and Section Specifications

Agent instruction files follow a strict contract governed by a **tiered progressive disclosure** architecture:
- **`AGENTS.md`**: The root orchestrator and primary entry point loaded into context across sessions.
- **`.agents/*.md`**: Modular, on-demand domain rulebooks loaded only when triggered by relevant tasks.

To keep context lean and token-efficient, the detailed section templates, contracts, and guidelines are decomposed into the dedicated reference documents below.

---

## Reference Documents

| Document | Purpose |
|---|---|
| [Target Files & Layout](structure/overview-and-layout.md) | File roles, `.agents/` folder responsibilities, and repository-relative pathing (`./...`, never `#file:`). |
| [Root Contract (`AGENTS.md`)](structure/agents-contract.md) | Strict section-by-section contract for `AGENTS.md` (Sections 1–9: Overview, Instructions, Tech Stack, Resources, Skills, Additional Tools, Graphify, Learnings, Extras). |
| [Universal vs Stack-Specific Taxonomy](structure/taxonomy.md) | Cross-language and cross-project taxonomy dividing universal rules from stack-specific concerns. |
| [Development Instructions (`development.md`)](structure/development.md) | Process-focused dev rules, workflow skills, non-negotiable operational rules, and verification command detection. |
| [Project Details (`project-details.md`)](structure/project-details.md) | Dense architecture invariants, subsystem interactions, state management, concurrency/cancellation, security boundaries, and runtime mechanics. |
| [Codebase Conventions (`conventions.md`)](structure/conventions.md) | "Thin Pointer, Not Duplicate" rule, override test, directory structure, naming conventions, centralised patterns, and code style. |
| [Testing Conventions (`testing.md`)](structure/testing.md) | Test runner commands, mirrored directory layout, global setup, mocking overrides, and coverage gates. |
| [UI Design Conventions (`design.md`)](structure/design.md) | UI component hierarchy, layout shell boundaries, PageContainer rules, styling tokens, and responsive design (frontend only). |
| [Planning Instructions (`plan.md`)](structure/plan.md) | High-level first philosophy, engineer audience, alternatives evaluated, 6-part plan structure contract, and simplicity guardrails. |

---

## Quick Navigation by Target File

- When authoring **`AGENTS.md`**: Read [Target Files & Layout](structure/overview-and-layout.md) and [Root Contract](structure/agents-contract.md).
- When authoring **`.agents/development.md`**: Read [Development Instructions](structure/development.md).
- When authoring **`.agents/project-details.md`**: Read [Project Details](structure/project-details.md).
- When authoring **`.agents/conventions.md`**: Read [Codebase Conventions](structure/conventions.md).
- When authoring **`.agents/testing.md`**: Read [Testing Conventions](structure/testing.md).
- When authoring **`.agents/design.md`**: Read [UI Design Conventions](structure/design.md).
- When authoring **`.agents/plan.md`**: Read [Planning Instructions](structure/plan.md).
- For stack-specific vs universal boundaries across all files: Read [Taxonomy](structure/taxonomy.md).
