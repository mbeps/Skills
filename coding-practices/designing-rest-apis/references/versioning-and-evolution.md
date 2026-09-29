# API Evolution and Versioning

## 1. The Golden Rule of API Evolution

**Never make breaking changes to an active API contract without versioning and migration paths.**

### Non-Breaking Changes (Safe to add without version bump)
- Adding new endpoints.
- Adding new optional query parameters.
- Adding new optional fields to request bodies.
- Adding new fields to response JSON payloads (clients must be built to ignore unknown fields).

### Breaking Changes (Requires new version or major change strategy)
- Renaming or removing existing fields in request or response payloads.
- Altering the type or structure of a field (e.g., changing `price: "49.99"` to `price: { amount: 49.99, currency: "GBP" }`).
- Changing HTTP status codes for existing outcomes.
- Adding new required fields to request bodies.
- Changing URL routing patterns or endpoint meanings.

---

## 2. Versioning Strategies

| Strategy | Example | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **URI Path** | `/api/v1/orders` | Explicit, easy to test in browser and cache | Pollutes URI, treats entire API as monolithic version |
| **Custom Header** | `X-API-Version: 2026-09-01` | Clean URIs, allows granular per-call versioning | Harder to test in browser, requires header forwarding in proxies |
| **Accept Header** | `Accept: application/vnd.company.v2+json` | Follows pure REST content negotiation | Higher client complexity, cache configuration overhead |

**Recommendation:**
- Use **URI Path versioning (`/v1`)** for simplicity and broad developer adoption.
- For enterprise or high-change systems, adopt **Date-based versioning headers** (e.g. Stripe pattern: `Stripe-Version: 2026-09-01`).

---

## 3. Deprecation Process

When releasing a breaking version, follow a disciplined sunset lifecycle:

1. **Communication:** Publish a formal deprecation schedule with minimum 6 to 12 months transition window.
2. **HTTP Deprecation Headers:** Add standard RFC 8594 headers to deprecated endpoint responses:
   ```http
   Deprecation: @1790726400
   Sunset: Wed, 30 Sep 2027 00:00:00 GMT
   Link: [https://api.example.com/docs/deprecations/v1](https://api.example.com/docs/deprecations/v1); rel="deprecation"

3. **Telemetry & Monitoring:** Track remaining traffic to deprecated endpoints and contact active callers before turning off the old version.
