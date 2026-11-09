# Model Providers & Dynamic Credential Resolution

In modern enterprise applications, users frequently connect their own API keys (BYOK - Bring Your Own Key) or workspaces isolate credentials per tenant. This guide details how to dynamically instantiate provider clients using encrypted credentials stored in PostgreSQL via Drizzle or Prisma, and how to build a universal OpenAI-compatible provider client.

---

## 1. Universal OpenAI-Compatible Provider Factory

Many modern LLM endpoints (OpenRouter, Ollama, Groq, DeepSeek, Together, vLLM, Azure OpenAI) share the OpenAI chat completions REST API. Rather than installing dozens of single-vendor packages, build a universal provider using `@ai-sdk/openai`:

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { createReasoningNormalizingFetch } from "./reasoning-stream-parser";
import type { ReasoningEffort, ReasoningEffortFormat } from "@/schemas/providers";

export function buildSdkProvider(input: {
  providerName: string;
  baseUrl: string;
  apiKey: string | null;
  requiresKey?: boolean;
  headers: Record<string, string>;
  reasoningEffortFormat?: ReasoningEffortFormat;
  reasoningEffort?: ReasoningEffort;
  modelOptions?: Record<string, unknown> | null;
  fetch?: typeof fetch;
}) {
  // Support keyless local providers (e.g. Ollama, local vLLM)
  if (input.requiresKey !== false && !input.apiKey) {
    throw new Error(`API key not configured for provider: ${input.providerName}`);
  }

  // Inject reasoning normalizer into custom fetch
  const customFetch = createReasoningNormalizingFetch({
    reasoningEffortFormat: input.reasoningEffortFormat,
    reasoningEffort: input.reasoningEffort,
    modelOptions: input.modelOptions,
    baseFetch: input.fetch,
  });

  return createOpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey ?? undefined,
    headers: input.headers,
    fetch: customFetch,
  });
}
```

---

## 2. Dedicated Provider Package Matrix

Packages are independently versioned and specialized:

| Package | Factory / Primary Export | Role & Framework Exports | Default Model Examples |
|---|---|---|---|
| `ai` | Core APIs (`generateText`, `streamText`, `tool`, etc.) | Core + framework-agnostic chat state machine (`AbstractChat`, `HttpChatTransport`, `DefaultChatTransport`, `ChatInit`, `createProviderRegistry`, `customProvider`) | — |
| `@ai-sdk/react` | React client hooks | `useChat`, `useCompletion`, `useObject`, `useRealtime`; re-exports `UIMessage`, `Chat`, `DefaultChatTransport` | — |
| `@ai-sdk/openai` | `createOpenAI`, `openai` | OpenAI adapter & universal OpenAI-compatible engine | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` |
| `@ai-sdk/anthropic` | `createAnthropic`, `anthropic` | Anthropic Claude adapter | `claude-sonnet-4-5`, `claude-3-7-sonnet` |
| `@ai-sdk/google` | `createGoogleGenerativeAI`, `google` | Google Gemini adapter | `gemini-2.0-flash`, `gemini-1.5-pro` |
| `@ai-sdk/openrouter` / `@openrouter/ai-sdk-provider` | `createOpenRouter` | OpenRouter multi-model gateway | Hosted models (e.g. `anthropic/claude-3.7-sonnet`) |
| `@ai-sdk/openai-compatible` | `createOpenAICompatible` | Standard OpenAI REST endpoint adapter | Any compliant API |
| `@ai-sdk/mcp` | `createMCPClient` | Model Context Protocol transport & tool discovery | Remote MCP servers |
| `@ai-sdk/gateway` | Gateway client | Provider gateway & routing | — |
| **Ollama / Local** | `createOpenAI({ baseURL: "http://localhost:11434/v1" })` | Local keyless LLMs | `llama3.3`, `qwen2.5-coder`, `deepseek-r1` |

---

## 3. Global vs Dynamic Instantiation

### ❌ Anti-Pattern: Static Global Providers in Multi-Tenant Environments
```typescript
// BAD: Uses a single hardcoded process.env.OPENAI_API_KEY for all users
import { openai } from "@ai-sdk/openai";

export async function runJob(prompt: string) {
  return generateText({ model: openai("gpt-4o"), prompt });
}
```
**Why bad:** Impossible to bill different tenants separately, support user-provided keys, or apply tenant-specific rate limits.

### ✅ Best Practice: Dynamic Per-Execution Factory
```typescript
// GOOD: Instantiates provider dynamically with user's decrypted key
import { createOpenAI } from "@ai-sdk/openai";

export function getOpenAiProvider(decryptedApiKey: string) {
  return createOpenAI({
    apiKey: decryptedApiKey,
  });
}
```

---

## 4. Resolving Encrypted Credentials (Production Pattern)

In this architecture, user credentials are encrypted with AES-256-GCM before database insertion. The execution layer resolves and decrypts the credential during runtime:

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { db } from "@/drizzle/db";
import { decrypt } from "@/lib/encryption";

export async function resolveModelClient(params: {
  provider: "OPENAI" | "ANTHROPIC" | "GEMINI" | "OPENROUTER";
  userId: string;
  credentialId: string;
}) {
  const { provider, userId, credentialId } = params;

  // 1. Fetch user-scoped credential record
  const credential = await db.query.credentials.findFirst({
    where: (c, { and, eq }) => and(eq(c.id, credentialId), eq(c.userId, userId)),
  });

  if (!credential) {
    throw new Error(`Credential [${credentialId}] not found for user [${userId}]`);
  }

  // 2. Decrypt ciphertext using secure application secret
  const apiKey = decrypt(credential.value);

  // 3. Return matching provider instance
  switch (provider) {
    case "OPENAI":
      return createOpenAI({ apiKey });
    case "ANTHROPIC":
      return createAnthropic({ apiKey });
    case "GEMINI":
      return createGoogleGenerativeAI({ apiKey });
    case "OPENROUTER":
      return createOpenRouter({ apiKey });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
```

---

## 5. Provider-Specific Configurations

### OpenAI & Custom Proxies / Azure OpenAI
```typescript
import { createOpenAI } from "@ai-sdk/openai";

// Using an OpenAI-compatible proxy or internal gateway
const customGateway = createOpenAI({
  apiKey: decryptedKey,
  baseURL: "https://my-internal-llm-gateway.company.com/v1",
  headers: {
    "X-Tenant-Id": tenantId,
  },
});
```

### Anthropic with Extended Thinking
```typescript
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: decryptedKey,
  baseURL: "https://api.anthropic.com/v1",
});

// Invoking model with thinking configuration
const model = anthropic("claude-3-7-sonnet-20250219");
```

### Local Models (Ollama, vLLM, LM Studio)
```typescript
import { createOpenAI } from "@ai-sdk/openai";

const ollama = createOpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama", // Placeholder string when provider is keyless
});
```

---

## 6. Model Registry & Provider Composition

### Model Registry (`createProviderRegistry`)
Use `createProviderRegistry` to resolve string model identifiers (e.g. `'openai/gpt-4o'` or `'anthropic/claude-3-7-sonnet'`) dynamically:

```typescript
import { createProviderRegistry } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

export const registry = createProviderRegistry({
  openai,
  anthropic,
});

// Access model by prefix:
// const model = registry.languageModel('openai/gpt-4o');
```

The optional second argument configures the ID scheme and middleware:
```typescript
const customRegistry = createProviderRegistry(
  { openai, anthropic },
  {
    separator: ":", // custom separator (default: '/')
    middleware: myModelMiddleware, // wraps all model calls in the registry
  },
);
```

### Provider Composition & Fallbacks (`customProvider`)
Use `customProvider` to compose distinct providers for language, embedding, and image models, or configure a fallback provider:

```typescript
import { customProvider } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

export const compositeProvider = customProvider({
  languageModels: {
    "primary-chat": anthropic("claude-3-7-sonnet-20250219"),
    "fast-summary": openai("gpt-4o-mini"),
  },
  embeddingModels: {
    "default-embed": openai.embedding("text-embedding-3-small"),
  },
  fallbackProvider: openai, // Used when a requested model is missing
});
```

> [!NOTE]
> There is no standalone `fallback()` function in modern SDK core — configure fallbacks using `customProvider({ fallbackProvider })`. If a requested model does not exist and no fallback is specified, `customProvider` throws `NoSuchModelError`.
