---
name: spring-boot-ldap
description: Use when building, querying, or troubleshooting Active Directory and LDAP in Spring Boot (3.x/4.x), encountering PartialResultException referrals, socket timeouts, pool exhaustion, LDAP filter injection, userAccountControl bitmask checks, binary objectGUID/objectSid conversions, recursive group membership with LDAP_MATCHING_RULE_IN_CHAIN (1.2.840.113556.1.4.1941), PagedResultsDirContextProcessor paging, RBAC group mapping, or writing UnboundID in-memory integration tests.
---

# Spring Boot LDAP & Active Directory Integration

## Overview

Type-safe, secure, pooled Active Directory and LDAP integration for Spring Boot 3.x and 4.x applications.

Direct directory access requires defensive socket timeouts, connection validation, referral handling, injection-safe filter building, and binary attribute translation.

---

## When to Use

### Apply this skill when:
- Integrating Spring Boot applications with Active Directory (AD) or OpenLDAP directory servers.
- Encountering `PartialResultException` or `[LDAP: error code 10 - Referral]` exceptions during root-level directory queries.
- Experiencing thread pool exhaustion or frozen worker threads caused by unconfigured JNDI socket timeouts.
- Constructing dynamic LDAP search queries that must prevent LDAP injection vulnerabilities.
- Parsing Active Directory account state flags using `userAccountControl` integer bitmasks.
- Decoding proprietary binary attributes such as `objectGUID` (RFC 4122 mixed-endian) or `objectSid` (Windows security identifier).
- Resolving nested, recursive group memberships using the Active Directory OID rule `LDAP_MATCHING_RULE_IN_CHAIN` (`1.2.840.113556.1.4.1941`).
- Paging large directory result sets (>1,000 objects) with `PagedResultsDirContextProcessor` to avoid `SizeLimitExceededException`.
- Implementing role-based access control (RBAC) permission checks with Spring Cache abstraction.
- Writing fast unit tests with Mockito or integration tests with UnboundID `InMemoryDirectoryServer`.

### Do NOT use this skill when:
- Authenticating users via modern OAuth2, OIDC, SAML, or Keycloak identity providers (use `spring-boot-oauth` or `authentication-service-integration` instead).
- Synchronising full enterprise organisation structures from HR APIs (use `commerzbank-hr-api` instead).
- Operating purely within relational database authorization (use `access-control` or `spring-boot-database-access` instead).

---

## Architecture Decision Flowchart

```mermaid
flowchart TD
    Start([LDAP Operation]) --> OpType{Operation Type?}
    
    OpType -->|User or Group Search| SearchFlow[Build Filter]
    OpType -->|User Authentication| BindFlow[Search and Bind]
    OpType -->|RBAC Group Check| AuthFlow[Evaluate Membership]
    OpType -->|Connection Setup| PoolFlow[Context and Pool Config]
    
    SearchFlow --> Sanitize[Use AndFilter or EqualsFilter: No String Concat]
    Sanitize --> MultiRecord{Expect > 1000 records?}
    MultiRecord -->|Yes| Paging[Use PagedResultsDirContextProcessor]
    MultiRecord -->|No| ExecSearch[ldapTemplate.search with IgnorePartialResult]
    
    AuthFlow --> Nested{Need Nested Groups?}
    Nested -->|Yes| ChainRule[Use LDAP_MATCHING_RULE_IN_CHAIN 1.2.840.113556.1.4.1941]
    Nested -->|No| DirectMember[Query direct memberOf attribute]
    ChainRule --> CacheCheck[@Cacheable on AdService]
    DirectMember --> CacheCheck
    
    PoolFlow --> MultiThread{High Concurrency?}
    MultiThread -->|Yes| PoolChoice[PooledContextSource commons-pool2 + DefaultDirContextValidator]
    MultiThread -->|Low / Batch| JndiPool[LdapContextSource with connect and read timeouts]
    
    BindFlow --> FindDN[Step 1: Service Account searches user DN]
    FindDN --> UserBind[Step 2: ldapTemplate.authenticate with user DN & password]
```

---

## Quick Reference Table

| Concept / Class | Purpose | Key Property / Constant / OID |
| :--- | :--- | :--- |
| `LdapContextSource` | Primary JNDI context factory bean | `com.sun.jndi.ldap.connect.timeout`, `com.sun.jndi.ldap.read.timeout` |
| `PooledContextSource` | Thread-safe connection pool (`commons-pool2`) | `maxTotal`, `maxIdle`, `minIdle`, `testOnBorrow` |
| `DefaultDirContextValidator` | Validates pooled connections before use | `validator.setBaseName("")`, `validator.setFilterName("objectClass=*")` |
| `LdapTemplate` | Thread-safe helper for directory operations | `setIgnorePartialResultException(true)` |
| `AndFilter` / `EqualsFilter` | Type-safe LDAP injection defence | Encodes special characters (`*`, `(`, `)`, `\`, `NUL`) |
| `LDAP_MATCHING_RULE_IN_CHAIN` | Recursive / transitive group member query | OID `1.2.840.113556.1.4.1941` |
| `LDAP_MATCHING_RULE_BIT_AND` | Active Directory bitwise filter matching | OID `1.2.840.113556.1.4.803` |
| `userAccountControl` | Account status bitmask (512=Normal, 514=Disabled) | Flag `0x0002` (ACCOUNTDISABLE), `0x0010` (LOCKOUT) |
| `objectGUID` | Unique object identifier (16-byte mixed-endian) | `java.naming.ldap.attributes.binary = "objectGUID objectSid"` |
| `objectSid` | Security Identifier binary structure | Converted to `S-1-5-21-...` string format |
| `PagedResultsDirContextProcessor` | Cookie-based paged searches (>1,000 records) | AD default `MaxPageSize` is 1,000 |
| Standard Ports | Default directory communication ports | Port `389` (LDAP), `636` (LDAPS), `3268` (GC), `3269` (GC LDAPS) |

---

## Core Implementation Patterns

### 1. Minimal Robust `LdapContextSource` and `LdapTemplate`

Always declare explicit socket timeouts, binary attribute handling, and referral ignoring on the `LdapTemplate`.

```java
package com.commerzbank.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;

import java.util.HashMap;
import java.util.Map;

@Configuration(proxyBeanMethods = false)
public class LdapConfig {

    @Bean
    @Primary
    public LdapContextSource ldapContextSource(LdapProperties properties) {
        LdapContextSource contextSource = new LdapContextSource();
        contextSource.setUrl(properties.getUrl());
        contextSource.setBase(properties.getBase());
        contextSource.setUserDn(properties.getUserDn());
        contextSource.setPassword(properties.getPassword());

        Map<String, Object> baseEnvironment = new HashMap<>();
        // Defensive socket timeouts: prevent thread pool exhaustion on network drop
        baseEnvironment.put("com.sun.jndi.ldap.connect.timeout", "3000");
        baseEnvironment.put("com.sun.jndi.ldap.read.timeout", "10000");
        
        // Active Directory referral handling
        baseEnvironment.put("java.naming.referral", "ignore");
        
        // Declare binary attributes for byte array mapping
        baseEnvironment.put("java.naming.ldap.attributes.binary", "objectGUID objectSid");

        contextSource.setBaseEnvironmentProperties(baseEnvironment);
        contextSource.afterPropertiesSet();
        return contextSource;
    }

    @Bean
    @Primary
    public LdapTemplate ldapTemplate(LdapContextSource contextSource) {
        LdapTemplate template = new LdapTemplate(contextSource);
        // Essential for Active Directory: prevents PartialResultException on root searches
        template.setIgnorePartialResultException(true);
        template.setIgnoreNameNotFoundException(true);
        return template;
    }
}
```

### 2. Safe Filter Construction vs Raw String Concatenation

Never concatenate raw strings into LDAP filters. Use Spring LDAP query filters.

```java
// SAFE: Type-safe filter construction with automatic escaping
public List<UserDto> findActiveUsersByDepartment(String department, String term) {
    AndFilter filter = new AndFilter();
    filter.and(new EqualsFilter("objectClass", "user"));
    filter.and(new EqualsFilter("objectCategory", "person"));
    filter.and(new EqualsFilter("department", department));
    
    // Wildcard filter safely handles special characters
    filter.and(new LikeFilter("sAMAccountName", term + "*"));
    
    // Active Directory bitmask filter: account not disabled (flag 2 NOT set)
    filter.and(new HardcodedFilter("(!(userAccountControl:1.2.840.113556.1.4.803:=2))"));

    return ldapTemplate.search("", filter.encode(), new UserAttributesMapper());
}
```

### 3. Active Directory User Parsing and Bitmask Verification

```java
package com.commerzbank.dto;

public record UserDto(
    String samAccountName,
    String commonName,
    String email,
    String department,
    String distinguishedName,
    String guid,
    String sid,
    boolean enabled,
    boolean locked
) {
    // Active Directory userAccountControl bit flags
    private static final int UF_ACCOUNTDISABLE = 0x0002;
    private static final int UF_LOCKOUT = 0x0010;

    public static boolean isAccountEnabled(int userAccountControl) {
        return (userAccountControl & UF_ACCOUNTDISABLE) == 0;
    }

    public static boolean isAccountLocked(int userAccountControl) {
        return (userAccountControl & UF_LOCKOUT) != 0;
    }
}
```

---

## Detailed Reference Guides

For complete implementation code, production recipes, and architecture patterns, consult the dedicated reference files:

- [references/configuration-and-properties.md](references/configuration-and-properties.md): Complete auto-configuration, hierarchical `@ConfigurationProperties`, connection validation, and multi-DC failover configuration.
- [references/ad-queries-and-odm.md](references/ad-queries-and-odm.md): Type-safe filter construction, `userAccountControl` bitmask parsing, RFC 4122 `objectGUID` conversion, `objectSid` decoder, `LDAP_MATCHING_RULE_IN_CHAIN` transitive queries, and `PagedResultsDirContextProcessor` pagination.
- [references/connection-pooling-and-ldaps.md](references/connection-pooling-and-ldaps.md): `PooledContextSource` with `commons-pool2`, `DefaultDirContextValidator` health checks, LDAPS TLS truststores, and port selection (389, 636, 3268, 3269).
- [references/caching-and-permissions.md](references/caching-and-permissions.md): Spring Cache integration (`@Cacheable`, Caffeine), compound cache key strategies, RBAC group mapping, and permission validation.
- [references/testing-ldap.md](references/testing-ldap.md): Unit testing with Mockito `LdapTemplate` mocks and integration testing with UnboundID `InMemoryDirectoryServer`.

---

## Common Mistakes & Antipatterns

- **Concatenating user input into LDAP filters**: Results in fatal filter injection vulnerabilities and syntax errors when names contain characters like `(`, `)`, or `*`.
- **Omitting `ignorePartialResultException`**: Throws `PartialResultException` whenever Active Directory returns referral entries at domain boundaries.
- **Omitting connection and read timeouts**: Causes persistent JVM worker thread hangs when intermediate firewalls silently drop idle TCP sockets.
- **Treating `objectGUID` as an ASCII string**: Produces corrupted byte sequences. `objectGUID` requires 16-byte mixed-endian conversion to generate standard UUIDs.
- **Querying single domain controllers on port 389 for multi-domain forests**: Causes missing user lookups. Global Catalog ports `3268` (TCP) and `3269` (LDAPS) must be used for forest-wide searches.
- **Ignoring AD 1,000 object search limits**: Broad unpaged queries against large OUs fail with `SizeLimitExceededException`. Must use `PagedResultsDirContextProcessor`.

---

## Rationalization Table

| Shortcut / Excuse | Reality & Mandatory Standard |
| :--- | :--- |
| *"Referrals are not an issue in local testing, so ignorePartialResultException is unnecessary."* | Active Directory returns referrals at domain partitions in real environments. Omitting this setting causes fatal `PartialResultException` in production. Always configure `setIgnorePartialResultException(true)` and `java.naming.referral = "ignore"`. |
| *"LDAP operations are fast, so connection and read timeouts are not needed."* | Network drops and firewall state timeouts cause worker threads to hang indefinitely without socket timeouts. Always specify `connect.timeout` (3000ms) and `read.timeout` (10000ms). |
| *"String concatenation in LDAP filters is acceptable for trusted internal tools."* | Unescaped user input causes syntax crashes on valid characters (such as parentheses or asterisks) and allows LDAP injection. Always use `AndFilter`, `EqualsFilter`, or filter placeholders. |
| *"Paging is unnecessary because our current test group only has 100 members."* | Active Directory enforces a strict 1,000 record cap (`MaxPageSize`). As directory data expands, unpaged queries throw fatal `SizeLimitExceededException`. |
| *"Casting objectGUID to a Java String works fine."* | `objectGUID` is a raw 16-byte binary structure stored in mixed-endian format. String decoding corrupts the identifier. Must register binary attribute and apply byte-reordering. |
| *"Nested group resolution can be done by recursively querying each parent group in Java."* | Iterative queries trigger $N+1$ network roundtrips. Use Active Directory server-side matching rule `1.2.840.113556.1.4.1941` (`LDAP_MATCHING_RULE_IN_CHAIN`) with application caching. |

---

## Red Flags: STOP and Fix

If you see any of the following code patterns in review or development, stop and resolve immediately:

- 🚩 `String filter = "(&(sAMAccountName=" + username + "))"` (Raw string concatenation in search filters).
- 🚩 `new LdapTemplate(contextSource)` without calling `setIgnorePartialResultException(true)`.
- 🚩 `LdapContextSource` configured without `com.sun.jndi.ldap.connect.timeout` and `com.sun.jndi.ldap.read.timeout`.
- 🚩 `attrs.get("objectGUID").get().toString()` (Reading binary GUID directly as a text string).
- 🚩 Catching generic `Exception` and swallowing LDAP connection drops without wrapping into domain exceptions.
- 🚩 Hardcoded LDAP credentials or plaintext binding passwords in repository code.
- 🚩 Executing unpaged `ldapTemplate.search` on broad organisational unit trees.

