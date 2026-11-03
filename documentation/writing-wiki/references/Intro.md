---
name: Wiki Writer.Intro
description: Generates user-facing project landing and feature pages adhering to ASD-STE100 and British English without technical jargon or implementation code.
agent: Wiki Writer
---

# Introduction

Generate the project landing page (`Home.md`) and feature documentation (`1.-Features.md`). Focus on high-level capabilities, user benefits, and documentation navigation.

---

# What to do

1. **Write the Project Overview**:
   - Compose a single, concise paragraph explaining the project at a high level.
   - Keep descriptive sentences under 25 words following ASD-STE100.
   - Do not add any title or heading above this opening paragraph.
2. **Structure the Features Section**:
   - Create a primary heading `# Features`.
   - Group capabilities under `## [Category]` subheadings (e.g. `## Authentication`, `## Workflows`).
   - Describe features in concise bullet points. Focus on user value rather than internal wiring.
3. **Build the Wiki Documentation Index**:
   - Create a primary heading `# Wiki Documentation`.
   - Provide a complete markdown table listing all wiki pages:
     `| Section | Page | Description |`
   - Link each page with relative Markdown syntax: `[Filename](./Filename.md)`.
   - **Strict Isolation to Current Wiki**: The table must strictly contain only pages belonging to the current wiki repository. Never reference, list, or link to pages from other wikis in this table.
4. **Use ASD-STE100 & British English**:
   - Keep sentences short, direct, and active.
   - Use British English spelling (`categorise`, `optimise`, `centralise`).
   - Eliminate all welcome filler ("Welcome to the documentation", "This project is designed to...").

---

# What not to do

- **No Opening Heading**: Do not put a heading or title before the introductory paragraph.
- **No Introductory Fluff**: Do not include conversational greetings or promotional claims.
- **No Implementation Code**: Do not include code snippets, database schemas, or API handler implementations.
- **No Jargon in User Features**: Translate technical mechanisms into user capabilities (e.g. "Users sign in with Google" instead of "OAuth 2.0 PKCE dance").
- **No Cross-Wiki References in Index**: Do not reference or link to external/other wikis in the `# Wiki Documentation` table.

---

# Canonical Template: `Home.md`

```markdown
[Single concise paragraph explaining what the project is at a high level. No title or heading for this paragraph, no "Welcome to...", no promotional filler.]

# Features

## [Category 1]
- [User-facing capability written in British English]
- [User-facing capability]

## [Category 2]
- [User-facing capability]
- [User-facing capability]

# Wiki Documentation

| Section | Page | Description |
|---|---|---|
| Architecture | [2.-Architecture-Overview.md](./2.-Architecture-Overview.md) | System topology, technology stack, and execution flows |
| Database Design | [3.-Database-Design.md](./3.-Database-Design.md) | Entity relationships, schemas, and normalisation analysis |
| Authentication | [4.-Authentication.md](./4.-Authentication.md) | Identity providers, session lifecycle, and route security |
| File Storage | [5.-Storage.md](./5.-Storage.md) | Storage buckets, presigned upload pipeline, and permissions |
```

---

# Quality Bar

- **Sentence Limit**: Procedural steps under 20 words; descriptive text under 25 words.
- **Tone**: Authoritative, direct, and clear.
- **Spelling**: 100% British English.
- **Traceability**: All listed pages must match existing files in the repository wiki.
