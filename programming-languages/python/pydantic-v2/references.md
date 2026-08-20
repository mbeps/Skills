# References

## Canonical doc URLs

- Models: https://pydantic.dev/docs/validation/latest/concepts/models/
- Fields: https://pydantic.dev/docs/validation/latest/concepts/fields/
- Validators: https://pydantic.dev/docs/validation/latest/concepts/validators/
- Config: https://pydantic.dev/docs/validation/latest/concepts/config/
  and https://pydantic.dev/docs/validation/latest/api/pydantic/config/
- Serialization: https://pydantic.dev/docs/validation/latest/concepts/serialization/
- Types: https://pydantic.dev/docs/validation/latest/concepts/types/
- Unions: https://pydantic.dev/docs/validation/latest/concepts/unions/
- TypeAdapter: https://pydantic.dev/docs/validation/latest/concepts/type_adapter/
- Errors: https://pydantic.dev/docs/errors/errors/
  and https://pydantic.dev/docs/errors/validation_errors/

## Version notes — 2.12 vs 2.13-only

| Feature                                                                           | Available in  |
| --------------------------------------------------------------------------------- | ------------- |
| `exclude_if` (Field)                                                              | 2.12          |
| `ser_json_temporal`                                                               | 2.12          |
| `validate_by_name` / `validate_by_alias` (replaces deprecated `populate_by_name`) | 2.11–2.12     |
| `default_factory` taking previously-validated data                                | 2.10          |
| `computed_field(exclude_if=...)`                                                  | **2.13-only** |
| `polymorphic_serialization`                                                       | **2.13-only** |
| `RootModel[Literal[...]]` as discriminator member                                 | **2.13-only** |
| private-attr default factories taking data                                        | **2.13-only** |

This project is pinned to **pydantic 2.12.5**. Treat anything marked 2.13-only as
**not available** here. Mark uncertain facts with `[verify]` rather than asserting
them.
