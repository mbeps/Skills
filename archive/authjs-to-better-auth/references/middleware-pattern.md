# Middleware Migration

## Auth.js Middleware

```typescript
import { auth } from "@/auth";

export default auth((req) => {
  // Protect routes
});
```

## Better Auth Middleware

```typescript
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default auth(async (req) => {
  const session = await auth.api.getSession({ headers: await headers() });
  // Protect routes based on session
});
```

Note: Better Auth uses `auth.api.getSession()` with `headers()` from `next/headers`.
