---
name: developing-mcp-servers
description: >
  Skill for teaching AI coding agents to design, implement, test, and maintain
  Model Context Protocol (MCP) servers, with Python-first guidance and
  language-agnostic principles.
---

This skill guides AI coding agents through building robust MCP servers, focusing on Python while keeping the design portable to any language.[web:1][web:14]

## Quick Start

1. **Confirm context and goals**

   - Ask what the server should do (APIs, databases, tools, file system, internal systems).
   - Ask for target language and runtime (Python by default, but support others when stated).[web:1][web:13]  
   - Ask where the server will run (local via stdio, remote via HTTP/SSE, mixed).[web:2][web:14]

2. **Pick SDK and transport**

   - For Python, prefer a maintained MCP SDK that supports servers, tools, resources, prompts, and stdio/HTTP transports.[web:1][web:5][web:9]  
   - For other languages, pick the official or Tier‑1 SDK from the MCP documentation.[web:13]  
   - Default to stdio transport for local development and editor/agent integrations.[web:2][web:11][web:12]

3. **Sketch the server contract**

   - List concrete tools, resources, and prompts the server should expose (names, arguments, return shapes).[web:5][web:14]  
   - Identify external dependencies (APIs, DBs, files) and required configuration (API keys, DSNs, paths).[web:5][web:6]

4. **Generate minimal working server**

   - Create a named MCP server with an empty tool set using the chosen SDK.[web:1][web:5][web:13]  
   - Implement one simple tool end‑to‑end (no external API yet), wire it to stdio, and show how to run it.[web:3][web:7]  
   - Add clear logging to stderr and version information in the server metadata.[web:7][web:11]

5. **Iterate towards production**

   - Add real tools, resources, and prompts with strong typing and argument validation where the SDK supports it.[web:1][web:5][web:9][web:13]  
   - Implement lifecycle hooks (startup/shutdown) for connections and caches if supported by the SDK.[web:5]  
   - Document usage, configuration, and example calls for both humans and agents.

## Instructions

### 1. When to use this skill

An AI coding agent should activate this skill when:

- A user asks to build, modify, or debug an MCP server in any language.  
- A user wants an agent‑accessible interface over an API, database, file system, or internal service.  
- A user wants to move from ad‑hoc function calling to a portable MCP‑compatible integration.[web:6][web:9][web:14]

The skill must not be used for:

- Plain HTTP APIs that do not need MCP or LLM integration.  
- Features that a host already exposes natively, unless the user explicitly wants MCP.  

### 2. Understand MCP fundamentals

The agent must first align on core concepts:

- MCP uses JSON‑RPC 2.0 as its data layer for client–server messages.[web:2][web:10][web:14]  
- Servers expose **tools**, **resources**, and **prompts** as the primary primitives.[web:1][web:5][web:14]  
- Transports include stdio for local development and streamable HTTP for remote or multi‑client setups.[web:2][web:6][web:14]  

The agent should:

- Briefly summarise these concepts back to the user to confirm shared understanding.  
- Link any design decisions (e.g. stdio vs HTTP) back to these layers.

### 3. Choose language and SDK

The agent must:

- Default to a Python MCP SDK when the user prefers Python or does not care about language details.[web:1][web:5][web:9]  
- For other languages, select SDKs from the official MCP SDK list (e.g. Node/TypeScript, .NET, Java) and follow their idioms.[web:7][web:11][web:13]  
- Confirm SDK maturity (Tier status) and feature coverage for tools, resources, prompts, lifecycle, and transports.[web:13]  

For Python‑specific behaviour:

- Prefer SDKs that provide decorators for tools and strong typing for request/response payloads.[web:1][web:5][web:9]  
- Prefer SDKs with built‑in stdio helpers and, when needed, HTTP/SSE support.[web:1][web:2][web:9]

### 4. Design the server before coding

The agent must treat MCP servers as contracts first, implementations second.

Required design steps:

- **Define tools**

  - For each tool, specify name, purpose, arguments (name, type, optional/required), and return schema.[web:5][web:9][web:14]  
  - Keep tools small and composable; avoid giant “do everything” tools.

- **Define resources**

  - Identify read‑only or mostly read‑only data that agents will need as context (e.g. config, docs, schemas).[web:1][web:5][web:14]  
  - Assign stable identifiers (URIs or paths) and MIME types when the SDK supports them.[web:5][web:14]

- **Define prompts**

  - When the SDK supports prompts, create reusable templates for common operations (e.g. “search and summarise logs”).[web:1][web:5][web:13]  

- **Model errors and limits**

  - Decide how the server will report validation errors, upstream failures, and rate limits via JSON‑RPC errors or structured results.[web:2][web:14]  

The agent should show the user a concise “MCP contract” document (YAML/JSON/Markdown) before generating code.

### 5. Implement a minimal Python server

When using Python, the agent should:

- Initialise a server instance with a clear name and optional dependencies and lifespan hooks.[web:1][web:5][web:9]  
- Register tools using the SDK’s tool decorator or registration API, with docstrings that describe intent for LLMs.[web:1][web:5]  
- Use context objects for shared resources like database connections or API clients.[web:5]  

The agent must:

- Implement at least one trivial tool (e.g. echo, health‑check) to prove wiring.  
- Provide a simple `if __name__ == "__main__"` entry point that runs the server over stdio, logging messages to stderr only.[web:3][web:7][web:11]  

It should then:

- Show exact shell commands to run the server process.  
- Provide a minimal client snippet or configuration to call the tool (e.g. via an MCP client, editor, or agent framework).[web:3][web:5][web:9]

### 6. Implement servers in other languages

For non‑Python languages, the agent must:

- Use the language‑specific MCP server class or setup from the chosen SDK.[web:7][web:11][web:13]  
- Mirror the same contract (tool names, arguments, result shapes) defined earlier.  
- Use idiomatic error handling and async patterns from that ecosystem (e.g. async/await in Node, Tasks in .NET).

It must keep:

- The JSON‑RPC message semantics consistent across languages.[web:2][web:14]  
- The same transports (stdio vs HTTP) and security assumptions whenever possible.[web:2][web:6][web:11][web:14]

### 7. Transport and deployment choices

The agent should follow these guidelines:

- Use **stdio** for local development, CLI launches, and integrations with editors and agent hosts that spawn child processes.[web:2][web:7][web:11][web:12]  
- Use **HTTP with streaming (SSE)** for remote, multi‑tenant, or cloud deployments where the MCP server must be reachable across the network.[web:2][web:6][web:14]  

For HTTP:

- Configure POST endpoints for JSON‑RPC with proper `Accept` headers including `application/json` and `text/event-stream` when streaming is enabled.[web:2][web:14]  
- Support authentication (e.g. bearer tokens, API keys, OAuth) when exposing servers over the internet.[web:6][web:14]  

The agent must explain to the user why a transport was chosen and how to change it later.

### 8. Testing and validation

The agent must:

- Provide unit‑level tests for tools where possible, independent of the MCP transport.  
- Provide end‑to‑end tests that:

  - Start the server (stdio or HTTP).  
  - Send JSON‑RPC messages that mirror real MCP requests.  
  - Assert on responses and errors.[web:2][web:11][web:14]  

- Encourage use of official clients or SDK test utilities to list tools, resources, and prompts, and to call them programmatically.[web:1][web:5][web:9][web:13]  

For Python examples, tests should:

- Use async test frameworks or test helpers compatible with the chosen SDK where needed.[web:5][web:9]  

### 9. Observability and robustness

The agent should:

- Route logs and diagnostics to stderr for stdio transports so JSON‑RPC remains clean on stdout.[web:7][web:11]  
- Include structured error messages that are helpful for both humans and LLMs (error codes plus short text).  
- Implement graceful shutdown hooks to clean up resources, especially for HTTP deployments.[web:5][web:7][web:11]  

Where supported, the agent can:

- Expose debugging tools (e.g. “list recent errors”, “inspect config”) to help agents debug themselves.  

### 10. Documentation and handover

The agent must always produce:

- A short README describing the MCP server’s purpose, tools, resources, prompts, and transports.[web:5][web:9]  
- Example command‑line invocations or host configuration snippets for common clients (e.g. Claude‑compatible clients, editors, custom agents).[web:3][web:6][web:11][web:12]  
- Notes on rate limits, authentication, and any dangerous operations.

## Examples

### Example 1 – New Python MCP server over stdio

**Input**

> Build a Python MCP server that exposes a `get_weather(city)` tool using a third‑party HTTP API. I want to run it locally from my editor via stdio.

**Expected agent behaviour (Output)**

- Confirm the API provider, auth method, and rate limits.  
- Choose a Python MCP SDK with stdio support and describe installation commands.[web:1][web:5][web:9]  
- Define a contract for `get_weather` (arguments: `city` string; result: temperature, condition, humidity).  
- Generate:

  - `server.py` defining the MCP server, registering `get_weather`, and using a shared HTTP client.  
  - A `main` block that runs the server over stdio with stderr logging only.[web:3][web:7][web:11]  

- Provide:

  - Example shell command to start the server.  
  - A minimal client example (or editor configuration) that lists tools and calls `get_weather`.[web:3][web:5][web:9]

### Example 2 – Adding a resource to an existing server

**Input**

> I already have an MCP server for my Postgres database in Python. Add a resource that exposes my schema as read‑only context for the model.

**Expected agent behaviour (Output)**

- Inspect or ask for the existing server structure and SDK.  
- Propose a new resource, e.g. `db-schema://public`, that returns a text representation of the schema (SQL or Markdown).[web:1][web:5][web:14]  
- Implement:

  - A resource registration using the SDK’s resource API.  
  - Logic that queries Postgres system tables or uses existing introspection code.  

- Add tests:

  - For the resource function in isolation.  
  - For the MCP read operation using the SDK client to `read_resource`.[web:5][web:9]  

### Example 3 – Porting to another language

**Input**

> Port my Node MCP server to Python but keep the same tools and behaviour so existing clients keep working.

**Expected agent behaviour (Output)**

- Ask for or reconstruct the MCP contract (tool names, args, result shapes, errors) from existing Node code.[web:7][web:13][web:14]  
- Map Node SDK features (tool registration, stdio transport, lifecycle) to the Python SDK equivalents.[web:1][web:5][web:7][web:13]  
- Implement a new Python server that:

  - Preserves tool names and argument schemas.  
  - Preserves error codes and response formats as much as possible.  
  - Uses the same transport (e.g. stdio) by default.  

- Provide a migration checklist and a small script that calls both servers and compares sample responses.

### Example 4 – Switching to HTTP transport

**Input**

> My MCP server is running over stdio today. I want to host it in the cloud behind HTTP with streaming responses.

**Expected agent behaviour (Output)**

- Explain differences between stdio and HTTP transports within MCP while keeping JSON‑RPC the same.[web:2][web:6][web:14]  
- Modify or generate server code to:

  - Listen for HTTP POST requests carrying JSON‑RPC messages.  
  - Use SSE or equivalent for streaming responses where supported by the SDK.[web:2][web:6]  

- Add configuration for:

  - Authentication (e.g. bearer tokens or API keys).  
  - Base path and routing compatible with the host’s MCP expectations.[web:6][web:11][web:14]  

- Provide deployment examples (Docker, cloud platform) and updated client configuration.

## Workflows

### Workflow 1 – Greenfield Python MCP server

1. Clarify the target use‑case, language (Python), runtime, and transport (stdio by default).  
2. Select a Python MCP SDK and record exact version and install commands.[web:1][web:5][web:9]  
3. Draft an MCP contract:

   - Tools, resources, prompts.  
   - Arguments, result shapes, error patterns.

4. Scaffold the server:

   - Create a server instance with name and optional lifespan hooks.  
   - Implement a health‑check tool and run the server over stdio.[web:3][web:5][web:7]  

5. Add business tools one by one, with:

   - Strong typing and validation where supported.  
   - Clear docstrings for LLM usage hints.[web:1][web:5][web:9]  

6. Add tests:

   - Unit tests for each tool.  
   - End‑to‑end tests using the MCP client.  

7. Add logging, error mapping, and graceful shutdown.  
8. Document install, configuration, and usage.

### Workflow 2 – Extending an existing server

1. Inspect the existing server and SDK, or ask user for repository access.  
2. Extract the current MCP contract and identify gaps (new tools/resources needed).  
3. Update the contract document and validate with the user.  
4. Implement new tools/resources:

   - Reusing existing clients, connection pools, and context objects.[web:5]  

5. Update tests and provide regression checks.  
6. Bump version and update documentation.

### Workflow 3 – Hardening and productionising

1. Review server configuration for authentication, rate limiting, and dangerous operations.  
2. For HTTP transports, ensure proper auth and TLS configuration.[web:6][web:11][web:14]  
3. Add structured logs and metrics (if platform supports them).  
4. Introduce feature flags or configuration files for tool availability.  
5. Provide runbooks for common incidents (upstream API failure, DB down, schema changes).  

## Edge Cases

The agent must explicitly handle or warn about these cases:

- **Long‑running or streaming operations**

  - Prefer streaming responses where supported instead of blocking calls.[web:2][web:6][web:14]  
  - Document timeouts and cancellation behaviour.

- **Large payloads and context limits**

  - Avoid returning huge payloads; introduce pagination or summarisation tools.  
  - Provide separate tools for “list identifiers” vs “fetch detail”.

- **Unstable or rate‑limited upstream services**

  - Surface clear error messages with codes and hints.  
  - Consider backoff, caching, or “degraded mode” tools.

- **Schema or contract drift**

  - Keep a single source‑of‑truth contract document.  
  - Require explicit updates when changing tool signatures or response formats to avoid breaking clients.[web:5][web:9][web:14]  

- **Mixed transports**

  - When supporting both stdio and HTTP, ensure consistent semantics and document any differences in auth or deployment.[web:2][web:6][web:11][web:14]  

- **Security and data leakage**

  - Never log secrets (API keys, tokens) even to stderr.  
  - Warn when tools could expose sensitive data and suggest access control patterns.

If information for any of these cases is missing, the agent must ask clarifying questions instead of guessing.

## References

- MCP Python SDK (PyPI): https://pypi.org/project/mcp/ [web:1]  
- Example Python MCP SDK repository: https://github.com/danilop/mcp-python-sdk [web:5]  
- Official MCP specification – transports: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports [web:2]  
- Official MCP architecture overview: https://modelcontextprotocol.io/docs/learn/architecture [web:14]  
- Official MCP SDK list and tiers: https://modelcontextprotocol.io/docs/sdk [web:13]  
- Guide to building MCP servers over stdio: https://www.aubergine.co/insights/building-mcp-servers-using-stdio [web:3]  
- Overview of MCP and its role as a universal connector: https://gpt-trainer.com/blog/anthropic+model+context+protocol+mcp [web:6]  
- Example stdio transport implementation in another SDK: https://mcp-framework.com/docs/Transports/stdio-transport/ [web:7]  
- SQL MCP Server stdio transport (Microsoft): https://learn.microsoft.com/en-us/azure/data-api-builder/mcp/stdio-transport [web:11]  
- “MCP Python SDK – Model Context Protocol Clients and Servers” overview: https://www.stainless.com/mcp/mcp-python-sdk-model-context-protocol-clients-and-servers [web:9]  
- Discussion of MCP specs and JSON‑RPC use: https://www.reddit.com/r/mcp/comments/1q0lboj/can_someone_explain_the_current_state_of_the_mcp/nx5ilkj/ [web:10]

