# Resources, URI Templates & Security

Resources in MCP v2 expose read-only data, file contents, configuration payloads, or documents to clients and models.

---

## 1. Static Resources

Register a resource with a fixed URI using `@mcp.resource(uri)`:

```python
from mcp.server.mcpserver import MCPServer

mcp = MCPServer(name="ResourceServer")

@mcp.resource("config://app/thresholds")
def get_thresholds() -> str:
    """Return monitoring thresholds in JSON format."""
    return """
    {
        "cpu_warning": 75.0,
        "cpu_critical": 90.0
    }
    """
```

### Specifying MIME Types
By default, strings return as `text/plain`. To provide structured formats or binary data:

```python
@mcp.resource("schema://app/openapi.json", mime_type="application/json")
def get_openapi_spec() -> str:
    return '{"openapi": "3.1.0", "info": {"title": "App API"}}'

@mcp.resource("images://logo.png", mime_type="image/png")
def get_logo() -> bytes:
    with open("assets/logo.png", "rb") as f:
        return f.read()
```

---

## 2. Dynamic Resource Templates

Resource templates allow parameters inside the URI pattern using `{parameter}` syntax:

```python
@mcp.resource("users://{user_id}/profile")
def get_user_profile(user_id: str) -> str:
    """Fetch user profile document by identifier."""
    return f'{{"user_id": "{user_id}", "role": "admin"}}'

@mcp.resource("logs://{service}/{date}")
def get_service_logs(service: str, date: str) -> str:
    """Fetch log entries for a service on a given date."""
    return f"Logs for {service} on {date}: All systems normal."
```

---

## 3. Path Traversal & `ResourceSecurity`

MCP v2 includes default path security controls to prevent directory traversal and unauthorized filesystem access.

### Default Protection
By default, `MCPServer` enforces:
- `reject_path_traversal=True`: Rejects `..` sequences in URI parameters.
- `reject_absolute_paths=True`: Rejects absolute root paths (`/etc/passwd`, `C:\Windows`).
- `reject_null_bytes=True`: Rejects embedded null bytes (`\0`).

### Customizing Security Policies

#### Server-Wide Policy
```python
from mcp.server.mcpserver import MCPServer, ResourceSecurity

# Allow legitimate absolute paths for a filesystem inspection server
custom_security = ResourceSecurity(
    reject_path_traversal=True,
    reject_absolute_paths=False,
    exempt_params=frozenset(["file_path"]),
)

mcp = MCPServer(
    name="FilesystemServer",
    resource_security=custom_security,
)
```

#### Per-Resource Policy
```python
@mcp.resource(
    "docs://{path}",
    security=ResourceSecurity(reject_path_traversal=True, reject_absolute_paths=True),
)
def read_doc(path: str) -> str:
    return f"Document content for {path}"
```

### Handling Slashes in Template Parameters
By default, RFC 6570 templates treat `/` as a path delimiter and do not match unencoded slashes in `{param}`. When parameters contain filesystem paths or nested identifiers:
1. **Client-side URL encoding (standard)**: The client must percent-encode parameter values containing slashes (`urllib.parse.quote(file_path, safe="")`) when constructing the URI.
2. **Exempt parameter policy**: Register the parameter in `ResourceSecurity(exempt_params={"file_path"})` so absolute paths (e.g. `/home/user/data.xlsx`) are not blocked once decoded.

---

## 4. Resource Change Notifications

When resources are modified, servers can inform subscribed clients using the `Context` object:

```python
from mcp.server.mcpserver import Context

@mcp.tool()
async def update_threshold(new_value: float, ctx: Context) -> str:
    """Update threshold and notify subscribers."""
    # Persist change...
    await ctx.notify_resource_updated("config://app/thresholds")
    return f"Threshold updated to {new_value}"
```

