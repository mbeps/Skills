# Client Hooks: useTRPC, suspense, mutations, invalidation, errors

> **In this repo** (Nodebase): snippets marked "repo" match `features/workflows/hooks/use-workflows.ts`, `hooks/use-upgrade-modal.tsx`.

## The core pattern

`useTRPC()` returns the typed proxy. Every TanStack hook call takes `trpc.<router>.<proc>.queryOptions(input)` or `.mutationOptions(...)` — the v11 API. There is no `trpc.x.useQuery()` anymore.

**Default: `useSuspenseQuery`** — integrates with the Suspense boundary and streaming SSR. Use `useQuery` only when explicitly opting out of suspense (e.g. background refresh without a loading fallback).

```ts
const trpc = useTRPC();
const [params] = useWorkflowsParams();

const { data } = useSuspenseQuery(trpc.workflows.getMany.queryOptions(params));
```

> **Migrating from `useQuery` to `useSuspenseQuery`**: `useSuspenseQuery` has **no `isLoading` / `isFetching` field** — loading state moves to the parent `<Suspense>` boundary. Callers consuming `isLoading` (spinners, conditional UI) must restructure:
>
> ```ts
> // before
> const { data, isLoading } = useQuery(trpc.x.y.queryOptions(input));
> return isLoading ? <Spinner /> : <List data={data} />;
>
> // after — no isLoading; wrap the parent in <Suspense fallback={<Spinner />}>
> const { data } = useSuspenseQuery(trpc.x.y.queryOptions(input));
> return <List data={data} />;
> ```

**Mutations** — `useMutation` with `onSuccess`/`onError`:

```ts
const queryClient = useQueryClient();
const trpc = useTRPC();

const mutation = useMutation(
  trpc.workflows.create.mutationOptions({
    onSuccess: (data) => {
      toast.success(`Workflow "${data.name}" created`);
      queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions({}));
    },
    onError: (error) => {
      toast.error(`Failed to create workflow: ${error.message}`);
    },
  }),
);
```

## Invalidation — `queryOptions(input)` vs `queryFilter(input)`

| API                   | Match                                                                                                   | Use for                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `queryOptions(input)` | matches the key for that known input — fuzzy partial-match, so `{}` also matches variants with defaults | invalidating one known variant (a specific detail, the default list params) |
| `queryFilter(input)`  | idiomatic filter for invalidating a procedure / input group                                             | invalidating ALL variants (every page/search of a list, all details)        |

Both generate the same query key `[path, { input, type }]`; `invalidateQueries` fuzzy-matches nested objects (`partialMatchKey`), so `queryOptions({})` also hits every variant. The `queryOptions` vs `queryFilter` split is a usage convention (known key vs whole group), not exact-vs-prefix semantics. Repo-verified call sites:

| After                           | Call                                                             | Why                                                       |
| ------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| create / remove / update (list) | `invalidateQueries(trpc.x.getMany.queryOptions({}))`             | default list params = exact key                           |
| remove (detail)                 | `invalidateQueries(trpc.x.getOne.queryFilter({ id: data.id }))`  | detail may have been rendered with different param shapes |
| updateName / update (detail)    | `invalidateQueries(trpc.x.getOne.queryOptions({ id: data.id }))` | exact id known                                            |

```mermaid
flowchart TD
    A[What changed?] --> B[List data]
    B --> C[Invalidate default list: queryOptions {}]
    A --> D[Detail record]
    D --> E{Update or remove?}
    E -- Update --> F[queryOptions { id } — exact]
    E -- Remove --> G[queryFilter { id } — prefix, catches all renderings]
```

`useSuspenseQuery` invalidated data re-renders through suspense; stale `staleTime: 30s` means rapid mutations don't thrash the network.

**Also available**
- `trpc.x.y.pathKey()` / `pathFilter()` — invalidate a whole router/procedure group by its key/filter (see invalidation above).
- `useTRPCClient()` — imperative client for one-off calls outside hooks: `await trpcClient.x.y.query()`.

## Premium error handling — FORBIDDEN → upgrade modal

`TRPCClientError` from `@trpc/client` carries `error.data?.code`. On `FORBIDDEN` (thrown by `premiumProcedure`), open the upgrade modal instead of a generic toast. Repo (`hooks/use-upgrade-modal.tsx`):

```ts
import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { UpgradeModal } from "@/components/upgrade-modal";

export const useUpgradeModal = () => {
  const [open, setOpen] = useState(false);

  const handleError = (error: unknown) => {
    if (error instanceof TRPCClientError) {
      if (error.data?.code === "FORBIDDEN") {
        setOpen(true);
        return true;
      }
    }
    return false;
  };

  const modal = <UpgradeModal open={open} onOpenChange={setOpen} />;
  return { handleError, modal };
};
```

Usage (repo, `features/workflows/components/workflows.tsx`) — wired per call via `mutate`, not in `mutationOptions`:

```ts
const createWorkflow = useCreateWorkflow();
const { handleError, modal } = useUpgradeModal();

const handleCreate = () => {
  createWorkflow.mutate(undefined, {
    onSuccess: (data) => router.push(ROUTES.WORKFLOWS.EDITOR(data.id).path),
    onError: (error) => {
      handleError(error); // opens modal on FORBIDDEN; silent otherwise
    },
  });
};
```

`mutationOptions.onError` works too — but route `FORBIDDEN` through `handleError` before falling back to a toast.

- `error instanceof TRPCClientError` — not `TRPCError` (that's the server class; never import it client-side).
- Check `error.data?.code` (string code) — the numeric JSON-RPC `error.code` is easy to confuse (`-32003` FORBIDDEN, `-32004` NOT_FOUND); trust the string.
- Other errors → `toast.error(error.message)` (repo pattern throughout `use-workflows.ts`).

## Checklist for a new client hook

1. `useTRPC()` + `useQueryClient()` at top.
2. Queries: `useSuspenseQuery(trpc.x.y.queryOptions(input))` by default.
3. Mutations: `.mutationOptions({ onSuccess, onError })`, toast on both paths.
4. Invalidate the affected list + detail per the table above.
5. Premium-gated mutations: route `FORBIDDEN` to the upgrade modal.
