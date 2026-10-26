# TypeScript Reference Implementations

Two canonical implementations, from simple to full. Porting notes for other languages at the bottom.

## 1. Flat RBAC (`auth-rbac.ts`)

```ts
export type User = { roles: Role[]; id: string }

type Role = keyof typeof ROLES
type Permission = (typeof ROLES)[Role][number]

const ROLES = {
  admin: [
    "view:comments",
    "create:comments",
    "update:comments",
    "delete:comments",
  ],
  moderator: ["view:comments", "create:comments", "delete:comments"],
  user: ["view:comments", "create:comments"],
} as const

export function hasPermission(user: User, permission: Permission) {
  return user.roles.some(role =>
    (ROLES[role] as readonly Permission[]).includes(permission)
  )
}
```

Design notes:
- `type Role = keyof typeof ROLES` — roles derived from the data; adding a role extends the union automatically.
- `as const` makes permissions literal types → invalid permission strings fail at **compile time**.
- Multi-role via `.some()` (union semantics); deny-by-default on no match.

## 2. ABAC Matrix (`auth-abac.ts`)

```ts
type PermissionCheck<Key extends keyof Permissions> =
  | boolean
  | ((user: User, data: Permissions[Key]["dataType"]) => boolean)

type RolesWithPermissions = {
  [R in Role]: Partial<{
    [Key in keyof Permissions]: Partial<{
      [Action in Permissions[Key]["action"]]: PermissionCheck<Key>
    }>
  }>
}

type Permissions = {
  comments:  { dataType: Comment;  action: "view" | "create" | "update" }
  todos:     { dataType: Todo;     action: "view" | "create" | "update" | "delete" }
  playlists: { dataType: Playlist; action: "view" | "create" | "update" | "delete" }
}

const ROLES = {
  admin: {
    comments: { view: true, create: true, update: true },
    todos:    { view: true, create: true, update: true, delete: true },
    playlists: {
      // Admin can manage shared playlists, but personal playlists remain private
      view:   (user, pl) => !pl.isPersonal || pl.userId === user.id,
      create: true,
      update: (user, pl) => !pl.isPersonal || pl.userId === user.id,
      delete: (_user, pl) => !pl.isPersonal,
    },
  },
  moderator: {
    comments: { view: true, create: true, update: true },
    todos: {
      view: true, create: true, update: true,
      delete: (user, todo) => todo.completed,
    },
  },
  user: {
    comments: {
      view:   (user, comment) => !user.blockedBy.includes(comment.authorId),
      create: true,
      update: (user, comment) => comment.authorId === user.id,
    },
    playlists: {
      view:   (user, pl) => pl.userId === user.id,
      create: true,
      update: (user, pl) => pl.userId === user.id,
      delete: (user, pl) => !pl.isPersonal && pl.userId === user.id,
    },
  },
} as const satisfies RolesWithPermissions

export function hasPermission<Resource extends keyof Permissions>(
  user: User,
  resource: Resource,
  action: Permissions[Resource]["action"],
  data?: Permissions[Resource]["dataType"]
) {
  return user.roles.some(role => {
    const permission = (ROLES as RolesWithPermissions)[role]?.[resource]?.[action]
    if (permission == null) return false          // deny by default

    if (typeof permission === "boolean") return permission
    return data != null && permission(user, data) // no data → deny (safe default)
  })
}
```

Design notes:
- `Partial<>` everywhere: roles declare only grants; absence = denial.
- `satisfies` keeps literal inference while validating the matrix shape.
- Optional `data`: without it you answer "can they ever do X?" (UI gating); with it, "can they do X to this record?" Predicates deny when data is missing.
- Personal resources (like `playlists.isPersonal`) retain isolation even for admins to avoid returning multi-user records in single-entity queries.

## 3. UI Component Consumption Pattern

In React / Next.js components, avoid raw `user.id === data.authorId` checks. Check capabilities instead:

```tsx
export function CommentItem({ comment }: { comment: Comment }) {
  const { user } = useUser()

  const canUpdate = hasPermission(user, "comments", "update", comment)
  const canDelete = hasPermission(user, "todos", "delete", comment)

  return (
    <div>
      <p>{comment.text}</p>
      {canUpdate && <button onClick={handleEdit}>Edit</button>}
      {canDelete && <button onClick={handleDelete}>Delete</button>}
    </div>
  )
}
```

## 4. Config-Driven Roles & Bundler Pitfalls

When managing administrative roles via environment variables (e.g. `ADMIN_USER_IDS`):

1. **Identifier Normalization**:
   Environment strings may have surrounding quotes (`"..."`, `'...'`), extra whitespace, or mixed casing. Parse into a lookup set with normalization:
   ```ts
   export function parseAdminUserIds(raw: string): ReadonlySet<string> {
     return new Set(
       raw
         .split(",")
         .map(s => s.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
         .filter(Boolean)
     )
   }
   ```
2. **Dual-Tier Hydration (Client Env vs Live DB / RPC)**:
   Frameworks like Next.js inline public env vars (`NEXT_PUBLIC_*`) at build or dev-server startup. If server environment variables are updated without rebuilding the client bundle, static client checks fail while server RLS passes.
   **Solution**: Hydrate client user context by combining static env checks with a runtime call (e.g. `supabase.rpc("is_admin")` or session JWT claim) to augment `user.isAdmin`.

## Porting to Other Languages

The pattern is language-agnostic: a nested map role→resource→action of booleans-or-predicates, plus one evaluator.

- **Python**: `dict[str, dict[str, dict[str, bool | Callable[[User, Any], bool]]]]`; evaluator mirrors the TS function. Use `TypedDict`/`Literal` for compile-time-ish checking via mypy.
- **Java**: `Map<Role, Map<String, Map<Action, BiPredicate<User, T>>>>`, or sealed interface `Rule` with `record StaticGrant(boolean)` / predicate records.
- **Go**: `map[Role]map[string]map[string]func(u User, d any) bool` — no generics needed for the evaluator.
- **Any language**: keep the two query modes (with/without data) and deny-by-default; those are the invariants that matter.
