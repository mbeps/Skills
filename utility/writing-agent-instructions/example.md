# Worked Examples

Below are canonical examples of `AGENTS.md` files conforming to the contract.

---

## Example 1: Full-Stack Web Application (`AGENTS.md`)

```markdown
# Project Overview
A music streaming app that allows users to create playlists, listen to curated tracks, and share music with friends.

# Instructions (MUST be followed)
- You MUST use #file:./graphify-out/ to find relevant code files 
- Whenever using subagents, you MUST read the *subagent-driven-development* and *dispatching-parallel-agents* skills FIRST using the MAIN agent right at the start of process to orchanstrate the subagents correctly and efficiently. 
- Code MUST not be unnecessarily overcomplicated. Code MUST be simple to understand, modify and maintain.
- You MUST plan before implementing UNLESS change is trivial.
- Code MUST pass building, linting checks, type checks and testing. You MUST check at the end of the process to ensure that the code is working as expected and is not broken.
- You MUST NOT ask irrelevant questions.
- You MUST NEVER commit, stage, etc with Git. The developer is in charge of managing version control (Git and GitHub). You can do Git actions that do not have side affects such as logs, status, etc.
- Evaluate quality, accuracy, completentess and consistency of work and make necessary adjustments

# Tech Stack
## Frontend
- [Next.js 16](https://nextjs.org/docs)
- [React.js 19](https://react.dev/blog/2024/12/05/react-19)
- [Shadcn UI](https://ui.shadcn.com/docs/installation) 
- [Base UI](https://base-ui.com/)
- [Tailwind CSS 4](https://tailwindcss.com/docs/installation/using-vite)
- [nuqs 2](https://nuqs.dev/docs/installation)

## Backend
- [Supabase](https://supabase.com/docs)
- [PostgreSQL](https://www.postgresql.org/docs/17/index.html)

# Resources
- README #file:./README.md - Includes features, setup, etc. 
- Coding Convensions #file:./.agents/convensions.md - MUST be followed when writing code
- Graphify #file:./graphify-out/ - Location of Graphify assets containing project summary report, graphs showing relationships, etc
  - Report #file:./graphify-out/GRAPH_REPORT.md - Summary report
  - Relations Graph #file:./graphify-out/graph.json - Graph relationships and index
- Learnings #file:./.agents/learnings.md - Includes info that the agent has learnt while working on this project
- Wiki #file:./wiki/

# Skills
List of skills that are required to work on this project:
- clean-code: MUST be used when writing code
- design-patterns: MUST be used when writing code
- karpathy-guidelines: MUST be used for all coding related tasks
- writing-code: MUST be used when writing code
- documentation-writer: MUST be used when writing code or code documentation
- ui-ux-pro-max: MUST be used when creating components, pages, or other UI/UX related tasks
- mastering-typescript: MUST be used when writing TypeScript code
- typescript-environment-variables: MUST be used when managing environment variables in TypeScript
- brainstorming: MUST be used when generating ideas or solutions
- dispatching-parallel-agents: MUST be used when managing multiple agents
- subagent-driven-development: MUST be used when developing subagents
- systematic-debugging: MUST be used when debugging code
- test-driven-development: MUST be used when writing tests
- using-superpowers: SHOULD be used all the time
- verification-before-completion: MUST be used when verifying code before completion
- writing-plans: MUST be used when creating plans
- bug-fix: MUST be used when fixing bugs
- caveman: MUST be used all the time when thinking or monologuing
- evaluation: MUST be used when evaluating
- graphify: MUST be used when generating and updating codebase index/graph relationships and report
- ponytail: MUST be used when writing code
- using-checklists: MUST be used to organize tasks 
- tdd: MUST be used when practicing test-driven development
- database-normalisation-theory: MUST be used when designing and modifying relational database schemas
- supabase-nextjs: MUST be used when building, modifying, or debugging Supabase backend or schemas

# Additional Tools (and MCPs) 
- headroom: MUST be used for retrieving content
- Context7 - MUST be used for fiding relevant documentation about tools, libraries, and frameworks
- Web - MUST be used for searching the web for relevant information

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

# Learnings
- The #file:./.agents/learnings.md file contains info that the agent has learnt while working on this project. 
- Read this file to avoid wasting time and tokens re-discovering information that the agent has already learnt.
- Update this file with new learnings that are relevant to the project such as mistakes, commmon pitfalls, info that is not obvious, etc.
- Prompt all subagents to also read and modify this file along with their main work.
```

---

## Example 2: Backend Analytics Service (`AGENTS.md`)

```markdown
# Project Overview
An automated financial analytics API that ingests transaction feeds, generates variance models, and serves executive metrics.

# Instructions (MUST be followed)
- You MUST use #file:./graphify-out/ to find relevant code files 
- Whenever using subagents, you MUST read the *subagent-driven-development* and *dispatching-parallel-agents* skills FIRST using the MAIN agent right at the start of process to orchanstrate the subagents correctly and efficiently. 
- Code MUST not be unnecessarily overcomplicated. Code MUST be simple to understand, modify and maintain.
- You MUST plan before implementing UNLESS change is trivial.
- Code MUST pass building, linting checks, type checks and testing. You MUST check at the end of the process to ensure that the code is working as expected and is not broken.
- You MUST NOT ask irrelevant questions.
- You MUST NEVER commit, stage, etc with Git. The developer is in charge of managing version control (Git and GitHub). You can do Git actions that do not have side affects such as logs, status, etc.
- Evaluate quality, accuracy, completentess and consistency of work and make necessary adjustments
- All API handlers MUST return Pydantic v2 validated models with strict type annotations

# Tech Stack
## Backend
- [Python 3.12](https://docs.python.org/3.12/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Pydantic v2](https://docs.pydantic.dev/latest/)

## Database
- [PostgreSQL](https://www.postgresql.org/docs/17/index.html)
- [SQLAlchemy](https://docs.sqlalchemy.org/en/20/)
- [Alembic](https://alembic.sqlalchemy.org/en/latest/)

# Resources
- README #file:./README.md - Includes features, setup, etc. 
- Coding Convensions #file:./.agents/conventions.md - MUST be followed when writing code
- Graphify #file:./graphify-out/ - Location of Graphify assets containing project summary report, graphs showing relationships, etc
  - Report #file:./graphify-out/GRAPH_REPORT.md - Summary report
  - Relations Graph #file:./graphify-out/graph.json - Graph relationships and index

# Skills
List of skills that are required to work on this project:
- clean-code: MUST be used when writing code
- design-patterns: MUST be used when writing code
- karpathy-guidelines: MUST be used for all coding related tasks
- writing-code: MUST be used when writing code
- documentation-writer: MUST be used when writing code or code documentation
- brainstorming: MUST be used when generating ideas or solutions
- dispatching-parallel-agents: MUST be used when managing multiple agents
- subagent-driven-development: MUST be used when developing subagents
- systematic-debugging: MUST be used when debugging code
- test-driven-development: MUST be used when writing tests
- using-superpowers: SHOULD be used all the time
- verification-before-completion: MUST be used when verifying code before completion
- writing-plans: MUST be used when creating plans
- bug-fix: MUST be used when fixing bugs
- caveman: MUST be used all the time when thinking or monologuing
- evaluation: MUST be used when evaluating
- graphify: MUST be used when generating and updating codebase index/graph relationships and report
- ponytail: MUST be used when writing code
- using-checklists: MUST be used to organize tasks 
- tdd: MUST be used when practicing test-driven development
- database-normalisation-theory: MUST be used when designing and modifying relational database schemas
- pydantic-v2: MUST be used when writing, reading, or refactoring Pydantic v2 code
- pyright: MUST be used when configuring or resolving Pyright/Pylance typing in Python
- python-typing-ecosystem: MUST be used when configuring Python type checking

# Additional Tools (and MCPs) 
- headroom: MUST be used for retrieving content
- Context7 - MUST be used for fiding relevant documentation about tools, libraries, and frameworks
- Web - MUST be used for searching the web for relevant information

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

# Extras
- Deployments to the staging cluster are gated behind manual approvals by team leads.
```
