# File Conventions Reference

Comprehensive guide to naming, exports, imports, component boundaries, and type conventions in Next.js App Router projects.

To keep documentation modular and focused, the file conventions guide is decomposed into the specialized reference documents below.

---

## File Convention Reference Documents

| Document | Focus & Coverage |
| --- | --- |
| [File Naming Conventions](file-conventions/naming-conventions.md) | Naming patterns across Components, Server Actions, Types, Enums, Schemas, Hooks, Stores (Zustand), and Tests. |
| [Export Rules & Special Files](file-conventions/export-rules.md) | One export per file rule, unexported internal helpers, export syntax table, root special files (`not-found.tsx`, `loading.tsx`, `error.tsx`), dynamic route 404s, app branding metadata, and strict anti-barrel export prohibitions. |
| [Import Patterns](file-conventions/import-rules.md) | Mandatory `@/*` absolute imports, dependency flow import order (React/Next → external → local actions/hooks/types/components), and explicit `import type` usage. |
| [Components & Server Actions](file-conventions/components-and-actions.md) | When to use `'use client'`, Server Components by default, and standard Server Action mutation pattern (Validate → Execute → Revalidate → Return). |
| [TypeScript Strict Mode & Edge Cases](file-conventions/typescript-and-edge-cases.md) | TypeScript `"strict": true` requirements, interface vs type distinctions, domain constants placement, database types, and shared constants patterns. |

---

## Quick Reference Summary

### Naming Patterns

| Type | Pattern | Example |
| --- | --- | --- |
| Components | kebab-case → PascalCase export | `comment-form.tsx` → `CommentForm` |
| Actions | kebab-case, verb-noun | `get-comments.ts`, `delete-comment.ts` |
| Types | kebab-case, descriptive | `comment-with-author.ts`, `song.ts` |
| Enums | kebab-case, descriptive | `car-status.ts`, `role.ts` |
| Schemas | kebab-case + `.schema.ts` | `create-comment.schema.ts` |
| Hooks | kebab-case, `use-` prefix | `use-favourite.ts` |
| Stores (Zustand) | kebab-case, `[name]-store.ts` | `player-store.ts` |
| Tests | camelCase + `.test.ts` | `getComments.test.ts` |

---

### Export Patterns

| File Type | Export Pattern | Example |
| --- | --- | --- |
| Server Action | Single default export | `export default getComments;` |
| Component | Single default or named export | `export default CommentList;` or `export const CommentList` |
| Page / Special | Single default export | `export default function SongPage()` |
| Type / Interface | Single named export | `export type Comment = {...}` or `export interface Comment {...}` |
| Enum | Single named export | `export enum CarStatus { ... }` |
| Schema | Named export (schema + type) | `export const createCommentSchema = z.object(...)` |
| Hook | Single default export | `export default usePlayer;` |
| Store (Zustand) | Single default export | `export default usePlayerStore;` |
| Utility / Logger | Named export(s) (allowed exception) | `export function formatDuration()`, `export function getLogger()` |

