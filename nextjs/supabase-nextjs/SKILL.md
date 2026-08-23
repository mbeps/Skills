---
name: supabase-nextjs
description: Use when building, modifying, or debugging a Supabase-backed Next.js TypeScript app — Supabase auth (email/password, OAuth, passkeys, sessions), database schema and RLS policies, storage, realtime, edge functions, generating TypeScript database types, writing migrations or seed data, or local development with the Supabase CLI.
---

# Supabase + Next.js (TypeScript)

## Overview

This skill covers the Supabase × Next.js overlap: auth, database schema + RLS, storage, realtime, edge functions, CLI workflow, and the conventions that keep Supabase safe in the App Router. Core principle: **auth state lives in cookies; all data access goes through typed Server Actions; RLS is the security backstop; never trust the browser or `getSession()` server-side.**

## When to Use

Use when:
- Building or modifying a Supabase-backed Next.js (App Router, TypeScript) app.
- Adding Supabase auth: email/password, OAuth, passkeys, sessions.
- Writing RLS policies, schema SQL, migrations, or seed data.
- Working with storage buckets, uploads, or signed URLs.
- Setting up realtime channels or postgres-changes subscriptions.
- Writing or deploying Deno edge functions.
- Generating TypeScript database types.
- Developing locally with the `supabase` CLI.
- Debugging `PGRST116` / `23505` / `429` errors or session-refresh issues.

**When NOT to use:** pure Next.js work without Supabase; non-Next.js Supabase clients (plain Node/Express).

## Quick Reference

| Topic | File | First thing to read |
|---|---|---|
| Auth: sessions, OAuth, passkeys, authz | `authentication.md` | Session model + identity checks |
| Database & RLS: schema, migrations, types | `database.md` | RLS policies + grants |
| Storage: buckets, uploads, signed URLs | `storage.md` | Public vs private + store paths |
| Realtime: channels, presence, pg changes | `realtime.md` | Publications + RLS enforcement |
| Edge Functions: Deno, CORS, secrets | `edge-functions.md` | `withSupabase` scaffold |
| CLI & local dev: stack, migrations | `cli.md` | Migration workflow |
| Conventions: env, clients, actions | `conventions.md` | Three-client rule + action boundary |

## Core Conventions

- Three clients, one per context (browser / server / proxy), typed with the generated `Database` generic.
- Server Actions are the only data-access boundary; return result unions, never throw.
- Always `getUser()` (or `getClaims()`) server-side — never trust `getSession()`.
- RLS on every table; ownership via `auth.uid()`; SECURITY DEFINER helpers for privileged paths.
- Store storage **paths**, not URLs; resolve with `getPublicUrl()`.
- Validate env at module load; `NEXT_PUBLIC_` only for client-safe values; the secret key never reaches the browser.

## Files

- **REQUIRED READING:** `authentication.md` — auth flows, SSR clients, sessions, authorization, route protection.
- **REQUIRED READING:** `database.md` — schema, RLS, security definer, migrations, types, seeds, errors.
- **REQUIRED READING:** `storage.md` — buckets, storage RLS, signed URLs, uploads, cleanup.
- **REQUIRED READING:** `realtime.md` — channels, broadcast, presence, postgres changes.
- **REQUIRED READING:** `edge-functions.md` — Deno, deployment, secrets, invocation, CORS.
- **REQUIRED READING:** `cli.md` — local stack, migrations, type gen, seeds, `config.toml`.
- **REQUIRED READING:** `conventions.md` — env, clients, action boundary, serialization, what NOT to do.

## Common Mistakes

- Trusting `getSession()` server-side (see `authentication.md`).
- Service-role key in the browser (see `conventions.md`).
- Untyped clients or handwritten schema mirrors (see `database.md`).
- Storing storage URLs instead of paths (see `storage.md`).
- Throwing across the server-action boundary (see `conventions.md`).
- Skipping `revalidatePath` after mutations (see `conventions.md`).

Official docs: [Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) · [Creating a client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) · [Supabase CLI](https://supabase.com/docs/guides/cli)
