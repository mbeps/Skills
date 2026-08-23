# Common mypy Error Codes & Idiomatic Handling

Sources: https://mypy.readthedocs.io/en/stable/error_code_list.html (default-on) · https://mypy.readthedocs.io/en/stable/error_code_list2.html (opt-in)

Errors appear as `prog.py:1: error: ... [code]`. Silence one code on a line with `# type: ignore[code]`.

## Default-enabled codes (most common)
| Code                                                                   | Meaning                                            | Idiomatic fix                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `arg-type`                                                             | Arg type doesn't match signature                   | Fix the call or the callee signature.                                         |
| `return-value`                                                         | Returned value incompatible with return annotation | Fix return / annotation.                                                      |
| `assignment`                                                           | RHS incompatible with assignment target            | Fix the value or annotate the target.                                         |
| `var-annotated`                                                        | Can't infer type (empty container / `None` init)   | Add annotation: `self.items: list[str] = []`.                                 |
| `union-attr`                                                           | Attribute not on every union member                | `assert isinstance(x, Cls)` or `assert x is not None` to narrow.              |
| `index`                                                                | Invalid index type                                 | Fix index (e.g. `a[1]` on `dict[str, int]`).                                  |
| `call-arg`                                                             | Wrong number/names of arguments                    | Fix call (distinct from `arg-type`).                                          |
| `abstract`                                                             | Instantiating an ABC with unimplemented members    | Implement abstract members.                                                   |
| `attr-defined`                                                         | Attribute doesn't exist on the type                | Use a real attribute / define it.                                             |
| `return` / `empty-body`                                                | Missing return / empty body                        | Add return or `raise`.                                                        |
| `import` / `import-not-found` / `import-untyped`                       | Cannot find / no stubs for a module                | Install stubs, `# type: ignore[import-untyped]`, or `ignore_missing_imports`. |
| `operator`                                                             | Operands don't support the operator                | Narrow types first.                                                           |
| `list-item` / `dict-item` / `typeddict-item` / `typeddict-unknown-key` | Container item/key mismatch                        | Fix items or keys.                                                            |
| `override`                                                             | Override violates Liskov                           | Loosen/widen args, narrow return.                                             |
| `misc`                                                                 | Catch-all                                          | `# type: ignore[misc]`.                                                       |
| `no-overload-impl`                                                     | Overloads without an implementation                | Add a final implementation def.                                               |
| `call-overload`                                                        | No overload variant matches                        | Add a variant or fix the call.                                                |

## Opt-in codes (only with flags)
| Code                  | Enabled by                              | Meaning                                                                              |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| `no-untyped-def`      | `disallow_untyped_defs`                 | Function missing annotation.                                                         |
| `no-any-return`       | `warn_return_any`                       | Returning `Any` from a non-`Any`-annotated function.                                 |
| `no-untyped-call`     | `disallow_untyped_calls`                | Calling untyped fn from typed context.                                               |
| `redundant-cast`      | `warn_redundant_casts`                  | Casting to the already-inferred type.                                                |
| `unused-ignore`       | `warn_unused_ignores`                   | `# type: ignore` that silences nothing. Only silenced by naming the code explicitly. |
| `type-arg`            | `disallow_any_generics`                 | Bare generic (`list` instead of `list[int]`).                                        |
| `explicit-any`        | `disallow_any_explicit`                 | Explicit `Any` in an annotation.                                                     |
| `unreachable`         | `warn_unreachable`                      | Statement is unreachable/redundant.                                                  |
| `ignore-without-code` | `enable_error_code=ignore-without-code` | `# type: ignore` with no code (recommend always naming the code).                    |
| `explicit-override`   | `enable_error_code=explicit-override`   | Override missing `@override` (PEP 698).                                              |
| `possibly-undefined`  | `enable_error_code=possibly-undefined`  | Variable defined only on some paths.                                                 |
| `deprecated`          | `enable_error_code=deprecated`          | Using a `warnings.deprecated` feature (PEP 702).                                     |

**Subcodes:** `import-untyped`/`import-not-found` ⊆ `import`; `method-assign` ⊆ `assignment`; `typeddict-unknown-key` ⊆ `typeddict-item`; `prop-decorator` ⊆ `misc`.

## Idiomatic handling rules
- **Always name the error code** in `# type: ignore[code]`. A bare ignore hides all errors on the line (typos included).
- Prefer fixing the type over silencing. Reach for `# type: ignore` only at genuine untyped-boundary bridges.
- For `no-any-return`: narrow the value before returning (`assert isinstance` / `cast`) rather than ignoring.
- For `typeddict-item` on dynamic key writes: restructure to a typed helper or cast the dict shape once, then assign.
- For `index` on computed 2D lists (e.g. `computed[r][c]`): type the intermediate as `list[list[T]]` or cast once — avoid scattering ignores per access.
- When upgrading mypy, run with `warn_unused_ignores` to prune stale ignores (code is now fixed). The only way to silence `unused-ignore` itself is to name the code (`# type: ignore[...,unused-ignore]`).
