---
name: writing-readmes
description: Use when writing or updating a README file for a software project, or when checking whether an existing README matches the house style.
---

# Writing Readmes

## Overview

A README in this house style is a fixed contract: same sections, same order, same formats. Follow the contract; do not improvise sections, heading levels, or layouts.

## When to Use

- Write a README for a new software project.
- Update an existing README to match the house style.
- Check a README against the house style before it ships.

Do not use when no README is needed, or when another document type, such as an API reference, is the target.

## The README Contract

A README has exactly these parts, in this order:

| # | Part | Format |
|---|---|---|
| 1 | Project name and intro | `# Project Name`, then one paragraph of 3-4 sentences. The intro does not mention the tech stack. |
| 2 | Features | `# Features` |
| 3 | Requirements | `# Requirements` |
| 4 | Stack | `# Stack` |
| 5 | Optional sections | H1 sections placed before Setting Up Project, only when the project needs them: Design, Database Schema, Docker Support. |
| 6 | Setting Up Project | `# Setting Up Project` with numbered H2 steps |
| 7 | Run Application | `# Run Application` plus optional `# Usage` when interactions or endpoints need documenting |
| 8 | References | `# References`, always last |

**REFERENCE:** Read `structure.md` for the full template of each part.

Heading rules:

- Every top-level section is H1 (`#`). The first H1 is the project name.
- Subsections are H2 (`##`): feature groups, stack groups, and numbered setup steps.
- H3 (`###`) is used only when a third level is genuinely needed.
- Do not bold headings.

## Quick Reference

| Topic | File |
|---|---|
| Section templates and worked examples | `structure.md` |
| Tone, language, and spelling | `style.md` |
| Complete example README | `example.md` |

## Common Mistakes

- The intro mentions the tech stack; the Stack section covers it.
- Sections use H2 instead of H1.
- Wrong section names: "Stack" not "Tech Stack", "Setting Up Project" not "Getting Started", "References" not "Resources".
- Requirements folded into setup as "Prerequisites". It is its own H1 section.
- Unrequested sections such as Screenshots, Scripts, Project Structure, Contributing, License, or Deployment. Add a section only when needed.
- Version numbers in Stack link text. Write "Next.js", not "Next.js 15".
- Minor libraries in the Stack, such as Recharts or date-fns. Core components only.
- Environment variables in a table. Use bullets.
- Setup steps without numbers. Number them.
- References without descriptions. Add a brief description to each.
- A dash separator in Stack bullets. Use `: ` after the link.
- More than one intro paragraph.

**REFERENCE:** Read `example.md` to see the contract applied to a complete project.

## Procedure

1. Analyse the codebase: features, requirements, stack, setup steps.
2. Write the README following the contract in `structure.md`.
3. Apply the tone and language rules in `style.md`.
4. Check the output against the contract and the common mistakes list.
