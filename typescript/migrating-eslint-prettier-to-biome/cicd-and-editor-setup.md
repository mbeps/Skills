# CI/CD Workflows, Editor Configuration & Git Hooks Reference

Comprehensive guide to configuring Biome across continuous integration pipelines (GitHub Actions), VS Code editor settings, pre-commit hooks, and CI/CD troubleshooting.

---

## 1. GitHub Actions CI/CD Workflows

When integrating Biome into GitHub Actions, there are two primary architectures:
1. **Standalone Fast Action (`biomejs/setup-biome`)**: Best for dedicated, fail-fast lint/format checks without installing `node_modules`.
2. **Integrated Package Manager Matrix**: Best for unified PR pipelines chaining `lint` $\rightarrow$ `build` $\rightarrow$ `test`.

---

### Pattern A: Standalone Fast Action (`biomejs/setup-biome`)

Runs Biome as a standalone native binary in 1–3 seconds, without requiring `npm install` or `yarn install`.

```yaml
# .github/workflows/biome.yml
name: Biome Quality Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  biome-check:
    name: Biome Lint & Format
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Biome
        uses: biomejs/setup-biome@v2
        with:
          # Automatically detects version from package.json or specify exact version
          version: "latest"

      - name: Run Biome CI with GitHub Annotations
        run: biome ci --reporter=github .
```

---

### Pattern B: Integrated Multi-Job Pipeline (Lint $\rightarrow$ Build $\rightarrow$ Test)

In production repositories, jobs are typically separated into sequential stages using `needs:` to fail fast if formatting or linting fails before running heavy builds and test suites.

```yaml
# .github/workflows/merge.yml
name: Merging to Main

on:
  pull_request:
    branches: [main]

jobs:
  # ─── 1. LINT & FORMAT GATE ────────────────────────────
  lint:
    name: Lint - Node ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['22.x', '24.x']
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Detect package manager
        id: detect-package-manager
        run: |
          if [ -f "${{ github.workspace }}/yarn.lock" ]; then
            echo "manager=yarn" >> $GITHUB_OUTPUT
            echo "command=install --frozen-lockfile" >> $GITHUB_OUTPUT
            echo "runner=yarn" >> $GITHUB_OUTPUT
          elif [ -f "${{ github.workspace }}/pnpm-lock.yaml" ]; then
            echo "manager=pnpm" >> $GITHUB_OUTPUT
            echo "command=install --frozen-lockfile" >> $GITHUB_OUTPUT
            echo "runner=pnpm" >> $GITHUB_OUTPUT
          elif [ -f "${{ github.workspace }}/package.json" ]; then
            echo "manager=npm" >> $GITHUB_OUTPUT
            echo "command=ci" >> $GITHUB_OUTPUT
            echo "runner=npx --no-install" >> $GITHUB_OUTPUT
          fi

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: ${{ steps.detect-package-manager.outputs.manager }}

      - name: Install dependencies
        run: ${{ steps.detect-package-manager.outputs.manager }} ${{ steps.detect-package-manager.outputs.command }}

      - name: Run Biome CI
        run: ${{ steps.detect-package-manager.outputs.runner }} biome ci --reporter=github .

  # ─── 2. BUILD GATE (Runs after lint succeeds) ───────────
  build:
    needs: lint
    name: Build - Node ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['22.x', '24.x']
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Detect package manager
        id: detect-package-manager
        run: |
          if [ -f "${{ github.workspace }}/yarn.lock" ]; then
            echo "manager=yarn" >> $GITHUB_OUTPUT
            echo "command=install --frozen-lockfile" >> $GITHUB_OUTPUT
            echo "runner=yarn" >> $GITHUB_OUTPUT
          elif [ -f "${{ github.workspace }}/package.json" ]; then
            echo "manager=npm" >> $GITHUB_OUTPUT
            echo "command=ci" >> $GITHUB_OUTPUT
            echo "runner=npx --no-install" >> $GITHUB_OUTPUT
          fi

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: ${{ steps.detect-package-manager.outputs.manager }}

      - name: Install dependencies
        run: ${{ steps.detect-package-manager.outputs.manager }} ${{ steps.detect-package-manager.outputs.command }}

      - name: Build Next.js
        run: ${{ steps.detect-package-manager.outputs.runner }} next build --turbopack

  # ─── 3. TEST GATE (Runs after build succeeds) ───────────
  test:
    needs: build
    name: Test - Node ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['22.x', '24.x']
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: yarn

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run Unit Tests with Coverage
        run: yarn test:coverage
```

---

### CI/CD Flags & Performance Optimizations

| Flag / Option | Purpose |
| :--- | :--- |
| `--reporter=github` | Outputs annotations directly into GitHub Pull Request files/diff view with line-level squiggles. |
| `--changed --since=main` | In large monorepos, checks only files modified in the PR against the base branch for sub-100ms runs. |
| `--diagnostic-level=warn` | Controls exit code behavior (fails on warnings or errors only). |
| `--max-diagnostics=50` | Prevents overwhelming CI log output when running on large migrations. |

---

## 2. VS Code Configuration

Configure the official Biome extension (`biomejs.biome`) for format-on-save, organize-imports-on-save, and quickfixes.

### 2.1 Workspace Configuration (`.vscode/settings.json`)

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.fixAll.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[css]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "files.autoSave": "off",
  "testing.automaticallyOpenPeekView": "never"
}
```

### 2.2 Extension Recommendations (`.vscode/extensions.json`)

Prompt developers and contributors to install the Biome extension and avoid conflicting legacy formatters:

```json
{
  "recommendations": [
    "biomejs.biome"
  ],
  "unwantedRecommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode"
  ]
}
```

---

## 3. Pre-Commit Hooks with lint-staged & Husky

Run Biome on staged files to prevent unformatted or invalid code from being committed.

### 3.1 Installation

```bash
yarn add -D husky lint-staged
yarn husky init
```

### 3.2 Configuration (`.lintstagedrc.json`)

```json
{
  "*.{js,ts,jsx,tsx,json,jsonc,css}": [
    "biome check --write --no-errors-on-unmatched"
  ]
}
```

> [!TIP]
> `--no-errors-on-unmatched` prevents pre-commit failures if files matched by `lint-staged` are ignored by `biome.json`.

### 3.3 Hook Definition (`.husky/pre-commit`)

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

yarn lint-staged
```
