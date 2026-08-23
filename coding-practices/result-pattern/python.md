# Result Pattern in Python

## Typing-based approach (stdlib only)

Dataclasses as variants + a `Literal` reason tag + structural `match` narrowing.

```python
from dataclasses import dataclass
from typing import Literal

type Reason = Literal["not_found", "invalid_input"]


@dataclass(frozen=True, slots=True)
class Ok[T]:
    value: T


@dataclass(frozen=True, slots=True)
class Err[E]:
    reason: Reason
    detail: str


type Result[T, E] = Ok[T] | Err[E]
```

`ponytail:` PEP 695 generic dataclass syntax requires Python 3.12+. On 3.10–3.11 use `@dataclass class Ok(Generic[T])` and `Result = Union[Ok[T], Err[E]]`.

### Service

```python
def create_user(email: str) -> Result[dict, Err]:
    if "@" not in email:
        return Err("invalid_input", f"bad email: {email}")
    if repo.exists(email):
        return Err("invalid_input", f"taken: {email}")
    return Ok(repo.insert(email=email))
```

### Consumer — match narrows both variant and fields

```python
match create_user(form.email):
    case Ok(user):
        redirect(f"/users/{user['id']}")
    case Err(reason="invalid_input", detail=detail):
        render_error(detail)
```

For non-exhaustive checks, plain `isinstance` works too:

```python
r = create_user(email)
if isinstance(r, Err):
    log.warning("%s: %s", r.reason, r.detail)
```

## rustedpy/result package — archived

[`result`](https://github.com/rustedpy/result) (`pip install result`) provides Rust-style results:

```python
from result import Err, Ok, Result, is_err, is_ok

def parse(text: str) -> Result[int, str]:
    try:
        return Ok(int(text))
    except ValueError:
        return Err("not an int")

r = parse("42")
if is_ok(r):          # module-level type guards — MyPy narrows these,
    print(r.ok_value) # NOT the .is_ok() method
elif is_err(r):
    print(r.err_value)
```

### Combining multiple results

No stdlib zip; combine manually:

```python
def zip2[T, U, E](a: Result[T, E], b: Result[U, E]) -> Result[tuple[T, U], E]:
    match (a, b):
        case Ok(x), Ok(y): return Ok((x, y))
        case Err(e), _:    return Err(e)
        case _, Err(e):    return Err(e)
```

Async results are out of scope; they compose as `Coroutine[Result[T, E]]` — just `await` each and propagate manually.

API highlights: `unwrap()` (raises `UnwrapError` on Err), `unwrap_or(default)`, `map`, `map_err`, `and_then`, `do(...)` do-notation, `@as_result(ValueError)` decorator converting throwers to Result-returners.

**Warning:** rustedpy/result is **archived and unmaintained as of mid-2026** (README banner). Still widely used, but for new code prefer the hand-rolled typing approach above — it's ~20 lines and has no dependency risk.
