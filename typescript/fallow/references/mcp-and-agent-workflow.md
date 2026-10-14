# Fallow: MCP Server & AI Agent Workflow

This reference explains how AI coding agents (Antigravity, Gemini, Claude Code, Cursor) interact with Fallow via MCP and CLI pipelines.

---

## 1. Setting up Fallow MCP Server

Fallow provides a dedicated Model Context Protocol (MCP) server binary: `fallow-mcp`. It communicates over stdio using JSON-RPC.

### Configuration in `.mcp.json` or Agent Settings

```json
{
  "mcpServers": {
    "fallow": {
      "command": "fallow-mcp",
      "args": []
    }
  }
}
```

If installed locally in a project without global binary:

```json
{
  "mcpServers": {
    "fallow": {
      "command": "npx",
      "args": ["-y", "fallow-mcp"]
    }
  }
}
```

---

## 2. Core MCP Tools

| MCP Tool Name | CLI Equivalent | Description |
|---|---|---|
| `audit` | `fallow audit --format json --quiet` | Audits changed files against base git ref for dead code, complexity, duplication, and styling. |
| `dead_code` | `fallow dead-code --format json --quiet` | Scans workspace for unused files, exports, types, and dependencies. |
| `dupes` | `fallow dupes --format json --quiet` | Detects clone groups and code duplication. |
| `health` | `fallow health --format json --quiet` | Computes maintainability index, complexity hotspots, and refactoring targets. |
| `trace_export` | `fallow dead-code --trace <file>:<export>` | Traces exact import chains and callers for a specific export before deletion. |
| `trace_file` | `fallow dead-code --trace-file <path>` | Traces inbound and outbound graph edges for a file. |
| `fix_preview` | `fallow fix --dry-run --format json --quiet` | Previews automatic fixes without modifying files. |
| `fix_apply` | `fallow fix --yes --format json --quiet` | Applies automated fixes to disk. |
| `fallow_explain` | `fallow explain <issue-type>` | Returns explanation, rationale, and remediation guide for an issue. |
| `list_boundaries` | `fallow list --boundaries` | Lists configured boundary zones and access rules. |

---

## 3. Agent CLI Execution Rules

When an AI agent executes Fallow via shell commands, follow these strict rules:

1. **Always Use `--format json --quiet`**:
   - Ensures structured JSON payload on stdout.
   - Suppresses terminal styling, ANSI escapes, and progress animations.
   - Parse stdout as JSON; keep stderr separate for error diagnostics. Do **not** redirect `2>&1`.

2. **Exit Code Semantics**:
   - `0`: Clean run, zero error-severity issues found.
   - `1`: Successful analysis run, but findings at or above `error` severity were detected.
   - `2`: Tool failure, invalid configuration, syntax error, or unhandled exception.
   - *Note*: An exit code of 1 does **not** mean Fallow crashed; it means the quality gate identified code issues to report.

3. **Never Run `fallow watch`**:
   - `fallow watch` runs continuously in the foreground waiting for file changes.
   - Calling it in an agent turn hangs execution indefinitely.

4. **Always `--dry-run` Before `fallow fix`**:
   - Inspect planned deletions first via `fallow fix --dry-run --format json --quiet`.
   - Then apply with `fallow fix --yes --format json --quiet` (`--yes` is required in non-TTY environments).

5. **Paths Are Repository-Root-Relative**:
   - Fallow paths (e.g. `components/chat/chat-ui.tsx`) are always relative to the discovered project root.
