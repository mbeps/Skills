# Errors — reference

`ValidationError` is raised by Pydantic when validation fails (e.g. wrong type,
missing required field, `extra="forbid"` violation, `frozen` assignment).

## Structure

```python
from pydantic import BaseModel, ValidationError

try:
    M(x="bad")
except ValidationError as e:
    print(e.errors())   # list[dict]
```

Each error dict has keys:

| Key     | Meaning                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------ |
| `type`  | machine-readable error kind, e.g. `missing`, `int_parsing`, `extra_forbidden`, `frozen_instance` |
| `loc`   | path tuple of the failing field(s)                                                               |
| `msg`   | human-readable message                                                                           |
| `input` | the offending input value                                                                        |
| `url`   | link to the error docs                                                                           |
| `ctx`   | optional extra context                                                                           |

## Access patterns

- `e.errors()[0]['type']` — inspect the first error's kind.
- `e.error_count()` — number of errors.
- `e.json()` — JSON-serialized errors.
- `str(e)` — one-line summary.

## Common error types

- `extra_forbidden` — field not allowed (with `extra="forbid"`).
- `frozen_instance` — assignment to a `frozen=True` model (or frozen field).

## model_construct

`model_construct(**data)` performs **NO validation** — use only with trusted data.
It bypasses `ValidationError` entirely.
