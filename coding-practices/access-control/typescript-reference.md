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
  comments: { dataType: Comment; action: "view" | "create" | "update" }
  todos:    { dataType: Todo;    action: "view" | "create" | "update" | "delete" }
}

const ROLES = {
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
  },
} as const satisfies RolesWithPermissions

export function hasPermission<Resource extends keyof Permissions>(
  user: User,
  resource: Resource,
  action: Permissions[Resource]["action"],
  data?: Permissions[Resource]["dataType"]
) {
  return user.roles.some(role => {
    const permission = (ROLES as RolesWithPermissions)[role][resource]?.[action]
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

## Porting to Other Languages

The pattern is language-agnostic: a nested map role→resource→action of booleans-or-predicates, plus one evaluator.

- **Python**: `dict[str, dict[str, dict[str, bool | Callable[[User, Any], bool]]]]`; evaluator mirrors the TS function. Use `TypedDict`/`Literal` for compile-time-ish checking via mypy.
- **Java**: `Map<Role, Map<String, Map<Action, BiPredicate<User, T>>>>`, or sealed interface `Rule` with `record StaticGrant(boolean)` / predicate records.
- **Go**: `map[Role]map[string]map[string]func(u User, d any) bool` — no generics needed for the evaluator.
- **Any language**: keep the two query modes (with/without data) and deny-by-default; those are the invariants that matter.
