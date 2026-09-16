# Codebase Explanation: Structure Guide

This document defines the structure and writing standards for explaining software codebases to engineers.

## 1. Writing Rules (ASD-STE100 Principles)

- Write in short sentences (target under 20 words per sentence).
- Use active voice. Specify the subject that performs the action.
- Use simple punctuation (commas, periods, parentheses). Avoid dashes as decorative punctuation.
- Avoid buzzwords, filler words, and subjective statements.
- Do not explain elementary programming or computer science concepts (such as what an HTTP request is, what a database is, or what JWT is).
- Do not include project setup or installation steps (such as `git clone` or `npm install`). Focus exclusively on system architecture and code mechanics.
- Do not paste multi-line code blocks line-by-line. Use concise signatures, type definitions, and structural citations instead.

## 2. Four-Tier Architectural Taxonomy

Classify all repository files into these four primary layers:

| Layer               | Purpose                                                            | Common Paths / Patterns                                                 |
| :------------------ | :----------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **Entry Points**    | Application bootstrap, root layouts, proxy middleware, workers     | `app/layout.tsx`, `proxy.ts`, `instrumentation.ts`, `main.*`, `index.*` |
| **Transport / API** | Ingress routing, page routes, route handlers, server actions, RPCs | `app/**/page.tsx`, `actions/**`, `api/**`, `controllers/**`             |
| **Domain Logic**    | Business rules, state management, entity mapping, validations      | `lib/**`, `hooks/**`, `schemas/**`, `providers/**`, `services/**`       |
| **Infrastructure**  | Database schemas, storage buckets, external clients, ORM config    | `database/**`, `utils/supabase/**`, `config/**`, `docker/**`            |

## 3. Five-Stage Request Pipeline

For each major feature or subsystem, document the 5-stage flow:

1. **Routing**: Where does the incoming event or navigation enter?
2. **Middleware / Authentication**: What intercepts the request and validates credentials or session state?
3. **Service Layer**: Where are the core business invariants and input validations evaluated?
4. **Data Access**: How is persistent state retrieved, joined, or mutated?
5. **Response / Output**: How is data transformed, serialized, or streamed back to the consumer?

## 4. Symbol Dictionary Specification

For every domain module, provide a structured symbol table containing:

| Field              | Description                                                                                |
| :----------------- | :----------------------------------------------------------------------------------------- |
| **Symbol Name**    | Exact identifier (function, component, hook, type, enum, class) with file link             |
| **Kind**           | Server Action, React Server Component, Client Hook, Zod Schema, Domain Type, Zustand Store |
| **Signature**      | Concise type signature or props contract                                                   |
| **What it does**   | Concrete functional purpose                                                                |
| **Why it is used** | Architectural intent and design motivation                                                 |
| **How it works**   | Core internal mechanism, validations, and downstream interactions                          |
| **Dependencies**   | Linked upstream callers and downstream targets                                             |

## 5. File References, External Documentation, and Citations

- Link every referenced repository file using relative markdown links (for example, `[actions/song/create-song.ts](../actions/song/create-song.ts)`).
- Cross-reference internal design wikis and schema definitions directly (for example, `[wiki/3.-Database-Design.md](../wiki/3.-Database-Design.md)`).
- Provide inline citations to official external framework, library, and specification documentation when introducing key infrastructure, middleware, or protocols (for example, linking [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware), [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation), [@supabase/ssr](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RFC 7233 Range Requests](https://datatracker.ietf.org/doc/html/rfc7233)).

## 6. Architectural Rationale Specification

For every entry point, infrastructure pattern, and technical choice, explain the architectural motive:
- **Why is it present?**: What failure mode, runtime limitation, or requirement does it address?
- **Why this specific approach?**: For example, why `proxy.ts` runs on Node.js instead of Edge, why `instrumentation.ts` registers logging sinks on server boot, why storage limits are verified before uploads, or why PostgREST select strings are centralized.
