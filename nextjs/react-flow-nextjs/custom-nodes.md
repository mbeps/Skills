# Custom Nodes, Handles & Palettes

## 1. Defining & Registering `nodeTypes`

In `@xyflow/react` v12, custom nodes are registered via the `nodeTypes` prop. **You must define this object outside of the React component.** If declared inside a component without `useMemo`, React Flow remounts all nodes on every render, resetting internal state and dropping focus.

```ts
// config/node-components.ts
import { NodeType } from "@prisma/client";
import type { NodeTypes } from "@xyflow/react";

import { InitialNode } from "@/components/initial-node";
import { GeminiNode } from "@/features/executions/components/gemini/node";
import { AnthropicNode } from "@/features/executions/components/anthropic/node";
import { HttpRequestNode } from "@/features/executions/components/http-request/node";
import { ManualTriggerNode } from "@/features/triggers/components/manual-trigger/node";
// ... other node components

export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.GEMINI]: GeminiNode,
  [NodeType.ANTHROPIC]: AnthropicNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
} as const satisfies NodeTypes;
```

---

## 2. Base Node Layout Primitives

Structure custom nodes using reusable UI primitives (`components/react-flow/base-node.tsx`) styled with Tailwind CSS:

```tsx
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Base card container with focus outline and hover states
export const BaseNode = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      id="base-node"
      tabIndex={0}
      className={cn(
        "relative rounded-sm border border-muted-foreground bg-card text-card-foreground hover:bg-accent",
        className,
      )}
      {...props}
    />
  ),
);
BaseNode.displayName = "BaseNode";

// Standard content container inside the node
export const BaseNodeContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="base-node-content"
      className={cn("flex flex-col gap-y-2 p-3", className)}
      {...props}
    />
  ),
);
BaseNodeContent.displayName = "BaseNodeContent";
```

---

## 3. Handle Implementation & Best Practices

Handles (`<Handle />`) define connection anchors on a node:
- **`type="target"`**: Inbound connection (usually `Position.Left`).
- **`type="source"`**: Outbound connection (usually `Position.Right`).

### BaseHandle Component (`components/react-flow/base-handle.tsx`)

```tsx
import { Handle, type HandleProps } from "@xyflow/react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const BaseHandle = forwardRef<HTMLDivElement, HandleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Handle
        ref={ref}
        className={cn(
          "h-[11px] w-[11px] rounded-full border border-slate-300 bg-slate-100 transition dark:border-secondary dark:bg-secondary",
          className,
        )}
        {...props}
      >
        {children}
      </Handle>
    );
  },
);
BaseHandle.displayName = "BaseHandle";
```

### Critical Rule for Multiple Handles
If a node contains more than one `source` or `target` handle, you **MUST** provide an explicit, unique `id` prop on each handle:

```tsx
// ✅ GOOD: Explicit IDs for deterministic edge connections
<BaseHandle id="target-1" type="target" position={Position.Left} />
<BaseHandle id="source-1" type="source" position={Position.Right} />
```

---

## 4. Reusable Node Templates: Execution vs. Trigger

### Execution Node (`features/executions/components/base-execution-node.tsx`)
Action nodes (AI, HTTP, Messaging) accept an inbound connection and produce an outbound connection:

```tsx
import { memo } from "react";
import { Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { WorkflowNode } from "@/components/workflow-node";

export const BaseExecutionNode = memo(({
  id,
  name,
  icon: Icon,
  description,
  children,
  onSettings,
}: BaseExecutionNodeProps) => {
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = () => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <WorkflowNode name={name} description={description} onDelete={handleDelete} onSettings={onSettings}>
      <BaseNode>
        <BaseNodeContent>
          <Icon className="size-4 text-muted-foreground" />
          {children}
          {/* Target handle on Left */}
          <BaseHandle id="target-1" type="target" position={Position.Left} />
          {/* Source handle on Right */}
          <BaseHandle id="source-1" type="source" position={Position.Right} />
        </BaseNodeContent>
      </BaseNode>
    </WorkflowNode>
  );
});
```

### Trigger Node (`features/triggers/components/base-trigger-node.tsx`)
Trigger nodes (Manual, Stripe, Google Forms) initiate workflows and only have an outbound `source` handle on the right (no target handle):

```tsx
export const BaseTriggerNode = memo(({ id, name, icon: Icon, description }: BaseTriggerProps) => {
  return (
    <WorkflowNode name={name} description={description} ...>
      <BaseNode className="rounded-l-2xl">
        <BaseNodeContent>
          <Icon className="size-4" />
          {/* Only source handle */}
          <BaseHandle id="source-1" type="source" position={Position.Right} />
        </BaseNodeContent>
      </BaseNode>
    </WorkflowNode>
  );
});
```

---

## 5. Node Toolbars & Labels (`<NodeToolbar />`)

`NodeToolbar` attaches contextual action buttons or labels directly to the node without polluting node inner layout:

```tsx
// components/workflow-node.tsx
import { NodeToolbar, Position } from "@xyflow/react";
import { SettingsIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkflowNode({ children, showToolbar = true, onDelete, onSettings, name, description }) {
  return (
    <>
      {/* Action toolbar shown on node selection/hover */}
      {showToolbar && (
        <NodeToolbar>
          <Button size="sm" variant="ghost" onClick={onSettings}>
            <SettingsIcon className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <TrashIcon className="size-4" />
          </Button>
        </NodeToolbar>
      )}

      {children}

      {/* Persistent label below the node */}
      {name && (
        <NodeToolbar position={Position.Bottom} isVisible className="max-w-[200px] text-center">
          <p className="font-medium text-sm">{name}</p>
          {description && <p className="text-muted-foreground truncate text-xs">{description}</p>}
        </NodeToolbar>
      )}
    </>
  );
}
```

---

## 6. Preventing Drag Conflicts: `nodrag` & `nopan`

When embedding interactive HTML elements (inputs, textareas, sliders, buttons) inside custom nodes:
- Add `className="nodrag"` so clicking and selecting text inside an input does not drag the node across the canvas.
- Add `className="nopan"` if scrolling an internal container should not pan the canvas viewport.

```tsx
<input
  type="text"
  className="nodrag w-full rounded border px-2 py-1 text-xs"
  value={data.label}
  onChange={(e) => updateLabel(e.target.value)}
/>
```

---

## 7. Adding Nodes via `screenToFlowPosition`

When dropping or inserting nodes from external UI panels (such as `<Sheet>` or modal dialogs), convert screen pixel coordinates (e.g. center of viewport or mouse drop coordinates) to flow canvas coordinates using `useReactFlow().screenToFlowPosition`:

```tsx
// Inside NodeSelector component
const { setNodes, screenToFlowPosition } = useReactFlow();

const handleAddNode = (nodeType: NodeType) => {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  // Convert browser screen pixels to canvas coordinates
  const flowPosition = screenToFlowPosition({
    x: centerX + (Math.random() - 0.5) * 100,
    y: centerY + (Math.random() - 0.5) * 100,
  });

  const newNode = {
    id: createId(),
    type: nodeType,
    position: flowPosition,
    data: {},
  };

  setNodes((currentNodes) => [...currentNodes, newNode]);
};
```

