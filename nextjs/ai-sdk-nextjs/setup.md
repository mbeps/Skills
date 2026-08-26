# Setup: install, providers, env vars, model selection

## Install

```bash
npm i ai @ai-sdk/react @ai-sdk/openai
```

Packages are independently versioned. Real-project versions (verified):

| Package                     | Version  | Exports                                                                                                                |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ai`                        | `7.0.79` | core + framework-agnostic chat state machine (`AbstractChat`, `HttpChatTransport`, `DefaultChatTransport`, `ChatInit`) |
| `@ai-sdk/react`             | `4.0.82` | `useChat`, `useCompletion`, `useObject`, `useRealtime`; re-exports `UIMessage`, `Chat`, `DefaultChatTransport`         |
| `@ai-sdk/openai`            | `4.0.47` | `openai`, `createOpenAI`                                                                                               |
| `@ai-sdk/anthropic`         | `4.0.42` | `anthropic`                                                                                                            |
| `@ai-sdk/google`            | `4.0.51` | `google`                                                                                                               |
| `@ai-sdk/openai-compatible` | —        | `createOpenAICompatible`                                                                                               |
| `@ai-sdk/mcp`               | `2.0.37` | `createMCPClient`                                                                                                      |
| `@ai-sdk/gateway`           | —        | provider gateway                                                                                                       |

## Providers

Preconfigured instances for the common providers:

```ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const model = openai('gpt-5.4');
```

For a custom endpoint, use the factory:

```ts
import { createOpenAI } from '@ai-sdk/openai';

const sdkProvider = createOpenAI({ baseURL, apiKey, headers });
const chat = sdkProvider.chat(modelId);
const embedding = sdkProvider.embeddingModel(modelId);
```

## Model registry

`createProviderRegistry` maps string model ids like `'openai/gpt-5.4'`:

```ts
import { createProviderRegistry } from 'ai';
import { openai } from '@ai-sdk/openai';

const registry = createProviderRegistry({ openai });
// model('openai/gpt-5.4')
```

The optional second argument configures the id scheme: `createProviderRegistry(providers, { separator, middleware })`. `separator` splits the `provider/model` id (default `/`); `middleware` wraps model calls.

`customProvider({ languageModels, embeddingModels, imageModels, ..., fallbackProvider })` composes providers and throws `NoSuchModelError` when a model is missing and there is no fallback. There is no standalone `fallback()` in v7 core — use `customProvider({ fallbackProvider })`.

## Env vars

Read env vars once at module scope from `process.env` (or your `env.ts` helper). Throw a typed error when a required API key is missing at the trust boundary — ai-client does this before constructing the provider.

## Model selection (dynamic provider, from ai-client)

Per-user API keys are decrypted per execution, then a provider is constructed for that request:

```ts
const sdkProvider = createOpenAI({ baseURL, apiKey: decryptedKey, headers });
if (!sdkProvider) throw new Error('Missing provider credentials');
const model = sdkProvider.chat(modelId); // or .embeddingModel(modelId)
```
