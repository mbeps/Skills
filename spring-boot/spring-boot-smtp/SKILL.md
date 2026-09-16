---
name: spring-boot-smtp
description: Use when designing, configuring, implementing, securing, testing, or troubleshooting email sending via SMTP in Spring Boot (3.x / 4.0), including spring-boot-starter-mail, JavaMailSender, MimeMessageHelper, Thymeleaf or FreeMarker HTML templates, attachments, inline CID images, SSL/TLS/STARTTLS configuration, GreenMail or Mailpit integration testing, or diagnosing socket timeouts, authentication failures, and SMTP delivery errors.
---

# Spring Boot SMTP Architecture

## Overview

Sending emails over SMTP in Spring Boot requires defensive network configuration, non-blocking asynchronous execution, strict input sanitisation, and automated integration testing with mock mail servers.

This skill provides architectural guidance and implementation standards for `spring-boot-starter-mail`, `JavaMailSender`, Jakarta Mail (`jakarta.mail.*`), and template engines.

---

## Email Design Decision Framework

Select the appropriate message model and delivery architecture based on email complexity and volume requirements:

```mermaid
graph TD
    A[Email Requirement] --> B{HTML formatting, attachments, or inline images required?}
    B -->|No| C[Use SimpleMailMessage]
    B -->|Yes| D{Dynamic branding or complex HTML layout?}
    D -->|No| E[Use MimeMessageHelper with raw HTML string]
    D -->|Yes| F[Use MimeMessageHelper + Template Engine (Thymeleaf / FreeMarker)]

    A --> G{Transactional consistency with database required?}
    G -->|Yes| H[Implement Transactional Outbox Pattern]
    G -->|No| I{High throughput or web request path?}
    I -->|Yes| J[Use @Async with Dedicated TaskExecutor / Virtual Threads]
    I -->|No| K[Synchronous Delivery]
```

---

## Quick Reference

| Requirement / Topic | Recommended Pattern | Detailed Guide |
|---|---|---|
| **SMTP Configuration & Ports** | Port 587 (STARTTLS), Port 465 (SSL), mandatory socket timeouts | [references/configuration-and-properties.md](references/configuration-and-properties.md) |
| **Plain Text vs Rich HTML** | `SimpleMailMessage` for plain text; `MimeMessageHelper` for HTML | [references/mime-messages-and-templating.md](references/mime-messages-and-templating.md) |
| **HTML Templating** | Thymeleaf (`ITemplateEngine`) or FreeMarker (`Configuration`) | [references/mime-messages-and-templating.md](references/mime-messages-and-templating.md) |
| **Attachments & Inline Images** | `ByteArrayResource` attachments, `helper.addInline("cid", ...)` | [references/attachments-and-inline-resources.md](references/attachments-and-inline-resources.md) |
| **Async & Resilience** | Dedicated `ThreadPoolTaskExecutor`, Virtual Threads, Spring Retry | [references/resilience-async-and-queuing.md](references/resilience-async-and-queuing.md) |
| **Transactional Consistency** | Transactional Outbox pattern to prevent phantom emails | [references/resilience-async-and-queuing.md](references/resilience-async-and-queuing.md) |
| **Testing with GreenMail** | JUnit 5 `@RegisterExtension GreenMailExtension` for slice tests | [references/testing-and-mocking.md](references/testing-and-mocking.md) |
| **Testing with Testcontainers** | Mailpit container with REST API assertions | [references/testing-and-mocking.md](references/testing-and-mocking.md) |
| **Security & Header Injection** | Strip `\r\n` from headers, mask PII in logs | [references/troubleshooting-and-security.md](references/troubleshooting-and-security.md) |
| **Troubleshooting & Error Codes** | Protocol debug mode, SSL handshake diagnosis, SMTP 4xx/5xx handling | [references/troubleshooting-and-security.md](references/troubleshooting-and-security.md) |

---

## Golden Rules & Core Invariants

### 1. Mandatory Socket Timeouts
Never rely on default Jakarta Mail socket settings. The default socket timeout is infinite. Always configure `connectiontimeout`, `timeout`, and `writetimeout` properties in `application.yml`. Without these timeouts, a stalled SMTP connection permanently hangs the executing thread.

### 2. Never Send Email Synchronously Inside Database Transactions
Never call `mailSender.send()` within a method marked with `@Transactional`. If the database transaction rolls back after the email is sent, the email cannot be retracted. Always use the Transactional Outbox pattern or publish an application event after transaction commit (`@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)`).

### 3. Decouple Web Requests from SMTP Network I/O
SMTP transmission involves multiple network round trips and TLS handshakes. This introduces 200 ms to 3000 ms of latency. Offload email dispatch to an asynchronous background worker using `@Async("mailTaskExecutor")`, Virtual Threads, or a persistent message broker (such as Kafka or RabbitMQ).

### 4. Ordering Rule for Inline Resources
When constructing multipart messages with inline images (CID), always invoke `helper.setText(htmlContent, true)` **before** invoking `helper.addInline("cidName", resource, mimeType)`. Invoking `setText` after `addInline` overwrites the message body parts and removes the registered inline images.

### 5. Prevent Header Injection (CRLF)
Never insert unvalidated user input into email headers (Subject, From, To, CC, or BCC). Always strip carriage return (`\r`) and line feed (`\n`) characters before setting header values.

### 6. Protect PII in Application Logs
Email addresses are Personally Identifiable Information (PII). Mask email addresses (for example, `j***e@example.com`) in log statements and metrics. Never log SMTP authentication passwords.

---

## Common Pitfalls & Rationalization Table

| Developer Rationalization | Engineering Reality | Mandatory Correct Practice |
|---|---|---|
| *"I do not need to configure timeouts because my cloud SMTP provider has 99.9% uptime."* | Network interruptions, routing failures, and firewall dropped packets occur regardless of provider uptime. Missing timeouts cause thread pool exhaustion and take down the entire application. | Explicitly configure `mail.smtp.connectiontimeout`, `mail.smtp.timeout`, and `mail.smtp.writetimeout` in all environments. |
| *"Sending email directly in `@Transactional` business methods is simpler than setting up an outbox."* | If the database transaction fails to commit, the user receives an email confirming an operation that was rolled back. If the SMTP server fails, the database rollback destroys valid business data. | Separate database state updates from email delivery using the Transactional Outbox pattern or `@TransactionalEventListener`. |
| *"I can test email sending by sending test messages to my personal inbox."* | Manual testing is non-repeatable, risks leaking sensitive test data to real external mail servers, and cannot run in automated CI/CD pipelines. | Use GreenMail JUnit 5 extension or Testcontainers Mailpit for automated, isolated integration testing. |
| *"I will call `helper.setText()` after adding my inline logo so the HTML template is loaded last."* | Jakarta Mail clears existing MIME body parts when `setText()` is called, causing broken image icons in email clients. | Call `helper.setText(html, true)` first, then call `helper.addInline()`. |
| *"I can use `@Async` without parameters for email sending."* | Unconfigured `@Async` uses Spring's `SimpleAsyncTaskExecutor`, which spawns unbounded threads and lacks backpressure control under traffic spikes. | Configure a bounded `ThreadPoolTaskExecutor` bean or enable Spring Boot 3.2+ Virtual Threads. |

---

## Red Flags - STOP and Fix

If any of the following patterns appear in the codebase, halt implementation and apply the required fix:

- Calling `mailSender.send()` inside a `@Transactional` annotated method.
- `spring.mail.properties.mail.smtp.timeout` is missing from configuration files.
- Calling `helper.addInline()` before `helper.setText()`.
- Unmasked recipient email addresses logged in production logs.
- Hardcoded SMTP credentials or unencrypted passwords in source code or version control.
- Catching and swallowing `MailException` without alerting or dead-letter queue persistence.
- Disabling SSL trust checks (`mail.smtp.ssl.trust=*`) in production configurations.

