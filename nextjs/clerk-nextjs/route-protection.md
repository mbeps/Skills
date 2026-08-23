# Route Protection: Middleware Configs, Public Paths

## Quick Reference

| Pattern           | Approach                          | Use Case                                        |
| ----------------- | --------------------------------- | ----------------------------------------------- |
| Global protect    | `clerkMiddleware()` with matcher  | Protect all routes except static/public         |
| Public paths      | Skip list in matcher regex        | Allow unauthenticated access to specific routes |
| Signed-in only    | `auth()` check in route/component | Soft-protect (redirect if not signed in)        |
| API route protect | `await auth()` per handler        | Per-route API protection                        |

## Middleware Basics

`clerkMiddleware()` runs on every request that matches the `config.matcher`. It reads the session cookie and injects context for `auth()`.

```ts
// middleware.ts (Next.js ≤15) or proxy.ts (Next.js ≥16)
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|md|mp4|webm|png|jpg|jpeg|svg|gif|ico|woff2)).*)',
  ],
};
```

The matcher skips Next.js internals (`_next`) and static file extensions. Everything else is processed by Clerk.

## Public Routes (Unprotected)

Routes NOT matched by `config.matcher` are automatically public — no auth check needed. Common approach: put public pages outside the `app/` route groups that get matched.

To explicitly skip certain paths within the matcher:

```ts
export const config = {
  matcher: [
    // Match all routes EXCEPT:
    '/((?!_next|static|cultures|fonts|favicon.ico|sitemap.xml|robots.txt|api/webhooks).*)',
  ],
];
```

Common paths to exclude:
- `_next/*` — Next.js internals
- `static/*` — Static assets
- `*.png`, `*.jpg`, `*.svg`, etc. — Static files
- `api/webhooks` — Webhook endpoints (verify signature instead, see `webhooks.md`)
- `favicon.ico`, `robots.txt`, `sitemap.xml` — SEO files

## Protected Route Groups

Use Next.js route groups `(auth)` / `(public)` to organize:

```
app/
  (public)/           # Not matched by middleware → public
    page.tsx          # Landing page
  (protected)/        # Matched by middleware → requires auth
    layout.tsx
    page.tsx          # Dashboard
    settings/
      page.tsx
  api/
    data/route.ts     # Protected via auth() in handler
```

## Soft Protection (Redirect in Components)

For routes where you want a gentle redirect rather than middleware-level blocking:

```ts
import { auth, redirectToSignIn } from '@clerk/nextjs/server';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    await redirectToSignIn();
    return null;
  }

  return <Dashboard />;
}
```

## Hard Protection (Middleware Only)

When you want middleware to handle redirects automatically without component-level checks:

```ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware((auth, req) => {
  // Optional: add custom logic
  // e.g., log access, add headers, geo-block
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'], // Match all dynamic routes
};
```

Middleware automatically redirects unsigned-in users to sign-in when accessing protected routes. No extra code needed.

## Custom Sign-In/Sign-Up URLs

By default, Clerk uses its hosted pages. To use your own:

```ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (!userId) {
    // Redirect to your custom sign-in page
    const signInUrl = new URL('/sign-in', req.url);
    return Response.redirect(signInUrl);
  }
});
```

Or configure in `<ClerkProvider>`:

```tsx
<ClerkProvider
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  afterSignInUrl="/dashboard"
  afterSignUpUrl="/dashboard"
>
```

## Common Pitfalls

- **Middleware doesn't protect API routes automatically:** Each Route Handler needs its own `await auth()` call.
- **Matcher too broad:** Including static files in matcher slows down every request. Be specific about what to skip.
- **Matcher too narrow:** Forgetting to include dynamic routes means those routes aren't protected.
- **Don't remove `clerkMiddleware()` entirely:** Even if you handle auth in components, middleware is required for Clerk to work correctly.
- **Webhook endpoints must be excluded:** Don't let `clerkMiddleware()` process webhook routes — verify signatures manually instead.
