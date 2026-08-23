# PyTest Built-in Fixtures

## Overview

pytest ships with several built-in fixtures that are among the most-used in production testing. This guide covers `caplog`, `capsys`, and `tmp_path` — the ones you'll reach for most often.

## caplog — Capturing Logging Output

For MCP server testing, this is critical: logs go to stderr (reserved for MCP JSON-RPC on stdout). Verify log routing with `caplog`:

```python
import logging

def test_error_logged(caplog) -> None:
    with caplog.at_level(logging.ERROR):
        raise ValueError("something broke")
    assert "something broke" in caplog.text
    assert caplog.records[0].levelname == "ERROR"
```

Key attributes:

| Attribute              | Type            | Description                                  |
| ---------------------- | --------------- | -------------------------------------------- |
| `caplog.text`          | str             | All log output as formatted text             |
| `caplog.records`       | list[LogRecord] | Individual log records for assertions        |
| `caplog.record_tuples` | list[tuple]     | Quick `(logger_name, level, message)` checks |

## capsys — Capturing stdout/stderr

Use when code writes directly to stdout/stderr (not via `logging`):

```python
def test_stdout_capture(capsys) -> None:
    print("hello world")
    captured = capsys.readouterr()
    assert captured.out.strip() == "hello world"
    assert captured.err == ""

def test_stderr_capture(capsys) -> None:
    import sys
    print("error", file=sys.stderr)
    captured = capsys.readouterr()
    assert "error" in captured.err
```

**MCP note:** MCP servers must write JSON-RPC to stdout and logs to stderr. Use `capsys.readouterr()` to verify stdout stays clean of log noise.

## tmp_path — Temporary Directories

Always prefer `tmp_path` (returns `pathlib.Path`) over the legacy `tmpdir` (`py.path`). Modern standard with better IDE support and type hints. See [fixtures.md](fixtures.md#pathlib-over-legacy-tmpdir) for details.
