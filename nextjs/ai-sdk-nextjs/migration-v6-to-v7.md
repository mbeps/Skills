# v6 → v7 migration

This file summarises the renames. For the full migration guide, cross-reference the existing **`migrating-ai-sdk-v6-to-v7`** skill — do not duplicate it here.

## Rename table (confirmed)

| v6                                                  | v7                                           |
| --------------------------------------------------- | -------------------------------------------- |
| `system`                                            | `instructions` (deprecated alias kept)       |
| `maxTokens`                                         | `maxOutputTokens`                            |
| `onFinish` (server)                                 | `onEnd` (deprecated alias kept)              |
| `onStepFinish`                                      | `onStepEnd` (alias kept)                     |
| `stepCountIs`                                       | `isStepCount`                                |
| `experimental_onStart` / `experimental_onStepStart` | `onStart` / `onStepStart`                    |
| `experimental_telemetry`                            | `telemetry` (alias kept)                     |
| `experimental_providerOptions`                      | `providerOptions` (old gone, no alias)       |
| `experimental_repairToolCall`                       | `repairToolCall`                             |
| `experimental_include`                              | `include`                                    |
| tool `parameters`                                   | `inputSchema` (old gone)                     |
| `maxSteps`                                          | **removed** → `stopWhen` + `isStepCount`     |
| `experimental_transform`                            | still `experimental_transform` (not renamed) |

## Key gotchas

- **Client `onFinish` stays `onFinish`.** Only the server `streamText`/`generateText` renamed it to `onEnd`. The client handler receives `{ message, isAbort, isError }`. Do not rename the client `onFinish`.
- **`toDataStreamResponse` is removed.** The v7 protocol is the UI Message Stream — use `createUIMessageStreamResponse` + `toUIMessageStream`. See streaming.md.
- **`maxSteps` is removed.** Use `stopWhen` + `isStepCount` (defaults: `streamText` 1, `generateText` 20).
- `initialMessages` → `messages`; `append` → `sendMessage`; `reload` → `regenerate`; `addToolResult` → `addToolOutput`.
- `streamProtocol` option is gone; `maxSteps` auto-resubmission is replaced by `sendAutomaticallyWhen`/`onFinish`.
- There is no `streaming:` boolean — use `streamText` vs `generateText`.
