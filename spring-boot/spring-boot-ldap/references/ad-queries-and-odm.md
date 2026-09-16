# Active Directory Queries, Filters, and Attribute Mapping Reference

This reference describes type-safe query formulation, Active Directory attribute mapping, binary GUID/SID conversion utilities, recursive group resolution, paged search iteration, and repository implementation patterns in Spring Boot.

---

## 1. Type-Safe Query Building with Spring LDAP Filters

Avoid raw string concatenation when creating LDAP search filters. String concatenation causes syntax errors with special characters (such as `(`, `)`, `*`, `\`, `/`) and exposes systems to LDAP injection attacks.

Spring LDAP provides filter classes in `org.springframework.ldap.filter.*`.

### Filter Classes Matrix

| Filter Class                             | Generates            | Use Case                                                 |
| :--------------------------------------- | :------------------- | :------------------------------------------------------- |
| `EqualsFilter(attr, value)`              | `(attr=value)`       | Exact match comparison (auto-escapes special characters) |
| `LikeFilter(attr, value)`                | `(attr=*value*)`     | Wildcard substring matching                              |
| `WhitespaceWildcardsFilter(attr, value)` | `(attr=*val1*val2*)` | Tokenizes words into wildcards                           |
| `AndFilter()`                            | `(&(f1)(f2)...)`     | Combines filters with logical AND                        |
| `OrFilter()`                             | `(\|(f1)(f2)...)`    | Combines filters with logical OR                         |
| `NotFilter(filter)`                      | `(!(filter))`        | Inverts child filter condition                           |
| `HardcodedFilter(rawFilter)`             | `(customFilter)`     | AD proprietary matching rule OIDs                        |

### Type-Safe Filter Example

```java
package com.commerzbank.repository;

import org.springframework.ldap.filter.AndFilter;
import org.springframework.ldap.filter.EqualsFilter;
import org.springframework.ldap.filter.HardcodedFilter;
import org.springframework.ldap.filter.LikeFilter;
import org.springframework.ldap.filter.NotFilter;
import org.springframework.ldap.filter.OrFilter;

public final class LdapFilterBuilder {

    /**
     * Builds query for active person users matching a search term on sAMAccountName or displayName.
     */
    public static String buildActiveUserSearchFilter(String searchTerm) {
        AndFilter rootAnd = new AndFilter();
        rootAnd.and(new EqualsFilter("objectCategory", "person"));
        rootAnd.and(new EqualsFilter("objectClass", "user"));

        // Exclude disabled accounts (userAccountControl bit 2 = 0x0002)
        // OID 1.2.840.113556.1.4.803 is LDAP_MATCHING_RULE_BIT_AND
        rootAnd.and(new NotFilter(new HardcodedFilter("userAccountControl:1.2.840.113556.1.4.803:=2")));

        // Search term match across username, email, or display name
        OrFilter termOr = new OrFilter();
        termOr.or(new LikeFilter("sAMAccountName", searchTerm));
        termOr.or(new LikeFilter("displayName", searchTerm));
        termOr.or(new EqualsFilter("mail", searchTerm));
        rootAnd.and(termOr);

        return rootAnd.encode();
    }
}
```

---

## 2. Active Directory Attribute Mapping

Active Directory stores directory data in both standard text and specialized binary formats.

### Common Active Directory Attributes

| LDAP Attribute       | Java Type            | Description                                             |
| :------------------- | :------------------- | :------------------------------------------------------ |
| `sAMAccountName`     | `String`             | Legacy pre-Windows 2000 login name (user ID)            |
| `userPrincipalName`  | `String`             | Enterprise user identity (e.g. `user@corp.example.com`) |
| `displayName`        | `String`             | Full name formatted for UI display                      |
| `givenName`          | `String`             | First name                                              |
| `sn`                 | `String`             | Surname / Last name                                     |
| `mail`               | `String`             | Primary email address                                   |
| `department`         | `String`             | Organizational department name                          |
| `title`              | `String`             | Job title or role description                           |
| `telephoneNumber`    | `String`             | Primary telephone contact                               |
| `distinguishedName`  | `String`             | Full directory path (DN) of the object                  |
| `userAccountControl` | `int`                | Bitmask defining account flags and state                |
| `objectGUID`         | `byte[]` -> `UUID`   | 16-byte unique identifier (mixed-endian)                |
| `objectSid`          | `byte[]` -> `String` | Binary Security Identifier (`S-1-5-21-...`)             |
| `memberOf`           | `List<String>`       | Direct group DNs assigned to the user                   |

---

## 3. Account Status: `userAccountControl` (UAC) Bitmask

Active Directory stores account flags as a 32-bit integer in the `userAccountControl` attribute.

### Bitmask Flags Table

| Flag Name              | Hex Value  | Decimal Value | Description               |
| :--------------------- | :--------- | :------------ | :------------------------ |
| `ACCOUNTDISABLE`       | `0x0002`   | 2             | Account is disabled       |
| `LOCKOUT`              | `0x0010`   | 16            | Account is locked out     |
| `PASSWD_NOTREQD`       | `0x0020`   | 32            | No password required      |
| `NORMAL_ACCOUNT`       | `0x0200`   | 512           | Standard user account     |
| `DONT_EXPIRE_PASSWORD` | `0x10000`  | 65536         | Password does not expire  |
| `PASSWORD_EXPIRED`     | `0x800000` | 8388608       | User password has expired |

### Bitmask Parsing in Java

```java
public final class UserAccountControlParser {
    public static final int ACCOUNT_DISABLE = 0x0002;
    public static final int LOCKOUT = 0x0010;
    public static final int NORMAL_ACCOUNT = 0x0200;
    public static final int DONT_EXPIRE_PASSWORD = 0x10000;

    public static boolean isAccountEnabled(int uac) {
        return (uac & ACCOUNT_DISABLE) == 0;
    }

    public static boolean isAccountLocked(int uac) {
        return (uac & LOCKOUT) != 0;
    }

    public static boolean isPasswordNeverExpires(int uac) {
        return (uac & DONT_EXPIRE_PASSWORD) != 0;
    }
}
```

---

## 4. Binary Converters: `objectGUID` and `objectSid`

To read `objectGUID` and `objectSid` as raw byte arrays, set:
`java.naming.ldap.attributes.binary = "objectGUID objectSid tokenGroups"` in `LdapContextSource`.

### RFC 4122 Mixed-Endian `objectGUID` Converter

Active Directory stores GUIDs in mixed-endian format. The first three groups (`Data1`, `Data2`, `Data3`) are stored in little-endian order, while `Data4` is stored in big-endian order. Reorder the bytes to produce a standard RFC 4122 UUID.

```java
package com.commerzbank.util;

import java.nio.ByteBuffer;
import java.util.UUID;

public final class ActiveDirectoryGuidUtils {

    private ActiveDirectoryGuidUtils() {}

    /**
     * Converts an Active Directory 16-byte mixed-endian array to a standard RFC 4122 UUID.
     */
    public static UUID convertObjectGuidToUuid(byte[] adGuidBytes) {
        if (adGuidBytes == null || adGuidBytes.length != 16) {
            throw new IllegalArgumentException("Expected 16-byte array for objectGUID");
        }

        byte[] rfcBytes = new byte[16];

        // Data1 (4 bytes): reverse byte order
        rfcBytes[0] = adGuidBytes[3];
        rfcBytes[1] = adGuidBytes[2];
        rfcBytes[2] = adGuidBytes[1];
        rfcBytes[3] = adGuidBytes[0];

        // Data2 (2 bytes): reverse byte order
        rfcBytes[4] = adGuidBytes[5];
        rfcBytes[5] = adGuidBytes[4];

        // Data3 (2 bytes): reverse byte order
        rfcBytes[6] = adGuidBytes[7];
        rfcBytes[7] = adGuidBytes[6];

        // Data4 (8 bytes): retain byte order
        System.arraycopy(adGuidBytes, 8, rfcBytes, 8, 8);

        ByteBuffer buffer = ByteBuffer.wrap(rfcBytes);
        return new UUID(buffer.getLong(), buffer.getLong());
    }
}
```

### Binary `objectSid` Parser

Converts raw binary Windows Security Identifiers into standard string representations (e.g. `S-1-5-21-3623811015-3361044348-30300820-1013`).

```java
package com.commerzbank.util;

public final class ActiveDirectorySidUtils {

    private ActiveDirectorySidUtils() {}

    /**
     * Converts a binary objectSid byte array to standard SDDL string representation.
     */
    public static String convertObjectSidToString(byte[] sid) {
        if (sid == null || sid.length < 8) {
            return null;
        }

        StringBuilder sb = new StringBuilder("S-");

        // Byte 0: Revision number
        int revision = sid[0] & 0xFF;
        sb.append(revision).append("-");

        // Byte 1: Sub-authority count
        int count = sid[1] & 0xFF;

        // Bytes 2-7: 48-bit Identifier Authority (big-endian)
        long authority = 0;
        for (int i = 2; i <= 7; i++) {
            authority = (authority << 8) | (sid[i] & 0xFF);
        }
        sb.append(authority);

        // Sub-authorities (each is a 32-bit unsigned little-endian integer)
        for (int i = 0; i < count; i++) {
            int offset = 8 + (i * 4);
            long subAuthority = ((long) (sid[offset] & 0xFF))
                    | (((long) (sid[offset + 1] & 0xFF)) << 8)
                    | (((long) (sid[offset + 2] & 0xFF)) << 16)
                    | (((long) (sid[offset + 3] & 0xFF)) << 24);
            sb.append("-").append(subAuthority & 0xFFFFFFFFL);
        }

        return sb.toString();
    }
}
```

---

## 5. Recursive / Transitive Group Membership Resolution

Active Directory user objects contain only **direct** group memberships in the `memberOf` attribute.

To resolve nested/transitive group hierarchies on the server side without recursive client-side queries, use Active Directory's LDAP Matching Rule In Chain OID: `1.2.840.113556.1.4.1941`.

### Transitive Filter Examples

#### 1. Check if a user belongs to a group (direct or nested)
```java
public static String buildTransitiveUserInGroupFilter(String username, String groupDn) {
    AndFilter filter = new AndFilter();
    filter.and(new EqualsFilter("sAMAccountName", username));
    filter.and(new HardcodedFilter("memberOf:1.2.840.113556.1.4.1941:=" + groupDn));
    return filter.encode();
}
```

#### 2. Find all groups (direct and nested) for a user DN
```java
public static String buildAllGroupsForUserFilter(String userDn) {
    AndFilter filter = new AndFilter();
    filter.and(new EqualsFilter("objectCategory", "group"));
    filter.and(new HardcodedFilter("member:1.2.840.113556.1.4.1941:=" + userDn));
    return filter.encode();
}
```

---

## 6. Result Set Governance: Paging with `PagedResultsDirContextProcessor`

Active Directory limits maximum return items per single query (`MaxPageSize = 1000`). Queries expecting large results must use LDAP Paged Results Control (RFC 2696).

```java
package com.commerzbank.repository;

import com.commerzbank.dto.UserDto;
import org.springframework.ldap.control.PagedResultsCookie;
import org.springframework.ldap.control.PagedResultsDirContextProcessor;
import org.springframework.ldap.core.AttributesMapper;
import org.springframework.ldap.core.LdapTemplate;

import javax.naming.directory.SearchControls;
import java.util.ArrayList;
import java.util.List;

public class PagedLdapSearchExecutor {

    public static List<UserDto> searchAllPaged(
            LdapTemplate ldapTemplate,
            String baseDn,
            String filter,
            AttributesMapper<UserDto> mapper,
            int pageSize) {

        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.SUBTREE_SCOPE);

        List<UserDto> results = new ArrayList<>();
        PagedResultsCookie cookie = null;

        do {
            PagedResultsDirContextProcessor processor =
                    new PagedResultsDirContextProcessor(pageSize, cookie);

            List<UserDto> page = ldapTemplate.search(
                    baseDn,
                    filter,
                    controls,
                    mapper,
                    processor
            );

            results.addAll(page);
            cookie = processor.getCookie();
        } while (cookie != null && cookie.getCookie() != null && cookie.getCookie().length > 0);

        return results;
    }
}
```

---

## 7. Complete `ActiveDirectoryRepository` Implementation

```java
package com.commerzbank.repository;

import com.commerzbank.config.LdapProperties;
import com.commerzbank.dto.UserDto;
import com.commerzbank.exception.AdException;
import com.commerzbank.util.ActiveDirectoryGuidUtils;
import com.commerzbank.util.ActiveDirectorySidUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ldap.core.AttributesMapper;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.filter.AndFilter;
import org.springframework.ldap.filter.EqualsFilter;
import org.springframework.ldap.filter.HardcodedFilter;
import org.springframework.stereotype.Repository;

import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ActiveDirectoryRepository {

    private final LdapTemplate ldapTemplate;
    private final LdapProperties ldapProperties;

    private final AttributesMapper<UserDto> userAttributesMapper = new UserAttributesMapper();

    /**
     * Finds a single user by sAMAccountName.
     */
    public Optional<UserDto> findBySamAccountName(String samAccountName) {
        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("objectCategory", "person"));
        filter.and(new EqualsFilter("sAMAccountName", samAccountName));

        try {
            List<UserDto> users = ldapTemplate.search(
                    ldapProperties.getSearch().getUserSearchBase(),
                    filter.encode(),
                    userAttributesMapper
            );
            return users.isEmpty() ? Optional.empty() : Optional.of(users.get(0));
        } catch (Exception ex) {
            log.error("Failed to query user by samAccountName: {}", samAccountName, ex);
            throw AdException.connectionError(ex);
        }
    }

    /**
     * Searches users by samAccountName and group distinguished name.
     */
    public List<UserDto> searchUsersBySamAccountNameAndGroup(String samAccountName, String groupDn) {
        log.debug("Searching users by samAccountName: {} and groupDn: {}", samAccountName, groupDn);
        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("samAccountName", samAccountName));
        filter.and(new EqualsFilter("memberOf", groupDn));

        try {
            return ldapTemplate.search(
                    ldapProperties.getSearch().getUserSearchBase(),
                    filter.encode(),
                    userAttributesMapper
            );
        } catch (Exception ex) {
            log.error("Failed to query users by samAccountName: {} and groupDn: {}", samAccountName, groupDn, ex);
            throw AdException.connectionError(ex);
        }
    }

    /**
     * Checks if a user is in a group using transitive group membership chaining.
     */
    public boolean isUserInGroupTransitive(String samAccountName, String groupDn) {
        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("objectCategory", "person"));
        filter.and(new EqualsFilter("sAMAccountName", samAccountName));
        filter.and(new HardcodedFilter("memberOf:1.2.840.113556.1.4.1941:=" + groupDn));

        try {
            List<UserDto> users = ldapTemplate.search(
                    ldapProperties.getSearch().getUserSearchBase(),
                    filter.encode(),
                    userAttributesMapper
            );
            return !users.isEmpty();
        } catch (Exception ex) {
            log.error("Failed transitive group check for user: {}, group: {}", samAccountName, groupDn, ex);
            throw AdException.connectionError(ex);
        }
    }

    /**
     * AttributesMapper mapping Active Directory attributes to UserDto.
     */
    public static class UserAttributesMapper implements AttributesMapper<UserDto> {

        @Override
        public UserDto mapFromAttributes(Attributes attrs) throws NamingException {
            UserDto.UserDtoBuilder builder = UserDto.builder();

            builder.username(getString(attrs, "sAMAccountName"));
            builder.userPrincipalName(getString(attrs, "userPrincipalName"));
            builder.displayName(getString(attrs, "displayName"));
            builder.givenName(getString(attrs, "givenName"));
            builder.surname(getString(attrs, "sn"));
            builder.email(getString(attrs, "mail"));
            builder.department(getString(attrs, "department"));
            builder.title(getString(attrs, "title"));
            builder.telephoneNumber(getString(attrs, "telephoneNumber"));
            builder.dn(getString(attrs, "distinguishedName"));

            // Parse userAccountControl bitmask (bit 2 = 0x0002 ACCOUNTDISABLE)
            Attribute uacAttr = attrs.get("userAccountControl");
            if (uacAttr != null && uacAttr.get() != null) {
                try {
                    int uac = Integer.parseInt(uacAttr.get().toString());
                    builder.enabled((uac & 0x0002) == 0);
                } catch (NumberFormatException e) {
                    builder.enabled(true);
                }
            } else {
                builder.enabled(true);
            }

            // Parse binary objectGUID
            Attribute guidAttr = attrs.get("objectGUID");
            if (guidAttr != null && guidAttr.get() instanceof byte[] bytes) {
                builder.guid(ActiveDirectoryGuidUtils.convertObjectGuidToUuid(bytes));
            }

            // Parse binary objectSid
            Attribute sidAttr = attrs.get("objectSid");
            if (sidAttr != null && sidAttr.get() instanceof byte[] bytes) {
                builder.sid(ActiveDirectorySidUtils.convertObjectSidToString(bytes));
            }

            // Collect direct group memberships
            Attribute memberOfAttr = attrs.get("memberOf");
            if (memberOfAttr != null) {
                List<String> groups = new ArrayList<>();
                NamingEnumeration<?> allMembers = memberOfAttr.getAll();
                while (allMembers.hasMore()) {
                    groups.add(String.valueOf(allMembers.next()));
                }
                builder.memberOfGroups(groups);
            } else {
                builder.memberOfGroups(Collections.emptyList());
            }

            return builder.build();
        }

        private String getString(Attributes attrs, String name) throws NamingException {
            Attribute attr = attrs.get(name);
            return (attr != null && attr.get() != null) ? attr.get().toString() : null;
        }
    }
}
```

