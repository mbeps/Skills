# Testing & Verification Guide for MCP v2

Testing MCP v1 servers previously required launching subprocesses or starting temporary network sockets. In MCP SDK v2, testing is drastically simplified via the **in-memory Client** (`mcp.Client`), which communicates directly with `MCPServer` instances in-process without network overhead.

---

## 1. Test Setup with Pytest & AnyIO

Configure your `conftest.py` or test module to provide an `anyio_backend` fixture and an in-memory `Client`:

```python
from collections.abc import AsyncIterator
import pytest
from mcp import Client
from mcp_server.main import mcp

@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"

@pytest.fixture
async def client() -> AsyncIterator[Client]:
    # Connect in-memory with raise_exceptions=True
    async with Client(mcp, raise_exceptions=True) as c:
        yield c
```

---

## 2. Tool Listing & Schema Validation

Verify that all tools are registered, schemas are well-formed, and descriptions are populated:

```python
@pytest.mark.anyio
async def test_tools_discovery(client: Client) -> None:
    res = await client.list_tools()
    tools = res.tools
    
    assert len(tools) > 0
    names = {t.name for t in tools}
    assert "expected_tool" in names
    
    for tool in tools:
        assert tool.description, f"{tool.name} missing description"
        assert tool.input_schema is not None
        assert tool.input_schema.get("type") == "object"
```

---

## 3. Tool Invocation & Structured Output

Test invoking tools through the client. Note that in SDK v2:
- Successful responses contain `content` (text/image blocks) and `structured_content` (parsed Pydantic dictionary if returned by the handler).
- Tool-level errors set `res.is_error = True`.

```python
@pytest.mark.anyio
async def test_call_tool_success(client: Client) -> None:
    res = await client.call_tool("analyze_metrics", {
        "metrics": {"cpu_percent": 15.0, "memory_gb": 4.0, "process_count": 50}
    })
    
    assert not res.is_error
    assert res.structured_content is not None
    assert res.structured_content["status"] == "healthy"

@pytest.mark.anyio
async def test_call_tool_error_preserves_message(client: Client) -> None:
    # Verify domain errors carry model-visible messages rather than masked generic text
    res = await client.call_tool("analyze_metrics", {"metrics": None})
    assert res.is_error is True
    assert len(res.content) > 0
    # Must contain specific domain reason, not generic "Error executing tool"
    assert "metrics required" in res.content[0].text
```

---

## 4. Resource & Template Testing

Verify resource listing, URI template discovery, and reading (including URL-encoded paths):

```python
import json
import urllib.parse

@pytest.mark.anyio
async def test_read_resource(client: Client) -> None:
    res_list = await client.list_resources()
    uris = [r.uri for r in res_list.resources]
    assert "config://app/defaults" in uris

    result = await client.read_resource("config://app/defaults")
    payload = json.loads(result.contents[0].text)
    assert payload["poll_interval_seconds"] == 60

@pytest.mark.anyio
async def test_resource_templates(client: Client) -> None:
    # Discover registered RFC 6570 templates
    tpl_res = await client.list_resource_templates()
    templates = [t.uri_template for t in tpl_res.resource_templates]
    assert "data://items/{id}" in templates

    # Read template with encoded path value
    item_id = urllib.parse.quote("my/nested/item", safe="")
    result = await client.read_resource(f"data://items/{item_id}")
    assert len(result.contents) > 0
```

---

## 5. Stateless ASGI App Testing

Ensure the ASGI Starlette app builds cleanly for HTTP deployment:

```python
from starlette.applications import Starlette
from mcp_server.main import app, mcp

def test_asgi_app():
    assert isinstance(app, Starlette)
    fresh_app = mcp.streamable_http_app(stateless_http=True)
    assert isinstance(fresh_app, Starlette)
```

---

## 6. Migration Verification Checklist

Before certifying an MCP v1 $\to$ v2 migration complete, run this verification pipeline:

1. **Dependency Sync**:
   ```bash
   uv sync --all-groups
   ```
2. **Automated Test Suite**:
   ```bash
   uv run --all-groups python -m pytest -v
   ```
3. **Linting & Import Formatting**:
   ```bash
   uv run --all-groups python -m ruff check src tests
   ```
4. **Static Type Checking**:
   ```bash
   uv run --all-groups python -m mypy src tests
   ```
5. **Console Script Entrypoint**:
   ```bash
   uv run mcp-server --help
   ```

