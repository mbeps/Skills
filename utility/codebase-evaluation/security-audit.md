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
- *Diagnostic Target*: Any mutation without database-level atomic operations (`UPDATE tbl SET balance = balance - 10 WHERE balance >= 10 RETURNING balance`) or pessimistic/optimistic row locking.

### 2. Authorization Architecture & Gateway Bypasses
- **Scattered Access Checks**: Authorization logic implemented ad-hoc via inline `if (user.role === 'admin')` statements scattered across controllers rather than enforced systematically via centralised middleware, gateway boundary guards, or ABAC/RBAC policies.
- **Route Authorization Bleed**: Defining security rules in client-side navigation registries without authoritative server-side endpoint enforcement.

### 3. Client-Server Environment Bleed & Secret Exposure
- Hardcoded secrets, API keys, or private certificates in source files or version control.
- Monolithic environment variable definitions where private server credentials (e.g. `STRIPE_SECRET_KEY`, `DATABASE_URL`) share namespaces with or get prefixed with public client flags (e.g. `NEXT_PUBLIC_*`, `VITE_*`), causing secret leakage into compiled client bundles.

### 4. Input Validation & Injection Hazards
- SQL / NoSQL Injection: Concatenating unvalidated user input into database queries.
- Command Injection: Passing untrusted arguments to shell execution processes.
- Cross-Site Scripting (XSS): Rendering unsanitized HTML/markdown without DOMPurify or equivalent safeguards.

### 5. Unbounded Datastore Queries & Quota Crashes (DoS Risks)
- Querying datastores with unbounded arrays in `IN` clauses that exceed database parameter limits (e.g. SQLite 999 limit, Postgres 65,535 limit), crashing production processes.
- Endpoints fetching all records without cursor or offset pagination, vulnerable to memory exhaustion DoS.

### 6. Distributed Deletion Leaks
- Relational cascades that delete user or entity database records without triggering a corresponding cleanup of private uploaded documents, avatars, or media in cloud storage buckets, leaving unmanaged, potentially sensitive orphaned files.

### 7. Dependency & Supply Chain Security
- Cross-referencing installed packages and lockfiles against CVE databases (NVD, GitHub Security Advisory Database).
- Auditing for abandoned or typosquatted packages.

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
