# Python Documentation (Google Docstring)

Write Google-style Docstrings for Python codebases only.

## What to Document

- Modules (top of file)
- Classes and their `__init__`
- Public methods and functions
- Properties with non-obvious behaviour
- Skip: trivial properties, `__repr__`/`__str__` with obvious output

## Structure

```python
"""Short one-line description of the file or function.
Explain why this code exists and when to use it.
Additional relevant information.

Args:
    name: Short description of the parameter and any constraints.

Returns:
    Short description of the return value.

Raises:
    ExceptionType: When and why this exception is raised.

References:
    - Link to relevant docs: https://example.com
"""
```

## Rules

- First line is a one-sentence summary ending with a period
- Leave one blank line between the summary and the body sections
- Use `References:` only when linking to useful external docs — do not overdo it
- For classes, document instance attributes in an `Attributes:` section on the class docstring, not on `__init__`
- Async functions follow the same format — no special treatment needed

## Examples

**Function:**
```python
def validate_email(email: str, check_mx: bool = False) -> str:
    """Validates email format and optionally checks MX records.

    Use this before accepting user registration or profile updates.
    Raises ValidationError if email format is invalid or MX check fails.

    Args:
        email: User email address to validate (case-insensitive).
        check_mx: Whether to perform DNS MX record lookup for domain.

    Returns:
        Normalised email address in lowercase with whitespace trimmed.

    Raises:
        ValidationError: When email format is invalid or MX records not found.
        DNSError: When DNS lookup fails due to network issues.

    References:
        - RFC 5321: https://tools.ietf.org/html/rfc5321
    """
```

**Async Function:**
```python
async def fetch_user_profile(
    user_id: str,
    include_deleted: bool = False,
    use_cache: bool = True
) -> UserProfile | None:
    """Fetches user profile data with related posts and comments.

    Implements caching with 5-minute TTL and automatic retry on transient failures.
    Returns None if user not found or permanently deleted.

    Args:
        user_id: Unique identifier for the user (UUID format).
        include_deleted: Whether to include soft-deleted content in results.
        use_cache: Whether to check Redis cache before database query.

    Returns:
        Complete user profile with nested relations, or None if not found.

    Raises:
        DatabaseError: When database connection fails after 3 retry attempts.
        TimeoutError: When query exceeds 10-second timeout threshold.
    """
```

**Class:**
```python
class WebSocketManager:
    """Manages WebSocket connections with automatic reconnection and heartbeat.

    Buffers messages during disconnection and replays them upon reconnect.
    Sends heartbeat pings every 30 seconds to detect stale connections.
    Thread-safe for concurrent access from multiple coroutines.

    Attributes:
        url: WebSocket server endpoint (ws:// or wss:// protocol).
        is_connected: Whether connection is currently active.
        reconnect_attempts: Number of reconnection attempts made.
        message_queue: Buffer for messages sent while disconnected.

    References:
        - WebSocket protocol: https://tools.ietf.org/html/rfc6455
    """

    def __init__(self, url: str, max_retries: int = 5):
        """Initializes WebSocket manager with connection parameters.

        Args:
            url: WebSocket server URL (must use ws:// or wss:// protocol).
            max_retries: Maximum reconnection attempts before giving up.

        Raises:
            ValueError: When URL format is invalid or protocol unsupported.
        """
```

**Dataclass:**
```python
@dataclass
class DatabaseConfig:
    """Configuration for database connection pooling and behaviour.

    Controls connection lifecycle, retry behaviour, and resource limits.
    Used by DatabaseClient to initialise the connection pool on startup.
    All timeout values are in seconds.

    Attributes:
        max_connections: Maximum concurrent connections in pool (default 10).
        connection_timeout: Seconds before timing out connection attempts.
        idle_timeout: Seconds before closing idle connections (default 300).
        auto_reconnect: Whether to reconnect automatically on connection loss.
        ssl_enabled: Whether to use SSL/TLS for secure connections.
        ssl_cert_path: Path to SSL certificate file (required if ssl_enabled).
    """
```
