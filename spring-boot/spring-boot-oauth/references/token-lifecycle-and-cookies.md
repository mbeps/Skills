# Token Lifecycle, Refresh Rotation & Cookie Security Reference

This reference document explains the complete lifecycle of Access and Refresh tokens, Refresh Token Rotation (RTR), database hashing, access token revocation blacklists, and secure `httpOnly` cookie transportation.

---

## 1. Dual-Token Architecture & Security Model

```
Token Strategy Matrix:
┌─────────────────────┬────────────────────────────┬─────────────────────────────┐
│ Dimension           │ Access Token               │ Refresh Token               │
├─────────────────────┼────────────────────────────┼─────────────────────────────┤
│ Purpose             │ Authorize API requests     │ Renew Access Token          │
│ Lifespan (TTL)      │ Short-lived (15 minutes)   │ Long-lived (7 days)         │
│ Cryptographic Type  │ RS256 Signed JWT           │ RS256 Signed JWT            │
│ Transport Medium    │ httpOnly Cookie (`jwt`)    │ httpOnly Cookie (`refresh`) │
│ Storage Location    │ Client Browser Cookie      │ Database (SHA-256 Hashed)   │
│ Verification        │ Stateless (Public Key)     │ Stateful (DB Lookup + Sign) │
│ Revocation Check    │ Auth Service Blacklist     │ Immediate Database Deletion │
└─────────────────────┴────────────────────────────┴─────────────────────────────┘
```

---

## 2. Refresh Token Rotation (RTR) & Storage Hashing

### Database Security: SHA-256 Token Hashing
Refresh tokens are credentials with a 7-day validity window. To protect users against database dumps or SQL/NoSQL injection exfiltration, raw refresh tokens are **never persisted in plaintext**. They are converted to SHA-256 Base64URL digests before database insertion and query matching.

```
Incoming Refresh Token (JWT String)
              │
              ▼
   SHA-256 Digest Computation
              │
              ▼
   Base64URL Encoding (no padding)
              │
              ▼
   Database Lookup: findByToken(hashedToken)
```

### Refresh Token Store Implementation (`RefreshTokenStore`)

```java
package com.maruf.auth.service;

import com.maruf.auth.config.RefreshTokenSecurityProperties;
import com.maruf.auth.entity.InvalidatedToken;
import com.maruf.auth.entity.RefreshToken;
import com.maruf.auth.repository.InvalidatedTokenRepository;
import com.maruf.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class RefreshTokenStore {

    private final RefreshTokenRepository refreshTokenRepository;
    private final InvalidatedTokenRepository invalidatedTokenRepository;
    private final RefreshTokenSecurityProperties properties;

    public void storeRefreshToken(String token, String username, Instant expiresAt) {
        String tokenHash = applyHash(token);
        RefreshToken entity = RefreshToken.builder()
                .token(tokenHash)
                .username(username)
                .expiresAt(expiresAt)
                .createdAt(Instant.now())
                .lastUsed(Instant.now())
                .build();
        refreshTokenRepository.save(entity);
    }

    public String getUsernameFromRefreshToken(String token) {
        String tokenHash = applyHash(token);
        Optional<RefreshToken> record = refreshTokenRepository.findByToken(tokenHash);
        if (record.isPresent()) {
            RefreshToken entity = record.get();
            entity.setLastUsed(Instant.now());
            refreshTokenRepository.save(entity);
            return entity.getUsername();
        }
        return null;
    }

    public void invalidateRefreshToken(String token) {
        String tokenHash = applyHash(token);
        refreshTokenRepository.deleteByToken(tokenHash);
    }

    public void invalidateAccessToken(String token, String username, Instant expiresAt) {
        InvalidatedToken entity = InvalidatedToken.builder()
                .token(token) // Raw token stored for O(1) exact match
                .username(username)
                .expiresAt(expiresAt)
                .invalidatedAt(Instant.now())
                .reason("logout")
                .build();
        invalidatedTokenRepository.save(entity);
    }

    public boolean isAccessTokenInvalidated(String token) {
        return invalidatedTokenRepository.existsByToken(token);
    }

    private String applyHash(String token) {
        if (!properties.isHashingEnabled()) {
            return token;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }
}
```

---

## 3. Access Token Blacklisting & Immediate Revocation

Because access tokens are verified statelessly by resource servers, standard JWTs cannot be revoked before their natural `exp` timestamp without a state check.

### Revocation on Logout Flow
1. User calls `POST /logout`.
2. Auth Service extracts `jwt` cookie. If valid, inserts `{ token: rawToken, expiresAt: token.exp, invalidatedAt: now }` into `invalidated_access_tokens`.
3. Auth Service deletes the user's `refresh_token` from `refresh_tokens`.
4. Auth Service sets both `jwt` and `refresh_token` cookies with `maxAge = 0`.

### Blacklist Asymmetry & Mitigation
- **Auth Service**: Checks `isAccessTokenInvalidated(jwt)` on every request. Any further interaction with authentication endpoints is blocked immediately.
- **Resource Servers**: Operate statelessly without database connectivity. An access token remains cryptographically valid until its 15-minute expiration.
- **Security Trade-off**: The 15-minute window is an intentional microservice design choice balancing horizontal performance with security. When high-security compliance requires instant cross-service revocation, resource servers can query a shared distributed cache (e.g. Redis) or subscribe to token revocation events.

---

## 4. Automatic TTL Cleanup

To prevent database bloat from accumulated expired tokens and blacklist records:

### Approach A: Relational Database (PostgreSQL / MySQL) with Spring Scheduled Task
```java
package com.maruf.auth.service;

import com.maruf.auth.repository.InvalidatedTokenRepository;
import com.maruf.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenCleanupService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final InvalidatedTokenRepository invalidatedTokenRepository;

    @Scheduled(cron = "0 0 * * * *") // Runs every hour at minute 0
    @Transactional
    public void cleanupExpiredTokens() {
        Instant now = Instant.now();
        log.info("Purging expired tokens prior to {}", now);
        try {
            refreshTokenRepository.deleteByExpiresAtBefore(now);
            invalidatedTokenRepository.deleteByExpiresAtBefore(now);
        } catch (Exception e) {
            log.error("Token cleanup execution failed: {}", e.getMessage(), e);
        }
    }
}
```

### Approach B: MongoDB Native TTL Indexes
```java
@Document(collection = "refresh_tokens")
public class RefreshToken {
    @Id private String id;
    @Indexed(unique = true) private String token;
    private String username;
    @Indexed(expireAfter = "0s") private Instant expiresAt;
    private Instant createdAt;
    private Instant lastUsed;
}
```

---

## 5. HttpOnly Cookie Factory & Security Properties

All authentication cookies must be created through a centralized factory to guarantee security attributes across all endpoints:

```java
package com.maruf.auth.config;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import jakarta.servlet.http.HttpServletResponse;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class HttpCookieFactory {

    private final CookieSecurityProperties properties;

    public ResponseCookie buildTokenCookie(String name, String value, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)                      // Inaccessible to JavaScript (XSS Protection)
                .secure(properties.isSecure())       // HTTPS only in staging/production
                .sameSite(properties.getSameSite())  // "Lax" for OAuth2 redirect compatibility
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    public void writeTo(HttpServletResponse response, String name, String value, Duration maxAge) {
        // Use addHeader to allow multiple Set-Cookie headers in the same response
        response.addHeader(HttpHeaders.SET_COOKIE, buildTokenCookie(name, value, maxAge).toString());
    }
}
```

---

## 6. Frontend Token Refresh Interceptor & Concurrency

To prevent infinite refresh loops and handle simultaneous 401s across concurrent API requests:

```typescript
// apiClient Axios Interceptor
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: any) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(null);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Delegate refresh to authClient (which has NO 401 interceptor)
        await authClient.post("/api/auth/refresh");
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.dispatchEvent(new Event("auth:session-expired"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
```

