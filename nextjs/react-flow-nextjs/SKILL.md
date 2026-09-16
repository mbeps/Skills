---
name: react-flow-nextjs
description: Use when building, modifying, or debugging React Flow (@xyflow/react v12) in a Next.js App Router TypeScript app — canvas setup, custom nodes, handles, toolbars, Jotai instance bridge, 3-tier state, persistence with tRPC/Prisma, or realtime execution indicators.
---

# React Flow v12 × Next.js App Router

Interactive node-based workflow editor built with `@xyflow/react` v12, React 19, and Next.js App Router — managing local canvas state, bridging instances via Jotai, persisting graphs via tRPC/Prisma, and visualizing durable execution in real time.

## When to Use

- Building or modifying interactive workflow/DAG editors on Next.js App Router.
- Creating custom execution or trigger nodes with handles, status indicators, and toolbars.
- Handling canvas state across detached UI trees (e.g. Save button in header calling `getNodes()` / `getEdges()`).
- Storing and hydrating React Flow nodes and edges in PostgreSQL via Prisma and tRPC.
- Adding real-time visual feedback (spinners, glowing borders) to executing canvas nodes.
- Migrating older `reactflow` (v11) components to `@xyflow/react` (v12).

## When NOT to Use

- Static diagrams or read-only charts (use standard SVG/Mermaid/Recharts instead).
- Legacy Pages Router setups using outdated `reactflow` v11 imports without modern App Router patterns.
- Standalone canvas apps without server persistence or state synchronization needs.

## Architecture

| File / Module | Role |
|---|---|
| `features/editor/components/editor.tsx` | Main `"use client"` canvas mounting `<ReactFlow>`, registering `nodeTypes`, binding event handlers |
| `config/node-components.ts` | Static registry mapping `NodeType` enum values to custom node components |
| `features/editor/store/atoms.ts` | Jotai `editorAtom` bridging `ReactFlowInstance` to external toolbars/headers |
| `features/editor/components/editor-header.tsx` | Header reading `editorAtom` to trigger tRPC `workflows.update` persistence |
| `features/executions/components/base-execution-node.tsx` | Standard wrapper for action/model nodes (left target + right source handles) |
| `features/triggers/components/base-trigger-node.tsx` | Standard wrapper for trigger nodes (right source handle only) |
| `components/react-flow/base-handle.tsx` | Styled `<Handle>` component with connection point consistency |
| `components/react-flow/base-node.tsx` | Container layout primitives (`BaseNode`, `BaseNodeHeader`, `BaseNodeContent`, `BaseNodeFooter`) |
| `components/react-flow/node-status-indicator.tsx` | Conic-gradient spinning border or overlay loader for active execution status |
| `components/node-selector.tsx` | Sheet/dialog palette converting screen clicks into canvas coordinates via `screenToFlowPosition` |
| `features/workflows/server/routers.ts` | tRPC router handling graph transformation between Prisma models and React Flow `Node[]`/`Edge[]` |

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — React useState (local canvas state)               │
│  nodes: Node[]   edges: Edge[]                              │
│  Lives in editor.tsx; drives live canvas drag/connect       │
├─────────────────────────────────────────────────────────────┤
│ Layer 2 — Jotai editorAtom (ReactFlowInstance bridge)       │
│  atom<ReactFlowInstance | null>                             │
│  Set in onInit; read by EditorSaveButton outside canvas tree│
├─────────────────────────────────────────────────────────────┤
│ Layer 3 — TanStack Query + tRPC (server state cache)        │
│  useSuspenseWorkflow(id)  → reads hydrated cache from RSC   │
│  useUpdateWorkflow()      → persists full graph to DB       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Reference

| Topic | Reference Document |
|---|---|
| Canvas setup, styling, sizing, controls, App Router `"use client"` | [`setup.md`](./setup.md) |
| Custom nodes, handles, toolbars, `nodrag`, node palette | [`custom-nodes.md`](./custom-nodes.md) |
| 3-tier state, Jotai instance bridge, Prisma/tRPC persistence | [`state-and-persistence.md`](./state-and-persistence.md) |
| Real-time execution status badges, glowing borders, DAG ordering | [`realtime-and-execution.md`](./realtime-and-execution.md) |
| v11 vs v12 changes, TypeScript types, keyboard shortcuts, docs | [`references.md`](./references.md) |

## Core Conventions

1. **`nodeTypes` MUST be defined outside the component** (or memoized). Defining `nodeTypes` inline causes React Flow to remount the entire canvas on every render.
2. **Explicit CSS import**: Always import `@xyflow/react/dist/style.css` in the editor component or root layout.
3. **Container dimensions**: The wrapping `<div>` of `<ReactFlow>` must have explicit width and height (e.g. `size-full` with a constrained parent). If height is 0, the canvas renders blank.
4. **Use Jotai for cross-tree instance access**: Capture `ReactFlowInstance` via `onInit={setEditor}` into a Jotai atom. Avoid complex Context providers when only a save button or external control needs the instance.
5. **Use `screenToFlowPosition` instead of deprecated `project`**: When adding nodes from external UI (palettes/sheets), calculate canvas coordinates using `screenToFlowPosition({ x, y })`.
6. **Add `nodrag` to interactive elements inside custom nodes**: Inputs, dropdowns, buttons, and textareas inside custom nodes must have className `nodrag` (and `nopan` if needed) to avoid triggering node dragging.
7. **Always provide unique `id` to multiple `<Handle />` components**: When a node has more than one source or target handle, each must have an explicit `id` (e.g. `id="source-1"`).
8. **Topological sorting for DAG execution**: Canvas edges dictate execution order. Persist connections with `fromNodeId` and `toNodeId`, and validate cycle freedom using `toposort` before running.

## Common Mistakes

| Mistake | Consequence | Correct Pattern |
|---|---|---|
| Defining `nodeTypes` inline inside component body | Entire canvas resets/remounts on every render; input focus lost | Move `nodeTypes` to external module (`config/node-components.ts`) or wrap in `useMemo` |
| Parent container has no defined height | Canvas has 0px height and appears completely blank | Wrap `<ReactFlow>` in `<div className="size-full">` inside a flex/fixed height container |
| Omitting `@xyflow/react/dist/style.css` | Nodes stack in top-left corner, handles misaligned, controls invisible | `import "@xyflow/react/dist/style.css";` |
| Using deprecated `instance.project()` (v11) | TypeScript error or runtime failure in `@xyflow/react` v12 | Use `instance.screenToFlowPosition({ x, y })` |
| Direct mutation of `nodes` or `edges` state | Broken undo/redo, skipped change detection, re-render glitches | Use `applyNodeChanges` and `applyEdgeChanges` callbacks |
| Missing `nodrag` on forms/inputs inside nodes | Clicking or typing in an input drags the entire node across canvas | Add `className="nodrag"` to inputs, textareas, and sliders |
| Forgetting handle `id` when multiple handles exist | Connections snap unpredictably to the first handle found | Provide explicit `id="source-1"`, `id="source-2"` on each handle |
| Calling hooks like `useReactFlow()` outside `<ReactFlow>` without provider | Throws error: "useReactFlow must be used within a ReactFlowProvider" | Use Jotai `editorAtom` bridge or wrap ancestor in `<ReactFlowProvider>` |

