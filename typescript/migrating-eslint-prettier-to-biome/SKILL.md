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
2. **Uninstall Legacy Tooling**: Remove `eslint`, `prettier`, `@eslint/*`, `eslint-config-*`, and delete `.eslintrc*`, `eslint.config.*`, `.prettierrc*`.
3. **Install Biome**: Install `@biomejs/biome` in `devDependencies` (and upgrade `typescript` to `^7.0.0` if desired).
4. **Configure `biome.json`**: Generate or author `biome.json` with formatting, VCS `.gitignore` awareness, linter presets, and framework domains. See [biome-config-reference.md](biome-config-reference.md).
5. **Translate Rules & Comments**: Map disabled/custom rules and migrate suppression comments. See [eslint-rule-mapping.md](eslint-rule-mapping.md).
6. **Format & Fix**: Run `biome format --write .` and `biome check --write --unsafe .` to apply safe formatting and Tailwind class sorting. See [tailwind-and-formatting.md](tailwind-and-formatting.md).
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
| "Biome formatting will never alter class names in template literals." | Collapsing multiline template strings to single lines can delete newline token separators, concatenating classes together (e.g. `h-20w-full`). Always audit template string boundaries or use `twMerge`/`clsx`. |
| "Dynamic Tailwind class interpolation (e.g. `h-\${HEIGHT}`) is safe." | Dynamic class name assembly bypasses static extraction in Tailwind compilers. Use complete static class names or `style={{ ... }}`. |
| "Tailwind class sorting isn't working on standard format-on-save." | Biome classifies class reordering as an `unsafe` fix due to cascade specificity. Run `biome check --write --unsafe .` to apply class sorting. |
| "We need `eslint.ignoreDuringBuilds` in Next.js 16." | Next.js 16 removed `next lint` and decoupled builds from ESLint. No `next.config.js` hacks are required. |

## Red Flags - STOP and Correct

- Collapsing multiline template strings in `className` without checking boundary whitespace (e.g. ``h-${NAVBAR_HEIGHT}w-full``).
- Constructing dynamic Tailwind utility strings that evade static scanner extraction.
- Leaving legacy ESLint packages or plugins in `package.json` after adopting Biome.
- Using `// biome-ignore` without an explanatory comment reason (Biome requires a reason after `:`).
- Relying solely on `biome check` and skipping `tsc --noEmit` (Biome is a fast AST linter, not a full semantic type checker).
- Using legacy folder ignore syntax with `/**` in Biome 2.2+ (triggers `useBiomeIgnoreFolder` warnings).
