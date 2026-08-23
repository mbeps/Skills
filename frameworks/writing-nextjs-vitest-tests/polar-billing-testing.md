# Polar.sh Billing Test Patterns

## Overview

Testing Polar.sh subscription gating requires mocking the SDK at module level, bypassing the premium check via context injection, and testing dynamic import/env stubbing for conditional plugin inclusion.

## When to Use

- Testing `premiumProcedure` tRPC procedures that gate features behind subscriptions
- Testing dynamic auth-client initialisation with/without Polar plugin
- Verifying FORBIDDEN errors trigger upgrade modal flows
- Testing checkout/portal URL generation

**Not for:** webhook parsing (use separate integration tests), Polar dashboard automation, or subscription data storage verification.

## Core Mock Structure

### Global Mock (`__tests__/__mocks__/polar.ts`)

```typescript
export const polarMock = {
  customers: {
    getStateExternal: vi.fn(), // Returns undefined by default
  },
};

vi.mock("@/lib/polar", () => ({
  polarClient: polarMock,
}));
```

| Export                                 | Purpose                                                           | Behaviour                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `polarMock.customers.getStateExternal` | Replaces `polarClient.customers.getStateExternal({ externalId })` | Returns `undefined` by default. Tests must set `.mockResolvedValueOnce()` for specific responses. |

### Real SDK Shape

```typescript
// lib/polar.ts
import { Polar } from "@polar-sh/sdk";

export const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: env.NODE_ENV === "production" ? "production" : "sandbox",
});
```

The real `getStateExternal` returns:
```typescript
{ activeSubscriptions: string[] } // array of plan IDs
```

## Testing Premium Procedures

### Bypass Pattern (Recommended)

The `premiumProcedure` has a test-mode bypass:

```typescript
// trpc/init.ts — premiumProcedure middleware
if (
  env.NEXT_PUBLIC_ENABLE_POLAR !== "true" ||
  (process.env.NODE_ENV === "test" && (ctx as any).customer)
) {
  return next({ ctx: { ...ctx, customer: (ctx as any).customer || null } });
}
```

Bypass by injecting `{ customer: {} }` into the caller context:

```typescript
const ctx = { auth: { user: { id: "user_123" } } };
const ctxPremium = { ...ctx, customer: {} }; // ← bypasses Polar API call
const premiumCaller = appRouter.createCaller(ctxPremium as any);

const result = await premiumCaller.workflows.create({ name: "Test Workflow" });
expect(result.id).toBeDefined();
```

### Active Subscription Test

When you need to verify the Polar check itself:

```typescript
it("throws FORBIDDEN when no active subscription", async () => {
  polarMock.customers.getStateExternal.mockResolvedValueOnce({
    activeSubscriptions: [],
  });

  const ctx = { auth: { user: { id: "user_123" } } };
  const caller = appRouter.createCaller(ctx as any);

  await expect(caller.workflows.create({ name: "Test" })).rejects.toThrow(
    /FORBIDDEN|Active subscription required/,
  );
});

it("allows creation with active subscription", async () => {
  polarMock.customers.getStateExternal.mockResolvedValueOnce({
    activeSubscriptions: ["plan_abc"],
  });

  const ctx = { auth: { user: { id: "user_123" } } };
  const caller = appRouter.createCaller(ctx as any);

  prismaMock.workflow.create.mockResolvedValueOnce({ id: "wf_1", name: "Test", userId: "user_123" });
  const result = await caller.workflows.create({ name: "Test" });
  expect(result.id).toBe("wf_1");
});
```

## Dynamic Import/Env Stubbing

For testing conditional auth-client initialisation:

```typescript
describe("authClient", () => {
  beforeEach(() => {
    vi.resetModules(); // Clear module registry
  });

  it("includes Polar plugin when ENABLE_POLAR is true", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_POLAR", "true");
    const { authClient } = await import("@/lib/auth-client");
    expect(polarClient).toHaveBeenCalled();
  });

  it("excludes Polar plugin when ENABLE_POLAR is false", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_POLAR", "false");
    const { authClient } = await import("@/lib/auth-client");
    expect(authClient.config.plugins).toHaveLength(0);
  });
});
```

Pattern breakdown:
1. `vi.resetModules()` — clears cached imports
2. `vi.stubEnv()` — sets env var before dynamic import resolves
3. `await import("@/lib/auth-client")` — dynamic import reads env at evaluation time
4. Assert side effects on mocked dependencies

## Upgrade Modal Trigger

Client-side behaviour not covered by router tests:

```typescript
// hooks/use-upgrade-modal.tsx intercepts TRPCClientError
// Code pattern (not tested directly):
// if (TRPCClientError.isOfCode(error, "FORBIDDEN")) { openUpgradeModal() }
```

To test this, render the hook in a component and assert the modal opens after a FORBIDDEN error.

## Gotchas

1. **NODE_ENV dependency** — The bypass relies on `process.env.NODE_ENV === "test"`. Vitest typically sets this automatically, but if you run tests with a custom NODE_ENV, the Polar API will be called and fail.
2. **Mock returns undefined by default** — `getStateExternal()` returns `undefined` unless explicitly stubbed. Accessing `.activeSubscriptions` on `undefined` throws. Always set a return value.
3. **No other Polar methods mocked** — Only `customers.getStateExternal` is mocked. If any procedure calls `orders`, `subscriptions`, or `checkouts`, they'll throw at runtime.
4. **Plugin length check over call assertion** — The second dynamic import test checks `plugins.length === 0` rather than asserting `polarClient` was NOT called, because the mock fn persists across tests.

## References

- [Polar.sh SDK](https://docs.polar.sh/billing-integration/backend-sdk/nodejs)
- [Polar.sh Better Auth Plugin](https://docs.polar.sh/billing-integration/better-auth)
- [Vitest Dynamic Imports](https://vitest.dev/api/vi.html#vi-dynamic-import)
