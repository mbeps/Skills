---
name: authjs-to-better-auth-migration
description: Use when migrating a Next.js app from Auth.js (NextAuth) v5 to Better Auth, including adapter changes, session/user model updates, middleware migration, and server action updates.
---

# Auth.js to Better Auth Migration

## Overview

Migrate authentication from Auth.js (NextAuth) v5 to Better Auth. This covers adapter replacement, session/user model updates, middleware, server actions, and client-side auth components.

## When to Use

- Replacing `next-auth` with `better-auth`
- Updating Prisma adapter from `@auth/prisma-adapter` to `better-auth/adapters/mongodb`
- Changing session/user model names and configurations
- Updating middleware and server actions to use `auth.api.getSession()`

## Migration Steps

1. **Dependencies**: Remove `next-auth`, `@auth/prisma-adapter`, `bcryptjs`. Add `better-auth`.
2. **Schema**: Update `prisma/schema.prisma` to use Better Auth model names (`User`, `Session`, `Account`, `Verification`).
3. **Config**: Create/update `lib/auth.ts` with `betterAuth()` config using `mongodbAdapter`.
4. **API Route**: Replace `app/api/auth/[...nextauth]/route.ts` with `app/api/auth/[...all]/route.ts` using `toNextJsHandler`.
5. **Middleware**: Update `middleware.ts` to use `auth.api.getSession()`.
6. **Server Actions**: Update `getCurrentUser`, `getSession` to use `auth.api.getSession()`.
7. **Client**: Update `AuthForm` and providers to use `authClient` from `better-auth/react`.

## Quick Reference

| Component | Auth.js | Better Auth |
|---|---|---|
| Adapter | `@auth/prisma-adapter` | `better-auth/adapters/mongodb` |
| Config | `auth()` with adapter | `betterAuth()` with adapter |
| Session | `auth()` / `useSession()` | `auth.api.getSession()` / `authClient.useSession()` |
| Sign In | `signIn()` | `authClient.signIn.email()` / `.social()` |

## Common Mistakes

- Forgetting to add `directConnection=true` to MongoDB URL when connecting from host.
- Not updating `prisma/schema.prisma` model names to match Better Auth (`Verification` vs `VerificationToken`).
- Using `await headers()` incorrectly in middleware (should be `headers()` from `next/headers`).

## Core Pattern

Replace adapter-based session management with native Better Auth adapter. Update all server actions to use `auth.api.getSession({ headers })`. Update client components to use `authClient`.

## References

- [Better Auth Docs](https://www.better-auth.com/docs)
- [Auth.js Docs](https://authjs.dev/)
- See `references/` for adapter config, model mapping, and middleware patterns.
