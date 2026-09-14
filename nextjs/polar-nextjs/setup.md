# Setup

## Installation

```bash
npm install @polar-sh/sdk @polar-sh/better-auth zod
```

`zod` is a peer dependency of `@polar-sh/nextjs` adapter components. If you are using the Better Auth plugin path (recommended), `zod` may not be required unless you also use route handler adapters directly.

## Environment Variables

| Variable                         | Required | Description                                          | Example                         |
| -------------------------------- | -------- | ---------------------------------------------------- | ------------------------------- |
| `POLAR_ACCESS_TOKEN`             | Yes      | Organisation Access Token (OAT) from Polar dashboard | `polar_oat_xxx`                 |
| `POLAR_PRODUCT_ID`               | Yes      | Polar product ID for the checkout product            | `67890abcdef`                   |
| `NEXT_PUBLIC_POLAR_PRODUCT_SLUG` | Yes      | Slug alias mapping to the Polar product ID           | `pro-plan`                      |
| `NEXT_PUBLIC_ENABLE_POLAR`       | Optional | Feature toggle (`"true"` enables billing)            | `"true"` or `"false"`           |
| `POLAR_SUCCESS_URL`              | Optional | Redirect URL after successful payment                | `https://example.com/dashboard` |
| `POLAR_WEBHOOK_SECRET`           | Optional | Webhook signature verification secret                | `whsec_xxx`                     |

Generate OAT: go to your Polar organisation settings → Developer → Access Tokens. The token starts with `polar_oat_`. GitHub's secret scanning will auto-revoke any leaked tokens, so never commit this value.

Create products in the Polar dashboard first, then copy the Product ID and set a slug. The slug is used on the client side because product IDs should stay server-side only.

## SDK Client Singleton

Create `lib/polar.ts`:

```ts
import { Polar } from "@polar-sh/sdk";
import { env } from "@/config/env";

export const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "sandbox", // Change to "production" when deploying live
});
```

**Rules:**
- One singleton instance per application lifecycle
- Never pass `accessToken` in browser code — environment variables prefixed `NEXT_PUBLIC_` are visible to clients
- Set `server: "sandbox"` during development to avoid real charges
- Production deployments should derive the server mode from an env var rather than hardcoding

```ts
// Recommended pattern for production readiness
export const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: env.NODE_ENV === "production" ? "production" : "sandbox",
});
```

## Sandbox Testing

Polar sandbox provides:

- Fake credit cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (declined)
- Transactional emails only reach organisation members
- Use email aliases for testing: `you+test@example.com`, `alice+sub1@example.com`
- Data is completely isolated from production

## Migration Checklist

- [ ] Install `@polar-sh/sdk` and `@polar-sh/better-auth`
- [ ] Configure environment variables
- [ ] Create SDK singleton in `lib/polar.ts`
- [ ] Add Polar plugin to Better Auth server config
- [ ] Add `polarClient()` plugin to auth client
- [ ] Build `premiumProcedure` for tRPC subscription gates
- [ ] Create subscription state hooks
- [ ] Add upgrade modal and sidebar CTA
- [ ] Verify webhooks receive events (check Polar dashboard webhook logs)
- [ ] Test sandbox flow end-to-end: signup → checkout → webhook → access granted
