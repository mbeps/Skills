# Webhooks: User Lifecycle Sync

## Quick Reference

| Event                            | Trigger                  | Typical Action                           |
| -------------------------------- | ------------------------ | ---------------------------------------- |
| `user.created`                   | New user signs up        | Create user record in external DB        |
| `user.updated`                   | User profile changes     | Sync name, email, metadata               |
| `user.deleted`                   | Account deleted          | Soft-delete or remove from external DB   |
| `user.emailAddress_verified`     | Email verified           | Enable features requiring verified email |
| `session.created`                | User signs in            | Track active sessions, audit log         |
| `session.deleted`                | User signs out / expires | Clean up session-specific data           |
| `organization.created`           | New org created          | Create org record                        |
| `organizationMembership.created` | Member added             | Grant access in external system          |
| `organizationMembership.deleted` | Member removed           | Revoke access                            |

## Webhook Endpoint Setup

### 1. Create Endpoint

```ts
// app/api/webhooks/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing CLERK_WEBHOOK_SECRET' }, { status: 500 });
  }

  const headerPayload = await req.headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);
  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (error) {
    return NextResponse.json({ error: 'Verification error' }, { status: 400 });
  }

  // Handle event by type
  switch (event.type) {
    case 'user.created':
      // Create user in your database
      break;
    case 'user.updated':
      // Update user in your database
      break;
    case 'user.deleted':
      // Delete user from your database
      break;
    default:
      break;
  }

  return NextResponse.json({ success: true });
}
```

### 2. Install Svix

```bash
npm install svix
```

### 3. Configure Webhook Secret

Add to `.env.local`:

```env
CLERK_WEBHOOK_SECRET="whsec_..."
```

Get this value from Clerk Dashboard → Webhooks → [Webhook] → Signing secret.

### 4. Register Endpoint in Dashboard

Clerk Dashboard → Webhooks → Add Endpoint → Enter your URL (e.g., `https://yourapp.com/api/webhooks`). Subscribe to events you need.

For local development, use ngrok or similar tunneling:

```bash
ngrok http 3000
```

Then register the ngrok URL as your webhook endpoint.

## Webhook Event Type

```ts
type WebhookEvent = {
  id: string;
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; verified?: boolean }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    username?: string;
    public_metadata?: Record<string, unknown>;
    private_metadata?: Record<string, unknown>;
    external_id?: string;
    created_at: number;
    updated_at: number;
    // ... organization-related fields for org events
  };
};
```

## Common Patterns

### User Created → Sync to Database

```ts
case 'user.created': {
  const { id, email_addresses, first_name, last_name, username } = event.data;
  // Insert into your database
  await db.insert(usersTable).values({
    clerkId: id,
    email: email_addresses?.[0]?.email_address,
    firstName: first_name,
    lastName: last_name,
    username,
  });
  break;
}
```

### User Updated → Sync Changes

```ts
case 'user.updated': {
  const { id, email_addresses, first_name, last_name } = event.data;
  // Update in your database
  await db.update(usersTable)
    .set({
      email: email_addresses?.[0]?.email_address,
      firstName: first_name,
      lastName: last_name,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.clerkId, id));
  break;
}
```

### User Deleted → Soft Delete

```ts
case 'user.deleted': {
  const { id } = event.data;
  // Soft delete in your database
  await db.update(usersTable)
    .set({ deletedAt: new Date() })
    .where(eq(usersTable.clerkId, id));
  break;
}
```

## Common Pitfalls

- **Always verify signatures:** Never process a webhook without verifying the Svix signature. Unverified webhooks can be spoofed.
- **Exclude webhooks from middleware:** Add `api/webhooks` to your middleware matcher skip list so `clerkMiddleware()` doesn't process webhook requests.
- **Idempotency:** Webhooks can be delivered more than once. Design handlers to be idempotent (check before inserting/updating).
- **Rate limits:** Webhooks are delivered asynchronously. Handle failures gracefully — Clerk retries failed deliveries.
- **Don't block on slow operations:** Process webhooks quickly. Offload heavy work to a background job queue if needed.
- **Local development needs a tunnel:** Use ngrok or similar to test webhooks locally. The Dashboard only calls HTTPS URLs.
