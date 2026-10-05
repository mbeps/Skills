# TypeScript SDK Migration Guide (v1 $\to$ v2)

The TypeScript SDK was refactored for the 2026-07-28 stateless specification, moving from a single monolithic package to modular packages and adopting the Standard Schema specification.

---

## 1. Package Reorganization

The legacy monolithic `@modelcontextprotocol/sdk` package has been split into dedicated modular packages:

```json
// package.json (Old v1)
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.0"
  }
}

// package.json (New v2)
{
  "dependencies": {
    "@modelcontextprotocol/server": "^2.0.0",
    "@modelcontextprotocol/client": "^2.0.0"
  }
}
```

---

## 2. Automated Migration Codemod

Anthropic and the MCP community provide an automated codemod to handle mechanical imports, schema changes, and class renames:

```bash
npx @modelcontextprotocol/codemod@latest v1-to-v2 .
```

After running the codemod, check for any unhandled markers:
```bash
grep -rn '@mcp-codemod-error' .
```

---

## 3. Standard Schema Adoption

In v1, tool input schemas were tightly coupled to raw Zod instances. In v2, the SDK supports **Standard Schema** (`@standard-schema/spec`), enabling Zod, Valibot, or ArkType interchangeably:

```typescript
// ✅ v2 with Zod (implements Standard Schema)
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const server = new McpServer({
  name: "MyServer",
  version: "2.0.0"
});

server.tool(
  "calculate_bmi",
  "Calculate BMI from weight and height",
  {
    weightKg: z.number().positive(),
    heightM: z.number().positive()
  },
  async ({ weightKg, heightM }) => {
    const bmi = weightKg / (heightM * heightM);
    return {
      content: [{ type: "text", text: `BMI: ${bmi.toFixed(1)}` }]
    };
  }
);
```

---

## 4. Factory Pattern for Stateless Handlers

In stateless HTTP mode, requests must not share mutable in-memory server state across callers. Use the factory pattern with `createMcpHandler`:

```typescript
import { createMcpHandler } from "@modelcontextprotocol/server/http";
import { McpServer } from "@modelcontextprotocol/server";

function createServer(): McpServer {
  const server = new McpServer({
    name: "StatelessServer",
    version: "2.0.0"
  });
  
  // Register tools, resources, prompts
  return server;
}

// Modern HTTP request handler (Next.js App Router, Express, or Hono)
export const POST = createMcpHandler(() => createServer(), {
  stateless: true
});
```

---

## 5. Dual-Era Compatibility

If you need to serve both legacy (sessionful) clients and modern (stateless 2026-07-28) clients during a transition period:
- Mount legacy clients on dedicated `/sse` routes using legacy session managers.
- Mount modern stateless clients on `/mcp` using Streamable HTTP.

