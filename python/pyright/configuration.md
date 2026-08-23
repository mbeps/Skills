# Pyright Configuration Reference

Complete guide to configuring Pyright via pyrightconfig.json or pyproject.toml.

## Configuration Files

Pyright reads configuration from (in priority order):
1. `pyrightconfig.json` (root of project)
2. `[tool.pyright]` section in `pyproject.toml`

**pyrightconfig.json takes precedence.** If both exist, pyproject.toml is ignored.

## Basic Configuration

### pyrightconfig.json Example

```json
{
  "include": ["src"],
  "exclude": [
    "**/node_modules",
    "**/__pycache__",
    ".venv"
  ],
  "typeCheckingMode": "standard",
  "pythonVersion": "3.11",
  "pythonPlatform": "Linux",
  "reportMissingImports": "error",
  "reportMissingTypeStubs": "warning"
}
```

### pyproject.toml Example

```toml
[tool.pyright]
include = ["src"]
exclude = ["**/node_modules", "**/__pycache__", ".venv"]
typeCheckingMode = "standard"
pythonVersion = "3.11"
pythonPlatform = "Linux"
reportMissingImports = "error"
reportMissingTypeStubs = "warning"
```

## Type Checking Modes

Four modes with increasing strictness:

| Mode         | Description                                 | Use When                             |
| ------------ | ------------------------------------------- | ------------------------------------ |
| **off**      | Syntax/import errors only, no type checking | Legacy code, not ready for types     |
| **basic**    | Basic type checking, lenient                | Introducing types gradually          |
| **standard** | Balanced checking (default)                 | Most projects                        |
| **strict**   | Maximum strictness                          | New projects, high-quality codebases |

Set via: `"typeCheckingMode": "standard"`

### What Strict Mode Enables

Strict mode enables all of these automatically:
- Disallows untyped function definitions
- Disallows untyped calls
- Requires return type annotations
- Disallows Any in many contexts
- Strict list/dict/set inference
- Reports unknown parameter/variable types

See full table: https://microsoft.github.io/pyright/#/configuration?id=diagnostic-settings-defaults

## Essential Options

### Include/Exclude Patterns

```json
{
  "include": ["src", "tests"],
  "exclude": [
    "**/__pycache__",
    "**/.venv",
    "**/node_modules",
    "build",
    "dist"
  ]
}
```

Glob patterns:
- `**` = any number of directories
- `*` = any characters
- `?` = single character

### Python Version and Platform

```json
{
  "pythonVersion": "3.11",
  "pythonPlatform": "Linux"
}
```

Platforms: `"Linux"`, `"Windows"`, `"Darwin"` (macOS), `"iOS"`, `"Android"`, `"All"`

**Always match your runtime Python version.**

### Diagnostic Overrides

Override individual rules:

```json
{
  "typeCheckingMode": "standard",
  "reportMissingImports": "error",
  "reportUnusedVariable": "warning",
  "reportUnknownMemberType": "none"
}
```

Values: `"error"`, `"warning"`, `"information"`, `"none"`

### Stub and Extra Paths

```json
{
  "stubPath": "./typings",
  "extraPaths": ["./src", "./lib"]
}
```

- `stubPath`: Custom type stub files directory
- `extraPaths`: Additional import search paths

### Virtual Environment

```json
{
  "venvPath": ".",
  "venv": ".venv"
}
```

Or use absolute path: `"venvPath": "/home/user/project"`

## Per-File Strictness

Use `strict` array to enable strict mode for specific paths:

```json
{
  "typeCheckingMode": "basic",
  "strict": ["src/core/**"]
}
```

This applies strict mode only to files matching the pattern.

## Execution Environments

For projects with multiple Python versions/platforms:

```json
{
  "executionEnvironments": [
    {
      "root": "src/web",
      "pythonVersion": "3.10",
      "pythonPlatform": "Linux",
      "extraPaths": ["src/common"]
    },
    {
      "root": "src/lambda",
      "pythonVersion": "3.11",
      "pythonPlatform": "Linux"
    }
  ]
}
```

## VS Code Settings

Pylance (VS Code extension) uses these settings in `settings.json`:

```json
{
  "python.analysis.typeCheckingMode": "standard",
  "python.analysis.diagnosticMode": "openFilesOnly",
  "python.analysis.autoImportCompletions": true,
  "python.analysis.diagnosticSeverityOverrides": {
    "reportUnusedVariable": "warning",
    "reportGeneralTypeIssues": "error"
  }
}
```

### Important VS Code Settings

| Setting                                  | Description                                      |
| ---------------------------------------- | ------------------------------------------------ |
| `python.analysis.typeCheckingMode`       | Same as Pyright's typeCheckingMode               |
| `python.analysis.diagnosticMode`         | "openFilesOnly" (fast) or "workspace" (thorough) |
| `python.analysis.autoImportCompletions`  | Auto-import suggestions                          |
| `python.analysis.indexing`               | Enable/disable indexing for performance          |
| `python.analysis.useLibraryCodeForTypes` | Parse library source when stubs missing          |

## Command Line Usage

```bash
# Check all files in project
pyright

# Check specific files
pyright src/main.py tests/

# Watch mode (re-check on changes)
pyright --watch

# Specify config file
pyright --project pyrightconfig.json

# JSON output
pyright --outputjson

# Ignore external imports
pyright --ignoreexternal

# Set Python version
pyright --pythonversion 3.11

# Verbose output
pyright --verbose
```

## Configuration Best Practices

1. **Start with "basic" mode** - gradually increase strictness
2. **Exclude build artifacts** - always exclude __pycache__, .venv, build/, dist/
3. **Match Python version** - set pythonVersion to your runtime version
4. **Use pyrightconfig.json for teams** - more explicit than pyproject.toml
5. **Override per-rule, not wholesale** - disable specific rules, not entire mode
6. **Test configuration in CI** - run `pyright` in CI pipeline

## Common Configuration Patterns

### Incremental Adoption

```json
{
  "typeCheckingMode": "basic",
  "strict": ["src/new_module/**"],
  "reportMissingImports": "error",
  "reportUndefinedVariable": "error"
}
```

Start strict for new code, basic for legacy.

### Library Project

```json
{
  "include": ["src"],
  "exclude": ["tests", "examples"],
  "typeCheckingMode": "strict",
  "reportUnknownMemberType": "error",
  "reportMissingTypeStubs": "warning"
}
```

High strictness for libraries.

### Performance-Focused

```json
{
  "include": ["src"],
  "exclude": ["**"],
  "typeCheckingMode": "basic",
  "useLibraryCodeForTypes": false
}
```

Check only explicitly included files, don't parse libraries.

## Troubleshooting

**"Cannot find configuration file"**  
→ Place pyrightconfig.json in project root (where you run `pyright`)

**"Config file is invalid JSON"**  
→ Validate JSON syntax (no trailing commas, quotes required)

**"Settings from pyproject.toml ignored"**  
→ Remove pyrightconfig.json OR remove [tool.pyright] from pyproject.toml

**"Too many errors"**  
→ Start with "basic" mode, gradually enable rules

**"Virtual environment not detected"**  
→ Set venvPath and venv explicitly in config

## References

- Official Pyright Configuration Docs: https://microsoft.github.io/pyright/#/configuration
- Diagnostic Rules: https://microsoft.github.io/pyright/#/configuration?id=type-check-diagnostics-settings
- VS Code Pylance Settings: https://github.com/microsoft/pylance-release#settings-and-customization
