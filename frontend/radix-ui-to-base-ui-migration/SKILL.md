---
skill: migrating-radix-to-base-ui 
version: 1.0.0 
frameworks: [React, Shadcn UI, Base UI, Tailwind CSS v4] 
last_updated: 2026-02-23
---

# Migrating Radix UI to Base UI in Shadcn UI with Tailwind CSS v4

The frontend development ecosystem has undergone a significant paradigm shift with the simultaneous release of **Base UI** and **Tailwind CSS v4**. Base UI, engineered by the identical fundamental engineering team responsible for Radix UI, represents a comprehensive architectural evolution deliberately designed to address the accumulated technical debt, accessibility constraints, and composition limitations of its predecessor.

While Radix UI successfully established the industry standard for unstyled, highly accessible React components, Base UI refines this methodological approach by introducing a substantially more deterministic composition model, highly sophisticated state-driven styling hooks, and enhanced performance metrics that align seamlessly with modern React server-side rendering paradigms.

Concurrently, the transition from **Tailwind CSS v3 to v4** introduces the high-performance **Oxide engine**, fundamentally shifting the utility-first framework from a legacy JavaScript-based configuration model toward an ultra-fast, native CSS-first architecture that leverages cutting-edge web platform capabilities such as cascade layers, registered custom properties, and native container queries.

Within the specific context of the **Shadcn UI** ecosystem, executing a migration from Radix UI to Base UI—coupled inextricably with the Tailwind v4 upgrade—requires a meticulous, systematic understanding of underlying application programming interface (API) modifications. The most critical conceptual departure involves the total deprecation of the Radix `asChild` prop in favour of the highly versatile Base UI `render` prop.

---

## 1. Quick Start

Execute the following imperative procedures to immediately initialise a modernised Shadcn UI environment leveraging Base UI unstyled primitives, React 19 standards, and the Tailwind CSS v4 styling engine.

### Purge Legacy Configurations

Delete the obsolete `tailwind.config.ts` (or `.js`) and `postcss.config.js` files from the project root directory, as Tailwind v4 functions entirely without these legacy abstractions.

### Resolve Core Dependencies

Execute your package manager to install the modernised Tailwind v4 compiler alongside the updated animation module, while explicitly removing legacy PostCSS processors and outdated animation plugins.

```bash
pnpm add tailwindcss @tailwindcss/vite
pnpm add -D @types/node tw-animate-css
pnpm remove tailwindcss-animate postcss-import autoprefixer

```

### Establish Framework Integration

Modify the `vite.config.ts` (or Next.js equivalent) to consume the dedicated `@tailwindcss/vite` plugin, entirely replacing the legacy PostCSS pipeline to unlock microsecond incremental build velocities.

### Configure the Shadcn Component Registry

Update the `components.json` manifest to explicitly target the `base-vega` style trajectory. Ensure the `tailwind.config` mapping remains strictly empty, and declare `cssVariables: true` to support the dynamic state attributes required by Base UI.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-vega",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}

```

### Execute the Registry Migration

Run the Shadcn CLI to fetch and overwrite the local component library with the modernised Base UI implementations, ensuring all internal dependencies are automatically resolved.

```bash
pnpm dlx shadcn@latest add --all --overwrite

```

---

## 2. Instructions

The comprehensive migration process mandates a deep structural understanding of two distinct architectural transitions.

### Step 1: Execute Component Architecture Refactoring

Refactor all component instances to utilise the Base UI `render` prop methodology, systematically abandoning the legacy Radix UI `asChild` composition pattern.

* **Identify** all component declarations within the `src/components/ui` directory that import the `@radix-ui/react-slot` dependency.
* **Remove** the `asChild` boolean parameter from the component props interface.
* **Implement** the `useRender` hook from `@base-ui/react/use-render`.
* **Configure** the `useRender` options object by supplying a `defaultTagName` (e.g., 'button', 'div'), passing the consumer-provided render element (or callback function), and injecting the component's aggregate props and internal state.

> **Note:** Base UI intelligently merges the component's default properties with the properties of the injected element using an internal `mergeProps` utility. This guarantees that event handlers are chained sequentially and className strings are concatenated safely.

### Step 2: Implement State-Driven Styling Hooks

Refactor legacy state selectors to consume Base UI's advanced data attributes. Base UI introduces highly sophisticated lifecycle attributes engineered to interface with modern CSS specifications, including Tailwind v4's native `@starting-style` support.

* **Scan** all custom styling definitions for legacy Radix keyword prefixes (e.g., `data-[state=open]`, `.radix-state-active`).
* **Replace** legacy state selectors with exact Base UI state attributes (e.g., `[data-checked]` and `[data-unchecked]`).
* **Implement** native hardware-accelerated animations by targeting `data-[starting-style]` and `data-[ending-style]` to execute performant enter and exit transitions entirely through the CSS cascade.

### Step 3: Architect the CSS-First Styling Engine

Transition the application's global styling layer to Tailwind CSS v4's CSS-first configuration model. All theme customisations must be defined directly within the primary stylesheet using the `@theme` directive.

* **Establish** the raw design token colour values within a standard `:root` block at the top of `src/index.css`. Transition from legacy `hsl()` formulations to modern `oklch()` spaces for superior lightness predictability.
* **Utilise** the `@theme inline` directive to map these root CSS variables to Tailwind's internal utility mapping.
* **Apply** base foundational styles within a standard `@layer base` block.

---

### Comparison Matrix

| Feature Mechanism | Legacy Tailwind v3 / Radix UI Paradigm | Modern Tailwind v4 / Base UI Paradigm | Architectural Rationale |
| --- | --- | --- | --- |
| **Component Composition** | `asChild` boolean prop with `Slot` component. | `render` prop with `useRender` hook. | Eliminates prop-drilling fragility; enables direct access to internal state. |
| **Styling Configuration** | JavaScript-based `tailwind.config.ts`. | CSS-first `@theme` and `@theme inline` directives. | Unlocks the high-performance Oxide compiler; consolidates tokens. |
| **Animation Handling** | `tailwindcss-animate` dependency. | Native `@starting-style` CSS and `tw-animate-css`. | Bypasses JS execution thread for buttery-smooth 60fps transitions. |
| **Positioning Engine** | Radix internal proprietary calculation logic. | Floating UI (`@floating-ui/react`) integration. | Standardises spatial calculations; resolves collision anomalies. |
| **Colour Spatial Models** | HSL (Hue, Saturation, Lightness) strings. | OKLCH (Lightness, Chroma, Hue) functions. | Delivers perceptually uniform gradients; supports P3 wide-gamut. |

---

## 3. Examples

### Example 1: Button Composition Refactoring

**Input (Legacy Radix UI):**

```typescript
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn("inline-flex items-center...", className)} ref={ref} {...props} />
    );
  }
);
// Usage
<Button asChild><Link href="/dashboard">Dashboard</Link></Button>

```

**Output (Modern Base UI):**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  render?: React.ReactElement | ((props: any, state: any) => React.ReactElement);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, render, ...props }, forwardedRef) => {
    return useRender({
      defaultTagName: "button",
      render,
      props: { className: cn("inline-flex items-center...", className), ...props },
      ref: forwardedRef // Simplified for React 19
    });
  }
);
// Usage
<Button render={<Link href="/dashboard" />}>Dashboard</Button>

```

### Example 2: Popover with Lifecycle Attributes

```typescript
export function ContextualMenuPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger className="data-[popup-open]:bg-slate-100">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="transition-[transform,opacity] data-[ending-style]:scale-95 data-[starting-style]:opacity-0">
            System Preferences
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

```

### Example 3: CSS-First Configuration

```css
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --radius: 0.5rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --radius-lg: var(--radius);
}

```

---

## 4. Workflows

### Phase 1: Atomic Component Migration

Target isolated components (Button, Badge, Skeleton) first. Purge `asChild`, implement `useRender`, and update data attributes.

### Phase 2: Composite Component Migration

Progress to Dialog, Popover, and Select.

* **Overlay Stacking:** Ensure `.root { isolation: isolate; }` is in your CSS to prevent z-index collisions.
* **Strict Structures:** ToggleGroup now mandates mathematical arrays for `value` when `multiple` is true.

### Phase 3: Secondary Mitigation

Audit custom business components that wrap primitives. Ensure they correctly implement the `render` prop rather than blindly passing `asChild`. Implement `@floating-ui/react` for bespoke positioning logic.

### Phase 4: Global Cleanup

Uninstall legacy Radix packages:
`pnpm uninstall @radix-ui/react-accordion @radix-ui/react-dialog @radix-ui/react-checkbox`.

---

## 5. Edge Cases

| Architectural Edge Case | Trigger Condition | Technical Ramification | Required Resolution |
| --- | --- | --- | --- |
| **RSC Boundary Violations** | Callback variant of `render` in a Server Component. | Next.js build failure; functions aren't serializable. | Use "use client" or pass a standard JSX element. |
| **RTL Animation Failures** | Dynamic mounting of Portals in RTL locales. | Animation inversion (sliding from wrong side). | Explicitly inject `dir="rtl"` into the Portal component. |
| **iOS 26 Viewport Clipping** | Mobile Safari scrolling with `position: fixed` backdrops. | Visual clipping near the browser chrome. | Use `body { position: relative; }` and `position: absolute` for backdrops. |
| **DOM Reference Loss** | `useRender` without array-based ref merging in React 18. | Breakdown of focus trapping and spatial calculations. | Supply `ref: [forwardedRef, internalRef]` to `useRender`. |

---

## 6. References

* [https://base-ui.com/react/utils/use-render](https://base-ui.com/react/utils/use-render)
* [https://github.com/shadcn-ui/ui/discussions/9562](https://github.com/shadcn-ui/ui/discussions/9562)
* [https://www.youtube.com/watch?v=lzG7Ojx_aH0](https://www.youtube.com/watch?v=lzG7Ojx_aH0)
* [https://github.com/shadcn-ui/ui/discussions/6248](https://github.com/shadcn-ui/ui/discussions/6248)
* [https://www.reddit.com/r/reactjs/comments/1pk18v9/base_ui_10_released/](https://www.reddit.com/r/reactjs/comments/1pk18v9/base_ui_10_released/)
* [https://www.oreateai.com/blog/base-ui-vs-radix-unpacking-the-unstyled-component-landscape/19c381509fe85f4d10c60d43c2a1aa1a](https://www.oreateai.com/blog/base-ui-vs-radix-unpacking-the-unstyled-component-landscape/19c381509fe85f4d10c60d43c2a1aa1a)
* [https://certificates.dev/blog/starting-a-react-project-shadcnui-radix-and-base-ui-explained](https://certificates.dev/blog/starting-a-react-project-shadcnui-radix-and-base-ui-explained)
* [https://shadcnstudio.com/blog/base-ui-vs-radix-ui](https://shadcnstudio.com/blog/base-ui-vs-radix-ui)
* [https://www.reddit.com/r/reactjs/comments/1r1vk3z/radix_ui_vs_base_ui_detailed_comparison/](https://www.reddit.com/r/reactjs/comments/1r1vk3z/radix_ui_vs_base_ui_detailed_comparison/)
* [https://base-ui.com/react/handbook/styling](https://base-ui.com/react/handbook/styling)
* [https://tailwindcss.com/docs/adding-custom-styles](https://tailwindcss.com/docs/adding-custom-styles)
* [https://tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4)
* [https://base-ui.com/react/overview/quick-start](https://base-ui.com/react/overview/quick-start)
* [https://www.youtube.com/watch?v=6biMWgD6_JY](https://www.youtube.com/watch?v=6biMWgD6_JY)
* [https://ui.shadcn.com/docs/changelog/2026-01-base-ui](https://ui.shadcn.com/docs/changelog/2026-01-base-ui)
* [https://ui.shadcn.com/docs/installation](https://ui.shadcn.com/docs/installation)
* [https://ui.shadcn.com/docs/installation/manual](https://ui.shadcn.com/docs/installation/manual)
* [https://ui.shadcn.com/create?base=base](https://ui.shadcn.com/create?base=base)
* [https://www.youtube.com/watch?v=bao8Fu13IP8](https://www.youtube.com/watch?v=bao8Fu13IP8)
* [https://tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide)
* [https://designrevision.com/blog/tailwind-4-migration](https://designrevision.com/blog/tailwind-4-migration)
* [https://www.digitalapplied.com/blog/tailwind-css-v4-migration-new-features-guide](https://www.digitalapplied.com/blog/tailwind-css-v4-migration-new-features-guide)
* [https://github.com/tailwindlabs/tailwindcss/discussions/18545](https://github.com/tailwindlabs/tailwindcss/discussions/18545)
* [https://ui.shadcn.com/docs/components/dialog](https://ui.shadcn.com/docs/components/dialog)
* [https://ui.shadcn.com/docs/components/base/sheet](https://ui.shadcn.com/docs/components/base/sheet)
* [https://shadcnstudio.com/docs/components/dialog](https://shadcnstudio.com/docs/components/dialog)
* [https://github.com/shadcn-ui/ui](https://github.com/shadcn-ui/ui)
* [https://ui.shadcn.com/docs/components/radix/checkbox](https://ui.shadcn.com/docs/components/radix/checkbox)
* [https://shadcnstudio.com/docs/components/checkbox](https://shadcnstudio.com/docs/components/checkbox)
* [https://allshadcn.com/components/category/checkbox/](https://allshadcn.com/components/category/checkbox/)
* [https://github.com/shadcn-ui/ui/issues/9249](https://github.com/shadcn-ui/ui/issues/9249)
* [https://ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components)
* [https://ui.shadcn.com/docs/components/base/popover](https://ui.shadcn.com/docs/components/base/popover)
* [https://ui.shadcn.com/docs/components/popover](https://ui.shadcn.com/docs/components/popover)
* [https://shadcnstudio.com/docs/components/popover](https://shadcnstudio.com/docs/components/popover)
* [https://www.shadcn.io/ui/popover](https://www.shadcn.io/ui/popover)
* [https://github.com/radix-ui/primitives/discussions/2705](https://github.com/radix-ui/primitives/discussions/2705)
* [https://ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4)
* [https://www.shadcn-svelte.com/docs/migration/tailwind-v4](https://www.shadcn-svelte.com/docs/migration/tailwind-v4)
* [https://tessl.io/skills/github/jezweb/claude-skills/tailwind-v4-shadcn](https://tessl.io/skills/github/jezweb/claude-skills/tailwind-v4-shadcn)
* [https://www.shadcnblocks.com/blog/tailwind4-shadcn-themeing/](https://www.shadcnblocks.com/blog/tailwind4-shadcn-themeing/)
* [https://github.com/shadcn-ui/ui/discussions/2996](https://github.com/shadcn-ui/ui/discussions/2996)
* [https://ui.shadcn.com/docs/components/base/item](https://ui.shadcn.com/docs/components/base/item)
* [https://www.reddit.com/r/shadcn/comments/1qz8l01/base_ui_render_prop_vs_shadcnradix_aschild_in/](https://www.reddit.com/r/shadcn/comments/1qz8l01/base_ui_render_prop_vs_shadcnradix_aschild_in/)
* [https://ui.shadcn.com/docs/components-json](https://ui.shadcn.com/docs/components-json)
* [https://github.com/area44/astro-shadcn-ui-template/blob/main/components.json](https://github.com/area44/astro-shadcn-ui-template/blob/main/components.json)
* [https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create)
* [https://github.com/yluiop123/vite-shadcn/blob/main/components.json](https://github.com/yluiop123/vite-shadcn/blob/main/components.json)
* [https://ui.shadcn.com/docs/changelog](https://ui.shadcn.com/docs/changelog)
* [https://stackoverflow.com/questions/79705933/should-i-use-theme-or-theme-inline](https://stackoverflow.com/questions/79705933/should-i-use-theme-or-theme-inline)
* [https://ui.shadcn.com/docs/theming](https://ui.shadcn.com/docs/theming)
* [https://github.com/shadcn-ui/ui/discussions/6714](https://github.com/shadcn-ui/ui/discussions/6714)
* [https://ui.shadcn.com/docs/components/radix/alert-dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog)
* [https://github.com/shadcn-ui/ui/discussions/4034](https://github.com/shadcn-ui/ui/discussions/4034)
* [https://ui.shadcn.com/docs/components/base/button](https://ui.shadcn.com/docs/components/base/button)
* [https://ui.shadcn.com/docs/components/button](https://ui.shadcn.com/docs/components/button)
* [https://www.shadcn.io/ui/button](https://www.shadcn.io/ui/button)
* [https://github.com/shadcn-ui/ui/discussions/9590](https://github.com/shadcn-ui/ui/discussions/9590)
* [https://github.com/shadcn-ui/taxonomy/blob/main/components/ui/checkbox.tsx](https://github.com/shadcn-ui/taxonomy/blob/main/components/ui/checkbox.tsx)
* [https://ui.shadcn.com/docs/registry/examples](https://ui.shadcn.com/docs/registry/examples)
* [https://www.shadcnblocks.com/components/dialog](https://www.shadcnblocks.com/components/dialog)

---

Would you like me to generate a specific component refactor for a more complex primitive, like a multi-select Dropdown or a Command menu?

By the way, to unlock the full functionality of all Apps, enable [Gemini Apps Activity](https://myactivity.google.com/product/gemini).
