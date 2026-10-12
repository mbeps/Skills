# Worked Example: Complete Comments Feature

Complete end-to-end working example of scaffolding a feature (comments on songs) in a music streaming app.

## Scenario
Add commenting functionality to a music streaming app. Users can comment on songs.

## Files Created

### 1. Type: Base Comment

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

### 2. Type: Composed Type

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

### 3. Schema: Create Comment

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

### 4. Server Action: Get Comments

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

### 5. Server Action: Create Comment

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

### 6. Component: Comment Item (Server)

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

### 7. Component: Comment List (Server)

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

### 8. Component: Comment Form (Client)

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

### 9. Page: Using Comments Feature

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

### 10. Test: Get Comments Action

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

## Complete File Structure

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

