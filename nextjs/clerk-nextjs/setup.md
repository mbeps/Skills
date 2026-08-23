# Setup: CLI, Env Vars, Middleware, Provider

## Quick Reference

| Step              | Command/Action               | File                                      |
| ----------------- | ---------------------------- | ----------------------------------------- |
| Install & init    | `npx -y clerk@latest init`   | —                                         |
| Verify setup      | `npx -y clerk@latest doctor` | —                                         |
| Update SDK        | `clerk update --yes`         | —                                         |
| Create middleware | Auto-created by CLI          | `middleware.ts` (≤15) or `proxy.ts` (≥16) |
| Add provider      | Manual if CLI fails          | `app/layout.tsx`                          |

## Critical Rules

- **CLI-first:** Run `npx -y clerk@latest init` before hand-writing anything. It detects framework, package manager, and writes all config.
- **File naming by Next.js version:** Check `package.json` for `"next"` version. Use `proxy.ts` on 16+, `middleware.ts` on 15 and below. Contents are identical.
- **`ClerkProvider` inside `<body>`:** Not wrapping `<html>`.
- **Never expose `CLERK_SECRET_KEY` in client code.** Only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is client-safe.
- **Use `@clerk/nextjs`, not `@clerk/clerk-react`.**

## Environment Variables

```env
# .env.local (never commit)
CLERK_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
```

- `CLERK_SECRET_KEY` — server-only. Used by `auth()` and Backend API calls.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — client-safe. Identifies your Clerk app.
- `CLERK_WEBHOOK_SECRET` — required for webhook verification (see `webhooks.md`).
- `CLERK_DEBUG=1` — set to `true` for verbose Clerk logging in browser console during development.

Do not read or print existing `.env` files. Ask the user for missing non-sensitive values.

### Dashboard Prerequisites

Before any code works:
1. Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Enable desired sign-in methods (email/password, OAuth, passkeys) in Dashboard → Authentication.
3. Copy the API keys into `.env.local`.

The CLI can provision a claimable app in keyless mode, but provider configuration still requires the Dashboard.

## CLI Workflow

### New Project

```bash
npx -y clerk@latest init --framework next --pm npm
```

If directory has a lockfile, match the package manager (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, etc.).

### Existing Project

```bash
npx -y clerk@latest init
```

The CLI installs `@clerk/nextjs`, creates middleware, adds `ClerkProvider`, and wires auth controls into the layout.

### Verify

```bash
npx -y clerk@latest doctor
```

Then start the app and confirm sign-in/sign-up controls are visible.

### Update

```bash
clerk update --yes
```

Or via package runner: `npx -y clerk@latest update --yes`.

## Manual Fallback (only if CLI fails)

### 1. Install

```bash
npm install @clerk/nextjs
```

### 2. Create Middleware

**`middleware.ts`** (Next.js ≤15) or **`proxy.ts`** (Next.js ≥16):

```ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|md|mp4|webm|png|jpg|jpeg|svg|gif|ico|woff2)).*)',
  ],
};
```

### 3. Add Provider

In **`app/layout.tsx`**:

```tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

### 4. Add Auth Controls (in layout or navbar)

```tsx
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';

// In your nav/header component:
<Show when="signed-out">
  <SignInButton />
  <SignUpButton />
</Show>
<Show when="signed-in">
  <UserButton />
</Show>
```

## Redirect URLs

Configure where users land after auth flows:

```tsx
<ClerkProvider
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  afterSignInUrl="/dashboard"
  afterSignUpUrl="/dashboard"
  afterSignOutUrl="/"
>
```

Or set per-component:

```tsx
<SignIn path="/sign-in" afterSignInUrl="/dashboard" signUpUrl="/sign-up" />
<SignUp path="/sign-up" afterSignInUrl="/dashboard" />
<UserButton afterSignOutUrl="/" />
```

Avoid hardcoding redirect URLs in middleware — use component props or `<ClerkProvider>` instead.

## Session Management

- Clerk manages sessions via httpOnly, secure cookies (in production).
- Sessions auto-refresh. No manual refresh logic needed in most cases.
- Session duration is configurable in Clerk Dashboard → Settings → Sessions.
- `clerkMiddleware()` reads the session cookie and injects context for `auth()`.
- Stale sessions are handled automatically by Clerk's cookie rotation.

## shadcn/ui Theming

If `components.json` exists and you want Clerk components styled with your project's theme:

```bash
npm install @clerk/ui
```

In **`app/layout.tsx`**:

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={{ theme: shadcn }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

In global CSS:

```css
@import '@clerk/ui/themes/shadcn.css';
```

## Keyless Mode

The CLI runs keyless by default for unauthenticated users — it provisions a claimable app and writes dev keys to `.env.local`. Sign in later with `npx -y clerk@latest auth login` to claim the app.

Keyless apps remain configurable: `clerk enable orgs` and `clerk config patch` work before claiming. Billing and some auth settings require claiming first.
