# Client Setup

## Installation

```bash
npm install stripe
```

TypeScript types are included with the package.

## Environment Variables

Required variables:

```env
STRIPE_SECRET_KEY=sk_test_...        # Server-side only, never expose
STRIPE_PUBLISHABLE_KEY=pk_test_...   # Client-side safe (Next.js public prefix)
STRIPE_WEBHOOK_SECRET=whsec_...      # For webhook signature verification
STRIPE_PRICE_ID=price_...            # Default price for checkout
```

For local development, use test keys. For production, use live keys. Never mix environments.

## Lazy Client Initialization

Create a singleton client with lazy initialization to avoid missing env var errors at build time:

```typescript
// lib/stripe.ts
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: Stripe.API_VERSION,
      typescript: true,
      maxNetworkRetries: 2,
      telemetry: true,
    });
  }
  return _stripe;
};
```

**Why lazy?** Next.js can evaluate imports during build. If `STRIPE_SECRET_KEY` is undefined at build time, eager initialization throws. Lazy init defers until first API route call.

### Placeholder Pattern (Alternative)

If lazy init causes issues with tree-shaking or testing:

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || 'api_key_placeholder',
  { apiVersion: Stripe.API_VERSION }
);
```

The placeholder prevents null-key errors at import time. The real key is used at runtime.

## Configuration Options

| Option              | Type                     | Default          | Description                            |
| ------------------- | ------------------------ | ---------------- | -------------------------------------- |
| `apiVersion`        | `LatestApiVersion`       | SDK default      | Stripe API version                     |
| `typescript`        | `true`                   | `false`          | Adds "TypeScript" to user-agent header |
| `maxNetworkRetries` | `number`                 | `2`              | Network retry attempts                 |
| `timeout`           | `number`                 | `80000`          | Request timeout in ms                  |
| `telemetry`         | `boolean`                | `true`           | Allow Stripe telemetry                 |
| `appInfo`           | `{name, version?, url?}` | `{}`             | Plugin identification                  |
| `stripeAccount`     | `string`                 | `null`           | Connect account ID (platforms)         |
| `host`              | `string`                 | `api.stripe.com` | Custom API host                        |

## TypeScript Types

All resource types are available under the `Stripe` namespace:

```typescript
import Stripe from 'stripe';

// Resources
Stripe.Customer
Stripe.Subscription
Stripe.Checkout.Session
Stripe.PaymentIntent
Stripe.Invoice
Stripe.Price

// Param types
Stripe.CustomerCreateParams
Stripe.SubscriptionCreateParams
Stripe.CheckoutSessionCreateParams

// Response wrappers
Stripe.Response<T>
Stripe.ApiList<T>
```

Expandable fields are typed as `string | Resource`. Cast explicitly:

```typescript
const customer = await stripe.customers.retrieve('cus_123', {
  expand: ['default_source'],
});
const card = customer.default_source as Stripe.Card;
```

## Migrating from Older Versions

| Old Pattern                             | New Pattern                                                             |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `new Stripe(key)` without config        | `new Stripe(key, { apiVersion: Stripe.API_VERSION, typescript: true })` |
| `stripe.customers.createSubscription()` | `stripe.subscriptions.create()`                                         |
| `stripe.charges.refund()`               | `stripe.refunds.create({charge})`                                       |
| `stripe.customerSubscriptions.*`        | `stripe.subscriptions.*`                                                |
| Callback-based code                     | `async/await`                                                           |
| `setApiVersion()` method                | Pass `apiVersion` in constructor config                                 |
