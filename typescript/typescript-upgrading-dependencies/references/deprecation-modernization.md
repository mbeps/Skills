# Deprecated Code Modernization & Refactoring Reference

This reference catalogs deprecated JavaScript, TypeScript, React, and Next.js APIs, providing modern replacements and guidelines on when refactoring requires user approval.

---

## 1. Deprecated JavaScript & TypeScript APIs

| Deprecated Syntax / API                                     | Modern Replacement                                               | Rationale / Risk                                                                                 |
| :---------------------------------------------------------- | :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `String.prototype.substr(start, length)`                    | `String.prototype.substring(start, end)` or `.slice(start, end)` | `substr` is legacy Annex B JavaScript. Can produce off-by-one errors when refactored carelessly. |
| `escape()` / `unescape()`                                   | `encodeURIComponent()` / `decodeURIComponent()`                  | Removed from modern standards; fails on full UTF-8 code points.                                  |
| `Date.prototype.getYear()`                                  | `Date.prototype.getFullYear()`                                   | Returns year minus 1900; Y2K legacy.                                                             |
| `Number.prototype.toExponential()` (with invalid precision) | Validate precision bounds `[0, 100]` before invocation           | Throws `RangeError` in strict modern engines.                                                    |

---

## 2. Deprecated React & Next.js Patterns

### React 18 / 19 Patterns
- **`defaultProps`**:
  ```tsx
  // ❌ DEPRECATED / REMOVED in React 19
  function Button({ text }: { text?: string }) { return <button>{text}</button>; }
  Button.defaultProps = { text: "Submit" };

  // ✅ MODERN
  function Button({ text = "Submit" }: { text?: string }) {
    return <button>{text}</button>;
  }
  ```

- **`React.FC` implicit `children`**:
  ```tsx
  // ❌ DEPRECATED
  const Card: React.FC = ({ children }) => <div>{children}</div>;

  // ✅ MODERN
  type CardProps = React.PropsWithChildren<{ className?: string }>;
  const Card: React.FC<CardProps> = ({ children, className }) => (
    <div className={className}>{children}</div>
  );
  ```

- **Form State Hooks**:
  ```tsx
  // ❌ DEPRECATED
  import { useFormState } from "react-dom";

  // ✅ MODERN
  import { useActionState } from "react";
  ```

### Next.js Patterns
- **Synchronous Dynamic Route Params (Next.js 15+)**:
  ```tsx
  // ❌ DEPRECATED
  export default function Page({ params }: { params: { slug: string } }) {
    return <h1>{params.slug}</h1>;
  }

  // ✅ MODERN
  export default async function Page({
    params,
  }: {
    params: Promise<{ slug: string }>;
  }) {
    const { slug } = await params;
    return <h1>{slug}</h1>;
  }
  ```

- **Obsolete Font / Router Packages**:
  - Replace `@next/font/*` with `next/font/google` or `next/font/local`.
  - Replace `next/router` with `next/navigation` in App Router components.

---

## 3. Refactoring Approval Protocol

When encountering code that requires changes to work with upgraded dependencies:

```
┌────────────────────────────────────────────────────────┐
│ Is the refactoring minor & localized?                  │
│ (e.g. substr->substring, async params, default props)  │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
           YES                              NO
            │                               │
┌───────────────────────┐       ┌────────────────────────┐
│ Apply modernization   │       │ STOP: Seek User        │
│ automatically         │       │ Approval First         │
└───────────────────────┘       └────────────────────────┘
```

### Automatic Modernization (No Approval Needed)
1. Replacing deprecated standard library methods (`substr`, `unescape`).
2. Updating parameter destructuring to modern default syntax.
3. Updating Next.js route parameter types to Promises (`await params`).
4. Modernizing package import specifiers (e.g. `next/font`).

### Major Refactoring (Approval Required)
1. Migrating state management libraries (e.g., Redux -> Zustand, Jotai).
2. Architectural routing changes (Pages Router to App Router conversions).
3. Replacing or removing third-party libraries that have no drop-in equivalent.
4. Restructuring database access or ORM schemas due to major ORM breaking changes.

