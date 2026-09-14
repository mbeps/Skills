# Webhooks

## Signature Verification

Stripe webhooks require signature verification to authenticate incoming requests. This is non-negotiable — without it, anyone can fake webhook events.

### App Router Pattern (Recommended)

```typescript
// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Stripe } from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new NextResponse('STRIPE_WEBHOOK_SECRET not configured', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      console.error('Webhook signature mismatch');
      return new NextResponse('Webhook signature mismatch', { status: 400 });
    }
    console.error(`Webhook Error: ${errorMessage}`);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // Handle event
  await handleWebhookEvent(event);

  return NextResponse.json({ received: true });
}

async function handleWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // Link subscription to user
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      // Sync subscription state
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      // Deactivate subscription
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      // Update billing period
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      // Notify user
      break;
    }
    default:
      console.warn(`Unhandled event type: ${event.type}`);
  }
}
```

### Critical Rules

1. **Use `req.text()` not `req.json()`** — Stripe computes the HMAC over the raw request body. Any framework-level JSON parsing mutates the body and breaks verification.
2. **Read the signature header before parsing** — `headers().get('stripe-signature')` must be read before any body consumption.
3. **Return 200 on success** — Stripe expects a 2xx response. Non-2xx responses trigger retries.
4. **Return 400 on signature failure** — Do NOT log sensitive payload data. Return a generic message.

## Idempotency

Webhooks can arrive multiple times. Always check for duplicate processing:

```typescript
async function handleWebhookEvent(event: Stripe.Event) {
  // Check if already processed
  const existing = await prismadb.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });

  if (existing) {
    console.log(`Event ${event.id} already processed`);
    return;
  }

  // Process event
  // ...

  // Record processing
  await prismadb.webhookEvent.create({
    data: {
      stripeEventId: event.id,
      type: event.type,
      processedAt: new Date(),
    },
  });
}
```

## Local Development

Use the Stripe CLI to forward webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

This generates a `whsec_...` webhook secret. Set it in `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_generated_from_cli
```

Test with the provided test webhook secret for development. Rotate to production secret before deploying.

## Event Types Reference

| Event                           | Object             | Common Use                      |
| ------------------------------- | ------------------ | ------------------------------- |
| `checkout.session.completed`    | `Checkout.Session` | User completed checkout         |
| `customer.created`              | `Customer`         | Log new customer                |
| `customer.updated`              | `Customer`         | Sync customer info              |
| `customer.deleted`              | `Customer`         | Clean up references             |
| `customer.subscription.created` | `Subscription`     | Create subscription record      |
| `customer.subscription.updated` | `Subscription`     | Sync plan/status changes        |
| `customer.subscription.deleted` | `Subscription`     | Deactivate subscription         |
| `invoice.payment_succeeded`     | `Invoice`          | Confirm payment, update period  |
| `invoice.payment_failed`        | `Invoice`          | Alert user about failed payment |
| `invoice.finalization_failed`   | `Invoice`          | Investigate billing issue       |
| `payment_intent.succeeded`      | `PaymentIntent`    | Confirm payment completion      |
| `payment_intent.payment_failed` | `PaymentIntent`    | Notify user of payment failure  |
| `charge.dispute.created`        | `Charge`           | Handle dispute                  |
| `charge.dispute.closed`         | `Charge`           | Dispute resolved                |
