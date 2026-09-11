# Multi-Application Architecture, Multi-Tenant Tokens & Edge Security

This reference document outlines patterns for supporting multiple frontend client applications, strict redirect URI validation, dynamic CORS origins, namespaced role claims, audience (`aud`) enforcement against confused deputy attacks, and cookie cross-domain policies in Spring Boot.

---

## 1. Multi-Frontend Client Topology

When a centralized Authentication Service serves multiple client applications (SPAs, internal dashboards, partner portals), it must securely route authorization callbacks and partition authorizations.

```
┌───────────────────────────────────┐     ┌───────────────────────────────────┐
│     Client A: RateWeb SPA         │     │    Client B: AppStatusWeb SPA     │
│  https://rateweb.example.com      │     │  https://status.example.com       │
└─────────────────┬─────────────────┘     └─────────────────┬─────────────────┘
                  │                                         │
                  │ (1) /oauth2/authorization/{provider}    │
                  │     ?redirect_uri=https://...           │
                  ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Spring Boot Centralized Auth Service                        │
│                                                                             │
│  • Strict URI Whitelist Validation (Prevents Open Redirect)                │
│  • State Parameter Encoding: {state}:{Base64URL(redirect_uri)}              │
│  • Multi-Origin CORS: allowCredentials=true + setAllowedOriginPatterns      │
│  • Namespaced Role Extraction: IdP roles -> app_access claim                │
│  • Audience-Targeted Token Minting: aud=["api://rateweb"]                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                       JWKS Public Key │ Distribution
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Resource Server Microservices                               │
│                                                                             │
│  • Orders API (aud="api://orders")      • Billing API (aud="api://billing") │
│  • Strict Issuer & Audience Enforcement (Prevents Confused Deputy Attacks)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Strict URI Validation vs Open Redirect Vulnerabilities

### The Vulnerability: Insecure `startsWith` Matching
A common security failure is validating redirect URLs using prefix matching:
```java
// VULNERABLE IMPLEMENTATION - DO NOT USE
private boolean isAllowedRedirectUrl(String url) {
    return allowedUrls.stream().anyMatch(url::startsWith);
}
```
If `https://app.example.com` is in `allowedUrls`, the following malicious targets pass validation:
* `https://app.example.com.attacker.com` (Subdomain spoofing)
* `https://app.example.com@attacker.com` (User-info credential authority abuse)
* `https://app.example.com:8443/evil` (Port deviation)

### The Secure Implementation: Exact Origin & Path Matching
Parse targets with `java.net.URI` and compare scheme, normalized host, port, and path boundaries:

```java
package com.example.auth.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.List;
import java.util.regex.Pattern;

@Component
@Slf4j
public class RedirectUriValidator {

    /**
     * Validates that the candidate URI matches an explicitly allowed origin,
     * or a permitted anchored pattern (e.g. dynamic pull-request preview environments).
     */
    public boolean isValidRedirectUri(String candidateUri, List<String> allowedOrigins, List<Pattern> allowedPatterns) {
        if (candidateUri == null || candidateUri.isBlank()) {
            return false;
        }

        try {
            URI uri = URI.create(candidateUri).normalize();

            // 1. Enforce absolute URI and secure scheme
            if (!uri.isAbsolute() || (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme()))) {
                return false;
            }

            // Reject userinfo (@ symbol abuse)
            if (uri.getUserInfo() != null) {
                return false;
            }

            String candidateOrigin = getOrigin(uri);

            // 2. Exact Origin Whitelist Check
            for (String allowed : allowedOrigins) {
                URI allowedUri = URI.create(allowed).normalize();
                if (candidateOrigin.equalsIgnoreCase(getOrigin(allowedUri))) {
                    return true;
                }
            }

            // 3. Anchored Wildcard Subdomain Matching (e.g., PR preview deployments)
            if (allowedPatterns != null) {
                for (Pattern pattern : allowedPatterns) {
                    if (pattern.matcher(candidateOrigin).matches()) {
                        return true;
                    }
                }
            }

            return false;
        } catch (IllegalArgumentException e) {
            log.warn("Malformed redirect URI attempted: {}", candidateUri);
            return false;
        }
    }

    private String getOrigin(URI uri) {
        if (uri.getHost() == null) {
            throw new IllegalArgumentException("URI must contain a valid host: " + uri);
        }
        int port = uri.getPort();
        String scheme = uri.getScheme().toLowerCase();
        if (port == -1 || (port == 80 && "http".equals(scheme)) || (port == 443 && "https".equals(scheme))) {
            return scheme + "://" + uri.getHost().toLowerCase();
        }
        return scheme + "://" + uri.getHost().toLowerCase() + ":" + port;
    }
}
```

---

## 3. Multi-Origin CORS Configuration with Credentials

When frontend SPAs call the Auth Service across different subdomains or ports, CORS must be configured with credential transmission enabled (`allowCredentials = true`).

### Browser Constraint: `allowCredentials: true` with Wildcards
Modern browsers strictly reject CORS requests where `Access-Control-Allow-Credentials: true` is paired with wildcard `Access-Control-Allow-Origin: *`.

### Dynamic Multi-Origin Configuration
Use `setAllowedOriginPatterns` for regex-based subdomain expansion or explicitly list allowed origins:

```java
package com.example.auth.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class CorsConfig {

    private final AuthSecurityProperties authProperties;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        
        // 1. Explicitly list allowed origins or patterns (NEVER use "*" with credentials)
        config.setAllowedOrigins(authProperties.getAllowedOrigins());
        
        // For wildcard subdomains (e.g. *.example.com), use pattern:
        // config.setAllowedOriginPatterns(List.of("https://*.example.com", "http://localhost:[*]"));

        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"));
        config.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "Accept",
                "X-Requested-With",
                "X-XSRF-TOKEN"
        ));
        config.setExposedHeaders(List.of("Set-Cookie"));
        
        // 2. Allow credentials for cookie transmission
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

---

## 4. Namespaced Role Partitioning Across Microservices

In multi-application architectures, generic role strings (e.g., `["ADMIN", "VIEWER"]`) create privilege escalation vulnerabilities if tokens are shared across boundaries. An admin in `RateWeb` must not possess admin privileges in `AppStatusWeb`.

### IdP Role Mapping Pattern
External Identity Providers (e.g., Microsoft Entra ID App Roles) deliver roles as delimited strings:
`["RateWeb-Admin", "RateWeb-Viewer", "AppStatusWeb-Viewer"]`

### Namespaced Token Extraction (`OAuth2AttributeExtractor`)
Normalize delimited roles into a structured JSON claim (`app_access`) embedded in the access token:

```java
package com.example.auth.service;

import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

@Component
public class OAuth2AttributeExtractor {

    /**
     * Parses delimited role strings ("AppName-Role") into a namespaced map.
     * Output: { "RateWeb": ["Admin", "Viewer"], "AppStatusWeb": ["Viewer"] }
     */
    @SuppressWarnings("unchecked")
    public Map<String, List<String>> parseAppAccess(OAuth2User principal, String delimiter) {
        Map<String, List<String>> appAccess = new HashMap<>();
        List<String> rawRoles = principal.getAttribute("roles");

        if (rawRoles == null || rawRoles.isEmpty()) {
            return appAccess;
        }

        for (String entry : rawRoles) {
            String[] parts = entry.split(Pattern.quote(delimiter), 2);
            if (parts.length == 2) {
                String app = parts[0].trim();
                String role = parts[1].trim();
                appAccess.computeIfAbsent(app, k -> new ArrayList<>()).add(role);
            }
        }
        return appAccess;
    }
}
```

### Claim Serialization in JWT
Embed the structured map under `app_access`:

```json
{
  "sub": "user@example.com",
  "type": "access",
  "iss": "https://auth.example.com",
  "aud": ["api://rateweb"],
  "app_access": {
    "RateWeb": ["Admin", "Viewer"],
    "AppStatusWeb": ["Viewer"]
  },
  "exp": 1757596800
}
```

---

## 5. Token Audience (`aud`) & Issuer (`iss`) Enforcement (RFC 7519)

### Confused Deputy Attack
If an Auth Service issues tokens without audience constraints, a malicious or compromised resource server (e.g. `Stats API`) can take an incoming user token and replay it against the `Payments API`. Because both services verify the same Auth Service JWKS, the `Payments API` accepts the token without realizing it was intended only for stats collection.

### Mitigation: Audience Targeting at Issuance
When the Auth Service issues an access token, it targets the specific recipient resource server:

```java
String accessToken = Jwts.builder()
        .subject(user.getUsername())
        .issuer("https://auth.example.com")
        .audience().add("api://billing").and()
        .claim("type", "access")
        .claim("app_access", appAccess)
        .issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + 900000))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
```

### Verification in Resource Server (`JwtAuthenticationFilter`)
The resource server MUST strictly enforce that the token was signed by the expected issuer and targeted directly to its own service audience:

```java
package com.example.resource.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwksKeyLoader jwksKeyLoader;

    @Value("${auth.expected-issuer:https://auth.example.com}")
    private String expectedIssuer;

    @Value("${auth.service-audience:api://billing}")
    private String serviceAudience;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractJwt(request);

        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                // Strict Cryptographic Signature, Expiry, Issuer, and Audience Validation
                Claims claims = Jwts.parser()
                        .verifyWith(jwksKeyLoader.getPublicKey())
                        .requireIssuer(expectedIssuer)
                        .requireAudience(serviceAudience)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                // Prevent token type confusion (RFC 8725)
                if (!"access".equals(claims.get("type"))) {
                    filterChain.doFilter(request, response);
                    return;
                }

                // Extract roles scoped specifically to this microservice
                List<SimpleGrantedAuthority> authorities = extractScopedAuthorities(claims, "Billing");

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(claims.getSubject(), null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);

            } catch (Exception ex) {
                log.debug("JWT validation failed: {}", ex.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    @SuppressWarnings("unchecked")
    private List<SimpleGrantedAuthority> extractScopedAuthorities(Claims claims, String appName) {
        Map<String, List<String>> appAccess = claims.get("app_access", Map.class);
        if (appAccess != null && appAccess.containsKey(appName)) {
            return appAccess.get(appName).stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                    .collect(Collectors.toList());
        }
        return List.of();
    }
}
```

---

## 6. Cookie Architecture: Same-Origin Gateway vs Cross-Site Cookies

| Architecture Strategy | Routing & Domain Setup | Cookie Flags | Trade-offs & Security Profile |
|---|---|---|---|
| **Same-Origin API Gateway (Gold Standard)** | Reverse proxy routes all traffic under one origin:<br/>`app.example.com/` (SPA)<br/>`app.example.com/api/auth/` (Auth)<br/>`app.example.com/api/v1/` (Resource) | `HttpOnly; Secure; SameSite=Lax; Path=/` | • Zero cross-origin CORS complexity.<br/>• Eliminates third-party cookie blocking.<br/>• Immune to browser cookie partitioning (CHIPS).<br/>• Strong CSRF protection via `SameSite=Lax`. |
| **Shared Parent Domain** | SPA on `app.example.com`<br/>Auth on `auth.example.com` | `HttpOnly; Secure; SameSite=Lax; Domain=.example.com; Path=/` | • Cookies shared across subdomains under same eTLD+1.<br/>• `SameSite=Lax` sends cookies on top-level navigation.<br/>• Sensitive to subdomain compromise (shared cookie scope). |
| **Cross-Site Distinct Domains** | SPA on `client-app.com`<br/>Auth on `auth-service.net` | `HttpOnly; Secure; SameSite=None; Partitioned; Path=/` | • Requires `SameSite=None; Secure`.<br/>• Modern browsers (Safari, Chrome 3PCD) block third-party cookies unless partitioned (CHIPS).<br/>• Must pair with anti-CSRF token headers (`X-XSRF-TOKEN`). |

