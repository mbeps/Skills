# Components & Server Actions Reference

Execution context conventions and mutation patterns in Next.js App Router projects.

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

