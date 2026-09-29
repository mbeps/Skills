# Resource Naming and Routing

## 1. Nouns Over Verbs

REST resources represent entities or concepts, not actions. HTTP verbs define the operations.

- **Incorrect:**
  - `GET /api/v1/getProducts`
  - `POST /api/v1/createProduct`
  - `POST /api/v1/deleteProduct`
- **Correct:**
  - `GET /api/v1/products` (List products)
  - `POST /api/v1/products` (Create product)
  - `GET /api/v1/products/{id}` (Get single product)
  - `PUT /api/v1/products/{id}` (Replace product)
  - `PATCH /api/v1/products/{id}` (Update product)
  - `DELETE /api/v1/products/{id}` (Remove product)

## 2. Plural Naming & Predictable URIs

Collections must always use plural nouns. Keep terminology uniform across services:

- Use `/users`, not `/user` or `/customers` in another endpoint.
- For multi-word resources, stick to one URL casing convention across the entire organisation. **Kebab-case is standard**:
  - `/order-items`
  - `/payment-methods`
  - `/audit-logs`

## 3. Resource Hierarchy & Nesting

Nest endpoints only when a child resource cannot exist independently of its parent:

- `GET /customers/{customerId}/orders`: Orders belonging to a specific customer.
- `POST /customers/{customerId}/orders`: Create an order for this customer.
- `GET /customers/{customerId}/orders/{orderId}`: Specific order of this customer.

### Rule of Depth (Max 2 Levels)
Avoid deep nesting beyond two levels (e.g., `/authors/{id}/books/{id}/chapters/{id}/comments`). Deep nesting introduces brittle URLs and complex routing. Flatten deeper relationships:
- Instead of `/authors/{id}/books/{bookId}/chapters/{chapterId}`, use `/chapters/{chapterId}` or `/books/{bookId}/chapters`.

## 4. Path vs Query Parameter Separation

- **Path parameters (`/resource/{id}`)**: Identify the resource or entity hierarchy.
- **Query parameters (`?status=active&sort=desc`)**: Filter, sort, search, or paginate the collection.

Never pass operations in query strings:
- **Incorrect:** `GET /users/{id}?action=archive`
- **Correct:** `POST /users/{id}/archive` or `PATCH /users/{id}` with `{ "status": "archived" }`.
