# Edge-Case Diagnostic Tripwires

Comprehensive checklist of boundary conditions, concurrency collisions, lifecycle edge cases, and environment subtleties to systematically evaluate during bug diagnosis, reproduction, and plan verification.

Use this checklist during Step 2 & Step 3 of bug fixing to uncover hidden failure paths before writing code.

---

## 1. Concurrency & Temporal Edge Cases

- [ ] **Simultaneous Mutations on Same Entity**: What happens when two requests or workers mutate the exact same record concurrently? Does the second write fail, overwrite silently, or merge predictably?
- [ ] **Check-Then-Act Interleaving**: Does any code path execute `SELECT` or `has()` followed by `INSERT` or `SET` without atomic database constraints (`ON CONFLICT`) or locks?
- [ ] **Parallel Subagent Collisions**: When multiple subagents or background threads write to a shared scratchpad or file path, is file versioning incremented atomically?
- [ ] **Unordered Background Job Resolution**: If job A is dispatched before job B, but job B completes before job A, does job A overwrite newer data with stale data?
- [ ] **Shared Registry Deletion**: When an operation completes, does its cleanup callback verify that the handle being removed is still the active handle, or does it blindly evict newer handles?
- [ ] **Query Cardinality (`.single()` on Zero Rows)**: Does any database query or existence check invoke `.single()` instead of `.maybeSingle()`, causing unhandled exceptions (e.g. PGRST116) when zero records match?
- [ ] **Polymorphic Relation Cardinality**: Does client or action code assume joined relational data is strictly a single object without checking whether the ORM/query builder returns an array (`Array.isArray(rel) ? rel[0] : rel`)?
- [ ] **Bulk Query Parameter Partitioning**: When executing datastore `IN` or batch lookups with dynamic ID arrays, is the input partitioned into driver-safe batch chunks (e.g. max 10/30 for document stores, parameter limits in SQL) to prevent fatal driver parameter overflow exceptions?
- [ ] **Unawaited Asynchronous Recursion & Floating Cascades**: Does any recursive database or filesystem mutation (e.g. archiving descendants, cascading deletions, folder removal) invoke child calls or top-level recursive chains without `await`, causing handlers to return prematurely before child operations finish or transactions close?

---

## 2. Lifecycle & Navigation Edge Cases

- [ ] **Entity Deletion In-Flight**: What occurs if a user or system deletes an entity (e.g. chat, project, document) while an asynchronous background job or AI stream is actively generating for that entity?
- [ ] **Navigation Away & Rejoining**: If a user navigates away from a page during an active stream and returns 5 seconds later, does the UI reconnect to the in-flight operation, trigger a duplicate run, or show a broken/stuck state?
- [ ] **Client Disconnection / Page Reload**: If the browser tab is closed or reloaded mid-execution, are server connections and external resources aborted cleanly, or do they leak indefinitely?
- [ ] **Premature Hydration State**: Is an empty collection (`items.length === 0`) evaluated before hydration/initialization completes, causing a flash of "No items" or false-positive error alerts?
- [ ] **Mount-Time Concurrent Collection Hydration**: When a layout or listing component fetches summaries on mount, does it non-destructively merge records rather than wiping detailed child entity state loaded concurrently?
- [ ] **Sign-Out State Purge**: Does user sign-out wipe all reactive client stores, in-memory caches, and local storage keys, or can a subsequent user access remnants of previous session state?
- [ ] **Dynamic Revalidation in Administrative Views**: Does a mutating administrative dashboard or status page omit dynamic rendering directives (`export const dynamic = "force-dynamic"`), serving stale cached data to users?
- [ ] **Just-In-Time (JIT) Identity Provisioning**: Does an authenticated action assume a user record exists in the custom application database without lazy provisioning, failing when webhook/trigger execution is delayed?
- [ ] **Inverse Auth Route Redirection**: Are authenticated sessions prevented from loading guest-only authentication pages (sign-in, sign-up, password reset) and redirected immediately to the canonical application landing route?
- [ ] **Asynchronous Auth Tri-State Invariants**: Does any route guard or view check `!user` or `!hasPermission` before verifying that asynchronous authentication and membership resolution have settled (`isLoading`), preventing flashes of unauthorized UI or false redirect bounces?
- [ ] **Dynamic Route Tri-State Resolution**: Does data fetching for dynamic parameters distinguish `undefined` (pending load) from `null` (entity verified absent) to immediately render 404 views rather than hanging on infinite loading spinners?
- [ ] **Dynamic Route-Level 404 Boundaries**: Does each dynamic parameterized entity route define a route-level `not-found.tsx` component with contextual user guidance, rather than falling back to an uninformative generic root 404 page when `notFound()` is invoked?
- [ ] **Stale Shared State Across Parameterized Route Transitions**: When navigating between distinct entities sharing a parameterized route (e.g. `/community/[id]`), is shared reactive state (Jotai, Redux, Zustand, Context) reset on route parameter changes or unmount, preventing previous entity icons, titles, or cached records from contaminating the new page?
- [ ] **Redundant Inherited Route Boundaries**: Does any nested subroute duplicate boilerplate `loading.tsx` or `error.tsx` files that are already cleanly handled by ancestor route boundaries, introducing redundant maintenance weight and UI styling divergence?
- [ ] **Layout Authentication Scope Containment**: Are components performing authenticated backend queries (search palettes, user-specific listings, notifications) encapsulated strictly within protected route group layouts (`(main)/layout.tsx`), preventing unauthenticated visitors on landing/public pages from tripping backend authentication exceptions?
- [ ] **Unmatched Protected Route Coverage**: Are all newly added private route trees and parameterized paths explicitly registered in middleware route matchers or gateway rules (`matcher: ["/users/:path*", "/conversations/:path*"]`), ensuring unauthenticated access or sign-outs reliably redirect users to login rather than stranding them on private views?
- [ ] **Auth Adapter Schema Contract Parity**: Does the database schema and entity mapping provide all fields and models required by the active authentication library adapter (e.g. `idToken`, `password`, `Verification` table), and are unserviced requirements (such as email verification when no SMTP provider exists) pruned to prevent user onboarding deadlocks?

---

## 3. Boundary & Interface Contracts

- [ ] **Composite Identifier Parity**: Do caller and callee format composite IDs with the exact same structure (e.g. UUID vs display name vs slug)?
- [ ] **External Tool Name Characters**: Do external tool or plugin names contain characters (dots, dashes, slashes, spaces) that are illegal in downstream AI SDKs or execution engines?
- [ ] **Object Spread Precedence**: When combining default/system configurations with user/external configurations, do system security guards spread last so they cannot be shadowed or hijacked?
- [ ] **Schema Union Tolerances**: When passing structured schemas to external models or clients, does the schema use strict single-type objects externally while tolerating stringified JSON or wrapped objects at runtime?
- [ ] **Tool-Call / Tool-Result Parity**: Does every tool invocation in message history have a matching tool-result entry, even when the tool execution failed, timed out, or was aborted?
- [ ] **Hook Handler Callback Identity**: Are dispatchers, mutators, and error handlers exported from custom hooks wrapped in `useCallback` to avoid invalidating consumer effect dependency arrays?
- [ ] **Reactive Hook Dependency Reference Stability**: Are fallback arrays and objects (`data?.items || []`) memoized or declared as constants outside render paths so they do not break reference equality in `useEffect` dependency arrays?
- [ ] **Storage Scheme Bridging**: Does any component pass an HTTP URL (e.g. presigned S3 URL) into a tool or library that expects a local filesystem path, without providing an explicit download/ingestion bridge?
- [ ] **Empty String vs Undefined in Environment Parsing**: Does any configuration schema fail in CI/CD when optional variables are passed as empty strings `""` instead of being normalized to `undefined`?
- [ ] **Eager Environment Module Evaluation in Builds**: Does importing the environment module during tests or static builds crash the process if dummy credentials or `SKIP_ENV_VALIDATION` bypasses are not provided?
- [ ] **SyntheticEvent Callback Parameter Bleed**: When an action taking an optional parameter is passed directly to a UI event handler (`onClick={fn}`), can a SyntheticEvent or DOM event leak into the optional argument and poison downstream URLs or logic?
- [ ] **Canonical Origin Normalization in Redirects**: Do OAuth callback redirects and email verification links resolve through a centralized `getSiteUrl()` utility that enforces protocols, strips trailing slashes, and correctly resolves preview vs production hostnames?
- [ ] **Closed-Enum Error Code Fallbacks**: When mapping external API or SDK errors to localized messages via dictionaries, is there an explicit fallback to `error.message` or a generic default string when `error.code` is missing, unmapped, or an HTTP network failure?
- [ ] **Server Action Directives & Result Envelopes**: Do all server-side mutation action files explicitly declare `"use server";` and return typed Result envelopes (`{ ok: boolean, error?: string }`) rather than bare booleans or unhandled throws?
- [ ] **Symmetrical File Validation Limits**: Are file size thresholds and MIME type limits centralized in an authoritative configuration (`FILE_LIMITS`) shared identically between client-side file picker schemas and server action guards, preventing rejection mismatches?
- [ ] **Pre-Submit Input & File Schema Validation Gates**: Does the client upload form or interactive input validate files and fields against shared schemas immediately on file selection (`onChange`), clearing invalid file selections (`e.target.value = ''`) and alerting the user before form submission?
- [ ] **Proactive Storage Quota Metering & Soft Limit Feedback**: Does the storage or file management interface check quota capacity and expose real-time usage meters to users prior to uploads, rejecting over-capacity actions gracefully rather than failing silently with unhandled database/storage exceptions?
- [ ] **Isomorphic Decoupling of Client & Server Environment Variables**: Are public client variables (`NEXT_PUBLIC_*`) decoupled from server-only secrets into distinct schemas, ensuring client components only import client-safe schemas and server secrets are accessed lazily (via Proxies or getters) to prevent SSR/static build crashes?
- [ ] **Dynamic API Route Prerendering Constraints**: Do API route handlers that instantiate SDK clients using runtime secrets declare `export const dynamic = "force-dynamic"` and employ lazy handler instantiation (`getHandler()`), preventing build-time static generation crashes?
- [ ] **Schema Nullability vs Optionality on Database Ingestion**: Are optional schema fields that may receive `null` from database columns or form resets typed as `.nullable().optional()` rather than bare `.optional()`, preventing runtime rejection when `null` is supplied?
- [ ] **Defensive Caught Exception Property Access**: Do catch blocks access error details using runtime type narrowing and optional chaining (`error.issues?.[0]?.message ?? error.message`) rather than assuming hardcoded property structures (such as `error.errors[0]`), preventing secondary `TypeError` crashes in error handlers?
- [ ] **Strict Public Client URL Resolution (No Unsafe Localhost Fallback)**: Does client-side auth or SDK initialization avoid hardcoding `http://localhost:3000` fallbacks that silently redirect production or preview traffic to the end-user's local machine when environment variables are omitted?
- [ ] **Lazy Browser-Only SDK Instantiation**: Are browser-only SDK clients (Pusher, socket clients, WebRTC) wrapped in lazy singleton getters or Proxies that guard against execution when `typeof window === "undefined"`, preventing Node.js deprecation warnings and SSR hydration crashes?

---

## 4. Multi-Store Integrity & Error Paths

- [ ] **Partial Multi-Store Failure**: When an action writes to both a database and cloud storage (or search index), what happens if the second store rejects the write? Is there compensating rollback for the first write?
- [ ] **Deletion Cascade Ordering**: When deleting an entity that has associated files in cloud storage, are the storage keys queried *before* the database cascade deletes the metadata rows?
- [ ] **Pipeline Mutation Persistence Assertion**: If a pipeline step executes mutations, does the framework verify that the resulting modified artifact was persisted before marking the step as successful?
- [ ] **Unbounded Output Payloads**: Can worker delegations or tool executions return unbounded transcripts or files into conversation memory, exhausting the token context window?
- [ ] **Step Budget Synthesis Drop**: In a multi-step execution loop, if the maximum step count is exhausted immediately following a tool call, is there a terminal synthesis step to guarantee a non-empty user response?
- [ ] **Error Message Redaction**: Are raw internal database errors or API keys stripped before returning error payloads to client surfaces?
- [ ] **Multi-Tier Payload Limit Parity**: If backend actions or endpoints accept large file uploads (e.g. 50MB), do edge middleware, reverse proxies, and framework limits match that threshold?
- [ ] **Direct Binary FormData vs Base64 Bloat**: Are binary file uploads transmitted via native multipart `FormData` rather than base64 Data URLs embedded in JSON payloads?
- [ ] **Folder-Scoped Blob Cleanup**: When deleting entities with multiple associated files, does cleanup list and remove the entire storage folder rather than relying on brittle URL regex parsing?
- [ ] **Object URL Resource Leaks**: Are browser object URLs (`URL.createObjectURL`) revoked via `URL.revokeObjectURL()` upon unmount or file selection changes?
- [ ] **Generic Trigger Column Uniformity**: Do database triggers or ORM hooks (e.g. `set_updated_at`) verify target column existence before execution, preventing mutation aborts on junction tables that lack audit columns?
- [ ] **Denormalized Replica Synchronization**: When updating or renaming an entity, are all denormalized replicas, membership snippets, and projection caches updated in an atomic batch or transactional fan-out?
- [ ] **Distributed Cascading Deletion & Referential Integrity**: When deleting parent entities in document/NoSQL stores lacking relational foreign key cascading, are dependent sub-collections (saved items, bookmarks, votes, replies) and blob storage assets cleaned up in atomic batches, and do consumer queries guard against missing parent references?
- [ ] **Cross-Service Database Triggers on Storage**: Does any database trigger attempt direct SQL deletion against external cloud storage tables (`storage.objects`), causing transaction rollbacks due to permission boundaries, rather than orchestrating blob cleanup in application services?

---

## 5. Network & Security Edge Cases

- [ ] **SSRF IPv6 Normalisation**: Does IP validation handle IPv4-mapped IPv6 hex serialisations (`[::ffff:7f00:1]`) and explicitly block unspecified addresses (`::` and `0.0.0.0`)?
- [ ] **HTTP Redirect Gaps**: Do webhook or MCP client HTTP requests follow redirects to private/internal IP addresses (`redirect: "error"`)?
- [ ] **Container Host-Gateway Resolution**: Do background queues or webhook callbacks running in container environments resolve host callbacks via a configurable origin (`SERVE_ORIGIN`) rather than hardcoding `host.docker.internal` or loopback?
- [ ] **MIME Type Magic Byte Sniffing**: Does file upload validation verify file magic bytes rather than trusting client-supplied `Content-Type` headers?
- [ ] **Rate Limit Headers**: Do 429 rate limit responses include explicit `Retry-After` headers and normalise upstream provider rate limit payloads into user-friendly messages?
- [ ] **Privilege Self-Demotion & Account Self-Lockout**: Does the management interface or action handler prevent an administrator from revoking their own admin role or deleting their own account?
- [ ] **Creator Immutability & Last-Admin Tenancy Lockout**: In role-based access management, is the original creator/root owner protected from removal or demotion by appointed delegate admins, and is the last remaining administrator prohibited from removing themselves (preventing unadministrated orphan tenancies)?
- [ ] **Destructive Action Confirmation & Ownership Guards**: Are irreversible mutations (deleting posts, comments, communities, or removing members) verified for user ownership/authorization on both client and server, and gated by explicit confirmation dialogs?
- [ ] **Entity Ownership Attribution on Shared Metadata**: Do user-submitted catalog metadata models (artists, albums, categories, tags) include creator/uploader foreign keys (`uploader_id` referencing `auth.users`), enabling ownership-based RLS and preventing universal mutation vulnerabilities?
- [ ] **Cross-Origin Trusted Origins in Auth Gateways**: Does the authentication gateway or API server configure dynamic trusted origins from environment variables (`trustedOrigins`), allowing staging environments, preview URLs, and cross-domain clients to authenticate without 403 Forbidden errors?

---

## 6. Frontend & Responsive Layout Edge Cases

- [ ] **Invisible Layout Overlay Traps**: Does any responsive container retain `fixed` or `absolute` positioning and high `z-index` on mobile when its children are hidden, swallowing pointer events?
- [ ] **Mobile Viewport Navigation Occlusion**: Does the scrollable page container include responsive bottom padding (`pb-20 md:pb-0`) to prevent fixed bottom navigation bars from occluding buttons and footers?
- [ ] **User Media Aspect Distortion vs Clipping**: Does the UI use `object-contain` with styled backgrounds for arbitrary user-submitted imagery rather than `object-cover` that crops out critical details?
- [ ] **Image Dimension Constraints in Responsive Layouts**: Do framework-optimized image components in flex or grid layouts declare explicit width/height dimensions or relative container fill boundaries to prevent 0x0 rendering collapse?
- [ ] **Transient Container Modal Trapping**: Are modal dialogs and overlays declared at stable layout/page roots rather than inside transient dropdown menus, popovers, or collapsible items where parent closing unmounts the dialog or traps scroll and focus?
- [ ] **Modal DOM Portal Omission & Stacking Context Clamping**: Are modals, dialogs, and floating menus mounted via a DOM Portal to the document root rather than inside ancestor containers with CSS `overflow: hidden`, `transform`, `filter`, or `perspective` that clamp stacking contexts?
- [ ] **Arbitrary Z-Index Escalation**: Does the UI adhere to a centralized design token z-index scale rather than arbitrary hardcoded numbers (`z-index: 999`) that cause layering collisions and layer inversion?
- [ ] **Unbounded Text Sibling Layout Ejection**: In horizontal flexbox containers containing dynamic user strings beside buttons, is `min-width: 0` paired with truncation, or does the layout stack vertically on mobile viewports to prevent buttons from overflowing card boundaries?
- [ ] **Unvirtualized Infinite Scroll vs Deterministic Pagination**: Does infinite scroll implementation avoid unvirtualized DOM node accumulation and observer race conditions that cause mobile memory bloat and scroll jump glitches, preferring deterministic manual pagination ("Load More") unless full virtual scrolling is in place?
- [ ] **Recursive Tree Depth Exhaustion**: For hierarchical threaded structures (comments, category trees), does the schema enforce an explicit maximum depth (`depth <= MAX_DEPTH`) and flatten UI presentation to prevent indentation squishing and recursive render crashes?
- [ ] **Nested Form & Button Submit Disambiguation**: Do action buttons inside nested cards or multi-action components specify explicit `type="button"` with isolated click handlers (`e.stopPropagation()`), preventing unintentional parent form submissions or swallowed events?
- [ ] **Third-Party Event Callback Stale Closures**: Do mount-time event listeners or third-party constructor callbacks (e.g. `use-sound` `onend`/`onplay`, WebSocket listeners) access state imperatively via store accessors (`useStore.getState()`) and access asynchronously loaded handles via mutable refs (`soundRef.current`), preventing frozen closure snapshots and silent no-ops?
- [ ] **Dynamic Media Fallback Degradation**: Does image rendering conditionally render an inline accessible SVG/icon component fallback when dynamic media URLs are null/empty, rather than passing static fallback path strings into framework image optimizers that fail on missing or unoptimized assets?
- [ ] **Mobile Touch Target Proximity**: Are secondary interactive links or buttons adjacent to primary card tap targets adequately spaced with minimum 44x44px touch targets on mobile viewports, or decoupled into mobile drawers/desktop-only links to prevent fat-finger mispress collisions?
- [ ] **Touch Gesture Interference & Injected Drag Handles**: Does any component rely on custom `onTouchStart`/`setTimeout` long-press timers that clash with mobile scrolling, instead of visible action buttons? Are drag handles injected into structural slots (`rightAction`) with `e.stopPropagation()` rather than overlaid absolutely on clickable cards?
- [ ] **Root DOM Hierarchy & SSR Hydration Invariant**: Are context providers and layout wrappers strictly placed *inside* `<body>` (`<html><body><Providers>{children}</Providers></body></html>`), preventing fatal React SSR hydration mismatch crashes caused by illegal DOM nesting between `<html>` and `<body>`?
- [ ] **Collapsible Container Box-Model Padding Collapse**: When toggling containers to zero dimensions (`w-0` or `h-0`), are padding and borders simultaneously collapsed (`p-0 border-0`) to prevent CSS box-model leakage of visible colored strips and pointer occlusion on mobile viewports?
- [ ] **Zero-State Primary Action Affordance**: Does every empty collection representation ("No items found") provide an explicit primary action affordance ("Create Item", "Add a page") directly in the view to prevent user onboarding deadlocks?
- [ ] **Theme Surface Contrast in Transient States**: Do loading skeletons and placeholders use contrast-guaranteed alpha-blended tokens (e.g. `bg-primary/5`) rather than raw surface tokens (`bg-muted`) that match container backgrounds in certain theme modes, preventing invisible skeletons?
- [ ] **Client-Only Browser API Hydration Gating**: Does any client component access browser globals (`window.location.origin`, `localStorage`, `document`) or client-only modals during initial render, rather than gating behind an `isMounted` state or returning deterministic neutral fallbacks to prevent SSR hydration mismatches?
- [ ] **Filter State Source vs Subset Invariant (The Filter Collapse Paradox)**: Is the visibility of filter controls, toggles (e.g. "Show Archived"), or facet panels derived from the raw source collection (`source.some(predicate)`) rather than the active filtered array, preventing filter controls from vanishing once activated?
- [ ] **Compound Component DOM Hierarchy & Wrapper Neutrality**: In filtered/virtualized lists (cmdk, Radix Combobox), are list items direct children of list containers without intermediate `<button>` or `<div>` wrapper nodes that break item-filtering calculations or leave large empty vertical gaps? Are search filter predicates evaluated against user-visible entry names rather than internal slugs?
- [ ] **Disabled Polymorphic Navigation Traps (`asChild` Link Trap)**: Does any button or interactive element rendering as an `<a>` or `<Link>` guard against clicks when `disabled` by intercepting `onClick` (`e.preventDefault()`), assigning `aria-disabled="true"`, setting `tabIndex={-1}`, and applying `pointer-events-none`?
- [ ] **Hitbox & Event Delegation Alignment**: Are outer styled containers and inner navigation links aligned so that clicking button padding triggers navigation and links do not extend hitboxes into whitespace outside visible buttons?
- [ ] **Shared Transient State Reset on View/Tab Transitions**: In multi-tab or multi-view components (e.g. switching between Image and Video views), are carousel APIs, active slide indices, and item counters explicitly reset in tab-change handlers or isolated via distinct component mounting?
- [ ] **Touch Screen Sticky Hover State**: Are CSS hover effects and utility classes restricted to pointer-capable devices via `@media (hover: hover) and (pointer: fine)`, preventing buttons and interactive chips from sticking in a persistent hovered/scaled state upon tapping on touch screens?
- [ ] **Dynamic Diagram / Vector Graphic Dark Mode Contrast Collision**: Do client-side vector diagram visualizers (Mermaid.js, SVG charts) dynamically synchronize their internal color palettes with theme mode changes, preventing unreadable black text on dark surfaces in dark mode?
- [ ] **Mobile Drawer Drag-To-Dismiss Nested Scroll Conflict**: Do touch-dismissible mobile drawers or sheets avoid nesting virtualized combobox/select popovers that clash with vertical swipe gestures, utilizing native selects or accordion flows that preserve smooth scrolling on mobile?
- [ ] **Orthogonal Filter Facet Clobbering on Partial Update**: When updating a single filter parameter (keyword search, category selection), does the state updater merge parameters functionally rather than overwriting the entire filter object, preserving independent toggles like "Show Archived" and active sort order?
- [ ] **Nested Scroll Container SPA Route Restoration**: Does client-side route navigation reset scroll position to `(0, 0)` for nested layout scroll containers (`overflow-y-auto`), preventing subsequent views from remaining stuck at the previous page's scroll offset?
- [ ] **Unbounded Data Table Mobile Viewport Clipping**: Are data tables wrapped in responsive horizontal scroll containers (`overflow-x-auto w-full`) to prevent fixed-width columns from truncating or breaking viewport bounds on mobile devices?
- [ ] **Priority Filter Empty-State Fallback Deficit**: When filtering collections by a priority tag (`isMainSkill: true`), does the view provide a fallback to show top/all items if zero items match the priority flag, preventing awkward empty gaps?
- [ ] **Naive Date Difference & Ongoing Temporal Boundary Off-by-One**: Do duration and tenure calculations count whole months inclusively across calendar boundaries and dynamically resolve open ongoing intervals (`endDate ?? new Date()`), preventing 0-month or negative tenure calculations?
- [ ] **Form Reset Validation Suppression**: When clearing or resetting form fields after successful submission in reactive form libraries, is `{ shouldValidate: true }` avoided to prevent the newly cleared field from immediately triggering validation errors (e.g. "Field is required")?
- [ ] **Relative API Endpoint Resolution Across Route Segments**: Are client-side HTTP calls strictly formatted with a leading root slash (`/api/...`) or imported from a typed route registry, preventing relative URLs (`api/...`) from resolving against nested path segments (e.g. `/conversations/[id]/api/...`) and returning 404s?

---

## 7. Toolchain & Environment Edge Cases

- [ ] **Toolchain & Runtime Engine Drift**: Are test runner dependencies (e.g. Vitest), package manager engines (`engines.node`), and Docker configurations explicitly aligned between local development and CI/CD pipelines to prevent clean pipeline failures caused by missing devDependencies or incompatible engine versions?
- [ ] **Test Runner Environment & Mock Path Synchronization**: Does test runner configuration supply required environment variables in `test.env` to prevent eager schema validation modules from aborting test suites on startup? When files are renamed or restructured, are all string-based test mocks (`vi.mock(...)`) systematically updated to match new paths?
- [ ] **Test Mock Hoisting TDZ & Factory Isolation**: Are mock variables referenced inside `vi.mock()` / `jest.mock()` factories initialized with hoisting utilities (`vi.hoisted()`) to avoid Temporal Dead Zone initialization exceptions?
- [ ] **TypeScript Production Build Exclusion of Test Configs**: Does production `tsconfig.json` explicitly exclude test runner configuration files (`"exclude": ["node_modules", "vitest.config.ts"]`) to prevent compiler failures on test runner globals during CI/CD builds?
- [ ] **Asynchronous Route Segment Parameters**: In modern frameworks (Next.js 15+ / React 19), are dynamic route parameters (`params`, `searchParams`) unwrapped using `await` in Server Components or `React.use()` in Client Components before property access?
- [ ] **Static Prerender Parameter Generation Parity**: Do dynamic parameterized routes (`[id]`, `[key]`) export static parameter generators (`generateStaticParams`, `getStaticPaths`) so that production static builds and SSG exports pre-render all valid entities without triggering deployment 404s?
- [ ] **Canonical Root-Relative Asset & Link Path Resolution**: Are asset paths, images, and API endpoints constructed with leading root slashes (`/projects/cover.png`) rather than relative slices (`projects/cover.png`) that resolve incorrectly on deep nested subroutes?
- [ ] **Markdown Preprocessor Code Span Shielding**: Do regex-based text transformers or syntax normalizers shield both fenced code blocks (` ``` `) AND inline code spans (`` `...` ``) before running replacements, preventing accidental corruption of code samples?
- [ ] **Static Data Map Relational Symmetry & Key Invariants**: Are bidirectional relationships and entity keys in static data maps protected by automated referential integrity tests that assert bidirectional symmetry and non-orphan keys across all maps?
- [ ] **Toolchain Inclusion/Exclusion Negation Syntax**: Do linter, formatter, and compiler configurations use correct glob negation syntax (e.g. `!__tests__` rather than bare `__tests__` in inclusion arrays) to avoid unintended linting of test fixtures and specs?
- [ ] **Compiler Flag & Deployment Runner Compatibility**: Do package manifests and compiler configurations avoid uncertified bleeding-edge flags (e.g. `experimental.useTypeScriptCli`) or major compiler pre-releases that break production build runners (Vercel, AWS Amplify, Docker)?
- [ ] **CI/CD Workflow Action Secret Injection Parity**: Are newly introduced environment variables and database/auth service credentials added symmetrically to CI/CD workflow action job steps (`.github/workflows/*.yml`), preventing false CI build or test crashes on PR merges?
- [ ] **Blocker Dependency Peer Deadlock & Pruning**: When core framework upgrades fail due to strict peer dependency conflicts on a single package, has the blocking dependency been audited to determine if it is an under-utilized or dead feature that can be pruned rather than holding the architecture hostage?
- [ ] **Package Manager Lifecycle Hooks for Code Generation Engines**: Does `package.json` include an automated `postinstall` script (e.g. `"postinstall": "prisma generate"`) to ensure fresh CI runners, Docker containers, and cloud deployment environments generate required ORM/type artifacts automatically?
- [ ] **Test Environment Process Isolation & Server Context Mocking**: Are process-level environment mutations in test files isolated using runner sandbox utilities (`vi.stubEnv`), and are server-only request context helpers (`next/headers` `headers()`, `cookies()`) mocked for server action tests?

---

## 8. Dispatcher, Facade & Consolidation Tripwires

- [ ] **Dispatcher Sub-Action Parameter Starvation**: When dispatching to underlying functions, are all optional parameters (e.g. `count`, `data`, `sort_direction`, `filter_type`) forwarded with explicit fallbacks rather than passed as `None` or omitted?
- [ ] **Facade Argument Order & Positional Inversion**: Are positional arguments passed in the correct order to target service helpers (e.g. verifying `(source, target)` vs `(target, source)`, `(row, col)` vs `(col, row)`)?
- [ ] **Payload Key Alias Normalization**: Does the dispatcher normalize alternative payload keys (e.g. `range` vs `cell_range`, `values` vs `data`, `sheet` vs `sheet_name`) at entrypoint before branching?
- [ ] **Public Return Type Schema Discrimination**: Does every action branch of a coarse dispatcher return a typed response matching the declared discriminated union or schema model, avoiding unstructured `dict`, raw strings, or boolean flags?
- [ ] **Deep-Branch Module & Symbol Imports**: Are all standard library and external modules required across any execution branch imported at module top-level (e.g. verifying `math`, `re`, `statistics` are imported even if only used on rare financial/regex branches)?
- [ ] **Operator & Syntax Invariant Flexibility**: Does the query/filter parser tolerate common operator equivalents (`==` and `=`, `!=` and `<>`) and case-insensitive keyword tokens (`AND`, `and`, `EQ`, `eq`) without throwing syntax errors?

---

## 9. Foreign Library & Data Transformation Tripwires

- [ ] **Single-Element Dimension Collapse (Polymorphic Return Shape)**: When indexing cells, rows, or arrays via third-party libraries (e.g. openpyxl, pandas, numpy), does the code defensively handle single-cell or 1D returns by wrapping them into consistent 2D matrices before indexing?
- [ ] **Empty Sheet & Zero-Row Boundary Indexing**: Does code querying sheets or collections check for emptiness before accessing index 0 (`sheet[0]` or `df.iloc[0]`), preventing `IndexError` on zero-row structures?
- [ ] **Destructive Setter Side-Effects on Null/Empty Properties**: Does clearing or updating properties (chart titles, cell fonts, XML wrappers) avoid assigning `None` or `""` where underlying library setters destructively delete child trees or corrupt XML serialization?
- [ ] **In-Place Mutation Sibling Sheet/Member Preservation**: When modifying a file or archive in-place, is the entire composite container loaded and saved so that unreferenced sibling sheets, archive entries, or formulas are not destroyed?
- [ ] **Atomic File Write Staging**: Are disk writes staged to a temporary file in the same directory before atomic replacement (`os.replace`), preventing zero-byte truncation on mid-write crashes?
- [ ] **Qualified Reference Coordinate Parsing**: When parsing ranges with sheet names (e.g. `'Sheet 1'!A1:B10`), is the sheet qualifier stripped and resolved before parsing coordinate bounds?
- [ ] **Join Key Symmetry & Overlapping Column Disambiguation**: In multi-file or multi-table joins, are asymmetric join keys (`left_on != right_on`) validated and duplicate column names disambiguated before merging?
- [ ] **Locale-Invariant Canonical Date & Number Parsing**: Are standard ISO 8601 strings and numbers parsed without guessing heuristics (`dayfirst=True`, ambiguous comma decimals) that corrupt canonical formats?

---

## 10. Sandboxing, Protocol & Error Propagation Tripwires

- [ ] **Transitive Library Attribute Sandbox Leakage**: Does code-execution or formula AST validation recursively block transitive file/network I/O attributes on imported objects (e.g. `to_csv`, `read_pickle`, `load`, `save`, `savefig`, `open`) beyond basic builtins (`os`, `sys`, `open`)?
- [ ] **Protocol Diagnostic Error Preservation**: Do API, RPC, and MCP protocol boundaries preserve specific domain validation exception messages and field context rather than masking them behind generic `"Internal error"` envelopes?
- [ ] **Output Artifact Persistence Verification**: When an operation accepts an output destination (`output_file`), is file existence and content verified before returning a success envelope?
- [ ] **Transactional Multi-Stage Rollback**: If a multi-stage mutation fails mid-pipeline, are partial in-memory or on-disk modifications rolled back cleanly without dirty state?
- [ ] **Protocol Revision Negotiation Rejection**: Does an RPC, MCP, or protocol server handler reject established protocol revisions (e.g. `2024-11-05` traffic rejected by strict modern `2026-07-28` handlers with HTTP 400 Bad Request) instead of providing backward-compatible stateless fallback (`legacy: "stateless"`)?
- [ ] **RFC 8414 Section 3 Discovery Path Insertion & Base URL Trailing Slashes**: For OAuth 2.1 / authorization servers with URL path components (`/api/auth`), are both RFC 8414 Section 3 path-inserted endpoints (`/.well-known/oauth-authorization-server/api/auth`) and root discovery paths (`/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`) supported? Are base URLs sanitized to prevent trailing slash double-slashes (`//api/mcp`) in `WWW-Authenticate` and `resource_metadata` headers?
- [ ] **Symmetrical HTTP Verb Protection on Protocol Endpoints**: Do protected protocol or RPC endpoints guard both `GET` and `POST` methods (e.g. with `requireAuth`), preventing unauthenticated information leakage or 404/405 rejections when clients send `GET` authorization probes before opening `POST` sessions?



