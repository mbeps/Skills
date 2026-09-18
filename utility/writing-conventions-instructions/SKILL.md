---
name: writing-conventions-instructions
description: Use when creating or updating a coding conventions file (stored in .agents/ folder, e.g. .agents/conventions.md) for a project, when deciding what belongs in the file versus what is already documented in skills, or when a conventions file duplicates content that lives in a skill.
---

# Writing Conventions Instructions

## Overview

A conventions file is a **thin pointer, not a duplicate**. Coding conventions are stored inside the `.agents/` folder (e.g. `.agents/conventions.md` or `.agents/convensions.md`). Its job is to capture what is unique to this project and to point at the skills that already document the general rules. If a convention already lives in a skill, the file references the skill instead of restating it. One source of truth, never two.

**Core principle:** If a skill documents it, the conventions file links to the skill. The file only restates a rule when the project overrides the skill or the rule is project-specific.

## When to Use

Use this skill when:

- Creating a new conventions file in `.agents/` (e.g. `.agents/conventions.md` or `.agents/convensions.md`) for a project.
- Updating an existing conventions file after a skill or project change.
- Reviewing a conventions file that duplicates content already in skills.
- Deciding whether a rule belongs in the file or in a skill.

**Do NOT use when:**

- Writing the full agent instruction file (`AGENTS.md`). Use `writing-agent-instructions` for that.
- Writing a README. Use `writing-readmes`.

## Core Pattern

For every convention you are about to write, ask: **"Does a skill already document this?"**

- **Yes, and the project follows it as-is** → Do NOT restate it. Add a reference to the skill.
- **Yes, but the project overrides it** → State the override explicitly and name the skill it overrides.
- **No (project-specific)** → Write it in the file.

```markdown
# ❌ BAD: Duplicates the structuring-nextjs-projects skill
- **Filenames**: Use kebab-case exclusively.
- **Imports**: Use absolute paths with the `@/` alias.
- **Exports**: Favour named exports over default exports.

# ✅ GOOD: References the skill, only adds what's unique
## Directory & Naming
Follow `structuring-nextjs-projects` for directory layout, file naming, imports, exports, and one-export-per-file.

## Project-Specific Overrides
- **Override `structuring-nextjs-projects`**: This project uses `database/` for SQL schema files (not covered by the skill).
- **Override `centralised-routes`**: Route registry lives in `config/routes.ts` and also exports `PROTECTED_ROUTES`.
```

The skill is not tied to one stack. The same pattern applies to any language:

```markdown
# Python project — reference the covering skill, write only what's unique
## Skills
- `python-typing-ecosystem` — mypy/Pyright/Pyrefly type-checking setup.

## Project-Specific
- Tests live in `tests/` and use pytest fixtures from `conftest.py`.
```

## How to Build the File

1. **Inventory the stack.** Identify the languages and frameworks (Next.js, Python, Java, etc.).
2. **Find the covering skills.** For each area (structure, naming, env vars, routes, logging, testing), find the skill that documents it. See the skill catalog in `writing-agent-instructions` for stack-specific skills.
3. **Classify each convention** as: covered-by-skill (reference), override (state + name skill), or project-specific (write it). Apply the override test: would the rule be wrong if the reader followed the skill verbatim? If no, it is a reference. If no skill covers the convention, write it as project-specific.
4. **Write the file** with a `## Skills` section listing every referenced skill, and a `## Overrides` section for deviations.

## File Structure

A conventions file should contain, in order:

| Section | Content |
|---------|---------|
| `## Skills` | Every skill the file references, with a one-line note on what it covers. |
| `## Overrides` | Rules that deviate from a skill. Each entry names the skill it overrides. |
| `## Project-Specific` | Conventions unique to this project (folders, tooling, data layer, security). |
| `## Related Skills` | Skills that are relevant but not referenced inline (e.g. used only when a specific task arises). |

Keep the file short. If a section would restate a skill, replace it with a reference. Use `## Skills` for skills the file points to directly; use `## Related Skills` only for skills that are contextually relevant but not referenced inline.

## Overrides

An override exists **only when the project deviates from a skill**. If the project follows the skill as-is, it is a reference, not an override. Do not invent overrides for rules the skill already states.

```markdown
# ❌ BAD: Not an override — the skill already says config/env.ts
- **Override `typescript-environment-variables`**: Env validation lives in `config/env.ts`.

# ✅ GOOD: This is a reference (project follows the skill)
## Skills
- `typescript-environment-variables` — centralised, Zod-validated env config in `config/env.ts`.

# ✅ GOOD: A real override (project deviates from the skill)
## Overrides
- **Override `typescript-environment-variables`**: Env validation lives in `lib/env.ts`, not `config/env.ts`.
```

**Test for an override:** Would the rule be wrong if the reader followed the skill verbatim? If no, it is a reference. If yes, it is an override.

Always name the skill being overridden so a reader knows the source of truth and can spot drift. If a skill is later updated to match the project, remove the override and the file shrinks back to references.

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|----------------|-----|
| Restating skill content (naming, imports, exports) | Two sources of truth that drift apart | Replace with a reference to the skill |
| No `## Skills` section | Reader can't find the source of truth | List every referenced skill |
| Override without naming the skill | Can't tell what's being deviated from | Always name the overridden skill |
| Listing a rule as an override when the project follows the skill | Falsely implies a deviation; bloats the file | Apply the override test — if the skill already says it, it's a reference |
| Copying a whole skill into the file | File becomes a stale duplicate | Link to the skill instead |
| Writing a full agent file instead of a conventions file | Wrong artifact | Use `writing-agent-instructions` |

## Red Flags — STOP and Reclassify

- "Override" entry that restates what the skill already says
- A `## Skills` section that is empty or missing
- Restating naming, import, or export rules that a skill covers
- A file longer than a page that mostly repeats skill content

**All of these mean: the file is duplicating a skill. Replace the duplication with a reference.**

## Related Skills

- `writing-agent-instructions` — the full agent instruction file (`AGENTS.md`). The conventions file in `.agents/` is one resource that `AGENTS.md` links to.
- `structuring-nextjs-projects` — directory layout, naming, imports, exports for Next.js/TypeScript.
- `centralised-routes` — centralised route definitions.
- `typescript-environment-variables` — centralised, validated env config.
- `logtape-nextjs` — structured logging.
- `migrating-eslint-prettier-to-biome` — Biome linting/formatting.