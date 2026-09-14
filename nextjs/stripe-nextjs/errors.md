# Error Handling

## Error Type Hierarchy

All Stripe errors extend `StripeError`. Use `instanceof` checks for type-safe handling:

```typescript
import Stripe from 'stripe';

try {
  await stripe.paymentIntents.create({ amount: 1000, currency: 'usd' });
} catch (err) {
  if (err instanceof Stripe.errors.StripeError) {
    // Handle Stripe-specific error
    console.log(err.type);           // e.g., 'card_error'
    console.log(err.message);        // Human-readable
    console.log(err.code);           // Machine-readable code
    console.log(err.decline_code);   // Card-specific reason
    console.log(err.param);          // Failed parameter
    console.log(err.requestId);      // Stripe request ID for support
    console.log(err.statusCode);     // HTTP status code
  } else {
    // Non-Stripe error (network, etc.)
    console.error('Unexpected error:', err);
  }
}
```

## Error Types Table

| Class                              | HTTP Status | When Raised              | Key Properties         |
| ---------------------------------- | ----------- | ------------------------ | ---------------------- |
| `StripeCardError`                  | 402         | Payment declined         | `decline_code`, `code` |
| `StripeInvalidRequestError`        | 400/404     | Bad parameters           | `param`                |
| `StripeAuthenticationError`        | 401         | Invalid API key          | —                      |
| `StripePermissionError`            | 403         | Insufficient permissions | —                      |
| `StripeRateLimitError`             | 429         | Too many requests        | —                      |
| `StripeConnectionError`            | —           | Network/TLS failure      | —                      |
| `StripeAPIError`                   | 5xx         | Internal Stripe error    | —                      |
| `StripeSignatureVerificationError` | 400         | Webhook sig mismatch     | `header`, `payload`    |
| `StripeIdempotencyError`           | 400         | Idempotency key misuse   | —                      |
| `StripeOAuthError`                 | varies      | OAuth flow errors        | `type` varies          |

## Card Decline Codes

Common `StripeCardError.decline_code` values:

| Code                 | Meaning              | Action                          |
| -------------------- | -------------------- | ------------------------------- |
| `insufficient_funds` | Card has no funds    | Ask user to use different card  |
| `lost_card`          | Card reported lost   | Ask user to use different card  |
| `stolen_card`        | Card reported stolen | Block and ask for new card      |
| `do_not_honor`       | Generic decline      | Ask user to contact issuer      |
| `incorrect_number`   | Invalid card number  | Ask user to re-enter            |
| `expired_card`       | Card expired         | Ask user for new card           |
| `processing_error`   | Processing failed    | Retry or ask for different card |

## Error Response Pattern

Return structured errors from API routes:

```typescript
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        { error: 'payment_declined', message: err.message },
        { status: 402 }
      );
    }

    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json(
        { error: 'invalid_request', message: err.message, param: err.param },
        { status: 400 }
      );
    }

    // Generic fallback
    console.error('Stripe error:', err);
    return NextResponse.json(
      { error: 'internal_error', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

## Per-Request Configuration Override

Override retries or timeout for specific calls:

```typescript
await stripe.checkout.sessions.create(params, {
  maxNetworkRetries: 3,
  timeout: 15000,
});
```

## Migration Notes

- `Stripe.APIError` → `Stripe.errors.StripeAPIError` (v11+)
- `isAPIError()` → `instanceof Stripe.errors.StripeAPIError`
- Callback errors → thrown exceptions (promises only)
- Error properties are now consistently typed in TypeScript
