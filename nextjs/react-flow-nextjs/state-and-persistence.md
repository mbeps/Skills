# State Management & Persistence

## 1. The Three-Layer State Architecture

Visual workflow editors require managing both ultra-fast interactive drag state (60fps) and robust database synchronization. Combining these into a single state layer leads to severe lag or desynchronization.

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — React useState (local canvas state)               │
│  nodes: Node[]   edges: Edge[]                              │
│  Lives in editor.tsx; handles high-frequency drag/pan       │
├─────────────────────────────────────────────────────────────┤
│ Layer 2 — Jotai editorAtom (ReactFlowInstance bridge)       │
│  atom<ReactFlowInstance | null>(null)                       │
│  Captured in onInit; accessed by detached Save button       │
├─────────────────────────────────────────────────────────────┤
│ Layer 3 — TanStack Query + tRPC (server state cache)        │
│  Prefetched on server; persisted via Prisma transactions    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1: React Local State & Handlers

In `editor.tsx`, maintain nodes and edges using standard React state initialized from the hydrated server query:

```tsx
const [nodes, setNodes] = useState<Node[]>(workflow.nodes);
const [edges, setEdges] = useState<Edge[]>(workflow.edges);

// High-performance change applicators from @xyflow/react
const onNodesChange = useCallback(
  (changes: NodeChange[]) =>
    setNodes((current) => applyNodeChanges(changes, current)),
  [],
);

const onEdgesChange = useCallback(
  (changes: EdgeChange[]) =>
    setEdges((current) => applyEdgeChanges(changes, current)),
  [],
);

const onConnect = useCallback(
  (params: Connection) =>
    setEdges((current) => addEdge(params, current)),
  [],
);
```

---

## 3. Layer 2: Jotai `editorAtom` Instance Bridge

### The Problem
The Save button lives in `EditorHeader` (at the top of the viewport), while `<ReactFlow>` lives in `Editor` (inside the main viewport). Wrapping the entire page in `<ReactFlowProvider>` creates unnecessary re-render coupling between the canvas and header.

### The Solution
Use a minimal Jotai atom (`features/editor/store/atoms.ts`) to store the `ReactFlowInstance`:

```ts
// features/editor/store/atoms.ts
import type { ReactFlowInstance } from "@xyflow/react";
import { atom } from "jotai";

export const editorAtom = atom<ReactFlowInstance | null>(null);
```

### Canvas Populates Atom
In `features/editor/components/editor.tsx`:
```tsx
const setEditor = useSetAtom(editorAtom);

return (
  <ReactFlow
    nodes={nodes}
    edges={edges}
    onInit={setEditor} // Stores instance when canvas initializes
    ...
  />
);
```

### Detached Save Button Reads Atom
In `features/editor/components/editor-header.tsx`:
```tsx
import { useAtomValue } from "jotai";
import { editorAtom } from "@/features/editor/store/atoms";
import { useUpdateWorkflow } from "@/features/workflows/hooks/use-workflows";

export const EditorSaveButton = ({ workflowId }: { workflowId: string }) => {
  const editor = useAtomValue(editorAtom);
  const saveWorkflow = useUpdateWorkflow();

  const handleSave = () => {
    if (!editor) return;

    // Get latest canvas nodes and edges directly from instance
    const nodes = editor.getNodes();
    const edges = editor.getEdges();

    saveWorkflow.mutate({
      id: workflowId,
      nodes,
      edges,
    });
  };

  return (
    <Button onClick={handleSave} disabled={saveWorkflow.isPending}>
      Save
    </Button>
  );
};
```

---

## 4. Updating Node Configuration in Place

When configuring nodes via modal dialogs (`node.data`), update node state locally in the canvas without hitting the server:

```tsx
// Inside GeminiNode component
const handleSubmit = (values: GeminiFormValues) => {
  setNodes((nodes) =>
    nodes.map((node) => {
      if (node.id === props.id) {
        return {
          ...node,
          data: {
            ...node.data,
            ...values,
          },
        };
      }
      return node;
    }),
  );
};
```
The node re-renders with new settings, but changes are only persisted to the database when the user clicks **Save**.

---

## 5. Layer 3: Prisma & tRPC Graph Persistence

### Database Schema (Prisma)
Workflows persist nodes and connections in relational tables:

```prisma
model Workflow {
  id          String       @id @default(cuid())
  name        String
  userId      String
  nodes       Node[]
  connections Connection[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Node {
  id         String   @id
  workflowId String
  type       NodeType
  position   Json     // { x: number, y: number }
  data       Json     // Node-specific configuration
  workflow   Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
}

model Connection {
  id         String   @id @default(cuid())
  workflowId String
  fromNodeId String
  toNodeId   String
  fromOutput String   // sourceHandle (e.g. "source-1")
  toInput    String   // targetHandle (e.g. "target-1")
  workflow   Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
}
```

### Server Transformation: Prisma ↔ React Flow

In `features/workflows/server/routers.ts`:

#### Fetch Transformation (`getOne` Query)
Transforms relational database rows into React Flow `Node[]` and `Edge[]`:
```ts
getOne: protectedProcedure.input(workflowIdSchema).query(async ({ ctx, input }) => {
  const workflow = await prisma.workflow.findUniqueOrThrow({
    where: { id: input.id, userId: ctx.auth.user.id },
    include: { nodes: true, connections: true },
  });

  const nodes: Node[] = workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position as { x: number; y: number },
    data: (node.data as Record<string, unknown>) || {},
  }));

  const edges: Edge[] = workflow.connections.map((connection) => ({
    id: connection.id,
    source: connection.fromNodeId,
    target: connection.toNodeId,
    sourceHandle: connection.fromOutput,
    targetHandle: connection.toInput,
  }));

  return { id: workflow.id, name: workflow.name, nodes, edges };
});
```

#### Save Mutation (`update` Transaction)
Uses a clean **full-replacement transaction** (delete all existing nodes/connections and reinsert current canvas state). This eliminates stale connection cleanup edge cases:

```ts
update: protectedProcedure.input(workflowUpdateSchema).mutation(async ({ ctx, input }) => {
  const { id, nodes, edges } = input;

  return prisma.$transaction(async (tx) => {
    // 1. Verify ownership
    await tx.workflow.findUniqueOrThrow({
      where: { id, userId: ctx.auth.user.id },
    });

    // 2. Clear old canvas state
    await tx.connection.deleteMany({ where: { workflowId: id } });
    await tx.node.deleteMany({ where: { workflowId: id } });

    // 3. Batch insert new nodes
    await tx.node.createMany({
      data: nodes.map((node) => ({
        id: node.id,
        workflowId: id,
        type: node.type as NodeType,
        position: node.position,
        data: node.data || {},
      })),
    });

    // 4. Batch insert new connections
    await tx.connection.createMany({
      data: edges.map((edge) => ({
        workflowId: id,
        fromNodeId: edge.source,
        toNodeId: edge.target,
        fromOutput: edge.sourceHandle || "main",
        toInput: edge.targetHandle || "main",
      })),
    });

    // 5. Update timestamp
    return tx.workflow.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  });
});
```

