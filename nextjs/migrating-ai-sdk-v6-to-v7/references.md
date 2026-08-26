# References

## Official migration guide (primary source)

- Migrate AI SDK 6.x to 7.0: https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0
- Migrate AI SDK 5.x to 6.0 (for v6 baseline comparison): https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0
- Versioning / deprecation policy: https://ai-sdk.dev/docs/migration-guides/versioning

## API references (v7)

- `streamText`: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- `generateText`: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
- `embed` / `embedMany`: https://ai-sdk.dev/docs/reference/ai-sdk-core/embed · https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many
- `useChat`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- `createUIMessageStream`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream
- Transport: https://ai-sdk.dev/docs/ai-sdk-ui/transport
- MCP tools: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
- Message persistence: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- Reading UI message streams: https://ai-sdk.dev/docs/ai-sdk-ui/reading-ui-message-streams

## v6 docs (for diffing)

- https://ai-sdk.dev/v6/docs/reference/ai-sdk-ui/use-chat
- https://ai-sdk.dev/v6/docs/reference/ai-sdk-core/ui-message

## Release notes

- ai@7.0.0: https://github.com/vercel/ai/releases/tag/ai%407.0.0
- @ai-sdk/react@4.0.0: https://github.com/vercel/ai/releases/tag/%40ai-sdk%2Freact%404.0.0
- @ai-sdk/mcp@2.0.0: https://github.com/vercel/ai/releases/tag/%40ai-sdk%2Fmcp%402.0.0
- All releases: https://github.com/vercel/ai/releases

## Registry / installed-package verification

- https://registry.npmjs.org/ai/latest
- https://unpkg.com/ai@7.0.79/package.json
- Installed dist (authoritative for the pin): `node_modules/ai/dist/index.js` and `index.d.ts`, `node_modules/@ai-sdk/*/dist/index.d.ts`.

## Verification notes (2026-08-26)

- `ai@7.0.79` `dist/index.d.ts` is a re-export barrel that does not render on unpkg/jsdelivr — verify `ai` facts against the installed dist or the GitHub source at the matching tag instead of the barrel.
- Docs/guide inconsistencies observed: top-level `text` aggregation (guide omits `text` from the aggregation list — confirmed final-step in dist), `onEnd` reasoning shape (`Array<ReasoningDetail>` on the event vs parts array on the result), `FilePart.data` (bare URL/bytes in the reference page vs tagged union at the provider layer). **When a doc and the installed dist disagree, the dist wins.**
