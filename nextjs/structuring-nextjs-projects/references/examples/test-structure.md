# Worked Example: Test Structure & Mocks

Mirroring structure, mock factories, and React Testing Library setup in Next.js projects.

## Example 5: Test Structure

### Scenario
Testing the complete comments feature.

### Test Files Layout

Located at the project root (`__tests__/`, never nested within subdirectories):

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

---

### Mock Data Helper

**File:** `__tests__/helpers/mockData.ts`

```typescript
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

---

### Usage in Test

**File:** `__tests__/components/CommentItem.test.tsx`

```typescript
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

