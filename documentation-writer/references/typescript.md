# TypeScript Documentation (JSDoc/TSDoc)

Write JSDoc for TypeScript codebases only — not plain JavaScript.

## What to Document

- Components, pages, hooks, server actions, utility functions, schemas
- Exported interfaces, types, and enums with non-obvious fields
- Class methods and constructors
- Skip: config files (`tsconfig`, `drizzle.config.ts`, `vitest.config.ts`, etc.)

## Structure

```ts
/**
 * Short one-line description of the file or function.
 * Explain why this code exists and when to use it.
 * Additional relevant information.
 *
 * @param name - Short description of the parameter and any constraints.
 * @returns Short description of the return value.
 * @throws {ExceptionType} Short description of the possible errors thrown.
 * @see optional link to relevant resources
 * @author Maruf Bepary
 */
```

## Rules

- Do not include types in `@param` or `@returns` — TypeScript types already convey that
- Document interface fields inline (see example below)
- Use `@see` sparingly — only when it meaningfully aids navigation
- `@throws` uses `{ErrorType}` syntax

## Examples

**Function:**
```ts
/**
 * Validates user email format and checks against blocklist.
 * Use this before accepting user registration or profile updates.
 * Throws ValidationError if email format is invalid or domain is blocked.
 *
 * @param email - User email address to validate (must be lowercase)
 * @param options - Configuration for validation behaviour
 * @returns Normalised email address with whitespace trimmed
 * @throws {ValidationError} When email format is invalid or domain is blocked
 * @see {@link https://emailvalidation.spec.org} for validation rules
 * @author Maruf Bepary
 */
export function validateEmail(email: string, options?: ValidationOptions): string {
  // implementation
}
```

**Async Function:**
```ts
/**
 * Fetches user profile data with related posts and comments.
 * Implements caching with 5-minute TTL and automatic retry on failure.
 * Returns null if user not found or has been deleted.
 *
 * @param userId - Unique identifier for the user
 * @param includeDeleted - Whether to include soft-deleted content
 * @returns User profile with nested relations, or null if not found
 * @throws {DatabaseError} When database connection fails after retries
 * @see getUserById for fetching without relations
 * @author Maruf Bepary
 */
export async function fetchUserProfile(
  userId: string,
  includeDeleted = false
): Promise<UserProfile | null> {
  // implementation
}
```

**Custom Hook:**
```ts
/**
 * Manages form state with validation and submission handling.
 * Debounces validation by 300ms and tracks field-level errors.
 * Automatically resets form state after successful submission.
 *
 * @param initialValues - Default form field values
 * @param onSubmit - Callback invoked after validation passes
 * @returns Form state, handlers, and validation errors
 * @see useFieldValidation for individual field validation
 * @author Maruf Bepary
 */
export function useForm<T extends FormValues>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>
) {
  // implementation
}
```

**Server Action:**
```ts
/**
 * Creates new blog post and triggers notification workflow.
 * Validates user permissions and sanitises HTML content before saving.
 * Runs in server context only — never call from client components.
 *
 * @param formData - Post content and metadata from submission form
 * @returns Created post with generated slug and timestamps
 * @throws {UnauthorizedError} When user lacks publish permissions
 * @throws {ValidationError} When required fields are missing or invalid
 * @see updatePost for modifying existing posts
 * @author Maruf Bepary
 */
export async function createPost(formData: FormData): Promise<Post> {
  "use server";
  // implementation
}
```

**Interface:**
```ts
/**
 * Configuration options for database connection pooling.
 * Controls connection lifecycle, retry behaviour, and resource limits.
 * Used by DatabaseClient constructor to initialise connection pool.
 *
 * @see DatabaseClient for usage examples
 * @author Maruf Bepary
 */
export interface DatabaseConfig {
  /**
   * Maximum number of concurrent connections in the pool.
   * Recommended: 10-20 for most applications.
   */
  maxConnections: number;

  /**
   * Milliseconds to wait before timing out connection attempts.
   * Default is 5000ms if not specified.
   */
  connectionTimeout?: number;

  /**
   * Whether to automatically reconnect on connection loss.
   * Enables exponential backoff retry strategy.
   */
  autoReconnect: boolean;
}
```

**Zod Schema:**
```ts
/**
 * Validation schema for user registration form data.
 * Enforces password strength, email format, and required fields.
 * Use with form libraries like react-hook-form for client-side validation.
 *
 * @see loginSchema for authentication validation
 * @author Maruf Bepary
 */
export const registerSchema = z.object({
  // ...
});
```

**Class:**
```ts
/**
 * Manages WebSocket connections with automatic reconnection and heartbeat.
 * Buffers messages during disconnection and replays on reconnect.
 *
 * @see WebSocketEvent for available event types
 * @author Maruf Bepary
 */
export class WebSocketManager extends EventEmitter {
  /**
   * Establishes WebSocket connection to specified endpoint.
   *
   * @param url - WebSocket server URL (must use ws:// or wss:// protocol)
   * @param protocols - Optional subprotocols to negotiate
   * @throws {ConnectionError} When initial connection fails after max retries
   */
  connect(url: string, protocols?: string[]): void {
    // implementation
  }
}
```
