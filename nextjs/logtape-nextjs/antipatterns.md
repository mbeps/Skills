# Logging Antipatterns to Avoid

This document catalogs common logging antipatterns in Next.js TypeScript projects and provides explicit best-practice alternatives.

---

## 1. ❌ Direct Client-Side Database Mutations

### The Mistake
Executing database mutations directly from Client Components via client SDKs:
```typescript
// ❌ BAD: Direct database insert from browser component
"use client";
import { supabase } from "@/lib/supabase/client";

async function handleUpload() {
  await supabase.from("songs").insert({ title, song_path }); // Zero server logs!
}
```

### Why It Fails
Because the database call happens directly between the browser and the database API, the Next.js server runtime is never invoked. No terminal logs or server telemetry can ever be captured, and mutations bypass server-side validation.

### ✅ Best Practice
Execute all database mutations inside typed Next.js Server Actions (`"use server"`). Storage file uploads (large binaries) can remain client-to-storage for network performance, but metadata insertion must be dispatched to a Server Action where structured logging occurs.

---

## 2. ❌ Client-to-Server Log Forwarding Hacks

### The Mistake
Building custom `/api/log` POST endpoints to forward browser `console.log` events to the server:
```typescript
// ❌ BAD: Forwarding browser logs via custom API route
window.onerror = (msg) => {
  fetch("/api/log", { method: "POST", body: JSON.stringify({ msg }) });
};
```

### Why It Fails
- Creates an unauthenticated or hard-to-rate-limit endpoint vulnerable to log injection and DDoS.
- Floods client network tabs with extraneous HTTP requests.
- Conflates browser UI state with backend operational telemetry.

### ✅ Best Practice
Keep server logs on the server. Business transactions (Server Actions, Route Handlers, Middleware) run on the server and log directly via LogTape. For frontend error monitoring, rely on dedicated client APM tools (e.g. Sentry, Datadog) rather than custom home-grown HTTP proxies.

---

## 3. ❌ Logging Queries at `info` Level

### The Mistake
```typescript
// ❌ BAD: Logging every query fetch at info level
export async function getSongs() {
  log.info("Fetching all songs"); // Floods logs on every navigation!
  return await db.select().from(songs);
}
```

### Why It Fails
Next.js App Router renders React Server Components dynamically during route navigation, tab switching, and prefetching. Logging queries at `info` fills the terminal and log aggregators with hundreds of identical lines, obscuring real user actions and errors.

### ✅ Best Practice
- Use `debug` for read queries (`get*`, `fetch*`).
- Use `info` strictly for state mutations (`create*`, `update*`, `delete*`) and webhooks.
- In production, default to `LOG_LEVEL=info`. Switch to `LOG_LEVEL=debug` only when investigating issues.

---

## 4. ❌ Proprietary Environment Flags

### The Mistake
Inventing non-standard configuration flags:
```bash
# ❌ BAD: Proprietary flags
NEXT_PUBLIC_ENABLE_ACTION_LOGS=true
LOG_QUERIES=yes
DEBUG_MODE=1
```

### Why It Fails
- Confuses developers and operators used to Twelve-Factor app conventions.
- Requires custom conditional logic scattered across multiple files.

### ✅ Best Practice
Control all logging through the single standard `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`).

---

## 5. ❌ Leaking Sensitive Data & PII

### The Mistake
Logging raw request bodies, user objects, or authentication headers:
```typescript
// ❌ BAD: DANGEROUS credential and personal data leak
log.info("User login attempt", { body: req.body });
log.error("Failed to authenticate", { token: authHeader });
```

### Why It Fails
Violates GDPR, HIPAA, and SOC2 compliance. Passwords, authorization headers, and personal details become stored in plaintext logs.

### ✅ Best Practice
Always log sanitized identifiers (`userId`, `songId`) and static descriptions:
```typescript
// ✅ SAFE: Structured, non-sensitive context
log.info("User signed in (userId: {userId})", { userId: user.id });
```

---

## 6. ❌ Turbopack Server Action Export Mismatch

### The Mistake
Exporting server actions with mixed conventions:
```typescript
// actions/song/create-song.ts
export const createSong = async () => { ... };

// app/upload/page.tsx
import createSong from "@/actions/song/create-song";
```

### Why It Fails
When Next.js Turbopack generates RPC boundary proxies between Client and Server modules, mismatched default vs named imports trigger build errors:
`Error: Export createSong doesn't exist in target module. Did you mean to import default?`

### ✅ Best Practice
Follow a single export convention across the entire codebase. For instance, standardize on `export default async function createSong(...)` and `import createSong from "@/actions/..."`.

---

## 7. ❌ Unaligned Terminal Output

### The Mistake
Using standard unpadded log formatting where varying level lengths push messages out of alignment:
```text
18:46:58.658 DBG app·middleware Refreshing Supabase session
18:46:58.659 WARNING app·storage Quota near limit
18:46:58.660 INFO app·actions·song Song created
```

### Why It Fails
Scannability degrades when column positions shift horizontally on every line.

### ✅ Best Practice
Enforce strict column padding:
- **Level**: Padded to 7 characters (`DEBUG  `, `INFO   `, `WARNING`, `ERROR  `).
- **Category**: Padded to 24 characters (`app·actions·song       `).
- **Delimiter**: Dimmed vertical bar separator (`  │  `).
- **Message**: Begins at identical horizontal coordinates on every line.

