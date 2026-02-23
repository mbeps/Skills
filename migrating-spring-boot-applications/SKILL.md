---
skill: migrating-spring-boot-applications
version: 1.0.0
framework_baseline: Spring Boot 4.0
runtime_baseline: Java 17+
primary_focus: Architectural Modernization & Modularization
---

# Skill Document: Migrating Spring Boot Applications

## 1. Quick Start

The `migrating-spring-boot-applications` skill orchestrates the exhaustive architectural modernisation of enterprise Java codebases, systematically transitioning them from the **Spring Boot 3.x** ecosystem to the **Spring Boot 4.0** standard. This capability is invoked when applications must align with the **Spring Framework 7.0** and **Jakarta EE 11** baselines, capitalising on next-generation JVM features, enhanced telemetry, and stringent modularity constraints.

The underlying trend driving this major framework release is a structural shift away from massive, monolithic auto-configuration towards **highly granular, focused modules**. This paradigm reduces classpath noise, dramatically accelerates **Ahead-of-Time (AOT)** compilation, and minimises memory footprints in cloud-native deployments by ensuring only explicitly declared capabilities are provisioned at runtime. 

The agent navigates this complex transition by:
* Enforcing **Java 17** minimums while optimising for **Java 21 or Java 25** virtual threads.
* Dismantling legacy monolithic dependencies.
* Resolving the deprecation of foundational testing utilities.
* Implementing native framework enhancements for API versioning and declarative HTTP clients.

By executing deterministic refactoring recipes, the skill guarantees a structurally sound migration that preserves application behaviour while integrating advanced observability via **Micrometer 2** and **OpenTelemetry**. The operational scope includes the modification of build toolchains, the harmonisation of core and test starters, the adaptation of security serialisation protocols, and the activation of build-time query parsing for data repositories. The agent processes these systemic upgrades incrementally, bridging the codebase through the terminal **Spring Boot 3.5.x** releases to clear legacy deprecations before enforcing the strict, unyielding structural boundaries of the 4.0 architecture.

---

## 2. Instructions

The agent must execute the following sequential, actionable steps to ensure a structurally sound and format-preserving migration across the entire enterprise application suite.

1.  **Execute Baseline Environment Validation:** The agent must analyse the build environment and enforce **Java 17** as the absolute minimum tolerated runtime, failing the migration if older JVM instances are detected. The agent must update build toolchain configurations, modifying Gradle wrappers to version **8.14 (or explicitly 9.x)** or upgrading Apache Maven configurations to version **3.6.3 or higher** to ensure compatibility with the updated compilation plugins. If the deployment environment permits, the agent must update compiler targets to **Java 21 or Java 25** to capitalise on Project Loom's virtual threads and advanced JVM memory management.
2.  **Orchestrate the Transitional Bridge:** Prior to altering Spring Boot 4.0 parameters, the agent must update the project's parent POM or Gradle build script to the latest **Spring Boot 3.5.x** release to establish a stable transitional baseline. The agent must execute a compilation pass to identify and resolve any intermediate deprecation warnings, systematically purging legacy embedded server utilities, outdated MVC/WebFlux message conversion paths, and lingering `WebSecurityConfigurerAdapter` references.
3.  **Dismantle Monolithic Auto-Configuration:** The agent must scan the build manifests to detect implicit dependencies formerly provided by the massive `spring-boot-autoconfigure` artefact, which has been conceptually unpacked into highly specific modules. The agent must inject targeted, domain-specific modular starters conforming to the `spring-boot-starter-<technology>` naming convention. If H2 database configurations are detected, the agent must explicitly insert the `spring-boot-h2console` dependency, as the newly isolated `spring-boot-starter-webmvc` module no longer provisions it automatically.
4.  **Harmonise Test Infrastructure Companions:** For every technology starter identified in the application, the agent must verify the presence of its corresponding test starter companion, ensuring that the test infrastructure relies on strict module boundaries rather than transitive legacy assumptions. The agent must append the `-test` suffix to corresponding starters; for example, if Spring WebMVC or Spring Security test utilities are detected, the agent must inject `spring-boot-starter-webmvc-test` or `spring-boot-starter-security-test` respectively.
5.  **Eradicate Deprecated Mocking Utilities:** The agent must traverse the test directory architecture, systematically identifying and eradicating `@MockBean` and `@SpyBean` annotations which have been permanently removed from the `spring-boot-test` module. The agent must replace these legacy components with `@MockitoBean` and `@MockitoSpyBean`, updating import statements to target the core `spring-test` framework module, while concurrently purging all residual **JUnit 4** dependencies to align with the strict **JUnit Jupiter 6** baseline.
6.  **Implement Native API Versioning:** The agent must identify legacy custom API versioning implementations, such as manual header parsing configurations or custom URI prefixing, and refactor them to utilise **Spring Framework 7's native versioning capabilities**. The agent must decorate controller methods with `@GetMapping(version = "1")` attributes and configure the application properties, assigning detection strategies via the `spring.mvc.apiversion.*` or `spring.webflux.apiversion.*` configuration keys.
7.  **Embed Declarative Resilience Mechanisms:** The agent must scan for boilerplate programmatic retries or external resilience library annotations and replace them with native Spring Framework 7 mechanisms. The agent must apply the `@Retryable` and `@ConcurrencyLimit` annotations directly to vulnerable service methods, configuring the thresholds to shield downstream microservices and database connection pools from the radical throughput increases generated by virtual thread saturation.
8.  **Upgrade Security Serialization Protocols:** For applications leveraging **Spring Security 7.0**, the agent must execute the transition from **Jackson 2 to Jackson 3** within the security configuration to satisfy the new default persistence strategies. The agent must replace `SecurityJackson2Modules` implementations with `SecurityJacksonModules` utilising the `JsonMapper.Builder` architecture, ensuring that the `PolymorphicTypeValidator` is correctly registered to maintain dynamic class detection and defend against deserialization vulnerabilities.
9.  **Activate Ahead-of-Time Repositories:** To drastically reduce application startup latency and memory consumption, the agent must configure the property `spring.aot.repositories.enabled=true` within the application environment. The agent must verify that the underlying data stores are compatible (specifically **JPA via Hibernate or MongoDB**) so the infrastructure can convert repository queries into highly optimised, reflection-free source code during the GraalVM native image compilation phase.

---

## 3. Examples

### Refactoring Test Infrastructure for Modularisation
The agent refactors test classes to accommodate the deprecation of Spring Boot's legacy mocking utilities and the removal of reactive-dependent testing facades for synchronous applications.

**Input Environment (Spring Boot 3.4.x):**
```java
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class UserAuthenticationTests {
    @MockBean
    private AuthenticationService authService;
    @Autowired
    private WebTestClient webClient;

    @Test
    void shouldAuthenticateUser() {
        webClient.get().uri("/api/auth").exchange().expectStatus().isOk();
    }
}

```

**Output Environment (Spring Boot 4.0):**

```java
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.client.RestTestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class UserAuthenticationTests {
    @MockitoBean
    private AuthenticationService authService;
    private RestTestClient client;

    @BeforeEach
    void setUp(WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
    }

    @Test
    void shouldAuthenticateUser() {
        client.get().uri("/api/auth").exchange().expectStatus().isOk();
    }
}

```

### Implementing Native API Versioning and HTTP Clients

The agent standardises endpoint versioning, shifting from manual request mapping headers to the native Spring Framework 7 paradigm, and replaces manual `RestTemplate` usage with declarative service interfaces.

**Input Environment (Spring Boot 3.x):**

```java
// Controller
@RestController
@RequestMapping("/api/greetings")
public class GreetingController {
    @GetMapping(headers = "API-Version=1")
    public String getGreetingV1() { return "Hello World"; }
}

// Client Invocation
@Service
public class GreetingInvoker {
    private final RestTemplate restTemplate = new RestTemplate();
    public String fetch() {
        return restTemplate.getForObject("http://service/api/greetings", String.class);
    }
}

```

**Output Environment (Spring Boot 4.0):**

```java
// Controller
@RestController
@RequestMapping("/api/greetings")
public class GreetingController {
    @GetMapping(version = "1")
    public String getGreetingV1() { return "Hello World"; }
}

// Declarative Client Configuration
@HttpServiceClient("greetingService")
public interface GreetingClient {
    @GetExchange("/api/greetings")
    @Retryable(maxAttempts = 3, delay = 100)
    @ConcurrencyLimit(3)
    String fetch();
}

```

---

## 4. Workflows

The agent manages the migration through deterministic, multi-phase workflows that sequentially address environment baselines, architectural modularisation, testing parity, and performance optimisations.

### Phase 1: Transitional Bridging and Deprecation Purging

The agent initiates the migration by establishing a stable transitional state, recognising that moving directly from Spring Boot 3.2 or 3.3 to 4.0 risks catastrophic dependency resolution failures due to the sheer volume of deprecated APIs that are entirely removed in the major release. The workflow modifies the project manifest to inherit from **Spring Boot 3.5.x**, triggering a compilation pass to identify deprecated configuration keys across actuator, security, web, data, and messaging modules. The agent systematically replaces these outdated configurations with their 3.5.x equivalents. For instance, it purges legacy embedded server utilities and replaces obsolete MVC and WebFlux message conversion paths before attempting the shift to Spring Framework 7. The test suite is subsequently executed; a clean build at this stage guarantees that the codebase relies solely on active, supported APIs, laying the necessary groundwork for the structural modularisation required by version 4.0.

### Phase 2: Architectural Modularisation and Classpath Alignment

This workflow addresses the dismantling of the legacy `spring-boot-autoconfigure` monolith. The historical architecture bundled configuration logic for every supported technology into a singular artefact, which introduced severe classpath noise, bloated memory footprints, and complicated GraalVM native image compilation. The agent updates the parent artefact version to **4.0.0** and performs a semantic analysis of the codebase to identify active technologies. The agent systematically replaces raw dependencies with granular modular starters, injecting `spring-boot-starter-webmvc`, `spring-boot-starter-graphql`, or `spring-boot-starter-amqp` solely where required.

> **Crucial Step:** The workflow enforces a strict companion pairing methodology for test dependencies; for every main starter injected, the agent provisions its corresponding test companion (e.g., `spring-boot-starter-webmvc-test`) to ensure the isolated test infrastructure functions correctly without throwing `ClassNotFoundException` anomalies.

The workflow also addresses cross-module metadata generation by applying the `@ConfigurationPropertiesSource` annotation to types located in external modules, guaranteeing complete metadata generation during the build phase.

### Phase 3: Security, Telemetry, and Resilience Modernisation

The final active refactoring workflow modernises the application's peripheral infrastructure, aligning telemetry, fault-tolerance mechanisms, and security serialization with the **Micrometer 2**, **Project Loom**, and **Jackson 3** paradigms. The agent upgrades distributed tracing capabilities by injecting the `spring-boot-starter-opentelemetry` module, configuring the auto-configured OpenTelemetry SDK to export metrics and traces seamlessly over the OTLP protocol without external sidecar reliance.

The workflow then evaluates external resilience implementations, such as programmatic backoff loops or third-party circuit breakers, and systematically deprecates these dependencies. It replaces them with the native `@ConcurrencyLimit` and `@Retryable` annotations provided by Spring Framework 7.0. By setting concurrency limits directly on service methods, the agent ensures that the radically increased throughput generated by virtual threads does not overwhelm downstream microservices. Finally, the agent modifies Actuator endpoints to accommodate the new SSL Health configurations, verifying that certificates nearing expiration are properly evaluated under the new `expiringChains` key rather than triggering false positive alerts via the deprecated `WILL_EXPIRE_SOON` status.

---

## 5. Edge Cases

The agent is programmed to detect and gracefully resolve complex architectural anomalies that deviate from standard migration patterns, utilising escape hatches and explicit overrides where necessary.

| Anomaly Trigger | Detection Mechanism | Agent Resolution Protocol |
| --- | --- | --- |
| **Complex Mocking Topologies** | The agent detects a `@MockitoBean` or `@MockitoSpyBean` annotation applied directly to a class annotated with `@Configuration` or `@Component`. | The core `spring-test` framework strictly prohibits this structural pattern. The agent will automatically extract the mocked dependency into an independent standard test configuration class. |
| **H2 Console Disappearance** | The agent parses database configuration files indicating H2 usage, but the application deployment manifests a 404 error at the `/h2-console` endpoint. | The granularisation of the web starter removes implicit console provisioning. The agent must explicitly append the `spring-boot-h2console` dependency to the build manifest. |
| **Extreme Classpath Fragmentation** | The application exhibits widespread, cascading `ClassNotFoundException` errors immediately following the 4.0 upgrade. | The agent will inject the `spring-boot-starter-classic` dependency (and its companion `spring-boot-starter-test-classic`). This acts as a temporary architectural escape hatch, restoring monolithic behavior. |
| **Legacy Serialization Conflicts** | The security module fails during deserialization, citing missing polymorphic type validators, or integration contracts demand Jackson 2 format retention. | The agent will modify the build file to explicitly exclude the transitive `tools.jackson.core:jackson-databind` dependency and manually inject the Jackson 2 engine to preserve legacy contracts. |
| **AOT Compilation Failures** | The application fails to start when `spring.aot.repositories.enabled` is set to true, specifically when utilising unsupported or proprietary data stores. | AOT repository generation is initially restricted to JPA and MongoDB. If unsupported variants (e.g., R2DBC) are detected, the agent will programmatically bypass the AOT code generation logic for those interfaces. |

---

## 6. References

* [What's New in Spring Boot 4.0](https://medium.com/@AlexanderObregon/whats-new-in-spring-boot-4-0-2c2e7028b312)
* [Baeldung: Spring Boot 4 & Spring Framework 7](https://www.baeldung.com/spring-boot-4-spring-framework-7)
* [Spring Boot 4.0 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Release-Notes)
* [Spring Boot 4.0.0 Available Now](https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now/)
* [Spring Projects: Spring Boot](https://spring.io/projects/spring-boot/)
* [Reddit: Suitable SpringBoot Version for Migration](https://www.reddit.com/r/SpringBoot/comments/1pc59az/suitable_springboot_version_for_migration/)
* [YouTube: Spring Boot 4 Deep Dive](https://www.youtube.com/watch?v=sdp4-wMx92w)
* [Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
* [Moderne: Spring Boot 4.x Migration Guide](https://www.moderne.ai/blog/spring-boot-4x-migration-guide)
* [Spring Integration 3.0 to 4.0 Changes](https://docs.spring.io/spring-integration/reference/changes-3.0-4.0.html)
* [Reddit: Migration Guide to Spring Boot 4](https://www.reddit.com/r/SpringBoot/comments/1p5d42q/migration_guide_to_spring_boot_4/)
* [YouTube: Future of Spring Framework 7](https://www.youtube.com/watch?v=kTLuhE7_jGU)
* [CodingShuttle: Spring Boot 4 Complete Guide](https://www.codingshuttle.com/blogs/spring-boot-4-a-complete-guide-to-new-features-improvements-and-why-you-should-upgrade/)
* [Spring Boot System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)
* [StackOverflow: Cannot find MockBean in Spring Boot 4.0.0](https://stackoverflow.com/questions/79828472/cannot-find-mockbean-in-spring-boot-4-0-0)
* [OpenRewrite: Replace MockBean and SpyBean](https://docs.openrewrite.org/recipes/java/spring/boot4/replacemockbeanandspybean)
* [Alexis Segura: Spring Boot MockBean Farewell](https://www.alexis-segura.com/notes/spring-boot-mockbean-and-spybean-are-saying-goodbye/)
* [StackOverflow: Replacement for Deprecated MockBeans](https://stackoverflow.com/questions/79243535/what-is-the-replacement-for-the-deprecated-mockbeans-in-springboot-3-4-0)
* [Spring Security Migration Index](https://docs.spring.io/spring-security/reference/migration/index.html)
* [Spring Integration 6.x to 7.0 Migration Guide](https://github.com/spring-projects/spring-integration/wiki/Spring-Integration-6.x-to-7.0-Migration-Guide)
* [Spring Security 7 Migration Guide](https://docs.spring.io/spring-security/reference/6.5/migration-7/index.html)
* [StackOverflow: Migrating to Spring 6.x/7.x Security](https://stackoverflow.com/questions/77150849/migrating-to-sping-6-x-how-to-best-migrate-the-spring-securityconfiguration-for)
* [HeroDevs: The Full Cost of Migrating Spring Framework](https://www.herodevs.com/blog-posts/spring-framework-6-the-full-cost-of-migrating-from-v5-to-v6)
* [Spring Blog: Modularizing Spring Boot](https://spring.io/blog/2025/10/28/modularizing-spring-boot/)
* [Spring Boot 3.2.5 Reference Docs](https://docs.spring.io/spring-boot/docs/3.2.5/reference/htmlsingle/)
* [Baeldung: Spring Boot H2 Database](https://www.baeldung.com/spring-boot-h2-database)
* [StackOverflow: Spring H2 Console not opening](https://stackoverflow.com/questions/79795904/spring-h2-console-not-opening-on-my-browser)
* [Medium: H2 Console Not Working in Spring Boot 4.0.0](https://medium.com/@raushan1156/h2-console-not-working-in-spring-boot-4-0-0-7873e20c82d5)
* [Maven Repository: Spring Boot H2 Console 4.0.0](https://mvnrepository.com/artifact/org.springframework.boot/spring-boot-h2console/4.0.0-M1)
* [Spring Boot Dependency Versions Appendix](https://docs.spring.io/spring-boot/appendix/dependency-versions/index.html)
* [Disqus: Spring Boot 4 Discussion](http://disq.us/p/30iomjg)
* [Spring Blog: Spring Data Ahead-of-Time Repositories](https://spring.io/blog/2025/05/22/spring-data-ahead-of-time-repositories)
* [Baeldung: Spring Boot 3 Observability](https://www.baeldung.com/spring-boot-3-observability)
* [Spring Framework 7.0 MVC API Versioning](https://docs.spring.io/spring-framework/reference/7.0-SNAPSHOT/web/webmvc/mvc-config/api-version.html)
* [Spring Framework 7.0 Testing: RestTestClient](https://www.google.com/search?q=https://docs.spring.io/spring-framework/reference/7.0-SNAPSHOT/testing/resttestclient.html/spring-6-http-interface%23client-proxy)
* [Baeldung: Spring Retry Guide](https://www.baeldung.com/spring-retry)
* [Baeldung Membership](https://www.baeldung.com/members/)
