# Workflow Reference

## Create Mode Checklist

Step-by-step flow for writing a new PRD from scratch.

1. **Clarify** — Ask questions to the stakeholder or user. Resolve ALL uncertainties before writing. Record answers.
   - If you cannot ask anyone (document review only), state assumptions explicitly — but do NOT put them in the PRD yet. Resolve them first.
2. **Draft** — Write the PRD following the structure.md section definitions exactly.
3. **Review self** — Check against these discipline rules:
   - [ ] Overview is 3-5 sentences maximum
   - [ ] Non-Goals each have explicit reasoning attached
   - [ ] Success metrics contain numbers AND measurement methods
   - [ ] No "Open Questions" section exists (questions should be resolved, not listed)
   - [ ] No technical implementation details slipped into Core Features
   - [ ] Core Features are high-level capabilities only (no user stories, no APIs, no data models)
4. **Share for review** — Send draft to stakeholders
5. **Incorporate feedback** — Modify iteratively. Track changes made and why.
6. **Finalize** — Remove any remaining open items. All questions must be either resolved or excluded before final version.

## Modify Mode Checklist

For editing an existing PRD:

1. **Read fully** — Understand the current state. Note section quality issues, missing content, contradictions.
2. **Identify gaps** — What sections are weak or absent? Are metrics measurable? Is the problem clearly defined?
3. **Update incrementally** — Fix one thing at a time. Do not batch multiple unrelated changes.
4. **Re-verify** — Run the same self-check used in Create mode after finishing.
5. **Record changes** — Note what changed and why. Stakeholders need to see evolution.

## Question Protocol

**BEFORE writing the PRD:**

- Ask about: target user, problem evidence, success criteria, scope boundaries, timing urgency
- If answering requires research, note it as an assumption and verify before publishing
- DO NOT leave unanswered questions in an "Open Questions" section. Either resolve them during Clarify or exclude the topic entirely

**AFTER writing the draft:**

- Share for stakeholder review
- Incorporate feedback systematically
- Resolve any emerging questions before finalizing

**Golden rule:** Open questions belong in your working notes, never in the published PRD.

## Quality Bar

A PRD passes review when:

- Anyone can read it and understand WHAT needs to happen and WHY
- Engineers can start designing from it (they know what to build)
- Stakeholders can see their priorities reflected accurately
- Scope creep is prevented by explicit non-goals with reasoning
- Success is measurable, not aspirational

Do NOT accept a PRD that stops at:

- Long document nobody reads
- Mix of "what" (goals, problem) and "how" (implementation details)
- Unmeasurable goals ("improve UX", "make better")
- Open questions that should have been resolved during Clarify phase
