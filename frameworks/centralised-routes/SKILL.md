---
name: centralised-routes
description: Use when designing or refactoring Next.js route definitions, route constants, or typed URL helpers without leaking app-specific auth, redirect, protected-route, or navigation logic into the route registry.
---

# Centralised Routes

## Overview

Centralise route paths in one small typed registry. The route file should be the source of truth for path strings and dynamic URL helpers only; keep redirects, auth guards, protected-route checks, and navigation effects elsewhere.

## When to Use

Use this when you are:

- Refactoring hardcoded path strings into a central route module.
- Adding or renaming Next.js App Router pages.
- Creating typed helpers for dynamic routes such as `/settings/[id]` or `/inventory/[slug]`.
- Splitting duplicated route construction across server actions, client components, and redirects.
- Cleaning up a route registry without adding app-specific business logic.

## Core Pattern

Use the smallest useful abstraction:

1. Define base path constants.
2. Group routes by domain.
3. Use static strings for static routes.
4. Use helper functions for dynamic routes.
5. Add lightweight parameter validation only when the route needs it.
6. Export the final `ROUTES` object as `as const`.

```ts
const SETTINGS_BASE = "/settings";
const PRODUCTS_BASE = "/products";

export const ROUTES = {
  HOME: { path: "/" },
  SETTINGS: {
    path: SETTINGS_BASE,
    detail: (id: string) => `${SETTINGS_BASE}/${id}`,
  },
  PRODUCTS: {
    path: PRODUCTS_BASE,
    detail: (id: string) => `${PRODUCTS_BASE}/${id}`,
  },
} as const;

export type Routes = typeof ROUTES;
```

## Dynamic Routes

Prefer a helper over a string template at every call site.

```ts
const ORDERS_BASE = "/orders";

export const ROUTES = {
  ORDERS: {
    path: ORDERS_BASE,
    label: "Orders",
    detail: (id: string) => `${ORDERS_BASE}/${id}`,
  },
};
```

Use `ROUTES.ORDERS.detail("123")`, not `` `/orders/123` ``.

## Validation

Validate route parameters only when needed, and make the validation route-specific. Some apps use UUIDs, slugs, numeric IDs, or database keys; keep the regex or parser close to the helper that builds the path.

```ts
const CUSTOMER_ID = /^[a-z0-9_-]{8,64}$/;

function customerId(id: string): string {
  if (!CUSTOMER_ID.test(id)) {
    throw new Error("Invalid customer id");
  }

  return id;
}

export const ROUTES = {
  CUSTOMERS: {
    path: "/customers",
    label: "Customers",
    detail: (id: string) => `/customers/${customerId(id)}`,
  },
};
```

## Keep Separate

Do **not** put these in the route registry:

- Protected-route lists.
- Sign-in, sign-up, redirect, or auth helpers.
- Server actions or mutations.
- Navigation components or menu ordering.
- Business rules for whether a user can access a page.

Those belong in separate files such as auth helpers, middleware/proxy logic, redirects, or navigation items.

## Common Mistakes

| Mistake | Better approach |
|---|---|
| Moving strings into one file but still interpolating at every call site | Use typed helper functions for dynamic routes |
| Mixing route paths with protected-route logic | Keep route definitions and route protection separate |
| Adding classes, factories, or generated-code complexity | Start with constants, groups, and helper functions |
| Adding lots of metadata to every route | Add metadata only when consumers need it |
| Repeating `/settings/[id]` strings in actions, components, and tests | Call the dynamic route helper |

## Minimal Tests

Cover the invariants that catch route drift.

```ts
import { describe, expect, it } from "vitest";
import { ROUTES } from "@/constants/routes";

describe("ROUTES", () => {
  it("returns the static route", () => {
    expect(ROUTES.SETTINGS.path).toBe("/settings");
  });

  it("builds dynamic routes", () => {
    expect(ROUTES.SETTINGS.detail("123")).toBe("/settings/123");
  });

  it("keeps unrelated routes unchanged", () => {
    expect(ROUTES.HOME.path).toBe("/");
  });
});
```

## Quality Checklist

- Hardcoded app path strings are centralised where practical.
- Dynamic routes are built by helpers, not call-site template strings.
- The registry contains paths only, not redirects or auth behavior.
- `as const` is used so TypeScript preserves the shape.
- Tests cover at least one static route, one dynamic route, and one unrelated route.
