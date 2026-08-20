# Types & Unions — reference

## PEP 604 unions

`int | str` is fully supported. `Optional[X]` == `X | None`.

```python
CellScalar: TypeAlias = str | int | float | bool | datetime | date | None
```

## Literal (NOT Enum)

Constrained string values. Used in this repo instead of `Enum`.

```python
BorderStyle = Literal["dashDot", "dashed", "double", "hair", "thin", ...]
```

## TypeAlias

`TypeAlias` from `typing` for shared scalar unions — keeps a single definition in
`models/common.py` that models import.

## Annotated

`Annotated[T, Field(...)]` attaches metadata to a type without a `BaseModel` field.

**Placement caveat:** when mixing with a union of `None`, put the `Field` inside the
`Annotated` and the `| None` outside:

```python
# OK
Annotated[int, Field(gt=0)] | None
# vs
Annotated[int | None, Field(gt=0)]   # Field applies to the whole union
```

`Annotated[int|None, Field(...)]` is not the same as `Annotated[int, Field(...)] | None`.

## Discriminated unions

- Via `Field(discriminator='field')` on the union.
- Or `Annotated[Union[...], Discriminator(...)]` / `Tag(...)` callables.
- Default `union_mode='smart'` in 2.12.
- `RootModel[Literal[...]]` as a discriminator member is **v2.13-only**.
