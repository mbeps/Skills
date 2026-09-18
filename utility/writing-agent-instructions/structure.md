# Structure and Section Specifications

Agent instruction files follow a strict contract. Every `AGENTS.md` file must use the exact section headers and ordering defined below.

---

## Target File & Directory Layout

### 1. Target File: `AGENTS.md`
- The instruction file is **strictly `AGENTS.md`** at the project root.
- The user does **not** need to specify the file name or location because this is the only supported agent file.
- Agents must **never ask** the user what file name or location to use.

### 2. The `.agents/` Folder
- **Coding Conventions**: Stored in the `.agents/` folder (e.g. `.agents/conventions.md` or `.agents/convensions.md`).
- **Additional Agent Materials**: All other AI coding agent related materials (e.g. `learnings.md`, prompt templates, agent scratchpads) are stored in the `.agents/` folder.
- Keeps repository root clean while centralizing all agent-specific assets.

### 3. Path Relativity
Because `AGENTS.md` is always located at the project root, all file references resolve from the root using `#file:./`:
- `#file:./README.md`
- `#file:./graphify-out/`
- `#file:./.agents/conventions.md` (or `convensions.md`)
- `#file:./.agents/learnings.md`
- `#file:./wiki/`

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
  - You MUST use #file:./graphify-out/ to find relevant code files 
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
     `- README #file:./README.md - Includes features, setup, etc.`
  2. **Coding Conventions** (*Optional*):
     Conventions are stored in the `.agents/` folder. Include if present:
     `- Coding Convensions #file:./.agents/convensions.md - MUST be followed when writing code` (or `conventions.md`)
  3. **Graphify** (*Mandatory*):
     Always list the graphify assets:
     ```markdown
     - Graphify #file:./graphify-out/ - Location of Graphify assets containing project summary report, graphs showing relationships, etc
       - Report #file:./graphify-out/GRAPH_REPORT.md - Summary report
       - Relations Graph #file:./graphify-out/graph.json - Graph relationships and index
     ```
     *If `graphify-out/` does not exist in the repo, generate it using the `graphify` skill.*
  4. **Learnings** (*Optional*):
     Include if `.agents/learnings.md` exists:
     `- Learnings #file:./.agents/learnings.md - Includes info that the agent has learnt while working on this project`
  5. **Wiki** (*Optional*):
     Include ONLY if a `wiki/` directory or wiki documentation exists.
     `- Wiki #file:./wiki/`
  6. **Other AI Coding Agent Related Materials & Specs** (*Optional*):
     All additional AI coding agent related materials (agent configs, rules, prompt files) are stored in `.agents/`. Link them here or in architecture docs.
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

### 8. `# Learnings`
- **Conditional**: Present when the repository maintains an agent learnings document in `.agents/learnings.md`.
- **Standard Template**:
  ```markdown
  # Learnings
  - The #file:./.agents/learnings.md file contains info that the agent has learnt while working on this project. 
  - Read this file to avoid wasting time and tokens re-discovering information that the agent has already learnt.
  - Update this file with new learnings that are relevant to the project such as mistakes, commmon pitfalls, info that is not obvious, etc.
  - Prompt all subagents to also read and modify this file along with their main work.
  ```

### 9. `# Extras`
- **Conditional**: Only present when the user explicitly provides additional information that does not fit into sections 1–8.
- **STRICT PROHIBITION**: Do NOT include an `# Extras` section unless specifically requested and populated by the user. Never add speculative content here.

