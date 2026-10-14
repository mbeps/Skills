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
