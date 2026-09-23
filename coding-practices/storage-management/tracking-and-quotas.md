# Storage Tracking & Quota Architecture

## Quota Hierarchy & Scopes

Storage limits must be evaluated at the correct boundary in the application hierarchy. Robust systems enforce quotas across multiple layers simultaneously:

| Quota Scope            | Purpose                                            | Typical Limits           | Storage Location                          | Enforcement Point               |
| ---------------------- | -------------------------------------------------- | ------------------------ | ----------------------------------------- | ------------------------------- |
| **Global / Platform**  | Prevent runaway cloud infrastructure bills         | 50 GB – 5 TB             | App config / Env var (`STORAGE_LIMIT_GB`) | Edge / Server Action / Ingress  |
| **Tenant / Org**       | Enforce SaaS subscription tier boundaries          | Free: 1 GB, Pro: 50 GB   | `tenants.max_storage_bytes`               | API middleware / Upload handler |
| **User**               | Prevent single-user abuse within shared workspaces | 500 MB – 10 GB           | `users.storage_bytes` / Stored RPC        | User service / Upload handler   |
| **Entity / Container** | Prevent bloat on a single record (album, ticket)   | 50 MB – 500 MB           | `entity.storage_bytes`                    | Entity mutation service         |
| **Per-File Size**      | Prevent memory exhaustion and timeout errors       | 2 MB avatar, 20 MB audio | Config / Zod schema                       | Client + Server upload parser   |

---

## The 5 Tracking Architectural Patterns

```
                                  STORAGE TRACKING PATTERNS
  ┌───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┐
  │ 1. Live Summation     │ 2. Row / Trigger      │ 3. Dedicated Quota    │ 4. Cache / Redis      │ 5. Provider API Scan  │
  │    (Source-of-Truth)  │    Materialized Count │    Ledger Table       │    Token Bucket       │    (Offline Only)     │
  ├───────────────────────┼───────────────────────┼───────────────────────┼───────────────────────┼───────────────────────┤
  │ Direct SQL `SUM(size)`│ `entity.storage_bytes`│ Balance + append-only │ In-memory atomic      │ `s3.listObjectsV2` or │
  │ via RPC / Function    │ updated via triggers  │ transaction ledger    │ counter + DB async sync│ CloudWatch metrics    │
  ├───────────────────────┼───────────────────────┼───────────────────────┼───────────────────────┼───────────────────────┤
  │ • 100% accurate       │ • O(1) reads          │ • Complete audit log  │ • Sub-millisecond     │ • Ground truth bucket │
  │ • Zero drift          │ • Simple updates      │ • Supports 2-phase res│ • Handles extreme peak│   reality             │
  │ • No sync state needed│ • Zero app changes    │ • Enterprise billing  │ • Zero DB row lock    │ • Zero DB schema      │
  │ ⚠️ O(N) at >100k rows │ ⚠️ Trigger maintenance│ ⚠️ Multi-row write overhead│ ⚠️ Cache-DB drift risk│ ⚠️ 500ms-3s latency / lag│
  └───────────────────────┴───────────────────────┴───────────────────────┴───────────────────────┴───────────────────────┘
```

---

### Pattern 1: Source-of-Truth Live Summation (Zero Drift, Simple)

Queries the storage object metadata directly using a database function or SQL RPC to compute live consumption:

```sql
-- Global application storage summation
CREATE OR REPLACE FUNCTION get_global_storage_usage()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
    SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
    FROM objects;
$$;

-- Per-user storage summation
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

**Why this pattern works so well**:
1. **Zero Drift**: Eliminates counter desynchronization entirely. Files deleted via cloud dashboards, administrative scripts, or database cascades are reflected instantaneously.
2. **No State Management**: No rollback logic needed when an upload fails midway.
3. **When to Choose**: Early-stage to medium applications (< 100,000 stored objects), media libraries (music, photos, user avatars), and personal workspaces.

---

### Pattern 2: Materialized / Row-Level Counters via Triggers ($O(1)$ Reads)

Stores aggregate bytes in a dedicated column on the entity or user row, updated automatically via database `AFTER INSERT` and `AFTER DELETE` triggers:

```sql
-- Add counter columns to parent entity or settings table
ALTER TABLE public.users ADD COLUMN storage_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.app_settings ADD COLUMN total_storage_bytes BIGINT NOT NULL DEFAULT 0;

-- Trigger function maintaining user and global counters atomically
CREATE OR REPLACE FUNCTION maintain_storage_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users 
    SET storage_bytes = storage_bytes + NEW.size_bytes 
    WHERE id = NEW.owner_id;

    UPDATE public.app_settings 
    SET total_storage_bytes = total_storage_bytes + NEW.size_bytes;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users 
    SET storage_bytes = GREATEST(0, storage_bytes - OLD.size_bytes) 
    WHERE id = OLD.owner_id;

    UPDATE public.app_settings 
    SET total_storage_bytes = GREATEST(0, total_storage_bytes - OLD.size_bytes);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

**When to Choose**: Scale phase (100,000 to 1,000,000 objects) where $O(N)$ sequential table scans exceed 50ms latency, but application architecture must remain simple with $O(1)$ checks.

---

### Pattern 3: Dedicated Quota Ledger (Enterprise / Multi-Tenant SaaS)

Maintains an explicit balance with pending reservations and an append-only audit trail of every byte added or removed.

```sql
CREATE TABLE public.tenant_storage_quotas (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  max_bytes BIGINT NOT NULL,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  reserved_bytes BIGINT NOT NULL DEFAULT 0, -- Held for in-flight direct uploads
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_usage CHECK (used_bytes >= 0),
  CONSTRAINT positive_reservation CHECK (reserved_bytes >= 0)
);

CREATE TABLE public.storage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  delta_bytes BIGINT NOT NULL, -- Positive for uploads, negative for deletes
  event_type TEXT NOT NULL,    -- 'RESERVATION', 'COMMIT', 'RELEASE', 'RECONCILIATION'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_storage_ledger_tenant ON public.storage_ledger(tenant_id, created_at DESC);
```

**When to Choose**: Multi-tenant B2B SaaS with billable tiers, compliance audit logs, or direct-to-S3 uploads requiring reservation holds.

---

### Pattern 4: Distributed Cache Token Bucket (High Throughput)

Maintains hot counters in Redis using atomic operations (`INCRBY`, `DECRBY`), asynchronously persisted to the database via background jobs or event streams.

```typescript
// Atomically check and reserve in Redis
async function reserveRedisQuota(tenantId: string, incomingBytes: number, maxBytes: number): Promise<boolean> {
  const key = `quota:tenant:${tenantId}:used`;
  const newUsage = await redis.incrby(key, incomingBytes);
  
  if (newUsage > maxBytes) {
    // Exceeded: roll back immediately
    await redis.decrby(key, incomingBytes);
    return false;
  }
  return true;
}
```

**When to Choose**: High-frequency upload systems (> 50 uploads/second) where database row locks on tenant or user rows create database write bottlenecks.

---

### Pattern 5: Cloud Provider Metrics / Object Store Scans (Offline Only)

Querying `s3.listObjectsV2`, bucket metrics APIs, or AWS CloudWatch `BucketSizeBytes` directly.

> [!CAUTION]
> **NEVER use Pattern 5 in the synchronous upload path**:
> 1. Listing 10,000 objects in S3 takes 500ms–3s.
> 2. S3/Cloud storage APIs throttle rapidly under burst traffic.
> 3. CloudWatch and GCP storage metrics lag by **24 to 48 hours**; they cannot block an upload occurring right now.
> 
> Use Pattern 5 **exclusively inside offline reconciliation cron jobs**.

---

## Progressive Scale Path (3-Phase Scale Roadmap)

Architectures should evolve predictably without breaking client interfaces or application server actions:

```
┌────────────────────────────────┐       ┌────────────────────────────────┐       ┌────────────────────────────────┐
│   PHASE 1: LIVE SUMMATION      │  ──>  │ PHASE 2: MATERIALIZED TRIGGERS │  ──>  │  PHASE 3: LEDGER + DISTRIBUTED │
│  (< 100k stored objects)       │       │  (100k - 1M stored objects)    │       │  (> 1M objects / high bursts)  │
├────────────────────────────────┤       ├────────────────────────────────┤       ├────────────────────────────────┤
│ • Direct SQL `SUM(size)` RPCs  │       │ • Trigger updates counter cols │       │ • Redis token bucket for speed │
│ • 100% source-of-truth accuracy│       │ • O(1) reads without scan      │       │ • DB ledger for audit & billing│
│ • Zero drift, zero sync workers│       │ • Zero application API changes │       │ • 2-phase reservation protocol │
└────────────────────────────────┘       └────────────────────────────────┘       └────────────────────────────────┘
```

**Key migration invariant**: Keep validation function signatures identical:
```typescript
validateStorageLimits(newFileSize: number, userId: string, oldFileSize?: number)
```
When transitioning from Phase 1 to Phase 2, update only the internal RPC or SQL query. The application layer and UI remain completely unaware of the performance optimization.

---

## Concurrency & Atomic Guard Queries

Checking quota and updating usage in separate non-atomic steps causes **TOCTOU (Time-of-Check to Time-of-Use)** race conditions: concurrent requests both see available headroom and upload simultaneously, exceeding quotas.

### Atomic Check-and-Add in PostgreSQL / MySQL

Enforce validation directly inside the mutative SQL statement:

```sql
-- PostgreSQL Atomic Quota Guard
UPDATE public.tenant_storage_quotas
SET 
  used_bytes = used_bytes + :incoming_bytes,
  updated_at = NOW()
WHERE tenant_id = :tenant_id
  AND (used_bytes + reserved_bytes + :incoming_bytes) <= max_bytes
RETURNING used_bytes, max_bytes;
```

**Result Handling**:
- **1 row returned**: Quota available. Update completed atomically.
- **0 rows returned**: Quota exceeded. Reject upload immediately with `413 Payload Too Large` or `403 Quota Exceeded`. Zero locks, zero race conditions.

---

## Unit & Storage Precision Rules

1. **Store Bytes as BIGINT**: Always store storage in raw bytes (`BIGINT` / 64-bit integer). Never store fractional MB or GB in database quota tables to prevent floating-point rounding errors.
2. **Binary vs Decimal Units**:
   - Storage quotas (RAM, disk, S3) are calculated in binary bytes ($1 \text{ GiB} = 1024^3 = 1,073,741,824 \text{ bytes}$).
   - Network bandwidth is often decimal ($1 \text{ GB} = 1000^3 = 1,000,000,000 \text{ bytes}$).
   - Standardize across the codebase using explicit constants:
     ```typescript
     export const STORAGE_UNITS = {
       BYTE: 1,
       KB: 1024,
       MB: 1024 * 1024,
       GB: 1024 * 1024 * 1024,
       TB: 1024 * 1024 * 1024 * 1024,
     } as const;
     ```
