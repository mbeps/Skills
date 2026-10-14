# Configuration, Environment & Type Architecture Refactoring

In maturing software systems, configuration and type definitions often degrade quietly: environment variables are accessed directly via ad-hoc process lookups, magic numbers and hardcoded strings scatter across controllers, giant type files become monolithic dumping grounds, and settings swing between inflexible hardcoded constants and database queries that degrade request performance. This reference provides concrete patterns for refactoring environment configuration, routing, enumerations, type architecture, and cached configuration.

---

## 1. Validated Environment Configuration and Decoupled Client-Server Boundaries

**Symptom**: Application files directly query runtime environment variables (`process.env.SUPABASE_URL`, `os.environ.get("DB_PORT")`, `os.Getenv("API_KEY")`) using non-null assertions (`!`) or duplicated inline fallbacks. Alternatively, a naive centralized schema validates both server secrets and public client variables in a single monolithic schema, causing fatal client-side crashes in production because server secrets evaluate to `undefined` in browser bundles.

### The Problem:
- **Client-Server Secret Bleed & Browser Crashes**: In modern full-stack web architectures (Next.js, Remix, Nuxt, SvelteKit), server secrets (`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`) are stripped by bundlers from browser bundles. A monolithic schema that parses both in the browser fails validation with "Required" errors, halting the app.
- **Bundler Inlining Failures**: Bundlers statically inline public variables (`process.env.NEXT_PUBLIC_*`) via AST text replacement only when explicitly referenced. Accessing variables dynamically (e.g. `process.env[key]`) breaks bundler inlining on the client.
- **Late Failure & Silent Coercion**: A missing environment variable crashes at runtime inside a nested function call rather than failing fast at application boot, or boolean flags evaluate incorrectly (e.g. `"false"` is truthy).
- **CI / Build-Time Failures**: Unit test suites fail in clean CI environments because they rely on ambient developer `.env` files, or Docker image builds fail during static asset compilation before secrets are injected.

### The Remediation: Decoupled Schemas, Eager Client Singleton & Lazy Server Proxy

1. **Decouple Client vs Server Schemas**:
   Define `clientEnvSchema` containing exclusively public, browser-accessible variables (`NEXT_PUBLIC_*`), and extend it into `serverEnvSchema` for backend credentials and private infrastructure secrets.
2. **Eager Browser-Safe Client Singleton (`clientEnv`)**:
   Parse and export `clientEnv` eagerly on module load. Because it validates only client-safe public keys, it can be imported safely by React/Vue/Svelte client components without triggering missing secret errors.
3. **Lazy Server Environment Access (`serverEnv` / `getServerEnv`)**:
   Never parse `serverEnvSchema` eagerly at module top level. In full-stack frameworks (Next.js, Nuxt, SvelteKit), client components are evaluated in Node.js during SSR and static build pre-rendering where `typeof window === "undefined"` is true. Evaluating server secrets at top level causes fatal build crashes when server secrets are omitted in client builds. Use a lazy getter or ES Proxy (`serverEnv`) that invokes `validateServerEnv()` only when a server-side caller actually accesses a secret property at runtime.
4. **Explicit Bundler Inlining Keys**:
   Pass explicit `process.env.NEXT_PUBLIC_*` dictionary keys to the validator so compiler bundlers (Webpack, Turbopack, Vite, esbuild) can perform static AST text replacement.
5. **Build-Time Escape Hatch (`SKIP_ENV_VALIDATION`)**:
   Support `SKIP_ENV_VALIDATION` to permit Docker image builds, CI linting, and typechecks before runtime secrets are provisioned.
6. **Establish CI Test Setup Parity**:
   Define default deterministic mock environment variables in test setup files (`__tests__/setup.ts`, `conftest.py`, `test_helpers.go`) so test suites execute cleanly in CI without live credentials.
7. **Test Runner DOM Isolation Parity (`process.env.VITEST` / `JEST_WORKER_ID`)**:
   In full-stack projects where unit test runners (e.g. Vitest, Jest) run with a DOM environment (like `jsdom` or `happy-dom`), `typeof window === "undefined"` evaluates to `false` even though the test process is executing in Node.js testing backend actions, database repositories, or API routes. If environment validation strictly branches on `typeof window === "undefined"`, server tests mistakenly run the client schema (missing server secrets) or crash. Remediate by making server environment detection test-runner aware:
   `isServerEnv: boolean = typeof window === "undefined" || (typeof process !== "undefined" && Boolean(process.env.VITEST || process.env.JEST_WORKER_ID))`.

```typescript
// config/env.ts - Decoupled Client Singleton & Lazy Server Proxy
import { z } from "zod";

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
});

export const serverEnvSchema = clientEnvSchema.extend({
  CLERK_SECRET_KEY: z.string().min(1),
  EDGE_STORE_ACCESS_KEY: z.string().min(1),
  EDGE_STORE_SECRET_KEY: z.string().min(1),
  CONVEX_DEPLOYMENT: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "warning", "error", "fatal"])
    .default("info")
    .transform((val) => (val === "warn" ? "warning" : val)),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = ServerEnv;

export function validateClientEnv(
  runtimeEnv: Record<string, unknown> = {
    // Explicit keys allow bundlers to statically inline NEXT_PUBLIC_* variables
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
): ClientEnv {
  if (process.env.SKIP_ENV_VALIDATION === "true" || process.env.SKIP_ENV_VALIDATION === "1") {
    return runtimeEnv as ClientEnv;
  }
  const parsed = clientEnvSchema.safeParse(runtimeEnv);
  if (!parsed.success) {
    console.error("❌ Invalid client environment variables:", parsed.error.format());
    throw new Error("Invalid client environment variables");
  }
  return parsed.data;
}

export function validateServerEnv(
  runtimeEnv: Record<string, unknown> = {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    EDGE_STORE_ACCESS_KEY: process.env.EDGE_STORE_ACCESS_KEY,
    EDGE_STORE_SECRET_KEY: process.env.EDGE_STORE_SECRET_KEY,
    CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
  },
): ServerEnv {
  if (process.env.SKIP_ENV_VALIDATION === "true" || process.env.SKIP_ENV_VALIDATION === "1") {
    return runtimeEnv as ServerEnv;
  }
  const parsed = serverEnvSchema.safeParse(runtimeEnv);
  if (!parsed.success) {
    console.error("❌ Invalid server environment variables:", parsed.error.format());
    throw new Error("Invalid server environment variables");
  }
  return parsed.data as ServerEnv;
}

// 1. Browser-safe client singleton (evaluated eagerly)
export const clientEnv = validateClientEnv();

// 2. Memoised lazy server accessor (evaluated only on first server read)
let cachedServerEnv: ServerEnv | null = null;
export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = validateServerEnv();
  }
  return cachedServerEnv;
}

export function resetServerEnvCache(): void {
  cachedServerEnv = null;
}

// 3. Lazy proxy: Server components read properties transparently without eager SSR crash
export const serverEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string | symbol) {
    return getServerEnv()[prop as keyof ServerEnv];
  },
});

// Backward-compatible alias for existing server consumers
export const env = serverEnv;
export const validateEnv = validateServerEnv;

export const FILE_LIMITS = {
  LOGO_MAX_BYTES: 1 * 1024 * 1024,        // 1MB
  FAVICON_MAX_BYTES: 256 * 1024,           // 256KB
  COVER_IMAGE_MAX_BYTES: 5 * 1024 * 1024,  // 5MB
} as const;
```

```typescript
// __tests__/setup.ts - Hermetic Test Setup Parity
process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_12345";
process.env.CLERK_SECRET_KEY = "sk_test_12345";
process.env.EDGE_STORE_ACCESS_KEY = "test_access_key";
process.env.EDGE_STORE_SECRET_KEY = "test_secret_key";
```

```diff
# BEFORE: Monolithic schema or eager evaluation crashes browser / SSR build
- // In client component (e.g. providers/ConvexProvider.tsx):
- import { env } from "@/lib/env"; // Crashes during SSR if server secrets missing!
- const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

# AFTER: Client components consume safe clientEnv singleton; server actions use serverEnv
+ // In client component (e.g. providers/convex-provider.tsx):
+ import { clientEnv } from "@/config/env";
+ const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);
+
+ // In server action / route handler (e.g. app/api/edgestore/[...edgestore]/route.ts):
+ import { serverEnv } from "@/config/env";
+ const secret = serverEnv.EDGE_STORE_SECRET_KEY;
```

**Cross-Language Parallels**:
- **TypeScript / Next.js / Remix**: Eager `clientEnv` singleton for client components; lazy `serverEnv` proxy for server actions and route handlers.
- **Vue / Nuxt 3**: Segregate `runtimeConfig.public` (exposed to browser bundles) from private `runtimeConfig` keys in `nuxt.config.ts`.
- **SvelteKit**: Use `$env/static/public` for client UI and `$env/static/private` for server-only load functions; SvelteKit compiler blocks private imports in client code.
- **Python (FastAPI / Django)**: Expose public configurations via a dedicated unauthenticated `/api/v1/config` DTO endpoint; load database credentials strictly into private `pydantic_settings.BaseSettings` classes.
- **Go (Gin / Echo)**: Unmarshal environment into distinct `PublicConfig` (serializable to frontend template context) and `ServerConfig` structs via `envconfig`.
- **Java (Spring Boot)**: Map client-accessible properties to `@ConfigurationProperties("app.public")` and restrict sensitive credentials to vault-backed `@ConfigurationProperties("app.security")`.

---

## 2. Centralized Route Registries and Parameterized Query Builders

**Symptom**: URLs and route paths are written as raw string literals (`"/admin/cars"`, `"/cars?make=BMW&minPrice=10000"`) scattered across navigation links, server action redirects, middleware guards, and test assertions.

### The Problem:
- **Broken Links on Renames**: Changing an admin route from `/admin/test-drives` to `/admin/bookings` requires finding and replacing strings across dozens of files.
- **URL Query Encoding Bugs**: Building query strings with template strings (`?make=${make}&minPrice=${min}`) fails on special characters, spaces, or empty values.
- **Unclear Route Topology**: New team members cannot inspect a single file to see all existing public and protected routes.

### The Remediation: Domain-Grouped Route Registry & Dedicated Builders (Isolated from Auth Policies)

1. **Centralize Domain Routes in `config/routes.ts`**:
   Group paths into semantic domain namespaces using base path constants (`const CARS_BASE = "/cars"`), static `path` strings, and typed builder functions for dynamic parameters. Separate UI routes (`ROUTES`) from API endpoints (`API_ROUTES`).

2. **Isolate Access Control from the Route Registry**:
   Never leak authorization checks, session hooks, or `PROTECTED_ROUTES` arrays into `config/routes.ts`. Route paths represent URL topologies, not access policies. Manage route authentication rules in dedicated middleware/proxy modules (`proxy.ts`, `middleware.ts`, or access control policy definitions).

3. **Extract Parameterized Query Builders to Dedicated Functions**:
   Move dynamic URL generation logic to focused helper files (`lib/route/create-car-search-url.ts`, `lib/route/create-sign-in-redirect.ts`) with dedicated unit tests.

```typescript
// config/routes.ts - Domain-Grouped Route Registry (Isolated from Access Control)
const CARS_BASE = "/cars";
const ADMIN_BASE = "/admin";
const API_BASE = "/api";

export const ROUTES = {
  HOME: {
    path: "/",
  },
  CARS: {
    path: CARS_BASE,
    detail: (id: string) => `${CARS_BASE}/${id}`,
    edit: (id: string) => `${CARS_BASE}/${id}/edit`,
  },
  SAVED_CARS: {
    path: "/saved-cars",
  },
  RESERVATIONS: {
    path: "/reservations",
  },
  ADMIN: {
    path: ADMIN_BASE,
    cars: `${ADMIN_BASE}/cars`,
    carCreate: `${ADMIN_BASE}/cars/create`,
    settings: `${ADMIN_BASE}/settings`,
    testDrives: `${ADMIN_BASE}/test-drives`,
  },
  AUTH: {
    path: "/",
    signIn: "/sign-in",
    signUp: "/sign-up",
    forgotPassword: "/forgot-password",
    updatePassword: "/update-password",
  },
} as const;

export type Routes = typeof ROUTES;

export const API_ROUTES = {
  CARS: {
    path: `${API_BASE}/cars`,
    detail: (id: string) => `${API_BASE}/cars/${id}`,
  },
  RESERVATIONS: {
    path: `${API_BASE}/reservations`,
  },
} as const;

export type ApiRoutes = typeof API_ROUTES;
```

```typescript
// lib/route/create-car-search-url.ts - Parameterized URL Builder
import { ROUTES } from "@/config/routes";

export interface CarSearchParams {
  make?: string;
  bodyType?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}

export function createCarSearchUrl(params: CarSearchParams): string {
  const searchParams = new URLSearchParams();
  if (params.make) searchParams.set("make", params.make);
  if (params.bodyType) searchParams.set("bodyType", params.bodyType);
  if (params.minPrice != null && params.minPrice > 0) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null && params.maxPrice > 0) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.page != null && params.page > 1) searchParams.set("page", String(params.page));

  const query = searchParams.toString();
  return query ? `${ROUTES.CARS.path}?${query}` : ROUTES.CARS.path;
}
```

```diff
# BEFORE: Fragile inline string concatenation and route-leaked auth lists
- router.push(`/cars?make=${selectedMake}&minPrice=${min}&maxPrice=${max}`);
- export const PROTECTED_ROUTES = [ROUTES.SAVED_CARS, "/admin"]; // Leaking auth policy into route definitions!

# AFTER: Type-safe, domain-grouped route builder with auth handled in middleware
+ router.push(createCarSearchUrl({ make: selectedMake, minPrice: min, maxPrice: max }));
+ // Auth policy checked independently in middleware/proxy.ts, leaving routes.ts purely structural
```

---

## 3. Magic String Elimination and Domain Enum Centralization

**Symptom**: Statuses and roles (`"admin"`, `"user"`, `"pending"`, `"confirmed"`, `"cancelled"`, `"available"`, `"sold"`) are typed as raw strings throughout database queries, UI badges, server actions, and tests.

### The Problem:
- **Silent Typo Bugs**: A developer writes `"cancelled"` in one file and `"canceled"` in another; the status filter fails silently with zero compiler or runtime errors.
- **Incomplete Switch/Branch Handling**: Adding a new status (`"in_review"`) does not trigger compiler warnings at call sites handling existing statuses.

### The Remediation: Centralize Domain Enums / Literal Union Constants
Group domain enumerations into dedicated files under an `enums/` directory:

```typescript
// enums/booking-status.ts
export const BookingStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

// enums/user-role.ts
export const UserRole = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
```

```diff
# BEFORE: Raw literal strings prone to typos
- if (booking.status === "confirmed") { ... }
- await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);

# AFTER: Centrally referenced enum constants
+ import { BookingStatus } from "@/enums/booking-status";
+ if (booking.status === BookingStatus.CONFIRMED) { ... }
+ await supabase.from("bookings").update({ status: BookingStatus.CANCELLED }).eq("id", id);
```

**Cross-Language Parallels**:
- **Python**: Use `enum.StrEnum` (`class BookingStatus(StrEnum): PENDING = "pending"`).
- **Go**: Use custom string types with typed constants:
  ```go
  type BookingStatus string
  const (
      BookingStatusPending   BookingStatus = "pending"
      BookingStatusConfirmed BookingStatus = "confirmed"
  )
  ```
- **Rust**: Use `#[derive(Serialize, Deserialize)] enum BookingStatus { Pending, Confirmed, Cancelled }`.

---

## 4. Multi-Tier Domain Type Architecture

**Symptom**: All interfaces, database schemas, and API request models are dumped into a single massive `types/index.ts` file spanning hundreds of lines.

### The Problem:
- **Monolithic Import Bottleneck**: Any file touching a single type imports from the giant barrel, making tree-shaking and dependency tracking difficult.
- **Conflated Model Concerns**: Database column shapes (e.g. database column names like `created_at`, snake_case IDs, or raw JSON fields) bleed into frontend components.

### The Remediation: Domain-Scoped Folders & 4-Tier Model Segregation

Organize types by domain entity (`types/car/`, `types/dealership/`, `types/test-drive/`) and strictly enforce a 4-tier model hierarchy:

```
types/
├── car/
│   ├── raw-supabase-car.ts       # Tier 1: Raw Database Row (snake_case, nullable DB types)
│   ├── car.ts                    # Tier 2: Domain Entity (authoritative business properties)
│   ├── serialized-car.ts         # Tier 3: Transport DTO (safe wire format, ISO dates)
│   └── car-option.ts             # Tier 4: View/Selection Option (combobox/badge models)
├── common/
│   ├── action-response.ts        # Generic Result wrapper: { success, data, error }
│   └── pagination-info.ts        # Page, limit, total count
```

### The 4-Tier Model Hierarchy:

1. **Tier 1: Persistence Layer Model (`raw-*.ts`)**:
   Matches exact database table shapes (e.g. `raw_user_id`, `created_at: string | null`). Never imported directly by frontend components.
2. **Tier 2: Core Domain Model (`*.ts`)**:
   Clean entity with invariant requirements and normalized camelCase naming.
3. **Tier 3: Serialized Transport DTO (`serialized-*.ts`)**:
   Safe contract passed across the client-server boundary (JSON-serializable, dates formatted as strings, private fields stripped).
4. **Tier 4: View / Option Model (`*-option.ts`)**:
   Lightweight UI representations (e.g. `{ label: string; value: string }` for select dropdowns).

---

## 5. Hybrid Cached Configuration Pattern

**Symptom**: An application faces a trade-off between hardcoded constants and database queries:
- **Hardcoding into Constants**: Saves database calls and yields instant response times, but requires a full code commit, build, and deployment to update (e.g., changing dealership opening hours or business name).
- **Querying Database on Every Request**: Enables live updates via an admin dashboard, but introduces database latency on every page request, layout render, and metadata generation.

### The Remediation: Hybrid Cached Configuration with On-Demand Revalidation

Combine authoritative database persistence with static fallback constants, read-through cache tagging, and targeted on-demand cache revalidation:

```
┌────────────────────────────────────────────────────────┐
│  1. Read Request: Check Tagged Cache ("branding")      │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼ Cache Hit               ▼ Cache Miss
    ┌─────────────────────┐   ┌──────────────────────────────────┐
    │ Return Cached Value │   │ Fetch from DB (or fallback const)│
    │ (0ms DB latency)    │   │ and populate cache               │
    └─────────────────────┘   └──────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  2. Write Request (Admin updates settings in UI)       │
└───────────────────────────┬────────────────────────────┘
                            ▼
    ┌────────────────────────────────────────────────────┐
    │ Update Database Record                             │
    │ ➔ Trigger Immediate Revalidation: revalidateTag()  │
    └────────────────────────────────────────────────────┘
```

```typescript
// actions/settings/get-public-branding.ts
import { unstable_cache } from "next/cache";
import { DEFAULT_BRANDING } from "@/constants/branding";
import { createPublicClient } from "@/lib/supabase/supabase";

export const getPublicBranding = unstable_cache(
  async () => {
    try {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("dealership_info")
        .select("name, logo_url, phone, address")
        .single();

      if (error || !data) return DEFAULT_BRANDING; // Fallback constant if unseeded
      return {
        name: data.name || DEFAULT_BRANDING.name,
        logoUrl: data.logo_url || DEFAULT_BRANDING.logoUrl,
        phone: data.phone || DEFAULT_BRANDING.phone,
      };
    } catch {
      return DEFAULT_BRANDING;
    }
  },
  ["public-branding"],
  { revalidate: 86400, tags: ["branding"] } // 1-day TTL with tag
);
```

```typescript
// actions/settings/update-dealership-info.ts
import { revalidateTag } from "next/cache";

export async function updateDealershipInfo(input: DealershipInput) {
  // 1. Authorize caller & update database
  await db.update(dealershipInfo).set(input);

  // 2. Immediately bust the cached branding across all servers
  revalidateTag("branding");

  return { success: true };
}
```

This guarantees:
- **Instant Response Times**: Page renders and SEO metadata generators read from cache with zero database round-trips.
- **Immediate Propagation**: Admin updates bust the tag instantly, avoiding stale configuration without requiring code redeployments.
- **Zero-Downtime Resilience**: If the database is unreachable or unseeded, the system gracefully degrades to the static fallback constant.

---

## 6. Decoupling Domain Types from Reactive State Stores

**Symptom**: Core domain models and entities (`Post`, `Comment`, `Community`, `User`, `Vote`) are defined directly inside UI state store files (e.g. Jotai atoms `atoms/postsAtom.ts`, Redux slices, Zustand stores, Vue Pinia stores).

### The Problem: Store-Coupled Architecture & Circular Import Hazards
When types live inside reactive state stores:
1. **Circular Import Dependencies**: Pure utility functions in `lib/` or server actions that fetch data from the database need entity types. If they import `Post` from `atoms/postsAtom.ts`, and the hook `hooks/usePost.ts` imports both `lib/` and `atoms/`, circular dependency cycles emerge.
2. **Framework Leakage**: Non-UI code (background jobs, migrations, CLI utilities) cannot use domain types without transitively loading React and state management libraries.
3. **Bloated Bundles**: Tree-shaking suffers when simple type lookups pull in state store runtime singletons.

```
┌────────────────────────────────────────────────────────┐
│ BEFORE: Domain Types Trapped in Reactive Store         │
│ atoms/postsAtom.ts (Contains Post, PostVote, etc.)     │
│   ▲                      ▲                             │
│   │ imports Post         │ imports Post                │
│ lib/post/getPost.ts    hooks/posts/usePostVote.ts      │
│   ▲                      │                             │
│   └──────────────────────┘ Circular import risk!       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ AFTER: Decoupled Domain Types Hierarchy                │
│ types/post.ts (Pure TypeScript, Zero Runtime Libs)     │
│   ▲                      ▲                  ▲          │
│   │                      │                  │          │
│ atoms/postsAtom.ts   lib/post/getPost.ts   hooks/...   │
│ (Store imports types; zero circular dependencies)      │
└────────────────────────────────────────────────────────┘
```

### The Remediation: Centralized Domain Type Declaration (`types/`)
Extract entity interfaces and DTO definitions into pure, framework-free files inside a top-level `types/` (or `models/`) directory:

```diff
# BEFORE: Domain types defined inside reactive store atom
- // atoms/postsAtom.ts
- import { atom } from "jotai";
-
- export interface Post {
-   id: string;
-   communityId: string;
-   title: string;
-   body: string;
-   numberOfComments: number;
-   voteStatus: number;
-   createdAt: Date;
- }
-
- export interface PostVote {
-   id: string;
-   postId: string;
-   communityId: string;
-   voteValue: number;
- }
-
- export const postStateAtom = atom<{ selectedPost: Post | null; posts: Post[]; postVotes: PostVote[] }>({
-   selectedPost: null,
-   posts: [],
-   postVotes: [],
- });

# AFTER: Framework-agnostic type file + consumer store
+ // types/post.ts (Zero dependencies)
+ export interface Post {
+   id: string;
+   communityId: string;
+   title: string;
+   body: string;
+   numberOfComments: number;
+   voteStatus: number;
+   createdAt: Date;
+ }
+
+ export interface PostVote {
+   id: string;
+   postId: string;
+   communityId: string;
+   voteValue: number;
+ }
+
+ // atoms/postsAtom.ts (Imports types, declares only reactive state)
+ import { atom } from "jotai";
+ import type { Post, PostVote } from "@/types/post";
+
+ export interface PostState {
+   selectedPost: Post | null;
+   posts: Post[];
+   postVotes: PostVote[];
+ }
+
+ export const postStateAtom = atom<PostState>({
+   selectedPost: null,
+   posts: [],
+   postVotes: [],
+ });
```

### Architectural Benefits:
1. **Clean Unidirectional Dependency Flow**: `types/` sits at the foundational layer. All other modules (`lib/`, `hooks/`, `components/`, `atoms/`) import from `types/` without ever creating circular cycles.
2. **Universal Reusability**: Entity types can be freely consumed across client components, Server Actions, edge functions, and CLI scripts without pulling in UI state libraries.
3. **Frictionless Mocking**: Unit tests can instantiate mock domain entities without importing atom definitions or store providers.

---

## 7. Centralized Static Asset Registries (`config/assets.ts`)

**Symptom**: Static asset paths (`"/images/liked.png"`, `"/icons/music-placeholder.png"`, `"/logos/brand.svg"`) and hardcoded fallback strings are scattered across dozens of UI components, stylesheets, and test files.

### The Problem:
1. **Silent 404s on File Renaming**: Renaming an image file or restructuring the `/public/` directory leaves outdated paths across the codebase, resulting in broken image icons or runtime null asset errors.
2. **Inconsistent Accessibility**: Different components using the same image provide conflicting or missing `alt` attributes.
3. **Zero Static Type Checking**: String literal paths cannot be type-checked by the compiler, concealing broken assets until manual visual QA catches them.

### The Remediation: Structured Asset Registry Module
Create a centralized asset registry (`config/assets.ts`) declaring typed asset descriptors with frozen paths and canonical accessibility descriptions:

```typescript
// config/assets.ts - Centralized Static Asset Registry
const IMAGES_BASE = "/images";

export const ASSETS = {
  LIKED: {
    path: `${IMAGES_BASE}/liked.png`,
    alt: "Liked Songs",
  },
  PLACEHOLDER_COVER: {
    path: `${IMAGES_BASE}/music-placeholder.png`,
    alt: "Album Cover Placeholder",
  },
  DEFAULT_AVATAR: {
    path: `${IMAGES_BASE}/default-avatar.png`,
    alt: "User Avatar Placeholder",
  },
} as const;

export type Assets = typeof ASSETS;
```

```diff
# BEFORE: Fragile hardcoded image strings across components
- <Image src="/images/liked.png" alt="Liked" width={64} height={64} />
- <Image src="/images/music-placeholder.png" alt="" width={48} height={48} />

# AFTER: Strongly typed, centralized asset references
+ import { ASSETS } from "@/config/assets";
+ <Image src={ASSETS.LIKED.path} alt={ASSETS.LIKED.alt} width={64} height={64} />
+ <Image src={ASSETS.PLACEHOLDER_COVER.path} alt={ASSETS.PLACEHOLDER_COVER.alt} width={48} height={48} />
```

### Architectural Benefits:
1. **Single Point of Maintenance**: Changing an asset name, CDN path, or file extension updates every call site in the application through one line in `config/assets.ts`.
2. **Standardized Accessibility**: Guarantees that canonical `alt` descriptions stay uniform across navigation bars, cards, and player views.
3. **Cross-Platform Equivalents**: Corresponds directly to Android's `R.drawable.*`, iOS's `Assets.xcassets`, and Flutter's `AssetConstants`.

---

## 8. Fine-Grained Domain Result Contracts (`types/<domain>/<action>-result.ts`)

**Symptom**: Server actions, RPC handlers, and domain service procedures return untyped objects, ad-hoc inline types, or raw database rows directly to the UI, leading to brittle type assertions and unpredictable error handling.

### The Problem:
1. **Implicit Error Envelopes**: Some actions return `{ error: string }`, others throw raw errors, and others return `{ ok: false, message: string }`, forcing UI components into messy branching logic.
2. **Leaky Database Types**: Returning raw ORM rows exposes database column names (snake_case, internal IDs, foreign keys) across the client boundary.
3. **Tangled Type Topologies**: Bundling action input and output types in monolithic action files prevents re-exporting clean contracts for unit tests.

### The Remediation: File-Per-Contract Domain Result Types
Colocate fine-grained result interfaces inside `types/<domain>/` modeling explicit discriminated unions or standardized action response envelopes:

```
types/
├── album/
│   ├── album.ts
│   └── create-album-result.ts   # Dedicated result contract
├── artist/
│   ├── artist.ts
│   └── create-artist-result.ts
└── song/
    ├── song.ts
    └── create-song-result.ts
```

```typescript
// types/album/create-album-result.ts
import type { AlbumWithArtists } from "@/types/music/album-with-artists";

export interface CreateAlbumResult {
  ok: boolean;
  album?: AlbumWithArtists;
  error?: string;
}
```

```typescript
// actions/album/create-album.ts
import type { CreateAlbumInput } from "@/schemas/album/create-album.schema";
import type { CreateAlbumResult } from "@/types/album/create-album-result";

export async function createAlbum(input: CreateAlbumInput): Promise<CreateAlbumResult> {
  const parsed = CreateAlbumSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  // execution...
  return { ok: true, album: mappedAlbum };
}
```

### Architectural Benefits:
1. **Isolated Action Contracts**: Action return shapes are defined independently of ORM models and form schemas, allowing the database or form to change without breaking client contracts.
2. **Hermetic Test Assertions**: Test suites import `CreateAlbumResult` directly to type-check mock return values and assertions without importing server action runtimes.

---

## 9. Redundant Framework Route Group Nesting Elimination

**Symptom**: File-system based router trees accumulate purely decorative or redundant directory groupings (e.g. `app/(main)/(routes)/documents/[id]/page.tsx` or `routes/(dashboard)/(views)/analytics.tsx`) that introduce excessive path depth without providing distinct layouts, loading states, error boundaries, or middleware authentication guards.

### The Problem:
1. **Unnecessary Directory Depth**: Developers must traverse redundant nested directories (`app/(main)/(routes)/...`) when locating page components and co-located subcomponents.
2. **Desynchronized Test Paths**: Test suites struggle to maintain clean 1:1 path symmetry with application routes when artificial wrapper directories sit between layout boundaries and pages.
3. **No Boundary Value**: In modern frameworks (Next.js App Router, Remix, Nuxt), route groups enclosed in parentheses `(group)` are intended exclusively to partition layouts, route segment configs, or distinct middleware. Using them as generic organizing folders creates structural noise.

### The Remediation: Flatten Superfluous Route Groups
Audit parent directories for layout, error, and loading templates. If an intermediate route group folder contains zero layout or boundary definitions, hoist its child routes up to the nearest meaningful layout boundary:

```
BEFORE: Superfluous (routes) nesting
app/
├── (main)/
│   ├── layout.tsx
│   └── (routes)/                     # Redundant folder: no layout.tsx or error.tsx
│       ├── documents/
│       │   ├── page.tsx
│       │   └── [documentId]/page.tsx
└── (public)/
    └── (routes)/                     # Redundant folder
        └── preview/[documentId]/page.tsx

AFTER: Flattened, semantic route topology
app/
├── (main)/
│   ├── layout.tsx
│   └── documents/
│       ├── page.tsx
│       └── [documentId]/page.tsx
└── (public)/
    └── preview/[documentId]/page.tsx
```

```diff
# Git move / rename:
- app/(main)/(routes)/documents/[documentId]/page.tsx
+ app/(main)/documents/[documentId]/page.tsx

- __tests__/app/(main)/(routes)/documents/[documentId]/page.test.tsx
+ __tests__/app/(main)/documents/[documentId]/page.test.tsx
```

### Architectural Benefits:
1. **Direct Path Discoverability**: Every directory segment in the route tree maps either to a visual layout boundary or a public URL pathname.
2. **Topological Test Symmetry**: Unit test hierarchies mirror the exact production routing structure without artificial intermediate levels.

---

## 10. Keyed Record/Dictionary Transformation & Redundant Identifier Pruning

**Symptom**: Domain entities (projects, categories, products, certificates, articles) are stored as flat arrays where each item has an internal `slug: string` or `id: string` property. Every detail page, route handler, and relation check executes `items.find(i => i.slug === slug)`.

### The Problem:
1. **Linear Search Overhead**: Looking up an entity by identifier requires an $O(N)$ scan through arrays on every request or page render.
2. **Double Source of Truth**: When entities are stored in both a dictionary and an array, or when a dictionary maps keys to items that also contain their own `slug` field, the key and internal property can drift.
3. **Stringly-Typed Parameters**: Dynamic route segments use loose `string` parameters rather than type-safe enum or branded key sets.

### The Remediation: Keyed Dictionary Records with Branded/Enum Keys
Transform flat entity collections into strongly-typed keyed records (`Record<EntityKeyEnum, EntityInterface>`). Prune the redundant `slug`/`id` property from the entity interface entirely (the map key *is* the canonical identity), and use enum keys for compile-time verified routing:

```typescript
// enums/project/project-keys.ts
export enum ProjectDatabaseKeys {
  ChessEngine = "chess-engine",
  Portfolio = "portfolio",
  WorkflowAutomation = "workflow-automation",
}

// types/project/project.ts - Zero slug property!
export interface Project {
  name: string;
  description: string;
  skills: SkillDatabaseKeys[];
}

// database/projects/project-database-map.ts
export const projectDatabaseMap: Record<ProjectDatabaseKeys, Project> = {
  [ProjectDatabaseKeys.ChessEngine]: {
    name: "Chess Engine",
    description: "High-performance Bitboard chess engine",
    skills: [SkillDatabaseKeys.Rust, SkillDatabaseKeys.WebAssembly],
  },
  // ...
};

// Instant O(1) lookup:
export function getProject(key: ProjectDatabaseKeys): Project | undefined {
  return projectDatabaseMap[key];
}
```

```diff
# BEFORE: Array with redundant slug and linear scanning
- interface Project {
-   slug: string;
-   name: string;
- }
- const projects: Project[] = [{ slug: "chess-engine", name: "Chess Engine" }];
- export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

# AFTER: Keyed record with compile-time enum keys and O(1) lookup
+ export interface Project {
+   name: string;
+ }
+ export const projectDatabaseMap: Record<ProjectDatabaseKeys, Project> = { ... };
+ export const getProject = (key: ProjectDatabaseKeys) => projectDatabaseMap[key];
```

### Architectural Benefits:
1. **Instant $O(1)$ Direct Access**: Eliminates all linear search loops across database maps.
2. **Single Identity Source of Truth**: Prevents key-to-slug drift; an entity's key is declared once.
3. **Compile-Time Route Checking**: Route parameters and route builders (`ROUTES.PROJECTS.detail(ProjectDatabaseKeys.ChessEngine)`) are checked at build time; invalid keys cause type errors before deployment.

**Cross-Language Parallels**:
- **TypeScript**: `Record<KeyEnum, Entity>` with strong key typing.
- **Python**: `dict[EntityKeyEnum, Entity]` using `StrEnum` or `Enum` keys without redundant `.id` fields on model objects.
- **Go**: `map[EntityID]Entity` where `EntityID` is a typed string type (`type ProjectID string`).
- **Rust**: `HashMap<ProjectId, Project>` where `ProjectId` is an enum or newtype.

---

## 11. Decoupling Domain Enums from Interface Contracts

**Symptom**: Domain enums, status flags, and categorical types (e.g. `SkillTypesEnum`, `SkillCategoriesEnum`, `UserRoleEnum`) are declared inside the corresponding interface file (`interfaces/SkillInterface.ts`, `interfaces/User.ts`).

### The Problem:
1. **Circular Import Hazards**: When the static database map (`database/skills/skill-database-map.ts`) imports the interface, and the interface imports the database keys, or filter options need the enum, bidirectional import cycles form (`skill-database-map -> SkillInterface -> skill-database-map`).
2. **Coupling Non-Structural Consumers**: A filter component or URL parser that only needs to validate a category enum value is forced to import the entire multi-field database entity interface, bloating consumer bundles.
3. **Refactoring Fragility**: Changing an optional property on the interface triggers re-compilation and potential lint/type invalidations across unrelated components that only cared about the category enum.

### The Remediation: Topological Enum Separation
Extract domain enums and discriminated union constants to dedicated modules (`enums/<domain>/<name>.ts` or `types/<domain>/<name>.ts`). Both interfaces and operational consumers import the enums independently:

```
BEFORE: Coupled Interface File
interfaces/
└── SkillInterface.ts     # Declares SkillCategoriesEnum, SkillTypesEnum AND SkillInterface

AFTER: Topologically Decoupled Modules
enums/
└── skill/
    ├── skill-categories.ts   # Pure enum / union
    └── skill-types.ts        # Pure enum / union
types/
└── skill/
    └── skill.ts              # Imports from enums/skill/*
```

```diff
# BEFORE: Enum trapped inside entity interface file
- // interfaces/skill.ts
- export enum SkillCategory { Frontend = "frontend", Backend = "backend" }
- export interface Skill {
-   name: string;
-   category: SkillCategory;
- }

# AFTER: Dedicated enum module imported by both interface and filter utilities
+ // enums/skill/skill-category.ts
+ export enum SkillCategory { Frontend = "frontend", Backend = "backend" }
+
+ // types/skill/skill.ts
+ import { SkillCategory } from "@/enums/skill/skill-category";
+ export interface Skill {
+   name: string;
+   category: SkillCategory;
+ }
```

### Architectural Benefits:
1. **Zero Circular Imports**: Enums reside at the foundational leaf layer of the dependency graph; they never import interfaces or database maps.
2. **Focused Bundle Tree-Shaking**: Lightweight filter dropdowns and URL parameter parsers import only the enum constants they evaluate.
3. **Stable Contracts**: Categorical domain values can evolve or be audited independently of storage schemas.

**Cross-Language Parallels**:
- **TypeScript**: Separate `enums/` or `types/domain-enums.ts` from entity interfaces.
- **Python**: Put `Enum` classes in `enums/` or `models/enums.py` separated from SQLAlchemy/Pydantic schemas.
- **Go**: Define constant groups and type definitions (`type Status int`) in a shared package or `constants.go` separate from struct models.
- **Java**: Declare enums in their own dedicated `.java` files rather than nesting them as inner classes inside entity classes.

---

## 12. Subdirectory Documentation Debt Pruning

**Symptom**: The codebase contains micro-`README.md` files scattered across leaf folders (`components/README.md`, `hooks/README.md`, `types/README.md`, `actions/README.md`, `context/README.md`, `docker/README.md`). Most contain 3–15 lines of trivial text summarizing directory contents (e.g. *"This directory contains all React components"*), or worse, list filenames and parameters that drifted out of sync months ago.

### The Problem:
1. **Maintenance Drag & Documentation Rot**: As components and hooks are renamed, moved, or deleted, micro-README files are almost never updated. They become deceptive traps for new developers and LLM agents.
2. **Signal-to-Noise Ratio Degradation**: Finding files via fuzzy search or browsing directories is polluted by dozens of identical `README.md` entries.
3. **False Sense of Documentation**: Teams believe their code is documented because READMEs exist, while the documentation provides zero actionable architecture guidance or system contracts.

### The Remediation: Purge Subdirectory READMEs and Centralize System Guidance
1. **Purge Leaf Directory Micro-READMEs**:
   Delete trivial README files in code folders (`components/README.md`, `hooks/README.md`, `types/README.md`, `actions/README.md`).
2. **Rely on Self-Documenting Code Constructs**:
   Express directory semantics through:
   - Descriptive file and directory names (kebab-case, domain grouping).
   - Strict TypeScript/Pydantic types and interface exports.
   - JSDoc / TSDoc docstrings on complex exported methods explaining *why*, not just *what*.
   - Automated unit test suites (`__tests__/`) that act as executable specifications.
3. **Consolidate Timeless Architecture in Root Documentation**:
   Maintain comprehensive, authoritative guidelines in root instructions (`README.md`, `CLAUDE.md`, `AGENTS.md`) detailing directory layout conventions and architectural boundaries.

```diff
# BEFORE: Fragile, out-of-date micro-READMEs scattered in every leaf directory
- components/README.md (15 lines listing outdated components)
- hooks/README.md (12 lines describing hooks renamed 6 months ago)
- types/README.md (8 lines repeating type names)
- docker/README.md (94 lines of obsolete docker commands)

# AFTER: Clean directory tree with centralized, authoritative root instructions
+ Root README.md: Comprehensive project setup, environment, and architectural overview
+ Root AGENTS.md / CLAUDE.md: Coding standards, conventions, and boundary rules
+ Leaf directories: Pure code, domain types, and co-located/mirrored test suites
```

### Architectural Benefits:
1. **Zero Documentation Drift**: Eliminates dozens of stale files requiring manual maintenance on refactorings.
2. **Clear Search Results**: File search and code navigation tools are free of generic README noise.
3. **Enforced Executable Truth**: Tests and type systems remain the sole authoritative source of truth for component interfaces and behaviors.

### Cross-Stack Architectural Parallels:
- **TypeScript / Next.js**: Delete leaf `README.md` files in `components/`, `hooks/`, `app/`; document in root `README.md` and `AGENTS.md`.
- **Python / FastAPI**: Remove `README.md` from `routers/`, `schemas/`, `models/`; rely on Sphinx / MkDocs or root architecture docs.
- **Go**: Rely on standard Go package comments (`// Package conversation implements...`) on the primary file rather than markdown files inside sub-packages.
- **Java / Spring Boot**: Use Javadoc package-info files (`package-info.java`) or root developer guides rather than markdown files in package folders.

---

## 13. Declarative Gateway and Endpoint Schema Validation Parity

**Symptom**: Server API routes, HTTP controllers, and server actions perform manual, imperative checks (`if (!email || typeof email !== "string") return new Response("Email required", { status: 400 })`, ad-hoc regex tests, or manual field presence checks) scattered across handler bodies, returning non-standardized error strings.

### The Problem:
1. **Contract Drift between Client & Server**: Client-side form libraries and backend API endpoints drift out of sync; fields valid on the frontend fail silently or throw unhandled exceptions on the backend.
2. **Inconsistent Error Envelopes**: Some endpoints return plain text `"Invalid format"`, others return `{ error: "bad_request" }`, and others crash with 500 when missing fields trigger `TypeError: Cannot read properties of undefined`.
3. **Verbose Boilerplate & Missing Edge Cases**: Handlers waste 20–40 lines asserting basic types, character lengths, and regex patterns, often forgetting edge cases (trimming whitespace, Unicode, null vs undefined, array length minimums).

### The Remediation: Centralized Declarative Schemas with Gateway Safe-Parsing
1. **Declare Domain Schemas in `schemas/<domain>/`**:
   Define single-source-of-truth validation schemas using a runtime schema library (e.g. Zod, Pydantic, Ozone, Bean Validation).
2. **Share Schemas between Forms and Endpoints**:
   Feed the schema to frontend form hooks (via resolver) AND backend entry points.
3. **Parse at the Gateway Entry Point**:
   Invoke `.safeParse()` immediately on incoming payloads. Return standardized 400 Bad Request error objects (`fieldErrors`) on failure before invoking domain logic.

```typescript
// schemas/auth/register.schema.ts - Single Source of Truth
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password requires an uppercase letter")
    .regex(/[a-z]/, "Password requires a lowercase letter")
    .regex(/[0-9]/, "Password requires a number")
    .regex(/[^A-Za-z0-9]/, "Password requires a special character"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

```diff
# BEFORE: Imperative manual checks scattered across API route handler
- export async function POST(request: Request) {
-   const body = await request.json();
-   if (!body.name || typeof body.name !== "string") {
-     return new Response("Missing name", { status: 400 });
-   }
-   if (!body.email || !body.email.includes("@")) {
-     return new Response("Invalid email", { status: 400 });
-   }
-   if (!body.password || body.password.length < 8) {
-     return new Response("Password too short", { status: 400 });
-   }
-   // ... business logic
- }

# AFTER: Declarative gateway safeParse with structured field error envelopes
+ export async function POST(request: Request) {
+   const body = await request.json();
+   const validation = registerSchema.safeParse(body);
+   if (!validation.success) {
+     return Response.json(
+       { errors: validation.error.flatten().fieldErrors },
+       { status: 400 }
+     );
+   }
+   const { name, email, password } = validation.data;
+   // ... business logic with guaranteed type safety
+ }
```

### Architectural Benefits:
1. **100% Client-Server Invariant Parity**: The form UI and the API endpoint enforce identical validation rules.
2. **Uniform Error Structure**: Frontend error mappers consume predictable `{ errors: { [field]: string[] } }` contracts.
3. **Zero-Mock Schema Testing**: Schemas can be tested exhaustively with simple, fast unit tests without mocking database clients or network requests.

### Cross-Language Parallels:
- **TypeScript / Next.js / Express**: Share Zod / Valibot schemas between `@hookform/resolvers/zod` and Route Handlers.
- **Python / FastAPI**: Define Pydantic `BaseModel` used for automatic request validation, OpenAPI specs, and frontend client generation.
- **Go / Gin / Echo**: Define struct tags with `go-playground/validator/v10` and translate `validator.ValidationErrors` into standard JSON field errors.
- **Java / Spring Boot**: Annotate request DTOs with Jakarta Bean Validation (`@Valid`, `@NotBlank`, `@Email`, `@Size`) and handle `MethodArgumentNotValidException` globally.

---

## 14. Domain-Model Migration & Typed Contract Parity

**Symptom**: Endpoints, tools, or services pass around raw, unstructured dictionaries (`dict`, `dict[str, Any]`, `list[dict]`, `map[string]interface{}`) or declare return types like `-> str` while returning dictionaries, leading to runtime serialization failures and contract drift.

### The Problem:
1. **Runtime Type Mismatches & Serialization Crashes**: When framework routes (FastAPI, FastMCP, tRPC, NestJS) validate response payloads against declared return annotations, discrepancies (e.g. declaring `-> str` while returning a `dict`) trigger runtime validation crashes.
2. **Primitive Obsession & Key Misspelling**: Without static model declarations, accessing properties via string keys (`row["column_name"]`) invites silent typos that bypass type checkers.
3. **Monolithic Model Dumping Grounds**: Stashing all application types in a single massive `models.py` or `types/index.ts` file leads to merge conflicts and circular imports.

### The Remediation: Domain-Model Package Decomposition & Strict Contract Parity
1. **Decompose into Domain Packages**:
   Split a monolithic model file into a domain-partitioned `models/` directory (`models/analysis.py`, `models/cell_ops.py`, `models/charts.py`), re-exporting active models from `models/__init__.py`.
2. **Replace Opaque Dicts with Typed Schemas**:
   Convert all input parameter lists and return payloads from generic dictionaries to strongly typed Pydantic models or TypedDicts.
3. **Enforce 100% Contract Parity**:
   Ensure route return type annotations match the exact runtime return types.

```diff
# BEFORE: Monolithic models.py, opaque dict parameters, and return type mismatch
- # in monolithic models.py (300 lines mixing all domains)
- # in route handler:
- @mcp.tool()
- def worksheet_structure(action: str, file_path: str, sheet_name: str) -> str:
-     # Declared return is -> str, but implementation returns dict!
-     return {"action": action, "status": "completed"} # Runtime validation error!

# AFTER: Decomposed domain model and guaranteed contract parity
+ # in src/mcp_server/models/worksheet_ops.py
+ class WorksheetActionResult(BaseModel):
+     action: str
+     sheet_name: str
+     status: Literal["completed", "failed"] = "completed"
+     details: dict[str, Any] = Field(default_factory=dict)
+
+ # in route handler:
+ @mcp.tool()
+ def worksheet_structure(action: str, file_path: str, sheet_name: str) -> WorksheetActionResult:
+     return WorksheetActionResult(action=action, sheet_name=sheet_name)
```

### Architectural Benefits:
1. **End-to-End Type Safety**: Compilers and type checkers verify every field access across the entire call chain.
2. **Automatic Self-Documentation**: Pydantic / Zod / OpenAPI models generate live documentation and JSON schemas for API consumers and LLM agents.
3. **Zero Runtime Deserialization Failures**: Handlers return exactly what their signatures declare, preventing runtime schema crashes.

### Cross-Language Parallels:
- **Python / FastAPI / Pydantic**: Decompose `models.py` into `models/` package; replace `dict` with Pydantic `BaseModel`.
- **TypeScript / Zod / tRPC**: Replace `Record<string, any>` with dedicated domain Zod schemas in `schemas/<domain>/`.
- **Go**: Replace `map[string]interface{}` with explicit Go structs in `pkg/model/<domain>`.
- **Java / Spring Boot**: Replace raw `Map<String, Object>` with Java records/DTOs in domain packages.

