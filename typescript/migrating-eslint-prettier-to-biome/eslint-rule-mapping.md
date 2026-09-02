# ESLint to Biome Migration & Rule Mapping Reference

Complete mapping tables translating `eslint-config-next`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `@typescript-eslint` rules to Biome equivalents, along with inline suppression comment syntax conversion.

---

## 1. Migration CLI Command

Biome provides an automated tool to translate existing `.eslintrc` or `eslint.config.*` files into `biome.json`:

```bash
# Migrate ESLint configuration
npx @biomejs/biome migrate eslint --write

# Migrate Prettier configuration
npx @biomejs/biome migrate prettier --write
```

---

## 2. Next.js Rule Mappings (`eslint-config-next` / `@next/next/*`)

Biome implements Next.js best practices either natively via `linter.domains.next: "recommended"` or as standalone linter rules.

| ESLint Rule (`@next/next/*`)            | Biome Rule                                          | Category               | Notes / Equivalent Behavior                                          |
| :-------------------------------------- | :-------------------------------------------------- | :--------------------- | :------------------------------------------------------------------- |
| `@next/next/no-img-element`             | `a11y/noImgElement` or domain `next`                | `performance` / `a11y` | Enforces use of `next/image` over raw `<img>`.                       |
| `@next/next/no-head-element`            | `correctness/noHeadElement` or domain `next`        | `correctness`          | Disallows `<head>` tag in favor of `next/head` or Metadata API.      |
| `@next/next/no-html-link-for-pages`     | `correctness/noHtmlLinkForPages` or domain `next`   | `correctness`          | Enforces `next/link` instead of raw `<a>` tags for internal routes.  |
| `@next/next/no-sync-scripts`            | `correctness/noSyncScripts` or domain `next`        | `correctness`          | Disallows synchronous `<script>` tags without `async`/`defer`.       |
| `@next/next/no-unwanted-polyfillio`     | `correctness/noUnwantedPolyfillio` or domain `next` | `correctness`          | Flags redundant Polyfill.io scripts for features supported natively. |
| `@next/next/google-font-display`        | `correctness/useGoogleFontDisplay`                  | `correctness`          | Enforces `display=optional` or `display=swap` on Google Fonts.       |
| `@next/next/google-font-preconnect`     | `correctness/useGoogleFontPreconnect`               | `correctness`          | Enforces `preconnect` with Google Fonts domains.                     |
| `@next/next/no-document-import-in-page` | `correctness/noDocumentImportInPage`                | `correctness`          | Flags `next/document` imports outside `_document.js`.                |
| `@next/next/no-head-import-in-document` | `correctness/noHeadImportInDocument`                | `correctness`          | Flags `next/head` imports inside `_document.js`.                     |
| `@next/next/inline-script-id`           | `correctness/useInlineScriptId`                     | `correctness`          | Enforces `id` attribute on `next/script` inline components.          |

---

## 3. React & React Hooks Rule Mappings

### 3.1 `eslint-plugin-react-hooks`

| ESLint Rule                   | Biome Rule                  | Group         | React 19 Details                                                                                                                                                                                                                                                      |
| :---------------------------- | :-------------------------- | :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-hooks/rules-of-hooks`  | `useHookAtTopLevel`         | `correctness` | **React 19 `use()` Hook**: Unlike traditional hooks (`useState`, `useEffect`), React 19's `use()` hook can be called conditionally or within loops. Biome natively handles `use()` semantics so it is not incorrectly flagged when called inside control flow blocks. |
| `react-hooks/exhaustive-deps` | `useExhaustiveDependencies` | `correctness` | Validates dependencies of `useEffect`, `useCallback`, `useMemo`, `useLayoutEffect`.                                                                                                                                                                                   |

### 3.2 `eslint-plugin-react`

| ESLint Rule (`react/*`)               | Biome Rule                   | Group         | Description                                                                                                              |
| :------------------------------------ | :--------------------------- | :------------ | :----------------------------------------------------------------------------------------------------------------------- |
| `react/jsx-key`                       | `useJsxKeyInIterable`        | `correctness` | Enforces `key` prop on iterable items in JSX arrays.                                                                     |
| `react/no-children-prop`              | `noChildrenProp`             | `correctness` | Disallows passing `children` as a prop directly (`<Comp children={...} />`).                                             |
| `react/no-danger-with-children`       | `noDangerWithChildren`       | `correctness` | Disallows simultaneous use of `children` and `dangerouslySetInnerHTML`.                                                  |
| `react/no-render-return-value`        | `noRenderReturnValue`        | `correctness` | Disallows capturing return value of `ReactDOM.render()`.                                                                 |
| `react/no-string-refs`                | `noStringRefs`               | `correctness` | Disallows deprecated string refs.                                                                                        |
| `react/no-unescaped-entities`         | *None (Allowed by default)*  | `N/A`         | Biome allows unescaped entities by default. Do not add `noUnescapedEntities` to `biome.json` (causes unknown key error). |
| `react/void-dom-elements-no-children` | `noVoidElementsWithChildren` | `correctness` | Disallows children in void tags (`<br>`, `<img>`, `<input>`).                                                            |
| `react/jsx-no-duplicate-props`        | `noDuplicateJsxProps`        | `correctness` | Flags duplicate attributes on JSX elements.                                                                              |
| `react/jsx-no-target-blank`           | `noBlankTarget`              | `a11y`        | Enforces `rel="noreferrer"` on `target="_blank"` links.                                                                  |
| `react/jsx-no-useless-fragment`       | `noUselessFragments`         | `complexity`  | Eliminates redundant `<>...</>` wrappers.                                                                                |
| `react/self-closing-comp`             | `useSelfClosingElements`     | `style`       | Enforces self-closing tags for components without children.                                                              |
| `react/no-array-index-key`            | `noArrayIndexKey`            | `suspicious`  | Disallows array indices as React `key` props.                                                                            |
| `react/button-has-type`               | `useButtonType`              | `a11y`        | Enforces explicit `type="button" \| "submit" \| "reset"` on `<button>`.                                                  |
| `react/no-danger`                     | `noDangerouslySetInnerHtml`  | `security`    | Flags unsafe `dangerouslySetInnerHTML` usage.                                                                            |

---

## 4. General JavaScript & Core Rule Mappings

| ESLint Rule             | Biome Rule                  | Group         | Notes & Caveats                                                                                                                                                                                                                                                                                         |
| :---------------------- | :-------------------------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prefer-arrow-callback` | `useArrowFunction`          | `complexity`  | **Constructor Mock Caveat**: Arrow functions `() => {}` lack a `[[Construct]]` slot and throw `TypeError: ... is not a constructor` when instantiated with `new` in test mocks (e.g. `new S3Client(...)`, `new ServerClient(...)`). Set `"complexity": { "useArrowFunction": "off" }` or use overrides. |
| `no-dupe-keys`          | `noDuplicateObjectKeys`     | `suspicious`  | Flags duplicate properties in object literals and JSON keys.                                                                                                                                                                                                                                            |
| `no-unused-vars`        | `noUnusedVariables`         | `correctness` | Flags unused variable declarations. Prefix with `_` or remove.                                                                                                                                                                                                                                          |
| `array-callback-return` | `useIterableCallbackReturn` | `suspicious`  | Flags `.forEach()` callbacks returning values (e.g. concise arrow `forEach(x => map.set(x))`). Wrap body in braces `{ ... }`.                                                                                                                                                                           |

---

## 5. TypeScript Rule Mappings (`@typescript-eslint/*`)

| ESLint Rule (`@typescript-eslint/*`)             | Biome Rule                | Group         | Notes                                                    |
| :----------------------------------------------- | :------------------------ | :------------ | :------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`             | `noExplicitAny`           | `suspicious`  | Flags untyped `any` annotations.                         |
| `@typescript-eslint/no-unused-vars`              | `noUnusedVariables`       | `correctness` | Flags unused variable declarations.                      |
| `@typescript-eslint/no-non-null-assertion`       | `noNonNullAssertion`      | `style`       | Flags `!` non-null assertion operator.                   |
| `@typescript-eslint/consistent-type-imports`     | `useImportType`           | `style`       | Enforces `import type { T }` syntax.                     |
| `@typescript-eslint/consistent-type-exports`     | `useExportType`           | `style`       | Enforces `export type { T }` syntax.                     |
| `@typescript-eslint/no-empty-interface`          | `noEmptyInterface`        | `suspicious`  | Flags empty `interface Foo {}` declarations.             |
| `@typescript-eslint/no-inferrable-types`         | `noInferrableTypes`       | `style`       | Disallows explicit types on initialized literals.        |
| `@typescript-eslint/prefer-as-const`             | `useAsConst`              | `style`       | Enforces `as const` instead of literal type assertions.  |
| `@typescript-eslint/prefer-for-of`               | `useForOf`                | `complexity`  | Suggests `for..of` over traditional indexed `for` loops. |
| `@typescript-eslint/prefer-optional-chain`       | `useOptionalChain`        | `complexity`  | Enforces `a?.b` over `a && a.b`.                         |
| `@typescript-eslint/no-duplicate-enum-values`    | `noDuplicateEnumValues`   | `suspicious`  | Flags duplicate values in TypeScript enums.              |
| `@typescript-eslint/no-extra-non-null-assertion` | `noExtraNonNullAssertion` | `suspicious`  | Flags redundant `x!!!.y` assertions.                     |

---

## 6. Suppression Comment Translation Guide

Biome uses strict, structured suppression comments placed directly before the statement:

```typescript
// biome-ignore <GROUP>/<RULE>: <MANDATORY_EXPLANATION_REASON>
// biome-ignore lint/<GROUP>/<RULE>: <MANDATORY_EXPLANATION_REASON>
// biome-ignore format: <MANDATORY_EXPLANATION_REASON>
```

### Side-by-Side Examples

#### Rule Suppression

**Before (ESLint):**
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyPayload: any = fetchLegacyData();

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  window.scroll(0, 0);
}, [pathname]);
```

**After (Biome):**
```typescript
// biome-ignore lint/suspicious/noExplicitAny: third-party API does not export TypeScript types
const legacyPayload: any = fetchLegacyData();

// biome-ignore lint/correctness/useExhaustiveDependencies: Scroll reset triggers on pathname transitions
useEffect(() => {
  window.scroll(0, 0);
}, [pathname]);
```

#### Disabling Formatter for a Block

**Before (Prettier):**
```typescript
// prettier-ignore
const matrix = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1
];
```

**After (Biome):**
```typescript
// biome-ignore format: preserve 3x3 identity matrix layout
const matrix = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1
];
```

#### JSX Attribute-Level Suppressions

For rules targeting specific JSX attributes (such as `lint/security/noDangerouslySetInnerHtml`), place the suppression comment **inside the JSX element directly preceding the attribute**, rather than above the element tag:

```tsx
// ❌ WRONG: triggers suppressions/unused and fails lint
// biome-ignore lint/security/noDangerouslySetInnerHtml: theme styles
<style dangerouslySetInnerHTML={{ __html: themeCss }} />

// ✅ CORRECT: comment precedes the attribute directly
<style
  // biome-ignore lint/security/noDangerouslySetInnerHtml: theme styles
  dangerouslySetInnerHTML={{ __html: themeCss }}
/>
```

---

## 7. Strict Suppression Validation (`suppressions/unused`)

Biome validates suppression comments strictly:
- If a `// biome-ignore` comment is present on code that does not trigger a diagnostic (e.g. because the rule is disabled via `biome.json`, overridden for test files, or resolved by auto-fix), Biome raises an error: `suppressions/unused: Suppression comment has no effect.`
- **Action**: Do not keep legacy suppression comments for rules disabled in configuration or test overrides. Delete unused suppressions.

