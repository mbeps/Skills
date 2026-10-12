# Example: Full-Stack Web Application (`AGENTS.md`)

Below is a canonical example of root `AGENTS.md` for a full-stack Next.js web application conforming to the contract:

```markdown
# Project Overview
A full stack AI chat client app similar to ChatGPT, Gemini, Claude, etc.
App has text streaming, internal tools, MCP over HTTP, RAG, etc.
The client supports any OpenAI compatible API provider (OpenRouter, Ollama, Groq, Azure, DeepSeek, etc.).

**Test Credentials:** Email: `test@example.com` | Password: `Hello123`

# Instructions
- Use ./graphify-out/ to find navigate codebase. Graphify is like an index.
- Whenever using subagents, read the *subagent-driven-development* and *dispatching-parallel-agents* skills first using the main agent right at the start of process to orchestrate the subagents correctly and efficiently. 
- Do not ask irrelevant questions such as asking permission to start analysing, researching.
- Update ./.agents/learnings.md with new info that are relevant to the project such as mistakes, common pitfalls, info that is not obvious, etc.

# Tech Stack
## Frontend
- [Next.js 16](https://nextjs.org/docs)
- [React.js 19](https://react.dev/blog/2024/12/05/react-19)
- [Shadcn UI](https://ui.shadcn.com/docs/installation) 
- [Radix](https://www.radix-ui.com/themes/docs/overview/getting-started)
- [Tailwind CSS 4](https://tailwindcss.com/docs/installation/using-vite)
- [react-markdown 10](https://remarkjs.github.io/react-markdown/)
- [Mermaid 11](https://mermaid.ai/open-source/)
- [KaTeX 0.16](https://www.npmjs.com/package/katex?activeTab=versions)
- [React Hook Form 7](https://react-hook-form.com/)

## Backend
- [Next.js API Routes (App Router)](https://nextjs.org/docs)
- [Better Auth](https://better-auth.com/docs/installation) 

## Database
- [PostgreSQL 17](https://www.postgresql.org/docs/17/index.html) with [pgvector](https://github.com/pgvector/pgvector) (2048-dim)
- [Drizzle ORM 0.45.2](https://orm.drizzle.team/docs/overview)

## Storage
- [AWS S3 SDK](https://www.npmjs.com/package/@aws-sdk/client-s3) 
- [MinIO](https://hub.docker.com/r/minio/minio) (for local dev)

## AI
- [Vercel AI SDK 6](https://ai-sdk.dev/docs/introduction)
- [MCP SDK 1](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)

## Other
- [Zod 4](https://zod.dev/v4)
- [nuqs 2](https://nuqs.dev/docs/installation)
- [Podman](https://docs.podman.io/en/latest/) to run Docker containers (Postgres, MinIO, etc.)

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

# Resources
- README ./README.md - Includes features, setup, etc. 
- Coding Convensions ./.agents/convensions.md - MUST be followed when writing code
- Development Instructions ./.agents/development.md - MUST be followed when developing, writing code, or running verification commands. Governs development process and operational rules.
- Project Details ./.agents/project-details.md - MUST be followed when working across subsystems, understanding architecture, or inspecting system mechanics.
- Testing Conventions ./.agents/testing.md - MUST be followed when writing or mocking tests
- Design Conventions ./.agents/design.md - MUST be followed when creating or modifying UI components or styling (omit for headless/backend/CLI/library projects)
- Planning Instructions ./.agents/plan.md - MUST be followed when creating or reviewing implementation plans
- Graphify ./graphify-out/ - Includes report, graph relationships, etc. Must be loaded at the beginning.
  - Graph Report ./graphify-out/GRAPH_REPORT.md
  - Graph JSON ./graphify-out/graph.json
- Learnings ./.agents/learnings.md - Includes info that the agent has learnt while working on this project. Read this file to avoid wasting time and tokens re-discovering information
- Wiki ./wiki/ - Wiki with detailed information about the project, architecture, and design
    
# Skills
List of skills that are required to work on this project:
- karpathy-guidelines: MUST be used when for all coding related tasks
- documentation-writer: MUST be used when writing code or code documentation
- ui-ux-pro-max: MUST be used when creating components, pages, or other UI/UX related tasks
- normalisation-theory: MUST be used when designing database schemas
- brainstorming: MUST be used when generating ideas or solutions
- dispatching-parallel-agents: MUST be used when managing multiple agents
- subagent-driven-development: MUST be used when developing subagents
- systematic-debugging: MUST be used when debugging code
- using-superpowers: SHOULD be used all the time
- writing-plans: MUST be used when creating plans
- caveman: MUST be used all the time when thinking or monologuing
- evaluation: MUST be used when evaluating
- graphify: MUST be used when generating and updating codebase index/graph relationships and report
- ponytail: MUST be used when writing code or planning
- using-checklists: MUST be used to organise tasks 
- writing-nextjs-vitest-tests: MUST be used when writing Next.js Vitest tests
- playwright-skill: MUST be used when automating browser testing

# Additional Tools (and MCPs) 
- headroom: MUST be used for retrieving content
- Context7 - MUST be used for finding relevant documentation about tools, libraries, and frameworks
- DBCode - Managing database
- Web - MUST be used for searching the web for relevant information
```

