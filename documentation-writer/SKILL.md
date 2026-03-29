---
name: documentation-writer
description: 'Write code documentation blocks: Docstrings (Google style), JavaDoc, JSDoc/TSDoc. Use when adding or updating documentation for classes, functions, methods, interfaces, and types. Supports Python, Java, TypeScript.'
argument-hint: 'Optional: specify language or files to document'
---

# Documentation Writer

Write focused, accurate code documentation blocks that follow industry standards.

## When to Use

- Adding documentation to undocumented code
- Updating stale or incorrect documentation blocks
- Following a language-specific doc style (JavaDoc, Google Docstring, JSDoc/TSDoc)

## Core Rules

**What to document**
- Every class, function, method, interface, type, and public field (unless trivially named)
- Skip config files: `tsconfig`, `pyproject.toml`, `drizzle.config.ts`, `vitest.config.ts`, etc.

**How to write**
- One-line summary first, then explain why the code exists and when to use it
- Include constraints, side effects, or performance notes where relevant
- Use overall project knowledge to add context not obvious from the code alone
- Consult online docs or Context7 to add accurate detail for third-party APIs
- Be concise — no verbose sentences, no filler phrases

**What not to do**
- Never change any code logic or types — only add documentation
- Never run or execute code
- Never fabricate implementation details not present in the code
- Never add redundant type info in typed languages (TypeScript, Java) — types already convey that

## Procedure

1. **Identify scope** — determine which files and symbols need documentation
2. **Analyse** — read the code deeply; understand purpose, inputs, outputs, side effects
3. **Research** — use Context7 or web search to clarify third-party library behaviour if needed
4. **Write** — follow the language-specific guide; document all in-scope symbols
5. **Evaluate** — review for accuracy, conciseness, and standard compliance

## Language Guides

| Language | Style | Guide |
|---|---|---|
| Python | Google Docstring | [python.md](./references/python.md) |
| Java | JavaDoc | [java.md](./references/java.md) |
| TypeScript | JSDoc/TSDoc | [typescript.md](./references/typescript.md) |

## Context Sources

- `README`, `AGENTS.md`, `copilot-instructions.md`
- The code itself
- Relevant online documentation (internet or Context7 MCP)

## Quality Bar

- **Accurate** — no invented details
- **Concise** — no filler words or unnecessary padding
- **Standard-compliant** — follows the language's established doc format
- **Relevant** — adds value beyond what the type signature already conveys
