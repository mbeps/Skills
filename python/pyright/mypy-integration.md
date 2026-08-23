# MyPy and Pyright Integration

Guide to running both MyPy and Pyright together for comprehensive type safety.

## Why Use Both?

MyPy and Pyright have different strengths and error detection:

**MyPy strengths:**
- Mature plugin ecosystem
- More configuration options
- Better Python 2/3 compatibility mode
- Established community and patterns
- Some stricter checks (explicit re-exports)

**Pyright strengths:**
- Much faster (10-100x for large codebases)
- Better type inference
- Excellent IDE integration (Pylance)
- More accurate control flow analysis
- Better generic type handling

**Together:** Catch 10-20% more issues than either alone. Different algorithms, different blind spots.

## When to Use Both

**Use both when:**
- High-quality codebase requirements
- CI pipeline can run both
- Team uses mixed editors (VS Code + others)
- Want maximum type safety

**Use only Pyright when:**
- Speed is critical
- Everyone uses VS Code
- Just starting type checking

**Use only MyPy when:**
- Using MyPy plugins (e.g., Django, Pydantic)
- Python 2/3 compatibility
- Not using VS Code

## Configuration Without Conflicts

Both tools can coexist in `pyproject.toml`:

```toml
# Pyright configuration
[tool.pyright]
include = ["src"]
exclude = ["tests", "scripts"]
typeCheckingMode = "standard"
pythonVersion = "3.11"
reportMissingImports = "error"
reportMissingTypeStubs = "warning"

# MyPy configuration  
[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false
```

**Key principle:** Separate sections, no overlap. Each tool reads only its section.

## Equivalence Table

Map similar checks between tools:

| MyPy Setting                   | Pyright Setting                                | Effect                       |
| ------------------------------ | ---------------------------------------------- | ---------------------------- |
| `disallow_untyped_defs = true` | `typeCheckingMode = "strict"`                  | Require function annotations |
| `disallow_any_generics = true` | `reportMissingTypeArgument = "error"`          | Require generic type args    |
| `warn_return_any = true`       | `reportReturnType = "error"`                   | Warn on returning Any        |
| `strict_optional = true`       | Always on in Pyright                           | Check None handling          |
| `warn_redundant_casts = true`  | `reportUnnecessaryCast = "error"`              | Flag unnecessary casts       |
| `warn_unused_ignores = true`   | `reportUnnecessaryTypeIgnoreComment = "error"` | Flag unused ignores          |

## Complementary Configurations

Start both at medium strictness, increase together:

### Level 1: Basic

```toml
[tool.pyright]
typeCheckingMode = "basic"
reportMissingImports = "error"

[tool.mypy]
disallow_untyped_calls = false
disallow_untyped_defs = false
check_untyped_defs = true
```

### Level 2: Standard (Recommended)

```toml
[tool.pyright]
typeCheckingMode = "standard"
reportMissingImports = "error"
reportUnknownMemberType = "warning"

[tool.mypy]
disallow_untyped_defs = true
warn_return_any = true
warn_unused_ignores = true
```

### Level 3: Strict

```toml
[tool.pyright]
typeCheckingMode = "strict"
reportMissingImports = "error"
reportUnknownMemberType = "error"
reportMissingTypeStubs = "error"

[tool.mypy]
strict = true
warn_unreachable = true
```

## CI Integration

### GitHub Actions Example

```yaml
name: Type Check

on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install mypy pyright
          pip install -e .
      
      - name: Run MyPy
        run: mypy src/
      
      - name: Run Pyright
        run: pyright src/
```

### Make Target

```makefile
.PHONY: typecheck
typecheck:
	mypy src/
	pyright src/

.PHONY: typecheck-mypy
typecheck-mypy:
	mypy src/

.PHONY: typecheck-pyright
typecheck-pyright:
	pyright src/
```

### pre-commit Hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
  
  - repo: local
    hooks:
      - id: pyright
        name: pyright
        entry: pyright
        language: node
        additional_dependencies: ['pyright@1.1.350']
        types: [python]
        pass_filenames: false
```

## Handling Conflicts

### Different Opinions

Sometimes tools disagree. Strategies:

**1. Suppress in one tool:**

```python
# MyPy thinks this is wrong, Pyright is fine
x = some_function()  # type: ignore[some-check]  # MyPy only

# Pyright thinks this is wrong, MyPy is fine
y = other_function()  # pyright: ignore[errorCode]  # Pyright only
```

**2. Fix for the stricter tool:**

Usually Pyright is stricter. Fix for Pyright, MyPy will pass.

**3. Investigate and fix root cause:**

If tools disagree, might be an actual type ambiguity. Make code clearer.

### Module-Level Ignores

```toml
# MyPy: ignore specific modules
[tool.mypy]
[[tool.mypy.overrides]]
module = "problematic_module.*"
ignore_errors = true

# Pyright: exclude paths
[tool.pyright]
exclude = ["src/problematic_module"]
```

## Performance Considerations

**MyPy:**
- Slower on large codebases
- Use `--cache-dir` for incremental checking
- Run in CI in separate job if slow

**Pyright:**
- Fast even on large codebases
- Watch mode (`pyright --watch`) works well
- Can run on every save in IDE

**Strategy:**
- Pyright in IDE (fast feedback)
- Both in CI (comprehensive)
- MyPy daemon (`dmypy`) if MyPy is slow

## Tooling Ecosystem

### MyPy Plugins

MyPy has plugins Pyright doesn't:
- django-stubs
- pydantic mypy plugin
- SQLAlchemy mypy plugin

If using these frameworks, MyPy is required.

### Pyright Integrations

- **Pylance**: VS Code extension
- **Pyright CLI**: Command-line checker
- **Language Server**: Works with any LSP editor

## Migration Strategies

### Adding Pyright to MyPy Project

1. Install Pyright: `npm install -g pyright` or use VS Code
2. Create `pyrightconfig.json` with basic mode
3. Run `pyright` - fix obvious errors
4. Gradually increase strictness
5. Keep MyPy running in CI

### Adding MyPy to Pyright Project

1. Install MyPy: `pip install mypy`
2. Add `[tool.mypy]` to pyproject.toml
3. Run `mypy` - fix errors
4. Add MyPy to CI
5. Keep Pyright for IDE

## Common Patterns

### Incremental Strictness

```toml
[tool.pyright]
typeCheckingMode = "basic"
strict = ["src/new_code/**"]

[tool.mypy]
[[tool.mypy.overrides]]
module = "new_code.*"
disallow_untyped_defs = true
```

New code strict, legacy code lenient.

### Separate Test Configuration

```toml
[tool.pyright]
exclude = ["tests"]

[tool.mypy]
[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false
```

Tests often need less strict checking.

## Decision Matrix

| Scenario                    | Recommendation                      |
| --------------------------- | ----------------------------------- |
| New project, VS Code team   | Start with Pyright only             |
| Existing MyPy project       | Add Pyright, keep MyPy              |
| Django/Pydantic/SQLAlchemy  | MyPy required (plugins)             |
| Performance critical        | Pyright primary, MyPy in CI         |
| Maximum safety              | Both, strict mode                   |
| Small project (<100 files)  | Either is fine                      |
| Large project (1000+ files) | Pyright for speed, MyPy for plugins |

## Troubleshooting

**"Different errors from each tool"**  
→ Expected. Each has different algorithms. Fix both.

**"MyPy too slow"**  
→ Use `dmypy` daemon or only run Pyright locally, MyPy in CI

**"Configuration conflicts"**  
→ Check you're using separate `[tool.pyright]` and `[tool.mypy]` sections

**"One tool stricter than other"**  
→ Increase the lenient tool's strictness, or accept the difference

**"Should I use both?"**  
→ If you want maximum type safety and have CI resources, yes

## Best Practices

1. **Run Pyright in IDE** - instant feedback
2. **Run both in CI** - catch all issues
3. **Keep configurations in sync** - similar strictness levels
4. **Don't duplicate settings** - each tool has separate config
5. **Fix for the stricter tool** - usually Pyright
6. **Use MyPy plugins when needed** - Pyright can't replace them
7. **Start basic, increase together** - don't jump to strict immediately

## References

- MyPy Configuration: https://mypy.readthedocs.io/en/stable/config_file.html
- Pyright Configuration: https://microsoft.github.io/pyright/#/configuration
- MyPy vs Pyright: https://microsoft.github.io/pyright/#/differences-from-mypy
