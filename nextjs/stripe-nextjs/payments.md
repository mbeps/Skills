# Checkout & Payments

## Creating Checkout Sessions

Checkout sessions handle payment collection in a single API call. Use for one-time payments or subscriptions.

### Subscription Checkout

```typescript
// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getStripeClient } from '@/lib/stripe';
import prismadb from '@/lib/prismadb';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const stripe = getStripeClient();

  // Check if user already has a Stripe customer
  let customerId: string;
  const existing = await prismadb.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (existing?.stripeCustomerId) {
    customerId = existing.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      metadata: { userId },
    });
    customerId = customer.id;

    // Link customer to user in DB
    await prismadb.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    metadata: { userId },
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?canceled=true`,
    subscription_data: {
      metadata: { userId },
    },
  });

  return NextResponse.json({ url: session.url });
}
```

### One-Time Payment Checkout

```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  customer: customerId,
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: { name: 'One-time purchase' },
        unit_amount: 2000, // $20.00 in cents
      },
      quantity: 1,
    },
  ],
  metadata: { userId },
  success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/purchase?success=true`,
  cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/`,
});
```

### Key Patterns

- **Reuse customers**: Always check for existing `stripeCustomerId` before creating new customers. Creating duplicate customers leads to fragmented payment history.
- **Metadata redundancy**: Set `userId` on both the session and `subscription_data.metadata`. Session metadata may be cleared after conversion to subscription.
- **Price vs price_data**: Use `price` (a Price ID from your Stripe dashboard) for recurring plans. Use `price_data` for one-off dynamic amounts.
- **Customer email**: Omit `customer_email` to let Stripe collect it during checkout. Supply it if you want to skip email collection.

## Billing Portal

For existing subscribers, redirect to Stripe's managed billing portal instead of building your own:

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
});
```

The portal handles plan changes, payment method updates, and cancellations.

## Payment Intents

For custom payment flows (not using Checkout):

```typescript
// Create payment intent
const intent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  customer: customerId,
  automatic_payment_methods: { enabled: true },
});

// Confirm payment intent
const confirmed = await stripe.paymentIntents.confirm(intent.id, {
  payment_method: 'pm_123',
});
```

Payment intents track the full lifecycle: `requires_payment_method` → `processing` → `succeeded` or `requires_action`.

## Invoice Items

Add charges to a customer's next invoice:

```typescript
await stripe.invoiceItems.create({
  customer: customerId,
  amount: 500, // $5.00
  currency: 'usd',
  description: 'Setup fee',
});
```
