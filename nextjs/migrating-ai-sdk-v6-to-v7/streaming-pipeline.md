# Server Chat Route + UI Message Stream (`chat-stream.ts`)

The typical AI SDK v7 chat pipeline: `route.ts` builds `streamText(...)`, passes the result to `createChatStream`, which wraps it in a UI message stream response. This is the highest-risk file in the upgrade — four things change here.

## 1. Route: `streamText` options

```ts
// v6
const result = streamText({
  model,
  system: buildSystemPrompt(...),        // → instructions:
  messages: finalMessages,                // must NOT contain { role: "system" }
  tools,
  stopWhen: stepCountIs(env.MAX_STEPS),   // → isStepCount
  abortSignal: req.signal,
  onAbort: ({ steps }) => { /* keep */ }, // still exists in v7
  onFinish: (finish) => { ... },          // → onEnd (event shape below)
});
```

```ts
// v7
const result = streamText({
  model,
  instructions: buildSystemPrompt(...),
  messages: finalMessages,
  tools,
  stopWhen: isStepCount(env.MAX_STEPS),
  abortSignal: req.signal,
  onAbort: ({ steps }) => { /* unchanged */ },
  onEnd: (event) => {
    // event.text / event.reasoning: final step only
    // event.toolCalls / event.toolResults / event.usage: ALL steps
    // event.finalStep: synchronous final-step StepResult — use it for
    //                  v6 final-step-only tool calls in the message tree:
    const reasoning = normaliseReasoning(event.reasoning); // keep the cast — see §4
    finishRef.current = {
      text: event.text,
      reasoning,
      toolCalls: event.finalStep.toolCalls as unknown[],     // ← not event.toolCalls
      toolResults: event.finalStep.toolResults as unknown[], // ← not event.toolResults
      finishReason: event.finishReason,
    };
  },
});
```

If persistence falls back to reading the result object (not the event), use **`await result.finalStep`** and read `finalStep.toolCalls`/`toolResults` there too.

## 2. `createChatStream`: stateless `toUIMessageStream`

```ts
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,          // top-level stateless helper (v7)
  type StreamTextResult,
} from "ai";

interface Options {
  result: StreamTextResult<any, any, any>; // 3 generics in v7
  // ...
}

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    writer.write({ type: "start", messageId: assistantMessageId } as any); // app's own start chunk
    writer.merge(
      // v6: result.toUIMessageStream()  →  v7 stateless:
      toUIMessageStream({ stream: result.stream, sendStart: false }),
    );
  },
  onError: (error) => { /* keep sanitisation — see NoOutputGeneratedError */ },
  onEnd: async () => { /* renamed from onFinish; persist + cleanup exactly once */ },
});
return createUIMessageStreamResponse({ stream });
```

**`sendStart: false` is mandatory** when the app writes its own `{ type: "start", messageId }` chunk. `toUIMessageStream` defaults `sendStart: true` and would emit a **second** start chunk with a generated message id — silent protocol corruption. Verified at runtime: the stream must start with exactly one `start` chunk carrying the server-assigned id.

`createUIMessageStream` still has **no `abortSignal` option** — keep the manual `abortSignal.addEventListener("abort", ...)` wiring (persist partial content + MCP cleanup). That is the only abort path; client aborts don't reliably fire `onEnd`.

## 3. `persistResultIn` fallback path

The fallback that awaits the result when `finishRef` isn't populated yet must also switch to `finalStep`:

```ts
// v7 — finalStep is PromiseLike on the streamText result
const finalStep = await Promise.resolve(result.finalStep).catch(() => undefined);
finish = {
  text: finalStep?.text,
  reasoning: reasoningToString(finalStep?.reasoning),   // keep normaliser
  toolCalls: (finalStep?.toolCalls as unknown[]) ?? [], // final-step only
  toolResults: (finalStep?.toolResults as unknown[]) ?? [],
};
```

## 4. Reasoning normaliser (keep, don't simplify)

```ts
function reasoningToString(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw))
    return raw.map((p) => (p as any).text ?? "").join(""); // ReasoningFilePart has NO .text
  return "";
}
```

`ReasoningFilePart` (`{ type: 'reasoning-file', data, mediaType }`) has no `.text`; naive `p.text` on the union fails strict typecheck. The cast is required.

## 5. `run-steps.ts`-style agentic loops

- Move the system prompt out of `messages` into `instructions:` — the `{ role: "system" }` entry throws in v7.
- `stepCountIs` → `isStepCount`.
- `steps[].toolCalls` / `steps[].toolResults` are **per-step and unchanged** — iteration over `result.steps` needs no change.
- Keep the defensive tool-result read `(tr as any).result ?? (tr as any).output`.
- `result.text` is final-step (v6 was too) — **do not "fix" it by joining `steps.map(s => s.text)`**; that changes behaviour. Only change reads of `toolCalls`/`toolResults`/`content`/`files`/`sources`/`warnings`/`usage` that intended final-step-only.
