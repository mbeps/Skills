# Reverse Proxy, API Gateway & Corporate Egress Proxy Configuration

This reference document outlines network edge topology, reverse proxy header processing, SSL offloading, outbound corporate egress proxy configuration with Apache HttpClient 5, and OAuth2 client bean wiring in Spring Boot.

---

## 1. Enterprise Network Topology & Proxy Architecture

Enterprise OAuth2 architectures operate between two distinct proxy boundaries:

```
[Browser / SPA Client]
         │ (1) Public HTTPS Request (Port 443)
         ▼
┌─────────────────────────────────┐
│     Reverse Proxy / Gateway     │  (TLS Termination / Path Routing)
│   (Envoy, Nginx, F5, Cloud)     │  Appends: X-Forwarded-Proto, X-Forwarded-Host, X-Forwarded-Port
└─────────────────────────────────┘
         │ (2) Internal Request (HTTP / Local Port 8081)
         ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Spring Boot Auth Service (Port 8081)                                                             │
│                                                                                                   │
│  • Inbound: ForwardedHeaderFilter (server.forward-headers-strategy=framework)                    │
│    Reconstructs external {baseUrl} (https://gateway.example.com) for OAuth2 redirect-uri         │
│                                                                                                   │
│  • Outbound: Egress HTTP Infrastructure (Apache HttpClient 5 + Proxy Routing)                     │
│    Routes IdP requests via internal egress proxy with authentication and custom truststores       │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
         │ (3) Outbound Token Exchange, UserInfo, JWKS Calls
         ▼
┌─────────────────────────────────┐
│     Corporate Egress Proxy      │  (Squid, BlueCoat, Prisma Access)
│     proxy.internal.corp:8080    │
└─────────────────────────────────┘
         │ (4) External SaaS Calls (HTTPS 443)
         ▼
┌─────────────────────────────────┐
│    External OAuth2/OIDC IdP     │  (Microsoft Entra ID, GitHub, Google)
│    login.microsoftonline.com    │
└─────────────────────────────────┘
```

---

## 2. Inbound Reverse Proxy & Ingress Gateway Handling

When TLS terminates at a reverse proxy or load balancer, requests arrive at the Spring Boot application via plain HTTP on internal ports (e.g. `http://localhost:8081`). 

### The Problem: `redirect_uri_mismatch`
Spring Security constructs the OAuth2 `redirect_uri` by expanding `{baseUrl}`:
- Without proxy awareness: `{baseUrl}` expands to `http://localhost:8081`. The generated redirect URI becomes `http://localhost:8081/login/oauth2/code/azure`.
- Upstream IdPs reject this URI with `redirect_uri_mismatch` because the registered URI is `https://auth.example.com/login/oauth2/code/azure`.

### Solution: Forwarded Headers Strategy

Configure Spring Boot to process incoming RFC 7239 `Forwarded` or legacy `X-Forwarded-*` (`X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`, `X-Forwarded-For`) headers.

#### Option A: Framework-Level Filter (Recommended for Container/Cloud)
Activates Spring's `ForwardedHeaderFilter`, wrapping `HttpServletRequest` so that `request.getScheme()`, `request.getServerName()`, `request.getServerPort()`, and `request.isSecure()` reflect the client-facing reverse proxy.

```yaml
# application.yaml
server:
  port: 8081
  forward-headers-strategy: framework
```

#### Option B: Container-Level (Tomcat `RemoteIpValve`)
Delegates parsing to embedded Tomcat's `RemoteIpValve`. Use when behind trusted internal reverse proxies with defined CIDR ranges:

```yaml
# application.yaml
server:
  port: 8081
  forward-headers-strategy: native
  tomcat:
    remote-ip-header: X-Forwarded-For
    protocol-header: X-Forwarded-Proto
    internal-proxies: 10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|127\\.0\\.0\\.1
```

### Upstream Reverse Proxy Configuration (Nginx / Envoy)
Ensure the ingress reverse proxy explicitly sets forwarded headers:

```nginx
# Nginx sample configuration
location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Port $server_port;
}
```

---

## 3. Outbound Corporate Egress Proxy Configuration

Corporate networks block direct egress to public IP ranges. Outbound HTTP requests from Spring Security to IdPs must pass through an authorized corporate proxy.

### Configuration Model (`ProxyProperties.java`)

```java
package com.example.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

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
```

### Apache HttpClient 5 Proxy Engine (`RestTemplateConfig.java`)

```java
package com.example.auth.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.auth.AuthScope;
import org.apache.hc.client5.http.auth.UsernamePasswordCredentials;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.auth.BasicCredentialsProvider;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.impl.routing.DefaultProxyRoutePlanner;
import org.apache.hc.client5.http.ssl.NoopHostnameVerifier;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactoryBuilder;
import org.apache.hc.client5.http.ssl.TrustAllStrategy;
import org.apache.hc.core5.http.HttpHost;
import org.apache.hc.core5.ssl.SSLContextBuilder;
import org.apache.hc.core5.ssl.SSLContexts;
import org.apache.hc.core5.util.Timeout;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.SSLContext;
import java.io.File;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class RestTemplateConfig {

    private final ProxyProperties proxyProperties;

    @Bean
    @Primary
    public RestTemplate restTemplate() {
        CloseableHttpClient httpClient = buildHttpClient();
        HttpComponentsClientHttpRequestFactory requestFactory =
                new HttpComponentsClientHttpRequestFactory(httpClient);
        requestFactory.setConnectTimeout(5000);
        return new RestTemplate(new BufferingClientHttpRequestFactory(requestFactory));
    }

    private CloseableHttpClient buildHttpClient() {
        HttpClientBuilder builder = HttpClients.custom();

        // 1. SSL Context Configuration (Custom Corporate CA TrustStore or Bypass)
        try {
            SSLContext sslContext;
            if (proxyProperties.getSsl().isSkipVerification()) {
                log.warn("DISABLING SSL VERIFICATION FOR OUTBOUND PROXY CALLS (DEV ONLY)");
                sslContext = SSLContextBuilder.create()
                        .loadTrustMaterial(TrustAllStrategy.INSTANCE)
                        .build();
                builder.setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                        .setSSLSocketFactory(SSLConnectionSocketFactoryBuilder.create()
                                .setSslContext(sslContext)
                                .setHostnameVerifier(NoopHostnameVerifier.INSTANCE)
                                .build())
                        .build());
            } else if (proxyProperties.getSsl().getTrustStorePath() != null) {
                sslContext = SSLContexts.custom()
                        .loadTrustMaterial(
                                new File(proxyProperties.getSsl().getTrustStorePath()),
                                proxyProperties.getSsl().getTrustStorePassword() != null 
                                        ? proxyProperties.getSsl().getTrustStorePassword().toCharArray() : null
                        )
                        .build();
                builder.setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                        .setSSLSocketFactory(SSLConnectionSocketFactoryBuilder.create()
                                .setSslContext(sslContext)
                                .build())
                        .build());
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize SSL Context for outbound client", e);
        }

        // 2. Outbound Proxy Routing & Authentication
        if (proxyProperties.isEnabled() && proxyProperties.getHost() != null) {
            String cleanHost = proxyProperties.getHost().replaceAll("^https?://", "").replaceAll("/.*$", "");
            HttpHost proxyHost = new HttpHost(cleanHost, proxyProperties.getPort());
            builder.setRoutePlanner(new DefaultProxyRoutePlanner(proxyHost));

            if (proxyProperties.getUsername() != null && !proxyProperties.getUsername().isBlank()) {
                BasicCredentialsProvider credentialsProvider = new BasicCredentialsProvider();
                credentialsProvider.setCredentials(
                        new AuthScope(proxyHost),
                        new UsernamePasswordCredentials(
                                proxyProperties.getUsername(),
                                proxyProperties.getPassword().toCharArray()
                        )
                );
                builder.setDefaultCredentialsProvider(credentialsProvider);
            }
            log.info("Configured outbound proxy: {}:{}", cleanHost, proxyProperties.getPort());
        }

        builder.setDefaultRequestConfig(RequestConfig.custom()
                .setConnectTimeout(Timeout.ofMilliseconds(5000))
                .setResponseTimeout(Timeout.ofMilliseconds(10000))
                .build());

        return builder.build();
    }
}
```

---

## 4. Wiring the Proxied Client into Spring Security OAuth2 Components

Spring Security instantiates default, unproxied HTTP clients for OAuth2 flows unless custom beans are injected. Wire the proxy-aware `RestTemplate` across all three outbound lifecycles:

### 1. Token Exchange Client (`OAuth2AccessTokenResponseClient`)

Replaces the default client that exchanges the authorization code for access and ID tokens:

```java
package com.example.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.FormHttpMessageConverter;
import org.springframework.security.oauth2.client.endpoint.DefaultAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.http.OAuth2ErrorResponseErrorHandler;
import org.springframework.security.oauth2.core.http.converter.OAuth2AccessTokenResponseHttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;

@Configuration
public class OAuth2ClientConfig {

    @Bean
    public OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> authorizationCodeTokenResponseClient(
            RestTemplate restTemplate) {
        DefaultAuthorizationCodeTokenResponseClient client = new DefaultAuthorizationCodeTokenResponseClient();
        
        // Create a dedicated RestTemplate for token responses using the shared proxy RequestFactory
        // to avoid overwriting default message converters or error handlers on the shared RestTemplate bean
        RestTemplate tokenRestTemplate = new RestTemplate(Arrays.asList(
                new FormHttpMessageConverter(),
                new OAuth2AccessTokenResponseHttpMessageConverter()
        ));
        tokenRestTemplate.setRequestFactory(restTemplate.getRequestFactory());
        tokenRestTemplate.setErrorHandler(new OAuth2ErrorResponseErrorHandler());
        
        client.setRestOperations(tokenRestTemplate);
        return client;
    }
}
```

### 2. OIDC UserInfo Service (`OidcUserService`)

Ensures user profile requests to IdP endpoints (e.g. Graph API or Google UserInfo) traverse the proxy:

```java
package com.example.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.client.RestTemplate;

@Configuration
public class OidcConfig {

    @Bean
    public OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService(RestTemplate restTemplate) {
        DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
        delegate.setRestOperations(restTemplate);

        OidcUserService oidcUserService = new OidcUserService();
        oidcUserService.setOauth2UserService(delegate);
        return oidcUserService;
    }
}
```

### 3. ID Token JWK Verification (`JwtDecoderFactory`)

Validates incoming ID token signatures by fetching the IdP's JWKS (`jwk-set-uri`) through the proxied `RestTemplate`:

```java
package com.example.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenDecoderFactory;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.ConcurrentHashMap;

@Configuration
public class JwtDecoderConfig {

    @Bean
    public JwtDecoderFactory<ClientRegistration> idTokenDecoderFactory(RestTemplate restTemplate) {
        return new JwtDecoderFactory<>() {
            private final ConcurrentHashMap<String, JwtDecoder> decoders = new ConcurrentHashMap<>();

            @Override
            public JwtDecoder createDecoder(ClientRegistration clientRegistration) {
                return decoders.computeIfAbsent(clientRegistration.getRegistrationId(), id -> {
                    String jwkSetUri = clientRegistration.getProviderDetails().getJwkSetUri();
                    if (jwkSetUri == null || jwkSetUri.isBlank()) {
                        OidcIdTokenDecoderFactory fallback = new OidcIdTokenDecoderFactory();
                        return fallback.createDecoder(clientRegistration);
                    }
                    return NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                            .restOperations(restTemplate)
                            .build();
                });
            }
        };
    }
}
```

---

## 5. Preventing Eager OIDC Discovery (`issuer-uri`) Startup Traps

In Spring Security, defining `spring.security.oauth2.client.provider.<provider>.issuer-uri` triggers an **eager HTTP GET request** to `${issuer-uri}/.well-known/openid-configuration` during Spring ApplicationContext initialization.

### The Startup Failure
In corporate environments where outbound connectivity requires the proxied `RestTemplate`, this discovery check executes **before custom beans are initialized** or uses an unproxied internal JDK client, resulting in:
```
org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'clientRegistrationRepository':
nested exception is java.net.UnknownHostException: login.microsoftonline.com
```

### The Fix: Declare Explicit Provider Endpoints
Disable dynamic discovery by specifying explicit endpoint URIs in `application.yaml`:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          azure:
            client-id: ${AZURE_CLIENT_ID}
            client-secret: ${AZURE_CLIENT_SECRET}
            authorization-grant-type: authorization_code
            client-authentication-method: client_secret_post
            redirect-uri: "{baseUrl}/login/oauth2/code/azure"
            scope: [openid, profile, email]
        provider:
          azure:
            # DO NOT configure issuer-uri: https://login.microsoftonline.com/...
            # Statically declare endpoints to eliminate startup network calls:
            authorization-uri: https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize
            token-uri: https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token
            jwk-set-uri: https://login.microsoftonline.com/${AZURE_TENANT_ID}/discovery/v2.0/keys
            user-info-uri: https://graph.microsoft.com/oidc/userinfo
            user-name-attribute: sub
```

