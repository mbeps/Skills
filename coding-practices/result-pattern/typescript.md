# Result Pattern in TypeScript

## Approach A: zero-dependency discriminated union

Error-first Go-style tuple. Standardize the ordering across the codebase.

```ts
export type Result<TSuccess, TError> = [TError, null] | [null, TSuccess];

export function ok<T>(data: T): Result<T, never> {
  return [null, data];
}

export function error<const E extends { reason: string }>(err: E): Result<never, E> {
  return [err, null];
}
```

### Service

```ts
type CreateUserError =
  | { reason: "email_taken"; email: string }
  | { reason: "invalid_email"; email: string };

export async function createUser(email: string): Promise<Result<{ id: string }, CreateUserError>> {
  if (!email.includes("@")) {
    return error({ reason: "invalid_email", email });
  }
  if (await db.users.exists(email)) {
    return error({ reason: "email_taken", email });
  }
  const user = await db.users.insert({ email });
  return ok({ id: user.id });
}
```

### Consumer: narrow with `if (err === null)`, then switch on `reason`

```ts
const [err, user] = await createUser(input.email);
if (err === null) {
  redirect(`/users/${user.id}`);
} else {
  switch (err.reason) {
    case "invalid_email":
      return { message: `"${err.email}" is not a valid email` };
    case "email_taken":
      return { message: `${err.email} is already registered` };
    default: {
      const unhandled: never = err.reason; // compile error if a variant is added unhandled
      return { message: String(unhandled) };
    }
  }
}
```

The literal `reason` tag drives narrowing inside the `else` branch; the `default` case with `never` makes adding a new variant a compile-time failure until handled.

## Approach B: neverthrow v8.x

Install:

```
npm install neverthrow        # v8.2.0
npm install eslint-plugin-neverthrow   # forces consuming Results (must_use port)
```

```ts
import { errAsync, okAsync, ResultAsync, ok, err } from "neverthrow";

// Wrap throwing code — map thrown unknown to a typed error
const fetchUser = (id: string) =>
  ResultAsync.fromPromise(db.users.find(id), () => err({ reason: "db_error" as const }));

fetchUser("u1")
  .andThen((user) => (user.active ? okAsync(user) : errAsync({ reason: "inactive" as const })))
  .map((user) => user.email)
  .match(
    (email) => console.log(email),
    (e) => console.error(e.reason),
  ); // .match forces error handling
```

Key API:

| Need                         | Use                                                  |
| ---------------------------- | ---------------------------------------------------- |
| Sync success/failure         | `ok(v)` / `err(e)`                                   |
| Async success/failure        | `okAsync(v)` / `errAsync(e)`                         |
| Wrap throwing promise        | `ResultAsync.fromPromise(p, errorFn)`                |
| Wrap sync-throwing function  | `Result.fromThrowable(fn, errorFn)`                  |
| Chain fallible steps         | `.andThen` / `.asyncAndThen`                         |
| Transform success            | `.map` / `.asyncMap`                                 |
| Force handling both branches | `.match(okFn, errFn)`                                |
| Do-notation                  | `safeTry(function* () { const x = yield* r1; ... })` |

Gotchas:

- `ResultAsync.fromPromise` does **not** catch synchronous throws from non-async functions — use `Result.fromThrowable`.
- `safeUnwrap()` is deprecated; use `_unsafeUnwrap` in tests only.

### Combining multiple results

```ts
import { Result, ok, err } from "neverthrow";

const combined = Result.combine([parseAge(a), parseName(b)]); // Ok<[A, B]> | Err<E>
```

## Pitfall: Next.js `redirect()` returns `never`

`redirect()` is typed as returning `never`, so TypeScript knows any code after it is unreachable — no need for `return redirect(...)` or guards below the call. But it still **throws internally** at runtime (see pitfall above), so never wrap it in try/catch or Result helpers.

## Pitfall: Next.js `redirect()` throws internally

`redirect()` and `notFound()` signal navigation by **throwing**. Wrapping them in try/catch or a `fromThrowable` helper swallows that control-flow exception and breaks routing.

```ts
// WRONG — redirect's internal throw becomes an Err
const result = Result.fromThrowable(() => redirect("/login"))();

// RIGHT — call redirect outside any Result/try-catch wrapping
if (!session) redirect("/login");
```

If you must catch broadly (e.g., around server actions), rethrow framework control-flow errors before converting to `Err`.
