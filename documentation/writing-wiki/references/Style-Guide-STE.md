# Style Guide & ASD-STE100 Standard

This reference defines language, typography, diagram, and code citation rules for all wiki pages.

---

## 1. ASD-STE100 Simplified Technical English Principles

All wiki content must follow ASD-STE100 principles for maximum clarity, conciseness, and precision:

### Rule 1: Sentence Length Limits
- Keep procedural sentences (instructions and steps) to a maximum of **20 words**.
- Keep descriptive sentences (explanations and specifications) to a maximum of **25 words**.

### Rule 2: One Thought per Sentence
- State only one instruction or one conceptual point per sentence.
- Divide compound thoughts into distinct sentences.

### Rule 3: Active Voice & Mood
- Use the active voice. Identify the actor or component performing the action.
  - ❌ BAD: "The token is validated by the guard."
  - ✅ GOOD: "The guard validates the token."
- Use the imperative mood for procedures and instructions:
  - ❌ BAD: "The developer should execute the script."
  - ✅ GOOD: "Execute the script."
- Use the present indicative tense for system descriptions:
  - ❌ BAD: "The handler will process the incoming request."
  - ✅ GOOD: "The handler processes the incoming request."

### Rule 4: Restrict Noun Clusters
- Do not chain more than three nouns together.
  - ❌ BAD: "Client request payload validation schema error handler."
  - ✅ GOOD: "Error handler for client payload validation schemas."

### Rule 5: Strict & Literal Vocabulary
- Choose direct verbs over nominalisations and phrasal verbs:
  - Use `start` (not `spin up` or `kick off`).
  - Use `remove` (not `tear down` or `get rid of`).
  - Use `stop` (not `kill`).
  - Use `connect` (not `hook into`).
  - Use `execute` or `run` (not `fire off`).
- Avoid vague qualifiers: `appropriate`, `sufficient`, `proper`, `as needed`, `etc.`, `and/or`. State exact conditions.
- Eliminate marketing puffery, corporate hype, and conversational filler:
  - ❌ BANNED: "Welcome to the wiki", "Introducing X, a revolutionary platform...", "In this section we will examine...".
  - ✅ REQUIRED: Begin immediately with direct technical descriptions.

### Rule 6: Condition Before Action
- State the condition before the required action:
  - ❌ BAD: "Restart the service if the configuration changes."
  - ✅ GOOD: "If the configuration changes, restart the service."

---

## 2. British English Standard

Use 100% British English across all text, diagrams, and identifiers:

| Concept / Pattern | British English (Required) | US Spelling (Prohibited) |
|---|---|---|
| `-ise` suffix | `optimise`, `initialise`, `serialise`, `customise`, `standardise`, `centralise` | `optimize`, `initialize`, `serialize`, `customize`, `standardize`, `centralize` |
| `-isation` suffix | `organisation`, `authorisation`, `normalisation` | `organization`, `authorization`, `normalization` |
| `-our` suffix | `behaviour`, `colour` | `behavior`, `color` |
| Double `l` | `modelling`, `cancelled`, `labelled` | `modeling`, `canceled`, `labeled` |
| Technical terms | `whilst`, `programme`, `catalogue`, `defence` | `while`, `program` (unless code keyword), `catalog`, `defense` |

---

## 3. Typography & Markdown Elements

### Headings
- **H1 (`# Title`):** Title or Sentence case. Never use bold syntax (`# **Title**` is prohibited). Exactly one space after `#`.
- **H2 (`## Section`):** Descriptive, clean noun phrases.
- **H3 (`### Item`):** Specific entity, component, or parameter name.

### Alerts & Callouts
Replace legacy blockquotes (`> **Note:**`) with GitHub Flavored Markdown alerts:
```markdown
> [!NOTE]
> Explanatory note or implementation background.

> [!IMPORTANT]
> Critical architectural or operational requirement.

> [!WARNING]
> Security consideration or potential failure mode.
```

### Tables
Format tables with uniform column alignment and descriptive headers.

### Citations & References Section
Use numeric brackets `[1]`, `[2]` inline for external literature or specifications.

The `# References` section must follow the exact same structure across all pages in all wikis:
- It must be a numbered list of markdown links only.
- It must not include descriptions, summaries, annotations, or extra commentary.

Example:
```markdown
# References

1. [Next.js App Router Documentation](https://nextjs.org/docs/app)
2. [RFC 6749: The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
```

---

## 4. Code Citation Standard (Zero Implementation Code Snippets)

To prevent documentation drift, wikis strictly forbid multi-line implementation code blocks.

### Strict Prohibitions
- **NO** multi-line code blocks (`ts`, `js`, `py`, `sql`, `json`, `yaml`, `bash`).
- Only ````mermaid```` code blocks are permitted.

### Approved Representations of Logic
1. **Mermaid Diagrams:** Illustrate lifecycles, topologies, sequences, and states.
2. **Data Contract Tables:** Document parameters, schemas, and fields (Field, Type, Required, Description).
3. **Numbered Algorithmic Steps:** Detail execution flows step-by-step.
4. **Inline Symbol Citations:** Pair symbols with file paths: `[path/to/file.ext: symbolName]`.
5. **Mandatory `# Source Code References` Table:** Every technical page must end with this table:

```markdown
# Source Code References

| Component / Mechanism | Source File Path | Key Symbols / Exports | Architectural Responsibility |
|---|---|---|---|
| Session Guard | `src/features/auth/guards.ts` | `requireAuth()`, `requireAdmin()` | Validates session cookies and enforces RBAC |
| Webhook Handler | `src/app/api/webhooks/route.ts` | `POST` | Dispatches incoming provider webhook events |
```

---

## 5. Mermaid Diagram Unified Design Language (v11+)

All diagrams must follow these structural rules:

1. **Syntax:** Use modern `flowchart TD` or `flowchart LR`. Never use deprecated `graph TD`.
2. **Quoted Node Labels:** Always wrap node labels containing spaces, parentheses, or punctuation in double quotes:
   - ✅ `Browser["Browser (Client Tier)"]`
   - ❌ `Browser[Browser (Client Tier)]`
3. **Semantic Shapes:**
   - Square `["Component / Action"]` for standard modules.
   - Rounded `(["External Boundary / Endpoint"])` for process triggers and endpoints.
   - Cylinder `[("Database / Storage")]` for persistence engines.
   - Diamond `{"Decision / Check"}` for conditional routing.
   - Subgraphs: `subgraph Client["Client Tier"]`.
4. **Flow Direction:**
   - Use `flowchart LR` for data pipelines, token streams, and ETL workflows.
   - Use `flowchart TD` for layered architectures, hierarchies, and decision trees.
   - Use `sequenceDiagram` with `autonumber` for request/response lifecycles.
   - Use `erDiagram` with explicit attributes and cardinality for entity models.

