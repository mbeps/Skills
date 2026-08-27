# Test Lockstep, Verification, Smoke Checklist

## 1. The vitest mock-export trap (highest-frequency failure)

`vi.mock("ai", () => ({ ... }))` factories replace the module **wholesale**. When the migrated source imports a name the factory omits (e.g. `toUIMessageStream`, `isStepCount`, `embeddingModel`), tests fail at **runtime** — not typecheck:

```
[vitest] No "isStepCount" export is defined on the "ai"
```

Fixes after a rename:

1. Grep tests for old export names after any SDK rename: `stepCountIs`, `textEmbeddingModel`, `system:`, `onFinish` (on mocked `createUIMessageStream` configs), `toUIMessageStream` on the result fixture.
2. A **stale-but-harmless mock key can pass silently** when the evaluated argument never runs (e.g. `stepCountIs` in a mock where `generateText` is also mocked and the arg isn't evaluated). The crash only fires when the missing name is actually accessed. So a passing test is NOT proof the mock is current — grep anyway.
3. `vi.clearAllMocks()` keeps implementations; `vi.resetAllMocks()` wipes them (chainable Drizzle mocks must be re-linked in `beforeEach` after a reset). Pick deliberately.

## 2. Lockstep updates by file

| Test file                                         | What changes                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat-stream.test.ts`                             | Add `toUIMessageStream` to the `vi.mock("ai")` factory; fixture becomes `result: { stream }` (not `{ toUIMessageStream: fn }`); assert `toUIMessageStream` called with `{ stream, sendStart: false }`; call `config.onEnd(...)` not `config.onFinish(...)` (or keep a `onFinish` alias if the app kept it — the app's `createChatStream` now registers `onEnd`). |
| `use-stream-response.test.ts`                     | Mostly survives (transport + `sendMessage` shapes unchanged); add `'error'` to any status union assertions.                                                                                                                                                                                                                                                      |
| `assemble-model-messages.test.ts`                 | Pure function — survives; update if file-part assertions exist (tagged `data`, `mediaType`, no `mimeType`).                                                                                                                                                                                                                                                      |
| `run-steps-*.test.ts` (×N)                        | Mock factory: `stepCountIs` → `isStepCount`. `steps[].toolResults[].result` shape unchanged (defensive read keeps them green).                                                                                                                                                                                                                                   |
| `executor.test.ts` (Model nodes)                  | Update `toHaveBeenCalledWith` assertions: `system:` → `instructions:`. Ensure mocked provider factories (`createAnthropic`, `createGoogleGenerativeAI`, `createOpenAI`, `createOpenRouter`) return callable mock models.                                                                                                                                         |
| `__mocks__/ai.ts`                                 | Ensure `vi.mock('ai')` exports `generateText` / `streamText` and provider mocks match v7 factory signatures.                                                                                                                                                                                                                                                     |
| `embed-documents.test.ts` / `embed-query.test.ts` | Mocked provider: `textEmbeddingModel` → `embeddingModel`.                                                                                                                                                                                                                                                                                                        |

## 3. Verification commands

```bash
node -v                  # >= 22
npm ls ai                # single deduped ai@7.x
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## 4. Manual smoke checklist (ordered by what catches silent regressions)

1. **Multi-step tool loop** (highest value): ask the model to call a tool then answer. Verify (a) exactly one `start` chunk with the server-assigned id (no duplicate — proves `sendStart: false`), (b) the persisted assistant message's text is the final answer, not aggregated text, (c) tool calls/results land in metadata with final-step-only shape.
2. **System-prompt integrity**: a question the system prompt steers — confirms `instructions:` wiring and that no `role:"system"` sneaks in via message assembly.
3. **Reasoning model**: send to a reasoning-capable model; confirm `reasoning` renders (validates the `ReasoningFilePart` normaliser).
4. **Mid-stream abort**: partial content persists; MCP connections clean up (manual abort listener is the sole abort path).
5. **Rate-limit error path**: custom `onError` message surfaces, raw error doesn't leak; `NoOutputGeneratedError` doesn't 500.
6. **RAG**: embed + query; vector dimensions unchanged.
7. **MCP tool call**: works through a non-redirecting endpoint (redirect default `'error'`).
8. **File attachment**: image part in the request body is valid v7 shape (tagged `data`, `mediaType`, no `mimeType`).
9. **Transform/workflow run**: multi-step `generateText` loop with tool results (per-step `toolResults` unchanged).

## 5. Out-of-scope / deferred debt (do not open during the upgrade)

- `@ai-sdk/otel` adoption (only if telemetry is added later — zero-telemetry projects skip it).
- `.nvmrc` pinning (recommended follow-up; the only true gate is local Node ≥ 22).
- `timeout: { tools }` hardening and `toolApproval` policies (new v7 features, not migration).
- Wiki/architecture-doc rewrites — treat code and installed types as truth; fix docs in a separate pass.
