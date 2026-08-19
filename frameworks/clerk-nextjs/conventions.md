# Conventions: Env, Clients, Actions, Pitfalls

## Quick Reference

| Rule                 | Do                                                | Don't                            |
| -------------------- | ------------------------------------------------- | -------------------------------- |
| Secret key           | `.env.local` only, server code                    | Import in Client Components      |
| Publishable key      | `NEXT_PUBLIC_` prefix, safe client-side           | Use for server auth              |
| Server auth          | `await auth()` or `await currentUser()`           | `useUser()` in Server Components |
| Client auth          | `useUser()`, `useAuth()`                          | `auth()` in Client Components    |
| Provider placement   | Inside `<body>`                                   | Wrapping `<html>`                |
| Package              | `@clerk/nextjs`                                   | `@clerk/clerk-react`             |
| Middleware file      | `proxy.ts` (Next.js 16+) or `middleware.ts` (≤15) | Both files                       |
| API route protection | `await auth()` per handler                        | Rely on middleware alone         |
| Webhook verification | Svix library + signature check                    | Trust incoming requests          |

## Environment Variable Rules

### Required Variables

```env
# Server-only
CLERK_SECRET_KEY="sk_live_..."

# Client-safe
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."

# Webhooks
CLERK_WEBHOOK_SECRET="whsec_..."
```

### Naming Convention

- `CLERK_*` — server-only secrets (never prefixed with `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_CLERK_*` — client-safe values only

### Validation

Validate env vars at module load in server code:

```ts
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error('CLERK_SECRET_KEY is not set');
}
```

## Three Contexts, Different APIs

| Context          | Auth Helper                            | Hook Available?          |
| ---------------- | -------------------------------------- | ------------------------ |
| Server Component | `await auth()` / `await currentUser()` | No                       |
| Route Handler    | `await auth()` per method              | No                       |
| Server Action    | `await auth()` (with `'use server'`)   | No                       |
| Client Component | —                                      | `useUser()`, `useAuth()` |

**Rule:** If it's a Server Component, Route Handler, or Server Action → use `auth()` or `currentUser()`. If it's a Client Component → use hooks.

## Auth Boundary Pattern

Server Actions are the primary data-access boundary. Always check auth inside the action:

```ts
'use server';

import { auth } from '@clerk/nextjs/server';

export async function createDocument(data: { title: string }) {
  const { userId } = await auth();

  if (!userId) {
    return { error: 'Not authenticated' };
  }

  // ... create document for userId
  return { success: true, id: 'doc_123' };
}
```

Return result unions, never throw errors to the client.

## Common Anti-Patterns

### ❌ Using `any` for User Data

```ts
// BAD - defeats TypeScript entirely
const user = await currentUser() as any;
const email = user.email; // no type safety

// GOOD - use Clerk's exported types
import { currentUser, type User } from '@clerk/nextjs/server';

const user: User | null = await currentUser();
if (!user) return <SignInButton />;
const email = user.emailAddresses[0]?.emailAddress; // typed, safe
```

Clerk exports full TypeScript types (`User`, `Session`, `Organization`, etc.). Always use them.

### ❌ Exposing Secret Key

```ts
// BAD - CLERK_SECRET_KEY in client code
import { CLERK_SECRET_KEY } from '@/config'; // Never do this
```

### ❌ Using @clerk/clerk-react in Next.js

```ts
// BAD
import { useUser } from '@clerk/clerk-react'; // Use @clerk/nextjs instead
```

### ❌ Calling auth() Without Await

```ts
// BAD
const { userId } = auth(); // Returns Promise, not object

// GOOD
const { userId } = await auth();
```

### ❌ Middleware Not Protecting API Routes

```ts
// BAD - assuming middleware protects all routes
// Middleware only handles session injection, not route-level auth checks

// GOOD - explicit check in each handler
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // ...
}
```

### ❌ ClerkProvider Wrapping <html>

```tsx
// BAD
<ClerkProvider>
  <html lang="en">
    <body>{children}</body>
  </html>
</ClerkProvider>

// GOOD
<html lang="en">
  <body>
    <ClerkProvider>
      {children}
    </ClerkProvider>
  </body>
</html>
```

## Debugging Checklist

When something isn't working:

1. **Is `clerkMiddleware()` configured?** Check middleware/proxy file exists and matches correct filename for your Next.js version.
2. **Are env vars set?** Verify `.env.local` has both `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. **Is `ClerkProvider` in the right place?** Must be inside `<body>`, not wrapping `<html>`.
4. **Are you using the right helper for the context?** Server → `auth()`/`currentUser()`, Client → `useUser()`/`useAuth()`.
5. **Did you run `clerk doctor`?** `npx -y clerk@latest doctor` catches most config issues.
6. **Is the matcher excluding what it should?** Static files and webhook endpoints should be skipped.
7. **Check browser console:** Clerk components log initialization errors with actionable messages.

## Upgrade Notes

- **Next.js 16+:** Use `proxy.ts` instead of `middleware.ts`.
- **Core 3+:** Minimum Next.js version is 15.2.3. Next.js 13 and 14 are no longer supported.
- **Prebuilt components:** Legacy props like `afterSignInUrl` on individual buttons are deprecated. Configure via `<ClerkProvider>` or component-level props instead.
- **`createRouteMatcher()` removed:** Use `config.matcher` patterns directly in middleware.
