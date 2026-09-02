# Biome Configuration Reference (Biome 1.9 & Biome 2.x / 2.5+)

Comprehensive guide to configuring Biome (`biome.json` and `biome.jsonc`) across versions 1.9 through 2.x (including 2.5+), detailing schema evolution, configuration blocks, formatting standards, Tailwind CSS v4 support, and domain-based linting.

---

## 1. Schema & Versioning Evolution: Biome 1.9 vs 2.x

| Feature / Setting     | Biome 1.9                                        | Biome 2.0 – 2.5+                                                             | Migration Note                                                               |
| :-------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **`$schema` URL**     | `https://biomejs.dev/schemas/1.9.4/schema.json`  | `https://biomejs.dev/schemas/2.5.11/schema.json`                             | Update URL to match installed CLI version.                                   |
| **Import Sorting**    | `"organizeImports": { "enabled": true }`         | `"assist": { "actions": { "source": { "organizeImports": "on" } } }`         | `organizeImports` moved under the new `assist` engine.                       |
| **File Inclusion**    | `"files": { "include": [...] }`                  | `"files": { "includes": [...] }`                                             | `include` is deprecated in favor of `includes`.                              |
| **Folder Ignore**     | `"ignore": ["**/dist/**", "**/node_modules/**"]` | `"includes": ["**", "!dist", "!node_modules", "!.next", "!public"]`          | In 2.2+, folder ignores use bare directory names without `/**`.              |
| **Tailwind Support**  | Basic CSS                                        | `"css": { "parser": { "tailwindDirectives": true } }`                        | Native parser support for Tailwind CSS v4 directives (`@theme`, `@utility`). |
| **Framework Domains** | Manual rule selection under `rules.*`            | `"linter": { "domains": { "next": "recommended", "react": "recommended" } }` | High-level domain toggles package framework rules.                           |
| **Rule Presets**      | `"rules": { "recommended": true }`               | `"rules": { "preset": "recommended" }`                                       | `recommended: true` is deprecated in favor of `preset: "recommended"`.       |

---

## 2. Complete Configuration Reference

### 2.1 Schema & Root Boundary

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.11/schema.json",
  "root": true
}
```

* **`$schema`** `(string)`: Points to the JSON Schema matching your Biome version to enable editor autocomplete and diagnostics.
* **`root`** `(boolean)`: When set to `true`, stops Biome from traversing parent directories searching for another `biome.json`. Crucial for monorepo roots or standalone projects.

---

### 2.2 Version Control System (`vcs`)

Integrates Biome with your version control system, allowing it to honor ignore files and track modified files.

```json
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  }
}
```

* **`enabled`** `(boolean)`: Enables VCS integration. Defaults to `false`.
* **`clientKind`** `("git")`: The VCS client in use.
* **`useIgnoreFile`** `(boolean)`: When `true`, Biome automatically ignores any file or folder listed in `.gitignore` alongside its internal ignore list.
* **`defaultBranch`** `(string)`: The baseline branch used by CLI commands like `biome check --changed` or `biome check --since=main`.

---

### 2.3 File Management (`files`)

Controls file resolution, glob targeting, and size boundaries.

```json
{
  "files": {
    "includes": [
      "**",
      "!node_modules",
      "!.next",
      "!dist",
      "!build",
      "!coverage",
      "!public"
    ],
    "maxSize": 1048576,
    "ignoreUnknown": true
  }
}
```

* **`includes`** `(string[])`: Glob patterns specifying files to process. Prefix with `!` to exclude folders.
* **`maxSize`** `(number)`: Maximum allowed file size in bytes (default `1048576` = 1MB).
* **`ignoreUnknown`** `(boolean)`: When `true`, silently skips files with extensions unsupported by Biome.

---

### 2.4 Code Formatting (`formatter`, `javascript`, `css`, `json`)

```json
{
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80,
    "lineEnding": "lf",
    "attributePosition": "auto"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "jsxQuoteStyle": "double",
      "quoteProperties": "asNeeded",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always",
      "bracketSpacing": true,
      "bracketSameLine": false
    }
  },
  "css": {
    "parser": {
      "tailwindDirectives": true,
      "cssModules": true
    },
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "quoteStyle": "double"
    }
  },
  "json": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "trailingCommas": "none"
    }
  }
}
```

---

### 2.5 Code Assistance & Import Organization (`assist`)

In Biome 2.x, import sorting actions are managed under the `assist` block:

```json
{
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

* Automatically groups and sorts imports (built-in node modules, external packages, workspace packages, internal aliases, relative imports, side-effect imports).

---

### 2.6 Linter Configuration (`linter`) & Framework Domains

```json
{
  "linter": {
    "enabled": true,
    "domains": {
      "next": "recommended",
      "react": "recommended"
    },
    "rules": {
      "preset": "recommended",
      "a11y": {
        "preset": "none"
      },
      "complexity": {
        "noForEach": "off",
        "useArrowFunction": "off"
      },
      "correctness": {
        "useHookAtTopLevel": "error",
        "useExhaustiveDependencies": "warn"
      },
      "style": {
        "noNonNullAssertion": "off",
        "useNodejsImportProtocol": "off"
      },
      "suspicious": {
        "noArrayIndexKey": "off",
        "noDocumentCookie": "off",
        "noExplicitAny": "off",
        "noPrototypeBuiltins": "off"
      },
      "nursery": {
        "useSortedClasses": {
          "level": "warn",
          "options": {
            "attributes": ["classList", "className", "tw"],
            "functions": ["clsx", "cva", "twMerge", "cn"]
          }
        }
      }
    }
  }
}
```

---

### 2.7 Overrides (`overrides`)

Target specific files (e.g. test files or scripts) for granular rule adjustments:

```json
{
  "overrides": [
    {
      "includes": [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "__tests__/**/*"
      ],
      "linter": {
        "rules": {
          "performance": {
            "noImgElement": "off"
          },
          "suspicious": {
            "noExplicitAny": "off",
            "noThenProperty": "off"
          },
          "style": {
            "noNonNullAssertion": "off"
          }
        }
      }
    }
  ]
}
```

