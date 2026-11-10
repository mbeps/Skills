# Spring Boot Testing (3.5.x)

The package names below are for Spring Boot 3.x. Spring Boot 4.x moved slice annotations into per-module packages (for example `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`). Check the import against the version in use.

## Pick the smallest context

| Layer            | Annotation                            | Loads                                                         | Notes                                                       |
| ---------------- | ------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Plain service    | none (Mockito only)                   | nothing                                                       | Default. Use `@ExtendWith(MockitoExtension.class)`.         |
| Web MVC          | `@WebMvcTest(ReportController.class)` | MVC infrastructure, the named controller, `@ControllerAdvice` | Autowire `MockMvc`. Mock every service with `@MockitoBean`. |
| JSON             | `@JsonTest`                           | Jackson, `JacksonTester`                                      | Serialisation contracts.                                    |
| JPA              | `@DataJpaTest`                        | JPA, repositories, embedded database                          | Transactional, rolls back per test.                         |
| Full application | `@SpringBootTest`                     | Everything                                                    | Slow. Use for wiring and end-to-end checks only.            |

Imports for Spring Boot 3.5:

- `org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest`
- `org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest`
- `org.springframework.boot.test.autoconfigure.json.JsonTest`

## Mocking beans: `@MockitoBean`

`@MockitoBean` (`org.springframework.test.context.bean.override.mockito.MockitoBean`, Spring Framework 6.2+) replaces the bean of that type in the test context. Spring Boot 3.4 deprecated `@MockBean` and `@SpyBean` in favour of `@MockitoBean` and `@MockitoSpyBean`, and they are slated for removal in 4.0. Use the new annotations.

```java
@WebMvcTest(ReportController.class)
class ReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReportService reports;

    @Test
    void returnsNotFoundWhenReportMissing() throws Exception {
        when(reports.find(7L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/reports/7"))
                .andExpect(status().isNotFound());
    }
}
```

Notes:

- `@WebMvcTest` finds the `@SpringBootApplication` class by searching up the package tree. Keep the test in a sub-package of the application class.
- Test slices do not load `@Configuration` classes found by scanning. Register extra web beans with `@Import` on the test, or as `@Component`.
- `@MockitoSpyBean` wraps the real bean. Use it only when the real behaviour matters for part of the test.
- If Spring Security is on the classpath, `@WebMvcTest` loads its configuration. Authenticate with `@WithMockUser` (from `spring-security-test`) or request post-processors.
- Without `spring-security-test`, `@WithMockUser` is unavailable. `@AuthenticationPrincipal` resolves from `SecurityContextHolder`: set an `Authentication` there and clear it in `@AfterEach`. A standalone `MockMvc` with no authentication passes `null`.

## Assertion style for MockMvc

MockMvc works with `status()`, `content()`, and `jsonPath()` matchers. Keep one behaviour per test. Check the status and body together.

```java
mockMvc.perform(get("/reports/42"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Q1 Licence Review"))
        .andExpect(jsonPath("$.createdOn").doesNotExist());
```

## JPA repositories

`@DataJpaTest` uses an embedded database and rolls back after each test.

- Test custom queries, constraints, and ordering. Do not test Spring Data's generated `save` or `findById`.
- When the SQL dialect matters (Postgres functions, JSON types), use Testcontainers with `@ServiceConnection` on the container. From Spring Boot 3.4, `@AutoConfigureTestDatabase` detects container-backed databases, so `replace = Replace.NONE` is usually unnecessary. Confirm on the version in use.
- Test data: `TestEntityManager` (auto-configured in `@DataJpaTest`) or the repository itself.

## `@SpringBootTest`

- Loads the whole application context. The context is cached by its configuration, so tests with the same config share one context.
- Any change in `@MockitoBean` set, `properties`, `@Import`, or profiles creates a new context. Each one costs seconds. Keep the number of distinct configurations small.
- `@DirtiesContext` discards the cached context. Use it only when a test truly mutates shared context state, and prefer fixing that state instead.
- `webEnvironment = MOCK` (default) runs without a server. `RANDOM_PORT` starts a real server for HTTP tests.
- Nested `@TestConfiguration` adds beans without replacing the application's configuration.
- Add properties per test with `@SpringBootTest(properties = "feature.flag=true")` or `@TestPropertySource`.

Do not use `@SpringBootTest` to obtain an instance you can construct yourself.

## Common failures

| Symptom                                    | Cause                                                        | Fix                                                                     |
| ------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `NoSuchBeanDefinitionException` in a slice | The slice does not load services.                            | `@MockitoBean` the dependency, or `@Import` the real class.             |
| Custom `WebMvcConfigurer` ignored          | It is in a `@Configuration` class, which slices skip.        | Use `@Import` or annotate with `@Component`.                            |
| `@WebMvcTest` cannot find configuration    | Test is outside the application's package tree.              | Move the test under the application package.                            |
| Context reloads for every test class       | Each class has a different `@MockitoBean` set or properties. | Share a base class with common configuration.                           |
| Test passes alone, fails in suite          | Shared context state or a leaked static mock.                | Reset the state in `@BeforeEach` or `@AfterEach`; close `MockedStatic`. |
| NPE in `MockPropertySource.setProperty`    | `MockEnvironment.withProperty(key, null)`                    | Omit the key to test the missing case.                                  |

## Sources

- Spring Boot testing: https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html
- `@MockitoBean` and `@MockitoSpyBean`: https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html

