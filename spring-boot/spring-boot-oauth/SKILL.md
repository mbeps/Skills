---
name: spring-boot-oauth
description: Use when building, configuring, securing, or debugging Spring Boot OAuth2 architectures, including dedicated authentication services, stateless resource servers, RS256 JWT signing, JWKS key distribution, refresh token rotation, or httpOnly cookie session management.
---

# Spring Boot OAuth & Distributed Identity

## Overview
A decoupled identity architecture separates authentication (OAuth2 broker, credential validation, RS256 JWT minting, refresh rotation) into a **Dedicated Authentication Service** and business logic into **Stateless Resource Servers** that verify tokens using the Auth Service's public key via JWKS (`/.well-known/jwks.json`).

---

## When to Use

### Use When
- Designing a multi-service or microservice architecture requiring centralized authentication and stateless API authorization.
- Implementing OAuth2 social logins (GitHub, Microsoft Entra ID, Google) alongside local email/password authentication in Spring Boot 3.x or 4.x.
- Securing single-page applications (Next.js, React, Vue) with secure `httpOnly` cookies rather than vulnerable `localStorage` tokens.
- Configuring asymmetric RS256 JWT signing with automated JWKS key distribution per RFC 7517.
- Enforcing Refresh Token Rotation (RTR), database token hashing (SHA-256), and immediate access token revocation blacklists.

### When NOT to Use
- Simple monolithic server-rendered MVC apps where Spring Security's standard `HttpSession` and form login are sufficient.
- External managed identity providers (e.g., Auth0, Keycloak, Clerk, Supabase) where token minting and rotation are entirely hosted externally.

---

## Architecture Blueprint

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER / CLIENT                                │
│        • httpOnly Cookies: "jwt" (15 min TTL), "refresh_token" (7 day TTL)   │
└──────────────────────┬────────────────────────────────┬─────────────────────┘
                       │                                │
      Auth Requests    │                                │ Business Requests
      (Login/Refresh)  │                                │ (Protected Data/CRUD)
                       ▼                                ▼
┌─────────────────────────────────────┐  JWKS PubKey  ┌────────────────────────┐
│     Authentication Service          │  Distribution │  Backend Resource API  │
│          (Port 8081)                │──────────────►│      (Port 8080)       │
│                                     │ GET /.well-   │                        │
│ • OAuth2 Broker (GitHub, Azure, etc)│ known/jwks    │ • Stateless (No DB)    │
│ • RS256 Private Key Signing         │               │ • Cached RSAPublicKey  │
│ • Refresh Token Rotation (SHA-256)  │               │ • JwtAuthentication   │
│ • Access Token Blacklist            │               │   Filter & @PreAuth    │
└──────────────────┬──────────────────┘               └────────────────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │  Auth Database   │
         │  (Postgres/Mongo)│
         └──────────────────┘
```

---

## Reference Guides

Detailed technical guides and complete runnable implementations are organized into modular references:

| Reference Document | Primary Focus |
|---|---|
| [auth-service-architecture.md](references/auth-service-architecture.md) | Dedicated Auth Service `SecurityConfig`, `JwtAuthenticationFilter`, `AuthController`, local auth, and logout invalidation. |
| [resource-server-architecture.md](references/resource-server-architecture.md) | Backend Resource Server, startup `JwksKeyLoader`, signature verification filter, and `@PreAuthorize` API controllers. |
| [jwt-rs256-and-jwks.md](references/jwt-rs256-and-jwks.md) | Asymmetric RS256 vs HS256, JJWT 0.12.x signing/parsing, JWKS RFC 7517 endpoint, and Java BigInteger sign-byte stripping. |
| [oauth2-flows-and-handlers.md](references/oauth2-flows-and-handlers.md) | Dynamic redirect URI resolver, stateless cookie authorization repository, success/failure handlers, and attribute normalization. |
| [token-lifecycle-and-cookies.md](references/token-lifecycle-and-cookies.md) | Refresh token rotation, SHA-256 storage hashing, access token blacklist, TTL cleanup, and `HttpCookieFactory`. |
| [configuration-and-multi-service.md](references/configuration-and-multi-service.md) | Full `application.yaml` schemas, typed `@ConfigurationProperties`, multi-origin expansion, and production security checklist. |

---

## Key Concepts & Architecture Decisions

### 1. Asymmetric RS256 vs Symmetric HS256
- **RS256 (Chosen)**: Auth Service holds the RSA private key to sign tokens; Resource Servers hold only the public key to verify signatures. A compromised Resource Server cannot forge tokens.
- **HS256 (Rejected for Microservices)**: Uses a shared secret. Any service capable of verifying tokens can also forge tokens for any user.

### 2. JWKS Key Distribution (RFC 7517)
- Auth Service serves `GET /.well-known/jwks.json` exposing key modulus (`n`) and public exponent (`e`).
- Resource Servers fetch and reconstruct `RSAPublicKey` at startup (`@PostConstruct`) using Spring's `RestClient`.

### 3. Stateless Sessions via HttpOnly Cookies
- All authentication state is transmitted via `httpOnly`, `SameSite=Lax`, `Secure` cookies (`jwt` and `refresh_token`).
- Mitigates XSS attack vectors (JavaScript cannot read tokens) and CSRF attacks (`SameSite=Lax` with JSON APIs).

---

## Quick Reference & Fast Lookup

### Key Classes & Annotations

| Component | Responsibility |
|---|---|
| `@EnableWebSecurity` / `@EnableMethodSecurity` | Enables Spring Security filter chain and `@PreAuthorize` method annotations. |
| `SessionCreationPolicy.STATELESS` | Instructs Spring Security never to create or use an `HttpSession`. |
| `OAuth2AuthorizationRequestResolver` | Intercepts `/oauth2/authorization/{provider}` to append validated frontend redirect URI into `state`. |
| `AuthorizationRequestRepository` | Stores OAuth2 state in an `httpOnly` cookie (`oauth2_auth_request`) instead of HTTP session. |
| `SimpleUrlAuthenticationSuccessHandler` | Issues RS256 token cookies upon OAuth2 callback and redirects user to frontend dashboard. |
| `OncePerRequestFilter` | Base class for custom `JwtAuthenticationFilter` verifying tokens on incoming requests. |
| `@AuthenticationPrincipal OAuth2User` | Injects validated user identity directly into controller handler methods. |

### Essential Endpoints

| Method | Path | Service | Access | Description |
|---|---|---|---|---|
| `GET` | `/oauth2/authorization/{provider}` | Auth Service | Public | Initiates OAuth2 flow with `?redirect_uri={clientOrigin}`. |
| `GET` | `/login/oauth2/code/{provider}` | Auth Service | Public | OAuth2 provider callback endpoint. |
| `POST` | `/api/auth/refresh` | Auth Service | Public (Cookie) | Rotates refresh token and issues fresh access token. |
| `GET` | `/api/auth/status` | Auth Service | Optional Auth | Returns authenticated status and user profile payload. |
| `POST` | `/logout` | Auth Service | Public | Blacklists access token, deletes refresh token, clears cookies. |
| `GET` | `/.well-known/jwks.json` | Auth Service | Public | Serves RSA public key in RFC 7517 JWKS format. |
| `GET` | `/api/public/health` | Resource Server | Public | Public health check. |
| `GET` | `/api/protected/data` | Resource Server | `authenticated()` | Protected business resource guarded by RS256 token. |

---

## Common Pitfalls & Security Vulnerabilities

### 1. Token Type Confusion (RFC 8725)
* **Risk**: An attacker presents a long-lived Refresh Token directly to a Resource Server API endpoint.
* **Fix**: Always embed `type: "access"` in access tokens and `type: "refresh"` in refresh tokens. Both filters must reject tokens where `type != "access"`:
  ```java
  if (!"access".equals(claims.get("type"))) {
      filterChain.doFilter(request, response);
      return;
  }
  ```

### 2. JWKS BigInteger Leading Sign-Byte Bug
* **Risk**: `BigInteger.toByteArray()` in Java prepends a `0x00` sign byte when the highest bit is set. Encoding this directly creates an invalid Base64URL modulus `n` that breaks standard JWKS consumers.
* **Fix**: Strip the leading `0x00` byte before Base64URL encoding without padding:
  ```java
  byte[] bytes = publicKey.getModulus().toByteArray();
  if (bytes.length > 1 && bytes[0] == 0) {
      bytes = Arrays.copyOfRange(bytes, 1, bytes.length);
  }
  String n = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  ```

### 3. Open Redirect Vulnerabilities in OAuth2 `state`
* **Risk**: Accepting arbitrary `redirect_uri` parameters in `/oauth2/authorization/{provider}` enables attackers to steal authorization codes.
* **Fix**: Validate the requested `redirect_uri` against a strict whitelist (`auth.allowed-redirect-urls`) both in the resolver **and** in the authentication success handler.

### 4. Circular 401 Refresh Loops
* **Risk**: Attaching a 401 token refresh interceptor to the authentication client causes an infinite loop when the refresh token itself is expired.
* **Fix**: Maintain two distinct HTTP clients on the frontend:
  - `authClient`: Targets Auth Service (:8081) — **NO 401 interceptor**.
  - `apiClient`: Targets Resource Server (:8080) — Has 401 interceptor that delegates refresh to `authClient`.

### 5. Wildcard CORS with Credentials
* **Risk**: Using `allowedOrigins: ["*"]` with `allowCredentials: true` is forbidden by browsers and compromises security.
* **Fix**: Explicitly enumerate origins in `auth.allowed-origins` (e.g., `http://localhost:3000`, `http://localhost:8080`).

