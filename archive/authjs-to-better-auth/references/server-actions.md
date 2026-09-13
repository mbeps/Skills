# Server Action Migration

## Auth.js Pattern

```typescript
import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}
```

## Better Auth Pattern

```typescript
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user;
}
```
