# Serialization — reference

`model_dump`, `model_dump_json`, and `TypeAdapter`. For THIS repo's idiom
(no-arg `model_dump()` at boundaries) see `house-style.md`.

## model_dump / model_dump_json

- `model_dump()` — **python mode** (default). Tuples stay tuples.
- `model_dump(mode='json')` — JSON-compatible types; tuples become lists.
- `model_dump_json()` — returns a `str` (JSON string).

Common params:

| Param                 | Effect                                      |
| --------------------- | ------------------------------------------- |
| `by_alias`            | use field aliases                           |
| `exclude` / `include` | field selection (sets or mappings)          |
| `exclude_unset`       | omit fields never set                       |
| `exclude_none`        | omit `None` values                          |
| `exclude_defaults`    | omit fields at their default                |
| `round_trip`          | validate output back in                     |
| `serialize_as_any`    | serialize union types as their runtime type |
| `context`             | pass serializer context                     |

## ser_json_temporal

`ConfigDict(ser_json_temporal=...)` controls how datetimes serialize in JSON mode.
Valid values: **`['iso8601', 'seconds', 'milliseconds']`**, default `'iso8601'`.
`'rfc3339'` is **NOT valid** — it raises:

```
pydantic_core.SchemaError: Invalid TemporalMode serialization mode: rfc3339,
expected iso8601 or seconds or milliseconds
```

(Verified under 2.12.5.) `microseconds` / `iso8601-utc` are not documented — do
not assert them.

## TypeAdapter

```python
from pydantic import TypeAdapter
```

For **non-BaseModel types** (TypedDict, unions, primitives, `list[Item]`).

Methods: `validate_python`, `validate_json`, `validate_strings`, `dump_python`,
`dump_json`, `json_schema`.

- **`TypeAdapter.dump_json` returns `bytes`** (BaseModel.model_dump_json returns `str`).
- **Do NOT use TypeAdapter as a field annotation** — it causes a schema-generation
  error (`PydanticSchemaGenerationError`).
- **Reuse a single adapter instance** — schema building is expensive.

```python
TA = TypeAdapter(list[int])
TA.validate_python([1, 2, 3])   # [1, 2, 3]
TA.dump_json([1, 2, 3])         # b'[1,2,3]'
```
