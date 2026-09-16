# Real-Time Execution & Visual Feedback

## 1. Node Execution Visual States

When a workflow executes durably on the server, nodes on the canvas should reflect their live lifecycle state without requiring a full page refresh:

```ts
export type NodeStatus = "initial" | "loading" | "success" | "error";
export type NodeStatusVariant = "border" | "overlay";
```

| Status    | Visual Feedback                                            | When Active                                            |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `initial` | Default node styling, no indicators                        | Idle / unexecuted node                                 |
| `loading` | Animated conic-gradient spinning border or blurred overlay | Node executor currently running                        |
| `success` | Emerald green border with checkmark icon                   | Step executed successfully, output merged into context |
| `error`   | Crimson red border with error icon                         | Step failed, execution halted or retrying              |

---

## 2. Animated Status Indicator Components

Implementing non-intrusive animations around custom React Flow nodes (`components/react-flow/node-status-indicator.tsx`):

### Conic-Gradient Spinning Border (`border` variant)
Renders a glowing conic gradient that rotates continuously around the node container:

```tsx
export const BorderLoadingIndicator = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <>
      <div className="absolute -left-[2px] -top-[2px] h-[calc(100%+4px)] w-[calc(100%+4px)]">
        <style>
          {`
            @keyframes spin {
              from { transform: translate(-50%, -50%) rotate(0deg); }
              to { transform: translate(-50%, -50%) rotate(360deg); }
            }
            .spinner {
              animation: spin 2s linear infinite;
              position: absolute;
              left: 50%;
              top: 50%;
              width: 140%;
              aspect-ratio: 1;
              transform-origin: center;
            }
          `}
        </style>
        <div className={cn("absolute inset-0 overflow-hidden rounded-sm", className)}>
          <div className="spinner rounded-full bg-[conic-gradient(from_0deg_at_50%_50%,_rgba(42,67,233,0.5)_0deg,_rgba(42,138,246,0)_360deg)]" />
        </div>
      </div>
      {children}
    </>
  );
};
```

### Overlay Loader (`overlay` variant)
Renders a semi-transparent blurred overlay directly over the node body with a central spinner:

```tsx
export const SpinnerLoadingIndicator = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative">
      <StatusBorder className="border-blue-700/40">{children}</StatusBorder>
      <div className="absolute inset-0 z-50 rounded-[7px] bg-background/50 backdrop-blur-sm" />
      <div className="absolute inset-0 z-50 flex items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-blue-700" />
      </div>
    </div>
  );
};
```

---

## 3. Subscribing to Real-Time Updates

Use custom hooks like `useNodeStatus` to listen to realtime execution events (via Inngest Realtime, Server-Sent Events, or WebSockets):

```tsx
// Inside GeminiNode component
const nodeStatus = useNodeStatus({
  nodeId: props.id,
  channel: GEMINI_CHANNEL_NAME,
  topic: "status",
  refreshToken: fetchGeminiRealtimeToken,
});

return (
  <BaseExecutionNode
    {...props}
    name="Gemini"
    status={nodeStatus}
    ...
  />
);
```

---

## 4. Conditional Canvas Controls

To prevent executing broken or unstartable workflows, conditionally render controls using canvas graph introspection:

```tsx
// features/editor/components/editor.tsx
const hasManualTrigger = useMemo(() => {
  return nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
}, [nodes]);

return (
  <ReactFlow ...>
    {/* Only display execute button when a manual trigger exists */}
    {hasManualTrigger && (
      <Panel position="bottom-center">
        <ExecuteWorkflowButton workflowId={workflowId} />
      </Panel>
    )}
  </ReactFlow>
);
```

---

## 5. DAG Validation & Topological Ordering

Before executing workflow nodes on the backend, ensure the graph is a valid Directed Acyclic Graph (DAG) using `toposort`:

```ts
import toposort from "toposort";

// Build graph edges from database connections
const graphEdges: [string, string][] = connections.map((conn) => [
  conn.fromNodeId,
  conn.toNodeId,
]);

try {
  // Returns node IDs in topological execution order
  const sortedNodeIds = toposort(graphEdges);
} catch (error) {
  // Throws if a cycle/loop is detected
  throw new Error("Workflow contains circular dependencies and cannot be executed");
}
```
Nodes are then executed sequentially in topological order, accumulating each step's output into a shared `WorkflowContext`.

