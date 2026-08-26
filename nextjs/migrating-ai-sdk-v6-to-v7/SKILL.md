---
name: migrating-ai-sdk-v6-to-v7
description: Use when upgrading a Next.js (App Router, TypeScript) project from Vercel AI SDK v6 to v7 — bumping ai/@ai-sdk packages to 7.x, applying the system→instructions / onFinish→onEnd / stepCountIs→isStepCount renames, fixing multi-step result aggregation (finalStep), updating useChat transports, or debugging v7 errors like "System messages are not allowed", duplicate start chunks, or "No X export is defined on the ai" vitest mock failures.
---

# Migrating Vercel AI SDK v6 → v7 (Next.js)

## Overview

Upgrade plan for moving a Next.js App Router project from AI SDK v6 to v7 (`ai@7.0.79`+). The renames are mechanical (a codemod exists); the risk is **semantic** — v7 changed multi-step result aggregation and stream behaviour in ways that compile fine but silently corrupt persisted messages if missed. Treat code and installed types as truth; **verify every claim against `node_modules`** because docs and this skill can lag the pin.

## When to Use

Use when:
- Bumping `ai`, `@ai-sdk/react`, `@ai-sdk/mcp`, `@ai-sdk/openai` from 6.x/1.x/2.x/3.x to 7.x.
- Running or reviewing the `npx @ai-sdk/codemod v7` output (it has known bugs).
- Changing `streamText`/`generateText` options (`system`, `onFinish`, `stepCountIs`, `onStepFinish`).
- Wrapping results with `createUIMessageStream` / `toUIMessageStream` / `createUIMessageStreamResponse`.
- Migrating `useChat` + `DefaultChatTransport`, or fixing a `ChatStatus` `'error'` regression.
- Updating vitest mocks that `vi.mock("ai", ...)` — after a rename they fail at runtime with `[vitest] No "X" export is defined on the "ai"`.
- Debugging these v7 symptoms: `InvalidPromptError: System messages are not allowed`, duplicate `start` chunks in the stream, aggregated tool calls landing in the message tree, `NoOutputGeneratedError`.

**When NOT to use:** v5→v6 or v8+ migrations; non-Next.js apps (Svelte/Vue/Node — same SDK facts apply but the file map differs); adding new features during the upgrade (do the upgrade atomically, then features).

## Workflow

1. **Read the reference files** — start with `breaking-changes.md`, then the file matching your surface (`streaming-pipeline.md`, `use-chat-client.md`, `providers-and-rag.md`).
2. **Gate check** (`versions-and-gates.md`): Node ≥ 22, ESM-only, exact pins, `npm ls ai` dedupe.
3. **Bump + install** exact versions; verify one deduped `ai`.
4. **Run the codemod**, then **manually review every diff** (known wrong outputs: `useChat.onFinish` → `onEnd`; malformed `FilePart` with `mimeType`).
5. **Apply the semantics audit** — the aggregation table in `breaking-changes.md` §Result Shape is the highest-risk step.
6. **Update tests in lockstep** (`verification.md` — mock-export trap).
7. **Verify**: typecheck → lint → test → build, then the smoke checklist (`verification.md`); the multi-step tool loop is the one that catches silent `finalStep` regressions.

## Quick Reference

| Topic | File |
|---|---|
| Version pins, Node ≥ 22, ESM-only, dedupe, codemod setup | `versions-and-gates.md` |
| Full rename + behaviour catalogue, result-shape aggregation table | `breaking-changes.md` |
| Server chat route + `chat-stream.ts` (`toUIMessageStream`, `sendStart`, `onEnd`, reasoning, abort) | `streaming-pipeline.md` |
| `useChat` + `DefaultChatTransport`, `ChatStatus`, client part shapes | `use-chat-client.md` |
| Providers, RAG embeddings, MCP, file parts | `providers-and-rag.md` |
| Test lockstep, vitest mock traps, verification + smoke checklist | `verification.md` |
| Canonical doc URLs | `references.md` |

## Red Flags

- "The renames are aliases so I can skip them" — aliases die in v8; the semantics change bites now.
- "`system:` still compiles so it's fine" — compiles in 7.0.79, breaks at v8; `role:"system"` in `messages[]` throws at runtime NOW.
- "The codemod handled it" — it wrongly renames `useChat.onFinish` and emits malformed file parts. Review every diff.
- "`result.text` aggregates across steps, so I must join `steps`" — **wrong**: `text` stays final-step; only `toolCalls`/`toolResults`/`content`/`files`/`sources`/`warnings`/`usage` aggregate. Joining steps changes behaviour.
- "Tests pass, so the migration is done" — a stale `vi.mock` key passes silently when the evaluated argument never runs; the crash fires only when the mocked name is accessed.

