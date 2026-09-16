# Session Factory and Pooling

## Overview
Spring Integration SFTP uses `DefaultSftpSessionFactory` to establish SSH connections via Apache Mina SSHD. In Spring Integration 6.0 (Spring Boot 3.0) and later versions, Apache Mina SSHD is the sole supported SSH client implementation. Legacy JSch support was deprecated and removed because of lack of upstream maintenance. A `CachingSessionFactory` wraps the default factory to manage a reusable pool of SFTP sessions.

---

## DefaultSftpSessionFactory Configuration

`DefaultSftpSessionFactory` handles low-level socket connections, SSH handshakes, and credentials.

### Configuration Properties Class

```java
package com.example.sftp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;

import java.time.Duration;

@ConfigurationProperties(prefix = "sftp")
public record SftpProperties(
        String host,
        int port,
        String user,
        String password,
        Resource privateKey,
        String privateKeyPassphrase,
        Resource knownHostsResource,
        boolean allowUnknownKeys,
        Duration connectTimeout,
        PoolProperties pool
) {
    public record PoolProperties(
            int maxTotal,
            Duration waitTimeout,
            boolean testOnBorrow
    ) {}
}
```

### Session Factory Bean Configuration

```java
package com.example.sftp.config;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.file.remote.session.CachingSessionFactory;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;
import org.springframework.integration.sftp.session.SftpRemoteFileTemplate;

import java.io.IOException;

@Configuration
@EnableConfigurationProperties(SftpProperties.class)
public class SftpConfig {

    @Bean
    public DefaultSftpSessionFactory defaultSftpSessionFactory(SftpProperties properties) {
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost(properties.host());
        factory.setPort(properties.port());
        factory.setUser(properties.user());

        if (properties.privateKey() != null) {
            factory.setPrivateKey(properties.privateKey());
            if (properties.privateKeyPassphrase() != null) {
                factory.setPrivateKeyPassphrase(properties.privateKeyPassphrase());
            }
        } else {
            factory.setPassword(properties.password());
        }

        if (properties.knownHostsResource() != null) {
            factory.setKnownHostsResource(properties.knownHostsResource());
            factory.setAllowUnknownKeys(false);
        } else {
            factory.setAllowUnknownKeys(properties.allowUnknownKeys());
        }

        if (properties.connectTimeout() != null) {
            factory.setTimeout((int) properties.connectTimeout().toMillis());
        }

        return factory;
    }

    @Bean
    public SessionFactory<SftpClient.DirEntry> cachingSessionFactory(
            DefaultSftpSessionFactory defaultSftpSessionFactory,
            SftpProperties properties) {
        
        CachingSessionFactory<SftpClient.DirEntry> cachingFactory = 
                new CachingSessionFactory<>(defaultSftpSessionFactory, properties.pool().maxTotal());

        cachingFactory.setSessionWaitTimeout(properties.pool().waitTimeout().toMillis());
        cachingFactory.setTestSession(properties.pool().testOnBorrow());

        return cachingFactory;
    }

    @Bean
    public SftpRemoteFileTemplate sftpRemoteFileTemplate(
            SessionFactory<SftpClient.DirEntry> cachingSessionFactory) {
        
        SftpRemoteFileTemplate template = new SftpRemoteFileTemplate(cachingSessionFactory);
        template.setRemoteDirectoryExpression(null);
        template.setTemporaryFileSuffix(".writing");
        return template;
    }
}
```

---

## CachingSessionFactory Details and Pool Tuning

### Essential Pool Parameters
1. **Pool Size (`maxTotal`)**: Sets the maximum number of active SFTP sessions in the pool. Default is 10.
2. **Session Wait Timeout (`sessionWaitTimeout`)**: Defines how long a thread waits for an available session before throwing `IllegalStateException`. Never leave this at 0 (indefinite block). Always configure a positive duration (for example 5000 milliseconds).
3. **Test on Borrow (`testSession`)**: When set to `true`, the factory verifies that the underlying SSH session is open and valid before returning it to the caller. This prevents errors from dead sockets.

### Handling Session Pool Exhaustion
When all sessions are busy, threads block until `sessionWaitTimeout` expires.

```text
java.lang.IllegalStateException: Failed to obtain a session from the pool; timeout exceeded (5000 ms)
```

Mitigation steps:
- Increase the pool size (`maxTotal`) if concurrent throughput requires more connections.
- Ensure all custom session code uses try-with-resources blocks.
- Set a short, explicit `sessionWaitTimeout` to fail fast and trigger application retry mechanisms.

---

## Dynamic Multi-Tenant Routing with DelegatingSessionFactory

When connecting to multiple SFTP servers based on tenant identifier or message attributes, use `DelegatingSessionFactory`.

```java
package com.example.sftp.config;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.file.remote.session.CachingSessionFactory;
import org.springframework.integration.file.remote.session.DelegatingSessionFactory;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;
import org.springframework.integration.sftp.session.SftpRemoteFileTemplate;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class MultiTenantSftpConfig {

    @Bean
    public DelegatingSessionFactory<SftpClient.DirEntry> delegatingSessionFactory() {
        Map<Object, SessionFactory<SftpClient.DirEntry>> factories = new HashMap<>();

        factories.put("tenant-a", createCachingFactory("sftp-a.example.com", 22, "user_a", "secret_a"));
        factories.put("tenant-b", createCachingFactory("sftp-b.example.com", 22, "user_b", "secret_b"));

        SessionFactory<SftpClient.DirEntry> defaultFactory = factories.get("tenant-a");
        return new DelegatingSessionFactory<>(factories, defaultFactory);
    }

    private SessionFactory<SftpClient.DirEntry> createCachingFactory(
            String host, int port, String user, String password) {
        
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost(host);
        factory.setPort(port);
        factory.setUser(user);
        factory.setPassword(password);
        factory.setAllowUnknownKeys(true);

        CachingSessionFactory<SftpClient.DirEntry> caching = new CachingSessionFactory<>(factory, 5);
        caching.setSessionWaitTimeout(3000);
        caching.setTestSession(true);
        return caching;
    }

    @Bean
    public SftpRemoteFileTemplate multiTenantTemplate(
            DelegatingSessionFactory<SftpClient.DirEntry> delegatingSessionFactory) {
        return new SftpRemoteFileTemplate(delegatingSessionFactory);
    }
}
```

### Selecting Tenant at Runtime

```java
package com.example.sftp.service;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.integration.file.remote.session.DelegatingSessionFactory;
import org.springframework.integration.sftp.session.SftpRemoteFileTemplate;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Service
public class MultiTenantSftpService {

    private final DelegatingSessionFactory<SftpClient.DirEntry> delegatingSessionFactory;
    private final SftpRemoteFileTemplate template;

    public MultiTenantSftpService(
            DelegatingSessionFactory<SftpClient.DirEntry> delegatingSessionFactory,
            SftpRemoteFileTemplate template) {
        this.delegatingSessionFactory = delegatingSessionFactory;
        this.template = template;
    }

    public void uploadForTenant(String tenantKey, String remoteDir, String fileName, InputStream data) {
        try {
            delegatingSessionFactory.setThreadKey(tenantKey);
            template.execute(session -> {
                session.write(data, remoteDir + "/" + fileName);
                return null;
            });
        } finally {
            delegatingSessionFactory.clearThreadKey();
        }
    }
}
```

---

## Thread Safety Caveats

- `Session<SftpClient.DirEntry>` is stateful and not thread-safe.
- Never store a `Session` in an instance variable.
- Always acquire the session inside the method and close it in a `finally` block or try-with-resources.
- `CachingSessionFactory.close()` on a session instance returns that session to the pool. It does not close the underlying physical SSH socket.

