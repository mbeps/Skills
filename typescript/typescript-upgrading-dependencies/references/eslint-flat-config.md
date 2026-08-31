# ESLint Flat Config & Plugin Ecosystem Reference

This document covers ESLint migration, plugin compatibility auditing, and clean configuration patterns for modern TypeScript and Next.js codebases without monkey-patching or hacky workarounds.

---

## 1. ESLint 10 Breaking Changes & Architecture

### Key Removals in ESLint 10
1. **Legacy `.eslintrc` Format Removed**:
   - Configuration files such as `.eslintrc.js`, `.eslintrc.json`, `.eslintrc.yml` are completely unsupported.
   - Flat configuration (`eslint.config.js`, `eslint.config.mjs`, or `eslint.config.ts`) is mandatory.
2. **Rule Context API Removals**:
   - `context.getFilename()` is removed (replaced by `context.filename`).
   - `context.getSourceCode()` is removed (replaced by `context.sourceCode`).
   - `context.getCwd()` is removed (replaced by `context.cwd`).
3. **Plugin Compatibility Trap**:
   - Many ecosystem plugins (e.g. older `eslint-plugin-react` releases) still call `context.getFilename()`.
   - Running ESLint 10 with these plugins produces fatal errors during linting:
     `TypeError: contextOrFilename.getFilename is not a function`

### Decision Protocol for ESLint Major Upgrades
- If `eslint-config-next` or essential plugins have not updated their internal rule implementations to use `context.filename`:
  - **Do NOT** use monkey-patching (`patch-package`) or fork packages unless strictly approved.
  - **Pin ESLint to the latest stable 9.x release** (`eslint@^9.39.x`).
  - Upgrade helper packages like `@eslint/eslintrc` to their latest compatible release.

---

## 2. Clean Flat Config Setup (`eslint.config.mjs`)

Modern Next.js projects should define flat configs directly:

```javascript
// eslint.config.mjs
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    // React Compiler / React Hooks custom rule overrides
    rules: {
      "react-hooks/component-hook-factories": "off",
      "react-hooks/config": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/gating": "off",
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/static-components": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/use-memo": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
```

---

## 3. Auditing Peer Dependencies & Plugin Chains

Before upgrading ESLint or plugins:

```bash
# Check declared peer dependencies of eslint-config-next
npm info eslint-config-next@latest peerDependencies

# Check dependencies of the config
npm info eslint-config-next@latest dependencies

# Check plugin peer requirements
npm info eslint-plugin-react@latest peerDependencies
npm info typescript-eslint@latest peerDependencies
```

### Next.js 16 CLI Transition
- Note that `next lint` is deprecated/removed in Next.js 16+.
- Update `package.json` lint scripts to invoke ESLint CLI directly:
  ```json
  "scripts": {
    "lint": "eslint . --max-warnings=0"
  }
  ```

