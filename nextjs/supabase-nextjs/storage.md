# Storage

> Prerequisite: read `SKILL.md` first.

## Buckets

Create buckets via the Dashboard, SQL, or the client:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/png','image/jpeg']);
```

```ts
await supabase.storage.createBucket("avatars", {
  public: false,
  allowedMimeTypes: ["image/png", "image/jpeg"],
  fileSizeLimit: 5 * 1024 * 1024,
})
```

`public: true` = no-auth reads; private buckets are gated by RLS on `storage.objects`. Public buckets are the common case; use private for gated content.

## Storage RLS policies

Per-operation grants on `storage.objects`: `insert` for upload, `select` for download/list, `update` (+`select`) for upsert/move, `delete` (+`select`) for remove. Scope paths via `storage.foldername(name)`:

```sql
create policy "Users upload to their own avatar folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Public avatar reads"
on storage.objects for select to authenticated
using (bucket_id = 'avatars');
```

Owner-column pattern: `using ((select auth.jwt()->>'sub') = owner_id)` (the `owner_id` column on `storage.objects`). Service keys bypass storage RLS entirely — server-only.

## Public vs private access

- **Public bucket** — `getPublicUrl(path)` is synchronous, no network, permanent, no auth. **Store the path, not the URL** (primary convention); resolve on demand; pass `http(s)://` OAuth avatar URLs through untouched:

```ts
const { data } = supabase.storage.from("avatars").getPublicUrl(`user-${userId}.png`)
// data.publicUrl → https://<ref>.supabase.co/storage/v1/object/public/avatars/user-1.png
```

⚠️ Storing hand-concatenated public URLs in the DB (a deviation seen in one audited project) breaks bucket renames, signed-URL flows, and cleanup — avoid it.

- **Private bucket** — time-limited, no login required:

```ts
const { data } = await supabase.storage
  .from("private-docs")
  .createSignedUrl(`invoices/${id}.pdf`, 60)   // expiresIn seconds
```

```ts
// Signed upload URL (valid 2 hours)
const { data } = await supabase.storage
  .from("avatars")
  .createSignedUploadUrl(`user-${userId}.png`)
// then: supabase.storage.from("avatars").uploadToSignedUrl(path, token, file)
```

## Uploads

Two paths:

**Client-side** — user media; the user's own session authorizes the write via storage policies:

```ts
const { data, error } = await supabase.storage.from("songs").upload(
  `${userId}/${crypto.randomUUID()}.mp3`,
  file,
  { contentType: "audio/mpeg", upsert: false, cacheControl: "3600" }
)
```

Standard upload is recommended ≤ 6MB (use TUS resumable beyond). `upsert: false` (default) returns 400 "Asset Already Exists" — pass `upsert: true` to overwrite explicitly.

**Server-side** — small/sensitive files (avatars): multipart FormData → server action. Validate MIME + size + quotas, remove old then upload, update DB, roll back the new object on DB failure, `revalidatePath`:

```ts
"use server"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const FILE_LIMITS = { AVATAR_MAX_BYTES: 5 * 1024 * 1024 }   // from validated env, pre-computed

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const file = formData.get("avatar") as File
  if (!file || file.size > FILE_LIMITS.AVATAR_MAX_BYTES || !file.type.startsWith("image/")) {
    return { ok: false, error: "invalid file" }
  }

  const path = `user-${user.id}.png`
  // 1. remove old object (best-effort)
  await supabase.storage.from("avatars").remove([path])
  // 2. upload new object
  const { error: uploadError } = await supabase.storage
    .from("avatars").upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) return { ok: false, error: uploadError.message }
  // 3. update DB; roll back the new object if the DB write fails
  const { error: dbError } = await supabase
    .from("profiles").update({ avatar_path: path }).eq("id", user.id)
  if (dbError) {
    await supabase.storage.from("avatars").remove([path])
    return { ok: false, error: dbError.message }
  }
  revalidatePath("/account")
  return { ok: true }
}
```

Optional quotas: enforce user/global storage limits via SECURITY DEFINER RPCs that sum object sizes (`get_user_storage_usage` / `get_global_storage_usage` style) — validate against pre-computed `FILE_LIMITS` byte constants.

## Cleanup

Two layers — application best-effort **and** a SECURITY DEFINER trigger:

**Layer 1 — in the action** (read row → delete DB row → remove object; try/catch and continue):

```ts
const { data: song } = await supabase.from("songs").select("file_path").eq("id", id).single()
const { error: dbError } = await supabase.from("songs").delete().eq("id", id)
if (!dbError && song) {
  await supabase.storage.from("songs").remove([song.file_path])   // best-effort
}
```

**Layer 2 — trigger** (belt-and-braces for rows deleted outside actions):

```sql
create or replace function public.delete_song_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform storage.delete('songs', old.file_path);
  return old;
end;
$$;

create trigger delete_song_storage_object
after delete on public.songs
for each row execute function public.delete_song_storage_object();
```

Delete child rows honoring `RESTRICT` FKs before deleting parents.

**Migrate existing URL columns** — backfill a path column from stored URLs, verify, then drop the URL column:

```sql
-- One-time backfill: URL → stored path (bucket prefix is kept).
update public.songs
set file_path = regexp_replace(
  file_url,
  '^https?://[^/]+/storage/v1/object/public/',
  ''
)
where file_path is null or file_path = '';
-- single-bucket apps: also strip the bucket segment to stay bucket-relative:
--   regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/public/avatars/', '')
-- where you need the bucket separately: storage.foldername(path)[1]
-- alter table public.songs drop column file_url;  -- after spot-checking getPublicUrl(path)
```

## Serving images

Let `next/image` serve Supabase hosts by deriving `remotePatterns` from the env URL:

```ts
// next.config.ts
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)

const nextConfig = {
  images: {
    remotePatterns: [{
      protocol: supabaseUrl.protocol.slice(0, -1) as "http" | "https",
      hostname: supabaseUrl.hostname,
    }],
  },
}
```

Prefer client-side multipart uploads over base64-in-action uploads — the latter hit Next.js server-action body-size limits (e.g., `50mb` configs).

## Common Mistakes

- Storing URLs instead of paths — breaks bucket moves, signed URLs, and cleanup.
- `getPublicUrl` on a private bucket (it does not check publicity), or missing storage policies → silent 401/403.
- Unauthenticated writes allowed (no `TO authenticated`).
- Forgetting cleanup → orphaned objects accumulate.
- Service-role key in the browser for uploads; not validating file type/size server-side.
- `upsert: false` surprises when overwriting (400 "Asset Already Exists").

Official docs: [Storage](https://supabase.com/docs/guides/storage) · [Quickstart](https://supabase.com/docs/guides/storage/quickstart) · [Uploads](https://supabase.com/docs/guides/storage/uploads) · [Access control](https://supabase.com/docs/guides/storage/security/access-control) · [createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
