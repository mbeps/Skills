# Worked Example: Type Composition Pattern

Architecture and composition patterns for domain-specific vs cross-domain TypeScript types.

## Example 4: Type Composition Pattern

### Scenario
Display songs in different contexts with different data shapes.

### Implementation

#### Base Types (Domain-Specific)

```typescript
// types/song/song.ts
export interface Song {
  id: string;
  title: string;
  audio_path: string;
  duration: number;
  album_id: string;
  created_at: string;
}

// types/album/album.ts
export interface Album {
  id: string;
  title: string;
  image_path: string;
  release_date: string;
}

// types/artist/artist.ts
export interface Artist {
  id: string;
  name: string;
  image_path: string;
}
```

#### Composed Types (Cross-Domain)

```typescript
// types/music/song-with-album.ts
import type { Song } from '@/types/song/song';
import type { Album } from '@/types/album/album';

export interface SongWithAlbum extends Song {
  album: Album & {
    artists: Artist[];
  };
}

// types/music/album-with-artists.ts
import type { Album } from '@/types/album/album';
import type { Artist } from '@/types/artist/artist';

export interface AlbumWithArtists extends Album {
  artists: Artist[];
}
```

### Why Separate?

- Base types are single-domain.
- Composed types reflect actual query needs.
- Clear data shape for each use case.
- Easy to add new compositions without modifying base types.

