# File Naming Conventions Reference

Comprehensive naming patterns across all Next.js App Router project artifacts.

## Components

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
- Placement: Centralise components in `./components/[domain]/` (or `./components/ui/`, `./components/header.tsx`). Pages can only include their own local `_components/` folder if the components are strictly specific to that page.

---

## Server Actions

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

## Types

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
    avatar_url: string | null;
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

## Enums

**Pattern:** kebab-case file, PascalCase export

```typescript
// ✅ enums/car/car-status.ts or enum/car-status.ts
export enum CarStatus {
  AVAILABLE = "available",
  SOLD = "sold",
}
```

**Rules:**
- Folders like `enums/` or `enum/` are explicitly allowed for TypeScript enums (alternatively placed under `types/[domain]/`).
- Single named export per file.

---

## Schemas

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

## Hooks

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

## Stores (Zustand)

**Pattern:** kebab-case, `[name]-store.ts` or `use-[name]-store.ts`

```typescript
// ✅ stores/player-store.ts
import { create } from 'zustand';

interface PlayerState {
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
}

const usePlayerStore = create<PlayerState>((set) => ({
  isPlaying: false,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
}));

export default usePlayerStore;
```

**Rules:**
- Default dedicated state management solution when local component state or Context is insufficient
- Flat structure under `stores/` (or encapsulated under `hooks/`)
- Single default export per file (internal actions and selectors unexported or attached to store hook)

---

## Tests

**Pattern:** camelCase + `.test.ts` suffix

```typescript
// ✅ __tests__/actions/getComments.test.ts
// ✅ __tests__/actions/deleteComment.test.ts
// ✅ __tests__/components/CommentForm.test.tsx
```

**Rules:**
- `__tests__/` is ALWAYS located at the project root (never nested inside feature folders, `app/`, `components/`, etc.)
- Mirror source structure inside `__tests__/`
- camelCase (EXCEPTION to kebab-case rule)
- Matches function/component name, not file name

**Mapping:**
- Source: `actions/comment/get-comments.ts` → Test: `__tests__/actions/getComments.test.ts`
- Source: `components/comment/comment-form.tsx` → Test: `__tests__/components/CommentForm.test.tsx`

