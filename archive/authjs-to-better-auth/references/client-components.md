# Client Auth Component Migration

## Auth.js Client

```typescript
import { signIn, signOut, useSession } from "next-auth/react";
```

## Better Auth Client

```typescript
import { authClient } from "@/lib/auth-client";

const { data: session } = authClient.useSession();

await authClient.signIn.email({ email, password });
await authClient.signIn.social({ provider: "github" });
await authClient.signOut();
```

Update `AuthForm` to use `authClient.signIn.email()` and `authClient.signIn.social()`.
