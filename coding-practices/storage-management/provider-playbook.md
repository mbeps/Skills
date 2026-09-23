# Cloud Provider & Stack Playbook

## 1. Supabase Storage

### Critical Schema Realities
In Supabase, object metadata is managed under the `storage.objects` table.

> [!WARNING]
> There is **NO `size` column** in `storage.objects`! Querying `SELECT size FROM storage.objects` throws a runtime SQL error: `column "size" does not exist`.

- File size is stored inside the JSONB `metadata` column.
- To query numeric size safely:
  ```sql
  -- Correct JSONB extraction (casts text extraction to BIGINT)
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  FROM storage.objects
  WHERE bucket_id = 'songs';
  ```
- **Upload Metadata**: The standard JavaScript SDK automatically populates `metadata->>'size'`. If uploading via custom HTTP streams, ensure the size property is recorded.

---

### Production RPC Gating (Source-of-Truth Live Summation)

Deploying `SECURITY DEFINER` functions allows client actions to check storage capacity securely without exposing raw access to the internal `storage` schema:

```sql
-- Global quota summation
CREATE OR REPLACE FUNCTION get_global_storage_usage()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
    SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
    FROM objects;
$$;

-- Per-user quota summation
CREATE OR REPLACE FUNCTION get_user_storage_usage(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
    SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
    FROM objects
    WHERE owner = p_user_id;
$$;
```

---

### Cascading Cleanup via Database Triggers

When an application row is deleted, a trigger ensures storage records are purged automatically:

```sql
CREATE OR REPLACE FUNCTION delete_storage_object_on_song_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, public
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'songs' AND name = OLD.song_path;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_song_deleted
AFTER DELETE ON public.songs
FOR EACH ROW
EXECUTE FUNCTION delete_storage_object_on_song_delete();
```

---

### Mixed-Case OAuth Avatars

Users signing in via OAuth (GitHub, Google) often have avatars hosted on provider CDNs. Storing external URLs alongside internal storage paths requires branching in the UI:

```typescript
export function resolveAvatarUrl(avatarPathOrUrl: string | null): string | null {
  if (!avatarPathOrUrl) return null;
  // If full external URL (OAuth), return as-is
  if (avatarPathOrUrl.startsWith("http://") || avatarPathOrUrl.startsWith("https://")) {
    return avatarPathOrUrl;
  }
  // Internal bucket path: resolve via Supabase CDN
  return supabase.storage.from("images").getPublicUrl(avatarPathOrUrl).data.publicUrl;
}
```

---

## 2. AWS S3 & Cloudflare R2

### AWS S3 Presigned POST (Hardening Byte Limits)
Do not use standard presigned `PUT` URLs when strict byte limits are required. Use **Presigned POST** with `content-length-range`:

```typescript
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function createUploadPresignedPost(key: string, maxSizeBytes: number, mimeType: string) {
  return await createPresignedPost(s3, {
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    Conditions: [
      ["starts-with", "$Content-Type", mimeType],
      ["content-length-range", 1024, maxSizeBytes], // Cloud edge rejects files outside [1KB, maxSizeBytes]
    ],
    Expires: 900, // 15 minutes
  });
}
```

### Cloudflare R2
Cloudflare R2 provides zero-egress S3 compatibility:
- **Worker Bindings**: When running inside Cloudflare Workers, use native bindings `env.MY_BUCKET.put(key, stream)` for streaming quota checks and minimal latency.
- **Operation Costs**: R2 meters Class A ($0.0045/10k) and Class B ($0.00036/10k) operations. Avoid polling or scanning buckets frequently (`R2ListObjects`). Rely on application database ledgers.

### AWS S3 Event Notifications (Asynchronous Quota Commit)
To eliminate client trust entirely:
1. Configure S3 Event Notification for `s3:ObjectCreated:*`.
2. Send event to AWS SQS or EventBridge.
3. Background worker reads message containing verified `object.size` and commits usage to the database quota ledger.

---

## 3. Google Cloud Storage (GCS)

### Signed URL V4 with Headers
In Google Cloud Storage, enforce byte size bounds using signed headers:

```typescript
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

export async function getGcsUploadUrl(fileName: string, maxBytes: number, contentType: string) {
  const [url] = await storage
    .bucket(process.env.GCS_BUCKET_NAME!)
    .file(fileName)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
      extensionHeaders: {
        "x-goog-content-length-range": `0,${maxBytes}`,
      },
    });

  return url;
}
```

---

## 4. Relational & Document Schema Implementations

### Drizzle ORM (PostgreSQL)

```typescript
// schema/storage.ts
import { pgTable, uuid, bigint, timestamp, text, index } from "drizzle-orm/pg-core";

export const tenantStorageQuotas = pgTable("tenant_storage_quotas", {
  tenantId: uuid("tenant_id").primaryKey(),
  maxBytes: bigint("max_bytes", { mode: "number" }).notNull(),
  usedBytes: bigint("used_bytes", { mode: "number" }).notNull().default(0),
  reservedBytes: bigint("reserved_bytes", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const storageLedger = pgTable("storage_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  fileKey: text("file_key").notNull(),
  deltaBytes: bigint("delta_bytes", { mode: "number" }).notNull(),
  eventType: text("event_type").notNull(), // 'RESERVATION', 'COMMIT', 'RELEASE', 'RECONCILE'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_storage_ledger_tenant").on(table.tenantId, table.createdAt),
]);
```

### Prisma ORM

```prisma
// schema.prisma
model TenantStorageQuota {
  tenantId      String   @id @db.Uuid
  maxBytes      BigInt
  usedBytes     BigInt   @default(0)
  reservedBytes BigInt   @default(0)
  updatedAt     DateTime @updatedAt

  @@map("tenant_storage_quotas")
}

model StorageLedger {
  id         String   @id @default(uuid()) @db.Uuid
  tenantId   String   @db.Uuid
  fileKey    String
  deltaBytes BigInt
  eventType  String
  createdAt  DateTime @default(now())

  @@index([tenantId, createdAt])
  @@map("storage_ledger")
}
```

### MongoDB (Document-Level Byte Counters)

When persisting metadata in MongoDB, use atomic `$inc` operators:

```typescript
// Atomic quota check and increment in MongoDB
async function reserveMongoQuota(tenantId: string, incomingBytes: number, maxBytes: number) {
  const result = await db.collection("tenants").findOneAndUpdate(
    {
      _id: new ObjectId(tenantId),
      $expr: {
        $lte: [{ $add: ["$usedBytes", "$reservedBytes", incomingBytes] }, maxBytes],
      },
    },
    {
      $inc: { reservedBytes: incomingBytes },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );

  return result !== null;
}
```

---

## 5. Local POSIX & Container Disk Storage

When running on local disks, Docker volumes, or Kubernetes Persistent Volumes (PV):
- **Disk Saturation Check**: Inspect volume capacity using `fs.statfs` (Node.js 18.15+) before accepting streams:
  ```typescript
  import { statfs } from "node:fs/promises";

  export async function checkDiskSpace(mountPath: string, minFreeBytes = 10 * 1024 * 1024 * 1024) {
    const stats = await statfs(mountPath);
    const freeBytes = stats.bavail * stats.bsize;
    if (freeBytes < minFreeBytes) {
      throw new Error("Server storage critical: disk capacity below operating safety margin.");
    }
  }
  ```
- **File Descriptor Leak Prevention**: Always close upload streams and handles in `finally` blocks; file descriptor exhaustion (`EMFILE: too many open files`) triggers under high upload concurrency before disk space is exhausted.
