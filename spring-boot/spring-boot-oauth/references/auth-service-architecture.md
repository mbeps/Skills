# Auth Service Architecture Reference

This document provides a comprehensive guide to building a **dedicated Authentication Service** in Spring Boot (compatible with Spring Boot 3.x and 4.x / Spring Security 6.x and 7.x). The Auth Service acts as the central identity authority, handling OAuth2 provider brokerage, local authentication, RS256 JWT signing, refresh token lifecycle, and JWKS key distribution.

---

## 1. Core Architecture & Responsibilities

The Authentication Service isolates all identity management from business applications:
- **Centralized OAuth2 Broker**: Initiates OAuth2 authorization flows (e.g., GitHub, Microsoft Entra ID, Google) and handles provider callbacks.
- **Local Authentication Provider**: Feature-flagged email/password authentication using BCrypt password hashing.
- **JWT Authority (RS256)**: Holds the RSA private key, signs access and refresh tokens, and publishes the RSA public key via standard JWKS (`GET /.well-known/jwks.json`).
- **Token Lifecycle & Rotation**: Stores SHA-256 hashed refresh tokens in the database, executes refresh token rotation (RTR), and maintains an access token revocation blacklist.
- **Stateless Cookie Management**: Issues tokens exclusively in `httpOnly`, `SameSite=Lax`, `Secure` cookies without server-side HTTP sessions.

```
                  ┌─────────────────────────────────────────┐
                  │        Dedicated Auth Service           │
                  │              (Port 8081)                │
                  │                                         │
Browser / ───────►│  • /oauth2/authorization/{provider}     │
Frontend          │  • /login/oauth2/code/{provider}        │
                  │  • /api/auth/login  (Local Auth)        │
                  │  • /api/auth/signup (Registration)      │
                  │  • /api/auth/refresh (RTR)              │
                  │  • /api/auth/status                     │
                  │  • /logout (DSL + Blacklist)            │
                  │  • /.well-known/jwks.json (RFC 7517)    │
                  └──────────────┬───────────────────┬──────┘
                                 │                   │
                        Signs Tokens with       Persists Sessions
                         RSA Private Key        & Token Blacklist
                                 │                   │
                                 ▼                   ▼
                          [RS256 JWTs]          [Database]
```

---

## 2. Spring Security Filter Chain (`SecurityConfig`)

The filter chain enforces a stateless security model with custom entry points and handlers.

```java
package com.maruf.auth.config;

import com.maruf.auth.service.JwtService;
import com.maruf.auth.service.RefreshTokenStore;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final AuthSecurityProperties authSecurityProperties;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final OAuth2AuthenticationSuccessHandler oauth2SuccessHandler;
    private final OAuth2AuthenticationFailureHandler oauth2FailureHandler;
    private final RefreshTokenStore refreshTokenStore;
    private final JwtService jwtService;
    private final HttpCookieFactory cookieFactory;
    private final HttpCookieOAuth2AuthorizationRequestRepository authorizationRequestRepository;
    private final ClientRegistrationRepository clientRegistrationRepository;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CustomOAuth2AuthorizationRequestResolver authorizationRequestResolver() {
        return new CustomOAuth2AuthorizationRequestResolver(
                clientRegistrationRepository,
                authSecurityProperties.getAllowedRedirectUrls());
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 1. CORS Configuration for multi-client origins
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // 2. CSRF disabled (Stateless token & SameSite cookie architecture)
            .csrf(csrf -> csrf.disable())
            // 3. Stateless session policy
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // 4. Endpoint authorization
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/", "/error", "/webjars/**").permitAll()
                .requestMatchers("/oauth2/**", "/login/**").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/logout").permitAll()
                .requestMatchers("/.well-known/jwks.json").permitAll()
                .anyRequest().authenticated())
            // 5. Custom API exception handling (JSON 401 instead of HTML redirect)
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(apiAuthenticationEntryPoint()))
            // 6. OAuth2 Login Configuration
            .oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(authEndpoint -> authEndpoint
                    .authorizationRequestRepository(authorizationRequestRepository)
                    .authorizationRequestResolver(authorizationRequestResolver()))
                .successHandler(oauth2SuccessHandler)
                .failureHandler(oauth2FailureHandler))
            // 7. Custom Logout DSL with Token Revocation & Cookie Clearing
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessHandler((request, response, authentication) -> {
                    if (request.getCookies() != null) {
                        for (Cookie cookie : request.getCookies()) {
                            try {
                                if (CookieNames.JWT.equals(cookie.getName())) {
                                    String token = cookie.getValue();
                                    if (jwtService.isTokenValid(token)) {
                                        java.time.Instant expiresAt = jwtService.getExpirationDate(token).toInstant();
                                        String username = jwtService.extractUsername(token);
                                        refreshTokenStore.invalidateAccessToken(token, username, expiresAt);
                                    }
                                } else if (CookieNames.REFRESH_TOKEN.equals(cookie.getName())) {
                                    refreshTokenStore.invalidateRefreshToken(cookie.getValue());
                                }
                            } catch (Exception e) {
                                log.warn("Token invalidation warning during logout: {}", e.getMessage());
                            }
                        }
                    }

                    cookieFactory.writeTo(response, CookieNames.JWT, "", Duration.ZERO);
                    cookieFactory.writeTo(response, CookieNames.REFRESH_TOKEN, "", Duration.ZERO);

                    response.setStatus(HttpServletResponse.SC_OK);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"success\":true,\"message\":\"Logout successful\"}");
                })
                .deleteCookies(CookieNames.JWT, CookieNames.REFRESH_TOKEN))
            // 8. Custom JWT Filter before UsernamePasswordAuthenticationFilter
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(authSecurityProperties.getAllowedOrigins());
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
            String requestUri = request.getRequestURI();
            if (requestUri != null && requestUri.startsWith("/api/")) {
                response.setStatus(HttpStatus.UNAUTHORIZED.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Authentication required\"}");
            } else {
                response.sendRedirect("/login");
            }
        };
    }
}
```

---

## 3. Auth Service JWT Authentication Filter

The Auth Service's `JwtAuthenticationFilter` performs:
1. Extraction of the access token from the `jwt` cookie.
2. **Access token blacklist check** in the database (`RefreshTokenStore#isAccessTokenInvalidated`).
3. RS256 cryptographic signature validation with the RSA public key.
4. **Token type validation** (`type == "access"`) to prevent refresh token abuse.
5. Principal reconstruction as `DefaultOAuth2User` and population of `SecurityContextHolder`.

```java
package com.maruf.auth.config;

import com.maruf.auth.service.JwtService;
import com.maruf.auth.service.RefreshTokenStore;
import io.jsonwebtoken.Claims;
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

    private final JwtService jwtService;
    private final RefreshTokenStore refreshTokenStore;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        String jwt = extractJwtFromCookie(request);

        if (jwt != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                // 1. Blacklist check (Revocation on logout)
                if (refreshTokenStore.isAccessTokenInvalidated(jwt)) {
                    log.debug("Access token is blacklisted");
                    filterChain.doFilter(request, response);
                    return;
                }

                // 2. RS256 signature and expiry validation
                if (jwtService.isTokenValid(jwt)) {
                    // 3. Token type constraint
                    String tokenType = jwtService.extractTokenType(jwt);
                    if (!"access".equals(tokenType)) {
                        log.debug("Token type is not 'access'");
                        filterChain.doFilter(request, response);
                        return;
                    }

                    // 4. Construct principal attributes
                    Claims claims = jwtService.extractAllClaims(jwt);
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

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(oauth2User, null, oauth2User.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                log.error("JWT authentication failed: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractJwtFromCookie(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (CookieNames.JWT.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
```

---

## 4. Auth Controller & Endpoints

The `AuthController` handles session querying, token renewal, provider listing, and local authentication:

```java
package com.maruf.auth.controller;

import com.maruf.auth.config.CookieNames;
import com.maruf.auth.config.HttpCookieFactory;
import com.maruf.auth.config.JwtSecurityProperties;
import com.maruf.auth.config.RefreshTokenSecurityProperties;
import com.maruf.auth.dto.*;
import com.maruf.auth.service.JwtService;
import com.maruf.auth.service.LocalAuthService;
import com.maruf.auth.service.RefreshTokenStore;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final JwtService jwtService;
    private final RefreshTokenStore refreshTokenStore;
    private final HttpCookieFactory cookieFactory;
    private final LocalAuthService localAuthService;
    private final JwtSecurityProperties jwtSecurityProperties;
    private final RefreshTokenSecurityProperties refreshTokenSecurityProperties;
    private final ClientRegistrationRepository clientRegistrationRepository;

    @Value("${app.security.local-auth.enabled:true}")
    private boolean localAuthEnabled;

    @GetMapping("/status")
    public ResponseEntity<AuthStatusResponse> getStatus(@AuthenticationPrincipal OAuth2User principal) {
        if (principal == null) {
            return ResponseEntity.ok(AuthStatusResponse.builder().authenticated(false).build());
        }
        UserResponse user = UserResponse.builder()
                .id(principal.getAttribute("id") != null ? principal.getAttribute("id").toString() : null)
                .login(principal.getAttribute("login"))
                .name(principal.getAttribute("name"))
                .email(principal.getAttribute("email"))
                .avatarUrl(principal.getAttribute("avatar_url"))
                .build();

        return ResponseEntity.ok(AuthStatusResponse.builder()
                .authenticated(true)
                .user(user)
                .build());
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractCookie(request, CookieNames.REFRESH_TOKEN);

        if (refreshToken == null || !jwtService.isTokenValid(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Unauthorized", "Valid refresh token required"));
        }

        String username = refreshTokenStore.getUsernameFromRefreshToken(refreshToken);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Unauthorized", "Refresh token not recognized or expired"));
        }

        // Generate new access token
        Map<String, Object> claims = jwtService.extractAllClaims(refreshToken);
        Map<String, Object> newAccessClaims = new HashMap<>(claims);
        newAccessClaims.remove("exp");
        newAccessClaims.remove("iat");
        newAccessClaims.remove("type");

        String newAccessToken = jwtService.generateAccessToken(newAccessClaims, username);
        cookieFactory.writeTo(response, CookieNames.JWT, newAccessToken,
                Duration.ofMillis(jwtSecurityProperties.getAccessTokenExpiration()));

        // Rotate refresh token if enabled
        if (refreshTokenSecurityProperties.isRotationEnabled()) {
            refreshTokenStore.invalidateRefreshToken(refreshToken);
            String newRefreshToken = jwtService.generateRefreshToken(username, newAccessClaims);
            Instant expiresAt = Instant.now().plusMillis(jwtSecurityProperties.getRefreshTokenExpiration());
            refreshTokenStore.storeRefreshToken(newRefreshToken, username, expiresAt);
            cookieFactory.writeTo(response, CookieNames.REFRESH_TOKEN, newRefreshToken,
                    Duration.ofMillis(jwtSecurityProperties.getRefreshTokenExpiration()));
        }

        return ResponseEntity.ok(Collections.singletonMap("success", true));
    }

    @GetMapping("/providers")
    public ResponseEntity<List<Map<String, String>>> getProviders() {
        List<Map<String, String>> providers = new ArrayList<>();
        if (clientRegistrationRepository instanceof Iterable) {
            @SuppressWarnings("unchecked")
            Iterable<ClientRegistration> registrations = (Iterable<ClientRegistration>) clientRegistrationRepository;
            for (ClientRegistration reg : registrations) {
                Map<String, String> provider = new HashMap<>();
                provider.put("key", reg.getRegistrationId());
                provider.put("name", reg.getClientName());
                providers.add(provider);
            }
        }
        if (localAuthEnabled) {
            Map<String, String> local = new HashMap<>();
            local.put("key", "local");
            local.put("name", "Email & Password");
            providers.add(local);
        }
        return ResponseEntity.ok(providers);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Validated @RequestBody LoginRequest loginRequest, HttpServletResponse response) {
        if (!localAuthEnabled) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse("Not Found", "Local auth disabled"));
        }
        return localAuthService.authenticate(loginRequest, response);
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Validated @RequestBody SignupRequest signupRequest) {
        if (!localAuthEnabled) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse("Not Found", "Local auth disabled"));
        }
        return localAuthService.register(signupRequest);
    }

    private String extractCookie(HttpServletRequest request, String cookieName) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (cookieName.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
```

