# Tailwind CSS v4 & Biome Formatting Reference

Guide to code formatting options, Prettier parity, Tailwind CSS v4 syntax support, utility class sorting in Biome, and template literal formatting traps.

---

## 1. Prettier Option Mapping to `biome.json`

Biome provides drop-in parity for standard Prettier formatting options:

| Prettier Option (`.prettierrc`) | Biome Property (`biome.json`) | Default |
| :--- | :--- | :--- |
| `printWidth: <int>` | `formatter.lineWidth` | `80` (or `100`) |
| `tabWidth: <int>` | `formatter.indentWidth` | `2` |
| `useTabs: <bool>` | `formatter.indentStyle` | `"space"` \| `"tab"` |
| `semi: <bool>` | `javascript.formatter.semicolons` | `"always"` \| `"asNeeded"` |
| `singleQuote: <bool>` | `javascript.formatter.quoteStyle` | `"double"` \| `"single"` |
| `jsxSingleQuote: <bool>` | `javascript.formatter.jsxQuoteStyle` | `"double"` \| `"single"` |
| `trailingComma: "all"` | `javascript.formatter.trailingCommas` | `"all"` \| `"es5"` \| `"none"` |
| `bracketSpacing: <bool>` | `javascript.formatter.bracketSpacing` | `true` \| `false` |
| `bracketSameLine: <bool>` | `javascript.formatter.bracketSameLine` | `false` \| `true` |
| `arrowParens: "always"` | `javascript.formatter.arrowParentheses` | `"always"` \| `"asNeeded"` |
| `endOfLine: "lf"` | `formatter.lineEnding` | `"lf"` \| `"crlf"` |

---

## 2. Tailwind CSS v4 Support in Biome

Tailwind CSS v4 is **CSS-first** (configured in CSS rather than `tailwind.config.js`).

### CSS-First Directives
```css
/* app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-geist-sans);
  --color-primary: #3b82f6;
}

@utility content-auto {
  content-visibility: auto;
}
```

### Biome Configuration
Enable native Tailwind CSS v4 directive parsing in `biome.json`:

```json
{
  "css": {
    "parser": {
      "tailwindDirectives": true,
      "cssModules": true
    },
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "quoteStyle": "double"
    }
  }
}
```

---

## 3. Tailwind Class Sorting: Biome vs Prettier

### Architectural Difference
- **Prettier (`prettier-plugin-tailwindcss`)**: Implemented as a **formatter plugin**. Runs and reorders classes automatically on every format/save pass.
- **Biome (`nursery.useSortedClasses`)**: Implemented as a **linter rule**. Reorders classes according to canonical Tailwind order during fix passes.

### Why Biome Classifies Class Sorting as an "Unsafe Fix"
1. **Cascade & Specificity Edge Cases**: While HTML class order does not alter CSS specificity, changing token positions in conflicting utility strings (e.g. `p-2 p-4`) can alter developer expectations.
2. **Exact String Comparisons**: Component tests or logic performing `className === "flex items-center"` can break if tokens shift.

Because of this, Biome treats class reordering as an **`unsafe` fix**.

---

## 4. Helper Function Integration (`clsx`, `cva`, `twMerge`, `cn`)

Configure `options.functions` inside `biome.json` to sort classes inside helper function calls:

```json
{
  "linter": {
    "rules": {
      "nursery": {
        "useSortedClasses": {
          "level": "warn",
          "options": {
            "attributes": ["classList", "className", "tw"],
            "functions": ["clsx", "cva", "twMerge", "cn"]
          }
        }
      }
    }
  }
}
```

### Safe vs Unsafe Commands Summary

| Task | Command | Applied Changes |
| :--- | :--- | :--- |
| **Format Only** | `yarn format` (`biome format --write .`) | Indentation, quotes, semicolons, line wraps. |
| **Safe Lint Fix** | `biome check --write .` | Safe fixes + imports organized + formatting. |
| **Full Fix (Includes Class Sorting)** | `yarn lint:fix` (`biome check --write --unsafe .`) | Safe fixes + Tailwind class sorting. |

---

## 5. Template Literal Formatting Traps & Static Extraction

### 5.1 The Multiline Template Literal Collapsing Trap

When Biome formats code, it collapses multiline template string literals in `className` onto a single line to adhere to formatting style rules.

#### The Failure Mode:
If a multiline template literal relied on the newline (`\n`) as the sole whitespace separator between an interpolation and a class name:

```tsx
// BEFORE Formatting:
className={`
  h-${NAVBAR_HEIGHT}
  w-full
  fixed
`}
```

When Biome formats this onto a single line, the newline character is removed:

```tsx
// AFTER Formatting (CORRUPTED):
className={`h-${NAVBAR_HEIGHT}w-full fixed`}
// Evaluates at runtime to: "h-20w-full fixed" (w-full class is lost!)
```

#### Prevention & Fix:
1. **Always include explicit space characters** inside the template literal around all `${...}` interpolations:
   ```tsx
   className={`h-${NAVBAR_HEIGHT} w-full fixed ...`}
   ```
2. **Scan for collapsed interpolations**: Use regex searches to detect accidental collisions:
   - `\$\{[^}]+\}[a-zA-Z0-9_-]` (missing trailing space)
   - `[a-zA-Z0-9_-]\$\{[^}]+\}` (missing leading space)

### 5.2 Dynamic Tailwind Class Extraction Limits

Tailwind CSS v4 (and v3) uses build-time static source scanning to extract class names and generate CSS rules.

- **Broken Pattern**: Constructing utility classes dynamically like `pt-${NAVBAR_HEIGHT}` or `text-${color}`. Tailwind's static parser cannot execute JavaScript, so `pt-20` is omitted from the generated stylesheet unless coincidentally used elsewhere.
- **Recommended Pattern**: Use complete static class names or inline style attributes:
  ```tsx
  // Option A: Complete static class
  className="pt-20"

  // Option B: Inline style for dynamic measurements
  style={{ paddingTop: `${NAVBAR_HEIGHT * 4}px` }}
  ```

### 5.3 Safe Class Composition with `cn()` / `twMerge`

Avoid raw template literal string concatenations for complex conditional classes. Instead, use a centralized `cn` helper combining `clsx` and `tailwind-merge`:

```tsx
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

```tsx
// Usage: Immune to whitespace loss and automatically resolves conflicting classes
className={cn(
  "fixed top-0 z-50 mx-auto w-full px-4 md:px-6 transition-all ease-in-out",
  `h-${NAVBAR_HEIGHT}`,
  scrolled && !isOverlayOpen && "shadow-lg dark:shadow-neutral-800",
  !isOverlayOpen && (scrolled ? "bg-neutral-50/60 backdrop-blur-xl dark:bg-neutral-900/60" : "bg-transparent"),
)}
```
