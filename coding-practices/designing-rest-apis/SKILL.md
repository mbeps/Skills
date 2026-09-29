---
name: designing-rest-apis
description: Use when designing, reviewing, or refactoring RESTful HTTP APIs, resource paths, HTTP verbs, status codes, error payloads, query parameters, or versioning schemes.
---

# Designing REST APIs

## Overview

A robust REST API uses uniform HTTP semantics, resource-oriented paths, and predictable schemas to reduce client integration effort and eliminate ambiguity.

## When to Use

- Designing new HTTP API endpoints, services, or contracts
- Refactoring legacy or RPC endpoints into standard RESTful resources
- Establishing organisation-wide API conventions (naming, pagination, filtering, errors)
- Reviewing API pull requests or OpenAPI / Swagger specifications

**When NOT to use:**
- Designing GraphQL schemas (graph traversal, custom queries/mutations)
- Building pure streaming / RPC architectures (gRPC, WebSockets, Kafka event schemas)

## Core Principles & Quick Reference

| Principle | Correct Pattern | Anti-Pattern |
| :--- | :--- | :--- |
| **Resource Nouns** | `/orders`, `/orders/{id}` | `/getOrder`, `/createOrder`, `/deleteOrder` |
| **HTTP Semantics** | `GET` (Safe), `POST` (Create), `PUT` (Replace), `PATCH` (Partial), `DELETE` (Remove) | `POST /updateOrder`, `GET /orders?action=delete` |
| **Status Codes** | True HTTP status (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `429`) | `200 OK` with `{ "error": "Not found" }` |
| **Error Shape** | RFC 9457 structured JSON with machine code and field details | Plain string errors or unstructured arbitrary payloads |
| **Path vs Query** | Path identifies resources; Query filters, sorts, and paginates | `/orders/status/shipped/sort/desc` |
| **Idempotency** | Repeatable `GET`, `PUT`, `DELETE`; `Idempotency-Key` header for `POST` | Unprotected non-idempotent `POST` retries |
| **Evolution** | Additive backward-compatible changes; URL/Header versioning for breaking shifts | Modifying or removing active fields without deprecation |

## Detailed References

For comprehensive guidelines, inspect the reference documents:
- **`references/resource-naming-and-routing.md`**: URL design, plural nouns, nested relations, path vs query separation.
- **`references/http-methods-and-status-codes.md`**: Verb semantics, safety, idempotency guarantees, complete HTTP status code matrix.
- **`references/error-handling-and-rfc9457.md`**: Consistent error envelopes, RFC 9457 Problem Details standard, validation failure arrays.
- **`references/pagination-filtering-and-sorting.md`**: Query parameter conventions, offset vs cursor pagination, search and sorting syntax.
- **`references/versioning-and-evolution.md`**: URL vs header versioning, additive evolution rules, deprecation lifecycles.

## Implementation Checklist

- [ ] Plural nouns used for resource collections (e.g. `/users`, `/reports`).
- [ ] No verbs in URIs.
- [ ] Correct HTTP method selected matching safety and idempotency requirements.
- [ ] Idempotency-Key header supported for payment or mission-critical `POST` creation requests.
- [ ] Meaningful HTTP status codes returned (errors never return `200 OK`).
- [ ] Structured, predictable error JSON schema used across every endpoint.
- [ ] Query parameters handle optional parameters (filter, sort, search, page).
- [ ] Consistent payload formatting (casing standard, ISO 8601 UTC dates).
- [ ] Breaking changes protected by a clear versioning strategy.
