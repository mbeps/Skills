# TypeScript Strict Mode & Edge Cases Reference

Type safety rules, interface distinctions, and architectural edge cases in Next.js App Router projects.

## TypeScript Strict Mode

**Configuration:** Project MUST have `"strict": true` in `tsconfig.json`. This enables:
- `noImplicitAny` — Catch missing type annotations
- `strictNullChecks` — Enforce null/undefined handling
- `strictFunctionTypes` — Type-safe function parameters
- `strictBindCallApply` — Type-safe bind/call/apply
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

// ✅ Application-wide configuration and asset constants in config/
// config/constants.ts
export const APP_CONFIG = {
  DEFAULT_PAGINATION_LIMIT: 20,
  SUPPORT_EMAIL: 'support@example.com',
} as const;

// config/assets.ts (mirrors ROUTES pattern with grouped object fields)
const IMAGES_BASE = '/images';

export const ASSETS = {
  LOGO: {
    DARK: { path: `${IMAGES_BASE}/logo-dark.svg`, alt: 'App logo (dark mode)' },
    LIGHT: { path: `${IMAGES_BASE}/logo-light.svg`, alt: 'App logo (light mode)' },
  },
  AVATARS: {
    DEFAULT: { path: `${IMAGES_BASE}/default-avatar.png` },
    FALLBACK: { path: `${IMAGES_BASE}/fallback-cover.jpg` },
  },
} as const;

export type Assets = typeof ASSETS;

// ✅ Component/styling utilities in lib/
// lib/utils.ts
export const GRID_CLASSES = {
  default: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  wide: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};
```

