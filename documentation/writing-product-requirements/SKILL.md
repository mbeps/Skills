---
name: writing-product-requirements
description: Use when creating or modifying product requirements documents (PRDs), defining problem statements, goals with non-goals, target users, core features with measurable success metrics, or scoping product features to prevent scope creep
---

# Writing Product Requirements Documents

Create decision documents that answer what, why, and for whom. Not how.

## Structure

Eight sections, max five pages. See **references/structure.md** for full specs.

1. Overview (3–5 sentences)
2. Problem (pain, evidence, urgency — inline, NOT separate sub-sections)
3. Goals (outcome-focused objectives)
4. Non-Goals (explicitly out of scope + reasoning — not "later")
5. Target User (who benefits, their context)
6. Core Features (high-level capabilities only — no user stories, technical specs, data models)
7. Success Metrics (≥3 types: outcome, leading indicator, guardrail — each maps to exactly one goal, numbers required)
8. Extras (only if genuinely needed: assumptions & dependencies OR risks & mitigations — pick one, state why neither is used)

Open Questions allowed in drafts. Resolve through iteration. Zero open questions in final version.

## Workflow

### Create

Run the checklist in **references/workflows.md**. Ask clarifying questions only when they improve accuracy, scope, or metrics. Resolve questions, write. Output: `./.docs/product-requirements.md`. Red-Green-Refactor: draft → verify rules → fix violations.

### Modify

Read existing document fully. Identify gaps (missing sections? Weak metrics?). Update incrementally. Re-run all self-checks after each change. Verify every metric maps to a goal.

## Discipline Rules

Never exceed these limits. If you do, delete and start over.

| Violation | Action |
|-----------|--------|
| Overview >5 sentences | Delete, rewrite shorter |
| Spelled-out numbers ("thirty percent") | Use digits ("30%") |
| Long or complex sentences | Shorten to one idea per sentence |
| Cheesy language | Replace with direct factual statement |
| Technical implementation details | Engineers own the "how" |
| Success metrics without numbers | Add specific measurements |
| Non-goals without reasoning | Tag as deferred intentionally or out of scope entirely |
| Both Assumptions AND Risks sections | At most one. Usually neither. |
| Feature list in overview | Move to Core Features |
| Evidence as separate subsection under Problem | Inline evidence into narrative |

## Style Rules

The PRD follows these rules:

- **British English.** No American spelling.
- **Short sentences.** One idea per sentence. No long clauses.
- **No hype words.** Avoid "seamless", "robust", "powerful", "game-changing".
- **Truthful.** Only state verifiable facts. Mark unverified claims.
- **No hidden assumptions.** State them explicitly when needed.
- **ASD-STE100 preferred.** Follow Simplified Technical English guidelines.

Write the PRD to `./.docs/product-requirements.md`. Create `.docs/` if missing.

## Common Rationalizations

| Excuse | Rebuttal |
|--------|----------|
| "User stories for clarity" | User stories are acceptance criteria for devs. This is a decision document. |
| "Open questions help track unknowns" | Resolve unknowns by asking first. Document answers, not questions. |
| "More sections = more thorough" | Longer docs = less read. Five pages max. Engineers skim. |
