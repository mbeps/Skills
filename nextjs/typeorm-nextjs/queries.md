# Queries: Runtime Architecture, Repositories, Transactions & Caching

## 1. The "Dual-Import" Isolation Pattern (Server Components vs Server Actions)

### The Problem in Next.js App Router
When a file containing `'use server'` is imported by both a **Server Component** (e.g. `app/apps/page.tsx`) and a **Client Component** (e.g. `components/applications/edit-form.tsx`), Next.js Webpack generates separate bundles. In some deployments or during dynamic transitions, Webpack assigns differing action IDs to the RSC chunk vs the Client chunk, causing:
```text
Error: Failed to find Server Action. This is often caused by a mismatched build ID or dual import.
```

### The Architecture Rule
Separate read-only direct database queries from client-facing mutations:

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                       │
└─────────────────────────────────────────────────────────────┘
          │                                         │
          ▼ (Server Component render)               ▼ (Client Component interaction)
┌───────────────────────────────┐         ┌───────────────────────────────┐
│     Direct Query Layer        │         │      Server Action Layer      │
│     `lib/queries/*.ts`        │         │      `actions/**/*.ts`        │
│   ❌ NO 'use server' directive │         │   ✅ HAS 'use server' directive│
└───────────────────────────────┘         └───────────────────────────────┘
          │                                         │
          └────────────────────┬────────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  getDataSource()    │
                    │  TypeORM Repos      │
                    └─────────────────────┘
```

1. **`lib/queries/*.ts` (Direct Queries for Server Components)**:
   - Plain async functions.
   - **Do NOT** include `'use server'`.
   - Imported directly by `page.tsx` or `layout.tsx` for fast zero-overhead SSR data rendering.
2. **`actions/**/*.ts` (Server Actions for Client Components)**:
   - Marked with `'use server'` at top of the file.
   - Used for mutations (form submissions, button clicks) and client-triggered re-fetches.
   - Validate input with Zod and authorize user permissions before executing queries.

---

## 2. Direct Query Implementation (`lib/queries/application-queries.ts`)

```ts
import { getDataSource } from "@/database/data-source";
import { Application } from "@/database/entities/Application.entity";
import { toApplicationData, type ApplicationData } from "@/lib/dto/application-dto"; // Pure DTO helper (no 'use server')
import { createSuccessResponse, createErrorResponse } from "@/lib/api-response-factories";
import type { ApiResponse } from "@/schema/api-response.schema";

/**
 * Direct database query for default applications — used directly in Server Components (page.tsx).
 * NO 'use server' directive here.
 */
export async function queryDefaultApplications(): Promise<ApiResponse<ApplicationData[]>> {
  try {
    const dataSource = await getDataSource();
    const repository = dataSource.getMongoRepository(Application); // or getRepository(Application) for SQL

    const applications = await repository.find({
      where: { default: true },
      order: { applicationName: "ASC" },
    });

    return createSuccessResponse(applications.map(toApplicationData));
  } catch (error) {
    console.error("Failed to query default applications:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Database fetch failed",
      "DATABASE_ERROR"
    );
  }
}
```

---

## 3. Server Action Implementation (`actions/applications/update-application.ts`)

```ts
"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDataSource } from "@/database/data-source";
import { Application } from "@/database/entities/Application.entity";
import { toApplicationData, type ApplicationData } from "@/lib/dto/application-dto";
import { createSuccessResponse, createErrorResponse } from "@/lib/api-response-factories";
import type { ApiResponse } from "@/schema/api-response.schema";

const UpdateApplicationSchema = z.object({
  coriaId: z.string().min(1),
  applicationName: z.string().min(1),
  default: z.boolean().optional(),
});

export async function updateApplicationAction(
  input: z.infer<typeof UpdateApplicationSchema>
): Promise<ApiResponse<ApplicationData>> {
  const parsed = UpdateApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorResponse("Invalid input parameters", "VALIDATION_ERROR");
  }

  try {
    const dataSource = await getDataSource();
    const repository = dataSource.getMongoRepository(Application);

    const existing = await repository.findOne({ where: { coriaId: parsed.data.coriaId } });
    if (!existing) {
      return createErrorResponse("Application not found", "NOT_FOUND");
    }

    existing.applicationName = parsed.data.applicationName;
    if (parsed.data.default !== undefined) {
      existing.default = parsed.data.default;
    }
    existing.updatedAt = new Date();

    const saved = await repository.save(existing);

    // Invalidate Server Component caches
    revalidatePath("/apps");
    revalidateTag("applications");

    return createSuccessResponse(toApplicationData(saved));
  } catch (error) {
    console.error("Failed to update application:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Update failed",
      "MUTATION_ERROR"
    );
  }
}
```

---

## 4. Querying Patterns: Relational (SQL) vs MongoDB

### Relational Database Patterns (PostgreSQL / MySQL)

```ts
const userRepo = dataSource.getRepository(User);

// 1. Basic find with relations and ordering
const users = await userRepo.find({
  where: { active: true },
  relations: { posts: true },
  order: { createdAt: "DESC" },
  take: 20,
  skip: 0,
});

// 2. QueryBuilder for complex joins and aggregations
const activeAuthors = await userRepo
  .createQueryBuilder("user")
  .innerJoinAndSelect("user.posts", "post")
  .where("user.active = :active", { active: true })
  .andWhere("post.published = :published", { published: true })
  .orderBy("user.name", "ASC")
  .getMany();
```

### MongoDB Patterns (`MongoRepository`)

```ts
import { ObjectId } from "mongodb";
const appRepo = dataSource.getMongoRepository(Application);

// 1. Query with MongoDB operators ($or, $in, $ne, $elemMatch)
const matchingApps = await appRepo.find({
  where: {
    $or: [
      { coriaId: { $in: ["CORIA-001", "CORIA-002"] } },
      { applicationStatus: { $ne: "GREEN" } },
    ],
  } as any,
});

// 2. Find by MongoDB ObjectId
const app = await appRepo.findOne({
  where: { _id: new ObjectId("65123456789abcdef0123456") } as any,
});
```

---

## 5. Transactions

Atomic operations across multiple entities must use `dataSource.transaction()`. If any error is thrown inside the callback, TypeORM automatically rolls back the entire transaction.

```ts
export async function transferOwnership(
  sourceUserId: string,
  targetUserId: string,
  postId: string
): Promise<void> {
  const dataSource = await getDataSource();

  await dataSource.transaction(async (transactionalEntityManager) => {
    const postRepo = transactionalEntityManager.getRepository(Post);
    const userRepo = transactionalEntityManager.getRepository(User);

    const post = await postRepo.findOne({ where: { id: postId, authorId: sourceUserId } });
    if (!post) {
      throw new Error("Post not found or unauthorized");
    }

    const targetUser = await userRepo.findOne({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new Error("Target user does not exist");
    }

    post.authorId = targetUserId;
    await postRepo.save(post);
  });
}
```

---

## 6. Caching Strategies

### Option A: Next.js `unstable_cache` with Tags (Recommended for SSR)

```ts
import { unstable_cache } from "next/cache";

export const getCachedApplications = unstable_cache(
  async () => {
    const dataSource = await getDataSource();
    const repo = dataSource.getMongoRepository(Application);
    const apps = await repo.find({ where: { default: true } });
    return apps.map(toApplicationData);
  },
  ["default-applications-cache-key"],
  {
    revalidate: 60, // 60 seconds TTL
    tags: ["applications"],
  }
);
```

### Option B: In-Memory Node.js Cache (For Rapid Polling / Realtime Services)

```ts
let memoryCache: { data: ApplicationData[]; expiresAt: number } | null = null;

export async function getQuickMemoryCachedApplications(): Promise<ApplicationData[]> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.data;
  }

  const dataSource = await getDataSource();
  const repo = dataSource.getMongoRepository(Application);
  const apps = await repo.find();
  const serialized = apps.map(toApplicationData);

  memoryCache = {
    data: serialized,
    expiresAt: now + 5000, // 5-second TTL
  };

  return serialized;
}
```

