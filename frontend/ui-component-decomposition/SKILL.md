---
name: ui-component-decomposition
description: Use when auditing frontend codebases, identifying UI extraction candidates, decomposing monolithic pages, or refactoring inline JSX into modular components
---

# UI Component Decomposition

## Overview

Monolithic pages and views mix data fetching, complex state management, form validation, nested dialogs, and deep JSX trees. **UI Component Decomposition** is the systematic methodology for auditing a codebase to identify inline UI elements that should be extracted into isolated, reusable, and testable components.

---

## When to Use

- When reviewing codebase architecture to identify refactoring opportunities.
- When page files exceed ~250–300 lines of code with embedded forms, lists, or tabs.
- When multiple views duplicate similar UI structures (e.g., Danger Zones, Stats Cards, File Uploaders).
- When complex inline forms or multi-mode widgets (e.g., view vs. edit states) clutter parent page logic.
- When preparing to test UI behavior in isolation with unit tests.

### When NOT to Use
- Do not extract trivial single-use JSX blocks (< 20 LOC) that have no independent state or logic (avoid premature abstraction).
- Do not create components that require excessive prop drilling without providing reuse or separation of concerns.

---

## Extraction Heuristics & Detection Signals

Scan views, routes, and page files for the following structural signals:

```
                  ┌─────────────────────────────────┐
                  │ Monolithic Page / View Analysis │
                  └────────────────┬────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│ Inline Forms │            │  Tab Content │            │ Shared UI    │
│ & Editors    │            │  Bodies      │            │ Patterns     │
└──────┬───────┘            └──────┬───────┘            └──────┬───────┘
       │                           │                           │
       ▼                           ▼                           ▼
Extract Form Component      Extract Tab Component       Extract Shared Widget
(e.g., CreateSkillForm)     (e.g., AssistantToolsTab)   (e.g., DangerZoneCard)
```

| Signal | Threshold / Indicator | Recommended Component Extraction |
|---|---|---|
| **High LOC Page** | Page file > 300 LOC containing multiple distinct UI sections | Extract top-level sections / tabs into dedicated components |
| **Inline Form / Validation** | `useForm`, zod schemas, and input fields inside page component | Extract into a dedicated `*Form` component with typed submit callbacks |
| **Complex Tab Content** | `<TabsContent>` or `<SidebarTabsContent>` with > 40 LOC inside | Extract into a dedicated `*Tab` component (e.g. `AssistantSettingsTab`) |
| **Inline File Uploader / Dropzone** | Drag-and-drop state, file input ref, upload progress UI | Extract into a dedicated `*Uploader` or `*Dropzone` component |
| **Multi-Mode Item Cards** | Inline card with toggling view/edit states and local actions | Extract into `*Card` and `*Manager` components |
| **Cross-Page Duplication** | Same structural card or dialog in 2+ pages (e.g., Danger Zone) | Extract into `components/shared/*` with generic props |
| **Metric / Stat Cards** | Grid of summary cards calculating counts, index status, etc. | Extract into `*StatsCards` or `*Overview` component |

---

## Step-by-Step Audit Methodology

### Step 1: Inventory Route & Page Files
Locate all top-level page components and views across the application:
- Next.js App Router: `app/**/page.tsx`
- React Router / SPA: `src/pages/**/*.tsx` or `src/views/**/*.tsx`

### Step 2: Complexity & LOC Ranking
Sort page files by line count to prioritize high-complexity files:
```bash
wc -l app/**/page.tsx | sort -nr
```
Target files with > 250 lines first.

### Step 3: Segment by Concern & View Hierarchy
For each target file, inspect the JSX return tree and identify:
1. **Tabs / Navigation Sections**: Does each tab contain its own form, table, or list?
2. **Action Modals & Dialogs**: Are dialogs embedded inline rather than separated into dedicated dialog or inline editing components?
3. **List Managers & Item Cards**: Does the page manage array items inline with nested modals/editors?
4. **Header / Summary Metrics**: Are metric calculation cards crowding the main layout?

### Step 4: Detect Cross-Page Structural Duplication
Search across the codebase for repeated UI blocks:
- Danger zone / delete confirmation blocks
- Breadcrumbs / headers
- Empty state wrappers
- File attachment badges / lists

### Step 5: Define Component Specifications
For each identified candidate, document:
- **Component Name**: Clear, PascalCase noun phrase (e.g., `KbStatsCards`, `SkillBundleUploader`).
- **Target File Path**: Co-located in domain folder (e.g., `components/skill/`, `components/knowledgebase/`).
- **Extracted Responsibilities**: Exact state, handlers, and markup being isolated.
- **Component Props Contract**: Minimal required input props and action callbacks.

---

## Component Extraction Patterns

### 1. Tab Content Decomposition
**Before (Monolithic Page):**
```tsx
export default function AssistantPage() {
  return (
    <SidebarTabs value={tab}>
      <SidebarTabsContent value="tools">
        {/* 60 lines of tool picker, toggle handlers, bulk selection, save button */}
      </SidebarTabsContent>
    </SidebarTabs>
  );
}
```

**After (Clean Page + Dedicated Tab Component):**
```tsx
// components/assistant/assistant-tools-tab.tsx
export function AssistantToolsTab({ mcpServers, selectedTools, onToggleTool, onSave, isSaving }: AssistantToolsTabProps) { ... }

// app/assistants/[id]/page.tsx
<SidebarTabsContent value="tools">
  <AssistantToolsTab
    mcpServers={mcpServers}
    selectedTools={selectedTools}
    onToggleTool={handleToggleTool}
    onSave={handleSaveTools}
    isSaving={saving}
  />
</SidebarTabsContent>
```

### 2. Inline Card vs. Manager Pattern (List Management)
When managing a list of items with create/edit/delete actions:
- **`*Manager`**: Handles the list container, empty state, "Add Item" button, and draft item state.
- **`*Card`**: Handles individual item rendering, inline toggle between read-only view and interactive edit mode.

### 3. Shared Cross-Cutting Widgets
When identical structures appear in multiple pages (e.g. Danger Zones):
```tsx
// components/shared/danger-zone-card.tsx
export interface DangerZoneCardProps {
  title?: string;
  description: string;
  onDelete: () => Promise<void> | void;
  isDeleting?: boolean;
}
```

---

## Audit Output Format

When providing recommendations to a user or planning a refactor, format the findings using this structured template:

```markdown
### [Feature / Area Name] (`path/to/page.tsx` - X lines)

1. **`ComponentName`** (`components/domain/component-name.tsx`)
   - **Target Lines**: Lines X–Y in `path/to/page.tsx`
   - **Purpose**: Brief description of what is encapsulated.
   - **State / Logic Extracted**: Form state, validation, handlers, or local state.
   - **Props Contract**: `{ prop1, prop2, onAction }`

2. **`SecondComponentName`** (`components/domain/second-component-name.tsx`)
   ...
```

---

## Common Mistakes to Avoid

| Mistake | Impact | Correct Approach |
|---|---|---|
| **Over-Extraction** | Extracting 5-line static wrappers creates file bloat and indirection. | Only extract when there is distinct state, form validation, significant markup (> 30 LOC), or reuse. |
| **Prop Explosion** | Passing 15+ props to a child component. | Bundle related parameters into domain objects or co-locate state closer to the child component. |
| **Breaking React 19 State Invariants** | Using `useEffect` to sync props to local state in extracted components. | Initialize local state from initial props or use unique `key` props to reset component state on change. |
| **Leaking Server-Only Code to Client** | Importing server actions or server modules into pure UI presentation components. | Pass action callbacks down as props or keep server action triggers clean. |

