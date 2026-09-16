# Canvas Setup & Next.js App Router Integration

## 1. Next.js App Router Boundary

React Flow requires browser DOM APIs (`window`, `ResizeObserver`, pointer events). Any component rendering `<ReactFlow>` or using `@xyflow/react` hooks **must** be a Client Component marked with `"use client"`.

### Recommended Page & Editor Structure

```
app/(dashboard)/(editor)/workflows/[workflowId]/
├── page.tsx            # RSC: Prefetches workflow data via tRPC, renders Suspense boundary
└── loading.tsx         # Skeleton loader for initial SSR transition

features/editor/components/
├── editor.tsx          # Client Component ("use client"): mounts <ReactFlow> canvas
├── editor-header.tsx   # Client Component ("use client"): breadcrumbs, name editor, save button
└── add-node-button.tsx # Panel button opening node selector sheet
```

### RSC Page with Prefetch (`page.tsx`)

```tsx
import { Suspense } from "react";
import { HydrateClient, trpc } from "@/trpc/server";
import { Editor, EditorLoading, EditorError } from "@/features/editor/components/editor";
import { EditorHeader } from "@/features/editor/components/editor-header";
import { ErrorBoundary } from "react-error-boundary";

interface PageProps {
  params: Promise<{ workflowId: string }>;
}

export default async function WorkflowEditorPage({ params }: PageProps) {
  const { workflowId } = await params;

  // Server Component prefetch: populates TanStack Query cache before client render
  trpc.workflows.getOne.prefetch({ id: workflowId });

  return (
    <HydrateClient>
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <EditorHeader workflowId={workflowId} />
        <main className="flex-1 relative">
          <ErrorBoundary fallback={<EditorError />}>
            <Suspense fallback={<EditorLoading />}>
              <Editor workflowId={workflowId} />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </HydrateClient>
  );
}
```

---

## 2. CSS Styles & Tailwind Configuration

### Import Required CSS
Always import the base stylesheet. Missing this import results in invisible handles, broken node positioning, and missing control icons:

```tsx
import "@xyflow/react/dist/style.css";
```

### Dark Mode & Theming Support
Tailwind CSS and CSS variables integrate seamlessly with React Flow's CSS classes. Example selection styles in `app/globals.css`:

```css
/* Custom selection outline on active workflow nodes */
.react-flow__node.selected #base-node {
  @apply ring-3 ring-muted-foreground/25 shadow-lg;
}

/* Optional handle styling overrides */
.react-flow__handle {
  @apply transition-colors;
}
```

---

## 3. Container Sizing (Avoiding 0px Collapse)

React Flow calculates node dimensions and viewport boundaries based on its parent container. **If the parent container does not have an explicit height, the canvas collapses to `0px` height and nothing renders.**

```tsx
// ❌ BAD: No height constraint; parent collapses to 0px
export function BrokenEditor() {
  return (
    <div>
      <ReactFlow nodes={nodes} edges={edges} />
    </div>
  );
}

// ✅ GOOD: Explicit size on wrapper with flex/fixed parent
export function WorkingEditor() {
  return (
    <div className="size-full">
      <ReactFlow nodes={nodes} edges={edges} />
    </div>
  );
}
```

---

## 4. Canvas Configuration & Complete Component

The canonical editor implementation in this project (`features/editor/components/editor.tsx`):

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeType } from "@prisma/client";
import { useSetAtom } from "jotai";

import { nodeComponents } from "@/config/node-components";
import { editorAtom } from "@/features/editor/store/atoms";
import { useSuspenseWorkflow } from "@/features/workflows/hooks/use-workflows";
import { AddNodeButton } from "@/features/editor/components/add-node-button";
import { ExecuteWorkflowButton } from "@/features/editor/components/execute-workflow-button";

export const Editor = ({ workflowId }: { workflowId: string }) => {
  // 1. Read initial data from hydrated TanStack Query cache
  const { data: workflow } = useSuspenseWorkflow(workflowId);

  // 2. Jotai setter to bridge instance to external header Save button
  const setEditor = useSetAtom(editorAtom);

  // 3. Local canvas state for 60fps drag & connect interactions
  const [nodes, setNodes] = useState<Node[]>(workflow.nodes);
  const [edges, setEdges] = useState<Edge[]>(workflow.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  // 4. Conditional UI based on graph contents
  const hasManualTrigger = useMemo(() => {
    return nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
  }, [nodes]);

  return (
    <div className="size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeComponents} // Statically defined outside component
        onInit={setEditor}         // Store instance in Jotai atom
        fitView
        snapToGrid
        snapGrid={[10, 10]}
        panOnScroll
        panOnDrag={false}          // False enables box selection instead of pan
        selectionOnDrag            // Box selection via mouse drag
      >
        <Background gap={12} size={1} />
        <Controls />
        <MiniMap />
        
        <Panel position="top-right">
          <AddNodeButton />
        </Panel>

        {hasManualTrigger && (
          <Panel position="bottom-center">
            <ExecuteWorkflowButton workflowId={workflowId} />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};
```

---

## 5. Overlay Subcomponents & Panels

- **`<Background />`**: Renders grid pattern behind canvas. Supports `variant="dots" | "lines" | "cross"`, `gap={number}`, `size={number}`, and `color`.
- **`<Controls />`**: Renders zoom in, zoom out, fit view, and viewport lock controls. Supports custom children buttons.
- **`<MiniMap />`**: Renders an interactive miniature map overview in the corner. Customizable via `nodeColor`, `nodeStrokeColor`, and `maskColor`.
- **`<Panel />`**: Renders HTML/React elements pinned to specific viewport quadrants (`top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`). Ideal for headers, action bars, search dialogs, and status badges without cluttering the canvas coordinate space.

