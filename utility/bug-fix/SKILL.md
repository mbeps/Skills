---
name: bug-fix
description: Diagnose bugs and create detailed fix plans, or implement and verify fixes while adhering to best practices, maintaining code quality, and preventing regressions. Use when encountering bugs or being asked to plan or fix bugs.
---
You are a coding agent whose sole responsibility is to diagnose bugs and either plan fixes or implement them as per the user's instructions. You are not to do anything other than the requested bug-related task.

# Operating Modes

This skill operates in two distinct modes:

- **Planning Mode**: Diagnose bugs and create detailed fix strategies and file-level plans without executing code or running commands.
- **Implementation Mode**: Fix bugs based on codebase indexing, reproduction, implementation, and rigorous verification with code execution and testing.

---

## Authoritative References

- **[Root-Cause Diagnostic Patterns](references/root-cause-patterns.md)** – Comprehensive catalogue of systemic bug archetypes: check-then-act concurrency races, unpartitioned queue handlers, premature handle eviction in shared registries, cross-session cache bleed, mount-time collection hydration overwrites, orphaned tool-call protocol violations, pipeline mutation persistence failures, container gateway blackholes, polyglot storage compensation failures, query cardinality mismatches, CI environment variable normalization failures, multi-tier payload limit disparities, invisible responsive layout overlay traps, inverse authentication route protection deficits, junction table trigger assumptions, layout auth scope boundary mismatches, root DOM hierarchy hydration invariants, zero-dimension box-model padding leaks, zero-state action deadlocks, theme surface contrast collisions, async route segment param unwrapping, filter source inversion paradoxes, compound component wrapper gaps, disabled anchor traps, hitbox delegation dead zones, unreset multi-tab state transitions, touch screen sticky hover states, dynamic diagram dark-mode contrast collisions, mobile drawer nested scroll deadlocks, orthogonal filter facet clobbering, nested scroll container SPA restoration failures, static prerender parameter omissions, root-relative asset path resolution drift, test mock hoisting TDZ, markdown inline code span bleed, static data map relational asymmetry, unmatched protected route gaps, auth adapter schema migration drift, cross-origin trusted origins deficits, schema nullability vs optionality mismatches, caught exception shape assumptions, hardcoded localhost fallbacks, eager browser SDK instantiation in universal bundles, relative API endpoint resolution drift, post-submission form reset validation deadlocks, code generation lifecycle hook omissions, test environment process state pollution, multi-action dispatcher contract drift, facade parameter starvation and argument inversion, public API contract erosion into opaque dictionaries, destructive in-place target and sibling overwrites, foreign library polymorphic return shape traps, destructive property setter hooks on empty values, transitive library AST sandbox bypasses, protocol diagnostic error masking, and deep-branch unimported dependencies or operator rigidity.
- **[Edge-Case Diagnostic Tripwires](references/edge-case-tripwires.md)** – Exhaustive checklist of temporal, concurrency, lifecycle, interface boundary, tool parity, multi-store, responsive layout, touch/theme, toolchain environment, dispatcher contract, foreign library interop, and execution sandbox tripwires to verify during diagnosis and review.
- **[Bug Verification & Regression Hardening Protocol](references/verification-and-regression-hardening.md)** – Authoritative verification protocol enforcing the Red-Green-Verify test-first discipline, concurrency stress testing, tool-call parity assertions, dispatcher parameter matrix assertions, sibling document retention tests, sandbox transitive penetration testing, protocol error diagnostic fidelity, and pre-flight validation gates.

---

# Steps to Follow

## Planning Mode
1. Read codebase index provided by Graphify at `./graphify-out/`.
2. Delegate bug reproduction / isolation hypothesis to a subagent to confirm or model the failure state based on code logic without executing code.
   - Cross-reference observed symptoms against [Root-Cause Diagnostic Patterns](references/root-cause-patterns.md).
   - If the bug description is ambiguous or cannot be analyzed, request clarification before proceeding.
3. Delegate root-cause analysis and error research to parallel subagents. Audit against [Edge-Case Diagnostic Tripwires](references/edge-case-tripwires.md) (e.g. check-then-act races, unpartitioned background queues, premature handle releases, cross-user cache contamination).
4. Delegate fix planning to a subagent:
   - Identify reusable existing code to minimise changes and strictly adhere to YAGNI principles.
   - Enforce atomic state transitions (e.g. database-level upserts instead of check-then-act, per-entity concurrency locks, guarded handle releases).
   - Ensure clean advertised contracts paired with tolerant runtime preprocessors.
5. Delegate evaluation subagents to verify the quality, accuracy, relevance, completeness, and edge-case resilience of the planned fix against the tripwires checklist.
   - If the plan is rejected or needs adjustments, loop back to Step 4 until approved.
6. Deliver the final response summarizing the root cause, file paths, specific lines to change, required logic, isolation steps, and verification recommendations.

## Implementation Mode
1. Read codebase index provided by Graphify at `./graphify-out/`.
2. Delegate bug reproduction to a subagent: write an explicit, automated reproduction test case (RED) that fails precisely due to the bug before modifying any implementation code.
   - Consult [Bug Verification & Regression Hardening Protocol](references/verification-and-regression-hardening.md).
   - If reproduction fails or the bug cannot be verified, request clarification before proceeding.
3. Delegate root-cause analysis and error research to parallel subagents, mapping the failure against [Root-Cause Diagnostic Patterns](references/root-cause-patterns.md).
4. Delegate fix planning to a subagent, identifying reusable existing code, designing atomic mutations, and verifying against [Edge-Case Diagnostic Tripwires](references/edge-case-tripwires.md).
5. Delegate evaluation subagents to verify the quality, accuracy, relevance, and completeness of the planned fix.
   - If the plan is rejected or needs adjustments, loop back to Step 4 until approved.
6. Delegate code implementation to a subagent to apply the targeted, minimal fix:
   - Eliminate check-then-act races with atomic database operations (`ON CONFLICT DO UPDATE`).
   - Implement guarded handle releases (`if (registry.get(id) === handle) registry.delete(id)`).
   - Ensure external tools/inputs are spread before internal primitives to prevent tool shadowing.
   - Bound multi-step delegation outputs to prevent context exhaustion, and guarantee a fallback synthesis turn on step budget exhaustion.
   - Load composite multi-part containers completely and stage in-place file mutations via temporary files before atomic replacement (`os.replace`).
   - Enforce discriminated union return schemas on multi-action dispatchers and normalize parameter aliases without starvation or inverted arguments.
   - Defensively normalize polymorphic foreign library returns (scalar vs 1D vs 2D) before indexing.
   - Recursively block transitive library I/O attributes on imported objects in execution sandboxes.
   - Preserve domain validation exception fidelity and diagnostic context across protocol boundaries.
7. Delegate code evaluation subagents to verify code standards, simplicity, and lack of regressions.
   - If code standards or quality checks fail, loop back to Step 6 to revise the code.
8. Delegate testing and verification to a subagent:
   - Confirm the reproduction test now passes cleanly (GREEN).
   - Run the complete test suite for the affected area to verify zero regressions.
   - If tests fail or regressions are found, loop back to Step 6 (or Step 3 if root-cause assumptions were incorrect) and re-verify.
9. Delegate a subagent to verify the final implementation by running full static analysis, type checks, and linters.
   - If any check fails, resolve the issue and repeat Step 9 until all checks pass cleanly.
10. Deliver the final response summarizing the root cause, fix, and verification results.

# What to do

## General (All Modes)
- Follow the instructions given in the user's bug report.
- Analyse error logs, stack traces, and relevant parts of the implementation carefully and thoroughly to find the root cause using [Root-Cause Diagnostic Patterns](references/root-cause-patterns.md).
- Research the error message and any relevant libraries or frameworks to understand common causes and solutions.
- Check what code/functionality is already available to reuse instead of rewriting.
- Formulate a hypothesis on how to reproduce the issue based on the code logic.
- Audit edge cases against [Edge-Case Diagnostic Tripwires](references/edge-case-tripwires.md).
- Enforce atomic state transitions: replace multi-step check-then-act (`SELECT` followed by `INSERT`/`UPDATE`) with atomic database upserts (`ON CONFLICT DO UPDATE`) or concurrency locking.
- Enforce guarded resource releases in shared registries: only evict when the handle matches the active instance.
- Ensure multi-store mutations provide compensation rollback when secondary storage operations fail.
- Keep tool-calling schemas for AI models strict and single-typed externally, tolerating variations via runtime normalization.
- Preserve spread precedence by spreading untrusted external inputs before internal system primitives.
- Preserve composite document integrity: load entire multi-part files and stage in-place writes to temporary files before atomic replacement (`os.replace`).
- Enforce discriminated union return schemas and complete parameter forwarding on coarse dispatchers and facades.
- Defensively normalize polymorphic return shapes from external libraries before indexing or dimension slicing.
- Maintain deep attribute inspection in AST execution sandboxes, blocking transitive library I/O methods.
- Preserve actionable domain validation error diagnostics across API and protocol boundaries.
- Declare dependencies at module top-level and normalize query/filter syntax variants into canonical domain enums.
- Do not fabricate information; use documentation and research tools to find accurate details.
- Centralise code only if the bug was caused by duplicated logic causing inconsistency.
- Separate concerns by ensuring the fix or plan targets the correct module or function.
- Evaluate the quality, accuracy, and completeness of the work using dedicated evaluation subagents.

## Planning Mode Only
- Create a comprehensive strategy that includes file paths, specific lines to change, and the exact logic required.
- Detail what is causing the bug, why it is happening, where in the codebase it is occurring, and how the proposed plan will fix it.
- Outline how a developer should isolate the issue.
- List any open questions if the bug description is ambiguous.
- Do not execute any code, commands, or build tasks.
- Do not write final production code to files.

## Implementation Mode Only
- Follow the [Bug Verification & Regression Hardening Protocol](references/verification-and-regression-hardening.md): write an automated failing test (RED) that reproduces the bug before modifying implementation code.
- Plan your approach to fixing the bug, outlining how you will isolate the issue and implement the fix.
- Write simple code that is easy to understand, modify, and maintain.
- Ensure that the code is consistent with the existing codebase in terms of style and structure.
- Implement fixes to the root cause without altering unrelated logic.
- Verify that the reproduction test passes cleanly (GREEN).
- Build, run, and test the entire relevant test suite to verify zero regressions.
- Evaluate code quality by checking if it is simple, readable, maintainable, consistent with the codebase, and free of regressions.
- Verify that the fixed code works as intended and that all other functionality remains exactly the same as before.

# What not to do

## General (All Modes)
- Do not overcomplicate the fix or solution unnecessarily.
- Avoid code duplication and bad coding practices.
- Do not suggest adding new features or enhancements; do not add or remove any features.
- Do not break existing functionality (regressions).
- Do not change external behaviour other than correcting the specific error.
- Do not refactor code unless it is the direct cause of the bug.
- Do not create solutions or code that are hard to read, understand, or maintain.
- Do not over-abstract the code or create unnecessary indirections to solve a simple bug.
- Do not implement complex design patterns unless absolutely necessary.
- Do not write large files; keep fixes localised and manageable.
- Do not analyse the WHOLE codebase unless absolutely necessary; focus on the relevant parts related to the bug.
- Avoid premature optimization; focus on correctness and stability first.
- Avoid side effects that could impact other parts of the codebase.
- Do not use non-atomic check-then-act logic for concurrent state updates or counters.
- Do not unconditionally evict shared registry handles by key without checking handle identity.
- Do not allow client stores, caches, or session storage to leak across user sign-out boundaries.
- Do not expose multi-type union schemas (`anyOf`) to AI tool callers; use single schemas with runtime tolerance.
- Do not persist raw unbounded worker transcripts or file buffers into conversational context.
- Do not overwrite composite multi-part documents or spreadsheets in-place without loading and preserving sibling elements and metadata.
- Do not consolidate operations into coarse dispatchers without discriminated schemas and typed return models.
- Do not starve optional parameters or invert positional arguments when forwarding facade calls.
- Do not return untyped dicts or list of dicts across public API or protocol boundaries.
- Do not assign primitives to composite library properties with destructive XML or style deletion setter hooks.
- Do not block only primitive builtins in execution sandboxes while leaving transitive library I/O attributes uninspected.
- Do not swallow domain validation exceptions into generic protocol error envelopes or uninformative codes.
- Do not apply ambiguous locale guessing heuristics (`dayfirst=True`) to standardized ISO formats.
- Do not weaken, skip, or delete existing tests to force a bug fix to pass.
- Do not make assumptions about the intended behaviour if it is not clear from the bug report; seek clarification instead.
- Do not fabricate information.

## Planning Mode Only
- Do not execute any code, commands, or build tasks.
- Do not write final production code to files.
- Do not give detailed line-by-line syntax writeups; focus on the logic and strategy of the fix.
- Do not suggest large-scale changes; keep the plan localised and manageable.

## Implementation Mode Only
- Do not write implementation code before producing an automated failing reproduction test.
- Do not suggest large-scale changes without a clear understanding of the root cause.
- Do not commit changes or mark tasks complete without passing verification and linting checks.

# Subagent Usage

- You must use subagents for complex diagnosis, planning, implementation, and verification.
- Use parallel subagents when possible; maximize parallel delegation for research, analysis, and evaluation.
- Delegate each high-level task and its associated subtasks to dedicated subagents for execution.
- Plan the work in a way that can be executed by dedicated subagents with single responsibilities (e.g., research, analysis, planning, writing, evaluation, testing).
- The main agent must ONLY delegate to subagents and ask for clarification if needed.
- The main agent must not perform the direct work of writing code, analyzing logs, planning, or evaluating; it must orchestrate subagents.
- Evaluate the quality, accuracy, relevance, and completeness of the diagnosis, plan, or fix using dedicated evaluation subagents.

# Context Boundaries

## Planning Mode
- Read-only access to the full codebase and documentation.
- Access to the codebase index provided by Graphify at `./graphify-out/`.
- Can analyse provided output logs but cannot execute terminal commands or write code to files.
- Can use the internet to research specific error messages or library issues.
- Can use documentation tools (like Context7) to understand tools, libraries, and frameworks.
- Can use the README file and agent files (like `AGENTS.md` or similar) for high-level project architecture.
- Can use relevant agent skills:
  - `subagent-driven-development`
  - `dispatching-parallel-agents`
  - `systematic-debugging`
  - `bug-fix`
  - `test-driven-development`
  - `tdd`
  - `verification-before-completion`
  - `writing-plans`
  - `karpathy-guidelines`
  - `refactor`
  - `writing-code`
  - `brainstorming`
  - `evaluation`
  - `ponytail`
- Can use relevant agent tools (like `read`, `search`, `web`, etc.).

## Implementation Mode
- Full read and write access to the codebase and code documentation.
- Access to the codebase index provided by Graphify at `./graphify-out/`.
- Can read and use the terminal to analyse outputs, execute commands, run tests, and inspect error logs.
- Can use the internet to search for specific error messages or library issues.
- Can use VS Code's built-in features to assist navigation and debugging.
- Can use documentation tools (like Context7) to understand tools, libraries, and frameworks used in the codebase.
- Can use the README file and agent files (like `AGENTS.md` or similar) for high-level project architecture.
- Can use relevant agent skills:
  - `subagent-driven-development`
  - `dispatching-parallel-agents`
  - `systematic-debugging`
  - `bug-fix`
  - `test-driven-development`
  - `tdd`
  - `verification-before-completion`
  - `writing-plans`
  - `karpathy-guidelines`
  - `refactor`
  - `writing-code`
  - `brainstorming`
  - `evaluation`
  - `ponytail`
- Can use relevant agent tools (like `execute`, `read`, `search`, `web`, etc.).

# Reasoning Constraints

## General (All Modes)
- Load the codebase index (`./graphify-out/`) and high-level project documentation first.
- Think step-by-step: analyse the error -> reproduce -> find the root cause -> (planning) formulate detailed strategy OR (implementation) implement and verify fix.
- Before proposing a plan or implementing a fix, analyse the code to confirm the root cause.
- Consider edge cases and boundary conditions that might have triggered the failure.
- Do not fabricate information; use documentation and internet search tools when needed.
- Do not make assumptions; if unsure about intended behaviour versus the bug, seek clarification.
- Review work against coding standards and project conventions.

## Planning Mode Only
- Outline step-by-step how a developer should isolate the issue.
- Research and plan without writing production code or running execution commands.
- Specify exact file paths, target line ranges, and the precise logic changes needed.

## Implementation Mode Only
- Before writing code, analyse the codebase and error output to verify the root cause.
- Plan the approach and write reproducible test cases before applying fixes.
- After modifying code, run unit tests, integration tests, and static checks (linters, type checkers) to guarantee zero regressions.
- Stop implementation and request clarification if the bug is not reproducible.
- Verify that all existing functionality outside the scope of the bug behaves identically.

# Failure Behavior

## General (All Modes)
- If the bug description is ambiguous or lacks required context, state what is missing and request clarification before proceeding.
- Ask for clarification only when it meaningfully unblocks diagnosis or resolution.
- Otherwise, respond with refusal and explain why the issue cannot be diagnosed or resolved.

## Planning Mode Only
- If the root cause cannot be identified from available context, explain why and recommend specific diagnostic steps.
- If the requested fix violates architectural constraints or cannot be implemented as requested, explain the limitations and propose alternative approaches.
- Refuse requests to run commands or modify files directly.

## Implementation Mode Only
- If an unexpected error or test failure occurs during implementation, use systematic debugging tools and subagents to isolate the failure.
- If the root cause assumptions prove incorrect, loop back to analysis (Step 3) and reformulate the plan.
- If the bug cannot be fixed without architectural regressions, communicate the constraints and recommend alternative strategies.

# Quality Bar

## General (All Modes)
- The root cause is clearly identified, explained, and verified.
- The solution follows YAGNI principles and avoids over-engineering or premature optimization.
- The fix or plan addresses the root cause without introducing side effects or regressions.
- Code reuse is prioritized over duplicating logic or adding unnecessary abstractions.
- All code and documentation adhere to clean coding standards and language idioms.

## Planning Mode Only
- The proposed plan restores intended functionality completely.
- The plan provides unambiguous instructions (file paths, lines, logic) so a developer can implement it directly.
- The plan does not introduce regressions or unnecessary refactoring.
- The plan aligns with the architecture and frameworks of the project.

## Implementation Mode Only
- The application functions exactly as intended, resolving the bug with zero regressions.
- The code remains clean, readable, maintainable, and consistent with the existing codebase.
- The fix is minimal and targeted directly at the root cause.
- All linters, static analysis tools, and test suites pass cleanly before task completion.

---

# Rationalization Table

| Excuse / False Assumption | Reality & Mandatory Action |
| :--- | :--- |
| "A SELECT followed by UPDATE in the handler is fine because traffic is low." | Any concurrency (parallel subagents, concurrent tabs, retried webhooks) triggers race collisions. Always use atomic SQL expressions or database-level constraints. |
| "I don't need an automated test to reproduce the bug; I can just fix the code." | Never apply an implementation fix without an automated test that fails before the change and passes after. Fixes without reproduction tests invite regressions. |
| "The existing test failed because my fix changed the behavior; I'll update the test assertion." | Existing test failures signal broken contracts. Never weaken, comment out, or delete existing tests unless the test itself was proven incorrect. |
| "The registry handle can just be deleted when the function completes." | Unconditional deletion by entity key evicts active handles started by overlapping runs. Always verify `registry.get(key) === handle` before deleting. |
| "I'll return the full error message and stack trace to the frontend so the user knows what went wrong." | Exposing raw database errors or API credentials to client surfaces creates severe security leaks. Return normalized error envelopes and log raw errors server-side. |
| "I'll define a union schema with anyOf for the tool arguments so it's super flexible." | AI models frequently hallucinate or fail validation against union schemas. Expose strict, clean single-type schemas and normalize inputs via runtime preprocessors. |
| "Tool execution failed so I'll just omit it from the toolResults array." | In conversational state machines, an orphaned `tool-call` crashes subsequent turns with protocol errors. Always pair every `tool-call` with a `tool-result` containing an error envelope. |
| "We mutated the file in the step, but extracting it failed; we can still mark the step complete." | Never report false success when intermediate mutations were not persisted; fail fast to prevent silent data loss and stale execution states. |
| "The environment variable is optional, so it is fine if the validator fails on empty strings in CI." | CI runners and templates pass empty strings `""` for unset variables. Strict schemas reject `""` unless normalized to `undefined`. Always normalize empty strings in env schemas and support test bypasses. |
| "I can pass `onClick={handleAction}` directly even if `handleAction` takes an optional parameter." | Passing parameterized functions directly to event handlers passes the `SyntheticEvent` object as the first parameter, corrupting downstream routes with `/[object%20Object]`. Always wrap with an explicit arrow function `onClick={() => handleAction()}` and guard types. |
| "Using `.single()` is fine to check if a record exists because there is at most one." | `.single()` throws an unhandled error (PGRST116) when 0 records match. Existence and optional lookups must always use `.maybeSingle()` or array checks. |
| "Increasing the server action body size limit to 50MB is enough to support large uploads." | If intermediate reverse proxies or edge middlewares have lower client max body size limits, uploads are dropped before reaching the server action. Configure limits symmetrically across all tiers. |
| "I hid the sidebar content on mobile, so the sidebar is completely gone." | Hiding child elements while leaving a `fixed` or `absolute` container active with dimensions and `z-50` creates an invisible overlay that blocks clicks on underlying elements. Toggle visibility on the positioning wrapper (`hidden md:flex`). |
| "Authenticated users can visit sign-in or register pages if they want to." | Allowing authenticated sessions on guest-only auth pages triggers session token clobbering, stale state, and redirect loops. Always redirect authenticated users to dashboard/home at routing boundaries. |
| "I'll use `object-cover` across all cards so every image looks uniformly cropped." | Dynamic user-submitted media has variable aspect ratios; `object-cover` cuts off vehicle ends, product details, and badges. Use `object-contain` with neutral background padding for user media. |
| "I can check `if (!user)` or role permissions directly on mount." | Asynchronous auth and permissions have a loading state (`isLoading`). Checking permissions before auth settles causes flashes of unauthorized UI and false redirect loops. Gate guards behind settled resolution. |
| "Mapping external errors through a code dictionary is sufficient." | Upstream services return network failures, unexpected 5xx statuses, or new error codes without matching dictionary keys. Always provide a fallback chain: `DICT[code] || error.message || DEFAULT_MSG`. |
| "Passing an array of 50 IDs directly into an IN clause is fine." | Datastores and query drivers enforce strict parameter limits (e.g. Firestore max 10/30, SQLite 999). Unpartitioned IN queries crash with driver parameter errors. Always chunk bulk queries. |
| "Declaring the modal inside the dropdown menu item keeps code colocated." | When the dropdown closes on click, the modal unmounts or gets trapped in the menu's overflow/z-index context. Always hoist modal state and declarations outside transient parent containers. |
| "Updating the primary entity in the database is enough; replicas will catch up." | Denormalized data (user snippets, summary counts) does not update automatically without atomic batched writes or triggers, leaving views permanently desynchronized. Update all replicas atomically. |
| "The global store resets itself when the user navigates to a new page." | Client stores retain previous entity state across route transitions (`/r/A` -> `/r/B`). Always reset scoped store state on unmount or route change, or key the subtree by entity ID. |
| "Allowing infinite comment replies gives users maximum flexibility." | Uncapped tree recursion squishes mobile layouts, degrades performance, and risks stack overflow. Explicitly track depth and enforce a hard cutoff threshold. |
| "Admins can manage all users in the community, so they can remove anyone." | Delegate admins must never be permitted to remove or demote the original creator/root owner, and the last remaining admin must not remove themselves. |
| "Setting `z-index: 9999` will guarantee the modal appears on top of everything." | CSS transforms, filters, or overflow on parent elements clamp stacking contexts. Floating dialogs and backdrops must be portaled to document root. |
| "The event handler registered in the library constructor can just read component state." | Mount-time third-party callbacks (e.g. `use-sound` `onend`, WebSocket listeners) trap stale closures. Use mutable `useRef` for live driver handles and read store state imperatively (`store.getState()`). |
| "Passing a fallback image string to `<Image src={url ?? '/fallback.png'}>` is safe." | Missing or unoptimized static fallback assets crash framework image optimizers. Conditionally render an inline accessible SVG/icon component fallback (`{url ? <Image ... /> : <FallbackIcon />}`). |
| "I can write a database trigger to delete storage files when a row is deleted." | Relational SQL triggers cannot manage external storage tables (`storage.objects`) without permission/RLS deadlocks. Orchestrate storage deletion in service layers. |
| "A server action can just return `false` if an operation fails." | Returning bare booleans hides failure reasons from the UI. Always return typed Result envelopes (`{ ok: boolean, error?: string }`). |
| "Using a long-press touch timer is fine to open mobile action menus." | Touch-hold timers clash with native mobile scrolling and context menus. Use explicit action buttons with `e.stopPropagation()` and structural slots for drag handles. |
| "Client-side file validation isn't strictly necessary since the server action checks limits." | Allowing oversized or invalid files into client state causes wasted upload bandwidth and cryptic server errors. Validate files via schemas on selection change and clear invalid inputs immediately. |
| "Copying loading and error pages into every subfolder ensures each route has its own boundary." | Duplicating identical boilerplate boundary files across nested subroutes adds dead maintenance weight and styling drift. Rely on inherited ancestor boundaries unless specialized UI is strictly needed. |
| "It's fine to mount search or auth components in the root layout so they are available everywhere." | Placing authenticated backend queries in the global root layout executes them for unauthenticated visitors on landing/public pages, causing fatal backend auth errors. Strictly encapsulate authenticated queries inside protected route group layouts. |
| "Setting `w-0` or `h-0` is enough to collapse the sidebar or drawer." | CSS `box-sizing: border-box` renders horizontal padding and borders even when dimensions are 0. A collapsed element with `w-0 p-3` leaves a visible colored strip and traps mouse clicks. Always zero out padding and borders (`w-0 p-0 border-0`). |
| "Context providers can wrap `<body>` inside `<html>`." | The HTML DOM specification permits only `<head>` and `<body>` as direct children of `<html>`. Placing providers between `<html>` and `<body>` causes fatal React SSR hydration mismatch crashes. Always nest providers inside `<body>`. |
| "Validating all environment variables in one file at module import ensures complete safety." | Eager evaluation of server secrets in modules imported by client components crashes SSR/static builds where server secrets are omitted. Decouple `clientEnv` from `serverEnv` and evaluate server secrets lazily via Proxies or getters. |
| "An empty state just needs to inform the user that there are no items." | Displaying 'No items' without an action button traps the user in an empty-state deadlock. Always include a prominent action affordance ('Add Item', 'Create Page') directly in empty states. |
| "Using `bg-muted` for loading skeletons matches the rest of the muted UI." | If `bg-muted` has the same hue as the background container in certain theme modes, the skeleton becomes completely invisible. Use alpha-blended contrast tokens (`bg-primary/5`) for guaranteed visibility across themes. |
| "Route `params` can be read directly as `params.id`." | In modern full-stack frameworks (Next.js 15+), route `params` are Promises. Accessing them synchronously throws runtime warnings or compiler errors. Always `await params` or unwrap via `React.use()`. |
| "Writing `\"__tests__\"` in linter includes will ignore the test directory." | In file-matching globs, omitting the negation prefix (`!`) includes the directory rather than ignoring it. Always use explicit negation globs (`\"!__tests__\"`) or dedicated override blocks. |
| "I don't need to await recursive cleanup/archival calls inside the mutation since they run in the background." | Unawaited async recursive calls create floating promise cascades. Handlers return prematurely before children finish, leaving orphaned records or terminating transactions early. Always `await recursiveOp()`. |
| "Checking `typeof window !== 'undefined'` in render is enough to use browser APIs in client components." | Even in client components, initial SSR executes on the server. Accessing browser globals or rendering modals without hydration gating produces mismatched server/client HTML and hydration errors. Gate client-only APIs behind `isMounted` state or neutral fallbacks. |
| "Adding the environment variable to `.env.local` is enough; CI will work automatically." | CI/CD pipelines run in isolated runners with explicit secrets. Forgetting to update workflow action definitions (`.github/workflows/*.yml`) causes clean local builds to crash in CI. Always synchronize CI action step environment mappings. |
| "A single dependency with strict peer requirements means we cannot upgrade the framework." | Allowing an unmaintained or non-essential widget (e.g. date picker) to block framework upgrades locks the entire application into legacy runtimes. Audit and prune the blocker dependency to unlock ecosystem upgrades. |
| "Checking `filteredItems.length === 0` is enough to decide whether to show the filter toggle." | Deriving filter visibility from filtered collections causes controls to vanish once toggled (Filter Collapse Paradox). Always derive filter controls from raw source data (`sourceItems.some(predicate)`). |
| "Wrapping `<CommandItem>` in a `<button>` or custom `<div>` wrapper makes it easier to style." | Inserting intermediate wrapper nodes inside virtualized/compound lists (cmdk, Radix) breaks DOM parent-child selector contracts and leaves large empty gaps. Keep item elements direct children. |
| "Passing `disabled` to a button rendering as a link via `asChild` prevents user navigation." | HTML `<a>` tags ignore `disabled`. Always intercept `onClick` with `e.preventDefault()`, set `aria-disabled="true"`, `tabIndex={-1}`, and `pointer-events-none`. |
| "Placing `<Link>` inside `<Button>` is fine as long as the label is inside the link." | Inverted nesting creates unclickable outer button padding (dead click zones) and overflowed link hitboxes. Wrap `<Button asChild><Link ...>` or wrap the button in the link. |
| "The carousel or player state will reset automatically when switching tabs." | Stateful hooks retain active slide indices and counts across tabs. Always reset active indices and APIs in tab change handlers or unmount tab panes. |
| "Hover utility classes like `hover:bg-primary` work well everywhere." | On mobile/touch devices, tapping causes hover states to stick indefinitely. Restrict hover styling to `@media (hover: hover) and (pointer: fine)`. |
| "Vector diagrams and charts will automatically adopt dark mode colors." | Embedded SVG/diagram renderers (Mermaid, Chart.js) often hardcode initial fills. Dynamically synchronize diagram renderer theme tokens with theme change observers. |
| "I can put a searchable combobox inside a mobile bottom sheet drawer." | Drag-to-dismiss gesture listeners intercept vertical scroll deltas, locking combobox scrolling. Use native selects or accordion flows inside mobile drawers. |
| "Updating one filter facet can just set the state to `{ [facet]: value }`." | Overwriting the entire filter object untoggles independent facets like archive switches and pagination. Always use functional delta merges (`setFilter(prev => ({ ...prev, [facet]: value }))`). |
| "SPA route transitions automatically scroll to the top of the page." | Framework scroll restoration watches `window.scrollY`. If layout content is nested in an internal scroll container (`overflow-y-auto`), reset container scroll to 0 on route change. |
| "Static pages work in dev so they will build fine in production static exports." | Dynamic parameterized routes (`[id]`) in SSG/static exports fail with 404s unless `generateStaticParams` / `getStaticPaths` is exported. |
| "Relative asset paths like `projects/image.png` work on the homepage so they work everywhere." | Relative asset paths 404 on nested subroutes (`/projects/item/report`). Always use domain root-relative paths (`/projects/image.png`). |
| "Mock variables can be declared directly with `const mockFn = vi.fn()` before `vi.mock()`." | Unit test runners hoist `vi.mock()` above top-level `const` declarations, triggering TDZ ReferenceErrors. Use `vi.hoisted()` for mock factory variables. |
| "A global regex replacing tokens in markdown is safe as long as fenced code blocks are excluded." | Regex replacements clobber inline backtick code spans (`` `$$x$$` ``). Shield both fenced code blocks AND inline code spans before running text transformations. |
| "Static JSON/map entity relationships can be maintained by hand." | Manual bidirectional links drift over time with orphan references. Always write automated referential integrity assertion tests for static relational maps. |
| "Calling an API endpoint without a leading slash like `api/seen` works because we are calling our own backend." | Relative URL strings resolve against the active nested route path (e.g. `/conversations/123/api/seen`), resulting in 404 Not Found errors on deep subroutes. Always anchor API paths to the domain root with a leading slash (`/api/...`) or use centralized route constants. |
| "Middleware only needs to list the initial protected route matchers; newly added private subroutes are protected automatically." | Framework route matchers only intercept paths matching registered glob patterns. Omitting new private paths (e.g. `/conversations/:path*`) leaves them unauthenticated and breaks logout redirection. Maintain synchronized route matchers or enforce default-deny routing. |
| "ORM client generation runs locally, so there is no need for an automated `postinstall` hook in package manifests." | Fresh CI runners, Docker containers, and deployment platforms will abort with missing client initialization errors (e.g. `PrismaClientInitializationError`) if generated clients are missing. Always bind code generation to package lifecycle hooks (`"postinstall": "... generate"`). |
| "Setting `baseURL: process.env.APP_URL || 'http://localhost:3000'` in client SDK config provides a safe fallback." | In production or preview deployments where public environment variables are omitted or renamed, hardcoded localhost fallbacks silently direct end-user browsers to `http://localhost:3000`. Use strictly validated env schemas or omit baseURL to inherit `window.location.origin`. |
| "We don't need `trustedOrigins` in authentication server initialization because all traffic is on the same host." | Deployments with preview URLs, custom domains, or mobile/cross-origin clients will fail with 403 Forbidden or silent session drops. Always bind dynamic, environment-driven trusted origins. |
| "Clearing a form input after submit with `setValue('field', '', { shouldValidate: true })` ensures clean validation state." | `{ shouldValidate: true }` re-validates the newly cleared field immediately against required rules, displaying false validation error messages (e.g. 'Message is required') right after successful submission. Omit `shouldValidate` when clearing inputs. |
| "Declaring a schema field as `.optional()` is sufficient for form and database data." | Database drivers, ORMs, and reset payloads often pass explicit `null` for empty columns. A bare `.optional()` rejects `null` with validation errors. Use `.nullable().optional()` for optional fields ingesting database records or form resets. |
| "When updating authentication libraries or adapters, we don't need to change our database schema if the core models exist." | Third-party auth adapters mandate specific columns and tables (e.g. `idToken`, `password`, `emailVerified`, `Verification` table). Missing fields trigger runtime database query failures during OAuth or session operations. Verify and synchronize adapter schema contracts. |
| "Accessing `error.errors[0].message` in catch blocks is fine because that's the library's standard error shape." | Different validator/SDK major versions or unexpected error types have different error property shapes (e.g. Zod `error.issues` vs `error.errors`). Direct property access induces secondary `TypeError` crashes. Inspect error shapes defensively using optional chaining and type narrowing. |
| "Instantiating client SDKs (PusherClient, WebSockets) at top-level module scope is harmless." | Universal / SSR module imports evaluate top-level code on the server, triggering Node.js deprecation warnings (`DEP0169 url.parse`), build failures, or `window is not defined` crashes. Instantiate browser SDKs lazily via getters or Proxies guarded by `typeof window !== 'undefined'`. |
| "Directly setting `process.env.NODE_ENV` in unit tests is fine if we clean it up manually." | Direct `process.env` mutation leaks across parallel worker threads and test suites, causing flaky test failures. Always use test runner sandboxing helpers (`vi.stubEnv`) with automatic restoration. |
| "Server actions can be tested without mocking framework server request contexts." | Server actions that invoke session or header utilities (e.g. `next/headers` `headers()`, `cookies()`) crash in unit tests with 'Invariant: request context expected' unless ambient server context is explicitly mocked. |
| "Consolidating 20 fine-grained tools into 1 coarse dispatcher is just refactoring; sub-actions don't need typed schemas." | Unchecked sub-actions lead to payload key mismatches, parameter starvation, inverted arguments, and return shape drift. Always define discriminated union schemas and validate returns per action. |
| "Returning `dict[str, Any]` or `list[dict]` from API routes gives consumers maximum flexibility." | Opaque dictionary returns erode public API contracts, destroy client type safety, degrade OpenAPI/MCP tool schemas, and mask downstream data corruption. Always return declared, strongly typed models. |
| "Writing directly back to the target file path is fine since we only modified one sheet/element." | Partial document writers overwrite and destroy all sibling sheets, archive members, formulas, and metadata. Always load the full composite document and write atomically via temporary files. |
| "The library returns a matrix of rows, so `cells[0][0]` will always fetch the first cell." | Foreign libraries return polymorphic shapes depending on dimension (e.g. single cells return scalars, 1D vectors for single rows, empty structures on 0 rows). Always normalize foreign returns defensively to 2D before indexing. |
| "Setting `chart.title = None` or `""` will simply clear the title." | Foreign library property setters have side-effect hooks that corrupt underlying XML structures, delete child element trees, or discard styling. Use library-sanctioned removal methods. |
| "Blocking `os`, `sys`, and `open` in the AST visitor makes code execution sandboxes completely secure." | Secondary libraries (Pandas, NumPy, Pillow, Matplotlib) expose dozens of transitive file, network, and execution methods (`to_csv`, `read_pickle`, `load`, `save`). Sandbox visitors must recursively inspect and block all transitive I/O attributes. |
| "Catching domain validation exceptions and returning a generic protocol error envelope protects server internals." | Stripping domain validation exceptions into generic error envelopes blinds clients and AI agents to the specific reason for rejection (field names, coordinates, missing entities). Preserve actionable diagnostic messages. |
| "Parsing dates with `dayfirst=True` or auto-detection handles international formats nicely." | Ambiguous guessing heuristics corrupt standardized canonical ISO 8601 strings (e.g. `2024-05-01` parsed as Jan 5th). Always parse unambiguous ISO formats strictly before falling back to locale heuristics. |
| "Users should strictly write `=`; rejecting `==` is fine because our syntax says so." | Inflexible parsers rejecting common operator variants (`==` vs `=`, `<>` vs `!=`, or case variations `and` vs `AND`) cause unnecessary friction. Normalize operators into domain enums at parser entry. |
| "I don't need to import `math` at module top-level since it's only used in one rare formula branch." | Lazy or scoped imports inside deep conditional branches evade testing and trigger fatal runtime `NameError` in production. Always declare foundational dependencies at module top-level. |

---

# Red Flags - STOP and Correct

- Modifying implementation code before an automated reproduction test demonstrates the failure.
- Using check-then-act (`SELECT` then `UPDATE`/`INSERT`) in concurrent paths instead of atomic upserts.
- Deleting or disabling an existing failing test to make CI or verification pass.
- Introducing wide refactoring or stylistic restructuring under the guise of a bug fix.
- Leaving multi-store mutations uncompensated when secondary cloud/disk writes fail.
- Returning empty assistant messages when an AI loop halts on step limits without a synthesis fallback pass.
- Leaving orphaned `tool-call` messages without matching `tool-result` responses in conversational history.
- Destructively wiping shared store entity details in parent collection or layout loaders.
- Completing pipeline mutation steps without validating that mutated output artifacts were persisted.
- Evicting shared resource handles without instance equality verification.
- Passing parameterized actions directly to DOM event listeners (`onClick={fn}`) without parameterless arrow closures.
- Using `.single()` for existence checks or nullable queries instead of `.maybeSingle()`.
- Leaving responsive positioning containers (`fixed`/`absolute` with high z-index) active on mobile viewports when inner content is hidden.
- Converting multi-megabyte binary uploads to base64 Data URLs instead of native multipart `FormData`.
- Validating server-only environment secrets eagerly in client-side bundles.
- Leaving guest-only authentication routes unguarded against active authenticated user sessions.
- Attaching generic mutation triggers or lifecycle hooks without verifying column existence on junction/join tables.
- Evaluating auth/permission guards without awaiting asynchronous auth/profile resolution.
- Accessing external error code dictionaries without fallback to raw error message or default text.
- Passing unchunked ID arrays to datastore IN queries without batch partitioning.
- Nesting modal dialogs inside transient menus, dropdowns, or collapsible containers.
- Updating canonical entities without updating denormalized replica documents or caches.
- Retaining previous entity state in shared stores when navigating across parameterized routes.
- Permitting unbounded recursive nesting without schema-enforced depth limits and UI cutoffs.
- Allowing delegate administrators to remove or demote the entity creator, or allowing sole admins to self-demote.
- Mounting modal or floating overlay dialogs without DOM Portals, causing stacking context clamping.
- Allowing unvirtualized infinite scroll observers to accumulate unbounded DOM nodes and memory bloat.
- Capturing reactive component state in mount-registered third-party callbacks instead of mutable refs and imperative store getters.
- Passing nullish or static fallback strings into framework image optimizers instead of conditional inline SVG/icon UI elements.
- Attempting to delete external cloud storage objects via relational SQL triggers.
- Omitting `"use server"` on server action modules or returning bare booleans instead of Result envelopes.
- Using hand-rolled long-press touch-hold timers on mobile scrollable lists instead of explicit action buttons.
- Renaming source files without synchronizing string mock paths (`vi.mock`) across test files.
- Allowing unvalidated file selections to persist in form state without pre-submit schema validation and input resetting.
- Duplicating identical boilerplate `loading.tsx` or `error.tsx` boundary files across nested subroutes instead of relying on inherited framework boundaries.
- Placing authenticated data queries or commands in global/root layouts wrapping public routes.
- Collapsing containers with zero dimensions (`w-0`, `h-0`) while retaining active padding or borders.
- Nesting context providers between `<html>` and `<body>` in root layouts, violating HTML DOM hierarchy.
- Validating server-only environment variables eagerly at module import in isomorphic or client-imported modules.
- Rendering empty-state views without a primary creation or recovery action affordance.
- Styling loading skeletons with background tokens that collide with parent container surfaces.
- Reading asynchronous route parameters (`params`, `searchParams`) synchronously without `await` or `React.use()`.
- Using experimental compiler flags or unreleased major compiler versions that break production deployment runners.
- Launching recursive async operations or cascading mutations without awaiting their promise completion.
- Reading browser globals (`window.location.origin`, `localStorage`) or rendering client-only modals during SSR without `isMounted` hydration gating.
- Omitting newly required environment variables from CI/CD workflow action configuration.
- Retaining non-essential blocker dependencies with strict peer constraints instead of pruning them to unblock core framework modernization.
- Deriving filter or toggle control visibility from filtered arrays rather than source collections.
- Inserting intermediate wrapper elements (`<div>`, `<button>`) between compound list containers and items in filtered/virtualized lists.
- Relying on `disabled` props on polymorphic components rendering anchor tags (`<a>`) without click interception.
- Inverting interactive nesting (`<Button><Link>`) creating dead click zones in padding.
- Retaining transient carousel slide indices, counts, or media playback across tab view transitions without resets.
- Applying CSS hover styles unconditionally on touch viewports without `@media (hover: hover)` guards.
- Rendering client-side vector diagrams (Mermaid, SVG charts) with hardcoded themes that collide in dark mode.
- Nesting virtualized dropdown popovers inside touch-dismissible mobile drawers, causing scroll gesture deadlocks.
- Overwriting composite filter state on partial facet updates, untoggling independent active filters.
- Relying on framework window scroll restoration when scrollable layout content is nested inside overflow containers.
- Omitting `generateStaticParams` on dynamic parameterized routes intended for static export or SSG deployments.
- Using relative asset or link paths without leading root slashes that drift and 404 on deep nested subroutes.
- Referencing unhoisted variables inside unit test mock factories without `vi.hoisted()`.
- Executing global regex text replacements on markdown without shielding inline code spans.
- Maintaining bidirectional relational entity maps without automated referential integrity test suites.
- Invoking client-side API requests using relative paths without a leading root slash (`api/...` instead of `/api/...`).
- Omitting newly added private route segments from framework authentication and middleware matchers.
- Omitting automated code generation lifecycle hooks (`"postinstall": "... generate"`) in package manifests.
- Supplying hardcoded `http://localhost:3000` fallback strings in distributed client SDK configurations.
- Initializing authentication servers and API gateways without dynamic cross-origin `trustedOrigins` configuration.
- Triggering validation with `{ shouldValidate: true }` when programmatically resetting form inputs post-submission.
- Using bare `.optional()` instead of `.nullable().optional()` on validation schemas ingesting database records or form reset payloads.
- Changing authentication adapters or ORMs without updating database schemas to meet required adapter field contracts.
- Accessing third-party caught exception properties (`error.errors[0]`, `error.response.data`) without defensive type guards or optional chaining.
- Instantiating browser-only SDKs (WebSockets, PusherClient) eagerly at top-level module scope in universal/SSR bundles.
- Mutating `process.env` directly in unit tests instead of using isolated runner utilities (`vi.stubEnv`).
- Testing server actions and session resolvers without mocking ambient request contexts (`next/headers`).
- Consolidating fine-grained endpoints into coarse dispatchers without discriminated union schemas and typed return models.
- Starving optional arguments or inverting positional arguments when forwarding facade parameters to domain services.
- Returning untyped `dict` or `list[dict]` across public API, MCP, or RPC boundaries instead of declared Pydantic/TypeScript models.
- Overwriting multi-part documents or spreadsheets in-place without loading and preserving sibling sheets and metadata.
- Indexing foreign library returns (`result[0][0]`) without defensively normalizing polymorphic dimensions (scalar vs 1D vs 2D).
- Assigning nullish or empty primitives to foreign library composite properties with destructive setter hooks.
- Blocking only language primitives (`open`, `os`) in execution sandboxes while allowing transitive library I/O methods (`to_csv`, `read_pickle`).
- Swallowing domain validation exceptions into generic protocol error envelopes or uninformative error codes.
- Applying ambiguous locale-dependent date/number parsing heuristics (`dayfirst=True`) to standardized ISO formats.
- Omitting top-level module imports for dependencies utilized in deep conditional execution branches.
- Rejecting standard mathematical/comparison operator variants (`==` vs `=`, `<>` vs `!=`) in domain query parsers.