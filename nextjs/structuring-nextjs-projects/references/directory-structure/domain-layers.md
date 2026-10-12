# Domain Layers Reference

Detailed guide for domain-first application layers in Next.js App Router projects.

## `actions/`

**Purpose:** All server-side mutations and data fetching  
**Structure:** `actions/[domain]/[action-name].ts`  
**Rule:** ALL server actions here, even if used once; single default export per file (unexported internal helpers allowed)

```
actions/
├── _db-selects.ts          # Shared PostgREST select clauses (constants)
├── comment/
│   ├── get-comments.ts
│   ├── create-comment.ts
│   └── delete-comment.ts
├── song/
│   ├── get-songs.ts
│   ├── get-songs-by-title.ts
│   └── delete-song.ts
└── auth/
    ├── sign-in.ts
    └── sign-up.ts
```

**Special file:** `_db-selects.ts` contains reusable query constants (e.g., `SONG_WITH_ALBUM_SELECT`) to prevent duplicating complex joins.

---

## `types/`

**Purpose:** All TypeScript types and interfaces  
**Structure:** `types/[domain]/[type-name].ts`  
**Rule:** No barrel exports; one exported type/interface per file (unexported internal helpers allowed)

```
types/
├── comment/
│   ├── comment.ts                  # Base Comment type
│   └── comment-with-author.ts     # Composed type
├── song/
│   └── song.ts
├── music/                          # Cross-domain composed types
│   ├── song-with-album.ts
│   └── album-with-artists.ts
├── player/
│   └── repeat-mode.ts
└── database/
    └── types_db.ts                 # Supabase auto-generated (internal only)
```

**Domain vs Cross-Domain:**
- Domain-specific types: `types/comment/comment.ts`
- Cross-domain types: `types/music/song-with-album.ts` (used by songs, playlists, queue)

---

## `enums/` (or `enum/`)

**Purpose:** TypeScript enums and enum-like mappings (allowed as top-level folder or under `types/[domain]/`)  
**Structure:** `enums/[domain]/[name].ts` or `enums/[name].ts` (or `enum/`)  
**Rule:** One exported enum per file; no barrel exports; kebab-case file naming

```
enums/
├── car/
│   └── car-status.ts
└── auth/
    └── user-role.ts
```

---

## `components/`

**Purpose:** All shared and reusable React components  
**Structure:** `components/[domain]/[component-name].tsx`  
**Rule:** One component per file; no co-located sub-components. All reusable components must be centralised in `./components`. Pages may include their own local `_components/` folder if and only if the component is strictly specific to that page.

```
components/
├── comment/
│   ├── comment-list.tsx
│   ├── comment-item.tsx
│   └── comment-form.tsx
├── player/                         # Rich domain with many components
│   ├── player.tsx
│   ├── player-content.tsx
│   ├── player-controls.tsx
│   ├── player-volume.tsx
│   └── queue-panel.tsx
├── modals/                         # Shared UI concern
│   ├── auth-modal.tsx
│   └── create-album-modal.tsx
├── ui/                             # Shadcn UI (with Base UI primitives & Tailwind CSS)
│   ├── button.tsx
│   └── dialog.tsx
└── header.tsx                      # Root-level shared components
```

**When to use root-level:** Components used across ALL domains (header, footer, layout wrappers).

---

## `schemas/`

**Purpose:** Zod validation schemas  
**Structure:** `schemas/[domain]/[schema-name].schema.ts`  
**Rule:** One schema per file; `.schema.ts` suffix

```
schemas/
├── comment/
│   ├── create-comment.schema.ts
│   └── update-comment.schema.ts
├── auth/
│   ├── sign-in.schema.ts
│   ├── sign-up.schema.ts
│   └── forgot-password.schema.ts
└── song/
    ├── song-file.schema.ts
    ├── song-upload.schema.ts
    └── audio-allowed-types.ts      # Constants related to validation
```

**Reuse pattern:** Schemas used by BOTH client-side forms (React Hook Form) and server actions.

---

## `hooks/`

**Purpose:** Custom React hooks  
**Structure:** `hooks/use-[name].ts` (FLAT, no subfolders)  
**Rule:** `use-` prefix; single default export per file (unexported internal helpers allowed)

```
hooks/
├── use-player.ts
├── use-favourite.ts
├── use-auth-modal.ts
├── use-on-play.ts
└── use-debounce.ts
```

**Why flat:** Hooks orchestrate multiple domains; domain organization doesn't apply.

---

## `stores/`

**Purpose:** Client-side dedicated state management stores (Zustand)  
**Structure:** `stores/[domain]-store.ts` or `stores/use-[domain]-store.ts` (FLAT)  
**Rule:** When a dedicated client state management solution is needed (beyond React Context or useState), default to **Zustand**; single default export per file (unexported actions/selectors allowed)

```
stores/
├── player-store.ts                 # usePlayerStore
├── cart-store.ts                   # useCartStore
└── sidebar-store.ts                # useSidebarStore
```

**Alternative:** Store hooks can also be encapsulated under `hooks/` as custom store hooks (e.g. `hooks/use-player-store.ts`).

