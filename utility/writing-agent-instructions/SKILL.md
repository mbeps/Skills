---
name: writing-agent-instructions
description: Use when creating, updating, or reviewing agent instruction files (such as .github/copilot-instructions.md, AGENT.md, CLAUDE.md, or GEMINI.md) for a project codebase.
---

# Writing Agent Instructions

## Overview

An agent instruction file is a strict contract that governs how AI agents interact with and develop within a codebase. Follow the fixed section order, standard baseline rules, and precise reference formats; do not improvise headings, inject project tree diagrams, or alter baseline instructions.

## When to Use

- Creating a new agent instruction file for a repository.
- Updating an existing agent instruction file to match project changes.
- Auditing an agent file against the required standard.

**Do NOT use when:**
- Modifying standard project source code, configuration files, or documentation other than agent instruction files.
- Authoring human-facing repository READMEs (use `writing-readmes`).

## The Agent File Contract

Agent instruction files must contain these 8 sections in this exact order:

| # | Section | Status | Specification |
|---|---|---|---|
| 1 | `# Project Overview` | **Required** | Exactly 1–2 sentences. Concise and direct. **Never mention tech stack or tools here**. |
| 2 | `# Instructions (MUST be followed)` | **Required** | Standard 8 baseline rules (see `structure.md`) followed by any user-specified additions. |
| 3 | `# Tech Stack` | **Required** | Categorized into `## Frontend`, `## Backend`, etc. Every technology MUST link to official docs. |
| 4 | `# Resources` | **Required** | Pointers to `README` (always), `Coding Conventions` (if present), `Graphify` assets (always), `Wiki` (if present), and architectural docs. **Never list package manager files** (`package.json`, etc.). |
| 5 | `# Skills` | **Required** | Universal core skills (always included) plus stack-detected skills. **Never include one-time/meta skills**. |
| 6 | `# Additional Tools (and MCPs)` | **Required** | Non-obvious runtime tools and MCPs (`headroom`, `Context7`, `Web`, etc.). |
| 7 | `# Graphify` | **Required** | Identical verbatim prompt instructions across all agent files. |
| 8 | `# Extras` | **Conditional** | Present **ONLY** if the user explicitly provided additional content. Never fabricate. |

## Mandatory Operational Rules

1. **Target File Name**: Support `.github/copilot-instructions.md`, `AGENT.md`, `GEMINI.md`, `CLAUDE.md`, etc. If the user has not specified the file name or location, **ask the user** before writing.
2. **Strict File Isolation**: The skill **MUST NOT modify any other file** in the project repository. It can only create or update agent instruction files (and run the `graphify` skill if graphify assets are missing).
3. **No Inline Design or Structure Trees**: Do NOT inline file tree diagrams, architecture sketches, or design details. Place or link these in `# Resources`.
4. **Path Relativity**: Adjust paths based on the file location (e.g. `#file:../README.md` from `.github/` vs `#file:./README.md` from project root).

## Quick Reference

| Topic | Reference File |
|---|---|
| Section templates, exact baseline rules, and path resolution | `structure.md` |
| Universal skills, stack-specific triggers, and prohibited skills | `skills-catalog.md` |
| Fully worked canonical examples (`.github/` and root `AGENT.md`) | `example.md` |

## Common Mistakes

| Mistake | Correction |
|---|---|
| Mentioning tech stack in `# Project Overview` | Keep overview strictly to 1–2 sentences describing what the app does. Stack belongs exclusively in `# Tech Stack`. |
| Missing official doc hyperlinks in `# Tech Stack` | Every single technology listed must have a markdown hyperlink to its official documentation. |
| Listing `package.json`, `tsconfig.json`, or `pyproject.toml` in `# Resources` | Prohibited. Only list high-level documentation, conventions, graphify assets, and wikis. |
| Modifying code files or configs while running this skill | Prohibited. You may only create or modify agent instruction files. |
| Adding one-time or meta skills (`writing-skills`, `refining-skills`, `migrating-*`) to `# Skills` | Only include persistent workflow and stack-specific operational skills. |
| Altering or omitting the baseline instructions in section 2 | The 8 baseline rules must appear verbatim in every file. User instructions are appended. |
| Adding an empty or speculative `# Extras` section | Omit `# Extras` entirely unless the user explicitly provides additional information. |
| Inlining file trees or system architecture diagrams | Link to external architecture documents in `# Resources`. |

## Procedure

1. **Determine Target File**: Confirm the agent file path (`.github/copilot-instructions.md`, `AGENT.md`, `GEMINI.md`, `CLAUDE.md`). If unspecified, ask the user.
2. **Inspect Repository Stack & Assets**:
   - Identify core technologies and obtain official doc URLs.
   - Check if `README.md`, coding convention files, or a `wiki/` directory exist.
   - Check if `graphify-out/` exists; if missing, invoke the `graphify` skill to generate it.
3. **Select Skills**:
   - Include all universal core skills from `skills-catalog.md`.
   - Add stack-specific skills matching the codebase (TypeScript, Next.js, database, auth, testing).
   - Ensure zero prohibited meta skills are included.
4. **Assemble the File**:
   - Draft the 8 sections following `structure.md` and resolving relative file paths.
   - Incorporate any user-provided additional instructions or extras.
5. **Review Against Contract**:
   - Verify overview length (1–2 sentences, no stack mention).
   - Verify all baseline instructions are present verbatim.
   - Verify all tech stack items have doc links.
   - Verify no package manager files appear in `# Resources`.
   - Write or update only the designated agent file.

