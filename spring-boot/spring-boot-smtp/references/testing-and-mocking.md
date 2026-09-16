testing-and-mocking
---
# Testing and Mocking Spring Boot SMTP Email

## Overview

Testing email functionality requires verifying message contents, recipients, templates, and attachments without delivering real emails to real mailboxes.

Three testing strategies are recommended:
1. **GreenMail (In-Memory SMTP Server)**: Fast, embedded JUnit 5 extension for integration slice tests.
2. **Mailpit Testcontainers**: Real containerised SMTP server with HTTP API for black-box integration tests.
3. **Mockito Mocking**: Unit tests verifying `JavaMailSender` invocation arguments without network sockets.

---

## 1. GreenMail JUnit 5 Extension (Recommended for Integration Tests)

GreenMail runs an embedded SMTP server inside the test JVM. It captures all outbound messages and exposes an API to inspect received messages.

### Step 1: Add Dependency

```xml
<dependency>
    <groupId>com.icegreen</groupId>
    <artifactId>greenmail-junit5</artifactId>
    <version>2.1.3</version>
    <scope>test</scope>
</dependency>
```

### Step 2: Integration Test with GreenMail

```java
package com.example.mail.service;

import com.icegreen.greenmail.configuration.GreenMailConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class GreenMailIntegrationTest {

    @RegisterExtension
    static GreenMailExtension greenMail = new GreenMailExtension(ServerSetupTest.SMTP)
        .withConfiguration(GreenMailConfiguration.aConfig().withUser("testuser", "testpass"))
        .withPerMethodLifecycle(true);

    @DynamicPropertySource
    static void configureMailProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mail.host", () -> "localhost");
        registry.add("spring.mail.port", () -> greenMail.getSmtp().getPort());
        registry.add("spring.mail.username", () -> "testuser");
        registry.add("spring.mail.password", () -> "testpass");
        registry.add("spring.mail.properties.mail.smtp.auth", () -> "true");
        registry.add("spring.mail.properties.mail.smtp.starttls.enable", () -> "false");
    }

    @Autowired
    private SimpleNotificationService notificationService;

    @Test
    void shouldSendAndCaptureEmail() throws Exception {
        notificationService.sendSystemAlert("user@example.com", "Test Subject", "Hello from Spring Boot");

        // Wait up to 5 seconds for message delivery
        assertThat(greenMail.waitForIncomingEmail(5000, 1)).isTrue();

        MimeMessage[] receivedMessages = greenMail.getReceivedMessages();
        assertThat(receivedMessages).hasSize(1);

        MimeMessage message = receivedMessages[0];
        assertThat(message.getSubject()).isEqualTo("Test Subject");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("user@example.com");
        assertThat(message.getContent().toString().trim()).isEqualTo("Hello from Spring Boot");
    }
}
```

---

## 2. Mailpit with Testcontainers

Mailpit is a fast SMTP server and testing tool. It captures emails and provides a REST API to query received messages.

### Step 1: Add Testcontainers Dependencies

```xml
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>testcontainers</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
```

### Step 2: Test Implementation

```java
package com.example.mail.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class MailpitIntegrationTest {

    private static final int SMTP_PORT = 1025;
    private static final int HTTP_API_PORT = 8025;

    @Container
    static GenericContainer<?> mailpit = new GenericContainer<>("axllent/mailpit:v1.22.0")
        .withExposedPorts(SMTP_PORT, HTTP_API_PORT);

    @DynamicPropertySource
    static void overrideMailProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mail.host", mailpit::getHost);
        registry.add("spring.mail.port", () -> mailpit.getMappedPort(SMTP_PORT));
        registry.add("spring.mail.properties.mail.smtp.auth", () -> "false");
        registry.add("spring.mail.properties.mail.smtp.starttls.enable", () -> "false");
    }

    @Autowired
    private SimpleNotificationService notificationService;

    @Test
    void shouldDeliverMailToMailpit() {
        notificationService.sendSystemAlert("customer@example.com", "Order Update", "Your order has been shipped.");
        // Assertions can be made by querying Mailpit's REST API at mailpit.getMappedPort(HTTP_API_PORT)
    }
}
```

---

## 3. Mockito Unit Testing (Spring Boot 3.4+ / 4.0)

For fast unit tests that do not involve networking or Spring context loading, mock `JavaMailSender` directly.

> **Note**: In Spring Boot 3.4+, `@MockitoBean` replaces the deprecated `@MockBean`.

```java
package com.example.mail.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SimpleNotificationServiceUnitTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private SimpleNotificationService notificationService;

    @Test
    void shouldPopulateAndSendSimpleMailMessage() {
        notificationService.sendSystemAlert("developer@company.com", "Build Failed", "Job 42 failed");

        ArgumentCaptor<SimpleMailMessage> messageCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        SimpleMailMessage sentMessage = messageCaptor.getValue();
        assertThat(sentMessage.getTo()).containsExactly("developer@company.com");
        assertThat(sentMessage.getSubject()).isEqualTo("Build Failed");
        assertThat(sentMessage.getText()).isEqualTo("Job 42 failed");
    }
}
```

