# Fallow: Baselines & CI/CD Integration

This reference explains how to adopt Fallow incrementally on existing codebases using baselines, how to configure regression gates, and how to integrate Fallow into CI pipelines (GitHub Actions, GitLab CI).

---

## 1. Incremental Adoption via Baselines

On established codebases, running `fallow` might surface a large pre-existing backlog of dead code, duplication, or complexity. Rather than blocking feature development until the entire backlog is cleared, capture a baseline:

### Saving a Baseline
```bash
# Save current issue counts as a baseline into .fallowrc.json
fallow --save-regression-baseline

# Or save standalone baseline files per sub-analysis
fallow dead-code --save-baseline .fallow/baselines/dead-code.json
fallow health --save-baseline .fallow/baselines/health.json
fallow dupes --save-baseline .fallow/baselines/dupes.json
```

### Running with a Baseline
```bash
# Compare current findings against saved baseline
fallow dead-code --baseline .fallow/baselines/dead-code.json
```

### Shrink-Only Baselines (`--fail-on-baseline-growth`)
Enforces that baselines can only improve, never grow. If a PR adds new issues and attempts to update the baseline in the same commit, CI fails:

```bash
fallow --baseline .fallow/baselines/dead-code.json --fail-on-baseline-growth
```

### Pruning Stale Entries (`fallow baselines`)
When issues are fixed, prune deleted items from baseline files:

```bash
fallow baselines prune
```

---

## 2. CI Quality Gates & Flags

| Flag | Purpose |
|---|---|
| `--ci` | Shorthand for `--format sarif --fail-on-issues --quiet` |
| `--fail-on-issues` | Exits code 1 if any issue matching configured error rules is found |
| `--fail-on-regression` | Exits code 1 if issue counts exceed baseline + tolerance |
| `--tolerance <N>` | Allowed threshold increase (e.g. `--tolerance 0` or `--tolerance 5%`) |
| `--fail-on-parse-error` | Exits code 1 if any source file cannot be parsed cleanly |
| `--sarif-file <path>` | Writes standard SARIF format to file for GitHub Security tab integration |

---

## 3. GitHub Actions Workflow Example

Create `.github/workflows/fallow.yml`:

```yaml
name: Fallow Codebase Intelligence

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  fallow:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history required for git audit and churn analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install Dependencies
        run: npm ci

      - name: Run Fallow Audit on Pull Request
        if: github.event_name == 'pull_request'
        run: |
          npx fallow audit \
            --base origin/${{ github.base_ref }} \
            --gate new-only \
            --sarif-file fallow.sarif \
            --format github-annotations

      - name: Run Full Fallow Analysis on Push
        if: github.event_name == 'push'
        run: |
          npx fallow \
            --ci \
            --sarif-file fallow.sarif

      - name: Upload SARIF Results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: fallow.sarif
          category: fallow-analysis
```
