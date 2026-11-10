# Advanced Patterns

## Custom extensions

- `@ExtendWith(MyExtension.class)` registers an extension declaratively on a class or method. Use it for reusable behaviour (for example, a shared fake server).
- `@RegisterExtension` on a field registers an extension instance you configure yourself. The field can be `static` for class-wide use.
- Use built-in parameter injection before writing an extension: `TestInfo` (name and tags), `TestReporter` (publish key-value data), `RepetitionInfo` (repeated tests), `@TempDir`.
- A custom `ParameterResolver` injects a test-only object into test and lifecycle methods. Keep resolvers small and single-purpose.

## Time

- Inject `java.time.Clock`. Do not call `Instant.now()`, `LocalDate.now()`, or `System.currentTimeMillis()` inside logic under test. See `mockito.md` for the pattern.
- Use `Clock.fixed(...)` in tests and `Clock.systemUTC()` in production.
- For a time-sensitive timeout, prefer an injected `Duration` over a hard-coded `Thread.sleep`.

## Concurrency and waiting

- Do not use `Thread.sleep` to wait for another thread. It is slow when the work is fast and flaky when the work is slow.
- Wait on the event instead:
  - `CountDownLatch.await(5, TimeUnit.SECONDS)` for "N things happened"
  - `Future.get(5, TimeUnit.SECONDS)` for a task result
  - `CompletableFuture.orTimeout(...)` for a chain
  - Awaitility `await().atMost(Duration.ofSeconds(5)).until(...)` when the project already depends on it
- `assertTimeoutPreemptively` runs its body on another thread, so `ThreadLocal` state is missing there (for example Spring-managed transactions). Do not use it to test code that depends on the current thread's context.
- `@Timeout` on a class or method fails a hung test. It is a safety net, not a timing assertion.

## Shared state

- Do not keep mutable `static` fields that test methods write. Reset singletons, caches, and registries in `@AfterEach`.
- System properties: set them in a helper that restores the previous value in a `finally` block, or use `@ResourceLock(Resources.SYSTEM_PROPERTIES)` when running in parallel.
- Environment variables cannot be changed in the JVM. Inject a `Map<String, String>` or a `Function<String, String>` into the class, and pass `Map.of(...)` in tests.
- Files: use `@TempDir`. Never write into `src/test/resources`.

## Parallel execution

Parallel execution is off by default. Enable it only after the suite passes in random order.

```properties
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = concurrent
```

- Mark shared resources with `@ResourceLock`. Predefined names in `Resources`: `SYSTEM_PROPERTIES`, `SYSTEM_OUT`, `SYSTEM_ERR`, `LOCALE`, `TIME_ZONE`. Use `mode = READ` where tests only read.
- Opt a class out with `@Execution(ExecutionMode.SAME_THREAD)`. Use `@Isolated` for a class that must run with no other test running at the same time.
- The default mode is `same_thread`. Setting `junit.jupiter.execution.parallel.mode.default = concurrent` changes that for every node.

## Local fake HTTP servers

- Use the JDK `com.sun.net.httpserver.HttpServer` for a fake token endpoint, userinfo endpoint, or forward proxy. It needs no extra dependency.
- Bind to `InetAddress.getLoopbackAddress()` on port `0`, read the assigned port, and call `stop(0)` in `@AfterEach`.
- Record requests in a `CopyOnWriteArrayList`, because the server handles requests on its own thread.

## Testcontainers

- Use `@Testcontainers` with a `static` `@Container` field to share one container across the class.
- In Spring Boot, `@ServiceConnection` on the container field wires the connection details automatically. See `spring-boot-testing.md`.

## Private methods

Do not test private methods through reflection. Test them through the public API. If a private method needs its own tests, that is a signal to extract a class with a public method.

## Legacy code

For code without tests, write characterisation tests first. Capture the current output for representative inputs, assert on it, then refactor against those tests. Mark assertions that encode suspected bugs with a comment rather than fixing them silently. Name the test for the current outcome, such as `nullUrlListCurrentlyThrowsNullPointerException`. Fixing the bug then fails the test, which is the signal to update it.

## Sources

- Extensions: https://docs.junit.org/current/extensions/overview.html
- Parallel execution: https://docs.junit.org/current/writing-tests/parallel-execution.html
- Assertions (preemptive timeouts and `ThreadLocal`): https://docs.junit.org/current/writing-tests/assertions.html

