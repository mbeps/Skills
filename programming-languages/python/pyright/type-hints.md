# Python Type Hints for Pyright

Comprehensive guide to writing type hints that Pyright understands.

## Basics

### Function Annotations

```python
def greet(name: str, age: int) -> str:
    return f"Hello {name}, you are {age}"

# With default values
def greet(name: str, age: int = 0) -> str:
    return f"Hello {name}"

# No return value
def log_message(message: str) -> None:
    print(message)
```

### Variable Annotations

```python
# Explicit annotation
count: int = 0
name: str = "Alice"

# Type can be inferred, but explicit is better for Pyright
items = []  # Pyright infers list[Unknown]
items: list[str] = []  # Better!

# Constants
MAX_SIZE: int = 100
```

## Modern Union Syntax (Python 3.10+)

```python
# PEP 604: Use | instead of Union
def process(value: int | str) -> bool:
    ...

# Optional with |
def find_user(id: int) -> User | None:
    ...

# Multiple types
def handle(data: int | float | str | None) -> None:
    ...
```

### Legacy Union Syntax (Python < 3.10)

```python
from typing import Union, Optional

def process(value: Union[int, str]) -> bool:
    ...

# Optional is shorthand for Union[X, None]
def find_user(id: int) -> Optional[User]:
    ...
```

## Collections

### Lists, Sets, Tuples

```python
# Python 3.9+: use built-in types
names: list[str] = ["Alice", "Bob"]
unique_ids: set[int] = {1, 2, 3}
coordinates: tuple[float, float] = (1.0, 2.0)

# Variable-length tuple
numbers: tuple[int, ...] = (1, 2, 3, 4, 5)

# Python < 3.9: from typing
from typing import List, Set, Tuple
names: List[str] = ["Alice", "Bob"]
```

### Dictionaries

```python
# Python 3.9+
user_ages: dict[str, int] = {"Alice": 30, "Bob": 25}

# Python < 3.9
from typing import Dict
user_ages: Dict[str, int] = {}
```

## Generic Types

### TypeVar - Type Variables

```python
from typing import TypeVar

T = TypeVar('T')

def first(items: list[T]) -> T:
    return items[0]

# With bounds (T must be str or bytes)
T = TypeVar('T', bound=str | bytes)

def process(value: T) -> T:
    return value.upper()  # OK, str and bytes have upper()

# With constraints (T must be exactly int or str, nothing else)
T = TypeVar('T', int, str)

def double(value: T) -> T:
    if isinstance(value, int):
        return value * 2
    return value + value  # type: ignore
```

### Modern Generic Syntax (Python 3.12+ PEP 695)

Python 3.12 introduced cleaner syntax for generic functions and classes:

```python
# Old way (still works)
from typing import TypeVar
T = TypeVar('T')

def first(items: list[T]) -> T:
    return items[0]

# Python 3.12+ way (cleaner)
def first[T](items: list[T]) -> T:
    return items[0]

# With bounds
def process[T: str | bytes](value: T) -> T:
    return value.upper()

# Generic class (Python 3.12+)
class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []
    
    def push(self, item: T) -> None:
        self._items.append(item)
    
    def pop(self) -> T:
        return self._items.pop()
```

**Use PEP 695 syntax when:**
- Python 3.12+ only project
- Want cleaner, more readable code
- Pyright fully supports it

**Use TypeVar when:**
- Need Python 3.11 or earlier compatibility
- Complex bounds with multiple inheritance

### Generic Classes

```python
from typing import Generic, TypeVar

T = TypeVar('T')

class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []
    
    def push(self, item: T) -> None:
        self._items.append(item)
    
    def pop(self) -> T:
        return self._items.pop()

# Usage
int_stack: Stack[int] = Stack()
int_stack.push(5)
```

## Protocol - Structural Subtyping

Use Protocol when you care about "has these methods" not "inherits from this class".

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> str:
        ...

# Any class with a draw() method satisfies Drawable
class Circle:
    def draw(self) -> str:
        return "○"

class Square:
    def draw(self) -> str:
        return "□"

def render(shape: Drawable) -> None:
    print(shape.draw())

render(Circle())  # OK
render(Square())  # OK
```

### Protocol vs ABC

**Use Protocol when:**
- Third-party classes you can't modify
- Duck typing / structural compatibility
- Lighter coupling

**Use ABC when:**
- You control the inheritance hierarchy
- Need runtime checks (`isinstance`)
- Want to enforce implementation

## Function Overloading

Use `@overload` for functions with different signatures:

```python
from typing import overload

@overload
def process(data: int) -> str:
    ...

@overload
def process(data: str) -> int:
    ...

def process(data: int | str) -> int | str:
    if isinstance(data, int):
        return str(data)
    return len(data)
```

**Rules:**
- Multiple `@overload` signatures
- One implementation without `@overload`
- Implementation signature must be compatible with all overloads

## Avoiding Any

`Any` disables type checking. Avoid it.

### Bad - Using Any

```python
def process(data: Any) -> Any:  # Type checking disabled!
    return data.something()  # No error even if wrong
```

### Good - Be Specific

```python
from typing import TypeVar

T = TypeVar('T')

def process(data: T) -> T:
    # Can only do operations valid for all types
    return data
```

### When Any is Acceptable

```python
# Truly dynamic data (JSON, user input)
def parse_json(text: str) -> Any:
    return json.loads(text)

# Immediately narrowed
def parse_json(text: str) -> Any:
    data = json.loads(text)
    assert isinstance(data, dict)
    return data  # But better to return dict[str, Any]
```

## Advanced Patterns

### TypedDict

For dictionary schemas:

```python
from typing import TypedDict

class User(TypedDict):
    name: str
    age: int
    email: str

def create_user(name: str, age: int, email: str) -> User:
    return {"name": name, "age": age, "email": email}

user: User = create_user("Alice", 30, "alice@example.com")
print(user["name"])  # Pyright knows this is str
```

### Literal Types

For specific values:

```python
from typing import Literal

def set_mode(mode: Literal["read", "write", "append"]) -> None:
    ...

set_mode("read")  # OK
set_mode("delete")  # Error: not in Literal
```

### Callable

For function types:

```python
from typing import Callable

def apply(func: Callable[[int, int], int], a: int, b: int) -> int:
    return func(a, b)

def add(x: int, y: int) -> int:
    return x + y

result = apply(add, 5, 3)  # OK
```

Syntax: `Callable[[arg1_type, arg2_type], return_type]`

### ParamSpec and Concatenate

For decorators preserving signatures:

```python
from typing import Callable, ParamSpec, TypeVar

P = ParamSpec('P')
R = TypeVar('R')

def log_calls(func: Callable[P, R]) -> Callable[P, R]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log_calls
def greet(name: str, age: int) -> str:
    return f"Hello {name}, age {age}"

# Pyright preserves exact signature
result = greet("Alice", 30)  # Type-safe!
```

## Type Narrowing

Pyright uses control flow to narrow types:

```python
def process(value: int | str | None) -> str:
    if value is None:
        return "No value"
    # value is int | str here
    
    if isinstance(value, int):
        return str(value)
    # value is str here
    
    return value.upper()  # OK
```

### Type Guards

```python
from typing import TypeGuard

def is_str_list(val: list[Any]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in val)

def process(items: list[Any]) -> None:
    if is_str_list(items):
        # Pyright knows items is list[str] here
        for item in items:
            print(item.upper())  # OK
```

## Import Practices

### Python 3.9+

```python
# Use built-in generics
names: list[str] = []
mapping: dict[str, int] = {}

# Import only special types
from typing import Protocol, TypeVar, Generic, TypedDict
```

### Python < 3.9

```python
from typing import List, Dict, Set, Tuple, Optional, Union
```

### typing_extensions

For newer features on older Python:

```python
# Python 3.7 or 3.8 but want TypedDict
from typing_extensions import TypedDict

# Python 3.9 but want ParamSpec
from typing_extensions import ParamSpec
```

## Common Type Hint Mistakes

| Mistake | Fix |
|---------|-----|
| `def func(x) -> int:` | Add parameter type: `def func(x: int) -> int:` |
| `items = []` | Annotate: `items: list[str] = []` |
| `Union[str, None]` | Use `str | None` (Python 3.10+) or `Optional[str]` |
| `List[str]` (Python 3.9+) | Use `list[str]` |
| `return None` but no `-> None` | Add `-> None` return type |
| Using `Any` unnecessarily | Be specific or use TypeVar |
| Missing imports from typing | Import TypeVar, Protocol, etc. |

## Best Practices

1. **Always annotate function parameters and returns** - Pyright's most important check
2. **Use modern syntax** - `list[str]` not `List[str]` on Python 3.9+
3. **Avoid Any** - Be as specific as possible
4. **Use Protocol for duck typing** - Cleaner than ABCs for structural types
5. **Type narrow with isinstance** - Pyright tracks control flow
6. **Annotate class attributes** - In `__init__` or class body
7. **Use Literal for string enums** - Better than plain strings
8. **Prefer | over Union** - More readable (Python 3.10+)

## References

- PEP 484 (Type Hints): https://peps.python.org/pep-0484/
- PEP 604 (| unions): https://peps.python.org/pep-0604/
- Typing module: https://docs.python.org/3/library/typing.html
- Pyright Advanced Types: https://microsoft.github.io/pyright/#/type-concepts-advanced
