---
name: writing-junit-tests
description: Use when writing, reviewing, or fixing JUnit 5 (Jupiter) tests in Java; setting up JUnit in Gradle or Maven; choosing assertions or @ParameterizedTest sources; using @Nested, @TempDir, or lifecycle methods; mocking with Mockito (MockitoExtension, strict stubs, mockStatic); writing Spring Boot slice tests (@WebMvcTest, @DataJpaTest, @MockitoBean); configuring JaCoCo coverage gates; or diagnosing Java tests that fail only in CI, hang, flake, or pass alone but fail in the suite.
---

# Writing JUnit 5 Tests

## Overview

JUnit 5 (Jupiter) tests are plain Java methods annotated `@Test`. Most weak suites fail for five reasons: a missing test dependency, swapped assertion arguments, copy-pasted cases that should be a table, Spring contexts loaded where a plain unit test would do, and mocks that hide design problems. Write the smallest test that proves the behaviour.

## When to Use

- Writing or reviewing tests for services, utilities, controllers, repositories, or value objects
- Setting up JUnit 5 in Gradle (Kotlin DSL) or Maven
- Mocking collaborators with Mockito, or deciding between a mock, a fake, and a real object
- Diagnosing a test that fails only in CI, hangs, flakes, or leaks state into other tests

**Not for:** browser end-to-end flows (use Playwright), JUnit 4 suites (`org.junit.Test`, `@RunWith`), or mutation and property-based testing.

## Skill Map

| File | Covers |
|---|---|
| `configuration.md` | Gradle and Maven dependencies, `junit-platform.properties`, parallel execution, `-parameters`, tag filters, JaCoCo ratio gates |
| `assertions-and-structure.md` | Assertion API and argument order, `assertAll`, `assertThrows`, BigDecimal and floating point, `@Nested`, `@DisplayName`, lifecycle, `@TempDir`, `@Timeout`, assumptions |
| `parameterized-tests.md` | `@ParameterizedTest` sources, CSV rules, argument conversion, aggregators, display names, `@RepeatedTest`, `@TestFactory`, `@ParameterizedClass` |
| `mockito.md` | `MockitoExtension`, strict stubs, stubbing and verification, argument matchers, `mockStatic`, `Clock` injection, what not to mock |
| `spring-boot-testing.md` | Slice annotations for Spring Boot 3.5, `@MockitoBean` vs deprecated `@MockBean`, `MockMvc`, `@SpringBootTest` cost, context caching |
| `what-to-test.md` | Per-layer test matrix, boundary and error-path checklist, naming, test data, coverage policy |
| `advanced-patterns.md` | Custom extensions, time and concurrency, shared state, `@ResourceLock`, environment variables, legacy characterisation tests |

## Golden Rules

1. **Check the classpath before using an API.** `@ParameterizedTest` needs `junit-jupiter-params`; `spring-boot-starter-test` brings it, bare `junit-jupiter-api` and `junit-jupiter-engine` do not. Without it, use `@TestFactory` with `DynamicTest` for a table, and ask before adding the artifact.
2. **Import only `org.junit.jupiter.api.*` (and `params`).** Never mix JUnit 4 annotations or `org.junit.Assert` into a JUnit 5 suite.
3. **Expected value first, message last in JUnit:** `assertEquals(expected, actual, "message")`. AssertJ is the reverse: `assertThat(actual).isEqualTo(expected)`. Use one assertion style per project.
4. **Turn repeated cases into a table.** Several methods that differ only in literals become one `@ParameterizedTest`.
5. **Assert exceptions with `assertThrows` and check the returned exception.** Never `try { call(); fail(); } catch`.
6. **Compare BigDecimal with `compareTo`.** `equals` is scale-sensitive: `new BigDecimal("1.0")` does not equal `new BigDecimal("1.00")`.
7. **Keep tests independent and deterministic.** No shared mutable static state, no ordering dependence, no `Thread.sleep`, no real clock. Inject `Clock` and explicit data.
8. **Prefer plain unit tests with Mockito.** Load a Spring context only when wiring is the behaviour under test. Mock interfaces you own; use real values and records.
9. **Every non-trivial unit has at least one test that fails when its logic breaks**: happy path, each branch, each error path.

## Quick Decisions

| Need | Use |
|---|---|
| Pure logic | `@Test` with `Assertions` |
| Table of inputs and expected results | `@ParameterizedTest` with `@CsvSource` or `@MethodSource` |
| Mock an interface | `@ExtendWith(MockitoExtension.class)` with `@Mock` |
| Time-dependent code | Inject `Clock`; `mockStatic` only for code you cannot change |
| Controller | `@WebMvcTest` with `@MockitoBean` and `MockMvc` |
| JPA repository | `@DataJpaTest`, Testcontainers when the database dialect matters |
| Full wiring | `@SpringBootTest`, used sparingly |

## Common Mistakes

| Rationalization | Reality |
|---|---|
| "`@ParameterizedTest` is obviously available" | It is in a separate artifact. Check `junit-jupiter-params` on the test classpath first. |
| "Five near-identical tests are clearer" | A `@CsvSource` table shows the whole boundary at once and reports each row separately. |
| "Swapping expected and actual does not matter" | Failure output inverts, so the diagnosis is misleading. JUnit takes expected first. AssertJ takes the produced value inside `assertThat(...)`. |
| "`@MockBean` still works" | Deprecated since Spring Boot 3.4 and slated for removal in 4.0. Use `@MockitoBean`. |
| "`@SpringBootTest` is more realistic" | It loads a whole context per configuration. A Mockito unit test proves the same logic in milliseconds. |
| "`Thread.sleep(100)` lets the async work finish" | Sleep is timing-dependent and flaky. Wait on a latch or future with a timeout. |
| "`mockStatic(LocalDate.class)` is the simplest fix" | It works, but hides a design problem. Inject a `Clock` when production code may change. |
| "Strict stubbing is just noise, switch it off" | `UnnecessaryStubbingException` reveals dead stubs. Remove the stub instead. |
| "`branches = 80` means 80%" | JaCoCo ratios are 0.0 to 1.0. Write `0.80`. Values outside that range are invalid. |
| "A `@Disabled` test is harmless" | Disabled tests hide regressions. Give a reason and a ticket, or delete the test. |
| "The tests compile, so they are verified" | A test that has never run is unverified. Run the suite, then read the JaCoCo gaps. |

## Red Flags

- `org.junit.Test`, `@RunWith`, or `org.junit.Assert` in a JUnit 5 file
- `Thread.sleep` in a test body
- `mockStatic` without try-with-resources (the stub leaks into other tests)
- `@SpringBootTest` on a class that a plain unit test could cover
- `static` mutable fields written by test methods
- `verifyNoMoreInteractions` on every mock (the test now pins implementation details)
- Tests that assert only "does not throw" for logic that returns a value
- Assertion-free tests added to raise coverage

**All of these mean: stop and fix the test before adding more.**

## Verification

- One class: `./gradlew test --tests "com.example.pricing.DiscountCalculatorTest"`
- One method: `./gradlew test --tests "com.example.pricing.DiscountCalculatorTest.rejectsNegativeAmount"`
- Suite plus coverage gate: `./gradlew test jacocoTestReport jacocoTestCoverageVerification`
- Results: `build/test-results/test/*.xml` and `build/reports/tests/test/index.html`
- Maven: `mvn -Dtest=DiscountCalculatorTest test` (Surefire 3.x)

Check the failure count and the skipped count, not only the exit code.

## References

Read these when a topic goes beyond the skill:

- JUnit 6.1.3 user guide (repo pins 5.14.3, so check the matching version): https://docs.junit.org/current/user-guide/
- Parameterized tests: https://docs.junit.org/current/writing-tests/parameterized-classes-and-tests.html
- Assertions: https://docs.junit.org/current/writing-tests/assertions.html
- Nested tests: https://docs.junit.org/current/writing-tests/nested-tests.html
- Configuration parameters: https://docs.junit.org/current/running-tests/configuration-parameters.html
- Mockito 5 release notes and API: https://github.com/mockito/mockito/wiki/What%27s-new-in-Mockito-5
- Spring `@MockitoBean` and `@MockitoSpyBean`: https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html
- Spring Boot test slices: https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html
- Gradle JaCoCo plugin: https://docs.gradle.org/current/userguide/jacoco_plugin.html
- JaCoCo check rules: https://www.jacoco.org/jacoco/trunk/doc/check-mojo.html

