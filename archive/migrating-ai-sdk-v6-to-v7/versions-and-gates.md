# Versions, Hard Gates, Dedupe, Codemod

Verified 2026-08-26 against npm registry + installed `ai@7.0.79` dist. **Before relying on any version here, check `npm view <pkg> version` and the installed `node_modules/<pkg>/package.json`** — patch versions move.

## Exact pins (as of 2026-08-26)

| Package                       | v6 (typical) | v7 target (exact) |
| ----------------------------- | ------------ | ----------------- |
| `ai`                          | `^6.0.168`   | `7.0.79`          |
| `@ai-sdk/react`               | `^2.0.247`   | `4.0.82`          |
| `@ai-sdk/mcp`                 | `^1.0.36`    | `2.0.37`          |
| `@ai-sdk/openai`              | `^3.0.53`    | `4.0.47`          |
| `@ai-sdk/anthropic`           | `^3.0.77`    | `4.0.42`          |
| `@ai-sdk/google`              | `^3.0.73`    | `4.0.51`          |
| `@openrouter/ai-sdk-provider` | `^2.9.0`     | `3.0.0`           |

Use **exact** pins (no `^`). `@ai-sdk/react` and `@openrouter/ai-sdk-provider` declare `ai@7.0.79` as a **regular dependency** (not peer), so a mismatched direct `ai` produces multiple copies in `node_modules` and duplicated type identity at the `useChat`/transport/model boundary — the recurring strict-typing break. Matching the exact version lets npm dedupe to one copy.

## Hard gates (no-go if unmet)

- **Node ≥ 22** — all AI SDK packages declare `engines: { "node": ">=22" }`. CI typically runs 24.x; check local (`node -v`). Add `"engines": { "node": ">=22" }` to the app's `package.json` if you enforce it.
- **ESM-only** — `"type": "module"` in all AI SDK packages; `require('ai')` throws. App code is fine under Next.js 16 bundling; only direct-`node` scripts (vitest, drizzle-kit, custom scripts) need Node ≥ 22.
- **React 19.2.x** satisfies `@ai-sdk/react` peer range; **Zod 4** satisfies `ai` peer (`^3.25.76 || ^4.1.8`).

## Dependency bump + dedupe

```bash
npm install --save-exact ai@7.0.79 @ai-sdk/react@4.0.82 @ai-sdk/mcp@2.0.37 @ai-sdk/openai@4.0.47 @ai-sdk/anthropic@4.0.42 @ai-sdk/google@4.0.51 @openrouter/ai-sdk-provider@3.0.0
npm ls ai   # must show ONE ai@7.0.79, deduped
```

## Codemod setup and pitfalls

```bash
# The codemod shells out to jscodeshift — it must be on PATH:
npm install --no-save jscodeshift
export PATH="$PWD/node_modules/.bin:$PATH"
npx @ai-sdk/codemod v7 app lib hooks __tests__   # scope to your source dirs
```

### Known codemod bugs — review EVERY diff

1. **`useChat.onFinish` wrongly renamed to `onEnd`.** The codemod renames all `onFinish` → `onEnd`, but `ChatInit` (the `useChat` options) still uses `onFinish` with the identical v6→v7 `ChatOnFinishCallback`. Revert that rename. `onEnd` is correct only for `streamText`/`generateText` (and `createUIMessageStream`).
2. **Malformed `FilePart`.** The `replace-image-message-part-with-file` transform emits `{ type: 'file', data: url, mimeType, mediaType }` — v7 file parts have **no `mimeType`** field and `data` is a tagged union. Correct shape: `{ type: 'file', data: { type: 'url', url }, mediaType }` (see `providers-and-rag.md` §File parts).

After the codemod, **grep tests for stale export names**: `stepCountIs`, `textEmbeddingModel`, `system:` (see `verification.md`).
