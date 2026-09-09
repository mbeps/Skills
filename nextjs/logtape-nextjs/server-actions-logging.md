# Server Actions Logging

Next.js Server Actions execute exclusively on the server runtime. They are the primary boundary where mutations and data mutations occur, making them the most critical point for application telemetry.

---

## 1. Mutations vs. Queries

| Action Type                                     | Log Level | When to Log                                | Example                                   |
| ----------------------------------------------- | --------- | ------------------------------------------ | ----------------------------------------- |
| **Mutations** (`create*`, `update*`, `delete*`) | `info`    | On successful execution                    | `Song created (id: ${songId})`            |
| **Mutations**                                   | `warn`    | On expected domain/validation/auth failure | `Unauthorized song creation attempt`      |
| **Mutations**                                   | `error`   | On unexpected crash or database failure    | `Failed to create song: ${error.message}` |
| **Queries** (`get*`, `fetch*`)                  | `debug`   | On invocation / query execution            | `Fetching all songs`                      |
| **Queries**                                     | `error`   | On database or network failure             | `Error fetching songs: ${error.message}`  |

> [!IMPORTANT]
> **Why Queries Use `debug`**: In Next.js App Router, Server Components invoke query actions on every navigation and background revalidation. Logging queries at `info` causes severe log flooding and pollutes production monitoring. By default (`LOG_LEVEL=info`), only mutations and failures appear. When diagnosing issues, developers set `LOG_LEVEL=debug` to view query traces.

---

## 2. Category Hierarchy Convention

Always use hierarchical array categories with domain grouping:

```typescript
const log = getLogger(["app", "actions", "<domain>"]);
```

Examples:
- `["app", "actions", "song"]` → renders as `app·actions·song`
- `["app", "actions", "album"]` → renders as `app·actions·album`
- `["app", "actions", "auth"]` → renders as `app·actions·auth`
- `["app", "actions", "playlist"]` → renders as `app·actions·playlist`

---

## 3. Implementation Patterns

### Pattern A: Mutation Action (`createSong.ts`)

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";

const log = getLogger(["app", "actions", "song"]);

export interface CreateSongInput {
  title: string;
  artistId: string;
  songPath: string;
  imagePath: string;
}

export default async function createSong(input: CreateSongInput) {
  const supabase = await createServerClient();

  // 1. Authentication check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    log.warn("Unauthorized attempt to create song");
    return { error: "You must be signed in to upload songs." };
  }

  try {
    // 2. Database mutation
    const { data, error } = await supabase
      .from("songs")
      .insert({
        title: input.title,
        artist_id: input.artistId,
        song_path: input.songPath,
        image_path: input.imagePath,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (error) {
      log.error("Database error inserting song: {message}", { message: error.message });
      return { error: "Failed to save song to database." };
    }

    // 3. Success telemetry
    log.info("Song created successfully (id: {songId})", { songId: data.id });
    revalidatePath("/songs");
    return { data };
  } catch (err) {
    log.error("Unexpected error in createSong: {error}", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "An unexpected error occurred." };
  }
}
```

### Pattern B: Query Action (`getSongs.ts`)

```typescript
"use server";

import { getLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";

const log = getLogger(["app", "actions", "song"]);

export default async function getSongs() {
  // Queries log at debug level
  log.debug("Fetching all songs");

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    // Errors during queries are always logged at error level
    log.error("Failed to fetch songs: {message}", { message: error.message });
    return [];
  }

  return data ?? [];
}
```

---

## 4. Privacy & Security Rules (Zero Leakage)

To comply with security and privacy regulations (GDPR, SOC2):
- **NEVER** log raw passwords, hashes, passkey credentials, or session cookies.
- **NEVER** log raw authorization tokens or `Bearer` headers.
- **NEVER** log personal user data (emails, credit card digits, home addresses) in message strings.
- **SAFE TO LOG**: Entity IDs (`userId`, `songId`, `albumId`), HTTP status codes, count of affected records, duration timings, and sanitized database error codes.

```typescript
// ❌ DANGEROUS: Leaks user password and auth token
log.info("User sign-in attempt", { email: body.email, password: body.password });

// ✅ SAFE: Logs only non-sensitive identifiers and context
log.info("User sign-in succeeded (userId: {userId})", { userId: user.id });
```

---

## 5. Next.js Turbopack Export Convention

When Server Actions (`"use server"`) are called from Client Components (`"use client"`), Next.js Turbopack synthesizes client RPC stubs.
- If an action file uses `export default function createSong(...)`, client components must import it with default import syntax:
  ```typescript
  import createSong from "@/actions/song/create-song";
  ```
- Mixing `export default` with `import { createSong } from "@/actions/song/create-song"` triggers a Turbopack build failure:
  `Error: Export createSong doesn't exist in target module. Did you mean to import default?`
- **Rule**: Consistently standardize across all server actions in the project (e.g. always `export default <action>` and `import <action> from ...`).

