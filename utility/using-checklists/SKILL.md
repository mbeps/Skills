---
name: using-checklists
description: Use when handling a multi-step task that should be tracked in an external markdown checklist instead of being kept entirely in active context
---

# Using Checklists

## Overview

Use a task-local `checklist.md` as the working source of truth for multi-step work. Plan the work into the file, execute or delegate items from it, and update it as soon as each item changes state.

## When to Use

- The task has multiple steps, dependencies, or validation work
- The context window is getting crowded
- Progress must survive across turns
- Some steps should be delegated to subagents

Do not use this skill for trivial one-step tasks.

## Checklist Source

Read the bundled template first: [checklist.md](./checklist.md)

Then use a working file named `checklist.md` for the actual task:
- Reuse an existing task-local `checklist.md` if one already exists
- Otherwise create one from the template in the repo root or another user-requested location
- Keep the filename exactly `checklist.md`

## Workflow

1. Read the template and the user request.
2. Create or update the working `checklist.md` with short, testable checkbox items.
3. Add only actionable items; split large work into smaller steps.
4. Mark delegation explicitly, for example `Delegate: investigate parser failure`.
5. Execute items in order unless dependencies require reordering.
6. After each completed step, immediately mark it `- [x]` in `checklist.md`.
7. For skipped or blocked work, still close the checkbox and record the status inline, for example:
   - `- [x] Skipped: update docs — user requested code only`
   - `- [x] Blocked: run integration test — missing credentials`
8. Do not finish while any checkbox is left open without explanation.

## Delegation Rules

- Delegated work still needs its own checkbox entry.
- Do not mark a delegated item complete until its result has been reviewed and integrated.
- If delegation creates follow-up work, add new checkbox items to `checklist.md` before continuing.

## Completion Rule

Before ending, confirm the working `checklist.md` reflects reality: every item is completed, skipped with a reason, or blocked with a reason.

## Common Mistakes

- Keeping the real plan only in chat instead of in `checklist.md`
- Writing vague items that are too large to verify
- Forgetting to update the file after finishing a step
- Marking delegated work complete before reviewing the result
