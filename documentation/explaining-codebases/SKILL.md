---
name: explaining-codebases
description: Use when creating architectural onboarding documentation, system explanations, or codebase walkthroughs for engineers joining a project.
---

# Explaining Codebases

## Overview

Produce structured, technical codebase documentation for software engineers. Progress from top-level architecture down to granular function and component mechanics without fluff.

**Writing Standard:** Write in Simplified Technical English (ASD-STE100). Use short sentences, active voice, and clear terminology. Avoid filler words and decorative dashes.

## When to Use

Use this skill when:
- An engineer joins a project and requires an architectural onboarding document.
- Documenting system mechanics, data flows, and code organization for an existing repository.
- Reverse-engineering an unfamiliar codebase into structured technical documentation.

Do NOT use this skill for:
- Writing project setup guides, installation instructions, or dependency commands.
- Explaining elementary computer science concepts (for example, basic databases, HTTP, or JWT theory).
- Writing code line-by-line in long code blocks.

## Core Structure

Document codebases following a progressive depth model:

1. **System Overview & Scope**: Purpose, core domain boundaries, and capabilities.
2. **Technology Stack**: Runtime, framework, database, state, styling, and validation tools.
3. **Architectural Topology**: Mermaid diagrams illustrating client, edge, server, and external boundaries.
4. **Directory Organization**: Purpose of each directory categorized into 4 tiers (Entry Points, Transport/API, Domain Logic, Infrastructure). See [structure-guide.md](./structure-guide.md).
5. **Request Pipeline**: Document the 5 stages (Routing, Middleware/Auth, Service Layer, Data Access, Response). See [diagrams-and-flows.md](./diagrams-and-flows.md).
6. **Symbol Dictionary**: Detailed tables of functions, components, hooks, schemas, and types with What, Why, How, and Dependencies.
7. **External System Integrations**: Interaction models for databases, auth, object storage, and third-party APIs.
8. **File Citations, Documentation & Rationale**: Explicit links to repository code, schemas, wikis, official external documentation, and architectural rationale for key technical choices.

## Quick Reference

| Section | Required Elements | Omit |
| :--- | :--- | :--- |
| **System Overview** | Domain scope, core features | Marketing prose, tutorials |
| **Architecture** | Component topologies, data flow diagrams | Generic network diagrams |
| **Taxonomy** | 4 tiers (Entry, API, Logic, Infra) | Arbitrary folder lists |
| **Pipeline** | 5 stages (Routing to Response) | Implementation snippets |
| **Symbols** | What, Why, How, Signatures, Links | Unannotated lists |

## Rationalization Table

| Excuse | Reality |
| :--- | :--- |
| "Engineers need install steps" | Setup belongs in README files. Architecture documents explain system design. |
| "Explain JWT or SQL first" | Experienced engineers already know CS fundamentals. Focus on project specifics. |
| "A code block is clearer than prose" | Huge code blocks obscure design. Provide signatures and semantic explanations. |
| "A high-level overview is sufficient" | High-level overviews without symbol tables leave engineers unable to write code. |

## Red Flags (STOP and Correct)

- Adding `npm install`, `docker compose`, or local CLI commands.
- Explaining generic web concepts rather than repository mechanics.
- Writing paragraphs with passive voice or sentences exceeding 25 words.
- Listing file names without linking them to actual source files.
