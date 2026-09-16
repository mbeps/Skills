troubleshooting-and-security
---
# Troubleshooting, Security, and Diagnostics

## Overview

Email transmission over SMTP involves network firewalls, TLS certificate verification, DNS routing, and authentication handshakes.

This guide details security measures, common error codes, and diagnostic steps.

---

## 1. Security: Preventing Header Injection (CRLF Injection)

Header injection occurs when untrusted user input is placed into message headers (such as Subject, From, To, CC, or BCC) without sanitisation.

If an attacker injects carriage return and line feed characters (`\r\n`), they can append malicious headers (such as adding hidden `Bcc:` recipients) or rewrite the message body.

### Sanitisation Pattern

Always strip carriage return and line feed characters from single-line headers:

```java
package com.example.mail.util;

public final class EmailHeaderSanitizer {

    private EmailHeaderSanitizer() {}

    public static String sanitizeHeader(String input) {
        if (input == null) {
            return null;
        }
        // Remove CR and LF characters to prevent header injection
        return input.replaceAll("[\r\n]", "").trim();
    }
}
```

---

## 2. PII Protection and Log Masking

Email addresses are Personally Identifiable Information (PII) under GDPR and privacy regulations. Never write unmasked email addresses or SMTP passwords into application log files.

### Masking Utility

```java
package com.example.mail.util;

public final class EmailMasker {

    private EmailMasker() {}

    public static String mask(String email) {
        if (email == null || !email.contains("@")) {
            return "***";
        }
        String[] parts = email.split("@", 2);
        String name = parts[0];
        String domain = parts[1];

        if (name.length() <= 2) {
            return "*@" + domain;
        }
        return name.charAt(0) + "***" + name.charAt(name.length() - 1) + "@" + domain;
    }
}
```

---

## 3. SMTP Status Codes and Error Handling

| SMTP Code | Category  | Meaning                                                          | Handling Action                                                      |
| --------- | --------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| **250**   | Success   | Requested mail action completed.                                 | Log success with recipient mask.                                     |
| **421**   | Transient | Service not available, closing transmission channel.             | Retry with exponential backoff.                                      |
| **450**   | Transient | Mailbox unavailable (busy or temporarily blocked).               | Retry with exponential backoff.                                      |
| **451**   | Transient | Local error in processing / rate limit reached.                  | Retry after delay.                                                   |
| **535**   | Permanent | Authentication credentials invalid.                              | Do not retry. Alert DevOps / check secret manager.                   |
| **550**   | Permanent | Mailbox unavailable / address does not exist.                    | Do not retry. Mark user email as invalid in DB.                      |
| **552**   | Permanent | Message size exceeds server storage allocation limit.            | Do not retry. Reduce attachment size or use object storage link.     |
| **554**   | Permanent | Transaction failed (Relay Access Denied, SPF/DKIM check failed). | Do not retry. Verify sender domain SPF/DKIM and relay authorization. |

---

## 4. Diagnostics and TLS Debugging

When emails fail to send or hang during connection establishment, enable low-level protocol debugging.

### Enable Jakarta Mail Protocol Logging

```yaml
spring:
  mail:
    properties:
      mail:
        debug: true # Outputs raw SMTP conversation (HELO, AUTH, DATA) to stdout
```

### Enable JVM TLS Handshake Debugging

If the connection fails during TLS negotiation (such as `PKIX path building failed` or `SSLHandshakeException`), add this JVM argument:

```bash
-Djavax.net.debug=ssl,handshake
```

### Common Issues and Solutions

#### Issue: `PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException`
- **Cause**: The SMTP server uses a self-signed or internal corporate CA certificate that is not trusted by the JVM truststore.
- **Solution**: Import the CA certificate into the JVM `cacerts` truststore using `keytool`, or configure a custom `SSLContext`. Never disable certificate validation in production.

#### Issue: `535 5.7.8 Authentication credentials invalid` on Gmail / Office 365
- **Cause**: Modern mail providers disable legacy basic authentication (plain username and password).
- **Solution**:
  - Gmail: Generate and use an **App Password** with 2-Factor Authentication enabled.
  - Microsoft Office 365 / Exchange: Use OAuth2 token authentication or configure an authenticated SMTP relay.

#### Issue: Application freezes or hangs on `mailSender.send()`
- **Cause**: Missing connection and socket read timeouts. Jakarta Mail defaults to infinite wait times when the remote server stops responding.
- **Solution**: Configure `mail.smtp.connectiontimeout`, `mail.smtp.timeout`, and `mail.smtp.writetimeout` properties.

