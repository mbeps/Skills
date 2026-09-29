# HTTP Methods and Status Codes

## 1. HTTP Methods & Semantics

HTTP verbs carry standardized guarantees defined in RFC 9110.

| Method | Safe | Idempotent | Request Body | Response Body | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | Yes | Yes | No | Yes | Retrieve representation of a resource |
| `HEAD` | Yes | Yes | No | No | Same as `GET` without response body |
| `POST` | No | No | Yes | Yes | Create resource or trigger an operation |
| `PUT` | No | Yes | Yes | Yes | Full replacement of target resource |
| `PATCH` | No | No* | Yes | Yes | Partial update of target resource |
| `DELETE` | No | Yes | Optional | Optional | Remove target resource |

*\*Note: `PATCH` can be idempotent depending on mutation logic, but RFC 9110 does not guarantee idempotency by default.*

### Idempotency in Practice
- **Safe:** Does not modify resource state on the server.
- **Idempotent:** Making multiple identical requests produces the exact same server state as making a single request.
- For non-idempotent operations like `POST /payments`, require an `Idempotency-Key` header (UUID) to guard against network timeouts and client retries.

---

## 2. HTTP Status Codes Reference Matrix

Never return `200 OK` when an operation has failed.

### 2xx Success
- `200 OK`: Successful read or update where a body is returned.
- `201 Created`: Resource successfully created (accompany with `Location` header).
- `202 Accepted`: Request accepted for asynchronous/batch processing.
- `204 No Content`: Successful action with no content to return (e.g., `DELETE`).

### 3xx Redirection
- `301 Moved Permanently`: Resource permanently relocated.
- `304 Not Modified`: Cached representation is still fresh (ETag / If-None-Match).

### 4xx Client Errors
- `400 Bad Request`: Malformed syntax, unparseable JSON, or generic bad input.
- `401 Unauthorized`: Client lacks valid authentication credentials.
- `403 Forbidden`: Client is authenticated but lacks permission for this action.
- `404 Not Found`: Target resource or URI does not exist.
- `405 Method Not Allowed`: HTTP verb is not supported for this endpoint.
- `409 Conflict`: Request conflicts with current resource state (e.g., duplicate unique key).
- `415 Unsupported Media Type`: Client sent unsupported `Content-Type` (e.g., XML instead of JSON).
- `422 Unprocessable Content`: Syntactically valid JSON that fails domain/business validation.
- `429 Too Many Requests`: Client has exceeded rate limits (accompany with `Retry-After`).

### 5xx Server Errors
- `500 Internal Server Error`: Unhandled server exception.
- `502 Bad Gateway`: Upstream service returned an invalid response.
- `503 Service Unavailable`: Server temporarily overloaded or down for maintenance.
- `504 Gateway Timeout`: Upstream service failed to respond within threshold.
