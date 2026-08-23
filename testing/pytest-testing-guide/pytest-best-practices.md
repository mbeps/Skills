# Comprehensive Pytest Best Practices Guide

Grounded in official pytest 8.x/9.x documentation (docs.pytest.org/en/stable/).

---

## 1. Fixtures

### Requesting Fixtures

Tests request fixtures by declaring them as function arguments. pytest matches argument names to fixture functions:

```python
import pytest

@pytest.fixture
def fruit_bowl():
    return ["apple", "banana"]

def test_fruit_salad(fruit_bowl):
    assert len(fruit_bowl) == 2
```

Fixtures can request other fixtures — dependency injection chain:

```python
@pytest.fixture
def first_entry():
    return "a"

@pytest.fixture
def order(first_entry):
    return [first_entry]

def test_string(order):
    order.append("b")
    assert order == ["a", "b"]
```

Each test gets its own fresh instance — no shared mutable state between tests.

### Fixture Scopes

| Scope      | Lifetime                             |
| ---------- | ------------------------------------ |
| `function` | Default. Teardown after each test.   |
| `class`    | Teardown after last test in class.   |
| `module`   | Teardown after last test in module.  |
| `package`  | Teardown after last test in package. |
| `session`  | Teardown at end of entire test run.  |

```python
@pytest.fixture(scope="module")
def smtp_connection():
    conn = smtplib.SMTP("smtp.gmail.com", 587, timeout=5)
    yield conn
    conn.close()
```

**Dynamic scope** (pytest 5.2+): pass a callable that returns a scope string:

```python
def determine_scope(fixture_name, config):
    if config.getoption("--keep-containers"):
        return "session"
    return "function"

@pytest.fixture(scope=determine_scope)
def docker_container():
    yield spawn_container()
```

### Yield-Based Teardown (Recommended)

Use `yield` instead of `return` when teardown is needed:

```python
@pytest.fixture
def mail_admin():
    client = MailAdminClient()
    yield client
    # Teardown runs regardless of test outcome
    client.cleanup()

@pytest.fixture
def sending_user(mail_admin):
    user = mail_admin.create_user()
    yield user
    mail_admin.delete_user(user)
```

**Safe teardown structure**: make each fixture do one atomic state-changing action so failures don't leave resources behind:

```python
@pytest.fixture(scope="class")
def user(admin_client):
    _user = User(name="Susan", username=f"testuser-{uuid4()}")
    admin_client.create_user(_user)
    yield _user
    admin_client.delete_user(_user)  # Only reached if create succeeded

@pytest.fixture(scope="class")
def driver():
    _driver = Chrome()
    yield _driver
    _driver.quit()
```

### Adding Finalizers Directly

Alternative to yield (more verbose):

```python
@pytest.fixture
def receiving_user(mail_admin, request):
    user = mail_admin.create_user()
    def delete_user():
        mail_admin.delete_user(user)
    request.addfinalizer(delete_user)
    return user
```

Finalizers execute in **first-in-last-out** order.

### Autouse Fixtures

Automatically activated for all tests that can see them:

```python
@pytest.fixture(autouse=True)
def append_first(order, first_entry):
    order.append(first_entry)

def test_string_only(order, first_entry):
    assert order == [first_entry]
```

### Parametrized Fixtures

```python
@pytest.fixture(params=["smtp.gmail.com", "mail.python.org"])
def smtp_connection(request):
    conn = smtplib.SMTP(request.param, 587, timeout=5)
    yield conn
    conn.close()
```

Tests using this fixture run once per param value. Test IDs appear as `test_name[param_value]`.

Custom IDs:

```python
@pytest.fixture(params=[0, 1], ids=["spam", "ham"])
def a(request):
    return request.param

# Or with an ID function
def idfn(fixture_value):
    return f"eggs" if fixture_value == 0 else None

@pytest.fixture(params=[0, 1], ids=idfn)
def b(request):
    return request.param
```

Marks on parametrized fixtures via `pytest.param`:

```python
@pytest.fixture(params=[
    0, 1,
    pytest.param(2, marks=pytest.mark.skip),
])
def data_set(request):
    return request.param
```

### Factories as Fixtures

When you need multiple instances in one test:

```python
@pytest.fixture
def make_customer_record():
    created_records = []
    def _make_customer_record(name):
        record = Customer(name=name)
        created_records.append(record)
        return record
    yield _make_customer_record
    for record in created_records:
        record.destroy()
```

### Fixture Inheritance / Overriding via conftest.py

Fixtures override by name at different directory levels:

```
tests/
    conftest.py          # defines username -> 'username'
    test_something.py    # uses username
    subdir/
        conftest.py      # overrides username -> 'overridden-username'
        test_other.py    # gets overridden version
```

Override pattern:

```python
# tests/subdir/conftest.py
@pytest.fixture
def username(username):  # requests parent's fixture
    return 'overridden-' + username
```

Direct test-level override via parametrization:

```python
@pytest.mark.parametrize('username', ['directly-overridden'])
def test_username(username):
    assert username == 'directly-overridden'
```

### usefixtures Marker

Apply fixtures without declaring them as arguments:

```python
@pytest.mark.usefixtures("cleandir")
class TestDirectoryInit:
    def test_cwd_starts_empty(self):
        assert os.listdir(os.getcwd()) == []

# Module-level
pytestmark = pytest.mark.usefixtures("cleandir")

# Project-wide in pyproject.toml
# usefixtures = ["cleandir"]
```

Cannot be applied to fixture functions themselves.

### Introspecting Request Context

```python
@pytest.fixture(scope="module")
def smtp_connection(request):
    server = getattr(request.module, "smtpserver", "smtp.gmail.com")
    conn = smtplib.SMTP(server, 587, timeout=5)
    yield conn
    conn.close()
```

Markers to pass data to fixtures:

```python
@pytest.fixture
def fixt(request):
    marker = request.node.get_closest_marker("fixt_data")
    data = marker.args[0] if marker else None
    return data

@pytest.mark.fixt_data(42)
def test_fixt(fixt):
    assert fixt == 42
```

### Built-in Fixtures

| Fixture            | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| `tmp_path`         | Unique temp directory (pathlib.Path) per test         |
| `tmp_path_factory` | Session-scoped factory for creating temp dirs         |
| `monkeypatch`      | Safe patching of attrs/env/items (auto-teardown)      |
| `capsys` / `capfd` | Capture stdout/stderr (text or file descriptor level) |
| `caplog`           | Capture logging records                               |
| `recwarn`          | Record warnings emitted during test                   |
| `request`          | Test context introspection                            |
| `pytestconfig`     | Session-scoped Config object                          |
| `subtests`         | Declare subtests inside a test function               |
| `record_property`  | Add extra properties to JUnit XML reports             |

---

## 2. Assertions

### Assert Statement (with Rewriting)

pytest rewrites `assert` statements in test modules to provide detailed introspection:

```python
def test_function():
    assert func(3) == 5
    # On failure: assert 3 == 5
    #             + where 3 = func(3)
```

Custom assertion messages:

```python
assert a % 2 == 0, "value was odd, should be even"
```

### pytest.approx for Floating Point

```python
def test_floats():
    assert (0.1 + 0.2) == pytest.approx(0.3)

def test_arrays():
    import numpy as np
    a = np.array([1.0, 2.0, 3.0])
    b = np.array([0.9999, 2.0001, 3.0])
    assert a == pytest.approx(b)

# Custom tolerances
assert 1.0001 == pytest.approx(1, rel=1e-3)
assert 1.0001 == pytest.approx(1, abs=1e-3)

# Works with dicts, lists, datetime/timedelta
assert {"a": 0.1+0.2} == pytest.approx({"a": 0.3})
from datetime import timedelta
assert dt1 == pytest.approx(dt2, abs=timedelta(seconds=1))
```

### pytest.raises for Exceptions

Context manager form (preferred):

```python
def test_zero_division():
    with pytest.raises(ZeroDivisionError):
        1 / 0

# Access exception info
with pytest.raises(RuntimeError) as excinfo:
    def f(): f()
    f()
assert "maximum recursion" in str(excinfo.value)

# Match exception message with regex
def myfunc():
    raise ValueError("Exception 123 raised")

def test_match():
    with pytest.raises(ValueError, match=r".* 123 .*"):
        myfunc()

# Check callable
import errno
with pytest.raises(OSError, check=lambda e: e.errno == errno.EACCES):
    raise OSError(errno.EACCES, "no permission")
```

**Warning**: `pytest.raises(Exception)` catches subclasses too — use exact type check if needed:

```python
with pytest.raises(RuntimeError) as excinfo:
    foo()
assert excinfo.type is RuntimeError  # Not a subclass
```

Exception groups (pytest 8.4+):

```python
with pytest.RaisesGroup(ValueError):
    raise ExceptionGroup("msg", [ValueError("value msg")])

with pytest.RaisesGroup(ValueError, TypeError, flatten_subgroups=True):
    raise ExceptionGroup("", [ExceptionGroup("nested", [ValueError()])])
```

### Assertion Introspection Details

- pytest only rewrites **test modules** discovered by collection
- Supporting modules need manual registration: `pytest.register_assert_rewrite("mymodule")` before import
- Disable rewriting: add `PYTEST_DONT_REWRITE` to docstring, or `--assert=plain`
- Caches rewritten `.pyc` files; disable with `sys.dont_write_bytecode = True` in conftest

Custom comparison explanations via hook:

```python
# conftest.py
def pytest_assertrepr_compare(config, op, left, right):
    if isinstance(left, Foo) and isinstance(right, Foo) and op == "==":
        return [
            "Comparing Foo instances:",
            f"   vals: {left.val} != {right.val}",
        ]
```

### Don't Return Values from Tests

Returning a bool does NOT determine pass/fail:

```python
# WRONG - test never fails
def test_foo(a, b, result):
    return foo(a, b) == result

# CORRECT
def test_foo(a, b, result):
    assert foo(a, b) == result
```

Emits `PytestReturnNotNoneWarning`.

---

## 3. Parametrization

### @pytest.mark.parametrize

```python
@pytest.mark.parametrize(
    "test_input,expected",
    [("3+5", 8), ("2+4", 6), ("6*9", 42)]
)
def test_eval(test_input, expected):
    assert eval(test_input) == expected
    # Runs 3 times: test_eval[3+5-8], test_eval[2+4-6], test_eval[6*9-42]
```

Multiple parameters stack (cartesian product):

```python
@pytest.mark.parametrize("x", [0, 1])
@pytest.mark.parametrize("y", [2, 3])
def test_foo(x, y):
    pass
    # x=0/y=2, x=1/y=2, x=0/y=3, x=1/y=3
```

Class-level parametrization:

```python
@pytest.mark.parametrize("n,expected", [(1, 2), (3, 4)])
class TestClass:
    def test_simple(self, n, expected):
        assert n + 1 == expected
```

Module-level with `pytestmark`:

```python
pytestmark = pytest.mark.parametrize("n,expected", [(1, 2), (3, 4)])
```

### pytest.param for Marks and Custom IDs

```python
@pytest.mark.parametrize(
    "test_input,expected",
    [
        ("3+5", 8),
        pytest.param("6*9", 42, marks=pytest.mark.xfail, id="wrong-answer"),
    ],
)
def test_eval(test_input, expected):
    assert eval(test_input) == expected
```

Hide parameter from test name (pytest 8.4+):

```python
pytest.param(value, id=pytest.HIDDEN_PARAM)
```

### Indirect Parameters

Pass param values through a fixture for expensive setup:

```python
@pytest.fixture
def web_page(request):
    page = load_page(request.param)  # request.param holds the param value
    yield page
    page.close()

@pytest.mark.parametrize("web_page", ["https://example.com"], indirect=True)
def test_homepage(web_page):
    assert web_page.title == "Example"
```

Indirect can target specific params:

```python
@pytest.mark.parametrize("input_file,expectation", [
    pytest.param("data.csv", raises(ValueError), marks=...),
], indirect=["input_file"])
```

### Dynamic Generation via pytest_generate_tests Hook

In `conftest.py`:

```python
def pytest_addoption(parser):
    parser.addoption("--stringinput", action="append", default=[],
                     help="list of stringinputs")

def pytest_generate_tests(metafunc):
    if "stringinput" in metafunc.fixturenames:
        metafunc.parametrize("stringinput",
                           metafunc.config.getoption("stringinput"))
```

Can also be defined directly in test modules or classes.

### Empty Parameter Sets

Controlled by `empty_parameter_set_mark` config: `skip` (default), `xfail`, or `fail_at_collect`.

---

## 4. Test Organization

### Discovery Conventions

Default patterns (configurable):

| Config             | Default                  |
| ------------------ | ------------------------ |
| `python_files`     | `test_*.py`, `*_test.py` |
| `python_classes`   | `Test`                   |
| `python_functions` | `test`                   |

Files must match `test_*.py` or `*_test.py`. Classes must start with `Test`. Functions/methods must start with `test`.

`unittest.TestCase` subclasses are always collected regardless of naming.

### Directory Structure

```
tests/
    conftest.py              # project-wide fixtures/hooks
    test_module_a.py
    test_module_b.py
    subdir/
        conftest.py          # overrides/fixtures scoped to subdir
        test_sub.py
```

conftest.py hierarchy: loaded from root toward test file. A conftest in a subdirectory applies to tests in that directory and below.

### Class-Based Test Organization

```python
class TestClassDemo:
    def test_one(self):
        x = "this"
        assert "h" in x

    def test_two(self):
        x = "hello"
        assert hasattr(x, "check")
```

**Critical**: Each test gets a **unique class instance**. Do NOT rely on class attributes for state:

```python
class BadExample:
    value = 0  # CLASS attribute — shared!

    def test_one(self):
        self.value = 1  # Creates instance attribute, but still risky

    def test_two(self):
        assert self.value == 1  # May fail — depends on execution order
```

Use fixtures instead of class-level state.

### Multiple Assert Statements Safely

Use a higher-scope fixture for act phase, then query freely:

```python
@pytest.fixture(scope="class", autouse=True)
@classmethod
def login(cls, driver, base_url, user):
    driver.get(urljoin(base_url, "/login"))

class TestLandingPageSuccess:
    @pytest.fixture(scope="class")
    @classmethod
    def landing_page(cls, driver):
        return LandingPage(driver)

    def test_name_in_header(self, landing_page, user):
        assert landing_page.header == f"Welcome, {user.name}!"

    def test_sign_out_button(self, landing_page):
        assert landing_page.sign_out_button.is_displayed()
```

### xunit-Style Setup (Legacy)

Still supported but fixtures are preferred:

```python
def setup_module(module): ...
def teardown_module(module): ...

def setup_class(cls): ...
def teardown_class(cls): ...

def setup_method(self, method): ...
def teardown_method(self, method): ...

def setup_function(function): ...
def teardown_function(function): ...
```

Since pytest 4.2+, these obey fixture scope rules.

---

## 5. Mocking

### monkeypatch Fixture (Preferred)

Auto-teardown, safe:

```python
def test_getcwd(monkeypatch):
    monkeypatch.setattr(os, "getcwd", lambda: "/")
    assert os.getcwd() == "/"

def test_env(monkeypatch):
    monkeypatch.setenv("MY_VAR", "value")
    assert os.environ["MY_VAR"] == "value"

def test_dict(monkeypatch):
    d = {"key": "old"}
    monkeypatch.setitem(d, "key", "new")
    assert d["key"] == "new"

def test_syspath(monkeypatch):
    monkeypatch.syspath_prepend("/my/path")

def test_chdir(monkeypatch):
    monkeypatch.chdir("/tmp")
```

Scoped context:

```python
def test_partial(monkeypatch):
    with monkeypatch.context() as m:
        m.setattr(functools, "partial", 3)
    # Restored automatically
```

**Where to patch**: Patch the name used by the system under test, not the original definition. See unittest.mock docs for details.

### unittest.mock Integration

Standard `unittest.mock` works directly:

```python
from unittest.mock import MagicMock, patch, Mock

def test_with_patch():
    with patch("mymodule.ExternalAPI") as MockAPI:
        instance = MockAPI.return_value
        instance.fetch.return_value = {"data": 42}
        result = mymodule.do_work()
        MockAPI.assert_called_once()
```

`patch` as decorator:

```python
@patch("mymodule.ExternalAPI")
def test_decorator(MockAPI):
    MockAPI.return_value.fetch.return_value = {"data": 42}
    result = mymodule.do_work()
```

### When to Mock vs Real

- **Mock**: External services, network calls, database connections, expensive operations, non-deterministic behavior
- **Real**: Core logic, pure functions, internal state transitions
- Prefer real tests; mock at boundaries (I/O, network, filesystem)

---

## 6. Markers

### Builtin Markers

| Marker                                                                       | Purpose                     |
| ---------------------------------------------------------------------------- | --------------------------- |
| `@pytest.mark.skip(reason=...)`                                              | Unconditionally skip        |
| `@pytest.mark.skipif(condition, reason=...)`                                 | Conditional skip            |
| `@pytest.mark.xfail(condition, reason=..., raises=..., run=..., strict=...)` | Expected to fail            |
| `@pytest.mark.parametrize(...)`                                              | Parametrize test            |
| `@pytest.mark.usefixtures(...)`                                              | Apply fixtures without args |
| `@pytest.mark.filterwarnings(filter_spec)`                                   | Per-test warning filter     |

### Skip Examples

```python
@pytest.mark.skip(reason="no way of currently testing this")
def test_unknown(): ...

@pytest.mark.skipif(sys.version_info < (3, 13), reason="needs Python 3.13+")
def test_new_feature(): ...

# Module-level skip
pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="linux only")

# Missing import
docutils = pytest.importorskip("docutils", minversion="0.3")
```

### XFail Examples

```python
@pytest.mark.xfail(reason="known bug")
def test_bug(): ...

@pytest.mark.xfail(sys.platform == "win32", reason="3rd party bug")
def test_platform_specific(): ...

@pytest.mark.xfail(raises=IndexError)
def test_index_error(): ...

@pytest.mark.xfail(run=False, reason="segfaults")
def test_crash(): ...

@pytest.mark.xfail(strict=True)  # xpass fails the suite
def test_flaky(): ...
```

Skip/xfail with parametrize:

```python
@pytest.mark.parametrize(
    ("n", "expected"),
    [
        (1, 2),
        pytest.param(1, 0, marks=pytest.mark.xfail),
        pytest.param(10, 11, marks=pytest.mark.skipif(sys.version_info >= (3, 0))),
    ],
)
def test_increment(n, expected):
    assert n + 1 == expected
```

### Custom Markers

```python
@pytest.mark.timeout(10, "slow", method="thread")
@pytest.mark.slow
def test_function(): ...

# Access in fixture/hook
marker = request.node.get_closest_marker("timeout")
timeout = marker.args[0] if marker else 30
```

Register custom markers to avoid `PytestUnknownMarkWarning`:

```toml
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests as integration tests",
    "timeout: marks tests with a timeout value",
]
```

Run with marker expressions:

```bash
pytest -m slow                    # only slow tests
pytest -m "not slow"              # exclude slow
pytest -m "mark1 and not mark2"   # complex expression
pytest --markers                  # list all markers
```

Enable strict markers to catch typos:

```toml
addopts = ["--strict-markers"]
markers = ["slow", "integration"]
```

---

## 7. Plugins Ecosystem

### pytest-cov (Coverage)

```bash
pip install pytest-cov
pytest --cov=src/mcp_server --cov-report=term-missing
```

### pytest-asyncio (Async Tests)

```python
import asyncio

@pytest.mark.asyncio
async def test_async():
    result = await some_async_func()
    assert result == expected
```

### pytest-random-order (Non-Deterministic Order)

```bash
pip install pytest-random-order
pytest  # random order by default
pytest --random-order-seed=42  # reproducible
```

### pytest-xdist (Parallel Execution)

```bash
pip install pytest-xdist
pytest -n auto  # parallel across CPU cores
pytest -n 4     # 4 workers
```

### pytest-timeout

```bash
pip install pytest-timeout
pytest --timeout=30           # 30s global timeout
@pytest.mark.timeout(60)      # per-test timeout
```

### Other Notable Plugins

| Plugin                | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `pytest-benchmark`    | Performance benchmarking                             |
| `pytest-mock`         | Cleaner `unittest.mock` integration (`mocker.patch`) |
| `pytest-html`         | HTML report generation                               |
| `pytest-sugar`        | Pretty progress output                               |
| `pytest-instafail`    | Show failures immediately                            |
| `pytest-dotenv`       | Load `.env` files                                    |
| `pytest-lazy-fixture` | Lazy fixture references                              |
| `pytest-retry`        | Retry flaky tests                                    |

---

## 8. Configuration

### pyproject.toml

```toml
[tool.pytest.ini_options]
# Command-line defaults
addopts = [
    "-ra",                    # show extra summary info (all except passed)
    "--strict-markers",       # error on unknown markers
    "--strict-config",        # error on config parsing issues
    "-vv",                    # verbose
]

# Test discovery
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test"]
python_functions = ["test"]

# Markers (required when strict-markers enabled)
markers = [
    "slow: slow-running tests",
    "integration: integration tests",
]

# Warnings
filterwarnings = [
    "error",                    # turn all warnings into errors
    "ignore::DeprecationWarning", # unless deprecation
]
max_warnings = 10              # error if >10 warnings

# Cache
cache_dir = ".pytest_cache"

# Strictness
strict_xfail = true            # xpass fails suite
strict_parametrization_ids = true

# Temp dir retention
tmp_path_retention_count = "3"
tmp_path_retention_policy = "failed"  # keep only failed test dirs

# Logging
log_level = "INFO"
log_format = "%(asctime)s %(levelname)s %(message)s"
log_cli = true
log_cli_level = "DEBUG"

# Required plugins
required_plugins = ["pytest-cov", "pytest-xdist"]

# Default fixtures
usefixtures = ["clean_db"]

# Min version
minversion = "7.0"

# Python path additions
pythonpath = ["src"]
```

### tox.ini / pytest.ini / setup.cfg

Same `[pytest]` section syntax. TOML preferred for new projects.

### Command-Line Overrides

```bash
pytest -o strict_xfail=true -o cache_dir=cache
pytest -k "test_method or test_other"    # keyword filter
pytest -m "slow and not integration"     # marker filter
pytest --lf                              # last failed
pytest --ff                              # failed first
pytest -x                                # exit on first failure
pytest --maxfail=3                       # exit after N failures
pytest --collect-only                    # collect only, don't run
pytest --tb=short                        # short traceback style
pytest --showlocals                      # show local vars in tracebacks
```

---

## 9. Performance

### Slowest Tests

```bash
pytest --durations=10        # top 10 slowest
pytest --durations=0         # all tests
pytest --durations-min=0.1   # only tests taking >= 0.1s
```

### Profiling

```bash
pip install pytest-profiling
pytest --profile               # cProfile output
pytest --profiling-output=profile.txt
```

### Identifying Slow Tests

```bash
# Run with timing per test
pytest --durations-min=1.0 -v

# Stepwise debugging
pytest --stepwise              # stop on first failure, continue next run
pytest --stepwise-skip         # skip first failure, stop on second
```

### Optimization Tips

- Use appropriate fixture scopes (module/session for expensive resources)
- Group tests by fixture instance to minimize active resources
- Use `--lf` to focus on failing tests during development
- Use `-k` to run subsets: `pytest -k "test_login"`
- Use `-m` for marker-based filtering: `pytest -m "not slow"`
- Use `pytest-xdist` for parallel execution: `pytest -n auto`
- Consider `--co` (collect-only) to diagnose slow collection

---

## 10. Common Anti-Patterns

### Mutable Shared State

```python
# BAD — class attribute shared across tests
class BadExample:
    results = []  # Shared!

    def test_one(self):
        self.results.append(1)

    def test_two(self):
        assert self.results == [1]  # Fails — contains [1, 1] from test_one

# GOOD — use fixtures
@pytest.fixture
def results():
    return []

def test_one(results):
    results.append(1)
```

### Returning Bool from Tests

```python
# BAD — return value ignored
def test_math(a, b, result):
    return compute(a, b) == result

# GOOD
def test_math(a, b, result):
    assert compute(a, b) == result
```

### Catching Broad Exceptions

```python
# BAD — catches subclasses too
with pytest.raises(Exception):
    some_function()

# GOOD — be specific
with pytest.raises(ValueError, match=r"must be positive"):
    parse_number("-5")
```

### Importing Fixtures

```python
# BAD — registers fixture in wrong module namespace
from tests.conftest import db_fixture

def test_something(db_fixture): ...

# GOOD — let pytest discover via conftest.py
def test_something(db_fixture): ...
```

### Relying on Test Execution Order

```python
# BAD — tests depend on order
def test_create_user():
    create_user("alice")

def test_list_users():
    assert get_users() == ["alice"]  # Depends on test_create_user running first
```

### Using setUp/tearDown Instead of Fixtures

```python
# Works but fixtures are more flexible
class OldStyle(unittest.TestCase):
    def setUp(self):
        self.conn = connect()
    def tearDown(self):
        self.conn.close()

# Better — fixtures with dependency injection
@pytest.fixture
def connection():
    conn = connect()
    yield conn
    conn.close()
```

### Long Test Functions

Keep tests focused: one concept per test. Use subtests for iteration:

```python
def test_valid_inputs(subtests):
    for i, input_val in enumerate(valid_inputs):
        with subtests.test(input=input_val, index=i):
            assert process(input_val) == expected[i]
```

### Hardcoded Paths

```python
# BAD
with open("/tmp/test_data.csv") as f: ...

# GOOD
def test_something(tmp_path):
    data_file = tmp_path / "test_data.csv"
    data_file.write_text("data")
    ...
```
