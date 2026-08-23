# Custom Components: Build Your Own Auth UI

## Quick Reference

| Goal                               | Approach                            | Key API                                   |
| ---------------------------------- | ----------------------------------- | ----------------------------------------- |
| Conditional UI based on auth state | `<Show>` component                  | `when="signed-in"` / `when="signed-out"`  |
| Custom sign-in form                | Compose `<SignIn />` elements       | `<SignIn.Page />`, `<SignIn.ClerkLogo />` |
| Custom user display                | `useUser()` hook                    | `user.fullName`, `user.emailAddresses`    |
| Custom sign-out                    | `useAuth()` hook                    | `signOut()`                               |
| Custom OAuth button                | `<SignIn />` with `strategies` prop | `strategies={['oauth_google']}`           |
| Client-side session check          | `useAuth()` hook                    | `isSignedIn`, `userId`                    |

## `<Show>` Component

The primary way to conditionally render content based on auth state without manual session checks.

```tsx
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

export function Header() {
  return (
    <header>
      <nav>
        <h1>My App</h1>
        <Show when="signed-out">
          <SignInButton mode="modal">Sign In</SignInButton>
          <SignUpButton mode="modal">Sign Up</SignUpButton>
        </Show>
        <Show when="signed-in">
          <span>Welcome!</span>
          <UserButton />
        </Show>
      </nav>
    </header>
  );
}
```

`when` values: `"signed-in"`, `"signed-out"`. No other values accepted.

## Custom Sign-In Page

Compose prebuilt `<SignIn />` sub-components for full control over layout while keeping Clerk's built-in flows (email verification, MFA, password reset).

```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/dashboard"
      >
        <div className="w-full max-w-md space-y-8">
          <SignIn.ClerkLogo />
          <SignIn.Header title="Welcome back" subtitle="Sign in to your account" />
          <SignIn.Steps>
            <SignIn.Step name="start" />
            <SignIn.Step name="forgot-password" />
            <SignIn.Step name="reset-password" />
            <SignIn.Step name="verify" />
            <SignIn.Step name="verifications" />
            <SignIn.Step name="continue" />
            <SignIn.Step name="phone-verifications" />
            <SignIn.Step name="email-code-verifications" />
            <SignIn.Step name="totp-step" />
            <SignIn.Step name="password-verifications" />
            <SignIn.Step name="reset-password-done" />
          </SignIn.Steps>
        </div>
      </SignIn>
    </div>
  );
}
```

## Custom User Display

Use `useUser()` in Client Components to build custom user profiles, avatars, or dashboards.

```tsx
'use client';

import { useUser } from '@clerk/nextjs';

export function UserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <SignInButton mode="modal" />;

  return (
    <div className="flex items-center gap-4">
      <img src={user.imageUrl} alt="Profile" className="w-10 h-10 rounded-full" />
      <div>
        <p className="font-medium">{user.fullName}</p>
        <p className="text-sm text-muted-foreground">
          {user.emailAddresses[0]?.emailAddress}
        </p>
      </div>
    </div>
  );
}
```

## Custom Sign-Out Button

```tsx
'use client';

import { useAuth } from '@clerk/nextjs';

export function SignOutButton({ redirectUrl = '/' }: { redirectUrl?: string }) {
  const { signOut } = useAuth();

  return (
    <button onClick={() => signOut({ redirectUrl })}>
      Sign Out
    </button>
  );
}
```

## Custom OAuth Buttons

Trigger specific OAuth providers from your own UI:

```tsx
import { SignInButton } from '@clerk/nextjs';

export function GoogleLoginButton() {
  return (
    <SignInButton mode="modal" strategies={['oauth_google']}>
      <button className="btn-google">Continue with Google</button>
    </SignInButton>
  );
}

export function GitHubLoginButton() {
  return (
    <SignInButton mode="modal" strategies={['oauth_github']}>
      <button className="btn-github">Continue with GitHub</button>
    </SignInButton>
  );
}
```

Provider names match what you configure in the Clerk Dashboard (e.g., `oauth_google`, `oauth_github`, `oauth_apple`).

## Protected Content with Loading State

```tsx
'use client';

import { useUser } from '@clerk/nextjs';

export function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <SignInButton mode="modal" />;

  return <>{children}</>;
}
```

Usage:

```tsx
<ProtectedContent>
  <Dashboard />
</ProtectedContent>
```

## Common Pitfalls

- **Don't manually check sessions in JSX:** Use `<Show>` instead of `useAuth().isSignedIn ? ... : ...` for cleaner conditional rendering.
- **Don't call `auth()` in Client Components:** It's server-only. Use `useUser()` or `useAuth()` instead.
- **Don't hardcode OAuth provider names:** They must match exactly what's configured in the Clerk Dashboard.
- **Don't skip loading state:** `isLoaded` can be false during initial hydration. Always show a loading fallback.
