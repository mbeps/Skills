# Server Components: auth(), currentUser(), Route Handlers

## Quick Reference

| Context                                          | Helper                                  | Returns                                       |
| ------------------------------------------------ | --------------------------------------- | --------------------------------------------- |
| Server Component / Route Handler / Server Action | `await auth()`                          | Auth object (userId, sessionId, sessionToken) |
| Server Component / Route Handler / Server Action | `await currentUser()`                   | User object or null                           |
| Server Component / Route Handler / Server Action | `await currentUser().getSessionToken()` | JWT token (same as `auth().sessionToken`)     |
| Route Handler (GET/POST)                         | `await auth()` at top of handler        | Protects entire route                         |

## The `auth()` Helper

Returns the `Auth` object with current session data. **Always async.** Requires `clerkMiddleware()` to be configured.

```ts
import { auth } from '@clerk/nextjs/server';

// In a Server Component:
export default async function Page() {
  const { userId } = await auth();

  if (!userId) return <SignInButton />;

  return <div>Welcome, user {userId}</div>;
}

// In a Route Handler:
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ userId });
}

// In a Server Action:
'use server';
import { auth } from '@clerk/nextjs/server';

export async function myServerAction() {
  const { userId } = await auth();

  if (!userId) throw new Error('Not authenticated');

  // ... do work
}
```

### Auth Object Properties

| Property        | Type             | Description                          |
| --------------- | ---------------- | ------------------------------------ |
| `userId`        | `string \| null` | Clerk user ID                        |
| `sessionId`     | `string \| null` | Current session ID                   |
| `sessionClaims` | `object \| null` | JWT claims (custom claims, org info) |
| `sessionToken`  | `string \| null` | Raw JWT token                        |
| `toJSON()`      | `object`         | Serializable representation          |

## The `currentUser()` Helper

Returns the full user object or `null`. Equivalent to `auth().then(auth => auth.userId ? getUserById(auth.userId) : null)`.

```ts
import { currentUser } from '@clerk/nextjs/server';

export default async function Page() {
  const user = await currentUser();

  if (!user) return <SignInButton />;

  return (
    <div>
      <h1>{user.fullName}</h1>
      <p>{user.emailAddresses[0]?.emailAddress}</p>
    </div>
  );
}
```

### User Object Properties

| Property          | Type             | Description               |
| ----------------- | ---------------- | ------------------------- |
| `id`              | `string`         | Clerk user ID             |
| `fullName`        | `string \| null` | Full name                 |
| `firstName`       | `string \| null` | First name                |
| `lastName`        | `string \| null` | Last name                 |
| `emailAddresses`  | `Array`          | Email addresses           |
| `imageUrl`        | `string`         | Profile image URL         |
| `username`        | `string \| null` | Username                  |
| `publicMetadata`  | `object`         | Custom user metadata      |
| `privateMetadata` | `object`         | Private user metadata     |
| `unsafeMetadata`  | `object`         | Unvalidated user metadata |

## Route Handler Protection Pattern

Protect API routes by calling `auth()` at the top of each HTTP method handler:

```ts
// app/api/data/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Protected logic here
  return NextResponse.json({ data: 'secret' });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // Create logic here
  return NextResponse.json({ created: true });
}
```

## Server Action Pattern

```ts
// app/actions.ts
'use server';

import { auth } from '@clerk/nextjs/server';

export async function createDocument(data: { title: string }) {
  const { userId } = await auth();

  if (!userId) {
    return { error: 'Not authenticated' };
  }

  // Create document for userId
  return { success: true, id: 'doc_123' };
}
```

## Redirect Helpers

```ts
import { auth, redirectToSignIn } from '@clerk/nextjs/server';

export default async function Page() {
  const { userId } = await auth();

  if (!userId) {
    await redirectToSignIn();
    return null; // Never reached — redirects above
  }

  return <div>Protected content</div>;
}
```

Note: `redirectToSignIn()` returns a Response in Route Handlers but throws in Server Components. Handle accordingly.

## Common Pitfalls

- **`auth()` is async:** Always `await auth()`. Calling without await returns a Promise, not the auth object.
- **`auth()` requires middleware:** If `clerkMiddleware()` is not configured, `auth()` returns empty values.
- **Don't use `useUser()` in Server Components:** Use `await currentUser()` instead. Hooks don't work outside Client Components.
- **Route Handlers need per-method checks:** Each `GET`/`POST`/etc. handler needs its own `await auth()` call. Middleware does not protect API routes automatically.
- **`redirectToSignIn()` behavior differs:** In Server Components it throws (use try/catch or check `userId` first). In Route Handlers it returns a Response.
