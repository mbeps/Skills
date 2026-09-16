# Authentication and Security

## Overview
Spring Integration SFTP uses Apache Mina SSHD for transport security. Configure public key authentication, known hosts verification, secure key storage, and network proxies to protect file transfers.

---

## 1. Public Key Authentication

Use public key authentication instead of static passwords for production systems. Apache Mina SSHD supports RSA, ECDSA, and Ed25519 keys in OpenSSH or PKCS#8 formats.

### Key Configuration Example

```java
package com.example.sftp.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Configuration
public class SftpSecurityConfig {

    @Bean
    public DefaultSftpSessionFactory keyBasedSessionFactory() {
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost("sftp.partner.com");
        factory.setPort(22);
        factory.setUser("integration_user");

        // Option A: Load from filesystem path or classpath
        Resource privateKeyResource = new FileSystemResource("/etc/secrets/sftp/id_rsa");
        factory.setPrivateKey(privateKeyResource);
        factory.setPrivateKeyPassphrase("passphrase-for-key");

        // Verify host key against known_hosts
        factory.setKnownHostsResource(new FileSystemResource("/etc/secrets/sftp/known_hosts"));
        factory.setAllowUnknownKeys(false);

        return factory;
    }

    /**
     * Loads private key from an in-memory base64 string (for example from AWS Secrets Manager or HashiCorp Vault).
     */
    public Resource decodeBase64Key(String base64EncodedPrivateKey) {
        byte[] decoded = Base64.getDecoder().decode(base64EncodedPrivateKey.trim());
        return new ByteArrayResource(decoded);
    }
}
```

---

## 2. Host Key Verification (known_hosts)

Setting `setAllowUnknownKeys(true)` disables man-in-the-middle verification. Always configure a `known_hosts` resource in production.

### Generating known_hosts Entry
Retrieve the remote public key using `ssh-keyscan`:

```bash
ssh-keyscan -p 22 -t rsa,ecdsa,ed25519 sftp.partner.com > /etc/secrets/sftp/known_hosts
```

### Loading known_hosts in Spring

```java
factory.setKnownHostsResource(new ClassPathResource("keys/known_hosts"));
factory.setAllowUnknownKeys(false);
```

---

## 3. Proxy and Bastion (Jump Host) Configuration

When the SFTP server is isolated behind a corporate firewall or SOCKS proxy, configure proxy settings on the underlying client.

### SOCKS5 Proxy Configuration via Apache Mina SSHD Customizer

```java
package com.example.sftp.security;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.common.PropertyResolverUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;

import java.net.InetSocketAddress;
import java.net.Proxy;

@Configuration
public class SftpProxyConfig {

    @Bean
    public DefaultSftpSessionFactory proxiedSessionFactory() {
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost("internal-sftp.corporate.local");
        factory.setPort(22);
        factory.setUser("app_service");
        factory.setPassword("secret123");
        factory.setAllowUnknownKeys(true);

        // Configure SshClient customizer to inject proxy or transport policies
        factory.setSshClientCustomizer(sshClient -> {
            // Set socket connect timeouts
            PropertyResolverUtils.updateProperty(
                    sshClient, 
                    "connect-timeout", 
                    10000L
            );
            PropertyResolverUtils.updateProperty(
                    sshClient, 
                    "auth-timeout", 
                    15000L
            );
        });

        return factory;
    }
}
```

---

## 4. Cipher Suites and Key Exchange (KEX) Hardening

Enforce approved cryptographic algorithms to comply with enterprise security policies (for example disabling weak SHA-1 or legacy DES ciphers).

```java
package com.example.sftp.security;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.common.NamedFactory;
import org.apache.sshd.common.cipher.BuiltinCiphers;
import org.apache.sshd.common.cipher.Cipher;
import org.apache.sshd.common.kex.BuiltinDHFactories;
import org.apache.sshd.common.kex.KeyExchangeFactory;
import org.apache.sshd.common.mac.BuiltinMacs;
import org.apache.sshd.common.mac.Mac;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.sftp.session.DefaultSftpSessionFactory;

import java.util.List;

@Configuration
public class SftpCryptoHardeningConfig {

    @Bean
    public DefaultSftpSessionFactory hardenedSessionFactory() {
        DefaultSftpSessionFactory factory = new DefaultSftpSessionFactory(false);
        factory.setHost("secure-sftp.bank.local");
        factory.setPort(22);
        factory.setUser("batch_user");
        factory.setPassword("ServicePass987");
        factory.setAllowUnknownKeys(false);

        factory.setSshClientCustomizer(this::applySecurityProfile);
        return factory;
    }

    private void applySecurityProfile(SshClient client) {
        // Enforce strong AES-GCM and ChaCha20 ciphers only
        List<NamedFactory<Cipher>> ciphers = List.of(
                BuiltinCiphers.aes256gcm,
                BuiltinCiphers.aes128gcm,
                BuiltinCiphers.aes256ctr
        );
        client.setCipherFactories(ciphers);

        // Enforce modern Elliptic Curve Key Exchange
        List<KeyExchangeFactory> kexFactories = List.of(
                BuiltinDHFactories.curve25519_sha256,
                BuiltinDHFactories.ecdhp521,
                BuiltinDHFactories.ecdhp384,
                BuiltinDHFactories.ecdhp256
        );
        client.setKeyExchangeFactories(kexFactories);

        // Enforce HMAC with SHA-256 or SHA-512
        List<NamedFactory<Mac>> macs = List.of(
                BuiltinMacs.hmacsha512,
                BuiltinMacs.hmacsha256
        );
        client.setMacFactories(macs);
    }
}
```

---

## 5. Security Checklist
1. Never store private keys in source control repositories.
2. Store key passphrases in environment variables or external secret managers.
3. Keep file permissions of private keys set to `0600` on the server filesystem.
4. Disable insecure ciphers (such as `arcfour`, `blowfish`, `3des-cbc`).
5. Set `allowUnknownKeys` to `false` and provide an explicit `known_hosts` file.

