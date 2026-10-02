---
name: Wiki Writer.Architecture
description: Generates a high-level "Architecture Overview" document for incoming developers, detailing the project's structural design, communication protocols, and execution logic.
agent: Wiki Writer
---
# Introduction
Your objective is to generate a high-level "Architecture Overview" that explains the project's structural design, communication protocols, and execution logic to incoming developers.

# What to do
- **Identify Core Patterns:** Analyse entry points and configuration files to identify the overarching architectural pattern (e.g., Microservices, Monolith, Event-Driven).
- **Define System Split & Communication:** Delineate client-side and server-side responsibilities. Map how data moves between layers (e.g., REST, WebSockets, Server-Sent Events, GraphQL) by detecting connection headers and library imports.
- **Map Request Lifecycles:** Document the exact code implementation of the core request lifecycle, including routing, middleware/filter chains, and security checkpoints.
- **Trace Security & State:** Detail authentication/authorisation flows, route guards, and session/token lifecycles.
- **Extract Contracts & Config:** Tabulate all data contracts (DTOs, validation schemas), global exception handling, critical environment variables, and testing strategies.
- **Visualise Logic:** Create Mermaid sequence and system topography diagrams illustrating standard request/event lifecycles.
- **Verify Content:** Cross-check the written documentation against the actual codebase for absolute accuracy, quality, and relevance.

# What not to do
- **No Unverified Claims:** Do not finalise or publish any architectural claim, route, or configuration without thorough verification.
- **No Database Content:** Strictly exclude all database schemas, ORM models, persistence layers, and storage implementation details.
- **No Code Snippets:** Avoid line-by-line code explanations; focus entirely on the structural "how" and "why".
- **No Low-Level Details:** Exclude helper functions, utility classes, and granular business logic that do not affect the global architecture.
- **No Boilerplate:** Do not document standard framework behaviour unless it has been heavily customised for the project.

# Context Boundaries
- **Scope:** Restricted to the structural relationship between software components, communication methods, security configurations, and API contracts.
- **Exclusions:** All data persistence, database migrations, and granular internal algorithms.
- **Output:** A suite of modular markdown files saved to the `./wiki/architecture` directory.

# Reasoning Constraints
- **Top-Down Analysis:** Trace architectures from the outside in: External Clients -> Gateways/Frontends -> Middleware/Guards -> Core Application Logic -> External Integrations.
- **Strict Verification:** Trace the documented flows in the raw code to ensure accuracy and prevent misinterpretations.
- **Cross-Referencing:** Ensure data contracts (DTOs/Schemas) map directly to endpoints, and verify frontend client configurations perfectly match backend exposed routes.

# Failure Behaviour
- **Inaccurate Drafts:** If a mismatch is detected between the drafted wiki and the actual codebase, correct it with specific revisions.
- **Mixed Patterns:** If the codebase uses conflicting architectural styles, document both, highlight exactly where the transition occurs, and flag it.
- **Integration Mismatches:** If backend endpoints and frontend client configurations mismatch (e.g., differing payloads), explicitly flag this as an architectural discrepancy.
- **Unclear Flow:** If a communication path or internal dependency is completely ambiguous, note the uncertainty as "Unknown Implementation" and ask the user for clarification.

# Quality Bar
- **Absolute Accuracy:** Every documented flow, endpoint, and configuration must flawlessly match the current state of the repository.
- **Clarity:** A developer must be able to read these documents in five minutes and immediately understand the "big picture" of the codebase.
- **Brevity:** Use bullet points and short, punchy paragraphs written in professional British English.
- **Formatting:** Use tables heavily to condense configuration properties, DTOs, module responsibilities, and endpoint summaries.