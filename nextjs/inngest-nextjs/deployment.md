# Inngest Deployment — Reference

## Serve vs Connect

| Model                                 | How It Works                                                   | Best For                                          |
| ------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| **`serve()`** (Hosted)                | HTTP endpoint at `/api/inngest`; Inngest Cloud calls your app  | Vercel, Netlify, Cloudflare Pages, any serverless |
| **`connect()`** (Self-hosted Workers) | Persistent WebSocket outbound to Inngest; long-running process | Kubernetes, ECS, Render, Fly.io, containers       |
| **Self-hosted Inngest**               | Single binary (`inngest start`) with SQLite/Postgres + Redis   | Full control, data privacy, on-prem               |

### Serve Handler (Next.js App Router)

```typescript
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { helloWorld } from "../../../inngest/functions/hello";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [helloWorld],
});
```

Register multiple function files:

```typescript
import { executeWorkflow } from "../../../inngest/functions/workflow";
import { sendWeeklyDigest } from "../../../inngest/functions/digest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executeWorkflow, sendWeeklyDigest],
});
```

### Connect Worker (Long-Running Process)

```typescript
import { Inngest } from "inngest";
import { connect } from "inngest/connect";

const inngest = new Inngest({ id: "my-app" });

const connection = await connect({
  apps: [{ client: inngest, functions: [handleSignupFunction] }],
  instanceId: process.env.MY_CONTAINER_ID,
  maxWorkerConcurrency: 10,
});

console.log("Connected to Inngest");
```

## Environment Variables

```bash
# Required for production (not needed with INNGEST_DEV=1)
INNGEST_EVENT_KEY="your-event-key"
INNGEST_SIGNING_KEY="your-signing-key"

# Optional: custom base URL for self-hosted Inngest
INNGEST_BASE_URL="https://custom-inngest.example.com"

# Development mode
INNGEST_DEV=1
```

## Client Configuration

```typescript
// inngest/client.ts
import { Inngest } from "inngest";
import { env } from "@/lib/env";

export const inngest = new Inngest({
  id: "my-app",
  eventKey: env.INNGEST_EVENT_KEY,
  inngestBaseUrl: env.INNGEST_BASE_URL,
  isDev: env.INNGEST_EVENT_KEY === "local" || process.env.NODE_ENV === "development",
});
```

## Production Checklist

- [ ] `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` set in production env
- [ ] `/api/inngest` route accessible from Inngest Cloud (not behind auth)
- [ ] Functions registered in `serve()` call
- [ ] Retries configured appropriately per function
- [ ] `onFailure` handlers set for critical paths
- [ ] Step IDs are stable across deploys (for replay compatibility)
- [ ] No mutable state stored in closures or module scope
- [ ] Database connections handled inside `step.run()` (not outside)
- [ ] Rate limits respected for external API calls
- [ ] Realtime channels have proper access controls (token minting validates ownership)

## Deploying to Vercel

```json
// vercel.json
{
  "functions": {
    "app/api/inngest/route.ts": {
      "maxDuration": 60
    }
  }
}
```

Set environment variables in Vercel dashboard. The `/api/inngest` route must be publicly accessible.

## Migrating Between Environments

1. Export functions from a shared `inngest/functions/` directory
2. Create separate client instances per environment (dev/prod)
3. Use different Inngest app IDs to isolate runs
4. Event names should be consistent across environments
