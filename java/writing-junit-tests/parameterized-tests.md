# Parameterized and Dynamic Tests

Requires `junit-jupiter-params` (see `configuration.md`). Use a parameterized test whenever the same behaviour is checked with several inputs.

Without the artifact, a table of inputs can use `@TestFactory` with `DynamicTest`: one reported invocation per row. Ask before adding `junit-jupiter-params`, then convert the factory to `@ParameterizedTest`.

## Choosing a source

| Need                                 | Source                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| One argument, literal list           | `@ValueSource(ints = {1, 2, 3})`. Supports short, byte, int, long, float, double, char, boolean, String, Class. |
| null, empty, or blank input          | `@NullSource`, `@EmptySource`, `@NullAndEmptySource`. Blank strings: `@ValueSource(strings = {" ", "\t"})`.     |
| Enum constants                       | `@EnumSource`. Use `names`, `from`/`to`, or `mode = EXCLUDE` or `MATCH_ALL` with a regex.                       |
| Several arguments, readable table    | `@CsvSource({"GOLD, 90.00", "SILVER, 95.00"})`                                                                  |
| Several arguments, external data     | `@CsvFileSource(resources = "/tiers.csv", numLinesToSkip = 1)`                                                  |
| Objects or several arguments in code | `@MethodSource("name")` returning `Stream<Arguments>`                                                           |
| Constants from a static field        | `@FieldSource("name")`                                                                                          |
| Reusable provider                    | `@ArgumentsSource(MyProvider.class)`                                                                            |

Multiple source annotations of the same kind are repeatable. Each contributes its own invocations.

## Example: table of tier discounts

```java
@ParameterizedTest
@CsvSource({
    "GOLD,     100.00, 90.00",
    "SILVER,   100.00, 95.00",
    "STANDARD, 100.00, 100.00"
})
void appliesTierDiscount(String tier, BigDecimal amount, BigDecimal expected) {
    assertEquals(0, expected.compareTo(calculator.apply(amount, tier)));
}
```

`BigDecimal` is converted implicitly from the CSV text. Leading and trailing whitespace is trimmed by default.

## Example: method source with objects

```java
@ParameterizedTest
@MethodSource
void rejectsInvalidAmount(BigDecimal amount) {
    assertThrows(IllegalArgumentException.class, () -> calculator.apply(amount, "GOLD"));
}

static Stream<BigDecimal> rejectsInvalidAmount() {
    return Stream.of(new BigDecimal("-0.01"), new BigDecimal("-50"));
}
```

With no name on `@MethodSource`, JUnit looks for a factory method with the same name as the test. A single-parameter test can return a `Stream` of the parameter type. Multi-parameter tests return `Stream<Arguments>`, built with `Arguments.of(...)`.

## CSV rules

- Default delimiter `,`, quote character `'`. Use `'lemon, lime'` to keep a comma inside a value.
- Empty unquoted value means `null`. `''` means an empty string.
- `nullValues = "NIL"` maps a literal token to `null`. Primitive parameters cannot receive `null`, so `ArgumentConversionException` is thrown.
- `useHeadersInDisplayName = true` with `textBlock = """ ... """` puts headers into display names.
- `@CsvFileSource` uses `"` as its quote character by default.

## Method source rules

- The factory must be `static`, unless the test class uses `@TestInstance(PER_CLASS)`.
- Return `Stream`, `Collection`, `Iterator`, `Iterable`, or an array. Streams are closed automatically.
- `@FieldSource` cannot hold a `Stream` directly. Wrap it in `Supplier<Stream<...>>`, because a stream is consumed on first use.
- Reference a provider in another class with `@MethodSource("com.example.Providers#tiers")`.

## Argument conversion

- Implicit conversion covers primitives and boxes, enums, `BigDecimal`, `BigInteger`, `Duration`, `LocalDate`, `UUID`, `File`, `Path`, `URI`, `Locale`, `Currency`, and others. The full table is in the user guide.
- Fallback: a target type with a single non-private static factory method or constructor that takes a `String` is created from the text.
- Explicit: `@ConvertWith(MyConverter.class)` on the parameter. Extend `SimpleArgumentConverter` or `TypedArgumentConverter` to avoid boilerplate.
- Widening: an `int` source can feed a `long`, `float`, or `double` parameter.

## Aggregation

When a source supplies many values, take an `ArgumentsAccessor` instead of many parameters:

```java
@ParameterizedTest
@CsvSource({"Jane, Doe, F", "John, Doe, M"})
void readsPerson(ArgumentsAccessor args) {
    String first = args.getString(0);
    Gender gender = args.get(2, Gender.class);
    // ...
}
```

For a reusable mapping, implement `ArgumentsAggregator` (or extend `SimpleArgumentsAggregator`) and put `@AggregateWith(PersonAggregator.class)` on the parameter.

Parameter order: indexed arguments first, then aggregators, then `ParameterResolver` arguments such as `TestInfo`.

## Argument count validation

By default, extra arguments from a source are silently ignored, which hides mistakes. Set `argumentCountValidation = ArgumentCountValidationMode.STRICT` on the annotation, or use the global property in `junit-platform.properties`.

## Display names

- `@ParameterizedTest(name = "{index}: {0} tier pays {1}")` customises each invocation. Placeholders: `{displayName}`, `{index}` (1-based), `{arguments}`, `{argumentsWithNames}`, `{0}`, `{1}`.
- `name` is a `MessageFormat` pattern: write an apostrophe as `''`.
- `{argumentsWithNames}` needs the `-parameters` compiler flag.
- Single-argument text: in JUnit 5.x, text arguments are shown unquoted. From JUnit 6.0, text arguments are quoted by default (`quoteTextArguments = false` turns this off). Check the version before asserting on display names.
- `Named.of("Apple", "apple")` and `Arguments.argumentSet(...)` give readable names to individual arguments or whole sets. Check your JUnit version for `argumentSet` support.

## Other repeating forms

**Repeated tests** run the same body several times, for flaky-resource or randomised checks:

```java
@RepeatedTest(value = 5, name = "run {currentRepetition} of {totalRepetitions}")
void randomIdsAreUnique(RepetitionInfo info) {
    assertNotEquals(IdGenerator.next(), IdGenerator.next());
}
```

**Dynamic tests** (`@TestFactory`) generate cases from runtime data that is not known at compile time:

```java
@TestFactory
Stream<DynamicTest> everyTierHasADiscount() {
    return Tier.all().stream()
            .map(tier -> dynamicTest(tier.name(), () ->
                    assertTrue(calculator.apply(BigDecimal.TEN, tier.name()).signum() >= 0)));
}
```

**Parameterized classes** (`@ParameterizedClass`) run every test in a class once per argument set. The current docs mark them experimental. Use them only when the team has agreed to.

## Anti-patterns

- A boolean flag parameter that switches behaviour inside the test body. Split into separate tests or sources.
- Tables with more than about 20 rows, or with unrelated cases mixed together. Move the data to `@MethodSource` or a CSV file.
- Parameterizing over assertion logic that differs per row. Each row must check the same property.

## Sources

- Parameterized classes and tests: https://docs.junit.org/current/writing-tests/parameterized-classes-and-tests.html
- Configuration parameters (argument count, display names): https://docs.junit.org/current/running-tests/configuration-parameters.html

