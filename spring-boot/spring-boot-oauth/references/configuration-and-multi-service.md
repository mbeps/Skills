# Configuration, Properties & Multi-Service Expansion Reference

This reference document outlines the complete configuration schema, typed `@ConfigurationProperties` classes, and multi-service expansion patterns for Spring Boot OAuth2 systems.

---

## 1. Auth Service `application.yaml` Specification

```yaml
spring:
  config:
    import: optional:file:.env.local[.properties]
  application:
    name: authentication-service
  security:
    oauth2:
      client:
        registration:
          github:
            client-id: ${GITHUB_CLIENT_ID:your-github-client-id}
            client-secret: ${GITHUB_CLIENT_SECRET:your-github-client-secret}
            redirect-uri: "{baseUrl}/login/oauth2/code/github"
            client-authentication-method: client_secret_post
            client-name: GitHub
            scope:
              - user:email
              - read:user
          azure:
            client-id: ${AZURE_CLIENT_ID:your-azure-client-id}
            client-secret: ${AZURE_CLIENT_SECRET:your-azure-client-secret}
            authorization-grant-type: authorization_code
            client-authentication-method: client_secret_post
            redirect-uri: "{baseUrl}/login/oauth2/code/azure"
            scope:
              - openid
              - profile
              - email
              - offline_access
              - User.Read
            client-name: Microsoft Entra ID
        provider:
          github:
            authorization-uri: https://github.com/login/oauth/authorize
            token-uri: https://github.com/login/oauth/access_token
            user-info-uri: https://api.github.com/user
            user-name-attribute: id
          azure:
            issuer-uri: https://login.microsoftonline.com/${AZURE_TENANT_ID:common}/v2.0
            user-name-attribute: sub
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/auth_db}
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:postgres}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false

server:
  port: ${SERVER_PORT:8081}
  forward-headers-strategy: framework # Ensures {baseUrl} resolves external scheme/host/port behind reverse proxies

jwt:
  private-key-path: ${JWT_PRIVATE_KEY_PATH:keys/auth-private.pem}
  public-key-path: ${JWT_PUBLIC_KEY_PATH:keys/auth-public.pem}
  access-token-expiration: ${JWT_ACCESS_TOKEN_EXPIRATION:900000}       # 15 minutes (ms)
  refresh-token-expiration: ${JWT_REFRESH_TOKEN_EXPIRATION:604800000} # 7 days (ms)

auth:
  allowed-origins:
    - ${FRONTEND_URL:http://localhost:3000}
    - ${ADMIN_URL:http://localhost:3001}
    - ${BACKEND_API_URL:http://localhost:8080}
  allowed-redirect-urls:
    - ${FRONTEND_URL:http://localhost:3000}
    - ${ADMIN_URL:http://localhost:3001}

cookie:
  secure: ${COOKIE_SECURE:false} # Set to true in production
  same-site: ${COOKIE_SAME_SITE:Lax}

app:
  egress-proxy:
    enabled: ${EGRESS_PROXY_ENABLED:false}
    host: ${EGRESS_PROXY_HOST:proxy.internal.corp}
    port: ${EGRESS_PROXY_PORT:8080}
    username: ${EGRESS_PROXY_USER:}
    password: ${EGRESS_PROXY_PASS:}
    ssl:
      trust-store-path: ${PROXY_TRUSTSTORE_PATH:}
      trust-store-password: ${PROXY_TRUSTSTORE_PASSWORD:}
      skip-verification: false
  security:
    refresh-token:
      hashing-enabled: ${REFRESH_TOKEN_HASHING:true}
      rotation-enabled: ${REFRESH_TOKEN_ROTATION:true}
    local-auth:
      enabled: ${LOCAL_AUTH_ENABLED:true}
```

---

## 2. Resource Server `application.yaml` Specification

```yaml
spring:
  config:
    import: optional:file:.env.local[.properties]
  application:
    name: backend-resource-server

server:
  port: ${SERVER_PORT:8080}

frontend:
  url: ${FRONTEND_URL:http://localhost:3000}

auth:
  service:
    jwks-url: ${AUTH_SERVICE_JWKS_URL:http://localhost:8081}
    expected-issuer: ${AUTH_SERVICE_ISSUER:https://auth.example.com}
    service-audience: ${AUTH_SERVICE_AUDIENCE:api://resource-server}
```

---

## 3. Typed `@ConfigurationProperties` Classes

### Auth Service Properties

```java
package com.example.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "auth")
@Data
public class AuthSecurityProperties {
    private List<String> allowedOrigins = new ArrayList<>();
    private List<String> allowedRedirectUrls = new ArrayList<>();
}

@Configuration
@ConfigurationProperties(prefix = "cookie")
@Data
public class CookieSecurityProperties {
    private boolean secure = false;
    private String sameSite = "Lax";
}

@Configuration
@ConfigurationProperties(prefix = "jwt")
@Data
public class JwtSecurityProperties {
    private long accessTokenExpiration = 900000L;       // 15 min
    private long refreshTokenExpiration = 604800000L;    // 7 days
}

@Configuration
@ConfigurationProperties(prefix = "app.egress-proxy")
@Data
public class ProxyProperties {
    private boolean enabled = false;
    private String host;
    private int port = 8080;
    private String username;
    private String password;
    private List<String> nonProxyHosts = new ArrayList<>();
    private SslProperties ssl = new SslProperties();

    @Data
    public static class SslProperties {
        private String trustStorePath;
        private String trustStorePassword;
        private boolean skipVerification = false;
    }
}

@Configuration
@ConfigurationProperties(prefix = "app.security.refresh-token")
@Data
public class RefreshTokenSecurityProperties {
    private boolean hashingEnabled = true;
    private boolean rotationEnabled = true;
}
```

### Resource Server Properties

```java
package com.example.resource.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "auth.service")
@Data
public class AuthServiceProperties {
    private String jwksUrl = "http://localhost:8081";
    private String expectedIssuer = "https://auth.example.com";
    private String serviceAudience = "api://resource-server";
}
```

@Configuration
@ConfigurationProperties(prefix = "auth.service")
@Data
public class AuthServiceProperties {
    private String jwksUrl = "http://localhost:8081";
}
```

---

## 4. Multi-Service Expansion Blueprint

The centralized Auth Service is inherently extensible to multiple client applications and multiple backend microservices without source code modifications.

```
                    ┌─────────────────────────┐
                    │    Web Client (:3000)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   Admin Portal (:3001)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   Mobile App / Proxy    │
                    └────────────┬────────────┘
                                 │
                OAuth2 / Refresh │ Status / Login
                                 ▼
                    ┌─────────────────────────┐
                    │   Auth Service (:8081)  │
                    │   • RS256 Signing       │
                    │   • Token Rotation      │
                    │   • JWKS Server         │
                    └──────┬───────────┬──────┘
             Pubkey Fetch  │           │ Pubkey Fetch
     GET /.well-known/jwks │           │ GET /.well-known/jwks
            ┌──────────────┘           └──────────────┐
            ▼                                         ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│   Orders API (:8080)    │               │  Payments API (:8082)   │
│   • Stateless RS256     │               │  • Stateless RS256      │
│   • Cached JWKS Key     │               │  • Cached JWKS Key      │
│   • Role: ROLE_USER     │               │  • Role: ROLE_ADMIN     │
└─────────────────────────┘               └─────────────────────────┘
```

### Adding a New Frontend Origin
Add the origin to `auth.allowed-origins` and `auth.allowed-redirect-urls` in `application.yaml`:
```yaml
auth:
  allowed-origins:
    - https://app.example.com
    - https://admin.example.com
  allowed-redirect-urls:
    - https://app.example.com
    - https://admin.example.com
```

### Adding a New Backend Resource Server
1. Add `JwksKeyLoader` and `JwtAuthenticationFilter` (or native `spring-boot-starter-oauth2-resource-server`).
2. Point `auth.service.jwks-url` to the centralized Auth Service URL (`https://auth.example.com`).
3. Guard endpoints using method security: `@PreAuthorize("hasAuthority('SCOPE_payment:write')")`.

---

## 5. Production Security Checklist

- [ ] **Reverse Proxy Headers**: Set `server.forward-headers-strategy=framework` behind reverse proxies to prevent `redirect_uri_mismatch`.
- [ ] **HTTPS Enforcement**: Set `cookie.secure=true` so cookies are never transmitted over plain HTTP.
- [ ] **Strict Key Permissions**: Store RSA PEM private keys in protected volumes with `chmod 600`.
- [ ] **Audience & Issuer Verification**: Ensure all Resource Servers validate `iss` and `aud` claims to prevent Confused Deputy token replay.
- [ ] **No Wildcard CORS**: Never use `allowedOrigins: ["*"]` with `allowCredentials: true` (rejected by browsers and violates CORS specification).
- [ ] **Egress Proxy Routing**: Route outbound OAuth2 token exchange and JWKS requests through corporate egress proxy when deployed in restricted intranets.
- [ ] **Database Indexing**: Ensure unique index on `refresh_tokens.token` and `invalidated_access_tokens.token`. Ensure index on `expiresAt` for efficient cleanup.
- [ ] **Fail-Fast Readiness**: Ensure Resource Servers depend on Auth Service health checks in orchestration tools (Kubernetes `initContainers` or Docker Compose `depends_on: condition: service_healthy`).

---

## 6. Related Modular References

- [proxy-and-gateway-configuration.md](proxy-and-gateway-configuration.md): Reverse proxy headers, TLS offloading, Apache HttpClient 5 corporate egress proxy, and OAuth2 client wiring.
- [multi-application-architecture.md](multi-application-architecture.md): Multi-frontend client registration, strict redirect validation, dynamic CORS, namespaced role claims, and audience enforcement.

