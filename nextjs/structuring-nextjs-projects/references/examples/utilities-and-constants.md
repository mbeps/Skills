# Worked Examples: Utility Placement & Shared Constants

Practical examples demonstrating business logic utilities and cross-action query constants.

## Example 2: Utility Function Placement

### Scenario
Create a duration formatter for displaying song lengths.

### Decision Process

**Question:** Where does `formatDuration(seconds: number): string` go?

**Answer:** `lib/music/duration-formatter.ts`

**Reasoning:**
- It's business logic (not infrastructure) → `lib/` not `utils/`
- Music-specific (not generic) → `lib/music/` not root `lib/`
- Used across multiple domains (songs, albums, playlists) → Cross-domain location

### Implementation

**File:** `lib/music/duration-formatter.ts`

```typescript
/**
 * Formats seconds into MM:SS format
 * @example formatDuration(185) // "3:05"
 * @example formatDuration(3661) // "61:01"
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
```

### Usage

```typescript
// In any component
import { formatDuration } from '@/lib/music/duration-formatter';

export function SongItem({ song }: Props) {
  return (
    <div>
      <span>{song.title}</span>
      <span>{formatDuration(song.duration)}</span>
    </div>
  );
}
```

---

## Example 3: Shared Constant Pattern

### Scenario
Multiple server actions need the same database select clause for songs with albums.

### Solution: Shared Constants File

**File:** `actions/_db-selects.ts`

```typescript
/**
 * Reusable PostgREST select clauses for complex joins.
 * Prevents duplication of select logic across actions.
 */

export const SONG_WITH_ALBUM_SELECT = `
  *,
  albums (
    id,
    title,
    image_path,
    artists (
      id,
      name
    )
  )
`;

export const ALBUM_WITH_ARTISTS_SELECT = `
  *,
  artists (
    id,
    name,
    image_path
  )
`;

export const PLAYLIST_WITH_SONGS_SELECT = `
  *,
  playlist_songs (
    song_id,
    position,
    songs (
      *,
      albums (
        id,
        title,
        image_path
      )
    )
  )
`;
```

### Usage

```typescript
// actions/song/get-songs.ts
'use server';

import { SONG_WITH_ALBUM_SELECT } from '@/actions/_db-selects';
import { createClient } from '@/utils/supabase/server';

export default async function getSongs() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('songs')
    .select(SONG_WITH_ALBUM_SELECT)  // ← Reused constant
    .order('created_at', { ascending: false });
  
  return data || [];
}
```

