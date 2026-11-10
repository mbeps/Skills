# What to Test

## Per-layer matrix

| Layer                                      | Test type                                                | Assert                                                                             |
| ------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Pure logic (calculator, validator, mapper) | Plain unit test, parameterized boundary table            | Return values; exception type and message                                          |
| Service with collaborators                 | Mockito unit test                                        | Outcome, plus the one interaction that is part of the contract (captured argument) |
| Controller                                 | `@WebMvcTest`                                            | Status, JSON body, service call arguments, validation failures (400)               |
| Repository query                           | `@DataJpaTest` (Testcontainers when the dialect matters) | Returned rows, ordering, constraint violations                                     |
| Wiring and configuration                   | Minimal `@SpringBootTest`                                | Context loads, properties bind, beans exist                                        |

## Boundary and error-path checklist

For each input parameter, consider:

- null, empty, blank, zero, negative
- the largest valid value, and one above it
- the smallest valid value, and one below it
- each `if` branch, each `switch` case, and the `default`
- each thrown exception: its type and its message
- validation before side effects: `verifyNoInteractions` on the collaborators that must not run
- retries and idempotency, where the unit has them

Example table for the discount rule:

```java
@ParameterizedTest
@CsvSource({
    "GOLD,     0.00,   0.00",
    "GOLD,     0.01,   0.009",   // rounding is not applied
    "STANDARD, 100.00, 100.00"
})
void appliesDiscount(String tier, BigDecimal amount, BigDecimal expected) {
    assertEquals(0, expected.compareTo(calculator.apply(amount, tier)));
}
```

## One behaviour per test

- Assert the observable outcome: the return value, the state visible through the API, or the call that crosses a boundary.
- Do not assert private fields or internal call counts unless they are the contract.
- One logical behaviour per test method. Several asserts that check one behaviour are fine. `assertAll` groups them.

## Naming

Use a name that states the behaviour: `rejectsNegativeAmount`, `returnsNotFoundWhenReportMissing`, `doesNotChargeWhenTotalIsZero`. Avoid `test1`, `happyPath`, and `shouldWork`. Use `@DisplayName` for longer sentences.

## Test data

- Provide a builder or factory method for a valid default object. Each test overrides only the field it cares about.
- Keep literal values near the assertion that depends on them, so the reader does not have to scroll.
- Use named constants for values reused across tests (`CUSTOMER_ID`, `TOTAL`).

```java
private static Order.Builder validOrder() {
    return Order.builder().customerId("c-1").total(new BigDecimal("42.50"));
}

@Test
void rejectsOrderWithoutCustomer() {
    Order order = validOrder().customerId(null).build();
    assertThrows(IllegalArgumentException.class, () -> service.place(order));
}
```

## Coverage policy

- Measure with JaCoCo, and gate on branch coverage as well as line coverage (see `configuration.md`).
- A coverage number is a symptom, not a goal. Every new test must assert a result. An assertion-free test that executes a line is not coverage.
- Unreachable branches: simplify or delete the code. If a JaCoCo exclusion is unavoidable, add a comment naming the lines and the reason.
- Use JaCoCo's per-class report to find the real gaps before writing tests. Check the failing rule, then write tests for the missed branches. Each `<sourcefile>` in `build/reports/jacoco/test/jacocoTestReport.xml` has `<line nr mi mb>` elements: `mi` above 0 is a missed line, and `mb` above 0 is a missed branch. Console or agent summaries can omit files, so read the XML.

## Sources

- JaCoCo check rules: https://www.jacoco.org/jacoco/trunk/doc/check-mojo.html

