# In-Memory Testing & Verification

In MCP v2, testing does not require launching subprocesses or binding to local network sockets. The SDK provides an in-memory `Client` that connects directly to the `MCPServer` instance.

---

## 1. Pytest & AnyIO Configuration

```python
from collections.abc import AsyncIterator
import pytest
from mcp import Client
from my_server.main import mcp

@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"

@pytest.fixture
async def client() -> AsyncIterator[Client]:
    """In-memory client connected directly to the server."""
    async with Client(mcp, raise_exceptions=True) as c:
        yield c
```

---

## 2. Testing Tool Discovery & Schema Integrity

Validate that registered tools have descriptive names, complete docstrings, and well-formed input/output schemas:

```python
@pytest.mark.anyio
async def test_tool_schemas(client: Client) -> None:
    result = await client.list_tools()
    tools = {t.name: t for t in result.tools}
    
    assert "evaluate_health" in tools
    tool = tools["evaluate_health"]
    
    # Assert description exists and is meaningful
    assert tool.description and len(tool.description) > 10
    
    # Assert JSON Schema properties
    assert tool.input_schema["type"] == "object"
    assert "cpu_percent" in tool.input_schema["properties"]
    assert "cpu_percent" in tool.input_schema["required"]
```

---

## 3. Testing Tool Invocations

Test happy paths, boundary inputs, and structured output returns:

```python
@pytest.mark.anyio
async def test_call_tool_success(client: Client) -> None:
    res = await client.call_tool(
        "evaluate_health",
        {"cpu_percent": 35.0, "memory_gb": 8.0},
    )
    
    assert not res.is_error
    assert res.structured_content is not None
    assert res.structured_content["healthy"] is True
    assert res.structured_content["load_factor"] == 0.35
```

### Testing Error Responses
```python
@pytest.mark.anyio
async def test_call_tool_invalid_params(client: Client) -> None:
    # Test invalid parameter handling
    res = await client.call_tool("update_profile", {"user_id": 1, "email": "invalid-email"})
    assert res.is_error
```

---

## 4. Testing Resources & Prompts

```python
import json

@pytest.mark.anyio
async def test_resources(client: Client) -> None:
    res = await client.read_resource("config://app/thresholds")
    data = json.loads(res.contents[0].text)
    assert data["cpu_warning"] == 75.0

@pytest.mark.anyio
async def test_prompts(client: Client) -> None:
    prompt_res = await client.get_prompt("code_review", arguments={"code": "x = 1", "language": "python"})
    assert len(prompt_res.messages) > 0
    assert "x = 1" in prompt_res.messages[0].content.text
```

---

## 5. Verification Pipeline

Run the standard three-tier verification before deploying any MCP v2 server:

```bash
# 1. Automated unit & client tests
uv run --all-groups python -m pytest -v

# 2. Linter & import order
uv run --all-groups python -m ruff check src tests

# 3. Static type analysis
uv run --all-groups python -m mypy src tests
```

