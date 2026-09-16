attachments-and-inline-resources
---
# Email Attachments and Inline Resources

## Overview

Modern transactional emails often require dynamic file attachments (such as PDF receipts or CSV exports) and branded inline images (such as company logos).

In Spring Boot, `MimeMessageHelper` manages attachments and inline Content-ID (CID) resources.

---

## 1. Inline Resources (Content-ID / CID)

Inline images embed directly inside the email body without triggering remote image blocking in email clients (such as Microsoft Outlook or Apple Mail).

### Critical Ordering Rule

> **CRITICAL**: You must call `helper.setText(html, true)` **BEFORE** calling `helper.addInline(...)`. Calling `setText` after `addInline` overrides the body parts and removes previously registered inline resources.

### Template Example (`welcome.html`)

```html
<!DOCTYPE html>
<html>
<body>
    <div style="text-align: center;">
        <!-- Reference the CID matching the identifier used in helper.addInline -->
        <img src="cid:companyLogo" alt="Company Logo" width="200" />
    </div>
    <h2>Welcome to our service</h2>
    <p>We are glad to have you on board.</p>
</body>
</html>
```

### Java Implementation

```java
package com.example.mail.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class BrandedMailService {

    private final JavaMailSender mailSender;

    public BrandedMailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendWelcomeWithLogo(String to, String htmlContent) {
        MimeMessage message = mailSender.createMimeMessage();

        try {
            // Must use MULTIPART_MODE_RELATED or MULTIPART_MODE_MIXED_RELATED
            MimeMessageHelper helper = new MimeMessageHelper(
                message,
                MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                StandardCharsets.UTF_8.name()
            );

            helper.setFrom("info@company.com");
            helper.setTo(to);
            helper.setSubject("Welcome to Our Platform");

            // 1. Set text FIRST
            helper.setText(htmlContent, true);

            // 2. Add inline resource SECOND
            Resource logoResource = new ClassPathResource("static/images/logo.png");
            helper.addInline("companyLogo", logoResource, "image/png");

            mailSender.send(message);
        } catch (MessagingException e) {
            throw new MailPreparationException("Failed to attach inline branding logo", e);
        }
    }
}
```

---

## 2. File Attachments

Attachments are attached as separate files that recipients can download.

### Attachment Sources

- `ByteArrayResource`: For in-memory generated files (such as dynamic PDF reports or Excel sheets).
- `FileSystemResource`: For files already written to the local disk.
- `InputStreamSource`: For streaming dynamic content.

### In-Memory PDF Attachment Example

```java
package com.example.mail.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class InvoiceMailService {

    private final JavaMailSender mailSender;

    public InvoiceMailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendInvoice(String recipient, String invoiceNumber, byte[] pdfBytes) {
        MimeMessage message = mailSender.createMimeMessage();

        try {
            MimeMessageHelper helper = new MimeMessageHelper(
                message,
                MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                StandardCharsets.UTF_8.name()
            );

            helper.setFrom("billing@company.com");
            helper.setTo(recipient);
            helper.setSubject("Invoice " + invoiceNumber);
            helper.setText("Please find your attached invoice document.", false);

            // Wrap raw bytes in ByteArrayResource and specify filename and MIME type
            ByteArrayResource attachment = new ByteArrayResource(pdfBytes) {
                @Override
                public String getFilename() {
                    return "Invoice-" + invoiceNumber + ".pdf";
                }
            };

            helper.addAttachment("Invoice-" + invoiceNumber + ".pdf", attachment, "application/pdf");

            mailSender.send(message);
        } catch (MessagingException e) {
            throw new MailPreparationException("Could not attach invoice PDF", e);
        }
    }
}
```

---

## 3. Large File Handling and Safeguards

SMTP servers typically impose maximum message size limits (commonly 10 MB to 25 MB). Exceeding these limits causes the SMTP server to reject the entire transmission with a `552 5.3.4 Message size exceeds fixed maximum message size` error.

### Defensive Size Validation Pattern

```java
package com.example.mail.util;

public final class EmailAttachmentValidator {

    private static final long MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

    private EmailAttachmentValidator() {}

    public static void validateSize(byte[] fileData, String fileName) {
        if (fileData == null || fileData.length == 0) {
            throw new IllegalArgumentException("Attachment file data cannot be empty: " + fileName);
        }
        if (fileData.length > MAX_TOTAL_ATTACHMENT_BYTES) {
            throw new IllegalArgumentException(
                String.format("Attachment %s (%d bytes) exceeds maximum allowable limit of %d bytes",
                    fileName, fileData.length, MAX_TOTAL_ATTACHMENT_BYTES)
            );
        }
    }
}
```

### Memory Management Invariants
- Avoid loading massive files (>20 MB) into JVM heap memory as `byte[]`.
- For large documents, store files in an Object Storage service (such as AWS S3 or MinIO) and send a secure expiring download link in the email body rather than attaching the raw binary.

