---
name: spring-boot-oauth
description: Use when building, configuring, securing, or debugging Spring Boot OAuth2 architectures, including dedicated authentication services, stateless resource servers, RS256 JWT signing, JWKS key distribution, refresh token rotation, httpOnly cookie session management, or running OIDC login locally against a mock IdP (for example a mock Entra ID).
---

# Spring Boot OAuth & Distributed Identity

Decoupled architecture separating authentication (OAuth2 broker, RS256 signing, refresh rotation) into a **Dedicated Auth Service** and business APIs into **Stateless Resource Servers** verifying tokens via JWKS (`/.well-known/jwks.json`).

## When to Use

### Use When
- Centralizing OAuth2 logins (Entra ID, GitHub, Google) and local credentials across SPAs and microservices.
- Enforcing stateless RS256 JWT sessions in `httpOnly; SameSite=Lax; Secure` cookies with Refresh Token Rotation (RTR).
- Operating behind API gateways, reverse proxies, or corporate egress proxies.

### When NOT to Use
- Monolithic server-rendered apps where Spring Security standard `HttpSession` suffices.
- Architectures using third-party auth (Auth0, Keycloak) where token minting is fully external.

## Workflow Protocol

1. **Topology & Network**: Set `server.forward-headers-strategy=framework` behind reverse proxies to prevent `redirect_uri_mismatch`. Route outbound IdP calls through Apache HttpClient 5 in corporate networks.
2. **Keypair & JWKS**: Generate 2048-bit RSA keys. Serve RFC 7517 JWKS at `/.well-known/jwks.json`, stripping Java `BigInteger` zero sign-byte from modulus `n`.
3. **Dedicated Auth Service**: Configure stateless `SecurityFilterChain`. Store OAuth2 requests in cookies. Issue 15-minute access JWTs and SHA-256 hashed 7-day refresh tokens with single-use rotation.
4. **Stateless Resource Servers**: Cache Auth Service public key at startup. Enforce signature, `type == "access"`, issuer (`iss`), and audience (`aud`) in `JwtAuthenticationFilter` against confused deputy attacks.
5. **Multi-Client Hardening**: Validate redirect URIs using exact URI origin matching (never `startsWith`). Configure CORS with explicit origin patterns and `allowCredentials=true`. Partition roles into `app_access` claims.
6. **Local IdP Mock**: Derive the client's real contract first, then mock only what it calls (see mock guide).

## Architecture Rationalization

| Shortcut / Excuse | Reality & Correct Action |
|---|---|
| "Store tokens in localStorage" | Vulnerable to XSS. Use `httpOnly; SameSite=Lax; Secure` cookies. |
| "Use HS256 across microservices" | Compromised service can forge tokens. Use RS256 with JWKS. |
| "Match redirect URI with startsWith" | Open redirect hole. Validate exact URI scheme, host, and port. |
| "Skip audience (aud) check" | Enables token replay across services. Enforce `iss` and `aud`. |
| "Use issuer-uri behind firewall" | Startup failure on egress. Declare explicit endpoint URIs. |
| "Custom `NimbusJwtDecoder` is enough" | Skips `OidcIdTokenValidator`. Add it explicitly. |
| "`no-proxy` setting covers localhost" | Often unenforced. Enforce it or blank the proxy host. |

## Red Flags - STOP and Correct

- Using `allowedOrigins: ["*"]` with `allowCredentials: true` (browser-rejected).
- Missing `server.forward-headers-strategy` behind TLS-terminating proxies.
- Storing unhashed refresh tokens in database (must be SHA-256 hashed).
- Missing `type: "access"` claim check on APIs (token type confusion).
- Redeeming an authorization code before authenticating the client.

## Reference Guides

- [Auth Service Architecture](references/auth-service-architecture.md): SecurityConfig, local auth, controller.
- [Resource Server Architecture](references/resource-server-architecture.md): JwksKeyLoader, JwtFilter, `@PreAuthorize`.
- [Proxy & Gateway Configuration](references/proxy-and-gateway-configuration.md): Forwarded headers, egress proxy, client beans.
- [Multi-Application Architecture](references/multi-application-architecture.md): Strict redirect URI, multi-CORS, namespaced roles, audience.
- [JWT RS256 & JWKS](references/jwt-rs256-and-jwks.md): Key generation, RFC 7517 JWKS, JJWT 0.12.x.
- [OAuth2 Flows & Resolvers](references/oauth2-flows-and-handlers.md): Cookie request repo, dynamic redirect, attributes.
- [Token Lifecycle & Cookies](references/token-lifecycle-and-cookies.md): RTR, SHA-256 hashing, blacklisting.
- [Configuration & Multi-Service](references/configuration-and-multi-service.md): YAML specs, typed properties.
- [Local OIDC IdP Mock](references/local-oidc-idp-mock.md): Mock Entra ID, client contract, TDD, curl checks.