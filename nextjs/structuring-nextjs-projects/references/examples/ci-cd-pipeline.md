# Worked Example: Automated CI/CD Pipeline with GitHub Actions

Production PR verification pipeline validating Biome, Turbopack, Vitest coverage, and Docker compose across Node LTS versions.

## Example 8: Automated CI/CD Pipeline with GitHub Actions

### Scenario
Validating linting (Biome), builds (Turbopack), Vitest coverage, and Docker compose smoke tests across the latest 2 Node LTS versions on every PR to `main`.

---

### GitHub Actions Workflow (`.github/workflows/merge.yml`)

```yaml
name: Merging to Main

on:
  pull_request:
    branches:
      - main

jobs:
  lint:
    name: Lint & Format - Node ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['24.x', '26.x']
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - name: Run Linter & Formatter Check (Biome)
        run: yarn ci

  build:
    needs: lint
    name: Build - Node ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['24.x', '26.x']
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - name: Build Next.js
        run: yarn build

  test:
    needs: build
    name: Test - Node ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['24.x', '26.x']
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - name: Run Tests with Coverage
        run: yarn test:coverage

  docker:
    needs: test
    name: Docker Compose Build & Smoke Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & Run Containers
        run: |
          cd docker
          docker compose -f docker-compose.yml up -d
        - name: Stop Containers
          run: |
          cd docker
          docker compose -f docker-compose.yml down
```

