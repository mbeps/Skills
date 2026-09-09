# Middleware, Route Handlers & React Server Components

This guide details logging patterns for Next.js Middleware, Route Handlers (`app/api/**`), and React Server Components (RSC).

---

## 1. Middleware Logging (`middleware.ts`)

Next.js Middleware intercepts incoming HTTP requests before they reach pages or Route Handlers.

### Guidelines
1. **Category**: Use `["app", "middleware"]` (renders as `app·middleware`).
2. **Log Level**:
   - Use `debug` for normal session validation, token checks, and path passes.
   - Use `info` only for critical lifecycle events (e.g. session refreshed, user redirected due to auth failure).
   - Use `error` for unexpected middleware exceptions.
3. **Matcher Filter**: Ensure `config.matcher` excludes static assets, fonts, favicons, and `_next/static` to prevent unnecessary middleware invocations.

### Example Implementation

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { getLogger } from "@/lib/logger";
import { updateSession } from "@/lib/supabase/middleware";

const log = getLogger(["app", "middleware"]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  log.debug("Refreshing session for '{path}'", { path });

  try {
    const response = await updateSession(request);
    log.debug("Session correctly synced for '{path}'", { path });
    return response;
  } catch (err) {
    log.error("Middleware failed processing '{path}': {error}", {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - images, audio or public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)",
  ],
};
```

---

## 2. Route Handlers (`app/api/**/route.ts`)

Route Handlers are ideal for webhooks, public APIs, and third-party integrations (e.g., Stripe, Supabase Webhooks, OAuth callbacks).

### Guidelines
1. **Category**: `["app", "api", "<feature>"]` (e.g. `app·api·webhook`, `app·api·stripe`).
2. **Webhooks**:
   - Log `info` when receiving a validated external webhook event (e.g. `Stripe webhook received: invoice.paid`).
   - Log `warn` when signature verification fails or event payload is invalid.
   - Log `error` when processing fails, returning HTTP 500 so external senders retry.

### Example Implementation (`app/api/webhooks/stripe/route.ts`)

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "api", "stripe"]);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    log.warn("Missing Stripe signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    // Verify and handle event
    const event = { type: "payment_intent.succeeded", id: "evt_123" }; // mocked verification

    log.info("Handled webhook event '{type}' (id: {id})", {
      type: event.type,
      id: event.id,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Stripe webhook handling failed: {error}", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
```

---

## 3. React Server Components (RSC)

React Server Components render on the server to produce the initial HTML.

### What to Avoid in RSCs
- **DO NOT execute database mutations in Server Components**: Rendering is an idempotent, read-only phase. All mutations belong in Server Actions.
- **DO NOT log on every component render at `info` level**: Server components may execute multiple times during streaming, parallel routes, and cache warmups. Logging at `info` fills logs with duplicate noise.

### Recommended Pattern for RSCs
- If a server component needs telemetry, log at `debug` level:

```typescript
// app/songs/page.tsx
import getSongs from "@/actions/song/get-songs";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "pages", "songs"]);

export default async function SongsPage() {
  log.debug("Rendering SongsPage");
  const songs = await getSongs();

  return (
    <main>
      <h1>Songs ({songs.length})</h1>
      {/* Component content */}
    </main>
  );
}
```

