# SFTP Interaction Patterns

## Overview
Spring Integration SFTP supports four core interaction patterns: on-demand template execution, inbound directory polling, streaming message sources, and outbound gateways.

---

## 1. SftpRemoteFileTemplate (On-Demand Operations)

`SftpRemoteFileTemplate` executes on-demand file operations and handles session acquisition and release automatically.

### Service Implementation

```java
package com.example.sftp.service;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.file.support.FileExistsMode;
import org.springframework.integration.sftp.session.SftpRemoteFileTemplate;
import org.springframework.messaging.support.GenericMessage;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;

@Service
public class SftpFileService {

    private final SftpRemoteFileTemplate template;

    public SftpFileService(SessionFactory<SftpClient.DirEntry> sessionFactory) {
        this.template = new SftpRemoteFileTemplate(sessionFactory);
        this.template.setTemporaryFileSuffix(".writing");
        this.template.setUseTemporaryFileName(true);
    }

    public void uploadFile(String remoteDirectory, String filename, File localFile) {
        template.send(new GenericMessage<>(localFile), remoteDirectory, FileExistsMode.REPLACE);
    }

    public void uploadStream(String remoteDirectory, String filename, InputStream inputStream) {
        template.execute(session -> {
            String tempPath = remoteDirectory + "/" + filename + ".writing";
            String finalPath = remoteDirectory + "/" + filename;
            session.write(inputStream, tempPath);
            session.rename(tempPath, finalPath);
            return null;
        });
    }

    public byte[] downloadFile(String remoteFilePath) {
        return template.execute(session -> {
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            session.read(remoteFilePath, outputStream);
            return outputStream.toByteArray();
        });
    }

    public boolean exists(String remoteDirectory, String filename) {
        return template.exists(remoteDirectory + "/" + filename);
    }

    public boolean deleteFile(String remoteFilePath) {
        return template.remove(remoteFilePath);
    }

    public List<String> listFileNames(String remoteDirectory) {
        return template.execute(session -> {
            SftpClient.DirEntry[] entries = session.list(remoteDirectory);
            if (entries == null) {
                return List.of();
            }
            return Arrays.stream(entries)
                    .filter(e -> !e.getFilename().startsWith("."))
                    .filter(e -> !e.getAttributes().isDirectory())
                    .map(SftpClient.DirEntry::getFilename)
                    .toList();
        });
    }
}
```

---

## 2. Inbound Directory Polling (File Synchroniser)

The inbound channel adapter polls a remote directory on a schedule, downloads new files to a local directory, and passes a `Message<File>` downstream.

### Integration Flow Configuration

```java
package com.example.sftp.flow;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.Pollers;
import org.springframework.integration.file.filters.ChainFileListFilter;
import org.springframework.integration.file.filters.FileSystemPersistentAcceptOnceFileListFilter;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.metadata.ConcurrentMetadataStore;
import org.springframework.integration.sftp.dsl.Sftp;
import org.springframework.integration.sftp.filters.SftpSimplePatternFileListFilter;

import java.io.File;
import java.time.Duration;

@Configuration
public class SftpInboundFlowConfig {

    @Bean
    public IntegrationFlow sftpInboundFlow(
            SessionFactory<SftpClient.DirEntry> sessionFactory,
            ConcurrentMetadataStore metadataStore,
            @Value("${sftp.remote-dir:/upload}") String remoteDir,
            @Value("${sftp.local-dir:${java.io.tmpdir}/sftp-inbound}") File localDir) {

        ChainFileListFilter<File> localFilter = new ChainFileListFilter<>();
        localFilter.addFilter(new FileSystemPersistentAcceptOnceFileListFilter(metadataStore, "sftp_local_processed_"));

        return IntegrationFlow
                .from(Sftp.inboundAdapter(sessionFactory)
                                .preserveTimestamp(true)
                                .remoteDirectory(remoteDir)
                                .regexFilter(".*\\.csv$")
                                .localDirectory(localDir)
                                .autoCreateLocalDirectory(true)
                                .localFilter(localFilter)
                                .deleteRemoteFiles(false),
                        e -> e.id("sftpInboundAdapter")
                                .autoStartup(true)
                                .poller(Pollers.fixedDelay(Duration.ofSeconds(10)).maxMessagesPerPoll(20)))
                .handle(File.class, (file, headers) -> {
                    processLocalFile(file);
                    return null;
                })
                .get();
    }

    private void processLocalFile(File file) {
        System.out.println("Processing downloaded file: " + file.getAbsolutePath());
    }
}
```

---

## 3. Inbound Streaming Message Source (Zero Local Disk)

When processing large files (several gigabytes), write operations to local disk create storage bottlenecks. The streaming adapter returns an open `InputStream` inside the message payload.

### Streaming Flow Configuration

```java
package com.example.sftp.flow;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.IntegrationMessageHeaderAccessor;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.Pollers;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.file.splitter.FileSplitter;
import org.springframework.integration.sftp.dsl.Sftp;

import java.io.BufferedReader;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Configuration
public class SftpStreamingFlowConfig {

    @Bean
    public IntegrationFlow sftpStreamingFlow(
            SessionFactory<SftpClient.DirEntry> sessionFactory,
            @Value("${sftp.remote-dir:/reports}") String remoteDir) {

        return IntegrationFlow
                .from(Sftp.inboundStreamingAdapter(sessionFactory)
                                .remoteDirectory(remoteDir)
                                .patternFilter("*.dat"),
                        e -> e.id("sftpStreamingAdapter")
                                .poller(Pollers.fixedDelay(Duration.ofSeconds(30)).maxMessagesPerPoll(5)))
                .handle((payload, headers) -> {
                    InputStream inputStream = (InputStream) payload;
                    Closeable closeableResource = headers.get(
                            IntegrationMessageHeaderAccessor.CLOSEABLE_RESOURCE, Closeable.class);

                    try (inputStream; BufferedReader reader = new BufferedReader(
                            new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
                        
                        String line;
                        while ((line = reader.readLine()) != null) {
                            processRecord(line);
                        }
                    } catch (IOException e) {
                        throw new RuntimeException("Failed to stream remote SFTP file", e);
                    } finally {
                        if (closeableResource != null) {
                            try {
                                closeableResource.close();
                            } catch (IOException ignored) {
                            }
                        }
                    }
                    return null;
                })
                .get();
    }

    private void processRecord(String line) {
        System.out.println("Read line from stream: " + line);
    }
}
```

---

## 4. Outbound Gateway (Request-Reply Remote Commands)

Use `SftpOutboundGateway` to run remote filesystem commands (`ls`, `get`, `mget`, `rm`, `mv`) through standard message flows.

### Gateway Flow Configuration

```java
package com.example.sftp.flow;

import org.apache.sshd.sftp.client.SftpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.Gateway;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.file.remote.gateway.AbstractRemoteFileOutboundGateway;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.sftp.dsl.Sftp;

import java.io.File;
import java.util.List;

@Configuration
public class SftpGatewayConfig {

    @MessagingGateway
    public interface SftpCommandGateway {
        @Gateway(requestChannel = "sftpLsChannel")
        List<SftpClient.DirEntry> listFiles(String remoteDirectory);

        @Gateway(requestChannel = "sftpGetChannel")
        File fetchFile(String remoteFilePath);

        @Gateway(requestChannel = "sftpRmChannel")
        Boolean removeFile(String remoteFilePath);
    }

    @Bean
    public IntegrationFlow sftpLsFlow(SessionFactory<SftpClient.DirEntry> sessionFactory) {
        return IntegrationFlow.from("sftpLsChannel")
                .handle(Sftp.outboundGateway(sessionFactory,
                                AbstractRemoteFileOutboundGateway.Command.LS, "payload")
                        .options(AbstractRemoteFileOutboundGateway.Option.NAME_ONLY))
                .get();
    }

    @Bean
    public IntegrationFlow sftpGetFlow(SessionFactory<SftpClient.DirEntry> sessionFactory) {
        return IntegrationFlow.from("sftpGetChannel")
                .handle(Sftp.outboundGateway(sessionFactory,
                                AbstractRemoteFileOutboundGateway.Command.GET, "payload")
                        .localDirectory(new File(System.getProperty("java.io.tmpdir") + "/sftp-downloads"))
                        .options(AbstractRemoteFileOutboundGateway.Option.PRESERVE_TIMESTAMP))
                .get();
    }

    @Bean
    public IntegrationFlow sftpRmFlow(SessionFactory<SftpClient.DirEntry> sessionFactory) {
        return IntegrationFlow.from("sftpRmChannel")
                .handle(Sftp.outboundGateway(sessionFactory,
                        AbstractRemoteFileOutboundGateway.Command.RM, "payload"))
                .get();
    }
}
```

