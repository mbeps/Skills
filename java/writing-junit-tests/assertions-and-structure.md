# Assertions and Test Structure

## Assertions

All assertions are static methods on `org.junit.jupiter.api.Assertions`.

| Need                         | Use                                                | Note                                                                                                           |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Equality                     | `assertEquals(expected, actual, "message")`        | Expected first. Message last.                                                                                  |
| Lazy message                 | `assertEquals(a, b, () -> "built " + x)`           | Supplier evaluated only on failure.                                                                            |
| Floating point               | `assertEquals(0.3, actual, 1e-9)`                  | Third argument is a delta. Never compare doubles with exact equality.                                          |
| BigDecimal                   | `assertEquals(0, expected.compareTo(actual))`      | `equals` is scale-sensitive.                                                                                   |
| Null checks                  | `assertNull(x)`, `assertNotNull(x, "msg")`         |                                                                                                                |
| Exception type and message   | `assertThrows(T.class, () -> ...)`                 | Returns the exception. Assert its message or cause.                                                            |
| No exception                 | `assertDoesNotThrow(() -> ...)`                    | Overload with a supplier returns the value.                                                                    |
| Several checks, all reported | `assertAll("name", () -> ..., () -> ...)`          | Every lambda runs; failures are collected.                                                                     |
| Dependent checks             | nested `assertAll` inside a lambda                 | Inner block runs only if the outer check passes.                                                               |
| Type and cast                | `assertInstanceOf(Dog.class, animal)`              | Returns the cast value.                                                                                        |
| Collections in order         | `assertIterableEquals(expected, actual)`           |                                                                                                                |
| Arrays                       | `assertArrayEquals(expected, actual)`              | Do not use `assertEquals` on arrays.                                                                           |
| Timeout, waits for finish    | `assertTimeout(Duration.ofMillis(200), () -> ...)` | Fails after the work completes, so it does not stop a hang.                                                    |
| Timeout, preemptive          | `assertTimeoutPreemptively(...)`                   | Runs in another thread. `ThreadLocal` state (Spring transactions, MDC, security context) is not visible there. |

Example:

```java
@Test
void rejectsNegativeAmount() {
    IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> calculator.apply(new BigDecimal("-0.01"), "STANDARD"));
    assertEquals("amount must be non-negative", ex.getMessage());
}
```

### Choosing an assertion library

JUnit assertions are sufficient for most tests. AssertJ (`assertThat`) is the usual richer alternative and comes with `spring-boot-starter-test`. Use one style per module. Do not mix `assertEquals` and `assertThat` in the same class without a reason.

AssertJ takes the produced value first: `assertThat(actual).isEqualTo(expected)`. A literal or constant inside `assertThat` inverts the failure message.

`containsExactly` on a wildcard collection (`Collection<? extends T>`) rejects a subtype argument and does not compile. Map to a concrete type first, for example `.extracting(T::method)`.

## Test structure

### Naming

Use either a behaviour-describing method name (`rejectsNegativeAmount`) or `@DisplayName("Rejects negative amounts")`. Pick one convention per project.

```java
@DisplayName("DiscountCalculator")
class DiscountCalculatorTest {

    @Test
    @DisplayName("rejects a negative amount")
    void rejectsNegativeAmount() { /* ... */ }
}
```

### Nested groups

`@Nested` groups tests that share a precondition. The inner class must be non-static. Outer `@BeforeEach` methods run before inner ones.

```java
class OrderServiceTest {

    @Nested
    @DisplayName("when the payment is declined")
    class WhenDeclined {

        @BeforeEach
        void declinePayment() {
            when(payments.charge(any(), any())).thenReturn(new PaymentResult(false, "no funds"));
        }

        @Test
        void throwsPaymentDeclinedException() {
            assertThrows(PaymentDeclinedException.class,
                    () -> service.placeOrder("c-1", new BigDecimal("10")));
        }
    }
}
```

### Lifecycle

- Default is `PER_METHOD`: JUnit creates a new test instance per test method, so instance fields reset.
- `@BeforeAll` and `@AfterAll` must be `static` in `PER_METHOD`.
- `@TestInstance(Lifecycle.PER_CLASS)` makes them non-static. Use it only when setup is expensive and the state is read-only.
- Put shared setup in `@BeforeEach`. Do not rely on test execution order.

### Temporary files

```java
@TempDir
Path tempDir;

@Test
void writesReport() throws IOException {
    Path file = tempDir.resolve("report.csv");
    writer.write(file, rows);
    assertTrue(Files.size(file) > 0);
}
```

`@TempDir` works on fields and parameters. Each test gets a fresh directory, cleaned up afterwards. Do not hard-code paths like `src/test/resources/out.csv` and do not delete files by hand.

### Timeouts

`@Timeout(value = 2, unit = TimeUnit.SECONDS)` on a class or method fails a test that hangs. It guards against deadlock; it does not make timing-based assertions reliable.

### Skipping tests

- `@Disabled("PAY-1234: fails on Windows path separators")`: always give a reason and a ticket.
- `assumeTrue(condition, "reason")` aborts the test as skipped. Use it for environment preconditions.
- `@EnabledOnOs`, `@DisabledOnOs`, `@EnabledIf("method")`, `@EnabledIfEnvironmentVariable(named = "CI", matches = "true")` are declarative alternatives.

## Sources

- Assertions: https://docs.junit.org/current/writing-tests/assertions.html
- Nested tests: https://docs.junit.org/current/writing-tests/nested-tests.html
- Test instance lifecycle: https://docs.junit.org/current/writing-tests/test-instance-lifecycle.html

