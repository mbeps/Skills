# UI & Component Analysis Module

Evaluates user interface architecture, component decomposition, state lifecycles, and front-end design patterns. Identifies maintainability bottlenecks, state-rendering coupling, accessibility deficits, and component bloat without altering code.

## When to Use

Use this module when you need to:
- Audit front-end codebases (React, Next.js, Vue, Svelte) for maintainability and scalability
- Detect monolithic page components that conflate presentation with business mutations
- Identify God Hooks and mega-composables managing fragmented, unbounded state
- Spot duplicated UI flows, such as dual-mode Create/Edit form drift
- Flag bespoke re-implementations of accessible design system primitives
- Detect invasive interaction overlays and runaway observer re-fetching loops
- Evaluate front-end testability and component boundary health

## Key Analysis Areas

### 1. Monolithic Page & View Components
Large components ($>300$ LOC) that inline layout, data fetching, validation, modals, and actions in a single file. Violates the Container-Presenter pattern and makes visual slicing difficult.

### 2. Presentation-Mutation Coupling
Components that interleave JSX markup directly with asynchronous network requests, database mutations, or storage access. Missing headless custom hooks or ViewModels to decouple user interactions from business orchestration.

### 3. God Hooks & Mega-Composables
Custom hooks or composables that manage $>5$ disparate state domains (e.g. search filters, pagination, user authorization, modal dialog visibility, cart updates). Causes unnecessary re-renders across consumers and hinders testability.

### 4. Dual-Mode Form Clone Drift
Separate components (e.g. `AddUserForm.tsx` and `EditUserForm.tsx`) that share $>80\%$ identical markup, field controls, and validation rules, leading to divergent bug fixes and inconsistent UI behaviour.

### 5. Bespoke UI Widget Syndrome
Hand-rolling custom complex UI widgets (comboboxes, dropdown menus, accessible modal dialogs, date pickers) instead of using battle-tested accessible primitives (Radix UI, Headless UI, ARIA-compliant design tokens), leading to screen reader and keyboard navigation failures.

### 6. Bespoke Destructive Action Confirmation Sprawl
Duplicating independent modal dialogs and confirmation alert logic across multiple views rather than utilising a parametric, reusable confirmation dialogue contract.

### 7. Compiler-Redundant Manual Memoization
Indiscriminate wrapping of trivial primitive values or straightforward calculations in `useMemo` or `useCallback` in modern compiler environments (e.g. React 19 Compiler) where manual memoization introduces cognitive clutter without measurable performance gain.

### 8. Invasive Interaction Overlays
Using absolute positioned wrapper overlays (`position: absolute; inset: 0`) that steal pointer events or collide with underlying interactive elements, rather than using slot-based inversion of control.

### 9. Runaway Observer Feeds vs Progressive Disclosure
Fragile intersection observers used for infinite scrolling that trigger unbounded re-fetch loops and Cumulative Layout Shift (CLS), where deterministic progressive disclosure ("Load More") would ensure stability.

### 10. Hook-Provider Conflation & Route Boundary Nesting
Bundling React Context Providers with consumer hooks in a single file under `hooks/`, or copy-pasting redundant error/loading boundaries into every leaf route segment instead of leveraging hierarchical boundary inheritance.

### 11. Premature Empty-State Flash
Evaluating `data.length === 0` before the hydration or data-fetching lifecycle completes, rendering empty-state UI ("No items found", "No configuration") during loading instead of gating presentation behind an explicit hydrated status.

### 12. Mount-Time Destructive Hydration Overwrite
Parent layout or listing components fetching summaries on mount and resetting shared entity store dictionaries, wiping out detailed records loaded concurrently by child page routes.

### 13. Portaled Focus-Trap Collisions
Portaling interactive popups, comboboxes, or date pickers into the document root while rendered inside a modal dialog with an active focus trap, causing the focus trap to block pointer or keyboard interaction with the portaled content.

### 14. Interactive Nesting Hydration Hazards
Nesting interactive buttons, switches, or click targets inside outer anchor tags (`<a>` or `<Link>`), violating HTML specifications, causing SSR hydration errors, and triggering double-navigation event bubbling.

### 15. Hook Callback Identity Instability
Custom hooks exporting action dispatchers, error handlers, or mutators declared as inline functions without `useCallback`. Downstream consumers including them in `useEffect` or `useCallback` dependency arrays experience continuous re-render cascades or aborted async actions.

### 16. Invisible Responsive Layout Overlays (Pointer-Events Traps)
Responsive positioning containers (e.g. desktop sidebars, drawer shells) retaining fixed/absolute coordinates (`fixed inset-y-0 w-64 z-50`) on mobile viewports when child markup is hidden (`display: none`), creating an invisible hit-box that swallows clicks and taps on underlying content.

### 17. Event-Handler Parameter Bleed (SyntheticEvent Poisoning)
Passing action dispatchers taking optional parameters directly to DOM event listeners (`onClick={fn}`), which causes the framework SyntheticEvent object to be passed as the parameter, poisoning downstream URLs (`/[object%20Object]`) or triggering runtime TypeErrors.

### 18. Mobile Viewport Navigation Occlusion
Pinned bottom navigation bars or floating toolbars occluding footer content and action buttons due to missing responsive bottom padding (`pb-20 md:pb-0`) on main scrollable containers.

### 19. Object URL Resource Leaks
Invoking `URL.createObjectURL(file)` in local image preview flows without corresponding cleanup via `URL.revokeObjectURL()` in effect unmount or change handlers, resulting in progressive browser memory leaks.

### 20. User Media Aspect Clipping & Responsive Dimension Collapse
Applying fixed aspect ratio containers with `object-cover` on arbitrary user-submitted imagery (vehicles, receipts, products), cropping out essential visual boundaries; or rendering framework image components in flex/grid layouts without explicit dimensions or relative container constraints, causing layout collapse to 0x0 pixels.

### 21. Unstable Collection Reference Thrashing in Dependencies
Passing unmemoized collection fallbacks (`props.items || []`, default options objects) directly into reactive hook dependency arrays, breaking reference equality on every render pass and triggering continuous re-fetch or re-render cycles.

### 22. Premature Guard Evaluation & Asynchronous Auth Tri-State Race
Checking user authentication or permission states (`!user`, `!canAccess`) synchronously or before underlying asynchronous session resolution settles (`isLoading`), causing jarring flashes of unauthorized UI or false redirect bounces to login pages on page refresh.

### 23. Transient Container Modal Trapping (Unmount-on-Close)
Declaring modal dialogs, drawer overlays, or alert confirmations inside transient parent elements (dropdown menus, popover content, collapsible lists) where closing the triggering parent unmounts the modal or traps its scroll and keyboard focus.

### 24. Dynamic Route Null vs Undefined Resolution Hang
Failing to delineate between pending data fetch (`undefined`) and verified entity non-existence (`null`) in dynamic route loaders, causing components to render loading spinners indefinitely instead of navigating to or rendering a dedicated 404 view.

### 25. Nested Form Submission & Action Button Collision
Placing action buttons with implicit `type="submit"` or nested form handlers inside complex component cards or lists, causing child button clicks to inadvertently trigger parent forms or be swallowed by outer event listeners without executing action logic.

### 26. Route Transition State Leakage
Retaining previous entity state in shared reactive stores (Jotai atoms, Redux slices, Zustand stores) when navigating between distinct instances of parameterized routes (e.g. `/community/react` to `/community/nextjs`), causing stale entity icons, titles, or metadata to flash or contaminate the new view.

### 27. Stacking Context Clamping & Modal DOM Portal Omission
Rendering modals, dialog backdrops, or floating popovers directly into local component DOM subtrees rather than mounting them via a Portal to document body. Ancestor CSS properties creating local stacking contexts (`transform`, `filter`, `backdrop-filter`, `overflow: hidden`) clamp the overlay, preventing it from covering the viewport or blurring underlying content.

### 28. Arbitrary Z-Index Escalation & Layering Inversion
Applying ad-hoc, hardcoded `z-index` values (`999`, `9999`) to solve local layering issues, triggering stacking context wars where tooltips, dropdowns, and form buttons clash or render under incorrect layers instead of adhering to centralized design token scales.

### 29. Unbounded Text Sibling Layout Ejection
Placing dynamic user strings (titles, community names, usernames) in horizontal flexbox rows beside action buttons without `min-width: 0` or truncation. On narrow mobile viewports, the long text forces sibling buttons outside the card boundary or causes horizontal overflow.

### 30. Unvirtualized Infinite Scroll Memory Bloat & Observer Thrashing
Implementing infinite scrolling feeds via `IntersectionObserver` that continuously append unbounded DOM nodes without list virtualization, resulting in high mobile memory consumption, lost scroll positions on back navigation, and duplicate fetch race conditions.

### 31. Recursive Component Depth Exhaustion
Rendering self-referencing hierarchical components (comment threads, reply trees, nested categories) without schema-level depth tracking and UI cutoffs, causing severe layout squishing on mobile and risking call stack exhaustion.

### 32. Third-Party Callback Stale Closures (The Mount-Time Listener Trap)
Third-party libraries, audio/video players, or custom canvas hooks registering event listeners (e.g. `onplay`, `onend`, `onerror`) once at component mount. When callbacks access component state or handler props directly without mutable refs (`useRef`) or store accessors (`getState()`), they execute with stale initial closure state, failing to trigger downstream reactive changes (such as auto-playing next items).

### 33. Dynamic Media Fallback Degradation Failure
Framework image or video components rendering dynamic or user-submitted asset paths without defensive checks for `null`, `undefined`, or malformed URLs. Results in runtime render crashes or broken layout boxes instead of gracefully falling back to deterministic placeholder icons or placeholder UI.

### 34. Mobile Touch Target Proximity Conflicts
Placing desktop-sized clickable links or secondary action targets immediately adjacent to primary touch controls (e.g. artist navigation link placed inside or adjacent to track row play button) without minimum 48px touch boundaries or mobile layout adjustments, causing accidental navigation when users attempt to trigger the primary action on touch screens.

### 35. Touch Gesture Native Conflicts & Overlaid Drag Handles
Mounting custom gesture listeners (long-press, horizontal swipe) or absolute-positioned drag handles over scrollable lists. Custom timers collide with native scrolling gestures, or overlaid drag handles steal pointer and click events from list items. Interactive items requiring reordering or gestures must use designated structural component slots (`rightAction`) with explicit event propagation boundaries.

### 36. Pre-Submit File Schema Validation & Input Reset
Client-side upload forms or interactive file pickers binding raw `File` instances to state without executing schema validation (`safeParse`) on file selection change (`onChange`). When users select an invalid file type or oversized payload, the invalid file persists in state and attempts submission, leading to aborted network requests or unhandled server-side validation rejections. Form handlers must validate files immediately upon selection (`safeParse`), show user-facing errors (e.g. toasts or field errors), and clear the native file input (`e.target.value = ''`) when invalid.

### 37. Root DOM Tree Hierarchy & SSR Hydration Invariants
Placing React context providers, theme wrappers, or styling containers between `<html>` and `<body>` in root layouts (`app/layout.tsx`), resulting in `<html><Provider><body>...</body></Provider></html>`. In HTML specifications, `<html>` permits only `<head>` and `<body>` as direct children. Nesting custom elements or providers outside `<body>` causes immediate fatal client-server hydration mismatch errors on page mount. All providers and layout wrappers must strictly be nested *inside* `<body>`.

### 38. Zero-Dimension Collapsible Container Box-Model Leakage
Collapsing interactive sidebars, drawers, or floating panels by setting their width or height to zero (e.g. `isCollapsed && "w-0"` or `isMobile && "w-0"`) while keeping horizontal/vertical padding or borders active (`p-3 border-r`). Under standard CSS `box-sizing: border-box`, padding and borders remain rendered even when width or height is zero, leaving a visible colored strip on screen and capturing mouse clicks or pointer events that block user interaction on underlying content. Collapsible states must simultaneously collapse padding and borders (`w-0 p-0 border-0`) or toggle `overflow-hidden` / `hidden`.

### 39. Zero-State Action Deadlock (The Empty-State Trap)
Collection or list components that render an empty state message ("No items found", "No pages inside") when data arrays are empty, but fail to provide an explicit creation or onboarding action affordance ("Add Item", "Create Page") within that empty view. Users with zero items are deadlocked without an obvious affordance to create their first item or recover from an empty state.

### 40. Theme Surface Color Collision in Transient States (Invisible Loading Skeletons)
Styling animated loading skeletons or placeholder components using semantic surface tokens (such as `bg-muted` or `bg-secondary`) that share the exact background color of the parent container in specific theme modes (dark or light mode). Skeletons become completely invisible, presenting an unresponsive blank screen or jarring layout jumps to users. Skeletons must use alpha-blended foreground tokens (e.g. `bg-primary/5` or `bg-foreground/10`) to guarantee cross-theme contrast.

### 41. Layout Auth Scope Boundary Mismatch
Mounting components that execute authenticated backend queries (e.g. search bars, document list loaders, notifications) inside global or root layouts (`app/layout.tsx`) that wrap unauthenticated routes (landing pages, marketing views, sign-in forms). Unauthenticated visitors browsing public routes trigger unauthenticated query crashes or console authorization errors. Authenticated components must be strictly encapsulated in protected route group layouts (e.g. `app/(main)/layout.tsx`) that enforce session existence.

### 42. Client-Only Browser API Access Without Mount Gating (`isMounted`)
Accessing browser-only globals (`window.location.origin`, `localStorage`, `document.title`) or rendering client-only portals/modals during component render execution outside of `useEffect`. In server-rendered environments (Next.js SSR/SSG), server evaluation produces `ReferenceError: window is not defined` or renders initial markup that diverges from the client's initial DOM, triggering React client-server hydration mismatch errors. Client components requiring browser APIs or rendering shared modals must gate execution behind an `isMounted` state initialized to `false` and set to `true` in `useEffect`, or return deterministic neutral fallbacks (e.g. empty string `""` or `null`) until hydration completes.

### 43. Filter State Source vs Subset Inversion (The Filter Collapse Paradox)
Evaluating filter/facet visibility, clear controls, or "Show Archived" toggles conditionally against the *filtered* results array (`filtered.length !== total.length`) rather than the raw source dataset. Once activated, the condition satisfies itself or flips, causing the toggle or filter panel to vanish from the DOM, stranding the user in the filtered state without an affordance to reset. Availability predicates must evaluate the raw source collection (`source.some(predicate)`).

### 44. Compound Component DOM Hierarchy & Wrapper Neutrality
Inserting intermediate wrapper elements (`<button>`, `<div>`) between compound component parents and items (e.g. in cmdk, Radix Combobox, or virtualized lists), or nesting list containers (`<CommandList>`) inside item mapping loops. This breaks parent-child DOM traversal and CSS selector rules, causing filtered-out items to leave massive empty vertical gaps and disrupting keyboard navigation. Additionally, search filter predicates must match visible entry names rather than internal machine slugs.

### 45. Disabled Polymorphic Navigation Traps (`asChild` Link Trap)
Applying a `disabled` prop to a button or trigger rendered as an anchor tag (`<a>` or Next.js `<Link>`) via `asChild` / slot composition. In HTML specifications, `<a>` tags do not support native `disabled`. The element appears dimmed but still handles pointer clicks and keyboard activation, triggering unintended navigation. Disabled polymorphic links must intercept `onClick` (`e.preventDefault()`), declare `aria-disabled="true"`, set `tabIndex={-1}`, and enforce CSS `pointer-events-none`.

### 46. Hitbox & Event Delegation Alignment in Nested Controls
Inverting component hierarchies by placing `<Link>` inside `<Button>` (`<Button><Link>Label</Link></Button>`) or assigning unconstrained width classes (`w-full`) to navigation links inside constrained container boxes. Users clicking outer button padding encounter dead zones that fail to navigate, while clicks in whitespace outside visual buttons trigger inadvertent navigation. Outer clickable containers must wrap navigation anchors or use unified accessible slot composition (`<Button asChild><Link ...>...</Link></Button>`).

### 47. Shared Transient State Across Tab / View Transitions
Sharing stateful hooks or controllers (such as carousel instance APIs, active slide indices, or media counters) across mutually exclusive tabs or view modes (e.g. Image Gallery vs Video Player) without state resets upon tab switching. Switching between modes displays out-of-bounds indices (e.g. "Slide 8 of 2") or leaves background media playing. Tab-change handlers must reset active transient state, or tab panes must conditionally unmount.

### 48. Touch Screen Sticky Hover State
Applying hover styles or utility classes (`hover:...`) to interactive buttons, links, or filter chips without media query guards (`@media (hover: hover) and (pointer: fine)`). On mobile touch screens, tapping an element triggers persistent hover styling that remains stuck until another element is tapped, creating jarring visual glitches or false active indicators. Interactive elements must isolate hover effects to pointer-fine devices and use touch-friendly active states (`active:...`).

### 49. Dynamic Diagram / Vector Graphic Dark Mode Contrast Collision
Embedding client-side diagram renderers (e.g. Mermaid.js, SVG flowcharts, Chart.js) that initialize with static light-mode styling or fail to observe application theme toggles. In dark mode, diagrams render with illegible black text on dark backgrounds or invisible connector lines. Diagram components must bind to reactive theme context and re-initialize renderers with synchronized light/dark contrast tokens or high-contrast container styling.

### 50. Mobile Drawer Drag-To-Dismiss Nested Scroll Capture Conflict
Nesting scrollable dropdown menus, combobox popovers, or virtualized option lists inside a touch-dismissible mobile sheet or drawer (e.g. Vaul, Radix Drawer). Swiping to scroll the list items triggers the drawer's vertical drag-to-dismiss gesture, closing the drawer or locking scroll events. Within mobile drawer containers, comboboxes must be replaced with native select elements, accordion panels, or un-nested dialog views.

### 51. Orthogonal Filter Facet Clobbering on Partial Update
Mutating multi-facet filter state by replacing the entire filter object rather than executing functional delta merges (`setFilter(prev => ({ ...prev, facet }))`). Updating a single filter category or search keyword inadvertently resets orthogonal parameters, such as untoggling an active "Include Archived" switch or resetting page indices without preserving user context.

### 52. Nested Scroll Container SPA Route Restoration Failure
Single Page Application (SPA) layouts that nest primary scrollable viewports inside custom overflow containers (`overflow-y-auto h-screen`) while document `window` remains at offset `(0, 0)`. When navigating across client-side routes, framework window scroll restoration fails to reset internal scroll containers, leaving newly rendered pages stranded at the previous view's scroll offset. Layouts must restore scroll position on route pathname transitions.

### 53. Unbounded Data Table Mobile Viewport Clipping
Rendering wide data tables or multi-column grids without dedicated horizontal scroll wrappers (`overflow-x-auto w-full`). On narrow mobile viewports, columns are clipped, cell text is cut off, and layouts induce horizontal viewport wiggling. Tables must be enclosed in responsive overflow containers with visual scroll hints.

### 54. Priority Filter Empty-State Fallback Deficit
Filtering a subcollection by a priority criteria (e.g. `isMainSkill: true` or `featured: true`) where an entity has items, but none happen to carry the priority flag. The filter produces an empty list and the UI renders an awkward blank gap instead of gracefully falling back to displaying top or default items (`items.slice(0, MAX)`).

### 55. Post-Submission Form Reset Validation Re-Trigger Deadlocks
Calling field or form resets post-submission with validation triggers enabled (e.g. `setValue("message", "", { shouldValidate: true })` or resetting fields into pristine empty states that violate minimum length or required constraints). The immediate validation pass fires on empty inputs, re-flagging the field with validation errors (e.g. "String must contain at least 1 character(s)") and disabling submit buttons even though the previous submission succeeded. Reset actions must pass `{ shouldValidate: false }` or use library-native pristine `reset()` methods that do not mark clean empty inputs as dirty errors.

---

## Quality Principles

- **Container-Presenter Separation** – Keep UI views pure and declarative; push async mutations and orchestration into headless hooks or handlers.
- **Single Responsibility in State** – One hook per cohesive state domain.
- **Accessibility by Default** – Design system primitives must support keyboard navigation, focus trapping, and ARIA attributes.
- **YAGNI in Abstraction** – Do not extract 3-line presentational elements into one-off single-use wrapper files.
- **Deterministic UX** – User-initiated actions and pagination must produce predictable, observable state transitions.

---

## What This Module Does NOT Do

- Does not rewrite or reformat component JSX/TSX
- Does not modify CSS or styling tokens
- Does not perform runtime visual regression testing
- Does not penalize simple, self-contained components that have low churn
- Does not recommend third-party UI libraries when existing project primitives suffice

---

## Report Structure

Each finding includes:

- **Component / Hook Name** – File path and symbol name
- **Defect Category** – Monolithic View / Presentation Coupling / God Hook / Form Drift / Bespoke Widget
- **Current Assessment** – Specific structural anti-pattern observed
- **Evidence** – Line numbers, LOC counts, coupled state variables, missing ARIA tags
- **Diagnostic Simplification Category** – Architectural remediation target (e.g. Container-Presenter decomposition, Headless Hook extraction)
- **Maintainability Impact** – Expected reduction in cognitive load and regression risk

---

## Example Findings

**Example 1: Monolithic Dashboard View with Presentation Coupling**
- **Location**: `src/views/DashboardView.tsx` (lines 1–480)
- **Defect Category**: Monolithic View / Presentation Coupling
- **Current Assessment**: View component manages data fetching via raw `fetch`, tab switching state, user permission filtering, and inlines 3 distinct modals.
- **Evidence**: 480 LOC; contains 14 `useState` declarations, 3 `useEffect` blocks, and 2 direct API mutation handlers inside JSX button handlers.
- **Diagnostic Simplification**: Extract data fetching and mutation orchestration into headless `useDashboardData()` hook; decompose tab bodies into dedicated presentation slices in `_components/`.
- **Maintainability Impact**: Decreases view file LOC by $>60\%$; isolates business logic for sub-second headless unit testing.

**Example 2: God Hook State Sprawl**
- **Location**: `src/hooks/useProjectManager.ts` (lines 1–320)
- **Defect Category**: God Hook / Mega-Composable
- **Current Assessment**: Single hook manages project creation, collaborator invitation list, billing status modal, and search filtering.
- **Evidence**: Returns an object with 22 properties; imported by 6 components that each use only 2–3 properties, causing cascading re-renders.
- **Diagnostic Simplification**: Decompose into domain-focused hooks: `useProjectCollaborators`, `useProjectBillingModal`, and `useProjectSearch`.
- **Maintainability Impact**: Prevents cross-domain render thrashing; clarifies state lifecycle boundaries.

---

## Example Invocation

```
Analyse the UI and component architecture of [PROJECT_PATH].
Use the ui-component-analysis module to identify:
- Monolithic page views combining markup with asynchronous mutations
- God hooks and state lifecycle conflation
- Cloned form flows (dual-mode Create vs Edit drift)
- Bespoke widget reinvention lacking accessibility
- Invasive interaction overlays and runaway observer loops

Provide specific file references, line numbers, and metric evidence.
```
