---
name: stripe-nextjs
description: Use when integrating Stripe into a Next.js App Router TypeScript project — client setup, checkout sessions, subscription management, webhook signature verification, error handling, billing portal, or migrating from older Stripe patterns
---

# Stripe + Next.js

## Overview

Stripe integration guide for Next.js App Router projects. Covers client setup, checkout, subscriptions, webhooks, error handling, and billing portal. Grounded in stripe-node v22+ with TypeScript.

## When to Use

- Setting up Stripe client in a Next.js project
- Creating checkout sessions for one-time payments or subscriptions
- Managing subscriptions (create, update, cancel, retrieve)
- Handling Stripe webhooks with signature verification
- Processing payment intents
- Integrating billing portal for subscription management
- Error handling with Stripe error types
- Migrating from older Stripe API versions or deprecated patterns

## When NOT to Use

- Payment UI/UX design → use Stripe Elements or Checkout hosted pages
- Financial reporting or reconciliation → external accounting system
- Complex multi-currency pricing logic → custom business layer

## Core Pattern

```
User action → API route → Stripe SDK call → Response
                              ↓
                      Webhook event → Process → Update DB
```

All Stripe API calls go through Server Actions or API routes. Never call Stripe SDK from client components.

## Quick Reference

| Task | File | Key Method |
|------|------|------------|
| Client setup | `setup.md` | `getStripeClient()` lazy init |
| Checkout | `payments.md` | `stripe.checkout.sessions.create()` |
| Subscriptions | `subscriptions.md` | `stripe.subscriptions.create()` |
| Webhooks | `webhooks.md` | `stripe.webhooks.constructEvent()` |
| Errors | `errors.md` | `instanceof Stripe.errors.StripeError` |

## Common Mistakes

- Calling `req.json()` before webhook signature verification → must use `req.text()`
- Hardcoding price IDs → use environment variables
- Creating new customer on every checkout → reuse `stripeCustomerId`
- No idempotency on webhook processing → duplicate charges/refunds
- Mixing test and live keys → separate env files per environment
- Using deprecated `customers.createSubscription()` → use `subscriptions.create()`

## Real-World Impact

Projects using this skill avoid: webhook signature failures from body parsing, duplicate subscription charges from missing idempotency, stale subscription state from not listening to `invoice.payment_failed`, and API key leaks from client-side Stripe calls.

## Testing Patterns

### Unit Testing with stripe-mock

```bash
npm install --save-dev @stripe/stripe-mock
```

```bash
stripe-mock -p 12111
```

Configure test Stripe client to point at localhost:

```typescript
const stripe = new Stripe('sk_test_placeholder', {
  apiVersion: Stripe.API_VERSION,
  host: 'localhost',
  port: 12111,
  protocol: 'http',
});
```

### Integration Testing Webhooks

Use the Stripe CLI for local webhook forwarding:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

Test event generation:

```bash
stripe trigger checkout.session.completed
```

### Environment Isolation

| Environment | Keys | Webhook Secret |
|-------------|------|----------------|
| Local dev | `sk_test_*` | From `stripe listen` |
| Staging | `sk_test_*` | From Stripe dashboard |
| Production | `sk_live_*` | From Stripe dashboard |

Never use live keys in non-production environments.
