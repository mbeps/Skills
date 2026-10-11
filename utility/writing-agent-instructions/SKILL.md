---
name: writing-agent-instructions
description: Use when creating, updating, or reviewing the AGENTS.md file or modular .agents/ instruction files (development.md, project-details.md, conventions.md, testing.md, design.md, plan.md) for a project codebase.
---

# Writing Agent Instructions

## Overview

Agent instructions govern AI agent behaviour through **tiered progressive disclosure**:

1. **Root Contract (`AGENTS.md`)**: Root orchestrator loaded into context. Defines overview, rules, doc links, skills, and resource pointers.
2. **Modular Rules (`.agents/*.md`)**: Domain rulebooks loaded on demand:
   - `development.md`: Process-focused dev rules, constraints, workflow skills, verification gates, build/CI rules, tooling gotchas.
   - `project-details.md`: Architecture mechanics, subsystem flows, state lifecycles, concurrency/cancellation, security boundaries, runtime mechanics.
   - `conventions.md`: Directory structure, naming, architectural boundaries, language idioms, skill overrides.
   - `testing.md`: Test strategy, runner setup, mock overrides, coverage gates, testing skills.
   - `design.md`: UI component hierarchy, layout shells, styling, design skills (frontend only; omit on backend/CLI/library).
   - `plan.md`: Planning standards, architecture guidelines, alternatives, edge cases, anti-bloat rules.
   - `learnings.md`: Historical discoveries, pitfalls, session takeaways.

**Core Principle**: Domain rulebooks are **thin pointers, not duplicates**. Reference skills for standard patterns. Document only project-specific rules or explicit skill overrides.

## When to Use

- Creating or updating root `AGENTS.md` or modular `.agents/*.md` files (`development.md`, `project-details.md`, `conventions.md`, `testing.md`, `design.md`, `plan.md`).
- Auditing existing instructions against project standards.

**Do NOT use when:**
- Editing standard application code.
- Authoring repository READMEs (use `writing-readmes`).

## Reference Documents

| Document | Purpose |
|---|---|
| `structure.md` | Section templates, contracts, and modular file layouts. |
| `skills-catalog.md` | Universal and stack skills, placement rules, exclusions. |
| `example.md` | Canonical examples of `AGENTS.md` and `.agents/*.md` files. |

## Mandatory Operational Rules

1. **Standard Relative Paths**: Resolve resource links from repository root using relative paths (`./...`, e.g. `./README.md`, `./.agents/project-details.md`). **NEVER use `#file:` prefixes**.
2. **Clean Root**: Place all modular guidelines in `.agents/`. Keep repository root clean.
3. **Thin Pointer, Not Duplicate**: Document project-specific rules or overrides only. Reference external skills for standard patterns.
4. **Selective Generation**: Support full-suite generation and single-file creation. Synchronise new files in `AGENTS.md` `# Resources`.
5. **No Package Manager Files**: Never list package manager files (`package.json`, `pnpm-lock.yaml`, `Cargo.toml`) in `# Resources`.
6. **Decouple Process from Architecture**: Keep dev process (`development.md`) separate from system architecture (`project-details.md`). Omit `design.md` on headless or backend projects.

## Procedure

1. **Identify Scope**: Full suite setup or specific target file (`AGENTS.md`, `.agents/*.md`).
2. **Inspect Stack**: Identify language, framework, test runner, build system, and UI presence.
3. **Draft Target File(s)**: Apply templates from `structure.md` and skills from `skills-catalog.md`. Detect real verification commands from repository.
4. **Synchronise Resources**: Register all `.agents/*.md` files with descriptive triggers under `# Resources` in `AGENTS.md`.
5. **Review Contract**: Verify relative paths, doc links in `# Tech Stack`, and zero prohibited skills.



