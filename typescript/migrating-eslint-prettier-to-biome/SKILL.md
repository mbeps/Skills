---
name: migrating-eslint-prettier-to-biome
description: Use when migrating a JavaScript, TypeScript, React, or Next.js project from ESLint and Prettier to Biome — removing legacy ESLint packages, configuring biome.json, unblocking TypeScript 7 Go compiler upgrades, setting up Tailwind CSS v4 class sorting, translating suppression comments, or configuring GitHub Actions CI.
---

# Migrating from ESLint & Prettier to Biome

## Overview

A unified guide for replacing ESLint, Prettier, and related plugins with **Biome** across TypeScript, React, and Next.js projects. Removing ESLint eliminates dependencies on legacy Node.js compiler APIs, unblocking native **TypeScript 7** adoption while delivering sub-second linting and formatting.

## When to Use

Use when:
- Replacing `eslint`, `prettier`, `eslint-config-next`, `@typescript-eslint/*`, or `prettier-plugin-tailwindcss` with Biome.
- Upgrading to **TypeScript 7.0+** when `@typescript-eslint` or ESLint flat configs block the Go-native compiler due to dropped JS programmatic APIs.
- Setting up or migrating `biome.json` (versions 1.9 through 2.5+) with Next.js and React domains.
- Configuring Tailwind CSS v4 directive parsing and class sorting (`useSortedClasses`).
- Converting `// eslint-disable-next-line` comments to `// biome-ignore <group>/<rule>: <reason>`.
- Updating CI/CD workflows to `biome ci` or configuring VS Code settings for Biome format-on-save.

**When NOT to use:**
- Projects with custom ESLint rules or proprietary AST plugins that have no equivalent in Biome and cannot be represented with built-in rules.

## Migration Workflow

1. **Audit & Baseline**: Run existing test, lint, and build commands to verify a passing baseline.
2. **Uninstall Legacy Tooling**: Remove `eslint`, `prettier`, `@eslint/*`, `eslint-config-*` from `package.json` (or remove them directly from `package.json` if package manager removal fails on mixed dependency sections) and delete `.eslintrc*`, `eslint.config.*`, `.prettierrc*`.
3. **Install Biome**: Install `@biomejs/biome` in `devDependencies` (and upgrade `typescript` to `^7.0.0` if desired). Align `$schema` in `biome.json` with the installed version.
4. **Configure `biome.json`**: Generate or author `biome.json` with formatting, VCS `.gitignore` awareness, linter presets, and framework domains. Exclude test folders (`!__tests__`, `!tests`) and editor metadata (`!.vscode`) in `files.includes`. See [biome-config-reference.md](biome-config-reference.md).
5. **Translate Rules & Comments**: Map disabled/custom rules and migrate suppression comments. See [eslint-rule-mapping.md](eslint-rule-mapping.md).
6. **Safe Format & Fix**: Run `biome check --write .` first to apply safe formatting and import organization. Review diagnostics before running `biome check --write --unsafe .` or fixing semantic issues manually (to avoid stripping effect dependencies). See [tailwind-and-formatting.md](tailwind-and-formatting.md).
7. **Audit Collapsed Template Strings**: Scan `className` template literals for collapsed newlines that merged class names without spaces (`\${VAR}class` $\rightarrow$ `"20class"`). See [tailwind-and-formatting.md](tailwind-and-formatting.md).
8. **Configure CI & Editor**: Update `.github/workflows` to `biome ci .` and `.vscode/settings.json` for format-on-save. See [cicd-and-editor-setup.md](cicd-and-editor-setup.md).
9. **Multi-Gate Verification**: Execute lint $\rightarrow$ CI $\rightarrow$ typecheck $\rightarrow$ unit test $\rightarrow$ production build. See [verification-and-troubleshooting.md](verification-and-troubleshooting.md).

## Quick Reference

| Topic | Reference File |
| :--- | :--- |
| Configuration Schema (1.9 & 2.x), VCS, Assist, Linter Domains | [biome-config-reference.md](biome-config-reference.md) |
| ESLint / Next.js / React 19 / TypeScript Rule Mappings & Suppressions | [eslint-rule-mapping.md](eslint-rule-mapping.md) |
| TypeScript 7 Architecture, Unblocking Mechanism & Compiler Setup | [typescript7-and-toolchain.md](typescript7-and-toolchain.md) |
| Prettier Parity, Tailwind CSS v4 Directives, Class Sorting & Template Literals | [tailwind-and-formatting.md](tailwind-and-formatting.md) |
| GitHub Actions Workflows, VS Code Settings & Git Hooks | [cicd-and-editor-setup.md](cicd-and-editor-setup.md) |
| Multi-Gate Verification Matrix & Error Troubleshooting | [verification-and-troubleshooting.md](verification-and-troubleshooting.md) |

## Rationalization Table

| Temptation / False Assumption | Fact & Correct Action |
| :--- | :--- |
| "Let's keep ESLint alongside Biome for TS 7 type-aware rules." | Fails because TS 7 dropped the JS compiler API. Biome handles linting independently in Rust; use `tsc --noEmit` for full type verification. |
| "Next.js 16 will still run our existing `next lint` script." | Next.js 16 deprecated and removed `next lint`, failing with `Invalid project directory provided: .../lint`. Replace package script with `"lint": "biome check ."`. |
| "Running `biome check --write --unsafe .` immediately on the whole repo is fine." | `--unsafe` alters `useEffect` dependencies (stripping derived state or auto-injecting unmemoized functions that trigger infinite re-render loops). Always run safe `biome check --write .` first, then inspect and apply `--unsafe` or manual fixes selectively. |
| "Biome formatting will never alter class names in template literals." | Collapsing multiline template strings to single lines can delete newline token separators, concatenating classes together (e.g. `h-20w-full`). Always audit template string boundaries or use `twMerge`/`clsx`. |
| "Dynamic Tailwind class interpolation (e.g. `h-\${HEIGHT}`) is safe." | Dynamic class name assembly bypasses static extraction in Tailwind compilers. Use complete static class names or `style={{ ... }}`. |
| "Tailwind class sorting isn't working on standard format-on-save." | Biome classifies class reordering as an `unsafe` fix due to cascade specificity. Run `biome check --write --unsafe .` to apply class sorting. |
| "We need `eslint.ignoreDuringBuilds` in Next.js 16." | Next.js 16 removed `next lint` and decoupled builds from ESLint. No `next.config.js` hacks are required. |
| "We need `noUnescapedEntities: 'off'` in `biome.json`." | Fails schema deserialization. Biome allows unescaped quotes/apostrophes in JSX text by default. |
| "Attribute suppressions (`noDangerouslySetInnerHtml`) go above JSX tags." | Fails with `suppressions/unused`. Biome evaluates attribute rules at the attribute AST node; place `// biome-ignore` inside the tag directly preceding the attribute. |
| "Placing `useExhaustiveDependencies` suppression inside the `useEffect` body is fine." | Fails with `suppressions/unused` and leaves the hook unsuppressed. Biome evaluates hook rules on the `useEffect` AST call; place `// biome-ignore` directly above `useEffect`. |
| "Yarn remove will cleanly uninstall mixed dependencies without network." | Yarn v1 errors with `This module isn't specified` when packages are in different sections or attempts registry network resolution during lockfile re-sync. Edit `package.json` directly to remove packages, then run `yarn add -D @biomejs/biome`. |
| "It is always safe to enforce arrow functions with `useArrowFunction`." | Arrow functions lack `[[Construct]]` slots and throw `TypeError: ... is not a constructor` when instantiated with `new` in test mocks (`new S3Client()`, `new ServerClient()`). Disable `useArrowFunction` in `biome.json` or test overrides. |
| "Next.js builds should succeed in network-restricted sandboxes." | `next build` downloads Google Fonts (`next/font/google`) during static page generation. Ensure network access is permitted during production build verification. |
| "Unwrapping `<>...</>` to satisfy `noUselessFragments` is always layout-safe." | Unwrapping fragments inside slot-based layouts indexing positional children (`children[0]`, `children[1]`) flattens elements, shifting or silently dropping subsequent slots (e.g. sidebars). Wrap slot contents in a layout container (`<Stack>`, `<Box>`) or use `{null}` for empty slots. |
| "Adding unmemoized functions to `useEffect` dependencies fixes `useExhaustiveDependencies` safely." | Triggers infinite re-render loops (`fetch() -> setState() -> re-render -> new function instance -> loop`). Inline the helper inside the effect if self-contained, or use `// biome-ignore lint/correctness/useExhaustiveDependencies: <reason>`. |
| "Removing unused variables from hook returns is always safe." | Hook tuples (e.g. `useAuthState()`, `useSignInWith...`) depend on positional indices. Deleting items breaks subsequent assignments. Prefix unused tuple variables with `_` (`_user`). |
| "Using `{}` for empty component props is standard TypeScript." | In TypeScript, `{}` means "any non-nullish value", triggering `noBannedTypes`. Use `Record<string, never>` or omit the empty type parameter. |
| "`useIndexOf` auto-fix is always type-safe for array lookups." | Fails with `TS2345: Argument of type 'T \| undefined' is not assignable to parameter of type 'T'` when searching for optional values in strict TypeScript arrays. Biome converts `findIndex((x) => x === id)` to `indexOf(id)`. Set `"complexity": { "useIndexOf": "off" }`. |
| "Next.js error boundary component must be named `Error`." | Triggers `noShadowRestrictedNames` for shadowing the global `Error` object. Rename local component to `RootError` or `GlobalError` (`export default RootError`). |
| "Biome recommended rules match default Next.js ESLint rules." | Biome enables strict `a11y` rules by default (`useButtonType`, `useKeyWithClickEvents`, `noStaticElementInteractions`). Standard `eslint-config-next` did not enforce strict a11y. Set `"a11y": { "preset": "none" }` in `biome.json` for parity unless explicitly adopting a11y. |
| "Existing `tsconfig.json` requires no changes during migration." | Deprecated `"target": "es5"` emits `TS5107` under modern TypeScript (TS 6.0+) and will be removed in TS 7.0. Upgrade `"target": "es2022"` in `tsconfig.json`. |
| "Linting test suites alongside application code in Biome is fine." | Test files use test globals (`vi`, `jest`), thenable mocks, and loose types that conflict with production rules. Exclude test folders (`!__tests__`, `!tests`) in `files.includes` and rely on test runners for test suites. |
| "Passing `{ ref }` to dropzone prop getters (`getInputProps({ ref })`) works in React 19." | `DropzoneInputProps` extends generic `InputHTMLAttributes` which dropped `ref` in React 19 (`TS2353`). Use `React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)` and render `<input {...getInputProps()} />`. |
| "Formatting editor configuration files (`.vscode`) with Biome is fine." | Editor files in sandbox/container environments cause `internalError/io: Read-only file system (os error 30)`. Add `"!.vscode"` to `files.includes`. |

## Red Flags - STOP and Correct

- Running `biome check --write --unsafe .` before running safe `biome check --write .`.
- Leaving `next lint` in `package.json` scripts on Next.js 16+.
- Allowing `useIndexOf` auto-fix to convert `findIndex` predicates when the search target may be `undefined` or optional (`TS2345`).
- Naming root error boundary components `Error` instead of `RootError` (`noShadowRestrictedNames`).
- Omitting `"a11y": { "preset": "none" }` when migrating projects that previously only used Next.js `core-web-vitals` without `eslint-plugin-jsx-a11y`.
- Leaving deprecated `"target": "es5"` in `tsconfig.json` (`TS5107`).
- Omitting test directories (`!__tests__`, `!tests`) from `files.includes` in `biome.json`.
- Passing `{ ref: ... }` to `getInputProps(...)` under React 19 (`TS2353`). Use `useImperativeHandle(ref, () => inputRef.current)` and `<input {...getInputProps()} />`.
- Omitting `!.vscode` or read-only metadata from `files.includes` (`os error 30`).
- Leaving trailing commas or invalid JSON syntax in `biome.json`.
- Unwrapping `<>...</>` inside positional children slots (`children[0]`, `children[1]`) without verifying parent slot contracts.
- Adding unmemoized helper functions into `useEffect` dependency arrays to silence `useExhaustiveDependencies`.
- Using `{}` as an empty props type (`noBannedTypes`). Use `Record<string, never>`.
- Deleting positional items from tuple destructuring instead of prefixing with `_`.
- Converting constructor mock functions instantiated with `new` into arrow functions (`useArrowFunction`).
- Adding `rules-of-hooks` suppressions for lowercase React components (`const icons: React.FC`) instead of capitalizing to PascalCase (`const Icons`).
- Using non-null assertion after optional chaining like `user?.uid!` (`noNonNullAssertedOptionalChain`). Use `user?.uid ?? ""` or `user!.uid`.
- Collapsing multiline template strings in `className` without checking boundary whitespace (e.g. ``h-${NAVBAR_HEIGHT}w-full``).
- Constructing dynamic Tailwind utility strings that evade static scanner extraction.
- Adding non-existent rules like `noUnescapedEntities` to `biome.json`.
- Leaving legacy ESLint packages or plugins in `package.json` after adopting Biome.
- Duplicating object keys in JSON or configuration files (`noDuplicateObjectKeys`).
- Placing JSX attribute suppressions above the element tag instead of on the attribute line.
- Placing `useExhaustiveDependencies` suppressions inside the `useEffect` callback body instead of preceding `useEffect` directly.
- Returning expression values from `.forEach()` callbacks or omitting return values from `.map()` callbacks (`useIterableCallbackReturn`).
- Using `// biome-ignore` without an explanatory comment reason (Biome requires a reason after `:`).
- Leaving unused `// biome-ignore` comments for rules disabled in config or test overrides.
- Relying solely on `biome check` and skipping `tsc --noEmit` (Biome is a fast AST linter, not a full semantic type checker).
- Using legacy folder ignore syntax with `/**` in Biome 2.2+ (triggers `useBiomeIgnoreFolder` warnings).
