# Java Documentation (JavaDoc)

Write JavaDoc for Java codebases only.

## What to Document

- Classes, interfaces, enums, annotations
- Public and protected methods
- Public and protected fields
- Constructors
- Skip: trivial getters/setters, `@Override` methods with no additional contract

## Structure

```java
/**
 * Short one-line description of the class, method, or interface.
 * Explain why this code exists and when to use it.
 * Additional relevant information about behavior and constraints.
 *
 * @param name Short description of the parameter and any constraints
 * @return Short description of the return value
 * @throws ExceptionType When and why this exception is thrown
 * @see RelatedClass for related functionality
 * @author Maruf Bepary
 */
```

## Rules

- Do not include types in `@param`, `@return`, `@throws` — types are in the signature
- Use `@see` sparingly — only link when it meaningfully aids navigation
- Use `@since` on public API to track when an element was introduced
- Use `@deprecated` with a replacement note when applicable

## Examples

**Service Method:**
```java
/**
 * Validates user credentials and generates JWT authentication token.
 * Implements rate limiting (5 attempts per 15 minutes) and logs failed attempts.
 * Passwords are compared using constant-time algorithm to prevent timing attacks.
 *
 * @param email User email address (case-insensitive, trimmed automatically)
 * @param password Plain-text password (will be hashed internally)
 * @return JWT token valid for 24 hours with embedded user roles
 * @throws InvalidCredentialsException When email or password is incorrect
 * @throws AccountLockedException When account is locked due to failed attempts
 * @throws RateLimitExceededException When too many login attempts detected
 * @see #refreshToken(String) for renewing expired tokens
 * @author Maruf Bepary
 */
public String authenticate(String email, String password)
    throws InvalidCredentialsException, AccountLockedException {
    // implementation
}
```

**REST Controller:**
```java
/**
 * Handles HTTP requests for user profile management operations.
 * All endpoints require authentication via JWT bearer token.
 *
 * @see UserService for business logic implementation
 * @author Maruf Bepary
 */
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    /**
     * Retrieves user profile by unique identifier.
     * Returns cached response when available (5-minute TTL).
     *
     * @param userId Unique user identifier (UUID format required)
     * @param includeInactive Whether to include soft-deleted users
     * @return ResponseEntity containing user profile or 404 if not found
     * @throws AccessDeniedException When requesting user lacks view permissions
     * @see UserService#getUserById(String) for service layer implementation
     * @author Maruf Bepary
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileDto> getUserProfile(
        @PathVariable String userId,
        @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        // implementation
    }
}
```

**Repository Interface:**
```java
/**
 * Data access layer for Order entity persistence operations.
 * All queries use database indexes for optimal performance.
 *
 * @see Order for entity definition
 * @since 1.0.0
 * @author Maruf Bepary
 */
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    /**
     * Finds orders within date range matching specified status.
     * Results are sorted by creation date descending.
     * Uses native query for better performance on large datasets.
     *
     * @param startDate Inclusive start date for order search
     * @param endDate Inclusive end date for order search
     * @param status Order status to filter by
     * @param pageable Pagination and sorting parameters
     * @return Page of orders matching criteria, empty if none found
     * @author Maruf Bepary
     */
    Page<Order> findOrdersByDateRangeAndStatus(
        LocalDateTime startDate,
        LocalDateTime endDate,
        OrderStatus status,
        Pageable pageable
    );
}
```

**Generic Interface:**
```java
/**
 * Contract for caching implementations with TTL support.
 * Implementations must be thread-safe and handle cache eviction.
 *
 * @param <K> Type of cache keys (must be immutable)
 * @param <V> Type of cached values
 * @see RedisCacheService for distributed cache implementation
 * @since 1.0.0
 * @author Maruf Bepary
 */
public interface CacheService<K, V> {
    // ...
}
```
