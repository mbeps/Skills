# Testing SFTP Integration

## Overview
Test SFTP components using two primary approaches: an embedded in-memory Apache Mina SSHD server for lightweight, fast CI tests, or Testcontainers for realistic end-to-end integration testing.

---

## 1. Embedded Apache Mina SSHD Server (Zero Docker Dependency)

The embedded server runs in the same JVM process and requires no Docker daemon. It is suitable for fast local builds and restricted CI environments.

### Embedded SFTP Server Test Helper

```java
package com.example.sftp.test;

import org.apache.sshd.common.file.virtualfs.VirtualFileSystemFactory;
import org.apache.sshd.common.keyprovider.KeyIdentityProvider;
import org.apache.sshd.server.SshServer;
import org.apache.sshd.server.auth.password.AcceptAllPasswordAuthenticator;
import org.apache.sshd.server.keyprovider.SimpleGeneratorHostKeyProvider;
import org.apache.sshd.sftp.server.SftpSubsystemFactory;
import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;

public class EmbeddedSftpExtension implements BeforeAllCallback, AfterAllCallback {

    private SshServer sshServer;
    private Path sftpHomeDir;
    private int port;

    @Override
    public void beforeAll(ExtensionContext context) throws Exception {
        sftpHomeDir = Files.createTempDirectory("embedded_sftp_root_");
        Path hostKey = sftpHomeDir.resolve("hostkey.ser");

        sshServer = SshServer.setUpDefaultServer();
        sshServer.setPort(0); // auto-bind random free port
        sshServer.setKeyPairProvider(new SimpleGeneratorHostKeyProvider(hostKey));
        sshServer.setPasswordAuthenticator(AcceptAllPasswordAuthenticator.INSTANCE);
        sshServer.setSubsystemFactories(Collections.singletonList(new SftpSubsystemFactory()));
        sshServer.setFileSystemFactory(new VirtualFileSystemFactory(sftpHomeDir));

        sshServer.start();
        this.port = sshServer.getPort();
    }

    @Override
    public void afterAll(ExtensionContext context) throws Exception {
        if (sshServer != null) {
            sshServer.stop(true);
        }
    }

    public int getPort() {
        return port;
    }

    public Path getSftpHomeDir() {
        return sftpHomeDir;
    }
}
```

### Testing SftpRemoteFileTemplate with Embedded Server

```java
package com.example.sftp.test;

import com.example.sftp.service.SftpFileService;
import org.apache.sshd.sftp.client.SftpClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.integration.file.remote.session.CachingSessionFactory;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SftpFileServiceEmbeddedTest {

    @RegisterExtension
    static EmbeddedSftpExtension sftpExtension = new EmbeddedSftpExtension();

    private SftpFileService sftpFileService;

    @BeforeEach
    void setUp() {
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost("localhost");
        factory.setPort(sftpExtension.getPort());
        factory.setUser("testuser");
        factory.setPassword("anypassword");
        factory.setAllowUnknownKeys(true);

        CachingSessionFactory<SftpClient.DirEntry> cachingFactory = 
                new CachingSessionFactory<>(factory, 5);
        cachingFactory.setSessionWaitTimeout(2000);

        sftpFileService = new SftpFileService(cachingFactory);
    }

    @Test
    void shouldUploadAndDownloadFileSuccessfully() throws IOException {
        String testContent = "id,rate,currency\n1,1.0850,EUR\n2,1.2650,GBP";
        ByteArrayInputStream inputStream = new ByteArrayInputStream(testContent.getBytes(StandardCharsets.UTF_8));

        // Create remote folder in virtual filesystem
        Path uploadDir = sftpExtension.getSftpHomeDir().resolve("rates");
        Files.createDirectories(uploadDir);

        // Upload stream
        sftpFileService.uploadStream("/rates", "rates_2026.csv", inputStream);

        // Assert file exists on virtual disk
        Path uploadedFile = uploadDir.resolve("rates_2026.csv");
        assertThat(Files.exists(uploadedFile)).isTrue();
        assertThat(Files.readString(uploadedFile)).isEqualTo(testContent);

        // Assert list files
        List<String> files = sftpFileService.listFileNames("/rates");
        assertThat(files).containsExactly("rates_2026.csv");

        // Assert download
        byte[] downloadedBytes = sftpFileService.downloadFile("/rates/rates_2026.csv");
        assertThat(new String(downloadedBytes, StandardCharsets.UTF_8)).isEqualTo(testContent);

        // Assert delete
        boolean deleted = sftpFileService.deleteFile("/rates/rates_2026.csv");
        assertThat(deleted).isTrue();
        assertThat(Files.exists(uploadedFile)).isFalse();
    }
}
```

---

## 2. Testcontainers Integration Testing

Use Testcontainers when validating exact SSH daemon behaviour, real permissions, or specific Linux SFTP implementations.

### Testcontainers Test Class

```java
package com.example.sftp.test;

import com.example.sftp.service.SftpFileService;
import org.apache.sshd.sftp.client.SftpClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.integration.file.remote.session.CachingSessionFactory;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class SftpTestcontainersIntegrationTest {

    private static final int SFTP_PORT = 22;
    private static final String USER = "sftpuser";
    private static final String PASSWORD = "password123";

    @Container
    static GenericContainer<?> sftpContainer = new GenericContainer<>("atmoz/sftp:alpine")
            .withCommand(USER + ":" + PASSWORD + ":::upload")
            .withExposedPorts(SFTP_PORT);

    private SftpFileService sftpFileService;

    @BeforeEach
    void setUp() {
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost(sftpContainer.getHost());
        factory.setPort(sftpContainer.getMappedPort(SFTP_PORT));
        factory.setUser(USER);
        factory.setPassword(PASSWORD);
        factory.setAllowUnknownKeys(true);

        CachingSessionFactory<SftpClient.DirEntry> cachingFactory = 
                new CachingSessionFactory<>(factory, 5);
        cachingFactory.setSessionWaitTimeout(3000);

        sftpFileService = new SftpFileService(cachingFactory);
    }

    @Test
    void shouldUploadFileToContainer() {
        String payload = "CONTAINER_TEST_DATA";
        ByteArrayInputStream stream = new ByteArrayInputStream(payload.getBytes(StandardCharsets.UTF_8));

        sftpFileService.uploadStream("/upload", "test.txt", stream);

        assertThat(sftpFileService.exists("/upload", "test.txt")).isTrue();
        List<String> files = sftpFileService.listFileNames("/upload");
        assertThat(files).contains("test.txt");

        byte[] downloaded = sftpFileService.downloadFile("/upload/test.txt");
        assertThat(new String(downloaded, StandardCharsets.UTF_8)).isEqualTo(payload);
    }
}
```

---

## 3. Testing Best Practices
1. Use embedded Apache Mina SSHD for unit and regression test suites to avoid Docker latency.
2. Use Testcontainers for nightly or staging integration tests.
3. Always verify that `.writing` temporary files are renamed to their final filenames upon upload completion.
4. Always test session pool timeout behaviour by simulating exhausted connections.

