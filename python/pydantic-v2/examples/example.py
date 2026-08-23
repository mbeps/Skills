"""Self-contained runnable self-check for the pydantic-v2 skill.

Plain asserts, no pytest. Run:  python examples/example.py
"""

from __future__ import annotations

from datetime import datetime
from typing import TypedDict, TypeAlias
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    ValidationError,
    field_validator,
    model_validator,
)
from pydantic.errors import PydanticSchemaGenerationError
import pydantic_core


# 1. BaseModel with Field(..., description=...) house style
class SheetSummary(BaseModel):
    """High-level summary of a worksheet's contents."""

    name: str = Field(..., description="Name of the worksheet.")
    row_count: int = Field(..., description="Total number of used rows.")
    headers: list[str] = Field(
        ..., description="Column header values from the first row."
    )


# 2. TypedDict output + TypeAlias scalar union (house style)
CellScalar: TypeAlias = str | int | float | bool | datetime | None


class RegressionResult(TypedDict, total=False):
    r_squared: float
    coefficients: dict[str, float]
    n_observations: int


# 3. model_dump() at a boundary (no-arg)
s = SheetSummary(name="Sheet1", row_count=10, headers=["A", "B"])
raw = s.model_dump()
assert raw == {"name": "Sheet1", "row_count": 10, "headers": ["A", "B"]}


# 4. field_validator + model_validator(mode='after') returning self
class Person(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def normalize(self):
        self.name = self.name.title()
        return self


p = Person(name="  ada  ")
assert p.name == "Ada"


# 5. TypeAdapter on a TypedDict and on list[int]
ad_typed = TypeAdapter(RegressionResult)
assert (
    ad_typed.validate_python({"r_squared": 0.9, "n_observations": 5})["r_squared"]
    == 0.9
)

ad_list = TypeAdapter(list[int])
assert ad_list.validate_python([1, 2, 3]) == [1, 2, 3]
assert ad_list.dump_json([1, 2, 3]) == b"[1,2,3]"  # bytes, unlike model_dump_json

# TypeAdapter must NOT be used as a field annotation
try:

    class Bad(BaseModel):
        x: TypeAdapter(int)

    raise AssertionError("TypeAdapter as field annotation should fail")
except PydanticSchemaGenerationError:
    pass


# 6. ValidationError catching via e.errors()[0]['type']
class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: int


try:
    Strict(x=1, extra=2)
    raise AssertionError("extra='forbid' should raise")
except ValidationError as e:
    assert e.errors()[0]["type"] == "extra_forbidden"


# 7. KNOWN gotcha: ser_json_temporal='rfc3339' raises pydantic_core.SchemaError
#    at CLASS DEFINITION time (when the serializer is built), not at instantiation.
try:

    class Temporal(BaseModel):
        model_config = ConfigDict(ser_json_temporal="rfc3339")
        dt: datetime

    raise AssertionError("rfc3339 is not a valid ser_json_temporal value")
except pydantic_core.SchemaError:
    pass


# valid values serialize fine
class TemporalIso(BaseModel):
    model_config = ConfigDict(ser_json_temporal="iso8601")
    dt: datetime


assert '"dt"' in TemporalIso(dt=datetime(2024, 1, 1)).model_dump_json()

print("PASS: pydantic-v2 example")
