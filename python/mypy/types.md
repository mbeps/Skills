# Types: TypedDict, Aliases, NewType, Generics, Protocol, overload, PEP 604/695

Sources: https://mypy.readthedocs.io/en/stable/typed_dict.html · https://mypy.readthedocs.io/en/stable/kinds_of_types.html · https://mypy.readthedocs.io/en/stable/generics.html · https://mypy.readthedocs.io/en/stable/protocols.html · https://mypy.readthedocs.io/en/stable/more_types.html

## PEP 604 / PEP 484 unions
```python
def f(x: int | None) -> int | None: ...   # PEP 604, preferred
def g(x: Optional[int]) -> Optional[int]: ...  # legacy
```
- `Optional[X]` ≡ `Union[X, None]` ≡ `X | None`. Prefer `X | None` on py3.10+.
- On 3.9 and older, `int | str` needs `from __future__ import annotations`.
- **`Optional[T]` does NOT mean "has a default"** — it means `None` is a valid value.
- Operations on a union require narrowing first (`isinstance`); avoid unions as returns when callers must narrow to do anything.

## TypedDict (dict-shaped outputs)
```python
from typing import TypedDict, NotRequired, Required  # NotRequired/Required: typing on 3.11+, else typing_extensions

class Movie(TypedDict):
    name: str
    year: int

class Profile(TypedDict):
    user_id: Required[int]
    nickname: NotRequired[str]
```
- Default all keys required. `total=False` makes all keys optional.
- To mix required/optional keys in a class body, use inheritance (this repo's house style) instead of `total=False` mixing:
  ```python
  class _SheetDefinitionBase(TypedDict):
      name: str
  class SheetDefinition(_SheetDefinitionBase, total=False):
      headers: list[str]
      data: list[list[object]]
  ```
- **Not a runtime type** — a TypedDict is a regular `dict` at runtime; cannot `isinstance()` to discriminate.
- Only string literals as keys → `[literal-required]` for computed keys.
- A TypedDict is NOT a subtype of `dict[...]`, but IS compatible with `Mapping[str, object]` (read-only).
- `clear()`/`popitem()` disallowed under structural subtyping; `pop`/`del` allowed only on `total=False` TypedDicts.

### TypedDict vs dataclass vs Pydantic
| Concern                            | TypedDict | dataclass/class | Pydantic |
| ---------------------------------- | --------- | --------------- | -------- |
| Data is a structured dict/JSON     | **Best**  | Awkward         | Good     |
| Need validation/coercion           | No        | No              | **Yes**  |
| Need methods/behavior              | No        | **Yes**         | Yes      |
| Runtime `isinstance`               | No        | **Yes**         | Yes      |
| Type-check-only, zero runtime cost | **Yes**   | No              | No       |

Rule: TypedDict for genuinely-dict data; class/dataclass for behavior/methods/identity; Pydantic when you need validation/coercion at the boundary.

## Type aliases
```python
AliasType = list[dict[tuple[int, str], set[int]]] | tuple[str, list[str]]      # implicit (oldest)
AliasType: TypeAlias = list[dict[tuple[int, str], set[int]]] | tuple[str, list[str]]  # PEP 613
type AliasType = list[dict[tuple[int, str], set[int]]] | tuple[str, list[str]]  # PEP 695 (3.12+)
```
- Use explicit `TypeAlias` (PEP 613) or `type` statement (PEP 695, 3.12+) when the RHS is ambiguous or has forward refs.
- PEP 695 `type` is lazy → supports forward/recursive refs without string escaping.
- **PEP 695 `type` aliases can't be base classes or instantiated** (old-style aliases can).
- **House style note:** this repo uses `TypeAlias` (`CellScalar: TypeAlias = ...`), not the `type` statement — replicate that. The PEP 695 `type` statement is a valid alternative on py3.12+, but stay consistent with the existing codebase.
- Unsubscripted generic alias → type params become `Any`.

## NewType vs TypeAlias
```python
from typing import NewType
UserId = NewType('UserId', int)   # distinct type
```
- **NewType** = entirely new distinct type; requires explicit conversion `int` → `UserId`, but `UserId` → `int` is implicit (subtype). Use to catch mixing-up bugs.
- **TypeAlias** = pure synonym; `int` ≡ `UserId` interchangeable. Use for readability only.
- NewType constraints: target must be a subclassable class (not union/`Any`/TypedDict) → else `[valid-newtype]`; callable accepts exactly one arg; cannot `isinstance`/`issubclass`/subclass the result.
- This repo deliberately uses neither (YAGNI) — add only if cross-type mixing is a real risk.

## Generics / TypeVar / Self / ParamSpec
```python
# PEP 695 (3.12+, preferred): no TypeVar needed
class Stack[T]:
    def __init__(self) -> None: self.items: list[T] = []
    def push(self, item: T) -> None: ...
    def pop(self) -> T: ...

def first[S](seq: Sequence[S]) -> S: ...

# legacy (pre-3.12, still supported)
T = TypeVar('T')
class Stack(Generic[T]): ...
```
- **Variance:** new syntax infers automatically (read-only/`_`-prefixed field can be covariant); legacy defaults to **invariant** — use `TypeVar('T_co', covariant=True)`.
- Upper bounds: `T: SupportsAbs[float]` (new) ≡ `TypeVar('T', bound=...)` (legacy).
- Value constraints: `T: (str, bytes)` (new) ≡ `TypeVar('T', str, bytes)` (legacy); rejects `str | bytes` combos; cannot have both constraints and a bound.
- New-syntax type params aren't shared across defs and don't exist at runtime; legacy `TypeVar` does. Can mix in one file, not within one class.
- Cannot call generic with explicit args: `first[int]([1,2])` is an error — types always inferred.
- **`Self` (PEP 673)** preferred over generic-self:
  ```python
  from typing import Self
  class Friend:
      @classmethod
      def make_pair(cls) -> tuple[Self, Self]: ...
  ```
- **`ParamSpec`** for signature-preserving decorators:
  ```python
  def printing_decorator[**P, T](func: Callable[P, T]) -> Callable[P, T]:
      def wrapper(*args: P.args, **kwds: P.kwargs) -> T: return func(*args, **kwds)
      return wrapper
  ```
  Use `Concatenate[str, P]` to prepend an arg. An untyped decorator erases types → `[untyped-decorator]` under strict.

## Protocol (structural subtyping, PEP 544)
```python
from typing import Protocol
class SupportsClose(Protocol):
    def close(self) -> None: ...
```
- Any class with compatible members satisfies the protocol (no inheritance needed).
- Subclassing a protocol does NOT make the subclass a protocol — `Protocol` must be in bases explicitly.
- **Protocol attributes are invariant** — use `@property` for read-only to accept narrower concrete types.
- `@runtime_checkable` enables `isinstance()` — but checks only member *existence*, not types, and can be slow.
- Callback protocols: `__call__` with exact param names (unless positional-only `/`).
- Generic protocols: `class Box[T](Protocol)` (new) ≡ `class Box(Protocol[T])` (legacy).

## overload
```python
@overload
def mouse_event(x1: int, y1: int) -> ClickEvent: ...
@overload
def mouse_event(x1: int, y1: int, x2: int, y2: int) -> DragEvent: ...
def mouse_event(x1: int, y1: int, x2: int | None = None, y2: int | None = None) -> ClickEvent | DragEvent: ...
```
- Variants (empty bodies, conventionally `...`) followed by exactly one implementation, all adjacent.
- Calls are checked against variants, never the implementation.
- **Multiple matches → first variant wins; `Any` arg → `Any` result; union arg → union of returns.** Order variants most-specific-first, matching runtime checks — else `[overload-overlap]`/`[overload-cannot-match]`.

## House-style summary for this repo
TypedDict for outputs, BaseModel for validated schemas, `Literal[...]` (inline + module-level aliases), PEP 604 unions, `TypeAlias`, built-in lowercase generics, `tuple[str, ...]` for homogeneous tuples, nested generics (`list[list[T]]`). No NewType/Protocol/TypeVar/NotRequired unless truly needed.
