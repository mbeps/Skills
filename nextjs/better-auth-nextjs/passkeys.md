# Better Auth Passkeys — Next.js Implementation Guide

Passkeys are WebAuthn-based credentials stored on the user's device or password manager (iCloud Keychain, Google Password Manager, hardware key). Authentication happens via public-key cryptography: only the public key is stored server-side; the private key never leaves the device. This makes passkeys phishing-resistant by design — credentials are bound to the exact origin (`rpID`) they were created on.

---

## 1. Package

The passkey plugin is a **separate package** from `better-auth`:

```bash
npm install @better-auth/passkey
```

Server import: `@better-auth/passkey`  
Client import: `@better-auth/passkey/client`

> Do not confuse with the old `better-auth/plugins/passkey` path — the standalone package is the current one.

---

## 2. Plugin Setup

### Server (`lib/auth/auth.ts`)

```typescript
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  plugins: [
    passkey(),   // zero-config: rpID inferred from BETTER_AUTH_URL
  ],
});
```

**Advanced config** (explicit options):

```typescript
passkey({
  rpName: "My App",                // shown in browser's passkey dialog
  rpID: "myapp.com",              // must match the serving domain exactly
  origin: "https://myapp.com",    // full origin including protocol
  authenticatorSelection: {
    residentKey: "preferred",      // "required" | "preferred" | "discouraged"
    userVerification: "preferred", // "required" | "preferred" | "discouraged"
  },
  registration: {
    requireSession: true,          // false = passkey-first (no password required)
    afterVerification: async ({ verification }) => ({
      // auto-label passkey by authenticator model
      name: getAuthenticatorName(verification.registrationInfo?.aaguid),
    }),
  },
})
```

The zero-config form used in this project works because `BETTER_AUTH_URL` contains the full origin.

### Client (`lib/auth/auth-client.ts`)

```typescript
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
  ],
});
```

The client plugin **must be added** to unlock `authClient.passkey.*` and the `autoFill` option on `authClient.signIn.passkey()`. Omitting it silently breaks passkey flows.

---

## 3. Registering a Passkey

Users must be **signed in** to register a passkey (requires an active session).

### Schema

```typescript
// schemas/passkey.ts
import z from "zod";

export const passkeySchema = z.object({
  name: z.string().min(1),   // user-friendly label for the passkey
});

export type PasskeyForm = z.infer<typeof passkeySchema>;
```

### Client call

```typescript
import { authClient } from "@/lib/auth/auth-client";

await authClient.passkey.addPasskey(
  { name: "My MacBook" },   // name is optional but strongly recommended
  {
    onError: (error) => toast.error(error.error.message || "Failed to add passkey"),
    onSuccess: () => {
      router.refresh();     // re-fetch passkey list from server
      setIsDialogOpen(false);
    },
  }
);
```

`addPasskey` triggers the browser's **native WebAuthn registration dialog**. The browser prompts the user to authenticate (biometric, PIN, etc.) and stores the credential. The public key is sent to Better Auth and saved in the `passkey` table.

> **Note:** Better Auth passkey methods **always return errors as `data.error`**, not as thrown exceptions — even if you pass `throw: true`. Always use the `onError` callback.

---

## 4. Signing In With a Passkey

### 4a. Silent Sign-In (Conditional UI / Autofill)

This pattern attempts passkey sign-in automatically when the login page loads. The browser shows passkeys in the **password autofill dropdown** — no extra UI required.

```typescript
// app/auth/login/_components/buttons/passkey-button.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";

export function PasskeyButton() {
  const router = useRouter();
  const { refetch } = authClient.useSession();

  // Attempt silent passkey sign-in on mount (Conditional UI)
  useEffect(() => {
    authClient.signIn.passkey(
      { autoFill: true },
      {
        onSuccess() {
          refetch();
          router.push(ROUTES.HOME);
        },
        // onError intentionally omitted — failure is expected when
        // the user has no passkey or cancels; fall through to login form
      }
    );
  }, [router, refetch]);

  // Manual passkey trigger button
  return (
    <BetterAuthActionButton
      variant="outline"
      className="w-full"
      action={() =>
        authClient.signIn.passkey(undefined, {
          onSuccess() {
            refetch();
            router.push(ROUTES.HOME);
          },
        })
      }
    >
      Use Passkey
    </BetterAuthActionButton>
  );
}
```

**Why `refetch()` before `router.push()`?**  
`authClient.useSession()` caches the session. After a passkey sign-in, the session cache is stale. Calling `refetch()` updates it so any component relying on `useSession()` instantly reflects the authenticated state before the navigation occurs.

### 4b. Email Input — WebAuthn Autofill Attribute

For the conditional UI to surface passkeys in the browser's autofill, the email/username input **must include the `webauthn` autofill token**:

```tsx
// app/auth/login/_components/tabs/sign-in-tab.tsx
<Input
  type="email"
  autoComplete="username webauthn"   // ← canonical W3C WebAuthn spec value
  {...field}
/>
```

> **Note:** `autoComplete="email webauthn"` also works in practice when email is used as the credential identifier (browsers map it), but `"username webauthn"` is the canonical value specified by the W3C WebAuthn spec.

Without this attribute, `autoFill: true` registers the WebAuthn ceremony but the browser won't know which input to attach the passkey suggestions to.

### Full Silent Sign-In Flow

```
1. Login page renders, PasskeyButton mounts
2. useEffect fires → authClient.signIn.passkey({ autoFill: true })
3. Browser registers the Conditional UI ceremony (waits silently)
4. User focuses the email input → browser shows passkey suggestions in autofill
5. User selects a passkey → biometric/PIN prompt appears
6. Verification succeeds → onSuccess fires → refetch() + router.push("/")
7. If no passkey / user dismisses → onError (or silent resolve) → normal login form remains
```

### 4c. Manual Sign-In (Explicit Button)

```typescript
const { data, error } = await authClient.signIn.passkey();
// Triggers WebAuthn dialog immediately (no autoFill — user chose to click the button)
```

Or with callbacks (preferred over destructuring):

```typescript
await authClient.signIn.passkey(undefined, {
  onSuccess() { router.push("/dashboard"); },
  onError(ctx) { toast.error(ctx.error.message); },
});
```

---

## 5. Managing Passkeys (Profile Page)

### 5a. Listing Passkeys — Server Component

Fetch passkeys server-side by casting `auth.api` to include the passkey plugin endpoints (necessary because the plugin augments the API type at runtime):

```typescript
// app/profile/_components/security/security-tab.tsx
import { auth } from "@/lib/auth/auth";
import { passkey } from "@better-auth/passkey";
import { headers } from "next/headers";

// Cast to include passkey plugin endpoints
const passkeyApi = auth.api as typeof auth.api &
  ReturnType<typeof passkey>["endpoints"];

const passkeys = await passkeyApi.listPasskeys({
  headers: await headers(),   // session cookie forwarding
});
```

The type cast is required because TypeScript cannot statically merge plugin endpoints into the `auth.api` type without it. This is a known limitation of the plugin architecture.

### 5b. Listing Passkeys — Client Component

```typescript
const { data: passkeys } = await authClient.passkey.listUserPasskeys();
```

> Note: the client method is `listUserPasskeys` (not `listPasskeys`). The server API method is `listPasskeys`.

### 5c. PasskeyManagement Component Pattern

```typescript
// app/profile/_components/security/passkey-management.tsx
"use client";

import { Passkey } from "@better-auth/passkey";   // type import

export function PasskeyManagement({ passkeys }: { passkeys: Passkey[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const form = useForm<PasskeyForm>({
    resolver: zodResolver(passkeySchema),
    defaultValues: { name: "" },
  });

  async function handleAddPasskey(data: PasskeyForm) {
    await authClient.passkey.addPasskey(data, {
      onError: (error) => toast.error(error.error.message || "Failed to add passkey"),
      onSuccess: () => {
        router.refresh();      // triggers server component re-fetch
        setIsDialogOpen(false);
        form.reset();
      },
    });
  }

  function handleDeletePasskey(passkeyId: string) {
    return authClient.passkey.deletePasskey(
      { id: passkeyId },
      { onSuccess: () => router.refresh() }
    );
  }

  // Render passkey list + "New Passkey" dialog button
}
```

`router.refresh()` re-runs the parent Server Component (`SecurityTab`), which re-fetches `listPasskeys` from the DB. This is the correct pattern in App Router — no client-side state mutation needed.

### 5d. Deleting a Passkey

```typescript
await authClient.passkey.deletePasskey(
  { id: passkeyId },
  { onSuccess: () => router.refresh() }
);
```

Wrap in `BetterAuthActionButton` with `requireAreYouSure` for destructive safety:

```tsx
<BetterAuthActionButton
  requireAreYouSure
  variant="destructive"
  size="icon"
  action={() => handleDeletePasskey(passkey.id)}
>
  <Trash2 />
</BetterAuthActionButton>
```

### 5e. Renaming a Passkey

```typescript
await authClient.passkey.updatePasskey({
  id: passkeyId,
  name: "New Name",
});
```

---

## 6. Database Schema

Better Auth creates a `passkey` table automatically. With Drizzle, generate it via:

```bash
npm run auth:generate   # generates schema
npm run db:migrate      # applies migration
```

| Column         | Type                 | Notes                                                                  |
| -------------- | -------------------- | ---------------------------------------------------------------------- |
| `id`           | text (PK)            |                                                                        |
| `name`         | text (nullable)      | user-assigned label                                                    |
| `publicKey`    | text                 | stored public key bytes (never the private key)                        |
| `userId`       | text (FK → user)     | cascade delete                                                         |
| `credentialID` | text                 | WebAuthn credential identifier                                         |
| `counter`      | integer              | incremented on each use; mismatch = replay attack                      |
| `deviceType`   | text                 | `"platform"` (Touch ID, Windows Hello) or `"cross-platform"` (YubiKey) |
| `backedUp`     | boolean              | `true` = synced to iCloud Keychain / Google Password Manager           |
| `transports`   | text (nullable)      | comma-separated: `"internal"`, `"usb"`, `"ble"`, `"nfc"`               |
| `createdAt`    | timestamp (nullable) |                                                                        |
| `aaguid`       | text (nullable)      | authenticator model identifier; used by `getAuthenticatorName()`       |

---

## 7. Naming Passkeys by Authenticator Model

Better Auth exports a helper to resolve human-readable names from the `aaguid`:

```typescript
import {
  getAuthenticatorName,
  commonAuthenticatorNames,
} from "@better-auth/passkey";

// Display name with fallback
const label = passkey.name || getAuthenticatorName(passkey.aaguid) || "Passkey";

// Extend the built-in map with your own entries
const customNames = {
  ...commonAuthenticatorNames,
  "00000000-0000-0000-0000-000000000042": "My Custom Key",
};
```

Use this in `afterVerification` during registration to auto-label passkeys:

```typescript
passkey({
  registration: {
    afterVerification: async ({ verification }) => ({
      name: getAuthenticatorName(verification.registrationInfo?.aaguid),
    }),
  },
})
```

---

## 8. Browser Compatibility

| Platform       | Minimum version                  |
| -------------- | -------------------------------- |
| Chrome / Edge  | 108+                             |
| Safari         | 16+ (macOS 13+, iOS 16+)         |
| Firefox        | 122+                             |
| Android Chrome | latest (Google Password Manager) |

**Requirements:**
- **HTTPS required in production.** `localhost` works during development without HTTPS.
- `rpID` must exactly match the current domain — subdomain mismatches break authentication.
- Conditional UI (`autoFill: true`) requires `PublicKeyCredential.isConditionalMediationAvailable()` — check before calling in environments where it might not be supported:

```typescript
useEffect(() => {
  if (!window.PublicKeyCredential?.isConditionalMediationAvailable) return;
  authClient.signIn.passkey({ autoFill: true }, { onSuccess() { ... } });
}, []);
```

---

## 9. Security Model

- **Private key never leaves the device.** Only the public key is stored in the `passkey` table.
- **Counter-based replay prevention.** The `counter` field increments on every assertion. Better Auth rejects requests where the counter does not advance, preventing credential cloning attacks.
- **Origin binding.** The `rpID` is cryptographically bound to the credential. A passkey created on `app.com` cannot be used on `evil.com` — this is what makes passkeys phishing-resistant.
- **`backedUp` field.** When `true`, the credential is synced to a cloud password manager (iCloud Keychain, Google PM). Hardware security keys always have `backedUp: false`. Use this field to display trust indicators to users.
- **No server secret.** Unlike TOTP or magic links, there is no shared secret to leak. Compromise of the database reveals public keys only.

---

## 10. Common Mistakes

| Mistake                                                     | Fix                                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| Using `better-auth/plugins/passkey` import path             | Use `@better-auth/passkey` (separate package)                               |
| Client missing `passkeyClient()` plugin                     | Add `passkeyClient()` to `createAuthClient({ plugins: [...] })`             |
| `autoFill` with no `autoComplete="email webauthn"` on input | Add the attribute; browser cannot attach suggestions without it             |
| Not calling `router.refresh()` after add/delete             | App Router Server Components don't auto-revalidate; `refresh()` is required |
| Destructuring `error` from `addPasskey` result              | Errors are always in `data.error`; use `onError` callback instead           |
| `rpID` set to full URL with protocol                        | `rpID` must be domain only: `"myapp.com"`, not `"https://myapp.com"`        |
| Forgetting to cast `auth.api` for server-side list          | Cast to `typeof auth.api & ReturnType<typeof passkey>["endpoints"]`         |

---

## References

- [Better Auth Passkey Plugin](https://www.better-auth.com/docs/plugins/passkey)
- [SimpleWebAuthn (underlying library)](https://simplewebauthn.dev/)
- [WebAuthn Guide](https://webauthn.guide/)
- [Passkeys.dev — cross-platform compatibility](https://passkeys.dev/)
- [FIDO Alliance Passkey Overview](https://fidoalliance.org/passkeys/)
