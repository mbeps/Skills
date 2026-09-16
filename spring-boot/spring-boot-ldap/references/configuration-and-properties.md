configuration-and-properties
---
# Spring Boot LDAP Configuration and Properties Reference

This reference describes the configuration model, auto-configuration setup, and property definitions for integrating Spring Boot applications with Microsoft Active Directory and LDAP servers.

---

## 1. Hierarchical Properties Architecture

Spring Boot binds external configuration from `application.yaml` to typed Java objects using `@ConfigurationProperties(prefix = "ldap")`.

### `LdapProperties.java`

```java
package com.commerzbank.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.HashMap;
import java.util.Map;

/**
 * Root configuration properties for LDAP and Active Directory integration.
 */
@Data
@Validated
@ConfigurationProperties(prefix = "ldap")
public class LdapProperties {

    private ContextSource contextSource = new ContextSource();
    private Timeouts timeouts = new Timeouts();
    private Pool pool = new Pool();
    private Search search = new Search();
    private Cache cache = new Cache();
    private Permissions permissions = new Permissions();

    @Data
    public static class ContextSource {
        @NotBlank(message = "LDAP server URL must be configured")
        private String url;

        @NotBlank(message = "LDAP base DN must be configured")
        private String base;

        @NotBlank(message = "LDAP service account userDn must be configured")
        private String userDn;

        private String password;
        private boolean pooled = true;
        private String referral = "ignore";
        private String binaryAttributes = "objectGUID objectSid tokenGroups";
    }

    @Data
    public static class Timeouts {
        @Positive
        private int connectTimeoutMs = 3000;

        @Positive
        private int readTimeoutMs = 10000;

        @Positive
        private int searchTimeLimitMs = 5000;
    }

    @Data
    public static class Pool {
        private boolean enabled = true;
        private int maxTotal = 20;
        private int maxIdle = 10;
        private int minIdle = 2;
        private long maxWaitMillis = 5000L;
        private boolean testOnBorrow = true;
        private boolean testWhileIdle = true;
        private long timeBetweenEvictionRunsMillis = 60000L;
        private long minEvictableIdleTimeMillis = 300000L;
    }

    @Data
    public static class Search {
        private String searchBase = "";
        private String userSearchBase = "";
        private String userSearchFilter = "(sAMAccountName={0})";
        private String groupSearchBase = "";
        private String groupSearchFilter = "(member={0})";
        private int defaultPageSize = 500;
    }

    @Data
    public static class Cache {
        private boolean enabled = true;
        private long ttlSeconds = 300L;
        private long maxEntries = 5000L;
    }

    @Data
    public static class Permissions {
        private Map<String, String> groups = new HashMap<>();
    }
}
```

---

## 2. Auto-Configuration Setup

The auto-configuration class configures `LdapContextSource` and `LdapTemplate` beans when the required properties exist.

### `LdapAutoConfiguration.java`

```java
package com.commerzbank.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.util.Assert;

import java.util.HashMap;
import java.util.Map;

/**
 * Spring Boot auto-configuration for Active Directory and LDAP access.
 */
@AutoConfiguration
@ConditionalOnClass({LdapContextSource.class, LdapTemplate.class})
@EnableConfigurationProperties(LdapProperties.class)
@ConditionalOnProperty(prefix = "ldap.context-source", name = "url")
public class LdapAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public LdapContextSource ldapContextSource(LdapProperties properties) {
        LdapProperties.ContextSource cs = properties.getContextSource();
        LdapProperties.Timeouts timeouts = properties.getTimeouts();

        Assert.hasText(cs.getUrl(), "Property 'ldap.context-source.url' must not be empty");
        Assert.hasText(cs.getBase(), "Property 'ldap.context-source.base' must not be empty");
        Assert.hasText(cs.getUserDn(), "Property 'ldap.context-source.user-dn' must not be empty");

        LdapContextSource contextSource = new LdapContextSource();
        contextSource.setUrl(cs.getUrl());
        contextSource.setBase(cs.getBase());
        contextSource.setUserDn(cs.getUserDn());
        contextSource.setPassword(cs.getPassword() != null ? cs.getPassword() : "");
        contextSource.setPooled(cs.isPooled());

        Map<String, Object> environment = new HashMap<>();
        environment.put("com.sun.jndi.ldap.connect.timeout", String.valueOf(timeouts.getConnectTimeoutMs()));
        environment.put("com.sun.jndi.ldap.read.timeout", String.valueOf(timeouts.getReadTimeoutMs()));
        environment.put("java.naming.referral", cs.getReferral());
        environment.put("java.naming.ldap.attributes.binary", cs.getBinaryAttributes());

        contextSource.setBaseEnvironmentProperties(environment);
        contextSource.afterPropertiesSet();
        return contextSource;
    }

    @Bean
    @ConditionalOnMissingBean
    public LdapTemplate ldapTemplate(LdapContextSource contextSource) {
        LdapTemplate template = new LdapTemplate(contextSource);
        // Essential setting for Active Directory domain boundary traversals:
        template.setIgnorePartialResultException(true);
        template.setIgnoreNameNotFoundException(true);
        return template;
    }
}
```

---

## 3. Auto-Configuration Registration

Spring Boot 3.x and 4.x load auto-configuration classes from a standard descriptor file.

Create the file at:
`src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

Content:
```
com.commerzbank.config.LdapAutoConfiguration
com.commerzbank.config.LdapCacheConfig
```

Note: Do not use legacy `spring.factories`. Spring Boot 3.0 removed support for loading auto-configurations from `spring.factories`.

---

## 4. Multi-URL Failover Configuration

To provide high availability across domain controllers, configure space-separated or comma-separated server URLs in `ldap.context-source.url`.

```yaml
ldap:
  context-source:
    url: "ldaps://dc1.corp.example.com:636 ldaps://dc2.corp.example.com:636 ldaps://dc3.corp.example.com:636"
```

### Failover Mechanics
1. JNDI attempts connection to `dc1.corp.example.com:636`.
2. If `dc1` is unreachable within `connectTimeoutMs`, JNDI immediately tries `dc2.corp.example.com:636`.
3. If all domain controllers are unreachable, JNDI throws `CommunicationException`.
4. Socket connection pooling maintains active connections per host.

---

## 5. Referral Management

Active Directory automatically generates LDAP referrals (search continuation references) when:
- Queries target the root domain or partition boundaries.
- Cross-domain trusts exist in the forest.
- A user object has attributes pointing to external directory trees.

### Failure Symptom Without Handling
```
javax.naming.PartialResultException: [LDAP: error code 10 - Referral]
    at java.naming/com.sun.jndi.ldap.LdapNamingEnumeration.hasMore(LdapNamingEnumeration.java:165)
    at org.springframework.ldap.core.LdapTemplate.search(LdapTemplate.java:375)
```

### Resolution Rules
1. **Always enable `ignorePartialResultException` in `LdapTemplate`**:
   ```java
   ldapTemplate.setIgnorePartialResultException(true);
   ```
2. **Set JNDI referral policy to `ignore`**:
   ```java
   environment.put("java.naming.referral", "ignore");
   ```
3. **Avoid `follow` in firewalled corporate networks**: Following referrals causes the client to make on-the-fly network connections to referenced domain controllers, which often fail due to network firewalls or missing cross-domain trust credentials.

---

## 6. Complete `application.yaml` Reference

```yaml
ldap:
  context-source:
    # Space-separated list of LDAP/LDAPS servers for automatic failover
    url: "ldaps://dc1.corp.example.com:636 ldaps://dc2.corp.example.com:636"
    # Base DN for all relative directory queries
    base: "DC=corp,DC=example,DC=com"
    # Service account DN or UPN for bind authentication
    user-dn: "SVC_APP_AUTH@corp.example.com"
    # Service account password (inject via environment variable in production)
    password: "${LDAP_SERVICE_PASSWORD:secretPassword}"
    # Enable JNDI connection pooling
    pooled: true
    # Referral policy: 'ignore' (recommended for AD), 'follow', or 'throw'
    referral: "ignore"
    # Space-delimited binary attribute names that JNDI must return as byte[]
    binary-attributes: "objectGUID objectSid tokenGroups"

  timeouts:
    # TCP connection timeout in milliseconds
    connect-timeout-ms: 3000
    # Socket read timeout waiting for AD response in milliseconds
    read-timeout-ms: 10000
    # Server-side search time limit in milliseconds
    search-time-limit-ms: 5000

  pool:
    # Use Commons-Pool2 PooledContextSource
    enabled: true
    max-total: 20
    max-idle: 10
    min-idle: 2
    max-wait-millis: 5000
    test-on-borrow: true
    test-while-idle: true
    time-between-eviction-runs-millis: 60000
    min-evictable-idle-time-millis: 300000

  search:
    # Base search scopes relative to root base DN
    search-base: ""
    user-search-base: "OU=Users,OU=Enterprise"
    user-search-filter: "(sAMAccountName={0})"
    group-search-base: "OU=Groups,OU=Enterprise"
    group-search-filter: "(member={0})"
    default-page-size: 500

  cache:
    # Enable Spring Cache abstraction for group membership lookups
    enabled: true
    ttl-seconds: 300       # Time-to-live in seconds (5 minutes)
    max-entries: 5000      # Maximum cached entries before eviction

  permissions:
    # Map symbolic application roles to Active Directory Group DNs
    groups:
      admin: "CN=GD_APP_ADMINS,OU=Groups,OU=Enterprise,DC=corp,DC=example,DC=com"
      editor: "CN=GD_APP_EDITORS,OU=Groups,OU=Enterprise,DC=corp,DC=example,DC=com"
      viewer: "CN=GD_APP_VIEWERS,OU=Groups,OU=Enterprise,DC=corp,DC=example,DC=com"
```

