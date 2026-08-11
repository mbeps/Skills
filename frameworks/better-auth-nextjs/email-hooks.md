# Better Auth + Next.js: Email Hooks

## 1. Overview

Better Auth triggers auth events via hooks. Use these hooks to send transactional emails.

All hooks are defined in `lib/auth/auth.ts` inside the `betterAuth({})` config. The email-sending function itself is decoupled — swap the provider without touching the hook.

---

## 2. Dedicated Email Hooks

These callbacks are invoked automatically by Better Auth at specific auth events.

### `emailVerification.sendVerificationEmail`

Called after sign-up (when `sendOnSignUp: true`) and when the user requests a resend.

```typescript
emailVerification: {
  autoSignInAfterVerification: true, // sign in immediately after clicking the link
  sendOnSignUp: true,                // send on every new sign-up
  sendVerificationEmail: async ({ user, url }) => {
    await sendEmailVerificationEmail({ user, url });
  },
},
```

Trigger resend from the client:

```typescript
await authClient.sendVerificationEmail({
  email: "user@example.com",
  callbackURL: "/",
});
```

---

### `emailAndPassword.sendResetPassword`

Called when the user requests a password reset.

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  sendResetPassword: async ({ user, url }) => {
    await sendPasswordResetEmail({ user, url });
  },
},
```

Trigger from the client:

```typescript
await authClient.requestPasswordReset({
  email: "user@example.com",
  redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
});
```

The reset page then calls:

```typescript
const token = new URLSearchParams(window.location.search).get("token");
await authClient.resetPassword({ newPassword, token });
```

---

### `user.changeEmail.sendChangeEmailConfirmation`

Called when the user requests an email address change.

> **Note**: The hook name is `sendChangeEmailConfirmation`, not `sendChangeEmailVerification`.

```typescript
user: {
  changeEmail: {
    enabled: true,
    sendChangeEmailConfirmation: async ({ user, url, newEmail }) => {
      // Send the verification link to the NEW address.
      // This project re-uses sendEmailVerificationEmail with the email swapped.
      await sendEmailVerificationEmail({
        user: { ...user, email: newEmail },
        url,
      });
    },
  },
},
```

Trigger from the client:

```typescript
await authClient.changeEmail({
  newEmail: "new@example.com",
  callbackURL: "/profile",
});
```

---

### `user.deleteUser.sendDeleteAccountVerification`

Called when the user initiates account deletion. Better Auth sends a confirmation link before destroying the account.

```typescript
user: {
  deleteUser: {
    enabled: true,
    sendDeleteAccountVerification: async ({ user, url }) => {
      await sendDeleteAccountVerificationEmail({ user, url });
    },
  },
},
```

Trigger from the client:

```typescript
await authClient.deleteUser({ callbackURL: "/" });
```

---

### `organization.sendInvitationEmail`

Called when a member is invited to an organization.

```typescript
organization({
  sendInvitationEmail: async ({ email, organization, inviter, invitation }) => {
    // invitation.id  — use to build the accept/reject URL
    // inviter.user   — { name, email } of the inviting user
    // organization   — { id, name, slug }
    await sendOrganizationInviteEmail({
      invitation,          // { id: string }
      inviter: inviter.user,
      organization,
      email,
    });
  },
})
```

The invite URL is constructed from the invitation ID:

```typescript
const inviteUrl = `${process.env.BETTER_AUTH_URL}/organizations/invites/${invitation.id}`;
```

Trigger from the client:

```typescript
await authClient.organization.inviteMember({
  email: "colleague@example.com",
  role: "member",
});
```

---

## 3. Generic After-Hook Pattern (Welcome Email)

Better Auth's `hooks.after` accepts ONE `createAuthMiddleware`. Branch on `ctx.path` inside it to handle multiple events.

```typescript
import { createAuthMiddleware } from "better-auth/api";

hooks: {
  after: createAuthMiddleware(async (ctx) => {
    if (ctx.path.startsWith("/sign-up")) {
      // newSession is populated for email sign-ups; body fallback covers social OAuth
      const user = ctx.context.newSession?.user ?? {
        name: ctx.body.name,
        email: ctx.body.email,
      };
      if (user != null) {
        await sendWelcomeEmail(user);
      }
    }
  }),
},
```

> **Important**: Do NOT use an array with `matcher` / `handler` — hooks.after takes a single middleware. Use `if (ctx.path === ...)` branches for multiple endpoints.

### Available `ctx` properties in after-hooks

| Property                         | Description                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| `ctx.path`                       | Current endpoint path (`"/sign-up/email"`, `"/sign-in/email"`, etc.) |
| `ctx.body`                       | Parsed request body                                                  |
| `ctx.headers`                    | Request headers                                                      |
| `ctx.context.newSession`         | Session created by the action (may be `undefined`)                   |
| `ctx.context.adapter`            | DB adapter: `findOne`, `findMany`, `create`, `update`, `delete`      |
| `ctx.context.runInBackground(p)` | Fire-and-forget after response                                       |

---

## 4. Email Provider Integration

Better Auth hooks call YOUR email function. The provider is fully pluggable.

```typescript
// lib/emails/send-email.ts
export function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  // Swap for any provider:
  // Postmark:   postmarkClient.sendEmail(...)
  // Resend:     resend.emails.send(...)
  // SendGrid:   sgMail.send(...)
  // Nodemailer: transporter.sendMail(...)
}
```

This project uses Postmark via `POSTMARK_SERVER_TOKEN` and `POSTMARK_FROM_EMAIL`. The rest of the codebase never imports from Postmark directly — only from `send-email.ts`.

---

## 5. Email Template Pattern

Each email has its own file in `lib/emails/`. Every template function calls `sendEmail` and provides both `html` and `text` fields (Postmark requires both; other providers may not).

```typescript
// lib/emails/email-verification.ts
export async function sendEmailVerificationEmail({
  user,
  url,
}: {
  user: { name: string; email: string };
  url: string;
}) {
  await sendEmail({
    to: user.email,
    subject: "Verify your email address",
    html: `<a href="${url}">Verify Email</a>`,
    text: `Verify your email: ${url}`,
  });
}
```

Templates in this project:

| File                             | Function                             | Used by hook                                             |
| -------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `welcome-email.ts`               | `sendWelcomeEmail`                   | `hooks.after` on `/sign-up`                              |
| `email-verification.ts`          | `sendEmailVerificationEmail`         | `emailVerification.sendVerificationEmail` + email change |
| `password-reset-email.ts`        | `sendPasswordResetEmail`             | `emailAndPassword.sendResetPassword`                     |
| `delete-account-verification.ts` | `sendDeleteAccountVerificationEmail` | `user.deleteUser.sendDeleteAccountVerification`          |
| `organization-invite-email.ts`   | `sendOrganizationInviteEmail`        | `organization.sendInvitationEmail`                       |

---

## 6. All Hooks Summary Table

| Config location     | Hook / callback name            | Triggered when                                   |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| `emailVerification` | `sendVerificationEmail`         | Sign-up (`sendOnSignUp: true`) or resend request |
| `emailAndPassword`  | `sendResetPassword`             | Forgot-password request                          |
| `user.changeEmail`  | `sendChangeEmailConfirmation`   | Email change request                             |
| `user.deleteUser`   | `sendDeleteAccountVerification` | Delete account initiation                        |
| `organization(...)` | `sendInvitationEmail`           | Member invitation                                |
| `hooks.after`       | `createAuthMiddleware`          | Any auth event — branch on `ctx.path`            |

---

## 7. Testing Emails in Development

Stub `sendEmail` to avoid sending real emails:

```typescript
// lib/emails/send-email.ts
export function sendEmail({ to, subject, html, text }: { ... }) {
  if (process.env.NODE_ENV === "development") {
    console.log(`Email → ${to} | ${subject}`);
    return Promise.resolve();
  }
  return postmarkClient.sendEmail({ ... });
}
```

Or use a local SMTP catcher such as [Mailpit](https://mailpit.axllent.org/) / [MailHog](https://github.com/mailhog/MailHog) and point `send-email.ts` at it.

---

## References

- https://www.better-auth.com/docs/concepts/email-verification
- https://www.better-auth.com/docs/concepts/hooks
- https://www.better-auth.com/docs/plugins/organization
