# Generative UI (`@json-render`) in Next.js + AI SDK

Render safe, interactive, Shadcn-styled UI widgets and charts **without `<iframe>`s** inline alongside Markdown in chat and inside side-panel Canvas artifacts.

---

## 1. Architecture & Isolation

- **Adapter Boundary:** Isolate `@json-render/core` and `@json-render/react` behind a dedicated adapter module (`catalog`, `parse-spec`, `markdown-ui-utils`, `registry`, `DynamicUIBlock`). Do not leak `@json-render` imports across unrelated app components.
- **Local Primitives Over `@json-render/shadcn`:** Wire `defineCatalog(schema, { components, actions })` and `defineRegistry(...)` directly to your existing local Shadcn UI primitives (`Card`, `Badge`, `Tabs`, `Accordion`, `Input`, `Select`, `Switch`, `Checkbox`, `Slider`, `Button`, `Table`) and Recharts (`ChartContainer`).
- **Keep Overlay/Shell Primitives Out:** Omit `Sidebar`, `Drawer`, `Dialog`, `Toast`, `Sheet`, and similar layout-shell primitives from the catalog; they conflict with host app shells and modal stacks.
- **Recharts v3 Zero-Height Guard:** Always apply `min-h-[240px] w-full` on `ChartContainer` and guard `Array.isArray(data) && data.length > 0 && series.length > 0` with an empty-state placeholder.
- **Non-Tool-Calling Model Support:** Inject `getInteractiveUiSystemPrompt()` (memoized `catalog.prompt({ mode: "inline", customRules })`) into the system prompt whenever the UI capability is enabled—independent of whether the model supports function/tool calling.

---

## 2. Dual-Mode Delivery (Inline Chat + Canvas)

1. **Inline Chat (` ```spec ` / ` ```ui ` fences):**
   - Dynamically import `DynamicUIBlock` with `ssr: false` inside your Markdown `pre` renderer.
   - Track top-level fence spans (ignoring nested fences inside ```` ````markdown ````) so **only** a trailing unclosed `spec`/`ui` fence renders a `<DynamicUISkeleton />` during streaming; earlier closed fences render live immediately.
   - Wrap `DynamicUIBlock` in an `ErrorBoundary` (`DynamicUIErrorBoundary`) and fall back to a destructive `Alert` + raw `CodeBlock` on parse or runtime errors.
   - On Copy, replace top-level `spec`/`ui` blocks with `[Interactive UI omitted]` and notify via toast.
2. **Canvas / Artifact Panel:**
   - Support `type: "ui"` artifacts rendered via `DynamicUIBlock` (exported as `.ui.json`).
   - For `type: "markdown"` artifacts containing `spec`/`ui` fences, provide a **Preview / Edit** toggle defaulting to **Preview** (`MarkdownRenderer`) while keeping raw Markdown editable in the rich-text editor.

---

## 3. Prompt Hardening & Tolerant Spec Normalization

Fast/smaller LLMs frequently emit four structural quirks in JSONL RFC 6902 patches. Pair strict `customRules` in `catalog.prompt()` with a deterministic normalizer before graph validation:

1. **Element Field Placement:**
   - `@json-render/core`'s `autoFixSpec(spec, { lossy: false })` only relocates `visible`, `on`, `repeat`, and `watch` out of `props`.
   - Also relocate `children` / `slots` out of `props` to element top level, and move stray top-level component props (e.g. `direction`, `gap`) into `props` without overwriting explicit `props` keys.
2. **Conditional `$cond` Normalization:**
   - `@json-render/core`'s `isCondExpression` strictly requires `"$cond" in v && "$then" in v && "$else" in v`.
   - Models often emit `then`/`else` either as siblings of `$cond` or nested **inside** `$cond` (`{ "$cond": { "$state": "/x", "eq": 0, "then": "A", "else": "B" } }`). Without normalization, `resolvePropValue` passes the raw object to React components (e.g. `<Badge>`), throwing `Objects are not valid as a React child`.
   - Recursively normalize both sibling and nested `then`/`else` into `{ $cond, $then, $else }` (with a recursion depth cap such as `32`).
3. **Unique Connected Root Recovery:**
   - When `!(spec.root in spec.elements)` and `elements` has `> 1` entries, if **exactly one** unreferenced element reaches every node in the element graph, rebind `spec.root` to that unique container. Keep single-element or ambiguous missing-root specs failing with `Missing root element "<root>"`.
4. **Graph Safety Bounds:**
   - Enforce `MAX_UI_ELEMENTS` (e.g. `150`), `MAX_EXPANDED_UI_NODES` (e.g. `1000` for diamond DAGs), string-only `children`/`slots` references, and DFS cycle detection.

---

## 4. State, Actions & Context Budgeting

- **Local State & Actions:** Wrap `<Renderer />` in `<StateProvider initialState={spec.state ?? {}}>`, `<VisibilityProvider>`, and `<ActionProvider handlers={{ sendChatMessage }}>`.
- **Disable Chat Actions Safely:** Disable `Button` when it dispatches `sendChatMessage` (including chained `onSuccess`/`onError`) while streaming or outside the chat provider, while keeping local `setState` buttons enabled.
- **Context Token Budget:** Account for `getInteractiveUiSystemPrompt()` tokens in `systemInstructions` (not `toolDefinitions`) when Interactive UI is enabled.
