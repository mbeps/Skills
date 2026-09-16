# Resilience and Error Handling

## Overview
Network blips, server restarts, and transient file locks affect SFTP systems. Apply retry advice, circuit breakers, keep-alive heartbeats, and persistent metadata stores to maintain resilient file pipelines.

---

## 1. Retry Policies and RequestHandlerRetryAdvice

Add `RequestHandlerRetryAdvice` to outbound adapters or gateways to handle transient socket disconnects automatically.

### Retry Advice Configuration

```java
package com.example.sftp.resilience;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.handler.advice.RequestHandlerRetryAdvice;
import org.springframework.retry.backoff.ExponentialBackOffPolicy;
import org.springframework.retry.policy.SimpleRetryPolicy;
import org.springframework.retry.support.RetryTemplate;

import java.io.IOException;
import java.net.SocketException;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class SftpRetryConfig {

    @Bean
    public RequestHandlerRetryAdvice sftpRetryAdvice() {
        RequestHandlerRetryAdvice advice = new RequestHandlerRetryAdvice();
        
        RetryTemplate retryTemplate = new RetryTemplate();

        // Configure exponential backoff
        ExponentialBackOffPolicy backOffPolicy = new ExponentialBackOffPolicy();
        backOffPolicy.setInitialInterval(1000); // 1 second
        backOffPolicy.setMultiplier(2.0);
        backOffPolicy.setMaxInterval(10000);   // 10 seconds max
        retryTemplate.setBackOffPolicy(backOffPolicy);

        // Retry on network and I/O failures only
        Map<Class<? extends Throwable>, Boolean> retryableExceptions = new HashMap<>();
        retryableExceptions.put(IOException.class, true);
        retryableExceptions.put(SocketException.class, true);
        retryableExceptions.put(IllegalStateException.class, true); // for pool exhaustion

        SimpleRetryPolicy retryPolicy = new SimpleRetryPolicy(3, retryableExceptions, true);
        retryTemplate.setRetryPolicy(retryPolicy);

        advice.setRetryTemplate(retryTemplate);
        return advice;
    }
}
```

### Attaching Retry Advice to Outbound Handler

```java
@Bean
public IntegrationFlow sftpOutboundUploadFlow(
        SessionFactory<SftpClient.DirEntry> sessionFactory,
        RequestHandlerRetryAdvice sftpRetryAdvice) {

    return IntegrationFlow.from("sftpUploadChannel")
            .handle(Sftp.outboundAdapter(sessionFactory, FileExistsMode.REPLACE)
                            .remoteDirectory("/data/inbox")
                            .temporaryFileSuffix(".writing")
                            .autoCreateDirectory(true),
                    e -> e.advice(sftpRetryAdvice))
            .get();
}
```

---

## 2. Stale Connection Handling and Keep-Alive

SFTP connections held open across firewalls can drop silently if idle. Configure Apache Mina SSHD heartbeats to send periodic ping packets.

### Keep-Alive Configuration

```java
package com.example.sftp.resilience;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.common.PropertyResolverUtils;
import org.apache.sshd.core.CoreModuleProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.file.remote.session.CachingSessionFactory;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;

import java.time.Duration;

@Configuration
public class SftpKeepAliveConfig {

    @Bean
    public DefaultSftpSessionFactory sftpSessionFactoryWithKeepAlive() {
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost("sftp.example.com");
        factory.setPort(22);
        factory.setUser("sftp_user");
        factory.setPassword("SecretPass");
        factory.setAllowUnknownKeys(true);

        factory.setSshClientCustomizer(sshClient -> {
            // Send SSH heartbeat every 30 seconds
            PropertyResolverUtils.updateProperty(
                    sshClient,
                    CoreModuleProperties.HEARTBEAT_INTERVAL.getName(),
                    Duration.ofSeconds(30)
            );
            // Drop connection after 3 missed heartbeat replies
            PropertyResolverUtils.updateProperty(
                    sshClient,
                    CoreModuleProperties.HEARTBEAT_NO_REPLY_MAX.getName(),
                    3
            );
            // Socket idle timeout (5 minutes)
            PropertyResolverUtils.updateProperty(
                    sshClient,
                    CoreModuleProperties.IDLE_TIMEOUT.getName(),
                    Duration.ofMinutes(5)
            );
        });

        return factory;
    }

    @Bean
    public CachingSessionFactory<?> sftpCachingSessionFactory(
            DefaultSftpSessionFactory sftpSessionFactoryWithKeepAlive) {
        
        CachingSessionFactory<?> cachingFactory = 
                new CachingSessionFactory<>(sftpSessionFactoryWithKeepAlive, 10);
        
        // Always test session before returning from pool to discard dead sockets
        cachingFactory.setTestSession(true);
        cachingFactory.setSessionWaitTimeout(5000);
        return cachingFactory;
    }
}
```

---

## 3. Cluster Deduplication with Persistent MetadataStore

When running multiple instances of a Spring Boot service, inbound directory pollers will duplicate file processing without a shared metadata store.

### Redis Metadata Store Configuration

```java
package com.example.sftp.resilience;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.Pollers;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.redis.metadata.RedisMetadataStore;
import org.springframework.integration.sftp.dsl.Sftp;
import org.springframework.integration.sftp.filters.SftpPersistentAcceptOnceFileListFilter;

import java.io.File;
import java.time.Duration;

@Configuration
public class ClusteredSftpPollingConfig {

    @Bean
    public RedisMetadataStore redisMetadataStore(RedisConnectionFactory connectionFactory) {
        return new RedisMetadataStore(connectionFactory, "sftp_cluster_dedup_");
    }

    @Bean
    public SftpPersistentAcceptOnceFileListFilter clusteredSftpFilter(RedisMetadataStore redisMetadataStore) {
        // Prefix prevents key collisions in Redis
        return new SftpPersistentAcceptOnceFileListFilter(redisMetadataStore, "rates_files_");
    }

    @Bean
    public IntegrationFlow clusteredInboundFlow(
            SessionFactory<SftpClient.DirEntry> sessionFactory,
            SftpPersistentAcceptOnceFileListFilter clusteredSftpFilter) {

        return IntegrationFlow
                .from(Sftp.inboundAdapter(sessionFactory)
                                .remoteDirectory("/incoming/rates")
                                .filter(clusteredSftpFilter)
                                .localDirectory(new File(System.getProperty("java.io.tmpdir") + "/inbox"))
                                .autoCreateLocalDirectory(true),
                        e -> e.id("clusteredSftpAdapter")
                                .poller(Pollers.fixedDelay(Duration.ofSeconds(15)).maxMessagesPerPoll(10)))
                .handle(File.class, (file, headers) -> {
                    System.out.println("Processing deduplicated file: " + file.getName());
                    return null;
                })
                .get();
    }
}
```

---

## 4. Error Channel and Dead-Letter Routing

Route processing errors and corrupted file alerts to an error channel for logging and administrative notification.

```java
package com.example.sftp.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;

@Configuration
public class SftpErrorHandlingConfig {

    private static final Logger log = LoggerFactory.getLogger(SftpErrorHandlingConfig.class);

    @Bean
    public IntegrationFlow sftpGlobalErrorFlow() {
        return IntegrationFlow.from("errorChannel")
                .handle(MessagingException.class, (exception, headers) -> {
                    log.error("SFTP pipeline processing error: {}", exception.getMessage(), exception);
                    if (exception.getFailedMessage() != null) {
                        log.error("Failed payload: {}", exception.getFailedMessage().getPayload());
                    }
                    return null;
                })
                .get();
    }
}
```

