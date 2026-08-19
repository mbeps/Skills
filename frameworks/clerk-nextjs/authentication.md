# Authentication: Sign-In, Sign-Up, Sessions, OAuth

## Quick Reference

| Flow                  | Component / Hook             | Server Equivalent                 |
| --------------------- | ---------------------------- | --------------------------------- |
| Sign-in form          | `<SignIn />`                 | —                                 |
| Sign-up form          | `<SignUp />`                 | —                                 |
| User profile          | `<UserProfile />`            | —                                 |
| Sign-out              | `signOut()` hook             | `await auth().sessionToken` check |
| Current user (client) | `useUser()`                  | `await currentUser()`             |
| Auth state (client)   | `useAuth()`                  | `await auth()`                    |
| Session token         | `getToken()`                 | `auth().sessionToken`             |
| OAuth provider        | `<SignIn />` `strategy` prop | Backend API / webhooks            |

## Prebuilt Components

### `<SignIn />`

Full sign-in flow with email, password, OAuth, passkeys, and MFA built in.

```tsx
import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return <SignIn path="/sign-in" signUpUrl="/sign-up" />;
}
```

Props: `path`, `signUpUrl`, `afterSignInUrl`, `afterSignUpUrl`, `routing`, `redirectUrl`.

### `<SignUp />`

Full sign-up flow with registration, email verification, and optional OAuth/passkeys.

```tsx
import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return <SignUp path="/sign-up" afterSignInUrl="/dashboard" />;
}
```

### `<UserButton />`

Dropdown menu with account management: profile, organizations, sign out.

```tsx
import { UserButton } from '@clerk/nextjs';

<UserButton afterSignOutUrl="/" />
```

### `<Show>`

Conditional rendering based on auth state. Replaces manual session checks in JSX.

```tsx
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

<header>
  <Show when="signed-out">
    <SignInButton mode="modal">Sign In</SignInButton>
    <SignUpButton mode="modal">Sign Up</SignUpButton>
  </Show>
  <Show when="signed-in">
    <UserButton />
  </Show>
</header>
```

`when` values: `"signed-in"`, `"signed-out"`. No other values accepted.

## Client Hooks

### `useUser()`

Returns the current user object. Suspends in Server Components.

```tsx
'use client';
import { useUser } from '@clerk/nextjs';

export function UserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return null;

  return (
    <div>
      <h1>{user.fullName}</h1>
      <p>{user.emailAddresses[0]?.emailAddress}</p>
    </div>
  );
}
```

Properties: `isLoaded`, `isSignedIn`, `user` (with `id`, `fullName`, `emailAddresses`, `imageUrl`, etc.).

### `useAuth()`

Returns auth state without the full user object. Lighter than `useUser()`.

```tsx
import { useAuth } from '@clerk/nextjs';

export function ProtectedContent() {
  const { isSignedIn, userId, sessionId } = useAuth();

  if (!isSignedIn) return <SignInButton />;

  return <div>User ID: {userId}</div>;
}
```

Properties: `isSignedIn`, `userId`, `sessionId`, `orgId`, `orgRole`, `orgSlug`.

### `getToken()`

Get a JWT token for API calls. Use within `useAuth()` or via `useClerk()`.

```tsx
import { useAuth } from '@clerk/nextjs';

export function ApiClient() {
  const { getToken } = useAuth();

  const fetchData = async () => {
    const token = await getToken({ template: 'api' }); // optional template
    const res = await fetch('/api/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  };

  return <button onClick={fetchData}>Fetch Data</button>;
}
```

## Sign-Out

```tsx
import { useAuth } from '@clerk/nextjs';

export function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <button onClick={() => signOut({ redirectUrl: '/' })}>
      Sign Out
    </button>
  );
}
```

## OAuth Setup

Prebuilt `<SignIn />` and `<SignUp />` components handle OAuth flows automatically when providers are configured in the Clerk Dashboard. No code changes needed — just enable providers in dashboard → OAuth providers.

To set a specific OAuth strategy as default:

```tsx
<SignIn routing="hash" strategies={['oauth_google']} />
```

## Session Model

- Clerk manages sessions via cookies (httpOnly, secure in production).
- `clerkMiddleware()` reads the session cookie and injects context for `auth()`.
- Sessions auto-refresh. No manual refresh logic needed in most cases.
- Session duration configurable in Clerk Dashboard → Settings → Sessions.

## Common Pitfalls

- **Don't call `auth()` without `await`:** It's async. Always `const { userId } = await auth()`.
- **Don't use `useUser()` in Server Components:** Use `await currentUser()` instead. `useUser()` is client-only.
- **Don't hardcode redirect URLs:** Use `afterSignInUrl` props or configure in Clerk Dashboard.
- **Don't expose `CLERK_SECRET_KEY` client-side:** It only goes in `.env.local` and server code.
