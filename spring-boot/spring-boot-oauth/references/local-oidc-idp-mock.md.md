# Local OIDC Identity Provider Mock (Entra ID Example)

Build a small Spring Boot service that stands in for a cloud IdP (Microsoft Entra ID v2.0) so a Spring Security `oauth2Login` client can run a real authorization-code login on a developer machine. The client changes **config only**. Proven end to end against a Spring Boot 4.0.6 / Spring Security 7.0.5 client.

---

## 1. When to Build One

| Situation                                                                                                                     | Choice                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Unit tests of refresh or validation logic                                                                                     | WireMock stubs (no browser flow needed).                                      |
| Browser-driven login on a dev machine, IdP needs a corporate proxy or tenant you cannot use locally                           | Custom mock (this guide).                                                     |
| Need exact IdP claim shapes (`oid`, `roles`, `preferred_username`), JSON-file users, config-only switch, no container runtime | Custom mock (this guide).                                                     |
| Generic OIDC provider is enough and containers are allowed                                                                    | Evaluate an off-the-shelf IdP container first. Do not build what you can run. |

Scope rule: mock only the endpoints the client actually calls. Verify that (section 2) before designing anything.

---

## 2. Step 0: Derive the Real Contract (Do Not Assume)

Research from docs alone was wrong twice in practice. Read the client's own code and the **pinned** library version.

1. List client config: which of `authorization-uri`, `token-uri`, `jwk-set-uri`, `user-info-uri`, `issuer-uri` are set. No `issuer-uri` means no discovery call, so no `/.well-known/openid-configuration` is needed.
2. Grep the client for `JwtDecoderFactory`, `NimbusJwtDecoder`, `OidcUserService`, `OAuth2AccessTokenResponseClient`, `OidcIdTokenValidator`. Custom beans change the contract (see the validator-bypass trap in [oauth2-flows-and-handlers.md](oauth2-flows-and-handlers.md)).
3. List claims the client reads (user id, login, name, email, roles) and which are hard requirements.
4. Find the proxy switch and whether `no-proxy` is enforced (see [proxy-and-gateway-configuration.md](proxy-and-gateway-configuration.md)).
5. Find where the client loads config from (working directory, profile files).
6. Confirm Spring Security behaviour against the exact resolved version: read the source at the matching tag, or `javap -p` the cached jar. Record the version.
7. Dispatch one independent critique pass to re-derive the contract from primary sources before designing.

---

## 3. Verified Contract (Spring Security 7.0.5, `authorization_code`)

| Topic               | Behaviour the mock must satisfy                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PKCE                | On by default for `authorization_code` (`requireProofKey=true`), even for confidential `client_secret_post` clients. Authorize request carries `code_challenge` and `code_challenge_method=S256`. Token request carries `code_verifier`.                           |
| Nonce               | Client sends `nonce = BASE64URL(SHA256(rawNonce))`. Echo the received `nonce` parameter byte for byte into the ID token `nonce` claim. The mock never sees the raw nonce.                                                                                          |
| Token request       | `client_secret_post` sends `client_id` and `client_secret` in the form body, with no `Authorization: Basic` header. Content type `application/x-www-form-urlencoded`.                                                                                              |
| Token response      | `Content-Type: application/json`. `access_token`, `token_type=Bearer`, numeric `expires_in`, and **`id_token` is mandatory** for OIDC (missing means `invalid_id_token`). `scope` optional.                                                                        |
| JWKS                | Needs `kty`, `n`, `e`, `kid`. `x5c` and `x5t` are not required. ID token header `kid` must match a JWKS entry. Default accepted algorithm is RS256.                                                                                                                |
| Userinfo            | Called **unconditionally** when `user-info-uri` is set and the grant is `authorization_code` (no scope check). `GET` with `Authorization: Bearer`. Response must be JSON. `sub` must exist and string-equal the ID token `sub`, else `invalid_user_info_response`. |
| ID token validation | Only what the client's decoder applies. A custom decoder that skips `OidcIdTokenValidator` checks signature and `exp` only. Emit correct `iss`, `aud`, `iat`, `exp` anyway so the mock survives the client being fixed.                                            |
| Transport           | Plain `http://localhost:<port>` is accepted for all four URIs. No HTTPS assertion exists in the client path.                                                                                                                                                       |
| Claim merge         | Userinfo attributes merge with ID token claims. Keep both identical so a merge never conflicts.                                                                                                                                                                    |

---

## 4. Minimal Surface

Mirror the real IdP paths so only the host changes. Treat `{tenant}` as an unvalidated path segment.

| Endpoint                                        | Purpose                                           |
| ----------------------------------------------- | ------------------------------------------------- |
| `GET  /{tenant}/oauth2/v2.0/authorize`          | Validate request, render user picker.             |
| `POST /{tenant}/oauth2/v2.0/authorize/complete` | Re-validate, issue code, `302` to `redirect_uri`. |
| `POST /{tenant}/oauth2/v2.0/token`              | Code exchange.                                    |
| `GET  /{tenant}/discovery/v2.0/keys`            | JWKS.                                             |
| `GET  /oidc/userinfo`                           | Claims for the Bearer token.                      |

Non-goals (client never calls them): discovery document, refresh tokens, logout, Graph, `client_secret_basic`, group claims. Add only when a verified client call needs them.

### Validation order (security-relevant)

Authorize (`GET` and the picker `POST`, defence in depth):
1. `client_id` equals the configured client. Else `400` HTML page, **never redirect** (target not yet trusted).
2. `redirect_uri` exactly matches one configured URI. Else `400` HTML page, never redirect.
3. `response_type=code`. Else `302` to `redirect_uri?error=unsupported_response_type&state=...`.
4. `code_challenge_method=S256` and `code_challenge` present. Else `302` with `error=invalid_request`.
5. (`POST` only) selected user exists. Else `400`.

Token (status `400` unless noted, body `{"error","error_description"}`, `Cache-Control: no-store`):
1. `grant_type=authorization_code`. Else `unsupported_grant_type`.
2. `client_id` and `client_secret` match. Else `invalid_client` with `401`.
3. **Only then** redeem the code (atomic remove, single use). Else `invalid_grant`.
4. `redirect_uri` equals the one stored with the code. Else `invalid_grant`.
5. `code_verifier` passes PKCE. Else `invalid_grant`.

Authenticating the client **before** redeeming the code matters: otherwise a caller with a bad secret burns a valid code and the real client fails with `invalid_grant`. Keep a regression test for it.

Userinfo: missing or malformed Bearer, unknown or expired token, or deleted user returns `401` with `WWW-Authenticate: Bearer error="invalid_token"`. Parse the scheme case-insensitively and tolerate extra whitespace.

---

## 5. Tokens

- **ID token**: header `{typ: JWT, alg: RS256, kid}`. Claims `iss` (request base URL + `/{tenant}/v2.0`, derived per request, not configured), `aud` (client id), `sub` and `oid` (same user id), `tid` (tenant segment), `ver: "2.0"`, `iat`, `exp`, `nonce` (echoed), `preferred_username`, `upn`, optional `name`, `email`.
- **`roles`**: array of strings, **omit the claim when the user has none** (real Entra omits it). Never emit `[]`.
- **Access token**: opaque random string held in an in-memory map with a TTL. The client only forwards it to userinfo, so a signed JWT adds code for no verifier.
- **Signing key**: RSA-2048 generated in memory at startup with a random `kid` (Nimbus `RSAKeyGenerator`). A restart rotates it. The client refetches JWKS on an unknown `kid`. Mark with a `ponytail:` comment (ceiling: single instance, upgrade: persisted key).

```java
JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
    .issuer(issuer).audience(clientId).subject(user.oid()).claim("oid", user.oid())
    .claim("tid", tenant).claim("ver", "2.0")
    .issueTime(Date.from(now)).expirationTime(Date.from(now.plus(ttl)))
    .claim("nonce", nonce)
    .claim("preferred_username", user.preferredUsername());
if (!user.roles().isEmpty()) claims.claim("roles", user.roles());
SignedJWT jwt = new SignedJWT(
    new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(signingKey.getKeyID()).build(), claims.build());
jwt.sign(new RSASSASigner(signingKey));
// JWKS: Map.of("keys", List.of(signingKey.toPublicJWK().toJSONObject()))
```

PKCE check (constant-time compare, US-ASCII input):

```java
String computed = Base64.getUrlEncoder().withoutPadding()
    .encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(US_ASCII)));
return MessageDigest.isEqual(computed.getBytes(US_ASCII), challenge.getBytes(US_ASCII));
```

---

## 6. Users and Picker

- Users live in a hand-edited JSON array. Use the IdP's claim names as keys: `oid` (required, unique, non-blank), `preferred_username` (required), `name`, `email`, `roles` (optional string array, defaults to empty).
- Re-read and re-validate the file on every request that needs users, so edits apply without restart. On a missing file, bad JSON, duplicate `oid`, or missing `preferred_username`, throw an unchecked exception whose message names the file path and the problem. Set `server.error.include-message: always` so the developer sees it. No controller advice needed.
- Picker page: one `<form method="post">` per user, carrying the validated authorize parameters as hidden inputs plus the selected user id. Re-validate everything on submit. Escape every user-controlled value with `HtmlUtils.htmlEscape` in **both** text and attribute contexts. Build redirects with `UriComponentsBuilder` so `state` and `redirect_uri` are percent-encoded.
- Bind to `127.0.0.1` (`server.address`). One configured client (id, secret, exact redirect URI list) with env-var override. The secret is a fake, dev-only value.

---

## 7. Project Layout (9 Classes, 5 Test Files)

```
idp-mock/
  settings.gradle.kts, build.gradle.kts, gradlew*, gradle/wrapper/   (copied from the client project)
  users.json                      sample users: admin, viewer, multi-app, no roles
  src/main/java/.../
    IdpMockApplication            main + Clock bean
    IdpMockProperties             @ConfigurationProperties: client, redirect URIs, users file, TTLs
    MockUser                      record: oid, preferredUsername, name, email, roles
    MockUserStore                 read + validate users.json per call (nested exception)
    TokenStore                    codes + opaque access tokens, Clock-driven TTL, nested PendingAuthorization
    Pkce                          S256 verify
    IdTokenIssuer                 owns RSA key, signs ID tokens, returns JWKS map
    AuthorizeController           browser-facing HTML (picker + complete)
    TokenController               JSON back channel (token, keys, userinfo)
  src/main/resources/application.yaml
```

Two controllers, not one: HTML rendering and the JSON back channel are different concerns. No interfaces, no error-helper class, no controller advice. Everything lives in memory (`ponytail:` comment: restart clears codes and tokens).

### Gradle and Spring Boot 4 traps

- Same Java, Boot and Gradle wrapper versions as the client. Copy the repository blocks and credential pattern (`findProperty("nexusUsername") ?: System.getenv(...)`) from the client build. Copy the wrapper trio (`gradlew`, `gradlew.bat`, `gradle/wrapper/*`).
- **The Boot BOM does not manage `nimbus-jose-jwt` directly.** Pin it to the version the client resolves transitively (`dependencyInsight --dependency nimbus-jose-jwt`), with a `ponytail:` comment.
- Starters: `spring-boot-starter-webmvc` (main), `spring-boot-starter-test` and `spring-boot-starter-webmvc-test` (test). Add `spring-security-oauth2-jose` as **test** scope only, so the end-to-end test decodes with `NimbusJwtDecoder.withJwkSetUri(...)`, the same decoder the client uses. No Spring Security or database on the main classpath.
- Jackson 3: packages are `tools.jackson.*`. `JacksonException` extends `RuntimeException`, so `catch (IOException)` around `readValue` misses parse errors.
- MockMvc auto-config packages moved in Boot 4. Confirm class names with `unzip -l` or `javap` on the resolved jar before writing imports.
- Overriding the production `Clock` bean in a `@TestConfiguration`: give the test `@Bean` a different method name and mark it `@Primary`. The same name throws `BeanDefinitionOverrideException` (overriding is off by default in Boot 4).

---

## 8. Wiring the Client (Config Only)

Create a profile file next to the client's base `application.yaml`. It overrides only the keys it sets.

```yaml
# application-idp-mock.yaml
spring:
  security:
    oauth2:
      client:
        registration:
          azure:
            client-id: mock-client-id
            client-secret: mock-client-secret
        provider:
          azure:
            authorization-uri: http://localhost:9099/mock-tenant/oauth2/v2.0/authorize
            token-uri: http://localhost:9099/mock-tenant/oauth2/v2.0/token
            jwk-set-uri: http://localhost:9099/mock-tenant/discovery/v2.0/keys
            user-info-uri: http://localhost:9099/oidc/userinfo
spring-boot:
  proxy:
    host:          # blank: the client's no-proxy list may not be enforced
```

- Activate with `SPRING_PROFILES_ACTIVE=idp-mock`, or set `spring.profiles.active` in the base file for a dev-default. Keep a backup of the original.
- Use `localhost` in every URL (provider URIs, mock redirect allow-list, browser). `127.0.0.1` and `localhost` are different origins, and `{baseUrl}` in `redirect-uri` expands from whichever host the browser used to reach the client. If you use both, allow both callback URIs.
- Check that the client's frontend-URL property is bound under the name the code reads (a singular/plural mismatch such as `frontend.url` vs `frontend.urls` leaves the list null and breaks the post-login redirect). Set the correct key in the profile file.
- Start order: mock first, then client, then frontend.

---

## 9. TDD Plan

Write the test, see it fail, then implement. Control time with an injected `Clock`, never `sleep`.

| Class                                          | Key assertions                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PkceTest`                                     | correct verifier passes, wrong verifier fails, null input fails                                                                                                                                                                                                                  |
| `MockUserStoreTest`                            | valid file loads, duplicate `oid`, missing `preferred_username`, missing file, invalid JSON, omitted roles default to empty, edit then re-read without restart                                                                                                                   |
| `AuthorizeControllerTest`                      | picker lists users, bad client and bad redirect return `400` with no `Location`, missing PKCE redirects with `invalid_request`, `plain` method rejected, `<script>` name escaped in text and attribute context, unknown user `400`, `state` with special characters is encoded   |
| `TokenControllerTest`                          | happy path, wrong verifier, replayed code, expired code, wrong secret `401`, **bad secret does not burn the code**, redirect mismatch, error body has `error_description`, userinfo `401` cases (missing, `Basic`, empty Bearer, garbage, expired), lower-case `bearer` accepted |
| `EndToEndLoginTest` (`RANDOM_PORT`, real HTTP) | authorize, complete, token, decode ID token via JWKS with `NimbusJwtDecoder`, `kid` match, nonce echo, `iss` equals the request base URL, userinfo `sub` equals ID token `sub`, roles present, roles omitted for a no-role user                                                  |

---

## 10. Manual Verification (curl)

```bash
VERIFIER=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-64)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 | tr '+/' '-_' | tr -d '=')
B=http://localhost:9099/mock-tenant; R=http://localhost:8081/login/oauth2/code/azure

# 1. picker (expect 200 HTML listing users)
curl -s "$B/oauth2/v2.0/authorize?client_id=mock-client-id&response_type=code&redirect_uri=$R&scope=openid+profile+email&state=xyz&nonce=abc&code_challenge=$CHALLENGE&code_challenge_method=S256"

# 2. complete (expect 302, Location has code and state)
curl -si -X POST "$B/oauth2/v2.0/authorize/complete" -d client_id=mock-client-id -d redirect_uri=$R \
  -d response_type=code -d state=xyz -d nonce=abc -d code_challenge=$CHALLENGE \
  -d code_challenge_method=S256 -d selected_oid=<oid>

# 3. token: bad secret first with a FRESH code (expect 401), then good secret with the SAME code (expect 200)
curl -s -X POST "$B/oauth2/v2.0/token" -d grant_type=authorization_code -d code=$CODE \
  -d redirect_uri=$R -d code_verifier=$VERIFIER -d client_id=mock-client-id -d client_secret=$SECRET
```

Then check: replayed code gives `400 invalid_grant`, wrong verifier gives `400 invalid_grant`, JWKS `kid` equals the ID token header `kid` (decode with `cut -d. -f1 | base64 -d`), userinfo `sub` equals the ID token `sub`, userinfo without a token gives `401` with `WWW-Authenticate`.

Full end-to-end with the real client (cookie jar):
1. `GET http://localhost:8081/oauth2/authorization/azure` returns `302` to the mock authorize URL. Record which params Spring sent.
2. Open the authorize URL on the mock, post the picker form for a user with roles. Expect `302` to `.../login/oauth2/code/azure?code=...&state=...`.
3. `GET` that callback with the cookie jar. Expect `302` to the frontend and the client's own auth cookies.
4. Call the client's status endpoint with the cookies. Confirm id, login, name, email and roles match `users.json`.
5. Stop only the processes you started, then confirm both ports are free.

Windows Git Bash: `taskkill /F /PID n` is mangled by path conversion. Use `MSYS_NO_PATHCONV=1 taskkill /F /T /PID n`. Do not route it through `cmd.exe /c "..."`.

---

## 11. Pitfalls

| Symptom                                           | Cause and fix                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Authorize page returns `400 invalid_redirect_uri` | Browser reached the client on `127.0.0.1` but the allow-list has `localhost`. Use one host or allow both.       |
| Login succeeds, then redirects to `/` or fails    | Frontend URL property bound under the wrong name. Fix in the profile file.                                      |
| Client cannot reach the mock but curl can         | Proxy host still set and `no-proxy` not enforced. Blank the proxy host in the mock profile.                     |
| `invalid_user_info_response`                      | Userinfo `sub` differs from ID token `sub`, or response is not JSON.                                            |
| `invalid_nonce`                                   | Mock modified the nonce. Echo the received parameter unchanged.                                                 |
| `invalid_id_token: Missing (required) ID Token`   | Token response lacks `id_token`.                                                                                |
| `kid` lookup fails after a mock restart           | Client cached the old JWKS. Retry the login, or restart the client.                                             |
| Real code burned unexpectedly                     | Token endpoint redeemed the code before authenticating the client. Reorder (section 4).                         |
| Mock cannot resolve dependencies                  | Nexus credentials missing. Check `nexusUsername`/`nexusPassword` or env vars for existence, never print values. |

