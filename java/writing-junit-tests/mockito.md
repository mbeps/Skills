# Mockito with JUnit 5

## Setup

`spring-boot-starter-test` includes Mockito and `mockito-junit-jupiter`. Otherwise add `testImplementation("org.mockito:mockito-junit-jupiter:<version>")` and match the Mockito version to the project.

Mockito 5 and later use the inline mock maker by default, so `final` classes and static methods can be mocked without `mockito-inline`.

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orders;

    @Mock
    private PaymentGateway payments;

    private OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(orders, payments);
    }
}
```

Build the class under test by hand. `@InjectMocks` passes `null` for any constructor argument that has no matching mock, so a missing mock fails late and confusingly.

## Strict stubs

`MockitoExtension` uses strict stubs by default:

- An unused stub fails with `UnnecessaryStubbingException`. Remove the stub, or fix the code path the test is meant to exercise.
- Calling a stubbed method with different arguments fails with `PotentialStubbingProblem`. This usually means the test and the code disagree about the input.
- `lenient()` on one stub, or `@MockitoSettings(strictness = Strictness.LENIENT)` on the class, are escape hatches. Use them only with a comment that names the reason.

## Stubbing

```java
when(payments.charge("c-1", TOTAL)).thenReturn(new PaymentResult(true, null));
when(payments.charge(any(), any())).thenThrow(new IllegalStateException("gateway down"));
when(orders.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

doThrow(new IOException("disk full")).when(writer).flush();   // void methods
doReturn("cached").when(spy).load("k");                       // spies, or real methods with side effects
```

BDD style (`given(...).willReturn(...)`, `then(mock).should().save(...)`) is equivalent. Pick one style per project.

### Spies for branches a real collaborator pre-empts

A real collaborator can throw before the code under test reaches a branch. For example, a parser that rejects expired input stops the flow before an explicit expiry check runs. Spy the class under test and stub the collaborator with `doReturn`, because `when(spy.method())` calls the real method first. Add a one-line comment that names the pre-empting behaviour.

```java
TokenChecker spy = spy(new TokenChecker(parser));
doReturn(claims).when(spy).parse(token);
doReturn(true).when(spy).isExpired(token);   // real parser rejects expired tokens first
```

## Verification

```java
verify(payments).charge("c-1", TOTAL);          // exactly once
verify(payments, times(2)).charge(any(), any());
verify(orders, never()).save(any());
verifyNoInteractions(orders);                    // guarded path: nothing touched
```

Capture arguments when the value passed is the contract:

```java
ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
verify(orders).save(captor.capture());
assertEquals(OrderStatus.PAID, captor.getValue().status());
```

Prefer asserting on the return value or state. Verify only interactions that are part of the contract. `verifyNoMoreInteractions` on every mock couples the test to the implementation.

## Argument matchers

- Use matchers for all arguments or none. Mixing a raw value with `any()` throws `InvalidUseOfMatchersException`; wrap the raw value in `eq(...)`.
- `any()` matches `null`. `any(Order.class)` does not match `null`, so use `any()` when `null` is valid input.

## Static and constructor mocking

```java
try (MockedStatic<IdGenerator> ids = mockStatic(IdGenerator.class)) {
    ids.when(IdGenerator::next).thenReturn("fixed-id");
    assertEquals("fixed-id", service.createCode());
}
```

- Always use try-with-resources. An unclosed `MockedStatic` leaks into other tests on the same thread.
- `mockConstruction(Foo.class)` follows the same pattern.
- Static mocking hides a design problem. Use it for legacy code you are not allowed to change, and say so in a comment.
- `mockStatic(System.class)` fails during class loading with an infinite-loop error. Inject the value instead.
- To stub one static method and keep the rest real, use `mockStatic(Foo.class, Mockito.CALLS_REAL_METHODS)`.

## Inject a Clock instead of mocking `LocalDate.now()`

When production code may change, inject `Clock`:

```java
public class LicenceExpiryChecker {

    private final Clock clock;

    public LicenceExpiryChecker(Clock clock) {
        this.clock = clock;
    }

    public boolean isExpiringSoon(LocalDate expiry) {
        LocalDate today = LocalDate.now(clock);
        return !expiry.isBefore(today) && expiry.isBefore(today.plusDays(30));
    }
}
```

```java
Clock fixed = Clock.fixed(Instant.parse("2026-12-15T10:00:00Z"), ZoneOffset.UTC);
LicenceExpiryChecker checker = new LicenceExpiryChecker(fixed);
```

This gives deterministic tests without static mocks, and the same class works in production with `Clock.systemUTC()`.

## What not to mock

| Do not mock                                         | Do instead                                                   |
| --------------------------------------------------- | ------------------------------------------------------------ |
| Value objects, records, DTOs, strings, collections  | Construct them.                                              |
| Types you do not own (JDK, third-party)             | Wrap them in your own interface, then mock the interface.    |
| The class under test, or its private methods        | Test through the public API.                                 |
| A collaborator with real logic you need to exercise | Write a small fake (for example, a `Map`-backed repository). |

## Sources

- Mockito 5 changes: https://github.com/mockito/mockito/wiki/What%27s-new-in-Mockito-5
- MockitoExtension and strictness: https://javadoc.io/doc/org.mockito/mockito-junit-jupiter/latest/org/mockito/junit/jupiter/MockitoExtension.html

