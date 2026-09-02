# JWT Security, RS256 Signing & JWKS Key Distribution

This reference document explains the cryptographic architecture, token structure, claims manipulation, and JWKS distribution used in distributed Spring Boot OAuth2 architectures.

---

## 1. Asymmetric Cryptography (RS256) vs Symmetric (HS256)

| Attribute            | Symmetric (HS256)                                                                       | Asymmetric (RS256)                                                               |
| -------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Key Architecture** | Single Shared Secret (`secret-key`)                                                     | RSA Key Pair (Private + Public Key)                                              |
| **Signing Entity**   | Any service with the secret                                                             | **Auth Service ONLY** (holds Private Key)                                        |
| **Verifying Entity** | Any service with the secret                                                             | **Any Resource Server** (holds Public Key)                                       |
| **Blast Radius**     | If any resource server is compromised, attacker can **forge valid tokens for any user** | If resource server is compromised, attacker **cannot forge tokens**              |
| **Key Distribution** | Requires sharing secret via configuration / vault                                       | Public key published openly via JWKS (`/.well-known/jwks.json`)                  |
| **Key Rotation**     | Requires synchronized config restart across all services                                | Rotate private key on Auth Service; downstream services auto-discover public key |

---

## 2. RSA Key Pair Generation

To generate production-ready 2048-bit or 4096-bit RSA keys in PKCS8 (private) and X.509 (public) formats:

```bash
# 1. Generate RSA Private Key (2048-bit)
openssl genpkey -algorithm RSA -out keys/auth-private.pem -pkeyopt rsa_keygen_bits:2048

# 2. Extract Public Key in X.509 SubjectPublicKeyInfo format
openssl rsa -pubout -in keys/auth-private.pem -out keys/auth-public.pem

# 3. Ensure strict file permissions
chmod 600 keys/auth-private.pem
chmod 644 keys/auth-public.pem
```

---

## 3. Java In-Memory Key Loading

Spring Boot loads PEM keys at startup using Java's standard `java.security.KeyFactory`:

```java
package com.maruf.auth.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

public class PemKeyLoader {

    public static RSAPrivateKey loadPrivateKey(String path) 
            throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String pem = Files.readString(Path.of(path));
        String base64 = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] keyBytes = Base64.getDecoder().decode(base64);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(spec);
    }

    public static RSAPublicKey loadPublicKey(String path) 
            throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String pem = Files.readString(Path.of(path));
        String base64 = pem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] keyBytes = Base64.getDecoder().decode(base64);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
        return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
    }
}
```

---

## 4. Token Construction & Claims Manipulation (JJWT 0.12.x)

Both Access Tokens and Refresh Tokens are signed RS256 JWTs carrying standardized and application claims.

### Claims Taxonomy

```
JWT Structure:
┌─────────────────────────┐
│ Header:                 │  alg: "RS256", typ: "JWT" (or "at+jwt" for access token)
├─────────────────────────┤
│ Payload (Claims):       │
│  • sub                  │  Standard: User identifier / email
│  • iat                  │  Standard: Epoch millisecond issued timestamp
│  • exp                  │  Standard: Expiration timestamp (15 min / 7 days)
│  • type                 │  Custom Security Claim: "access" vs "refresh"
│  • id                   │  Custom: Provider user unique ID
│  • login                │  Custom: Normalized username
│  • name                 │  Custom: Display name
│  • email                │  Custom: User email address
│  • avatar_url           │  Custom: Avatar image URI
├─────────────────────────┤
│ Signature:              │  RSASSA-PKCS1-v1_5 SHA-256 (RSA Private Key)
└─────────────────────────┘
```

### JJWT 0.12.x Token Signing & Verification Code

```java
package com.maruf.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    private final RSAPrivateKey rsaPrivateKey;
    private final RSAPublicKey rsaPublicKey;

    public String generateAccessToken(Map<String, Object> claims, String subject, long ttlMs) {
        Map<String, Object> tokenClaims = new HashMap<>(claims);
        tokenClaims.put("type", "access"); // Strict type binding

        return Jwts.builder()
                .claims(tokenClaims)
                .subject(subject)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(rsaPrivateKey) // Infers RS256 from RSAPrivateKey
                .compact();
    }

    public String generateRefreshToken(String subject, Map<String, Object> additionalClaims, long ttlMs) {
        Map<String, Object> claims = new HashMap<>(additionalClaims);
        claims.put("type", "refresh");

        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(rsaPrivateKey)
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(rsaPublicKey) // Enforces RS256 signature verification with public key
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.error("Invalid JWT: {}", e.getMessage());
            return false;
        }
    }
}
```

---

## 5. JWKS Key Distribution (RFC 7517)

The Auth Service serves the RSA Public Key formatted as a **JSON Web Key Set** (JWKS) per RFC 7517.

### Endpoint Response (`GET /.well-known/jwks.json`)
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "1",
      "n": "u1bX7Y0...<Base64URL-encoded-modulus>...",
      "e": "AQAB"
    }
  ]
}
```

### Handling Java's BigInteger Sign Byte (Critical Edge Case)

`BigInteger.toByteArray()` returns a two's complement representation. If the most significant bit of the modulus or exponent is `1`, Java prepends a `0x00` sign byte. If this `0x00` is Base64URL-encoded, it invalidates the key for external JWKS parsers.

```java
package com.maruf.auth.controller;

import com.maruf.auth.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigInteger;
import java.security.interfaces.RSAPublicKey;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class WellKnownController {

    private final JwtService jwtService;

    @GetMapping(value = "/.well-known/jwks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getJwks() {
        RSAPublicKey publicKey = jwtService.getPublicKey();

        String n = encodeBigIntegerWithoutSignByte(publicKey.getModulus());
        String e = encodeBigIntegerWithoutSignByte(publicKey.getPublicExponent());

        Map<String, Object> jwk = new LinkedHashMap<>();
        jwk.put("kty", "RSA");
        jwk.put("use", "sig");
        jwk.put("alg", "RS256");
        jwk.put("kid", "1");
        jwk.put("n", n);
        jwk.put("e", e);

        Map<String, Object> response = new HashMap<>();
        response.put("keys", Collections.singletonList(jwk));
        return ResponseEntity.ok(response);
    }

    private String encodeBigIntegerWithoutSignByte(BigInteger value) {
        byte[] bytes = value.toByteArray();
        // Strip leading two's complement 0x00 sign byte
        if (bytes.length > 1 && bytes[0] == 0) {
            bytes = Arrays.copyOfRange(bytes, 1, bytes.length);
        }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
```

---

## 6. Token Tampering & Attack Vectors Defense

### 1. Algorithm Confusion Defense (`alg: none` or `alg: HS256`)
In algorithm substitution attacks, an attacker changes the header to `alg: HS256` and signs the token using the victim's public key as an HMAC secret.
- **Defense**: JJWT 0.12+ `verifyWith(RSAPublicKey)` strictly mandates asymmetric verification. It rejects any token specifying symmetric or null algorithms.

### 2. Type Confusion Defense (RFC 8725)
Without explicit token typing, an attacker could present a long-lived Refresh Token to a protected Resource Server endpoint.
- **Defense**: All resource server filters enforce:
  ```java
  if (!"access".equals(claims.get("type"))) {
      filterChain.doFilter(request, response); // Reject unauthenticated
      return;
  }
  ```

### 3. Modulus Parameter Injection
When parsing JWKS, always force positive signum (`new BigInteger(1, decodedBytes)`) to ensure mathematical consistency with RSA specifications.

