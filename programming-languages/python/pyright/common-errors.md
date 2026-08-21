# Pyright Common Errors and Solutions

Complete guide to understanding and fixing Pyright type errors.

## Error Categories

Pyright groups errors by severity and type:

| Severity | Meaning |
|----------|---------|
| **Error** | Code will likely fail or violate type safety |
| **Warning** | Suspicious but might be intentional |
| **Information** | Stylistic or optional improvements |

## Top 10 Most Common Errors

### 1. "Argument missing for parameter"

**Error:**
```
Argument missing for parameter "age"
```

**Code:**
```python
def greet(name: str, age: int) -> str:
    return f"Hello {name}, {age}"

greet("Alice")  # Error: missing age
```

**Fix:**
```python
greet("Alice", 30)  # Provide all arguments
```

### 2. "Type is partially unknown"

**Error:**
```
Type of "data" is partially unknown
Type of "data" is "list[Unknown]"
```

**Code:**
```python
data = []  # Pyright can't infer type
data.append("hello")
```

**Fix:**
```python
data: list[str] = []  # Explicit annotation
data.append("hello")
```

### 3. "Cannot access member for type"

**Error:**
```
Cannot access member "upper" for type "str | int"
Member "upper" is unknown
```

**Code:**
```python
def process(value: str | int) -> str:
    return value.upper()  # Error: int has no upper()
```

**Fix - Type narrowing:**
```python
def process(value: str | int) -> str:
    if isinstance(value, str):
        return value.upper()  # OK now
    return str(value)
```

### 4. "Return type is not specified"

**Error:**
```
Type of "calculate" is "(x: int, y: int) -> Unknown"
```

**Code:**
```python
def calculate(x: int, y: int):  # Missing return type
    return x + y
```

**Fix:**
```python
def calculate(x: int, y: int) -> int:
    return x + y
```

### 5. "Argument type is incompatible"

**Error:**
```
Argument of type "str" cannot be assigned to parameter "value" of type "int"
```

**Code:**
```python
def double(value: int) -> int:
    return value * 2

result = double("5")  # Error: str not int
```

**Fix:**
```python
result = double(5)  # Pass correct type
# OR convert
result = double(int("5"))
```

### 6. "Expression type is not assignable to declared type"

**Error:**
```
Expression of type "None" cannot be assigned to declared type "str"
```

**Code:**
```python
name: str = None  # Error: None is not str
```

**Fix:**
```python
name: str | None = None  # Allow None
# OR
name: str = "default"  # Don't use None
```

### 7. "Operator not supported for types"

**Error:**
```
Operator "+" not supported for types "int" and "str"
```

**Code:**
```python
result = 5 + "10"  # Error: can't add int and str
```

**Fix:**
```python
result = 5 + int("10")  # Convert first
# OR
result = str(5) + "10"  # Both strings
```

### 8. "Function with declared return type must return value"

**Error:**
```
Function with declared return type "int" must return value on all code paths
```

**Code:**
```python
def get_value(flag: bool) -> int:
    if flag:
        return 42
    # Error: no return on else path
```

**Fix:**
```python
def get_value(flag: bool) -> int:
    if flag:
        return 42
    return 0  # Return on all paths
```

### 9. "Untyped function definition"

**Error (strict mode):**
```
Function "process" is missing type annotation for one or more parameters
```

**Code:**
```python
def process(data):  # Error in strict mode
    return data.upper()
```

**Fix:**
```python
def process(data: str) -> str:
    return data.upper()
```

### 10. "Import could not be resolved"

**Error:**
```
Import "requests" could not be resolved
```

**Causes:**
- Module not installed
- Virtual environment not activated
- Type stubs missing

**Fix:**
```bash
# Install the package
pip install requests

# Install type stubs if available
pip install types-requests

# Or ignore if types not available
# pyright: ignore[reportMissingImports]
```

## Error Resolution Strategies

### 1. Fix the Root Cause (Best)

Understand what Pyright is telling you and fix the actual type issue.

```python
# Error: Argument type incompatible
def process(items: list[str]) -> None:
    ...

data = [1, 2, 3]
process(data)  # Error

# Fix: Make data the right type
data = ["1", "2", "3"]
process(data)  # OK
```

### 2. Type Narrowing

Use `isinstance`, `is None`, or other checks:

```python
def handle(value: int | str | None) -> str:
    if value is None:
        return "empty"
    
    if isinstance(value, int):
        return str(value)
    
    # Pyright knows value is str here
    return value.upper()
```

### 3. Type Casting (Use Sparingly)

When you know more than Pyright:

```python
from typing import cast

# You know data is dict[str, int] but Pyright sees Any
data = json.loads(text)
typed_data = cast(dict[str, int], data)
```

**Warning:** `cast()` doesn't validate at runtime. Only use when certain.

### 4. Type Guards

Custom type checking functions:

```python
from typing import TypeGuard

def is_str_list(val: list[Any]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in val)

def process(items: list[Any]) -> None:
    if is_str_list(items):
        # Pyright knows items is list[str]
        for item in items:
            print(item.upper())
```

### 5. Explicit Annotations

Tell Pyright what you intend:

```python
# Bad - Pyright infers list[Unknown]
items = []

# Good - Explicit type
items: list[str] = []
```

## Suppression (Last Resort)

### Per-Line Suppression

```python
# type: ignore - Suppress all errors on this line (MyPy and Pyright)
result = problematic_call()  # type: ignore

# pyright: ignore - Pyright only
result = problematic_call()  # pyright: ignore

# With specific error code (better)
result = problematic_call()  # pyright: ignore[reportGeneralTypeIssues]
```

### Per-File Suppression

```python
# At top of file
# pyright: reportGeneralTypeIssues=false, reportUnusedVariable=false
```

### Config-Level Suppression

```json
{
  "reportUnusedVariable": "none",
  "reportMissingTypeStubs": "warning"
}
```

## When to Suppress

**Acceptable reasons:**
- Third-party library with no type stubs
- Dynamic code that's validated at runtime
- Known limitation in type checker
- Temporary workaround with TODO

**Unacceptable reasons:**
- "Too many errors"
- Don't understand the error
- Want to ship faster
- Type checking is annoying

**Pattern:**
```python
# Good suppression: explain why
# pyright: ignore[reportGeneralTypeIssues] - TODO: Add types after upstream library updates
result = dynamic_call()

# Bad suppression: no explanation
result = dynamic_call()  # type: ignore
```

## Error Code Reference

Common error codes you can specify in suppressions:

| Code | Meaning |
|------|---------|
| `reportGeneralTypeIssues` | Generic type incompatibility |
| `reportOptionalMemberAccess` | Accessing member on possibly-None value |
| `reportOptionalSubscript` | Subscripting possibly-None value |
| `reportOptionalCall` | Calling possibly-None value |
| `reportUnusedVariable` | Variable defined but never used |
| `reportUnusedImport` | Import never used |
| `reportMissingImports` | Import cannot be resolved |
| `reportMissingTypeStubs` | No type stubs for library |
| `reportUnknownMemberType` | Member type is Unknown |
| `reportUntypedFunctionDecorator` | Decorator has no types |
| `reportPrivateUsage` | Accessing private member |

Full list: https://microsoft.github.io/pyright/#/configuration?id=type-check-diagnostics-settings

## Debugging Type Errors

### Use reveal_type (development only)

```python
# Python 3.11+: import from typing
from typing import reveal_type

data = get_data()
reveal_type(data)  # Pyright shows: Type of "data" is "list[str]"

# Python < 3.11: No import needed, Pyright understands it
# But it will cause runtime error, so comment out or remove
data = get_data()
reveal_type(data)  # Works in type checker only
```

**Important:** 
- Python 3.11+ has `reveal_type` in typing module (can run at runtime)
- Python < 3.11: `reveal_type` is type-checker-only (no import, runtime error)
- **Remove before committing!** Development tool only, not for production code

### Check Pyright's Inference

Hover over variables in VS Code (Pylance) to see inferred types.

### Enable Verbose Errors

```bash
pyright --verbose
```

### Check Type of Expression

```python
# What type does Pyright think this is?
value: int | str = get_value()

if isinstance(value, int):
    # Hover here to see narrowed type
    pass
```

## Advanced Error Patterns

### Invariant Containers

```python
# Error: list is invariant
def process_numbers(items: list[int]) -> None:
    ...

floats: list[float] = [1.0, 2.0]
process_numbers(floats)  # Error: list[float] != list[int]

# Fix: Use Sequence (covariant)
from collections.abc import Sequence

def process_numbers(items: Sequence[int | float]) -> None:
    ...

process_numbers(floats)  # OK
```

### Generic Class Issues

```python
from typing import Generic, TypeVar

T = TypeVar('T')

class Container(Generic[T]):
    def __init__(self, value: T) -> None:
        self.value = value

# Error: Can't infer T
container = Container()  # What's T?

# Fix: Provide type argument
container: Container[int] = Container(42)
# OR
container = Container[int](42)
```

### Callback Type Mismatches

```python
# Error: Callback return type mismatch
def register(callback: Callable[[], int]) -> None:
    ...

def my_callback() -> str:  # Returns str, not int
    return "done"

register(my_callback)  # Error

# Fix: Match signature
def my_callback() -> int:
    return 42
```

## Best Practices

1. **Read the error message** - Pyright is usually clear about what's wrong
2. **Hover in VS Code** - See inferred types
3. **Fix, don't suppress** - Suppression hides problems
4. **Add annotations early** - Easier than retrofitting
5. **Use type narrowing** - isinstance, is None, etc.
6. **Specific suppressions** - Use error codes, not blanket ignores
7. **Document suppressions** - Explain why it's needed
8. **Check control flow** - Pyright tracks if/else branches

## Common Mistake Patterns

### Mistake: Silencing Everything

```python
# Bad - Hides all issues
def process(data):  # type: ignore
    return data.something()
```

**Fix:** Add proper types instead.

### Mistake: Using Any

```python
# Bad - Defeats type checking
from typing import Any

def process(data: Any) -> Any:
    return data.something()
```

**Fix:** Use specific types or TypeVar.

### Mistake: Incomplete Narrowing

```python
def process(value: int | str | None) -> str:
    if isinstance(value, int):
        return str(value)
    # Error: might be None
    return value.upper()
```

**Fix:** Check all cases:
```python
def process(value: int | str | None) -> str:
    if isinstance(value, int):
        return str(value)
    if value is None:
        return "empty"
    return value.upper()  # Pyright knows it's str
```

## Getting Help

1. **Pyright GitHub Issues:** https://github.com/microsoft/pyright/issues
2. **Pylance Discussions:** https://github.com/microsoft/pylance-release/discussions
3. **Typing discourse:** https://discuss.python.org/c/typing/
4. **Check error code docs:** https://microsoft.github.io/pyright/#/configuration

## References

- Pyright Type Concepts: https://microsoft.github.io/pyright/#/type-concepts
- Diagnostic Rules: https://microsoft.github.io/pyright/#/configuration?id=type-check-diagnostics-settings
- Type Narrowing: https://microsoft.github.io/pyright/#/type-concepts?id=type-narrowing
