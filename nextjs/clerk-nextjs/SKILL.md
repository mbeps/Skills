---
name: clerk-nextjs
description: Use when building, modifying, or debugging a Clerk-authenticated Next.js TypeScript app — setup via CLI, middleware, auth() / currentUser() helpers, client hooks (useUser, useAuth), route protection, prebuilt components (SignIn, SignUp, UserButton, Show), custom component composition, organizations, webhooks, shadcn/ui theming. Covers App Router only (Next.js 15+).
---

# Clerk + Next.js (TypeScript, App Router)

## Overview

This skill covers the Clerk × Next.js overlap: CLI setup, middleware, server-side auth helpers, client hooks, route protection, prebuilt and custom components, organizations, webhooks, and conventions that keep Clerk safe in the App Router. Core principle: **`clerkMiddleware()` injects session context; `await auth()` reads it server-side; never expose `CLERK_SECRET_KEY`; client code uses `useUser()`/`useAuth()` from injected context.**

## When to Use

Use when:
- Setting up Clerk in a Next.js (App Router, TypeScript) project.
- Adding sign-in, sign-up, user profile, or sign-out flows.
- Protecting routes with `clerkMiddleware()` or checking `auth()` in Server Components / Route Handlers / Server Actions.
- Using prebuilt components (`<SignIn />`, `<SignUp />`, `<UserButton />`, `<Show>`) or composing custom auth UI.
- Working with organizations (`has()`, `orgId`, `<OrganizationSwitcher />`).
- Configuring webhooks for user lifecycle events.
- Debugging `clerk_offline`, RLS/session-refresh, or redirect issues.
- Theming Clerk UI components with shadcn/ui via `@clerk/ui`.

**When NOT to use:** Pages Router projects; non-Next.js frameworks; pure backend Clerk work without Next.js integration.

## Quick Reference

| Topic | File | First thing to read |
|---|---|---|
| Setup: CLI, env vars, middleware, providers | `setup.md` | Critical rules + file naming |
| Auth flows: sign-in, sign-up, sessions, OAuth | `authentication.md` | Session model + identity checks |
| Server components: auth(), currentUser(), route handlers | `server-components.md` | `await auth()` pattern |
| Route protection: middleware configs, public paths | `route-protection.md` | `clerkMiddleware()` matcher behavior |
| Custom components: build your own auth UI | `custom-components.md` | `<Show>` + `useUser()` pattern |
| Organizations: multi-tenant patterns | `organizations.md` | `has()` guard + org roles |
| Webhooks: user lifecycle sync | `webhooks.md` | Event types + endpoint setup |
| Conventions: env, clients, actions, pitfalls | `conventions.md` | Secret key rule + auth boundary |

## Core Conventions

- **CLI-first setup:** Run `npx -y clerk@latest init` — do not hand-write setup unless it fails.
- **Middleware file naming:** `proxy.ts` on Next.js 16+, `middleware.ts` on 15 and below. Contents are identical.
- **Server auth is async:** Always `await auth()`. Never call `auth()` without `await`.
- **Secret key never leaves the server:** `CLERK_SECRET_KEY` goes in `.env.local` only. Never import it client-side.
- **`ClerkProvider` inside `<body>`:** Not wrapping `<html>`. Goes in root `layout.tsx`.
- **Use `@clerk/nextjs`, not `@clerk/clerk-react`:** The Next.js package bundles framework-specific logic.
- **Prebuilt components over custom when possible:** `<SignIn />`, `<SignUp />`, `<UserButton />` handle edge cases (email verification, password reset, MFA, passkeys).
- **`<Show>` for conditional rendering:** Use `<Show when="signed-in">` / `<Show when="signed-out">` instead of manual session checks in JSX.
- **Organizations:** Check membership with `has()` before accessing `orgId`. Never assume an org exists.
- **Middleware protects pages, NOT API routes:** Each Route Handler needs its own `await auth()` check. Middleware only intercepts page requests; direct API calls bypass it.
- **Clerk authenticates, it does not replace database-level access control:** RLS / ownership checks still needed for your data layer.
- **OAuth providers configured in Dashboard, not code:** Enable providers in Clerk Dashboard → OAuth settings. No code change needed.
- **Clerk handles rate limiting:** Do not add redundant rate limiting on auth endpoints.
- **Always type user data:** Clerk exports full TypeScript types (`User`, `Session`, etc.). Never use `any`.

## Files

- **REQUIRED READING:** `setup.md` — CLI workflow, env vars, middleware, provider wiring.
- **REQUIRED READING:** `conventions.md` — secret key rule, auth boundary, common pitfalls.
