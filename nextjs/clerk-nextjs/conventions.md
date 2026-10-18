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

### ❌ Unguarded `res.json()` on Client Auth Submissions

```tsx
// BAD - crashes with SyntaxError: Unexpected end of JSON input on 500/504 errors
const res = await fetch("/api/oauth/consent", { method: "POST", body: JSON.stringify(data) });
const json = await res.json();

// GOOD - verify res.ok and catch parsing failures gracefully
const res = await fetch("/api/oauth/consent", { method: "POST", body: JSON.stringify(data) });
let json: { error?: string; error_description?: string; redirect_url?: string } = {};
try {
  json = await res.json();
} catch {
  // Edge proxies or 500/504 gateways may return non-JSON or empty bodies
}

if (!res.ok) {
  toast.error(json.error_description || json.error || `Server error (${res.status})`);
  return;
}
```

### ❌ Uncaught `auth()` in Custom API & OAuth Routes

```ts
// BAD - throws unhandled exception if middleware is bypassed or proxy.ts is missing
export async function POST(req: Request) {
  const { userId } = await auth(); // throws uncaught error -> empty 500
}

// GOOD - wrap in try/catch to return structured 401 JSON
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  } catch {
    return Response.json(
      { error: "unauthorized", error_description: "Unable to verify authentication session" },
      { status: 401 }
    );
  }
}
```

## Debugging Checklist

When something isn't working:

1. **Is `clerkMiddleware()` configured?** Next.js 16+ requires `proxy.ts` (not `middleware.ts`). If missing, `auth()` throws `Error: Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware()`.
2. **Are API routes crashing with 500?** Wrap `await auth()` in a `try/catch` to convert middleware detection errors into 401 responses.
3. **Are client components throwing `Unexpected end of JSON input`?** Wrap `res.json()` in a `try/catch` and check `res.ok`.
4. **Is Convex Cloud rejecting deployment?** Ensure `convex/auth.config.ts` uses `type: "customJwt"`, `jwks` (NOT `jwksUri`), `algorithm: "RS256"`, and is typed with `AuthConfig`.
5. **Are env vars set?** Verify `.env.local` has both `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
6. **Is `ClerkProvider` in the right place?** Must be inside `<body>`, not wrapping `<html>`.
7. **Are you using the right helper for the context?** Server → `auth()`/`currentUser()`, Client → `useUser()`/`useAuth()`.
8. **Did you run `clerk doctor`?** `npx -y clerk@latest doctor` catches most config issues.
9. **Is the matcher excluding what it should?** Static files and webhook endpoints should be skipped.
10. **Check browser console:** Clerk components log initialization errors with actionable messages.

## Upgrade Notes

- **Next.js 16+:** Use `proxy.ts` instead of `middleware.ts`.
- **Core 3+:** Minimum Next.js version is 15.2.3. Next.js 13 and 14 are no longer supported.
- **Prebuilt components:** Legacy props like `afterSignInUrl` on individual buttons are deprecated. Configure via `<ClerkProvider>` or component-level props instead.
- **`createRouteMatcher()` removed:** Use `config.matcher` patterns directly in middleware.
