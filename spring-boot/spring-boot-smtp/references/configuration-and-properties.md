configuration-and-properties
---
# Spring Boot SMTP Configuration and Properties

## Overview

Spring Boot provides auto-configuration for SMTP mail sending via `spring-boot-starter-mail`. This starter provides the Jakarta Mail API (`jakarta.mail.*`) and the default Angus Mail implementation (`org.eclipse.angus:jakarta.mail`).

---

## 1. Dependencies

Add the mail starter to your build definition.

### Maven (`pom.xml`)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

### Gradle (`build.gradle.kts`)

```kotlin
implementation("org.springframework.boot:spring-boot-starter-mail")
```

---

## 2. Standard Configuration Properties

Define your SMTP configuration in `application.yml` or `application.properties`.

### YAML Configuration (`application.yml`)

```yaml
spring:
  mail:
    host: smtp.example.com
    port: 587
    username: smtp-user@example.com
    password: "${SMTP_PASSWORD}"
    protocol: smtp
    default-encoding: UTF-8
    test-connection: false # Set true only for startup verification
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
          # Mandatory timeouts to prevent thread hanging
          connectiontimeout: 5000 # Milliseconds to establish TCP connection
          timeout: 5000           # Milliseconds for socket read
          writetimeout: 5000      # Milliseconds for socket write
        debug: false              # Set true only when troubleshooting handshakes
```

### Properties Configuration (`application.properties`)

```properties
spring.mail.host=smtp.example.com
spring.mail.port=587
spring.mail.username=smtp-user@example.com
spring.mail.password=${SMTP_PASSWORD}
spring.mail.protocol=smtp
spring.mail.default-encoding=UTF-8
spring.mail.test-connection=false

# Jakarta Mail / SMTP properties
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
spring.mail.properties.mail.smtp.starttls.required=true
spring.mail.properties.mail.smtp.connectiontimeout=5000
spring.mail.properties.mail.smtp.timeout=5000
spring.mail.properties.mail.smtp.writetimeout=5000
spring.mail.properties.mail.debug=false
```

---

## 3. SMTP Security Protocols and Ports

Select the correct port and TLS configuration based on your mail server requirements.

| Port    | Protocol Type                | Configuration Flags                                                                                    | Usage Context                                                                                |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **587** | **STARTTLS (Explicit TLS)**  | `mail.smtp.starttls.enable=true`<br>`mail.smtp.starttls.required=true`<br>`mail.smtp.ssl.enable=false` | Modern standard for client-to-server mail submission (Office 365, AWS SES, SendGrid, Gmail). |
| **465** | **SMTPS (Implicit SSL/TLS)** | `mail.smtp.ssl.enable=true`<br>`mail.smtp.starttls.enable=false`                                       | Legacy SSL submission port. Wraps the entire TCP connection in TLS from the start.           |
| **25**  | **Plain / Unencrypted**      | `mail.smtp.auth=false`<br>`mail.smtp.starttls.enable=false`                                            | Internal corporate network relays and local MTA agents (such as Postfix or Sendmail).        |

### Explicit STARTTLS Configuration (Port 587)

```yaml
spring:
  mail:
    host: smtp.office365.com
    port: 587
    username: alerts@company.com
    password: "${OFFICE365_SECRET}"
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
```

### Implicit SSL/TLS Configuration (Port 465)

```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 465
    username: service-account@gmail.com
    password: "${GMAIL_APP_PASSWORD}"
    properties:
      mail:
        smtp:
          auth: true
          ssl:
            enable: true
            trust: "smtp.gmail.com"
```

---

## 4. Mandatory Socket Timeouts

Without explicit timeout values, Jakarta Mail uses infinite socket timeouts. A dropped network connection or an unresponsive SMTP server will cause worker threads to block permanently. This leads to thread pool exhaustion and application outage.

Always set all three timeout properties:

```yaml
spring:
  mail:
    properties:
      mail:
        smtp:
          connectiontimeout: 5000 # Connection establishment timeout (ms)
          timeout: 10000          # Socket read timeout (ms)
          writetimeout: 10000     # Socket write timeout (ms)
```

---

## 5. Multi-Tenant / Dynamic JavaMailSender Configuration

When your application sends emails using different SMTP configurations per tenant, bypass Spring Boot auto-configuration and construct `JavaMailSenderImpl` instances dynamically.

```java
package com.example.mail.config;

import java.util.Properties;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

@Component
public class DynamicMailSenderFactory {

    public JavaMailSender createSender(SmtpServerConfig config) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(config.host());
        sender.setPort(config.port());
        sender.setUsername(config.username());
        sender.setPassword(config.password());
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", String.valueOf(config.authEnabled()));
        props.put("mail.smtp.starttls.enable", String.valueOf(config.starttlsEnabled()));
        props.put("mail.smtp.starttls.required", String.valueOf(config.starttlsRequired()));
        props.put("mail.smtp.connectiontimeout", 5000);
        props.put("mail.smtp.timeout", 5000);
        props.put("mail.smtp.writetimeout", 5000);

        return sender;
    }
}
```

---

## 6. Actuator Health Indicator

Spring Boot Actuator includes an automatic `MailHealthIndicator`. It tests the SMTP connection by calling `JavaMailSenderImpl.testConnection()`.

### Enable or Disable Mail Health Probes

```yaml
management:
  health:
    mail:
      enabled: true # Set to false if you do not want Actuator to open SMTP connections on health checks
  endpoint:
    health:
      show-details: when_authorized
```

> **Warning**: The default `MailHealthIndicator` opens an actual TCP socket to the SMTP host on every health check poll. In Kubernetes environments with frequent liveness and readiness probes (such as every 5 seconds), this can overwhelm the SMTP server with connection handshakes or cause rate-limiting. Disable `management.health.mail.enabled` if polling is frequent.

