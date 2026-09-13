# Structure and Section Specifications

Agent instruction files follow a strict 8-part contract. Every agent file must use the exact section headers and ordering defined below.

---

## Target File Selection & Path Resolution

### 1. Confirming the Target File
Agent files can have different names and locations:
- `.github/copilot-instructions.md` (GitHub Copilot standard)
- `AGENT.md` (universal root agent instructions)
- `GEMINI.md` (Gemini CLI / Antigravity agent instructions)
- `CLAUDE.md` (Claude Code / Anthropic instructions)
- `copilot-instructions.md` or other custom names specified by user

**Rule**: If the user did not explicitly specify which file name/path to create or update, **ask the user** before proceeding.

### 2. Path Relativity
File paths in `# Resources` and `# Instructions` must resolve relative to the agent file's directory:
- **Inside `.github/`** (e.g. `.github/copilot-instructions.md`): Use `#file:../` for project root files:
  - `#file:../README.md`
  - `#file:../graphify-out/`
  - `#file:./instructions/conventions.instructions.md` (files inside `.github/`)
- **At Project Root** (e.g. `AGENT.md`, `GEMINI.md`, `CLAUDE.md`): Use `#file:./` or relative paths:
  - `#file:./README.md`
  - `#file:./graphify-out/`
  - `#file:./docs/conventions.md`

---

## The 8 Sections

### 1. `# Project Overview`
- **Length**: Exactly 1 to 2 sentences.
- **Tone**: Concise, direct, and straight to the point.
- **Content**: What the application is and its primary function.
- **STRICT PROHIBITION**: Do NOT mention tech stack, frameworks, libraries, runtime versions, or deployment platforms in this section. Stack information belongs exclusively in `# Tech Stack`.
- **Example**:
  ```markdown
  # Project Overview
  A music streaming app that allows users to create playlists, listen to curated tracks, and share music with friends.
  ```

### 2. `# Instructions (MUST be followed)`
- Contains the immutable baseline instructions followed by any user-requested project-specific rules.
- **Baseline Instructions (Included in all agent files)**:
  ```markdown
  # Instructions (MUST be followed)
  - You MUST use #file:<rel-path>/graphify-out/ to find relevant code files 
  - Whenever using subagents, you MUST read the *subagent-driven-development* and *dispatching-parallel-agents* skills FIRST using the MAIN agent right at the start of process to orchanstrate the subagents correctly and efficiently. 
  - Code MUST not be unnecessarily overcomplicated. Code MUST be simple to understand, modify and maintain.
  - You MUST plan before implementing UNLESS change is trivial.
  - Code MUST pass building, linting checks, type checks and testing. You MUST check at the end of the process to ensure that the code is working as expected and is not broken.
  - You MUST NOT ask irrelevant questions.
  - You MUST NEVER commit, stage, etc with Git. The developer is in charge of managing version control (Git and GitHub). You can do Git actions that do not have side affects such as logs, status, etc.
  - Evaluate quality, accuracy, completentess and consistency of work and make necessary adjustments
  ```
- **Additional User Instructions**:
  - If the user provides additional instructions, append them as bullets to the end of this list.
  - Do not alter or remove the baseline instructions unless specifically instructed by the user.

### 3. `# Tech Stack`
- Lists primary technologies used in the project, divided into logical H2 categories:
  - `## Frontend`
  - `## Backend`
  - `## Database`
  - Additional subsections (e.g. `## Infrastructure`, `## Mobile`) as warranted by the project.
- **Format**: `- [Technology Name](Official Documentation URL)`
- **Rule**: Every technology listed MUST have a hyperlink to its official documentation.
- **Rule**: Only include core technologies (languages, frameworks, database/ORM, major UI kits, auth, state management). Do not include minor helper packages.
- **Example**:
  ```markdown
  # Tech Stack
  ## Frontend
  - [Next.js 16](https://nextjs.org/docs)
  - [React.js 19](https://react.dev/blog/2024/12/05/react-19)
  - [Shadcn UI](https://ui.shadcn.com/docs/installation) 
  - [Tailwind CSS 4](https://tailwindcss.com/docs/installation/using-vite)

  ## Backend
  - [Supabase](https://supabase.com/docs)
  - [PostgreSQL](https://www.postgresql.org/docs/17/index.html)
  ```

### 4. `# Resources`
- Centralizes pointers to repository documentation and indexing assets.
- **Standard Entries**:
  1. **README** (*Mandatory*):
     `- README #file:<rel-path>/README.md - Includes features, setup, etc.`
  2. **Coding Conventions** (*Optional*):
     Include ONLY if coding convention files exist in the project (e.g., `conventions.instructions.md`, `.github/instructions/conventions.md`, `docs/conventions.md`).
     `- Coding Convensions #file:<rel-path>/conventions... - MUST be followed when writing code`
  3. **Graphify** (*Mandatory*):
     Always list the graphify assets:
     ```markdown
     - Graphify #file:<rel-path>/graphify-out/ - Location of Graphify assets containing project summary report, graphs showing relationships, etc
       - Report #file:<rel-path>/graphify-out/GRAPH_REPORT.md - Summary report
       - Relations Graph #file:<rel-path>/graphify-out/graph.json - Graph relationships and index
     ```
     *If `graphify-out/` does not exist in the repo, generate it using the `graphify` skill.*
  4. **Wiki** (*Optional*):
     Include ONLY if a `wiki/` directory or wiki documentation exists.
     `- Wiki #file:<rel-path>/wiki/`
  5. **Other Architecture / Spec Resources** (*Optional*):
     Link to architecture documentation, specs, or API references if they exist.
- **STRICT PROHIBITION**: NEVER list package manager or configuration files (such as `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pyproject.toml`, `Cargo.toml`, `tsconfig.json`, `.gitignore`).

### 5. `# Skills`
- Lists skills required when working on the project.
- **Structure**:
  - Begins with standard preamble: `List of skills that are required to work on this project:`
  - Lists skills in bullet format: `- <skill-name>: MUST be used when <trigger/condition>`
  - Must include **all universal core skills** (see `skills-catalog.md`).
  - Must include **project-specific stack skills** matching the codebase (see `skills-catalog.md`).
- **STRICT PROHIBITION**: NEVER include one-time or meta authoring skills (`writing-skills`, `refining-skills`, `skill-repair`, `migrating-*`, `find-skills`).

### 6. `# Additional Tools (and MCPs)`
- Documents non-obvious tools and MCP servers available in the environment that agents should leverage.
- Standard items when available:
  ```markdown
  # Additional Tools (and MCPs) 
  - headroom: MUST be used for retrieving content
  - Context7 - MUST be used for fiding relevant documentation about tools, libraries, and frameworks
  - Web - MUST be used for searching the web for relevant information
  ```
- Add project-relevant MCP servers or tools if present in the runtime (e.g. `playwright`, `podman`).

### 7. `# Graphify`
- **Fixed Content**: Identical across all agent files. Do not modify or abridge this text:
  ```markdown
  # Graphify

  For any question about this repo's architecture, structure, components, or how to add/modify/find
  code, your first action should be `graphify query "<question>"` when `graphify-out/graph.json`
  exists. Use `graphify path "<A>" "<B>"` for relationship questions and `graphify explain "<concept>"`
  for focused-concept questions. These return a scoped subgraph, usually much smaller than the full
  report or raw grep output.

  Triggers: "how do I…", "where is…", "what does … do", "add/modify a <component>",
  "explain the architecture", or anything that depends on how files or classes relate.

  If `graphify-out/wiki/index.md` exists, use it for broad navigation. Read `graphify-out/GRAPH_REPORT.md`
  only for broad architecture review or when query/path/explain do not surface enough context. Only read
  source files when (a) modifying/debugging specific code, (b) the graph lacks the needed detail, or
  (c) the graph is missing or stale.

  Type `/graphify` in Copilot Chat to build or update the graph.
  ```

### 8. `# Extras`
- **Conditional**: Only present when the user explicitly provides additional information that does not fit into sections 1–7.
- **STRICT PROHIBITION**: Do NOT include an `# Extras` section unless specifically requested and populated by the user. Never add speculative content here.

