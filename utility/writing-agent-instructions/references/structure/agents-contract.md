# The Contract for `AGENTS.md`

`AGENTS.md` files must contain the following sections in order:

---

## 1. `# Project Overview`
- **Length**: Exactly 1 to 2 sentences.
- **Tone**: Concise, direct, and straight to the point.
- **Content**: What the application is and its primary function.
- **STRICT PROHIBITION**: Do NOT mention tech stack, frameworks, libraries, runtime versions, or deployment platforms in this section. Stack information belongs exclusively in `# Tech Stack`.
- **Example**:
  ```markdown
  # Project Overview
  A full stack AI chat client app similar to ChatGPT, Gemini, Claude, etc.
  App has text streaming, internal tools, MCP over HTTP, RAG, etc.
  The client supports any OpenAI compatible API provider (OpenRouter, Ollama, Groq, Azure, DeepSeek, etc.).

  **Test Credentials:** Email: `test@example.com` | Password: `Hello123`
  ```

---

## 2. `# Instructions`
- Streamlined baseline instructions governing agent navigation and autonomy.
- **Baseline Instructions**:
  ```markdown
  # Instructions
  - Use ./graphify-out/ to find navigate codebase. Graphify is like an index.
  - Whenever using subagents, read the *subagent-driven-development* and *dispatching-parallel-agents* skills first using the main agent right at the start of process to orchestrate the subagents correctly and efficiently. 
  - Do not ask irrelevant questions such as asking permission to start analysing, researching.
  - Update ./.agents/learnings.md with new info that are relevant to the project such as mistakes, common pitfalls, info that is not obvious, etc.
  ```
- If the user provides additional repository-level instructions, append them as bullets to the end of this list.

---

## 3. `# Tech Stack`
- Lists primary technologies used in the project, divided into logical H2 categories:
  - `## Frontend`
  - `## Backend`
  - `## Database`
  - Additional subsections (e.g. `## Storage`, `## AI`, `## Other`) as appropriate.
- **Format**: `- [Technology Name](Official Documentation URL)`
- **Rule**: Every technology listed MUST have a hyperlink to its official documentation.
- **Example**:
  ```markdown
  # Tech Stack
  ## Frontend
  - [Next.js 16](https://nextjs.org/docs)
  - [React.js 19](https://react.dev/blog/2024/12/05/react-19)
  - [Shadcn UI](https://ui.shadcn.com/docs/installation) 
  - [Tailwind CSS 4](https://tailwindcss.com/docs/installation/using-vite)

  ## Backend
  - [Next.js API Routes (App Router)](https://nextjs.org/docs)
  - [Better Auth](https://better-auth.com/docs/installation) 

  ## Database
  - [PostgreSQL 17](https://www.postgresql.org/docs/17/index.html) with [pgvector](https://github.com/pgvector/pgvector) (2048-dim)
  - [Drizzle ORM 0.45.2](https://orm.drizzle.team/docs/overview)
  ```

---

## 4. `# Resources`
- Centralises pointers to repository documentation, indexing assets, and `.agents/` modular rulebooks.
- Annotate each resource with clear triggers indicating when an agent should read it.
- **Standard Entries**:
  ```markdown
  # Resources
  - README ./README.md - Includes features, setup, etc. 
  - Coding Convensions ./.agents/convensions.md - MUST be followed when writing code
  - Development Instructions ./.agents/development.md - MUST be followed when developing, writing code, or running verification commands. Governs development process and operational rules.
  - Project Details ./.agents/project-details.md - MUST be followed when working across subsystems, understanding architecture, or inspecting system mechanics.
  - Testing Conventions ./.agents/testing.md - MUST be followed when writing, running, or mocking tests
  - Design Conventions ./.agents/design.md - MUST be followed when creating or modifying UI components or styling (omit for headless/backend/CLI/library projects)
  - Planning Instructions ./.agents/plan.md - MUST be followed when creating or reviewing implementation plans
  - Graphify ./graphify-out/ - Includes report, graph relationships, etc. Must be loaded at the beginning.
    - Graph Report ./graphify-out/GRAPH_REPORT.md
    - Graph JSON ./graphify-out/graph.json
  - Learnings ./.agents/learnings.md - Includes info that the agent has learnt while working on this project. Read this file to avoid wasting time and tokens re-discovering information
  - Wiki ./wiki/ - Wiki with detailed information about the project, architecture, and design
  ```
- **STRICT PROHIBITION**: NEVER list package manager or configuration files (such as `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pyproject.toml`, `tsconfig.json`).

---

## 5. `# Skills`
- Lists skills required when working on the project.
- **Structure**:
  - Begins with standard preamble: `List of skills that are required to work on this project:`
  - Lists skills in bullet format: `- <skill-name>: MUST be used when <trigger/condition>`
  - Must include **universal core skills** and **project-specific stack skills** (see [`skills-catalog.md`](../skills-catalog.md)).
- **STRICT PROHIBITION**: NEVER include one-time or meta authoring skills (`writing-skills`, `refining-skills`, `skill-repair`, `migrating-*`, `find-skills`).

---

## 6. `# Additional Tools (and MCPs)`
- Documents non-obvious tools and MCP servers available in the environment:
  ```markdown
  # Additional Tools (and MCPs) 
  - headroom: MUST be used for retrieving content
  - Context7 - MUST be used for finding relevant documentation about tools, libraries, and frameworks
  - DBCode - Managing database
  - Web - MUST be used for searching the web for relevant information
  ```

---

## 7. `# Graphify`
- **Fixed Content**: Standard instructions for graphify navigation:
  ```markdown
  ## Graphify

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

---

## 8. `# Learnings`
- Conditional: Present when `.agents/learnings.md` exists. Pointers on avoiding repeating mistakes and recording discoveries.

---

## 9. `# Extras`
- Conditional: Present ONLY if the user explicitly provided additional custom content.

