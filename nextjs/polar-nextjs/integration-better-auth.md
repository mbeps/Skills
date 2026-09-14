# Integration with Better Auth

## Server Configuration

The `@polar-sh/better-auth` package integrates Polar into the auth layer through a plugin. All Polar HTTP traffic flows through `/api/auth/[...all]`.

```ts
import { polar, checkout, portal } from "@polar-sh/better-auth";
import { polarClient } from "@/lib/polar";
import { env } from "@/config/env";

export const auth = betterAuth({
  // ... other config
  plugins: [
    ...(env.NEXT_PUBLIC_ENABLE_POLAR === "true"
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
              checkout({
                products: [
                  {
                    productId: env.POLAR_PRODUCT_ID,
                    slug: env.NEXT_PUBLIC_POLAR_PRODUCT_SLUG,
                  },
                ],
                successUrl: env.POLAR_SUCCESS_URL,
                authenticatedUsersOnly: true,
              }),
              portal(),
            ],
          }),
        ]
      : []),
  ],
});
```

### Plugin Options

| Option                   | Type                      | Default  | Description                                   |
| ------------------------ | ------------------------- | -------- | --------------------------------------------- |
| `client`                 | `Polar` instance          | Required | The SDK singleton for API calls               |
| `createCustomerOnSignUp` | `boolean`                 | `false`  | Auto-create Polar customer on user signup     |
| `use.checkout`           | Array of checkout configs | —        | Maps slugs to product IDs for hosted checkout |
| `use.portal`             | Config object             | —        | Enables self-service portal access            |

### Checkout Configuration

| Field                    | Required | Description                                  |
| ------------------------ | -------- | -------------------------------------------- |
| `productId`              | Yes      | Polar product ID (server-side only)          |
| `slug`                   | Yes      | Alias used in client-side checkout calls     |
| `successUrl`             | Yes      | URL user returns to after payment            |
| `authenticatedUsersOnly` | Optional | Prevent anonymous checkouts (default `true`) |

Multiple products can be listed in the `products` array. Each gets its own slug alias.

## Client Configuration

Add the Polar plugin to the auth client:

```ts
import { polarClient as polarClientPlugin } from "@polar-sh/better-auth";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    ...(process.env.NEXT_PUBLIC_ENABLE_POLAR === "true"
      ? [polarClientPlugin()]
      : []),
  ],
});
```

### Client Methods

| Method                          | Returns                   | Description                                |
| ------------------------------- | ------------------------- | ------------------------------------------ |
| `authClient.checkout({ slug })` | `RedirectResponse`        | Redirect to hosted checkout for given slug |
| `authClient.customer.state()`   | `{ data: CustomerState }` | Get full subscription state                |
| `authClient.customer.portal()`  | `RedirectResponse`        | Redirect to self-service portal            |

## externalId Mapping

Polar's `externalId` replaces a local subscription table. The Better Auth plugin maps your user ID to this field automatically when `createCustomerOnSignUp: true`:

```
Better Auth user.id → Polar customer externalId
```

The `externalId` is **immutable** once set. Use it consistently across all API lookups:

```ts
// tRPC premiumProcedure lookup
const customer = await polarClient.customers.getStateExternal({
  externalId: ctx.auth.user.id,
});

// Creating subscriptions via SDK requires matching externalId
await polarClient.subscriptions.create({
  externalCustomerId: ctx.auth.user.id,
  productId: "the-product-id",
});
```

## Webhook Handling

Webhooks are handled **automatically** by `@polar-sh/better-auth` at `/api/auth/[...all]`. No custom route handler is needed. The plugin processes events like `subscription.created`, `order.paid`, and `subscription.canceled` internally.

If you need custom webhook logic (e.g., triggering background jobs), add a separate raw POST endpoint that validates signatures yourself using the SDK:

```ts
import { validateEvent } from "@polar-sh/sdk/webhooks";

export async function POST(request: Request) {
  const signature = request.headers.get("polar-webhook-signature");
  const body = await request.text(); // Do NOT parse JSON yet
  
  try {
    const event = validateEvent(body, signature!, WEBHOOK_SECRET);
    
    switch (event.type) {
      case "subscription.active":
        // Trigger provisioning job
        break;
      case "subscription.canceled":
        // Revoke access
        break;
    }
    
    return new Response(null, { status: 202 });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }
}
```

Key rules:
- Read raw body text, never `req.json()` before validation
- Return `202` quickly within 2 seconds — offload heavy work to a background queue
- Webhooks retry up to 10 times with exponential backoff
- Implement idempotency — the same event may arrive multiple times
