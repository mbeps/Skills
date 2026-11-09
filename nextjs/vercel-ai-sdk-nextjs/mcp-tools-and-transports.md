# MCP Tools & Transports

The Model Context Protocol (MCP) enables LLMs to connect to external servers exposing dynamic tools, resources, and prompts over standard protocols. In Next.js App Router applications, `@ai-sdk/mcp` connects Vercel AI SDK workflows to remote MCP servers.

---

## 1. Transport Architecture: HTTP vs stdio

In serverless or web environments (Next.js route handlers, server actions, Inngest durable functions), **stdio transports are not viable** for remote integrations and introduce severe security and isolation risks. Standardize on HTTP transports (`Streamable HTTP` / `SSE`):

```typescript
import { createMCPClient } from "@ai-sdk/mcp";
import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";

const client = await createMCPClient({
  transport: {
    type: "http",
    url: "https://api.example.com/mcp",
    redirect: "follow",
    fetch: safeMcpFetch, // SSRF-protected fetch wrapper
    headers: {
      "Authorization": `Bearer ${decryptedToken}`,
    },
  },
  onUncaughtError: (error) => {
    console.error("MCP stream error:", error);
  },
});
```

---

## 2. SSRF Protection & Safe Redirects

Remote MCP endpoints provided by users or third parties must be protected against Server-Side Request Forgery (SSRF). Never use raw `fetch()` directly against untrusted MCP URLs.

### Requirements:
1. **Private Network Guard**: Block loopback (`127.0.0.1`, `localhost`), link-local (`169.254.169.254`), private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and internal DNS names.
2. **Hop-by-Hop Redirect Validation**: Validate IP address on **every HTTP redirect hop** (301, 302, 303, 307). Attackers frequently configure public DNS names that 302-redirect to internal metadata endpoints.
3. **HTTP Method Transition**: RFC 7231/9110 specifies that 301/302/303 redirects switch POST to GET and strip payload headers (`Content-Type`, `Content-Length`).

```typescript
// lib/mcp/safe-mcp-fetch.ts
import { isBlockedUrl } from "@/lib/mcp/url-guard";

const MAX_REDIRECTS = 5;

export async function safeMcpFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  let currentUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let currentInit = { ...init };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl, {
      ...currentInit,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;

      const nextUrl = new URL(location, currentUrl);

      // Re-validate every redirect hop against SSRF rules
      if (await isBlockedUrl(nextUrl.href)) {
        throw new Error(`SSRF Blocked: Redirect destination "${nextUrl.href}" points to internal/private address`);
      }

      currentUrl = nextUrl.href;

      // Drop payload when redirecting POST to GET
      if ([301, 302, 303].includes(response.status) && currentInit.method === "POST") {
        currentInit = { ...currentInit, method: "GET", body: undefined };
      }
      continue;
    }

    return response;
  }

  throw new Error(`Too many redirects (limit: ${MAX_REDIRECTS})`);
}
```

---

## 3. Schema Sanitisation: Removing `propertyNames`

LLM function-calling implementations (OpenAI, Anthropic, Google Gemini, Groq) **do not support JSON Schema `propertyNames` constraints**. Remote MCP servers implementing full JSON Schema specifications often include `propertyNames`, causing immediate API rejection when passed to Vercel AI SDK.

Clean schemas recursively before registering tools:

```typescript
export function removePropertyNamesInPlace<T>(schema: T): T {
  if (schema == null || typeof schema !== "object") return schema;

  if (Array.isArray(schema)) {
    for (const item of schema) removePropertyNamesInPlace(item);
    return schema;
  }

  delete (schema as Record<string, unknown>).propertyNames;

  for (const value of Object.values(schema as Record<string, unknown>)) {
    if (value && typeof value === "object") {
      removePropertyNamesInPlace(value);
    }
  }

  return schema;
}

export function cleanToolSchema<T>(toolDef: T): T {
  if (!toolDef || typeof toolDef !== "object") return toolDef;
  const def = toolDef as Record<string, any>;

  if (def.inputSchema) {
    removePropertyNamesInPlace(def.inputSchema.jsonSchema ?? def.inputSchema);
  }
  if (def.parameters) {
    removePropertyNamesInPlace(def.parameters.jsonSchema ?? def.parameters);
  }

  return toolDef;
}
```

---

## 4. Tool Name Sanitisation & Collision Handling

Major LLM providers enforce strict tool naming patterns (e.g. OpenAI `^[a-zA-Z0-9_-]{1,64}$`). Remote MCP tools with spaces, dots, slashes, or names exceeding 64 characters trigger validation exceptions.

```typescript
const MAX_TOOL_NAME_LENGTH = 64;
const INVALID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;

export function sanitiseToolName(raw: string): string {
  if (!raw || typeof raw !== "string") return "tool";
  return raw.replace(INVALID_CHARS_REGEX, "_").slice(0, MAX_TOOL_NAME_LENGTH);
}

export function sanitiseToolNames<T>(tools: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  const usedNames = new Set<string>();

  for (const [originalName, tool] of Object.entries(tools)) {
    const baseCleaned = sanitiseToolName(originalName);
    let finalName = baseCleaned;
    let counter = 2;

    while (usedNames.has(finalName)) {
      const suffix = `_${counter}`;
      const prefixLimit = Math.max(1, MAX_TOOL_NAME_LENGTH - suffix.length);
      finalName = `${baseCleaned.slice(0, prefixLimit)}${suffix}`;
      counter++;
    }

    usedNames.add(finalName);
    result[finalName] = tool;
  }

  return result;
}
```

---

## 5. Tool Call Execution Timeouts

Unresponsive remote MCP servers can cause LLM streams to stall indefinitely. Wrap every tool's `execute` method with an execution timeout and combine it with the request's parent abort signal using `AbortSignal.any()`:

```typescript
export function applyToolTimeout(toolDef: any, timeoutMs = 120_000) {
  if (typeof toolDef?.execute !== "function") return toolDef;

  const originalExecute = toolDef.execute.bind(toolDef);

  return {
    ...toolDef,
    execute: async (args: any, options?: any) => {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const combinedSignal = options?.abortSignal
        ? AbortSignal.any([options.abortSignal, timeoutSignal])
        : timeoutSignal;

      return Promise.race([
        originalExecute(args, { ...options, abortSignal: combinedSignal }),
        new Promise((_, reject) => {
          combinedSignal.addEventListener("abort", () => {
            reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
          });
        }),
      ]);
    },
  };
}
```

---

## 6. Multi-Server Connection & Lifecycle Cleanup

When loading tools from multiple MCP servers:
1. Connect using `Promise.allSettled` so that one unreachable server does not break the entire chat session.
2. Track and return a `cleanup` callback that calls `client.close()` across all connections.
3. Clean up connections in a `finally` block or when the stream terminates.

```typescript
import { createMCPClient } from "@ai-sdk/mcp";

export async function getMcpTools(servers: ServerConfig[]) {
  const results = await Promise.allSettled(
    servers.map(async (server) => {
      const client = await createMCPClient({
        transport: {
          type: "http",
          url: server.url,
          fetch: safeMcpFetch,
        },
      });

      const rawTools = await client.tools();
      return { client, server, rawTools };
    })
  );

  const clients: any[] = [];
  const mergedTools: Record<string, any> = {};

  for (const res of results) {
    if (res.status === "fulfilled") {
      const { client, rawTools } = res.value;
      clients.push(client);

      for (const [name, tool] of Object.entries(rawTools)) {
        mergedTools[name] = applyToolTimeout(cleanToolSchema(tool));
      }
    }
  }

  const sanitisedTools = sanitiseToolNames(mergedTools);

  const cleanup = async () => {
    await Promise.allSettled(clients.map((c) => c.close()));
  };

  return { tools: sanitisedTools, cleanup };
}
```

### Usage with `streamText`:

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages, enabledServers } = await req.json();
  const { tools, cleanup } = await getMcpTools(enabledServers);

  try {
    const result = streamText({
      model: openai("gpt-4o"),
      messages,
      tools,
      maxSteps: 5,
      onFinish: async () => {
        await cleanup();
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    await cleanup();
    throw err;
  }
}
```

---

## 7. Short-Lived Operations: The `withMcpServer` Pattern

For discovery, resource reading, or prompt retrieval that does not span an interactive stream, guarantee connection termination with a scoped wrapper:

```typescript
export async function withMcpServer<T>(
  server: ServerConfig,
  callback: (client: any) => Promise<T>,
): Promise<T> {
  let client: any;
  try {
    client = await createConnectedClient(server);
    return await callback(client);
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

// Example: Discovering tools and prompts
export async function discoverTools(server: ServerConfig) {
  return withMcpServer(server, async (client) => {
    const tools = await client.listTools();
    return tools;
  });
}
```
