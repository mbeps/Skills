# Fallow: Analysis Commands Reference

This reference documents the full CLI analysis suite, command options, filtering flags, output formats, and reachability tracing tools.

---

## 1. Primary Analysis Subcommands

### `fallow dead-code`
Finds unused files, dead exports, unused types, dead class/enum members, and phantom or miscategorized dependencies.

```bash
# Standard check (human format)
fallow dead-code

# Machine-readable output for agents
fallow dead-code --format json --quiet

# Filter to specific issue types
fallow dead-code --unused-files
fallow dead-code --unused-exports
fallow dead-code --unused-types
fallow dead-code --unused-dependencies

# Trace exact symbol reachability before deleting
fallow dead-code --trace components/chat/message.tsx:MessageBubble
fallow dead-code --trace-dependency @ai-sdk/react
fallow dead-code --trace-file lib/store/index.ts
```

### `fallow audit`
Analyzes changes between the working tree (or branch) and a base git ref. Evaluates dead code, duplication, complexity, and styling introduced by the PR. Ideal for pre-commit checks and CI pull request gates.

```bash
# Audit against default upstream or main
fallow audit --base main

# Audit against specific branch or commit
fallow audit --changed-since origin/dev

# Gate mode: fail only on findings introduced by this changeset (default)
fallow audit --gate new-only

# Gate mode: fail on ANY finding in touched files (stricter backlog cleaning)
fallow audit --gate all

# Agent format
fallow audit --base main --format json --quiet
```

### `fallow health`
Analyzes software maintainability, cyclomatic and cognitive complexity hotspots, unit sizing, and coverage gaps.

```bash
# Overall vital signs and functions exceeding thresholds
fallow health

# Show maintainability score (0-100)
fallow health --score

# Prioritized refactoring targets and complexity hotspots
fallow health --hotspots --targets

# Identify untested code reachable from live entry points
fallow health --coverage-gaps

# Integrate code coverage data (Istanbul or V8 JSON)
fallow health --coverage coverage/coverage-final.json

# Report without failing quality gate exit codes
fallow health --report-only
```

### `fallow dupes`
Detects copy-paste and structural code duplication across files using AST fingerprinting.

```bash
# Report clone groups appearing at least 2 or 3 times
fallow dupes

# Override duplication thresholds on the fly
fallow dupes --min-occurrences 3 --min-tokens 60 --min-lines 10

# Semantic duplication: normalizes identifiers to catch renamed copies
fallow dupes --mode semantic

# Trace instances of a duplicate fingerprint
fallow dupes --trace dup:b1c8794e

# Ignore cross-language duplicates or intra-directory duplicates
fallow dupes --dupes-skip-local
```

### `fallow architecture`
Evaluates structural integrity, dependency graphs, and architecture boundaries.

```bash
# Check circular dependencies and boundary violations
fallow architecture

# JSON format
fallow architecture --format json --quiet

# Inspect boundary definitions and assigned zones
fallow list --boundaries
```

### `fallow guard`
Inspects which architectural boundary rules, allowed imports, and forbidden callees apply to specific files *before* you make code changes:

```bash
# Check constraints on files prior to editing
fallow guard components/chat/chat-ui.tsx lib/chat/stream.ts
```

---

## 2. Tracing and Inspection Tools

### `fallow trace`
Traces reachability and dependency paths between modules:

```bash
# Find how module A reaches module B through import hops
fallow trace --path hooks/use-chat.ts lib/store/index.ts

# Inspect all import sites of a third-party dependency
fallow trace --dependency @ai-sdk/react --sites
```

### `fallow explain`
Prints the official rationale, severity defaults, and remediation instructions for an issue type without running analysis:

```bash
# Spaces or hyphens both work
fallow explain unused-files
fallow explain circular-dependencies
fallow explain private-type-leaks
```

### `fallow list`
Inspects discovered repository topology:

```bash
# Discovered entry points (framework routes, workers, package.json scripts)
fallow list --entry-points

# Active auto-detected framework plugins
fallow list --plugins

# Monorepo workspaces and package boundaries
fallow list --workspaces

# Startup eager byte weight per entry point
fallow list --entry-weight
```

---

## 3. Safe Automated Fixing (`fallow fix`)

Fallow can automatically remove unused exports and unreferenced dependencies:

```bash
# STEP 1: ALWAYS dry-run first to preview changes
fallow fix --dry-run

# STEP 2: Apply fixes in non-interactive/agent mode
# Note: --yes is mandatory in non-TTY environments!
fallow fix --yes
```

---

## 4. Output Formats

| Flag | Description |
|---|---|
| `--format human` (default) | Formatted ANSI terminal report with colors and metrics summary |
| `--format json` | Structured JSON output for agents, scripts, and programmatic parsing |
| `--quiet` / `-q` | Suppresses progress spinners and banners; keeps only primary payload on stdout |
| `--format sarif` | Static Analysis Results Interchange Format for GitHub Code Scanning / IDEs |
| `--format markdown` | GitHub Flavored Markdown summary suitable for PR comments |
| `--format compact` | One line per issue: `file:line:col: [severity] rule: message` |
