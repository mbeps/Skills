# File Conventions Reference

Comprehensive guide to naming, exports, and imports in Next.js App Router projects.

## File Naming Conventions

### Components

**Pattern:** kebab-case file, PascalCase export

```typescript
// ✅ components/comment/comment-form.tsx
'use client';

export default function CommentForm() { ... }
// or
export const CommentForm = () => { ... };
```

**Rules:**
- File: `comment-form.tsx`, `song-list.tsx`, `play-button.tsx`
- Export: `CommentForm`, `SongList`, `PlayButton`
- Never: `CommentForm.tsx` (PascalCase file name)

---

### Server Actions

**Pattern:** kebab-case, verb-noun structure

```typescript
// ✅ actions/comment/get-comments.ts
'use server';

export default async function getComments() { ... }
```

**Naming examples:**
- `get-comments.ts`, `create-comment.ts`, `delete-comment.ts`
- `get-songs-by-title.ts`, `update-user-profile.ts`

**Never:**
- `comments.ts` (not descriptive)
- `getComments.ts` (camelCase file name)

---

### Types

**Pattern:** kebab-case, descriptive noun

```typescript
// ✅ types/comment/comment.ts
export interface Comment {
  id: string;
  content: string;
  created_at: string;
}

// ✅ types/comment/comment-with-author.ts
export interface CommentWithAuthor extends Comment {
  author: {
    id: string;
    name: string;
  };
}

// ✅ types/album/album-type.ts
export type AlbumType = "album" | "single" | "ep";
```

**Rules:**
- Descriptive, noun-based names
- Composed types use `with-` prefix: `song-with-album.ts`, `album-with-artists.ts`
- Union types end with `-type`: `album-type.ts`, `repeat-mode.ts`

---

### Schemas

**Pattern:** kebab-case + `.schema.ts` suffix

```typescript
// ✅ schemas/comment/create-comment.schema.ts
import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
  song_id: z.string().uuid(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
```

**Rules:**
- Always `.schema.ts` suffix
- Export schema constant AND inferred type
- Name matches action: `create-comment.schema.ts` for `create-comment.ts` action

---

### Hooks

**Pattern:** kebab-case, `use-` prefix

```typescript
// ✅ hooks/use-player.ts
export default function usePlayer() { ... }

// ✅ hooks/use-favourite.ts
export default function useFavourite(songId: string) { ... }
```

**Rules:**
- Always `use-` prefix
- Flat structure (no subfolders)
- Default export

---

### Tests

**Pattern:** camelCase + `.test.ts` suffix

```typescript
// ✅ __tests__/actions/getComments.test.ts
// ✅ __tests__/actions/deleteComment.test.ts
// ✅ __tests__/components/CommentForm.test.tsx
```

**Rules:**
- Mirror source structure
- camelCase (EXCEPTION to kebab-case rule)
- Matches function/component name, not file name

**Mapping:**
- Source: `actions/comment/get-comments.ts` → Test: `__tests__/actions/getComments.test.ts`
- Source: `components/comment/comment-form.tsx` → Test: `__tests__/components/CommentForm.test.tsx`

---

## Export Patterns

### One Export Per File

**Rule:** Each file exports ONE primary thing.

```typescript
// ✅ types/comment/comment.ts
export interface Comment { ... }

// ✅ types/comment/comment-with-author.ts
export interface CommentWithAuthor { ... }

// ❌ NEVER combine in one file
export interface Comment { ... }
export interface CommentWithAuthor { ... }
export interface CommentReply { ... }
```

**Why:** Clear ownership, easier refactoring, better tree-shaking.

---

### Export Syntax by File Type

| File Type         | Export Pattern               | Example                                                                 |
| ----------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Server Action** | Default export               | `export default async function getComments()`                           |
| **Component**     | Default or named             | `export default CommentForm` or `export const CommentForm`              |
| **Type**          | Named export                 | `export interface Comment` or `export type AlbumType`                   |
| **Schema**        | Named export (schema + type) | `export const schema = z.object(...); export type Input = z.infer<...>` |
| **Hook**          | Default export               | `export default function usePlayer()`                                   |
| **Utility**       | Named export                 | `export function formatDuration()`                                      |

---

### NO Barrel Exports

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

---

## Import Patterns

### ALWAYS Absolute Imports

**Rule:** Use `@/*` alias everywhere. Never relative imports.

```typescript
// ❌ NEVER relative imports (even within same folder)
import type { Comment } from './comment';
import { getComments } from '../actions/get-comments';
import { CommentForm } from '../../components/comment-form';

// ✅ ALWAYS absolute imports
import type { Comment } from '@/types/comment/comment';
import { getComments } from '@/actions/comment/get-comments';
import { CommentForm } from '@/components/comment/comment-form';
```

**Why:**
- Consistent across entire codebase
- Safe refactoring (moving files doesn't break imports)
- Clear what's being imported
- Easier code review

**Applies to:** ALL imports, including within the same domain folder.

---

### Import Order

**Standard order:**

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

// 2. External packages (alphabetical)
import { z } from 'zod';
import { toast } from 'sonner';

// 3. Local imports - specific order:
// 3a. Actions
import { getComments } from '@/actions/comment/get-comments';
import { createComment } from '@/actions/comment/create-comment';

// 3b. Hooks
import usePlayer from '@/hooks/use-player';
import useFavourite from '@/hooks/use-favourite';

// 3c. Types
import type { Comment } from '@/types/comment/comment';
import type { CommentWithAuthor } from '@/types/comment/comment-with-author';

// 3d. Components
import { CommentList } from '@/components/comment/comment-list';
import { Button } from '@/components/ui/button';
```

**Why this order:** Matches dependency flow (data → logic → presentation).

---

### Type Imports

**Use `import type` for types:**

```typescript
// ✅ Explicit type imports
import type { Comment } from '@/types/comment/comment';
import type { CommentWithAuthor } from '@/types/comment/comment-with-author';

// ❌ Don't mix types and values
import { Comment, getComments } from '@/...';  // Bad: type + function
```

**Why:** TypeScript can strip type imports at compile time, reducing bundle size.

---

## Client vs Server Components

### When to Use `"use client"`

Add `"use client"` if component uses ANY of:
- React hooks (`useState`, `useEffect`, `useContext`, etc.)
- Event handlers (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `document`, `localStorage`, etc.)
- Client-only libraries (animation libs, etc.)

```typescript
// ✅ Client component
'use client';

import { useState } from 'react';

export default function CommentForm() {
  const [content, setContent] = useState('');
  
  return (
    <form onSubmit={(e) => { ... }}>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
    </form>
  );
}
```

### Server Components (Default)

No directive needed. Can use `async` directly:

```typescript
// ✅ Server component (no directive)
import { getComments } from '@/actions/comment/get-comments';

export default async function CommentList({ songId }: Props) {
  const comments = await getComments(songId);  // Direct await
  
  return (
    <div>
      {comments.map(comment => <CommentItem key={comment.id} comment={comment} />)}
    </div>
  );
}
```

**Benefits:** Smaller bundle, better performance, direct data access.

---

## Server Actions

### Standard Pattern (When Using Server Actions)

**Note:** Server actions are OPTIONAL. Not all projects use them. If project uses Route Handlers or other patterns, that's fine.

```typescript
// ✅ Standard server action structure
'use server';  // 1. Directive at top

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// 2. Schema for validation
const schema = z.object({
  content: z.string().min(1),
  song_id: z.string().uuid(),
});

// 3. Single default export
export default async function createComment(data: unknown) {
  // 4a. Validate
  const validated = schema.safeParse(data);
  if (!validated.success) {
    return { error: 'Invalid input' };
  }
  
  // 4b. Execute (database operation)
  const result = await db.insert(...);
  if (!result) {
    return { error: 'Failed to create' };
  }
  
  // 4c. Revalidate (cache invalidation)
  revalidatePath('/songs/[id]');
  
  // 4d. Return result
  return { data: result };
}
```

**Pattern:** Validate → Execute → Revalidate → Return

**Error handling:** Return `{ error: string }` objects, DON'T throw exceptions.

---

## TypeScript Strict Mode

**Configuration:** Project MUST have `"strict": true` in `tsconfig.json`. This enables:
- `noImplicitAny` - Catch missing type annotations
- `strictNullChecks` - Enforce null/undefined handling
- `strictFunctionTypes` - Type-safe function parameters
- `strictBindCallApply` - Type-safe bind/call/apply
- And more strict checks

### Required Annotations

```typescript
// ✅ Type all function parameters and returns
export async function getComments(
  songId: string
): Promise<CommentWithAuthor[]> {
  // ...
}

// ❌ NEVER use `any` type (strict mode will catch this)
export async function getComments(songId: any): any { ... }

// ✅ Use generics for flexible types
export function filterItems<T>(
  items: T[],
  predicate: (item: T) => boolean
): T[] {
  return items.filter(predicate);
}
```

### Type vs Interface

```typescript
// ✅ Use `interface` for object shapes
export interface Comment {
  id: string;
  content: string;
}

// ✅ Use `type` for unions, intersections, utilities
export type AlbumType = "album" | "single" | "ep";
export type CommentWithAuthor = Comment & { author: User };
```

---

## Edge Cases

### Constants Related to Domain

```typescript
// ✅ Validation-related constants in schemas folder
// schemas/song/audio-allowed-types.ts
export const AUDIO_ALLOWED_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
] as const;

// ✅ Type-related constants in types folder
// types/player/repeat-mode.ts
export type RepeatMode = "off" | "all" | "one";
export const REPEAT_MODES: RepeatMode[] = ["off", "all", "one"];
```

### Database Types

```typescript
// ✅ Auto-generated types stay in types/database/
// types/database/types_db.ts
export type Database = { ... };  // Supabase generated

// ✅ Application types in domain folders
// types/song/song.ts
export interface Song {
  // Transformed from Database.songs
}
```

### Shared Constants

```typescript
// ✅ Query constants in actions/_db-selects.ts
export const SONG_WITH_ALBUM_SELECT = `
  *,
  albums (
    id,
    title,
    image_path
  )
`;

// ✅ Business logic constants in lib/
// lib/utils.ts
export const GRID_CLASSES = {
  default: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  wide: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};
```
