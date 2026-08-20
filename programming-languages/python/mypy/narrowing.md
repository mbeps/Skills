# Avoiding `Any`: Narrowing, `cast`, TypeGuard, Never

Sources: https://mypy.readthedocs.io/en/stable/type_narrowing.html · https://mypy.readthedocs.io/en/stable/more_types.html · https://mypy.readthedocs.io/en/stable/kinds_of_types.html

`Any` is compatible with (and from) every type — it **silences checking** and lets you "lie" to mypy. Prefer precise types. With `warn_return_any` (this repo), leaking `Any` from a return raises `[no-any-return]`.

## `object` vs `Any`
Use `object` (safe, requires narrowing) rather than `Any` (unsafe, no checks) for "unknown but real" values. Narrow with `assert isinstance`/`cast`/`TypeGuard`/`TypeIs`.

## Narrowing expressions
- `isinstance(x, T)` narrows within the `if` block; `elif`/`else` differ; outside the block the original type returns.
- `type(obj) is T`, `issubclass(cls, T)` (assign `type(o)` to a variable first — inline `issubclass(type(o), T)` won't narrow), `callable(obj)`.
- `x is not None` / `if x` / `if not x` narrow optionals; also within logical `and`/`or`.
- `assert isinstance(x, T)` / `assert x is not None` narrows in the current scope — for "I know better" (e.g. partially-initialized attributes). With `--warn-unreachable`, asserting an impossible narrow is an error.

## `cast` (typing hint only — NO runtime check)
```python
from typing import cast
o: object = [1]
x = cast(list[int], o)   # no runtime validation
```
- Use when mypy can't derive a safe-but-true relationship and an `assert` would add runtime cost.
- If you want a runtime check, use `assert isinstance(...)` instead.
- Don't cast to the already-inferred type → `[redundant-cast]` under `warn_redundant_casts`.
- `cast(Any, x)` is allowed but rarely desirable.
- This repo uses `cast()` to bridge an untyped helper to a typed shape:
  ```python
  return cast(dict[str, ScenarioInfo], load_hidden_json(wb, _SCENARIOS_SHEET))
  ```
  Prefer fixing the untyped helper's return type to `dict[str, T]` at the source rather than casting at every caller.

## `TypeGuard` (PEP 647) vs `TypeIs` (PEP 742)
```python
from typing import TypeGuard          # typing_extensions on <3.10
def is_str_list(val: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in val)
```
- `TypeGuard` narrows **only the `if` branch**; does NOT require the narrowed type to be a subtype (unsafe but permitted).
- `TypeIs` (py3.13 / typing_extensions) narrows **both branches** like `isinstance`, requires subtyping (`[narrowed-type-not-subtype]` otherwise). In methods, narrowing applies after `self`/`cls`.
- Choosing wrong silently loses narrowing (TypeIs) or adds spurious errors (TypeGuard).

## `Never` / `NoReturn`
```python
from typing import NoReturn
def stop() -> NoReturn:
    raise Exception('no way')
```
- `NoReturn`: function never returns; code after is unreachable.
- `Never` (bottom type): for exhaustive `else` branches (nothing can inhabit it). Use for clean exhaustive-match narrowing.

## Returning `Any` cleanly (avoiding `no-any-return`)
- Prefer returning a precise type.
- If a dependency returns `Any`, narrow with `assert`/`isinstance` or `cast` before returning from a typed function.
- If you genuinely must, make `Any` explicit in the annotation (never implicit) and confine it (test stubs / pass-through decorators). This repo uses `Callable[..., Any]` for pass-throughs:
  ```python
  def resource(self, *args: Any, **kwargs: Any) -> Callable[..., Any]: ...
  ```

## `reveal_type`
- `reveal_type(x)` prints the inferred type as a mypy `note` (debugging only — remove before commit).
- py3.11+ import from `typing`; older `typing_extensions`.
- With `enable_error_code=unimported-reveal`, an unimported `reveal_type` is an error.
