---
name: writing-nextjs-vitest-tests
description: Use when writing, adding, or maintaining unit or integration tests for a Next.js project using Vitest; when mocking Next.js runtime modules (next/navigation, next/headers, next/cache), Drizzle ORM query builders, server actions, Zustand stores, or third-party SDKs (AWS S3, Postmark); and when Vitest tests fail to import, crash at module load, or behave flakily under jsdom.
---

# Writing Next.js Vitest Tests

## Overview

Unit and integration tests for Next.js run under Vitest with jsdom and Testing Library. The hard part is never the assertion — it is mocking the module graph (env, DB, auth, Next.js runtime) so the unit under test imports at all.

## When to Use

- Writing tests for server actions, hooks, Zod schemas, Zustand stores, or lib utilities
- Mocking Drizzle queries, better-auth sessions, global fetch, or class-constructor SDKs (S3, Postmark)
- Diagnosing import-time crashes, hoisting errors, or jsdom flakiness in existing tests

**Not for:** end-to-end browser flows (use Playwright) or visual snapshot testing.

## Skill Map

| File | Covers |
|---|---|
| `configuration.md` | Scripts, vitest.config.ts, setup file, jsdom gotchas |
| `mocking-patterns.md` | Hoisting, chainable DB mock, Next.js modules, SDKs, fetch/SSE |
| `testing-layers.md` | What to test per layer: schemas, actions, hooks, stores, utils, coverage |

## The Golden Rules

1. **Mock env, db and auth before the unit under test is imported** — vi.mock hoisting makes this work even written after imports; transitive import-time crashes are the top failure mode. *(Why: env.ts throws, drizzle connects, auth reads cookies — all at import time.)*
2. **Use vi.hoisted for every variable shared between mocks and assertions** — factories run before outer consts exist. *(Why: "cannot access before initialization".)*
3. **Mock any Next.js runtime module the unit's import graph touches: next/navigation, next/headers, next/cache** — they throw outside a request context, unless a higher-level mock (e.g. `@/lib/auth/require-session`) already cuts the graph before those modules load. *(Why: jsdom has no request scope.)*
4. **Model chainable query builders as self-returning mocks and re-link them in beforeEach** — intermediate methods must return the builder; reset wipes those defaults. *(Why: chains break silently on first await.)*
5. **Pick the correct cleanup per test** — clearAllMocks keeps impls, resetAllMocks wipes impls, restoreAllMocks restores spies. *(Why: the wrong one leaks state or wipes needed behaviour.)*
6. **Assert behaviour where possible; for server actions assert the db call args with expect.objectContaining** — the args are the observable contract. *(Why: different queries can return identical shapes.)*
7. **Every non-trivial unit leaves one test that fails if the logic breaks** — a suite that always passes proves nothing. *(Why: that is the point of the file.)*

## Common Mistakes

| Rationalization | Reality |
|---|---|
| "It is just a const, the factory can use it" | The factory is hoisted above the const — wrap it in vi.hoisted |
| "The action never calls next/headers directly" | Transitive imports do; mock every runtime module anyway |
| "It passes locally, env vars are set" | CI lacks env vars — the env mock is the safety net |
| "clearAllMocks is enough cleanup" | Spies stay active; restoreAllMocks for vi.spyOn |
| "The returned row is enough to assert" | Same shape can come from the wrong query — assert args |
| "Happy path plus one error is fine" | 80% branch coverage needs both sides of every guard |

## Red Flags

- Import-time crash on the unit's transitive graph (env, db, auth)
- No vi.mock for env/db/auth although the unit touches them
- Chainable mock returning undefined mid-chain in a failing test
- Tests passing only with real env vars, a live Postgres, or network access
- Assertions on results only, never on call args, for server actions
