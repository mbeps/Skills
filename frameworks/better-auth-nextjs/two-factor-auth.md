# Two-Factor Authentication (2FA) — Better Auth + Next.js

TOTP-based 2FA via the `twoFactor` plugin. Adds a `twoFactor` table to the DB, a `twoFactorEnabled` boolean on `user`, and a set of client methods for enrollment and challenge verification.

---

## 1. Plugin Setup

### Server (`lib/auth/auth.ts`)

```typescript
import { twoFactor } from "better-auth/plugins/two-factor";

export const auth = betterAuth({
  appName: "YourAppName", // used as TOTP issuer when no issuer override is given
  plugins: [
    twoFactor({
      // issuer: "YourAppName",  // overrides appName in the authenticator app label
      // skipVerificationOnEnable: false, // default: require TOTP scan before activating
      totpOptions: {
        digits: 6,   // default
        period: 30,  // seconds; default
      },
      backupCodeOptions: {
        amount: 10,  // number of codes generated
        length: 10,  // characters per code
      },
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 600, // 10-minute lockout after 5 bad codes
      },
    }),
  ],
});
```

**This project** uses `twoFactor()` with no overrides — defaults inherit `appName: "Better Auth Demo"`.

### Client (`lib/auth/auth-client.ts`)

```typescript
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        // Called automatically when sign-in requires 2FA.
        // Use window.location for a hard redirect (clears React state).
        window.location.href = ROUTES.AUTH.TWO_FACTOR; // "/auth/2fa"
      },
    }),
  ],
});
```

`twoFactorClient` intercepts `signIn.email` responses — when the server issues a 2FA challenge, `onTwoFactorRedirect` fires automatically. You do **not** need to inspect the response manually.

> **Both must be registered**: omitting either side silently breaks the flow.

---

## 2. Database Schema

`twoFactor()` adds two things:

| Location          | Column / Table            | Type            | Notes                             |
| ----------------- | ------------------------- | --------------- | --------------------------------- |
| `user` table      | `twoFactorEnabled`        | `boolean`       | `false` until enrollment verified |
| `twoFactor` table | `secret`                  | `text NOT NULL` | TOTP shared secret                |
| `twoFactor` table | `backupCodes`             | `text NOT NULL` | JSON array of hashed codes        |
| `twoFactor` table | `verified`                | `boolean`       | `true` after first TOTP confirm   |
| `twoFactor` table | `failedVerificationCount` | `number`        | Reset on success                  |
| `twoFactor` table | `lockedUntil`             | `date \| null`  | Account lockout expiry            |

Run `npm run auth:generate && npm run db:generate && npm run db:migrate` after adding the plugin.

---

## 3. TOTP Enrollment Flow

This is a **two-step** process. The `twoFactorEnabled` flag stays `false` until the user scans the QR code and verifies a live TOTP code.

### Step 1 — Enable: Get `totpURI` + `backupCodes`

```typescript
const result = await authClient.twoFactor.enable({
  password: currentPassword, // required; proves identity before exposing the secret
});

if (result.error) {
  // Handle: wrong password, already enabled, etc.
  console.error(result.error.message);
  return;
}

// result.data = { totpURI: string, backupCodes: string[] }
const { totpURI, backupCodes } = result.data;
```

- `totpURI` is an `otpauth://` URI — render it as a QR code or display the raw secret.
- `backupCodes` are returned **once only**. Store them for the user immediately.
- `twoFactorEnabled` is still `false` at this point.

Extract the raw secret from the URI for manual entry:

```typescript
const secret = new URL(totpURI).searchParams.get("secret");
```

### Step 2 — Verify: Confirm the first TOTP code

```typescript
await authClient.twoFactor.verifyTotp(
  { code: totpCode }, // 6-digit code from the authenticator app
  {
    onError: (ctx) => toast.error(ctx.error.message),
    onSuccess: () => {
      // twoFactorEnabled is now true on the user record
      router.refresh();
    },
  }
);
```

Only after this call succeeds does `session.user.twoFactorEnabled` become `true`.

**Codebase pattern** (`app/profile/_components/security/two-factor-auth.tsx`):

```typescript
// Step 1: enable() returns data; hold it in local state
const result = await authClient.twoFactor.enable({ password: data.password });
if (result.error) {
  toast.error(result.error.message || "Failed to enable 2FA");
  return;
}
setTwoFactorData(result.data); // { totpURI, backupCodes }

// Step 2: show QR code + verification form; on submit:
await authClient.twoFactor.verifyTotp(
  { code: data.token },
  {
    onError: (error) => toast.error(error.error.message),
    onSuccess: () => {
      setSuccessfullyEnabled(true);
      router.refresh();
    },
  }
);

// Step 3: after verifyTotp succeeds, display backupCodes to the user
// backupCodes came from the enable() response in Step 1
```

---

## 4. 2FA Challenge Flow (Sign-In)

When a user with `twoFactorEnabled: true` signs in, Better Auth returns a challenge instead of a session.

### Automatic redirect via `onTwoFactorRedirect`

```typescript
// This fires automatically — no manual check needed
await authClient.signIn.email(
  { email, password },
  {
    onSuccess: () => router.push(ROUTES.HOME),  // only runs if no 2FA required
    onError: (ctx) => toast.error(ctx.error.message),
  }
);
// If 2FA is needed, onTwoFactorRedirect in the client config runs instead
```

### Manual check (alternative pattern)

```typescript
await authClient.signIn.email(
  { email, password },
  {
    onSuccess: (ctx) => {
      if (ctx.data.twoFactorRedirect) {
        // ctx.data.twoFactorMethods: ["totp"] | ["totp", "otp"]
        router.push(ROUTES.AUTH.TWO_FACTOR);
      } else {
        router.push(ROUTES.HOME);
      }
    },
  }
);
```

### Challenge page structure

The challenge page at `/auth/2fa` presents two tabs — TOTP and backup code.

**Guard: redirect authenticated users away**

```typescript
// app/auth/2fa/page.tsx (Server Component)
const session = await auth.api.getSession({ headers: await headers() });
if (session != null) return redirect(ROUTES.HOME);
// No active session = pending 2FA challenge; render the form
```

#### TOTP verification

```typescript
// Zod schema: z.object({ code: z.string().length(6) })
await authClient.twoFactor.verifyTotp(
  { code: totpCode },
  {
    onError: (ctx) => toast.error(ctx.error.message || "Failed to verify code"),
    onSuccess: () => router.push(ROUTES.HOME),
  }
);
```

#### Backup code verification

```typescript
// Zod schema: z.object({ code: z.string().min(1) })
await authClient.twoFactor.verifyBackupCode(
  { code: backupCode },
  {
    onError: (ctx) => toast.error(ctx.error.message || "Failed to verify code"),
    onSuccess: () => router.push(ROUTES.HOME),
  }
);
// Backup code is consumed — cannot be reused
```

---

## 5. Disabling 2FA

```typescript
await authClient.twoFactor.disable(
  { password: currentPassword },
  {
    onError: (ctx) => toast.error(ctx.error.message || "Failed to disable 2FA"),
    onSuccess: () => {
      form.reset();
      router.refresh(); // revalidates session.user.twoFactorEnabled
    },
  }
);
```

Requires the user's current password. Sets `twoFactorEnabled` to `false` and drops the `twoFactor` row.

---

## 6. Backup Codes

### At enrollment

`authClient.twoFactor.enable()` returns `backupCodes: string[]` alongside `totpURI`. These are the only time codes are visible in plaintext — display them immediately and prompt the user to save them.

### Regenerating codes

```typescript
const result = await authClient.twoFactor.generateBackupCodes({
  password: currentPassword,
});
// result.data.backupCodes — new codes
// All previous codes are invalidated immediately
```

### Server-side view (admin use only)

```typescript
const data = await auth.api.viewBackupCodes({ body: { userId } });
```

### Rules

- Each code is single-use — consumed on successful login.
- No way to retrieve codes after enrollment without regenerating.
- Regeneration invalidates all previous codes instantly.
- User should store codes in a password manager or offline.

---

## 7. Trusted Devices

Pass `trustDevice: true` on any verification call to skip 2FA for that browser for 30 days:

```typescript
await authClient.twoFactor.verifyTotp({
  code,
  trustDevice: true,
  // callbackURL: "/",  // optional; use router.push instead in Next.js
});

await authClient.twoFactor.verifyBackupCode({
  code,
  trustDevice: true,
});

await authClient.twoFactor.verifyOtp({
  code,
  trustDevice: true,
});
```

Not used in this project's current implementation.

---

## 8. OTP via Email (Alternative to TOTP)

Configure alongside TOTP in the server plugin:

```typescript
twoFactor({
  otpOptions: {
    period: 300, // OTP valid for 5 minutes
    sendOTP: async ({ user, otp }, ctx) => {
      await sendEmail({ to: user.email, subject: "Your login code", body: otp });
    },
  },
})
```

Client flow:

```typescript
// 1. Trigger OTP delivery
await authClient.twoFactor.sendOtp();

// 2. Verify
await authClient.twoFactor.verifyOtp({ code: otpCode });
```

`twoFactorMethods` on the sign-in response will be `["totp", "otp"]` when both are configured.

---

## 9. Server-Side Session Check

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });

if (session?.user.twoFactorEnabled) {
  // User has 2FA active
}
```

Use in Server Components and middleware. The `twoFactorEnabled` field is typed on the session when `inferAdditionalFields<typeof auth>()` is in the client config.

---

## 10. Checking 2FA Status in Components

```typescript
"use client";
const { data: session } = authClient.useSession();

// Conditionally render enable/disable UI
const isEnabled = session?.user.twoFactorEnabled ?? false;
```

This project passes `isEnabled` as a prop to the `TwoFactorAuth` component from the parent Server Component:

```typescript
// profile/page.tsx (Server Component)
const session = await auth.api.getSession({ headers: await headers() });
// ...
<TwoFactorAuth isEnabled={session.user.twoFactorEnabled} />
```

---

## 11. Zod Validation Schemas

```typescript
// schemas/totp.ts — challenge page and enrollment verification
export const totpSchema = z.object({
  code: z.string().length(6),
});

// schemas/two-factor-auth.ts — enable/disable form (password confirmation)
export const twoFactorAuthSchema = z.object({
  password: z.string().min(1),
});

// schemas/two-factor-auth.ts — QR code verification step
export const qrSchema = z.object({
  token: z.string().length(6),
});

// schemas/backup-code.ts — backup code challenge
export const backupCodeSchema = z.object({
  code: z.string().min(1), // backup codes vary in length
});
```

---

## 12. API Endpoints (for reference)

| Endpoint                            | Method | Description                                         |
| ----------------------------------- | ------ | --------------------------------------------------- |
| `/two-factor/enable`                | POST   | Start enrollment; returns `totpURI` + `backupCodes` |
| `/two-factor/disable`               | POST   | Disable 2FA; requires `password`                    |
| `/two-factor/get-totp-uri`          | POST   | Retrieve TOTP URI without re-enabling               |
| `/two-factor/verify-totp`           | POST   | Verify TOTP code during challenge or enrollment     |
| `/two-factor/send-otp`              | POST   | Send OTP via email/SMS                              |
| `/two-factor/verify-otp`            | POST   | Verify email/SMS OTP                                |
| `/two-factor/verify-backup-code`    | POST   | Consume a backup code                               |
| `/two-factor/generate-backup-codes` | POST   | Regenerate backup codes; invalidates old ones       |

---

## 13. Complete Enrollment Sequence

```
User submits password
  → authClient.twoFactor.enable({ password })
    → server creates twoFactor row, generates secret + backup codes
    → returns { totpURI, backupCodes }
  → UI displays QR code (react-qr-code or similar) + manual secret
  → UI displays backup codes — user saves them
  → User scans QR code, opens authenticator app
  → User enters 6-digit code from app
  → authClient.twoFactor.verifyTotp({ code })
    → server sets twoFactorEnabled = true on user row
    → session.user.twoFactorEnabled becomes true
```

## 14. Complete Challenge Sequence

```
User submits email + password
  → authClient.signIn.email()
    → server detects twoFactorEnabled = true
    → returns 2FA challenge (no session cookie set yet)
  → onTwoFactorRedirect fires → window.location.href = "/auth/2fa"
  → /auth/2fa loads: no active session, so renders challenge form
  → User enters TOTP code (or backup code)
  → authClient.twoFactor.verifyTotp({ code }) (or verifyBackupCode)
    → server validates code, sets session cookie
    → onSuccess → router.push(ROUTES.HOME)
```

---

## Security Notes

- **Password required** for enable/disable — prevents session hijacking from enabling/disabling 2FA without the user's knowledge.
- **Account lockout** is on by default (5 attempts → 10-minute lock) — mitigates brute-force on the 6-digit code space.
- **Backup codes are hashed** in the DB (`twoFactor.backupCodes`) — never stored plaintext.
- **`twoFactorEnabled` stays `false`** until `verifyTotp` succeeds — partial enrollment does not grant 2FA protection.
- **In after-hooks**, `ctx.context.newSession` is `null` during a 2FA challenge — always null-check before accessing it.
- The challenge page guard (`if (session != null) redirect(...)`) prevents authenticated users from accessing the interstitial, but a missing pending-challenge check means a direct visit to `/auth/2fa` without signing in will just show the form (it will fail on submission).

---

## References

- https://www.better-auth.com/docs/plugins/two-factor
- https://www.better-auth.com/docs/plugins/2fa
