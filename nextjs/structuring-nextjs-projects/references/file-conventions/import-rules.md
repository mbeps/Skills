# Import Patterns Reference

Import standards, ordering rules, and type import conventions in Next.js App Router projects.

## ALWAYS Absolute Imports

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

## Import Order

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

## Type Imports

**Use `import type` for types:**

```typescript
// ✅ Explicit type imports
import type { Comment } from '@/types/comment/comment';
import type { CommentWithAuthor } from '@/types/comment/comment-with-author';

// ❌ Don't mix types and values
import { Comment, getComments } from '@/...';  // Bad: type + function
```

**Why:** TypeScript can strip type imports at compile time, reducing bundle size.

