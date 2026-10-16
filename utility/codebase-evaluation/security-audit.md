# Security Audit Module

Identifies code-level vulnerabilities, architectural security flaws, concurrency hazards, secret leakages, and dependency exploits. Cross-references findings with vulnerability databases and security standards.

For complete smell mappings and diagnostic criteria, see [Code Smells Matrix](references/code-smells-matrix.md).

## When to Use

Use this module when you need to:
- Identify code-level security vulnerabilities (injection, auth bypass, secret leaks)
- Detect concurrency security vulnerabilities (Read-Modify-Write races, TOCTOU)
- Audit authorization architectures for scattered access checks and gateway bypasses
- Detect client-server environment leaks (private keys exposed in client bundles)
- Identify unbounded datastore queries susceptible to Denial-of-Service (DoS) and quota crashes
- Scan dependencies for known CVEs and malicious packages
- Assess exposure to OWASP Top 10 vulnerabilities

## Key Analysis Areas

### 1. Concurrency Security & Race Conditions (TOCTOU)
- **Read-Modify-Write Races**: Reading a quota, balance, or reservation from the database, evaluating it in application memory, and writing back the result non-atomically. Allows attackers to execute concurrent requests that double-spend credits, bypass inventory locks, or exceed storage quotas.
- **Check-Then-Act Upsert Races**: Checking existence via `SELECT` before `INSERT`, allowing concurrent requests to trigger constraint collisions or corrupt version sequences.
- *Diagnostic Target*: Any mutation without database-level atomic operations (`UPDATE tbl SET balance = balance - 10 WHERE balance >= 10 RETURNING balance`, `INSERT ... ON CONFLICT DO UPDATE`), row locking, or per-entity concurrency queues.

### 2. Authorization Architecture & Gateway Bypasses
- **Scattered Access Checks**: Authorization logic implemented ad-hoc via inline `if (user.role === 'admin')` statements scattered across controllers rather than enforced systematically via centralised middleware, gateway boundary guards, or ABAC/RBAC policies.
- **Route Authorization Bleed**: Defining security rules in client-side navigation registries without authoritative server-side endpoint enforcement.

### 3. Client-Server Environment Bleed & Secret Exposure
- Hardcoded secrets, API keys, or private certificates in source files or version control.
- Monolithic environment variable definitions where private server credentials (e.g. `STRIPE_SECRET_KEY`, `DATABASE_URL`) share namespaces with or get prefixed with public client flags (e.g. `NEXT_PUBLIC_*`, `VITE_*`), causing secret leakage into compiled client bundles.

### 4. Input Validation, SSRF & Injection Hazards
- SQL / NoSQL Injection: Concatenating unvalidated user input into database queries.
- Command Injection: Passing untrusted arguments to shell execution processes.
- Cross-Site Scripting (XSS): Rendering unsanitized HTML/markdown without DOMPurify or equivalent safeguards.
- **SSRF Canonical IP Bypasses**: URL validators relying on naive IP regex failing to decode IPv4-mapped IPv6 hex representations (`[::ffff:7f00:1]`), failing to block unspecified addresses (`::`, `0.0.0.0`), or following HTTP redirects to unvalidated destinations (`redirect: "follow"`).

### 5. Unbounded Datastore Queries & Quota Crashes (DoS Risks)
- Querying datastores with unbounded arrays in `IN` clauses that exceed database parameter limits (e.g. SQLite 999 limit, Postgres 65,535 limit), crashing production processes.
- Endpoints fetching all records without cursor or offset pagination, vulnerable to memory exhaustion DoS.

### 6. Distributed Deletion Leaks
- Relational cascades that delete user or entity database records without triggering a corresponding cleanup of private uploaded documents, avatars, or media in cloud storage buckets, leaving unmanaged, potentially sensitive orphaned files.

### 7. Cross-Session State Bleed & Multi-Tenant Cache Contamination
- Client-side reactive stores (Zustand, Redux) or browser session storage retaining previous user data across sign-out or account switching.
- Process-level or server-side in-memory caches lacking user/tenant partition keys, allowing in-flight queries or cached results to leak across tenant boundaries.

### 8. Untrusted Spread Precedence & Tool / Handler Shadowing
- Merging untrusted/external plugins or tool catalogs after internal primitives via object spread (`{ ...systemTools, ...untrustedTools }`), enabling external entities to shadow and hijack core security capabilities.

### 9. Dependency & Supply Chain Security
- Cross-referencing installed packages and lockfiles against CVE databases (NVD, GitHub Security Advisory Database).
- Auditing for abandoned or typosquatted packages.

### 10. Creator Immutability, Privilege Self-Demotion & Last-Admin Lockout
- Role management endpoints or UI workflows that treat all administrators symmetrically, allowing delegate administrators to remove or demote the original entity creator/root owner.
- Administrative procedures allowing the sole remaining administrator to remove themselves or delete their account, causing tenant-level administrative lockout and leaving entities permanently unadministrated.
- *Diagnostic Target*: Auditing role mutation, member removal, and user deletion endpoints/views for missing creator immutability constraints (`targetUser.id === entity.creatorId`) and missing sole-admin boundary guards (`admins.length <= 1`).

### 11. Inverse Route Protection & Session Clobbering (Guest Route Bypasses)
- Public authentication endpoints (sign-in, registration, password reset) accessible to already authenticated user sessions without automated redirection to the application root or dashboard. Allows session token clobbering, stale token overwrite, or browser redirect loops.
- *Diagnostic Target*: Auditing route middleware, gateway guards, and auth page controllers for missing session presence checks that bounce authenticated users to default landing routes.

### 12. Unconfirmed Destructive Action & Ownership Verification Deficit
- Destructive mutations (deleting resources, expelling community members, revoking privileges) executing immediately on button clicks without two-step confirmation dialogs, or exposing destructive buttons to non-authorized/non-owner users without server-side validation.
- *Diagnostic Target*: Auditing deletion and removal handlers for missing actor verification (`item.creatorId === authUser.id`) and missing confirmation modal contracts.

### 13. Shared Metadata Ownership Attribution Deficit
- Resource or metadata entities (artists, tags, categories, shared templates) created without explicit creator/uploader ownership attribution (`user_id` / `uploader_id`).
- When tables omit owner attribution, database policies (e.g. Supabase/Postgres RLS) cannot discriminate between the creator and arbitrary authenticated users, allowing unauthorized cross-tenant modifications or deletions, or forcing system administrators into manual access triage.
- *Diagnostic Target*: Auditing schema tables and creation migrations for shared metadata entities lacking foreign key references to the authenticated user table, and ensuring RLS update/delete policies enforce creator checks.

### 14. Layout Auth Scope Boundary Mismatch (Authenticated Queries in Public Root Layouts)
- Mounting components that execute authenticated backend queries (e.g. search bars, private document trees, user notification listeners) inside global root layouts (`app/layout.tsx`) that wrap unauthenticated routes (landing pages, marketing, login).
- When unauthenticated visitors hit public pages, the root layout mounts the authenticated component, triggering unauthenticated query exceptions from the backend, exposing backend endpoints and auth configuration, or leaking error traces to client consoles.
- *Diagnostic Target*: Auditing global root layouts for authenticated backend queries that must be encapsulated strictly within authenticated route group layouts (e.g. `(main)/layout.tsx`).

### 15. Unmatched Protected Route Omission in Auth Gateways
- Route protection middleware or API gateway matchers relying on explicit path lists (e.g. `matcher: ["/users/:path*"]`). When new private pages or subroutes are introduced (e.g. `/conversations/:path*`, `/settings/:path*`), omitting them from the protection matcher leaves them accessible without authentication or prevents sign-outs from redirecting to the login gate.
- *Diagnostic Target*: Auditing route definitions against gateway matcher arrays to ensure all non-public routes are protected by default or registered explicitly.

### 16. Cross-Origin Trusted Origins Deficit in Auth Gateways
- Authentication servers or API gateways omitting dynamic `trustedOrigins` configuration. When deployed across staging environments, preview deployments, or cross-domain clients, authentication requests fail with HTTP 403 Forbidden or CORS origin rejections.
- *Diagnostic Target*: Auditing auth server initialization (e.g. Better Auth, NextAuth) for environment-driven `trustedOrigins` parsing (`env.TRUSTED_ORIGINS?.split(",")`).

### 17. Hardcoded Localhost Hostname Fallback in Client Configurations
- Initializing client-side auth clients, API bases, or SDKs with fallback defaults like `process.env.APP_URL || "http://localhost:3000"`. If the environment variable is omitted or un-inlined in production or staging, client requests, OAuth redirects, and session calls are routed to the end-user's local device.
- *Diagnostic Target*: Auditing client-side API and auth clients for hardcoded localhost strings, enforcing strict environment schema validation or relative origin inheritance.

### 18. Secondary-Library Sandbox & Transitive I/O Escapes
- AST expression checkers and code-execution sandboxes blocking only primitive builtins and modules (e.g. `open`, `os`, `sys`, `subprocess`, `fs`, `eval`), while exposing rich third-party libraries (Pandas, NumPy, Pillow, Matplotlib, SciPy, Torch).
- Foreign libraries expose 30+ transitive attributes capable of executing arbitrary filesystem I/O, network requests, or process spawning (e.g. `to_csv`, `read_pickle`, `load`, `save`, `savefig`, `open`).
- *Diagnostic Target*: Auditing syntax tree visitors, safe evaluators, and formula sandboxes to ensure they implement deep, recursive attribute inspection that blocks all transitive I/O methods on pre-imported library objects.

### 19. Protocol Diagnostic Error Masking & Exception Stripping
- API, RPC, or MCP server protocol boundaries that catch domain validation exceptions (`ValidationError`, `CellCoordinateInvalid`, `NotFound`) and swallow them into generic, uninformative protocol errors (e.g. HTTP 500, MCP `INTERNAL_ERROR`, or `"An internal error occurred"`).
- Blinds client applications, automated callers, and AI agents to the actionable cause of failure, preventing autonomous recovery, self-healing loops, or human troubleshooting.
- *Diagnostic Target*: Auditing protocol error handlers and middleware to ensure domain validation exceptions preserve specific field names, invalid parameters, and actionable diagnostic messages across boundaries.

### 20. Partial State Mutation & In-Place Write Corruption
- File-mutating or state-transforming operations writing directly in-place without loading composite parent containers (destroying unreferenced sibling entities/sheets) or writing without atomic temporary file staging (`tempfile` + `replace`).
- When network, process, or serialization errors occur mid-stream, files are left truncated to zero bytes or in an irreparably dirty, half-mutated state.
- *Diagnostic Target*: Auditing storage writers, document editors, and file managers for atomic write staging (`os.replace` / atomic rename) and comprehensive multi-sheet/archive container preservation.

---

## Quality Principles

- **Zero Assumed Safety** – Verify that every input crossing trust boundaries is validated with a strict schema (e.g. Zod, Pydantic).
- **Authoritative Server Security** – Never accept client assertions of roles, permissions, or user IDs without server-side verification.
- **CVE Cross-Referencing** – Back all dependency vulnerability claims with official CVE identifiers and advisory URLs.

---

## What This Module Does NOT Do

- Does not perform live penetration testing, port scanning, or active fuzzing
- Does not modify or patch vulnerable code
- Does not execute untrusted binaries
- Does not evaluate third-party cloud infrastructure (AWS/GCP/Azure console settings)

---

## Report Structure

Each finding includes:

- **Vulnerability Title** – Clear description of the security defect
- **Severity Level** – Critical / High / Medium / Low / Disputed
- **Location** – File path, line numbers, and architectural component
- **Attack Vector & Impact** – How the flaw can be exploited and the resulting damage (data breach, privilege escalation, DoS)
- **Concrete Evidence** – Code snippet, CVE link, or proof-of-concept trace
- **Consensus Status** – Fully agreed upon or disputed

---

## Example Findings

**Example 1: Read-Modify-Write Concurrency Race (Quota Bypass)**
- **Severity**: Critical
- **Location**: `src/services/StorageService.ts`, lines 42–58 (`checkAndDeductQuota`)
- **Attack Vector & Impact**: Method executes `SELECT quota_used FROM accounts`, adds `upload_size` in Node.js memory, and issues `UPDATE accounts SET quota_used = ...`. Two concurrent uploads issued simultaneously will both read the same initial `quota_used`, allowing users to bypass paid storage quotas.
- **Concrete Evidence**: Lacks atomic SQL expression (`UPDATE accounts SET quota_used = quota_used + $1 WHERE quota_used + $1 <= quota_limit`) or transaction isolation.
- **Consensus Status**: Fully agreed upon

**Example 2: Client-Server Environment Bleed**
- **Severity**: Critical
- **Location**: `src/config/env.ts`, line 14
- **Attack Vector & Impact**: Variable `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` exposes the administrative service role key in client browser bundles, granting any web user full administrative bypass of Row Level Security (RLS).
- **Concrete Evidence**: Line 14: `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY`; client prefix embeds secret into frontend JavaScript chunks.
- **Consensus Status**: Fully agreed upon

---

## Example Invocation

```
Run a security audit on [PROJECT_PATH].
Audit:
- Read-Modify-Write concurrency races and TOCTOU vulnerabilities
- Scattered authorization checks and gateway bypasses
- Client-server environment bleed and secret exposures
- Unbounded datastore queries and DoS vectors
- Dependency CVEs and known exploits

Provide specific locations, severity classifications, and attack vector analyses.
```
