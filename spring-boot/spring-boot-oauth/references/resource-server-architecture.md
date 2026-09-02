# Resource Server Architecture Reference

This document provides a comprehensive guide to building a **stateless Backend API / Resource Server** in Spring Boot (Spring Boot 3.x / 4.x). The Resource Server hosts business logic and guards protected endpoints by verifying RS256 JWTs using an RSA public key retrieved from the Authentication Service's JWKS endpoint.

---

## 1. Core Architecture & Constraints

The Resource Server operates under a zero-trust, stateless identity model:
- **Stateless Verification**: Does not maintain HTTP sessions and does not connect to the authentication database.
- **Asymmetric Cryptography**: Holds **only the RSA Public Key** cached in memory. It cannot forge or sign tokens.
- **Fail-Fast JWKS Initialization**: Retrieves the public key at startup (`@PostConstruct`) from the Auth Service's `GET /.well-known/jwks.json`. If the Auth Service is unreachable, startup aborts immediately.
- **Access Token Type Enforcement**: Inspects the JWT payload to ensure `type == "access"`. Refresh tokens are rejected immediately.
- **Declarative Authorization**: Employs `@PreAuthorize("isAuthenticated()")` and role/authority checks (`hasRole('ROLE_USER')`, `hasAuthority('SCOPE_...')`) on controller methods.

```
┌───────────────────────────┐                 ┌───────────────────────────┐
│     Backend API (8080)    │                 │    Auth Service (8081)    │
│                           │                 │                           │
│  JwksKeyLoader            │  1. Startup GET │  WellKnownController      │
│  (@PostConstruct)         ├────────────────►│  (/.well-known/jwks.json) │
│  Reconstructs & Caches    │◄────────────────┤                           │
│  RSAPublicKey in Memory   │  2. JWKS JSON   │                           │
└─────────────┬─────────────┘                 └───────────────────────────┘
              │
              │ Incoming Request with "jwt" cookie
              ▼
┌───────────────────────────┐
│  JwtAuthenticationFilter  │
│  • Verifies RS256 Sig     │
│  • Checks type == access  │
│  • Builds DefaultOAuth2User
│  • Sets SecurityContext   │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│  ApiController / Business │
│  • @AuthenticationPrincipal
│  • @PreAuthorize          │
└───────────────────────────┘
```

---

## 2. JWKS Key Loader (`JwksKeyLoader`)

The `JwksKeyLoader` component is responsible for retrieving and caching the RSA public key from the JWKS endpoint during application startup using Spring's `RestClient`.

```java
package com.maruf.oauth.config;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwksKeyLoader {

    private final AuthServiceProperties authServiceProperties;
    private final RestClient restClient = RestClient.create();
    private RSAPublicKey publicKey;

    @PostConstruct
    public void init() {
        loadPublicKey();
    }

    public RSAPublicKey getPublicKey() {
        return publicKey;
    }

    /**
     * Fetches JWKS JSON, extracts modulus (n) and exponent (e), and constructs an RSAPublicKey.
     * Throws IllegalStateException if the endpoint is unreachable or response is invalid,
     * failing fast before accepting incoming traffic.
     */
    private void loadPublicKey() {
        String jwksUrl = authServiceProperties.getJwksUrl() + "/.well-known/jwks.json";
        log.info("Loading JWKS from: {}", jwksUrl);

        try {
            String response = restClient.get()
                    .uri(jwksUrl)
                    .retrieve()
                    .body(String.class);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode jwks = mapper.readTree(response);
            JsonNode keys = jwks.get("keys");

            if (keys == null || !keys.isArray() || keys.isEmpty()) {
                throw new IllegalStateException("No keys found in JWKS response");
            }

            JsonNode firstKey = keys.get(0);
            String n = firstKey.get("n").asText();
            String e = firstKey.get("e").asText();

            byte[] modulusBytes = Base64.getUrlDecoder().decode(n);
            byte[] exponentBytes = Base64.getUrlDecoder().decode(e);

            // Force positive signum (1) when converting decoded bytes to BigInteger
            BigInteger modulus = new BigInteger(1, modulusBytes);
            BigInteger exponent = new BigInteger(1, exponentBytes);

            RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            this.publicKey = (RSAPublicKey) keyFactory.generatePublic(spec);

            log.info("RSA public key loaded successfully from JWKS endpoint");
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to load public key from JWKS endpoint: " + jwksUrl, ex);
        }
    }
}
```

---

## 3. Backend JWT Authentication Filter

The backend filter executes on every incoming request:
1. Extracts the token from the `jwt` cookie (or optionally an `Authorization: Bearer <token>` header).
2. Verifies the cryptographic RS256 signature and expiry against the cached `RSAPublicKey`.
3. Verifies `type == "access"`.
4. Reconstructs user attributes and injects the authenticated `DefaultOAuth2User` into `SecurityContextHolder`.

```java
package com.maruf.oauth.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwksKeyLoader jwksKeyLoader;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        String jwt = extractJwt(request);

        if (jwt != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                // 1. Verify signature with cached public key & parse claims
                Claims claims = Jwts.parser()
                        .verifyWith(jwksKeyLoader.getPublicKey())
                        .build()
                        .parseSignedClaims(jwt)
                        .getPayload();

                // 2. Reject non-access tokens (e.g. refresh tokens)
                String tokenType = (String) claims.get("type");
                if (!"access".equals(tokenType)) {
                    log.debug("Token is not an access token");
                    filterChain.doFilter(request, response);
                    return;
                }

                // 3. Map claims to attributes
                Map<String, Object> attributes = new HashMap<>();
                Object idClaim = claims.get("id");
                if (idClaim instanceof Number) {
                    attributes.put("id", ((Number) idClaim).intValue());
                } else if (idClaim != null) {
                    attributes.put("id", idClaim);
                }

                if (claims.get("login") != null) attributes.put("login", claims.get("login"));
                if (claims.get("name") != null) attributes.put("name", claims.get("name"));
                if (claims.get("email") != null) attributes.put("email", claims.get("email"));
                if (claims.get("avatar_url") != null) attributes.put("avatar_url", claims.get("avatar_url"));

                OAuth2User oauth2User = new DefaultOAuth2User(
                        Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                        attributes,
                        "login");

                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        oauth2User,
                        null,
                        oauth2User.getAuthorities());

                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);

                log.debug("JWT validated for user: {}", claims.get("login"));
            } catch (Exception e) {
                log.error("JWT validation failed: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractJwt(HttpServletRequest request) {
        // Check Authorization header first
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        // Fall back to cookie
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("jwt".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
```

---

## 4. Backend Security Configuration (`SecurityConfig`)

```java
package com.maruf.oauth.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    @Value("${frontend.url:http://localhost:3000}")
    private String frontendUrl;

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll())
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(apiAuthenticationEntryPoint()))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(frontendUrl));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Content-Type", "Authorization"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationEntryPoint apiAuthenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Authentication required\"}");
        };
    }
}
```

---

## 5. Alternative: Spring Security Native Resource Server

For architectures preferring Spring Security's native `spring-boot-starter-oauth2-resource-server` with `NimbusJwtDecoder` rather than a custom filter:

### `application.yaml` Configuration
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: ${AUTH_SERVICE_JWKS_URL:http://localhost:8081}/.well-known/jwks.json
```

### SecurityFilterChain with Cookie Bearer Token Resolver
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .requestMatchers("/api/**").authenticated()
            .anyRequest().permitAll())
        .oauth2ResourceServer(oauth2 -> oauth2
            .bearerTokenResolver(cookieBearerTokenResolver())
            .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));

    return http.build();
}

@Bean
public BearerTokenResolver cookieBearerTokenResolver() {
    DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
    resolver.setAllowFormEncodedBodyParameter(false);
    return request -> {
        // Extract from Header first
        String token = resolver.resolve(request);
        if (token != null) return token;
        // Fall back to Cookie
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("jwt".equals(cookie.getName())) return cookie.getValue();
            }
        }
        return null;
    };
}
```

---

## 6. Business Logic Controllers & Parameter Injection

Guarding endpoints and accessing authenticated user claims in `@RestController`:

```java
package com.maruf.oauth.controller;

import com.maruf.oauth.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Slf4j
public class ApiController {

    @GetMapping("/api/public/health")
    public ResponseEntity<PublicHealthResponse> publicHealth() {
        return ResponseEntity.ok(PublicHealthResponse.builder()
                .status("OK")
                .message("Public health check operational")
                .timestamp(System.currentTimeMillis())
                .build());
    }

    @GetMapping("/api/user")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserResponse> getUser(@AuthenticationPrincipal OAuth2User principal) {
        UserResponse response = UserResponse.builder()
                .id(principal.getAttribute("id") != null ? principal.getAttribute("id").toString() : null)
                .login(principal.getAttribute("login"))
                .name(principal.getAttribute("name"))
                .email(principal.getAttribute("email"))
                .avatarUrl(principal.getAttribute("avatar_url"))
                .build();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/protected/data")
    @PreAuthorize("hasRole('ROLE_USER')")
    public ResponseEntity<ProtectedDataResponse> getProtectedData(@AuthenticationPrincipal OAuth2User principal) {
        String username = principal.getAttribute("login");
        return ResponseEntity.ok(ProtectedDataResponse.builder()
                .message("Confidential Business Data")
                .user(username)
                .data(ProtectedDataResponse.DataContent.builder()
                        .items(new String[]{"Record A", "Record B", "Record C"})
                        .count(3)
                        .lastUpdated(System.currentTimeMillis())
                        .build())
                .build());
    }

    @PostMapping("/api/protected/action")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ActionResponse> performAction(
            @AuthenticationPrincipal OAuth2User principal,
            @Validated @RequestBody ActionRequest request) {
        String username = principal.getAttribute("login");
        log.info("Action '{}' executed by {}", request.getAction(), username);
        return ResponseEntity.ok(ActionResponse.builder()
                .message("Action successfully executed")
                .user(username)
                .action(request.getAction())
                .result("Success")
                .timestamp(System.currentTimeMillis())
                .build());
    }
}
```

