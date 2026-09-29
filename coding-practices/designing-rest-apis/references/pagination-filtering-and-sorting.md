# Pagination, Filtering, and Sorting

## 1. Filtering

Use query parameters for optional filter criteria. Support exact matches and prefix-based operators:

- Exact match: `GET /orders?status=shipped&customer_id=123`
- Range / Comparison operators:
  - `GET /orders?created_after=2026-01-01T00:00:00Z`
  - `GET /products?price_min=50&price_max=200`
- Multi-value filtering:
  - Comma-separated: `GET /products?category=electronics,books`

## 2. Sorting

Standardise sort syntax across all endpoints. Use comma-separated fields with a prefix or suffix to indicate direction:

- **Sign prefix convention:**
  - `GET /orders?sort=-created_at,total_amount` (minus indicates descending order)
- **Field & direction parameter:**
  - `GET /orders?sort_by=created_at&sort_direction=desc`

## 3. Pagination Strategies

### Strategy A: Cursor-Based Pagination (Recommended for large / dynamic collections)
Prevents skipped items and duplicated pages when records are continuously inserted.

**Request:**
`GET /orders?limit=25&starting_after=ord_1024`

**Response:**
```json
{
  "data": [ ... ],
  "pagination": {
    "limit": 25,
    "has_more": true,
    "next_cursor": "ord_1049"
  }
}

```

### Strategy B: Offset / Limit Pagination (Acceptable for small / static datasets)

Simple to implement, allows arbitrary page jumping.

**Request:**
`GET /orders?page=2&per_page=20`

**Response:**

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total_records": 150,
    "total_pages": 8
  }
}

```

## 4. Collection Response Envelope

Wrap array responses in a top-level JSON object rather than returning a top-level JSON array. This permits backward-compatible additions of pagination and metadata:

```json
{
  "data": [
    { "id": "prod_1", "name": "Mechanical Keyboard" }
  ],
  "pagination": {
    "limit": 20,
    "has_more": false
  }
}

```

