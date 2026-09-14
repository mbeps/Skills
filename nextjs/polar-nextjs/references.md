# References

## Official Documentation

| Resource           | URL                                                  |
| ------------------ | ---------------------------------------------------- |
| Polar Docs Home    | https://docs.polar.sh                                |
| Core API Reference | https://api-docs.polar.sh/                           |
| TypeScript SDK     | https://github.com/polar-sh/polar/tree/main/libs/sdk |
| Better Auth Plugin | https://github.com/polar-sh/better-auth              |
| Webhook Events     | https://docs.polar.sh/reference/webhooks             |

## API Versioning

SDK imports pin to an API version via path segments:

```ts
// Each import path selects a different API version
import { createPolar } from "@polar-sh/sdk/2026-04";
import { createPolar } from "@polar-sh/sdk/2026-10";
```

Current versions available: `2026-04` and `2026-10`. Check docs.polar.sh for updates. The class-based constructor (`new Polar()`) used in this skill does not require version-pinned imports.

## Base URLs

| Environment | API Base URL                      |
| ----------- | --------------------------------- |
| Production  | `https://api.polar.sh/v1`         |
| Sandbox     | `https://sandbox-api.polar.sh/v1` |

Set via `server: "production"` or `server: "sandbox"` in the constructor.

## Token Formats

| Token Type                | Format            | Use Case                                         |
| ------------------------- | ----------------- | ------------------------------------------------ |
| Organisation Access Token | `polar_oat_xxx`   | Server-side SDK client operations                |
| Customer Access Token     | Short-lived token | Customer Portal API only (generated server-side) |
| Webhook Secret            | `whsec_xxx`       | Standard Webhooks signature verification         |

⚠️ GitHub secret scanning automatically detects and revokes leaked `polar_oat_` tokens. Never commit tokens.

## Webhook Event Taxonomy

### Checkout Events
- `checkout.created` — New checkout session started
- `checkout.updated` — Checkout session modified
- `checkout.expired` — Checkout session expired without completion

### Customer Events
- `customer.created` — New customer registered with Polar
- `customer.updated` — Customer information changed
- `customer.deleted` — Customer removed
- `customer.state_changed` — Subscription/credit state changed

### Subscription Events
- `subscription.created` — Subscription created
- `subscription.active` — First payment succeeded
- `subscription.updated` — Subscription details changed
- `subscription.canceled` — Subscription cancelled (future effective date)
- `subscription.uncanceled` — Cancellation revoked
- `subscription.cycled` — Next billing cycle processed
- `subscription.revoked` — Subscription access removed
- `subscription.past_due` — Payment failed for current cycle
- `subscription.paused` — Billing paused temporarily
- `subscription.resumed` — Billing resumed after pause

### Order Events
- `order.created` — New order placed
- `order.paid` — Payment received
- `order.updated` — Order details changed
- `order.refunded` — Refund processed

### Refund Events
- `refund.created` — Refund initiated
- `refund.updated` — Refund status changed

### Benefit Events
- `benefit.created` — New benefit configured for a product
- `benefit.updated` — Benefit modified
- `benefit_grant.created` — User granted a benefit
- `benefit_grant.updated` — Benefit grant modified
- `benefit_grant.revoked` — User lost access to benefit
- `benefit_grant.cycled` — Benefit renewed with subscription

### Product & Discount Events
- `product.created` / `product.updated` — Product changes
- `discount.created` / `discount.updated` / `discount.deleted` — Promo code events
- `organization.updated` — Organisation settings changed

## Rate Limits

| Endpoint Type                                          | Limit                   |
| ------------------------------------------------------ | ----------------------- |
| Production API                                         | 500 requests per minute |
| Sandbox API                                            | 100 requests per minute |
| License validate/activate/deactivate (unauthenticated) | 3 requests per second   |

Exceeding limits returns HTTP 429. Implement exponential backoff on retry.

## Pricing Tiers

| Tier    | Platform Fee | Per Transaction |
| ------- | ------------ | --------------- |
| Starter | Free         | 5% + 50¢        |
| Pro     | $20/month    | 3.80% + 40¢     |
| Growth  | $100/month   | 3.60% + 35¢     |
| Scale   | $400/month   | 3.40% + 30¢     |

Startup Program provides Scale features free for 12 months.

## Testing Resources

### Sandbox Credit Cards
| Card Number               | Result        |
| ------------------------- | ------------- |
| `4242 4242 4242 4242`     | Success       |
| `4000 0000 0000 0002`     | Declined      |
| Any other 16-digit number | Random result |

### Email Aliases
Sandbox transactional emails only reach organisation members. Use sub-addressing:
```
you+test@example.com      → your inbox, identified as test user
alice+sub1@example.com    → alice's inbox, separate identity
```
