# Fallow: Installation and Setup

This reference details global installation, project devDependency integration, readiness verification with `fallow doctor`, coding agent harness integration (`fallow agent`), and Git pre-commit hooks.

---

## 1. Installation Methods

### Global Installation (CLI & MCP)
Install globally to make `fallow`, `fallow-lsp`, and `fallow-mcp` available across all workspaces:

```bash
# Recommended: npm global (downloads prebuilt native Rust binaries)
npm install -g fallow

# Or via pnpm / yarn / bun
pnpm add -g fallow
bun add -g fallow

# Run ad-hoc without installation
npx fallow dead-code

# Build from source via Rust toolchain (optional)
cargo install fallow-cli
```

### Project DevDependency (Team & CI Consistency)
Install as a devDependency so all developers and CI pipelines use the identical pinned version:

```bash
npm install --save-dev fallow
# or: pnpm add -D fallow
```

Add standard scripts to `package.json`:

```json
{
  "scripts": {
    "fallow": "fallow",
    "fallow:dead-code": "fallow dead-code",
    "fallow:audit": "fallow audit",
    "fallow:health": "fallow health",
    "fallow:dupes": "fallow dupes",
    "fallow:ci": "fallow --ci"
  }
}
```

---

## 2. Environment Diagnostics (`fallow doctor`)

Before running extensive analysis or writing configuration, run `fallow doctor` to check repository readiness, configuration resolution, installed dependencies, and cache health without mutating any files:

```bash
# Human readable report
fallow doctor

# Machine readable JSON
fallow doctor --format json --quiet
```

### What `fallow doctor` Checks:
1. **Root & Config Resolution**: Validates project root and detects `.fallowrc.json`, `.fallowrc.jsonc`, or `fallow.toml`.
2. **Workspace Discovery**: In monorepos (pnpm, npm workspaces, Turborepo), validates package globs and tsconfig references.
3. **Plugin Activation**: Checks which framework plugins (Next.js, Vite, Vitest, React, Drizzle, etc.) are detected and enabled.
4. **Type-Aware Companion**: Verifies if TypeScript compiler dependencies are present when semantic mode is requested.
5. **Persistent Cache**: Tests read/write accessibility to the persistent cache directory (`.fallow/`).

---

## 3. Coding Agent Harness Wiring (`fallow agent`)

Fallow provides native wiring for coding agents (Claude Code, Cursor, Codex, Gemini/Antigravity) in a single pass:

```bash
# Preview what would be wired (safe, dry run)
fallow agent install --dry-run

# Wire project-scoped files (AGENTS.md task matrix, MCP server, hooks)
fallow agent install

# Inspect active agent harness installations
fallow agent status

# Uninstall all fallow-managed agent hooks and blocks
fallow agent uninstall
```

### Agent Harness Capabilities:
- **AGENTS.md Task Map**: Injects an intent-routed decision table into `AGENTS.md` guiding agents on which command to execute before deleting exports, dependencies, or modifying architecture.
- **MCP Server Registration**: Registers `fallow-mcp` in `.mcp.json` for tool-use access.
- **Pre-Commit Gate**: Optionally installs a git hook script (`fallow-gate.sh`) that intercepts commits and runs `fallow audit` against the changeset.

---

## 4. Git Pre-Commit Hooks

Enforce codebase health directly at commit time to prevent AI-generated dead code or duplicate copies from entering git history:

```bash
# Scaffold shell pre-commit hook in .git/hooks/
fallow init --hooks

# Or explicitly via hooks subcommand:
fallow hooks install --target git

# Check hook status
fallow hooks status

# Remove pre-commit hook
fallow hooks uninstall --target git
```

The hook automatically executes `fallow audit --changed-since HEAD` and prevents the commit if new errors are introduced.
