---
name: writing-agent-instructions
description: Use when creating, updating, or reviewing the AGENTS.md file for a project codebase.
---

# Writing Agent Instructions

## Overview

An agent instruction file is a strict contract that governs how AI agents interact with and develop within a codebase. In all repositories, this file is strictly **`AGENTS.md`** at the project root. Follow the fixed section order, standard baseline rules, and precise reference formats; do not improvise headings, inject project tree diagrams, or alter baseline instructions.

## When to Use

- Creating a new `AGENTS.md` file for a repository.
- Updating an existing `AGENTS.md` file to match project changes.
- Auditing `AGENTS.md` against the required standard.

**Do NOT use when:**
- Modifying standard project source code, configuration files, or documentation other than agent instruction files.
- Authoring human-facing repository READMEs (use `writing-readmes`).

## The Agent File Contract

`AGENTS.md` files must contain these sections in order:

| # | Section | Status | Specification |
|---|---|---|---|
| 1 | `# Project Overview` | **Required** | Exactly 1–2 sentences. Concise and direct. **Never mention tech stack or tools here**. |
| 2 | `# Instructions (MUST be followed)` | **Required** | Standard baseline rules (see `structure.md`) followed by any user-specified additions. |
| 3 | `# Tech Stack` | **Required** | Categorized into `## Frontend`, `## Backend`, etc. Every technology MUST link to official docs. |
| 4 | `# Resources` | **Required** | Pointers to `README` (always), `Coding Conventions` in `.agents/` (if present), `Graphify` assets (always), `Wiki` (if present), and architectural docs. **Never list package manager files** (`package.json`, etc.). |
| 5 | `# Skills` | **Required** | Universal core skills (always included) plus stack-detected skills. **Never include one-time/meta skills**. |
| 6 | `# Additional Tools (and MCPs)` | **Required** | Non-obvious runtime tools and MCPs (`headroom`, `Context7`, `Web`, etc.). |
| 7 | `# Graphify` | **Required** | Identical verbatim prompt instructions across all agent files. |
| 8 | `# Learnings` | **Conditional** | Pointers and rules for `.agents/learnings.md` when project maintains an agent learnings log. |
| 9 | `# Extras` | **Conditional** | Present **ONLY** if the user explicitly provided additional content. Never fabricate. |

## Mandatory Operational Rules

1. **Target File Name**: Always create or update strictly **`AGENTS.md`** at the repository root. The user does not need to specify this file name, and agents must **never ask** which file to target.
2. **Strict File Isolation**: The skill **MUST NOT modify any other file** in the project repository. It can only create or update `AGENTS.md` (and run the `graphify` skill if graphify assets are missing).
3. **Agent Materials in `.agents/`**: Coding conventions are stored in the `.agents/` folder (e.g. `.agents/conventions.md` or `.agents/convensions.md`). All additional AI coding agent related materials (such as `.agents/learnings.md`, prompt templates, or agent-specific documentation) MUST also live inside the `.agents/` directory.
4. **No Inline Design or Structure Trees**: Do NOT inline file tree diagrams, architecture sketches, or design details. Place or link these in `# Resources`.
5. **Path Relativity**: Since `AGENTS.md` is always at the project root, all resource links resolve from root using `#file:./` (e.g. `#file:./README.md`, `#file:./.agents/conventions.md`, `#file:./graphify-out/`).

## Quick Reference

| Topic | Reference File |
|---|---|
| Section templates, exact baseline rules, and path resolution | `structure.md` |
| Universal skills, stack-specific triggers, and prohibited skills | `skills-catalog.md` |
| Fully worked canonical examples of `AGENTS.md` | `example.md` |

## Common Mistakes

| Mistake | Correction |
|---|---|
| Asking user for target file name or using non-`AGENTS.md` filenames | Target is always `AGENTS.md` at the project root. Never ask user. |
| Storing conventions or agent materials outside `.agents/` | Conventions and agent materials (e.g. `learnings.md`) belong in `.agents/`. |
| Mentioning tech stack in `# Project Overview` | Keep overview strictly to 1–2 sentences describing what the app does. Stack belongs exclusively in `# Tech Stack`. |
| Missing official doc hyperlinks in `# Tech Stack` | Every single technology listed must have a markdown hyperlink to its official documentation. |
| Listing `package.json`, `tsconfig.json`, or `pyproject.toml` in `# Resources` | Prohibited. Only list high-level documentation, conventions, graphify assets, and wikis. |
| Modifying code files or configs while running this skill | Prohibited. You may only create or modify `AGENTS.md`. |
| Adding one-time or meta skills (`writing-skills`, `refining-skills`, `migrating-*`) to `# Skills` | Only include persistent workflow and stack-specific operational skills. |
| Altering or omitting the baseline instructions in section 2 | Baseline rules must appear in every file. User instructions are appended. |
| Adding an empty or speculative `# Extras` section | Omit `# Extras` entirely unless the user explicitly provides additional information. |
| Inlining file trees or system architecture diagrams | Link to external architecture documents in `# Resources`. |

## Procedure

1. **Target File**: Target is always `AGENTS.md` at repository root. Do NOT ask the user.
2. **Inspect Repository Stack & Assets**:
   - Identify core technologies and obtain official doc URLs.
   - Check if `README.md`, `.agents/` folder (conventions, learnings, or other agent materials), or a `wiki/` directory exist.
   - Check if `graphify-out/` exists; if missing, invoke the `graphify` skill to generate it.
3. **Select Skills**:
   - Include all universal core skills from `skills-catalog.md`.
   - Add stack-specific skills matching the codebase (TypeScript, Next.js, database, auth, testing).
   - Ensure zero prohibited meta skills are included.
4. **Assemble the File**:
   - Draft the sections following `structure.md` and resolving relative file paths from repository root (`#file:./...`).
   - Incorporate any user-provided additional instructions, learnings, or extras.
5. **Review Against Contract**:
   - Verify overview length (1–2 sentences, no stack mention).
   - Verify all baseline instructions are present verbatim.
   - Verify all tech stack items have doc links.
   - Verify no package manager files appear in `# Resources`.
   - Verify coding conventions and agent materials point to `.agents/`.
   - Write or update only `AGENTS.md` at project root.

