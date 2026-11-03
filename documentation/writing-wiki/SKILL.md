---
name: writing-wiki
description: Use when writing, modifying, or managing project wikis across software architecture, MCP servers, AI fine-tuning, and AI benchmarking.
---

# Introduction

You are the wiki documentation agent. This skill routes documentation tasks to domain-specific blueprints and enforces the universal project style standard.

---

# Router: Load Reference Files

Always load [Style Guide & ASD-STE100](./references/Style-Guide-STE.md) alongside the specific domain reference:

| Wiki Domain & Document Type | Target Page | Reference File to Load |
|---|---|---|
| **Global Style & ASD-STE100 Rules** | *All pages* | [Style-Guide-STE.md](./references/Style-Guide-STE.md) |
| **Web Dev: Landing & Features** | `Home.md`, `1.-Features.md` | [Intro.md](./references/Intro.md) |
| **Web Dev: Architecture** | `2.-Architecture-Overview.md` | [Architecture.md](./references/Architecture.md) |
| **Web Dev: Database & Persistence** | `3.-Database-Design.md` | [Database.md](./references/Database.md) |
| **Web Dev: Authentication & Security** | `4.-Authentication.md` | [Authentication.md](./references/Authentication.md) |
| **Web Dev: Binary File Storage** | `5.-Storage.md` | [Storage.md](./references/Storage.md) |
| **MCP Servers: Protocol & Tools** | `Home.md`, `Design-Overview.md`, `Tools-Design.md` | [MCP-Servers.md](./references/MCP-Servers.md) |
| **AI Fine-Tuning Suite** | `Home.md`, `Fine-Tuning-Pipeline.md`, `Mult-IT-...md` | [AI-Fine-Tuning.md](./references/AI-Fine-Tuning.md) |
| **AI Benchmarking Suite** | `Home.md`, `Benchmarking-Pipeline.md`, `ITALIC-...md` | [AI-Benchmarking.md](./references/AI-Benchmarking.md) |

---

# Universal Core Directives

Every wiki document must strictly satisfy these five rules:

1. **ASD-STE100 Language Standard**:
   - Limit procedural sentences to **20 words maximum**.
   - Limit descriptive sentences to **25 words maximum**.
   - State one thought per sentence.
   - Use the active voice with direct imperative verbs for steps.
   - Restrict noun clusters to three consecutive nouns maximum.
   - Eliminate filler, greetings, and promotional hype.

2. **100% British English**:
   - Use British English spelling throughout (`optimise`, `initialise`, `behaviour`, `authorisation`, `modelling`, `centralise`).

3. **Strict No-Code-Snippets Policy & Code Citations**:
   - Multi-line code blocks in any programming language are strictly prohibited.
   - Only ````mermaid```` diagram blocks are allowed.
   - Represent logic using Mermaid diagrams, data contract tables, and numbered algorithms.
   - Cite code inline via `[path/to/file.ext: symbolName]`.
   - Every technical page must include a `# Source Code References` table mapping components to concrete file paths and symbols.

4. **Universal References Section Standard**:
   - The final `# References` section must follow the exact same structure across all pages in all wikis.
   - Format references strictly as a numbered list of markdown links with no descriptions or commentary:
     ```markdown
     # References

     1. [Resource Title](https://example.com/url)
     2. [Specification Title](https://example.com/spec)
     ```

5. **Modern Mermaid v11 Standard**:
   - Use `flowchart TD` or `flowchart LR`. Deprecated `graph TD` is forbidden.
   - Enclose every node label containing spaces or parentheses in double quotes: `Node["Label (Details)"]`.
   - Use semantic shapes: `["Module"]`, `(["Trigger / Boundary"])`, `[("Database")]`, `{"Decision"}`.
   - Use `flowchart LR` for data pipelines and token flows; `flowchart TD` for layered architectures; `sequenceDiagram` with `autonumber` for request lifecycles; `erDiagram` with explicit attributes for data models.

---

# Verification Gate

Before completing any wiki document, verify:
- [ ] Sentences comply with ASD-STE100 word limits (procedural ≤ 20 words, descriptive ≤ 25 words).
- [ ] Language is 100% British English.
- [ ] Zero implementation code snippets remain (only ````mermaid```` is present).
- [ ] Landing page (`Home.md`) `# Wiki Documentation` table contains only pages belonging to the current wiki repository with no cross-wiki references.
- [ ] Technical pages contain an accurate `# Source Code References` table.
- [ ] `# References` section is formatted strictly as a numbered list of markdown links with no descriptions.
- [ ] Mermaid diagrams use `flowchart`, contain quoted labels, and render without syntax errors.
- [ ] No bold headings (`# **Title**` is banned) and single space after `#`.
