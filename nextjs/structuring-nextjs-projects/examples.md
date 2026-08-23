# Complete Examples

Working examples of feature scaffolding following Next.js project structure conventions.

## Example 1: Complete Comments Feature

### Scenario
Add commenting functionality to a music streaming app. Users can comment on songs.

### Files Created

#### 1. Type: Base Comment

**File:** `types/comment/comment.ts`

```typescript
export interface Comment {
  id: string;
  song_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}
```

---

#### 2. Type: Composed Type

**File:** `types/comment/comment-with-author.ts`

```typescript
import type { Comment } from '@/types/comment/comment';

export interface CommentWithAuthor extends Comment {
  author: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}
```

---

#### 3. Schema: Create Comment

**File:** `schemas/comment/create-comment.schema.ts`

```typescript
import { z } from 'zod';

export const createCommentSchema = z.object({
  song_id: z.string().uuid('Invalid song ID'),
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(500, 'Comment too long'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
```

---

#### 4. Server Action: Get Comments

**File:** `actions/comment/get-comments.ts`

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import type { CommentWithAuthor } from '@/types/comment/comment-with-author';

export default async function getComments(
  songId: string
): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:users (
        id,
        name,
        avatar_url
      )
    `)
    .eq('song_id', songId)
    .order('created_at', { ascending: false });
  
  if (error || !data) {
    console.error('Failed to fetch comments:', error);
    return [];
  }
  
  return data;
}
```

---

#### 5. Server Action: Create Comment

**File:** `actions/comment/create-comment.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createCommentSchema } from '@/schemas/comment/create-comment.schema';
import type { Comment } from '@/types/comment/comment';

export default async function createComment(data: unknown): Promise<{
  data?: Comment;
  error?: string;
}> {
  // 1. Validate input
  const validated = createCommentSchema.safeParse(data);
  if (!validated.success) {
    return { error: 'Invalid input' };
  }
  
  // 2. Get authenticated user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: 'Unauthorized' };
  }
  
  // 3. Execute database operation
  const { data: comment, error: dbError } = await supabase
    .from('comments')
    .insert({
      ...validated.data,
      user_id: user.id,
    })
    .select()
    .single();
  
  if (dbError || !comment) {
    console.error('Failed to create comment:', dbError);
    return { error: 'Failed to create comment' };
  }
  
  // 4. Revalidate cache
  revalidatePath(`/songs/${validated.data.song_id}`);
  
  return { data: comment };
}
```

---

#### 6. Component: Comment Item (Server)

**File:** `components/comment/comment-item.tsx`

```typescript
import type { CommentWithAuthor } from '@/types/comment/comment-with-author';
import { Avatar } from '@/components/ui/avatar';

interface CommentItemProps {
  comment: CommentWithAuthor;
}

export default function CommentItem({ comment }: CommentItemProps) {
  return (
    <div className="flex gap-3 p-4 border-b">
      <Avatar>
        <img src={comment.author.avatar_url || '/default-avatar.png'} alt={comment.author.name} />
      </Avatar>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{comment.author.name}</span>
          <span className="text-sm text-muted-foreground">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>
        
        <p className="mt-1 text-sm">{comment.content}</p>
      </div>
    </div>
  );
}
```

---

#### 7. Component: Comment List (Server)

**File:** `components/comment/comment-list.tsx`

```typescript
import getComments from '@/actions/comment/get-comments';
import CommentItem from '@/components/comment/comment-item';

interface CommentListProps {
  songId: string;
}

export default async function CommentList({ songId }: CommentListProps) {
  const comments = await getComments(songId);
  
  if (comments.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No comments yet. Be the first to comment!
      </div>
    );
  }
  
  return (
    <div className="divide-y">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
```

---

#### 8. Component: Comment Form (Client)

**File:** `components/comment/comment-form.tsx`

```typescript
'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import createComment from '@/actions/comment/create-comment';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CommentFormProps {
  songId: string;
}

export default function CommentForm({ songId }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      const result = await createComment({
        song_id: songId,
        content,
      });
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success('Comment added!');
      setContent('');
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        disabled={isPending}
        maxLength={500}
        rows={3}
      />
      
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {content.length}/500
        </span>
        
        <Button type="submit" disabled={isPending || !content.trim()}>
          {isPending ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </form>
  );
}
```

---

#### 9. Page: Using Comments Feature

**File:** `app/songs/[id]/page.tsx`

```typescript
import getComments from '@/actions/comment/get-comments';
import { CommentList } from '@/components/comment/comment-list';
import { CommentForm } from '@/components/comment/comment-form';

interface SongPageProps {
  params: Promise<{ id: string }>;
}

export default async function SongPage({ params }: SongPageProps) {
  const { id } = await params;
  
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Comments</h1>
      
      {/* Client component for form */}
      <CommentForm songId={id} />
      
      <div className="mt-8">
        {/* Server component for list */}
        <CommentList songId={id} />
      </div>
    </div>
  );
}
```

---

#### 10. Test: Get Comments Action

**File:** `__tests__/actions/getComments.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import getComments from '@/actions/comment/get-comments';

// Mock Supabase client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              {
                id: '1',
                song_id: 'song-1',
                user_id: 'user-1',
                content: 'Great song!',
                created_at: '2024-01-01T00:00:00Z',
                author: {
                  id: 'user-1',
                  name: 'John Doe',
                  avatar_url: null,
                },
              },
            ],
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('getComments', () => {
  it('should return comments for a song', async () => {
    const comments = await getComments('song-1');
    
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe('Great song!');
    expect(comments[0].author.name).toBe('John Doe');
  });
});
```

---

### Complete File Structure

```
project/
├── actions/
│   └── comment/
│       ├── get-comments.ts
│       └── create-comment.ts
├── components/
│   └── comment/
│       ├── comment-item.tsx
│       ├── comment-list.tsx
│       └── comment-form.tsx
├── schemas/
│   └── comment/
│       └── create-comment.schema.ts
├── types/
│   └── comment/
│       ├── comment.ts
│       └── comment-with-author.ts
├── __tests__/
│   └── actions/
│       └── getComments.test.ts
└── app/
    └── songs/
        └── [id]/
            └── page.tsx
```

---

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

**Usage:**

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

**Usage:**

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

---

## Example 4: Type Composition Pattern

### Scenario
Display songs in different contexts with different data shapes.

### Implementation

**Base types (domain-specific):**

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

**Composed types (cross-domain):**

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

**Why separate?**
- Base types are single-domain
- Composed types reflect actual query needs
- Clear data shape for each use case
- Easy to add new compositions without modifying base types

---

## Example 5: Test Structure

### Scenario
Testing the complete comments feature.

### Test Files

```
__tests__/
├── actions/
│   ├── getComments.test.ts           # Tests get-comments.ts
│   └── createComment.test.ts         # Tests create-comment.ts
├── components/
│   ├── CommentItem.test.tsx          # Tests comment-item.tsx
│   ├── CommentList.test.tsx          # Tests comment-list.tsx
│   └── CommentForm.test.tsx          # Tests comment-form.tsx
└── helpers/
    ├── mockData.ts                   # Shared mock factories
    └── TestWrapper.tsx               # Provider wrapper for tests
```

**Mock data helper:**

```typescript
// __tests__/helpers/mockData.ts
import type { CommentWithAuthor } from '@/types/comment/comment-with-author';

export function createMockComment(overrides?: Partial<CommentWithAuthor>): CommentWithAuthor {
  return {
    id: 'comment-1',
    song_id: 'song-1',
    user_id: 'user-1',
    content: 'Great song!',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    author: {
      id: 'user-1',
      name: 'John Doe',
      avatar_url: null,
    },
    ...overrides,
  };
}
```

**Usage in test:**

```typescript
// __tests__/components/CommentItem.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CommentItem from '@/components/comment/comment-item';
import { createMockComment } from '@/tests/helpers/mockData';

describe('CommentItem', () => {
  it('should render comment content', () => {
    const comment = createMockComment({
      content: 'Amazing track!',
      author: { id: 'user-1', name: 'Jane', avatar_url: null },
    });
    
    render(<CommentItem comment={comment} />);
    
    expect(screen.getByText('Amazing track!')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });
});
```

---

## Quick Scaffolding Checklist

When adding a new feature, create files in this order:

1. **Types** (`types/[domain]/`)
   - Base type
   - Composed types (if needed)

2. **Schemas** (`schemas/[domain]/`)
   - Validation schemas for mutations

3. **Server Actions** (`actions/[domain]/`)
   - Get/fetch actions
   - Mutation actions (create/update/delete)

4. **Components** (`components/[domain]/`)
   - Server components (display, lists)
   - Client components (forms, interactive)

5. **Tests** (`__tests__/`)
   - Action tests
   - Component tests

6. **Integration** (`app/[route]/`)
   - Add to page/layout

**Remember:**
- One export per file
- Absolute imports only
- No barrel exports
- Domain subfolders
- kebab-case files
- Test files mirror structure
