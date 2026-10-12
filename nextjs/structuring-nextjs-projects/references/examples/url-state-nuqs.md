# Worked Example: URL State Management with Nuqs

Type-safe URL query parameter synchronization using `nuqs`.

## Example 6: URL State Management with Nuqs

### Scenario
URL query parameter state management for search, filtering, and pagination where only non-default values appear in the browser URL.

---

### 1. Setup in Providers (`providers/providers.tsx`)

```typescript
'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      {children}
    </NuqsAdapter>
  );
}
```

---

### 2. Custom Filter Hook with Nuqs (`hooks/use-song-filter-state.ts`)

```typescript
'use client';

import { parseAsString, parseAsInteger, parseAsBoolean, useQueryStates } from 'nuqs';

export default function useSongFilterState() {
  const [params, setParams] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      archived: parseAsBoolean.withDefault(false),
    },
    {
      history: 'push',
      shallow: true,
      clearOnDefault: true, // Only non-defaults appear in the URL
    },
  );

  return {
    query: params.query,
    page: params.page,
    archived: params.archived,
    setSearch: (query: string) => setParams({ query, page: 1 }),
    setPage: (page: number) => setParams({ page }),
    toggleArchived: () => setParams((prev) => ({ archived: !prev.archived })),
  };
}
```

