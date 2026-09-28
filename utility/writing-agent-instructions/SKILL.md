---
name: writing-agent-instructions
description: Use when creating, updating, or reviewing the AGENTS.md file or modular .agents/ instruction files (development.md, conventions.md, testing.md, design.md, plan.md) for a project codebase.
---

# Writing Agent Instructions

## Overview

Agent instructions govern how AI agents interact with and develop within a codebase. This follows a **tiered progressive disclosure architecture**:

1. **Root Contract (`AGENTS.md`)**: The root orchestrator and entry point, loaded automatically into agent context. Contains high-level project overview, baseline operational rules, tech stack links, baseline skills, and pointers to resources.
2. **Modular On-Demand Rules (`.agents/*.md`)**: Domain-specific rulebooks read by agents just-in-time when performing relevant tasks:
   - `.agents/development.md`: Core dev lifecycle principles, operational constraints, and workflow skills.
   - `.agents/conventions.md` (or `convensions.md`): Directory structure, naming conventions, architectural boundaries, and skill overrides.
   - `.agents/testing.md`: Testing strategy, runner setup, mock overrides, coverage rules, and testing skills.
   - `.agents/design.md`: UI architecture, component hierarchy, page container rules, styling, and design skills.
   - `.agents/plan.md`: Planning instructions, architectural standards, alternative approaches, edge-case analysis, codebase simplification opportunities, anti-bloat rules, and planning skills.

**Core Principle**: A domain rulebook is a **thin pointer, not a duplicate**. If a skill documents it, reference the skill. Only state project-specific rules or explicit skill overrides.

## When to Use

- Creating or updating the root `AGENTS.md` file.
- Creating or updating `.agents/development.md` for project operational rules and workflow skills.
- Creating or updating `.agents/conventions.md` (or `convensions.md`) for code style, structure, and architecture overrides.
- Creating or updating `.agents/testing.md` for test patterns, mocking setups, and testing skills.
- Creating or updating `.agents/design.md` for UI architecture, styling conventions, and design skills.
- Creating or updating `.agents/plan.md` for planning standards, architectural guidelines, edge-case analysis, codebase simplification opportunities, and planning workflow skills.
- Auditing existing agent instructions against project standards.

**Do NOT use when:**
- Modifying standard application source code or configuration files.
- Authoring human-facing repository READMEs (use `writing-readmes`).

---

## Selective / Modular File Generation

Agents MUST support both full suite initialization and targeted single-file generation:

1. **Full Suite Mode**: When asked to set up or overhaul agent instructions for a project, inspect the stack and generate `AGENTS.md` alongside relevant modular files in `.agents/` (`development.md`, `conventions.md`, `testing.md`, `design.md`, `plan.md`).
2. **Targeted / Granular Mode**: When the user specifies a particular file (e.g. *"create only .agents/testing.md"* or *"add design conventions"*), **generate or modify ONLY the requested file**. If a newly created `.agents/*.md` file is not yet listed in `AGENTS.md` `# Resources`, add a pointer to it under `# Resources` in `AGENTS.md`. Do not rewrite other unrelated `.agents/` files unless requested.

---

## The Agent File Contract

### `AGENTS.md` Structure (Root Orchestrator)

`AGENTS.md` files must contain these sections in order:

| # | Section | Status | Specification |
|---|---|---|---|
| 1 | `# Project Overview` | **Required** | Exactly 1–2 sentences. Concise and direct. **Never mention tech stack or tools here**. |
| 2 | `# Instructions` | **Required** | Streamlined baseline operational rules (see `structure.md`) followed by any user-specified rules. |
| 3 | `# Tech Stack` | **Required** | Categorized into `## Frontend`, `## Backend`, etc. Every technology MUST link to official docs. |
| 4 | `# Resources` | **Required** | Pointers to `./README.md`, `.agents/` modular files, `graphify-out/`, and `wiki/`. **Never list package manager files** (`package.json`, etc.). |
| 5 | `# Skills` | **Required** | Universal core skills (always included) plus stack-detected skills. **Never include one-time/meta skills**. |
| 6 | `# Additional Tools (and MCPs)` | **Required** | Non-obvious runtime tools and MCPs (`headroom`, `Context7`, `Web`, etc.). |
| 7 | `# Graphify` | **Required** | Standard verbatim prompt instructions for graphify navigation. |
| 8 | `# Learnings` | **Conditional** | Pointers and rules for `.agents/learnings.md` when project maintains an agent learnings log. |
| 9 | `# Extras` | **Conditional** | Present **ONLY** if the user explicitly provided additional content. Never fabricate. |

---

## Mandatory Operational Rules

1. **Standard Relative Paths**: All resource links resolve from the repository root using standard markdown relative paths (`./...`, e.g. `./README.md`, `./.agents/convensions.md`, `./graphify-out/`). **NEVER use `#file:` prefixes**.
2. **Agent Materials in `.agents/`**: All conventions, development instructions, testing guides, learnings, and prompt templates strictly live in `.agents/`. Keep the repository root clean.
3. **Thin Pointer, Not Duplicate**:
   - For every rule you write in `.agents/`, ask: *"Does a skill already document this?"*
   - If yes and project follows it as-is → Reference the skill.
   - If yes but project overrides it → Explicitly state the override and name the skill.
   - If project-specific → Document it in the appropriate `.agents/*.md` file.
4. **No Inline Design or Structure Trees in `AGENTS.md`**: Do NOT inline large file tree diagrams or design manuals into `AGENTS.md`. Link them in `# Resources` so they are loaded on-demand.
5. **No Package Manager Files**: Never list `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, or similar package manager files in `# Resources`.
6. **Standard `.agents/*.md` Format**: Every modular file in `.agents/` must start with YAML frontmatter (`description` and `applyTo`), an H1 header, `## 1. Skills` at the top, and numbered subsequent sections. Domain-specific skills (e.g. `ui-ux-pro-max`, `writing-nextjs-vitest-tests`) are delegated to these files rather than polluting `AGENTS.md` `# Skills`.

---

## Quick Reference

| Topic | Reference File |
|---|---|
| Section templates, exact baseline rules, and `.agents/*.md` specifications | `structure.md` |
| Universal skills, stack-specific triggers, testing skills, and prohibited skills | `skills-catalog.md` |
| Fully worked canonical examples of `AGENTS.md` and `.agents/*.md` files | `example.md` |

---

## Common Mistakes

| Mistake | Correction |
|---|---|
| Using `#file:` in paths | Use standard markdown relative paths (`./README.md`, `./.agents/development.md`). |
| Restating generic testing or convention rules (e.g. hoisting, runtime module mocking covered by `writing-nextjs-vitest-tests`) | Duplicates skills and creates drift. Point to the skills; document only project-specific runners, directories, setup files, and mock overrides. |
| Inlining testing/design manuals or domain skills directly into `AGENTS.md` | Place them in `.agents/testing.md` or `.agents/design.md` and link in `# Resources`. |
| Rewriting all `.agents/` files when the user asked for one specific file | Respect granular generation requests; modify only the target file. |
| Mentioning tech stack in `# Project Overview` | Keep overview strictly to 1–2 sentences. Stack belongs in `# Tech Stack`. |
| Missing official doc hyperlinks in `# Tech Stack` | Every technology listed must have a markdown hyperlink to its official documentation. |
| Adding one-time meta skills (`writing-skills`, `refining-skills`) to `# Skills` | Only include persistent workflow and stack-specific operational skills. |

---

## Procedure

1. **Identify Target Scope**:
   - Determine whether the user wants a full setup or specific target file(s) (`AGENTS.md`, `.agents/development.md`, `.agents/conventions.md`, `.agents/testing.md`, `.agents/design.md`, `.agents/plan.md`).
2. **Inspect Repository Stack & Assets**:
   - Identify core technologies, test runners (Vitest, Jest, Playwright), database, auth, and styling tools.
   - Check if `README.md`, `.agents/`, `graphify-out/`, or `wiki/` exist.
3. **Draft the Targeted File(s)**:
   - For `AGENTS.md`: Follow the 9 standard sections using standard relative `./` paths.
   - For `.agents/development.md`: Define development principles, operational rules, and workflow skills.
   - For `.agents/conventions.md`: Define structure, naming, architecture patterns, and skill overrides.
   - For `.agents/testing.md`: Define runner setup, mocking patterns, coverage goals, and testing skills.
   - For `.agents/design.md`: Define UI hierarchy, page container rules, styling, and design skills.
   - For `.agents/plan.md`: Define planning standards, alternative approaches, engineering detail, edge-case coverage, codebase simplification opportunities, and planning skills.

4. **Ensure Synchronization**:
   - Verify that any `.agents/*.md` files present in the repo are referenced under `# Resources` in `AGENTS.md`.
5. **Review Against Contract**:
   - Verify zero `#file:` prefixes.
   - Verify doc links in `# Tech Stack`.
   - Verify no meta skills in `# Skills`.
