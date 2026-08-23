---
name: trpc-nextjs
description: Use when building, modifying, or debugging tRPC v11 in a Next.js App Router TypeScript app — procedures, routers, middleware, context, superjson, httpBatchLink, streaming SSR prefetch (HydrateClient), TanStack Query v5 client hooks (useTRPC, useSuspenseQuery), mutation, queryOptions/queryFilter invalidation, TRPCError handling, 401/403 gating.
---

# tRPC v11 × Next.js App Router

tRPC v11 + TanStack Query v5: end-to-end typed procedures as the sole data layer — server-prefetched, streamed to suspense client hooks.

## When to Use
- Adding/changing procedures, routers, middleware, or context in a Next.js App Router + TanStack Query v5 app.
- Server Component prefetch, hydration, client query/mutation hooks, invalidation.
- Debugging 401/403/404/500 errors, superjson issues, stale cache.

## When NOT to Use
- Non-Next.js servers (standalone/Express adapters) — server API is the same, transport differs.
- REST/GraphQL data layers, or apps without TanStack Query.
- Pages Router, or the classic `@trpc/react-query` hooks API (`trpc.x.useQuery()`) — this skill documents the v11 TanStack Query options-proxy API.

## Architecture

| File | Role |
|---|---|
| `trpc/init.ts` | `initTRPC.create` + context + procedure tiers |
| `trpc/routers/_app.ts` | composes routers; type-only `AppRouter` |
| `app/api/trpc/[trpc]/route.ts` | `fetchRequestHandler` GET/POST |
| `trpc/query-client.ts` | `makeQueryClient()` (30s stale, superjson) |
| `trpc/server.tsx` | server-only; options proxy, `prefetch`, `HydrateClient` |
| `trpc/client.tsx` | `'use client'` provider + `httpBatchLink` |
| `features/<d>/server/*` | domain router + prefetch helpers |
| `features/<d>/hooks/*` | client hooks via `useTRPC()` |

**Lifecycle:** SC → `requireAuth()` → `prefetch()` (fire-and-forget) → `<HydrateClient><Suspense>` → `useSuspenseQuery` → miss → `httpBatchLink` → `/api/trpc` → middleware (401/403) → Prisma scoped `userId: ctx.auth.user.id` → superjson.

## Quick Reference

| Topic | File |
|---|---|
| init, context, tiers, transport | `setup.md` |
| routers, procedures, zod inputs, ownership, TRPCError | `procedures.md` |
| prefetch, streaming SSR, `cache()` | `server-components.md` |
| client hooks, suspense, invalidation | `client-hooks.md` |
| docs, versions, migration | `references.md` |

## Core Conventions

1. **Scope every query** with `userId: ctx.auth.user.id`. Never read `ctx.userId` — the context returns a hardcoded `user_123` stub.
2. **Never gate read/status queries with `premiumProcedure`** — only create mutations.
3. **superjson on both sides**: `initTRPC.create({ transformer: superjson })` AND `httpBatchLink({ transformer: superjson })`.
4. `AppRouter` is a **type-only** export from `trpc/routers/_app.ts` (`export type AppRouter = typeof appRouter`) so server code never ships to the client; `trpc/server.tsx` has `import "server-only"`.
5. `getQueryClient = cache(makeQueryClient)` — one QueryClient per request; browser singleton on client.
6. Expected errors → `TRPCError`; raw Prisma errors (P2025) surface as 500.
7. No `createCaller` inside procedures (recursion); module-level `caller` in `server.tsx` is fine.
8. `initTRPC.create` once; export helpers (`createTRPCRouter`, builders), never `t`.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Reading `ctx.userId` stub | `ctx.auth.user.id` |
| `premiumProcedure` on status queries | `protectedProcedure` |
| `await prefetch(...)` | fire-and-forget (enables streaming) |
| `useUtils().x.invalidate()` (v10 API) | `queryClient.invalidateQueries(trpc.x.queryFilter(...))` |
| P2025 → 500 | wrap in `TRPCError` `NOT_FOUND` |
