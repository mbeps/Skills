# Export Rules & Route Files Reference

Export patterns, root special files, and anti-barrel rules in Next.js App Router projects.

## One Export Per File

**Rule:** Each file for **actions, types, interfaces, enums, components, pages, and hooks** must only have **one export**.

- **Internal helpers allowed:** Multiple functions, types, interfaces, or sub-components can reside in the same file as long as they are **not exported** (i.e. strictly private/internal helpers).
- **Exceptions:** Select infrastructure or utility files (e.g. `lib/logger.ts`, client initializers, or configuration registries) are allowed to have multiple exports.

```typescript
// ✅ types/comment/comment.ts
// Unexported internal helper type is allowed
type CommentId = string;

export interface Comment {
  id: CommentId;
  content: string;
}

// ✅ actions/comment/get-comments.ts
// Unexported internal helper function & type are allowed
interface QueryFilter {
  songId: string;
}

function sanitizeFilter(filter: QueryFilter): QueryFilter {
  return { songId: filter.songId.trim() };
}

export default async function getComments(filter: QueryFilter) { ... }

// ❌ NEVER export multiple items from one file
export interface Comment { ... }
export interface CommentWithAuthor { ... }
export interface CommentReply { ... }
```

**Why:** Clear ownership, easier refactoring, predictable imports, and better tree-shaking.

---

## Export Syntax by File Type

| File Type | Export Pattern | Example |
| --- | --- | --- |
| **Server Action** | Single default export | `export default async function getComments()` |
| **Component** | Single default or named | `export default CommentForm` or `export const CommentForm` |
| **Page / Special** | Single default export | `export default function Page()`, `export default function NotFound()` |
| **Type / Interface** | Single named export | `export interface Comment` or `export type AlbumType` |
| **Enum** | Single named export | `export enum CarStatus { ... }` |
| **Schema** | Named export (schema + type) | `export const schema = z.object(...); export type Input = z.infer<...>` |
| **Hook** | Single default export | `export default function usePlayer()` |
| **Store (Zustand)** | Single default export | `export default usePlayerStore;` |
| **Utility / Logger** | Named export(s) (allowed exception) | `export function formatDuration()`, `export function getLogger()` |

---

## Special Route Files (`app/`)

### Root Special Files Requirement
The root of the `./app` directory **must contain**:
- `not-found.tsx` — Global 404 page
- `loading.tsx` — Root suspense loading UI
- `error.tsx` — Root error boundary (`'use client'` required)

### Dynamic Route Not-Found
For dynamic routes (e.g., `app/songs/[id]/`), include a route-level `not-found.tsx`. When `notFound()` from `next/navigation` is called (such as when an entity ID is missing in the database), this route-level component renders to clearly communicate that the specific item does not exist, rather than falling back to an unspecific global 404.

### App Name & Metadata (`app/layout.tsx`)
Always configure the actual project name (centralised via `config/site.ts`) in root layout metadata:

```typescript
import { SITE_CONFIG } from "@/config/site";

export const metadata: Metadata = {
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
};
```

Never use placeholder strings like "Create Next App" or "Next App".

---

## NO Barrel Exports

**Never create `index.ts` files to re-export:**

```typescript
// ❌ types/comment/index.ts
export * from './comment';
export * from './comment-with-author';

// ❌ components/comment/index.ts
export * from './comment-form';
export * from './comment-list';
```

**Why barrel exports are bad:**
1. Breaks tree-shaking (bundles unused code)
2. Circular dependency risks
3. Monorepo incompatibility
4. Hides explicit dependencies
5. Extra maintenance

**Instead:** Import directly from file:

```typescript
// ✅ Always direct imports
import type { Comment } from '@/types/comment/comment';
import type { CommentWithAuthor } from '@/types/comment/comment-with-author';
import { CommentForm } from '@/components/comment/comment-form';
import { CommentList } from '@/components/comment/comment-list';
```

