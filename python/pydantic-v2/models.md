# Models — reference

Broader Pydantic v2 knowledge about `BaseModel`, `ConfigDict`, and `Field()`
constraints. For THIS repo's actual idiom see `house-style.md`.

## BaseModel

```python
from pydantic import BaseModel, Field

class Item(BaseModel):
    name: str
    price: float = Field(default=0.0)
```

- Instantiate with keyword args; validation runs eagerly. (`lazy=True` is a **v2.13** feature, NOT available in 2.12.)
- `model_validate(obj)` validates arbitrary objects; `model_validate_json(s)` parses JSON.
- `model_construct(**data)` performs **NO validation** — trusted data only.

## ConfigDict (`model_config`)

```python
class M(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    x: int
```

- `extra`: `'ignore'` (default) | `'forbid'` (raises `ValidationError` with
  `type=extra_forbidden`) | `'allow'` (extra stored in `__pydantic_extra__`).
- `frozen=True`: blocks `__setattr__` (raises `ValidationError` `type=frozen_instance`)
  AND generates `__hash__`. Not deep — nested dicts remain mutable.
- `from_attributes=True`: ORM-style validation via attribute lookup.
- `revalidate_instances`: `'never'` (default) | `'always'` | `'subclass-instances'`.
- `validate_assignment=True`: re-validate on attribute assignment.
- `populate_by_name` is **not recommended in v2.11+** (will be deprecated in v3)
  — prefer `validate_by_name` and `validate_by_alias`.
- `ser_json_temporal`: valid values `['iso8601','seconds','milliseconds']`, default
  `'iso8601'`. `'rfc3339'` is NOT valid (raises `pydantic_core.SchemaError`).

## Field() constraints

`Field(default, ...)` accepts (all optional):

| Constraint                         | Applies to     | Notes                                                        |
| ---------------------------------- | -------------- | ------------------------------------------------------------ |
| `gt`, `ge`, `lt`, `le`             | numeric        | strict bounds                                                |
| `multiple_of`                      | numeric        |                                                              |
| `min_length`, `max_length`         | str/bytes/list |                                                              |
| `pattern`                          | str            | regex                                                        |
| `min_digits`, `max_digits`         | Decimal        |                                                              |
| `strict`                           | any            | reject coercion                                              |
| `frozen`                           | field          | immutable per-field                                          |
| `title`, `description`, `examples` | any            | schema metadata                                              |
| `deprecated`                       | any            | **v2.7+**                                                    |
| `exclude`                          | any            | omit from dump/schema                                        |
| `exclude_if`                       | any            | **NEW in 2.12** — omit if a condition holds                  |
| `validate_default`                 | any            | run validators on defaults                                   |
| `repr`                             | any            | include in `repr`                                            |
| `default_factory`                  | any            | callable; can take previously-validated data since **v2.10** |

```python
class C(BaseModel):
    price: float = Field(gt=0)
    count: int = Field(ge=0, le=100, examples=[10])
    name: str = Field(min_length=2, max_length=5)
```

## Behavior notes

- `extra=ignore` (default) silently drops unknown fields; `forbid` raises.
- `frozen=True` is not deep — nested mutable containers are still mutable.
- `validate_default=False` (default) means **validators do NOT run on defaults**.
- `use_enum_values` doesn't affect enum defaults unless `validate_default=True`.
- `protected_namespaces` default changed in v2.10 to `('model_validate','model_dump')`.
