# Adapter Configuration Reference

## Auth.js (NextAuth) Adapter

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const adapter = PrismaAdapter(prisma);
```

Requires `prisma/schema.prisma` with `Account`, `Session`, `User`, `VerificationToken` models.

## Better Auth MongoDB Adapter

```typescript
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { db, mongoClient } from "@/utils/db/client";

const adapter = mongodbAdapter(db, {
  client: mongoClient,
  usePlural: false,
  transaction: true,
});
```

Requires `User`, `Session`, `Account`, `Verification` models in MongoDB.
