# References: docs, versions, v10→v11 migration

## Docs (all verified live 2026-08-20, banner "Version: 11.x")

| Topic                      | URL                                                                |
| -------------------------- | ------------------------------------------------------------------ |
| Quickstart                 | https://trpc.io/docs/quickstart                                    |
| Procedures                 | https://trpc.io/docs/server/procedures                             |
| Routers                    | https://trpc.io/docs/server/routers                                |
| Middlewares                | https://trpc.io/docs/server/middlewares                            |
| Context                    | https://trpc.io/docs/server/context                                |
| Error handling             | https://trpc.io/docs/server/error-handling                         |
| Error formatting           | https://trpc.io/docs/server/error-formatting                       |
| Data transformers          | https://trpc.io/docs/server/data-transformers                      |
| Server-side calls          | https://trpc.io/docs/server/server-side-calls                      |
| Authorization              | https://trpc.io/docs/server/authorization                          |
| Fetch adapter              | https://trpc.io/docs/server/adapters/fetch                         |
| httpBatchLink              | https://trpc.io/docs/client/links/httpBatchLink                    |
| TanStack setup             | https://trpc.io/docs/client/tanstack-react-query/setup             |
| TanStack usage             | https://trpc.io/docs/client/tanstack-react-query/usage             |
| TanStack server components | https://trpc.io/docs/client/tanstack-react-query/server-components |
| TanStack migrating         | https://trpc.io/docs/client/tanstack-react-query/migrating         |
| App Router setup           | https://trpc.io/docs/client/nextjs/app-router-setup                |
| v10 → v11 migration        | https://trpc.io/docs/migrate-from-v10-to-v11                       |

⚠️ `/client/tanstack-react-query/mutations` is a **404** — mutations are covered under `/usage`.

## Version facts (repo `package.json` + docs)

| Package                      | Version                         | Notes                                                                                              |
| ---------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@trpc/server`               | `^11.17.0`                      | `TRPCError`, `initTRPC`, adapters                                                                  |
| `@trpc/client`               | `^11.17.0`                      | `createTRPCClient`, `httpBatchLink`, `TRPCClientError`                                             |
| `@trpc/tanstack-react-query` | `^11.17.0`                      | `createTRPCContext` factory, `useTRPC`, `createTRPCOptionsProxy`, `inferInput`, `TRPCQueryOptions` |
| `@tanstack/react-query`      | `^5.100.10`                     | peer dep for the TanStack integration                                                              |
| `superjson`                  | `^2.2.6`                        | transformer on server init + links                                                                 |
| `zod`                        | `^4.4.3`                        | `z.nativeEnum`, `.extend()`                                                                        |
| `next` / `react`             | `^16.2.6` / `^19.2.6`           | App Router, RSC                                                                                    |
| TypeScript                   | `^5` (docs require **≥ 5.7.2**) | peer requirement since v11                                                                         |

## v10 → v11 migration highlights

| v10                          | v11                                                                     |
| ---------------------------- | ----------------------------------------------------------------------- |
| `transformer` in client init | `transformer` on each link: `httpBatchLink({ transformer: superjson })` |
| `@tanstack/react-query` v4   | v5 peer dep — `isLoading` → `isPending`                                 |
| `createTRPCProxyClient`      | `createTRPCClient` (proxy name deprecated)                              |
| `trpc.x.useQuery()`          | `useQuery(trpc.x.queryOptions())`                                       |
| `useUtils().x.invalidate()`  | `queryClient.invalidateQueries(trpc.x.queryFilter(...))`                |
| `initTRPC.create()` once     | same — export helpers, never `t`                                        |

## Gotchas

- **`createTRPCContext` name collision**: the server's context-creator function (`trpc/init.ts`) and the client factory from `@trpc/tanstack-react-query` share a name but are unrelated. Keep them in separate files.
- **`getHTTPStatusCodeFromError`** lives in `@trpc/server/http` — maps a `TRPCError` to its HTTP status (e.g. 401/403/404).
- **Error shape**: server errors arrive as `{ message, code (JSON-RPC), data: { code, httpStatus, stack?, path } }`. Stack traces are included only when `isDev` (default `NODE_ENV !== "production"`; override via `initTRPC.create({ isDev })`). Client side, check `error.data?.code` — the string code — not the numeric JSON-RPC `error.code`.
- **Error formatting**: customize the wire shape with `errorFormatter` on `initTRPC.create`; the default `shape` preserves `message`, `code`, `stack` (dev), `path`.
- **Inputless procedures**: `.query(() => ...)` / `.mutation(({ ctx }) => ...)` with no `.input()` are valid; client side call with `queryOptions()` / `mutationOptions()` (zero args).

## Related skills

- **better-auth-nextjs** — session handling behind `protectedProcedure` (`auth.api.getSession`, `requireAuth`).
- **prisma-nextjs** — ownership scoping in Prisma queries, `findUniqueOrThrow` vs `findUnique`.
- **drizzle-nextjs** — if the data layer is Drizzle instead of Prisma (same procedure patterns, different client).
