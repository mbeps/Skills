# Target Files & Directory Layout

Agent instruction files follow a strict contract. The agent ecosystem uses a tiered structure:
- **`AGENTS.md`**: The root orchestrator and entry point.
- **`.agents/*.md`**: Modular, on-demand domain rulebooks (`development.md`, `project-details.md`, `conventions.md`, `testing.md`, `design.md`, `plan.md`, `learnings.md`).

---

## Target Files & Directory Layout

### 1. Root File: `AGENTS.md`
- Strictly located at the project root: `AGENTS.md`.
- Acts as the primary entry point loaded into the agent's context across sessions.
- Contains the project overview, baseline operational instructions, categorised tech stack links, resources index, and skills catalog.

### 2. The `.agents/` Folder
All modular agent files and guidelines live inside `.agents/`:
- `development.md`: Process-focused: dev lifecycle, operational rules, workflow skills, verification commands.
- `project-details.md`: System mechanics, architectural decisions, subsystem data flows, state lifecycles, concurrency/cancellation, security boundaries, runtime mechanics.
- `conventions.md` (or `convensions.md`): Directory structure, naming conventions, architectural boundaries, language idioms, and skill overrides.
- `testing.md`: Testing strategy, mock setup, coverage rules, and testing skills.
- `design.md`: UI architecture, component hierarchy, page container rules, styling, and design skills (frontend projects only; omitted for headless, backend, CLI, or library projects).
- `plan.md`: Planning instructions, architectural standards, alternative approaches, anti-bloat guidelines, and planning skills.
- `learnings.md`: Historical discoveries, pitfalls, and session takeaways.
Centralising these in `.agents/` keeps the root clean and prevents context bloat by allowing agents to load detailed rules only when triggered by relevant tasks.

### 3. Path Relativity
All path references resolve from the repository root using standard markdown relative paths (`./...`):
- `./README.md`
- `./graphify-out/`
- `./.agents/development.md`
- `./.agents/project-details.md`
- `./.agents/convensions.md` (or `conventions.md`)
- `./.agents/testing.md`
- `./.agents/design.md`
- `./.agents/plan.md`
- `./.agents/learnings.md`
- `./wiki/`

> [!WARNING]
> **NEVER use `#file:` in paths.** Use plain relative paths such as `./README.md` or `./.agents/convensions.md`.

