# Subscriptions

## Creating a Subscription

```typescript
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: process.env.STRIPE_PRICE_ID }],
  payment_behavior: 'default_incomplete',
  payment_settings: { save_default_payment_method: 'on_session' },
  expand: ['latest_invoice.payment_intent'],
  metadata: { userId },
});
```

- `payment_behavior: 'default_incomplete'` creates the subscription immediately but marks it incomplete until payment succeeds.
- `expand: ['latest_invoice.payment_intent']` returns the payment intent URL for client-side confirmation (3D Secure).
- `metadata.userId` links the subscription to your app user.

## Retrieving a Subscription

```typescript
const subscription = await stripe.subscriptions.retrieve(subscriptionId);

// Check if currently active
const isActive = subscription.status === 'active';

// Check if trial period
const trialEnds = subscription.current_period_end;
```

Status values: `draft`, `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, `paused`.

## Updating a Subscription

Change plan mid-cycle:

```typescript
await stripe.subscriptions.update(subscriptionId, {
  items: [{ price: newPriceId, id: existingItemId }],
  proration_behavior: 'always_invoice',
});
```

- `proration_behavior: 'always_invoice'` creates an immediate prorated invoice.
- `proration_behavior: 'none'` defers proration to next cycle.
- Find `existingItemId` via `subscription.items.data[0].id`.

## Canceling a Subscription

```typescript
// Cancel immediately
await stripe.subscriptions.cancel(subscriptionId);

// Cancel at end of period
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true,
});

// To undo cancellation
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: false,
});
```

## Listing Subscriptions

```typescript
const subscriptions = await stripe.subscriptions.list({
  customer: customerId,
  limit: 10,
});
```

## Subscription Webhook Events

Listen to these events to keep your database in sync:

| Event                           | Action                                       |
| ------------------------------- | -------------------------------------------- |
| `customer.subscription.created` | Create subscription record in DB             |
| `customer.subscription.updated` | Sync plan changes, status, period dates      |
| `customer.subscription.deleted` | Mark subscription as inactive/canceled       |
| `invoice.payment_succeeded`     | Renewal succeeded, update `currentPeriodEnd` |
| `invoice.payment_failed`        | Notify user to update payment method         |
| `customer.invoice_created`      | Invoice ready, review for disputes           |

See `webhooks.md` for processing patterns.

## Checking Subscription Status

Server-side check pattern:

```typescript
import { auth } from '@clerk/nextjs';
import prismadb from '@/lib/prismadb';

export async function checkSubscription() {
  const { userId } = auth();
  if (!userId) return false;

  const userSub = await prismadb.userSubscription.findUnique({
    where: { userId },
  });

  if (!userSub) return false;

  const isValid =
    userSub.stripeCustomerId &&
    (userSub.stripeCurrentPeriodEnd?.getTime() ?? 0) > Date.now();

  return !!isValid;
}
```

Check against Stripe directly when doubt exists:

```typescript
const sub = await stripe.subscriptions.retrieve(userSub.stripeSubscriptionId);
const isValid = sub.status === 'active' && sub.current_period_end * 1000 > Date.now();
```
