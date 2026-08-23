# Result Pattern in Java

## Approach A: zero-dependency sealed interface (Java 21+)

Sealed hierarchies + records + pattern-matching switch give compile-time exhaustiveness with **no `default` needed**.

```java
public sealed interface Result<T, E> permits Ok, Err {}

public record Ok<T, E>(T value) implements Result<T, E> {}
public record Err<T, E>(E error) implements Result<T, E> {}
```

### Service

```java
public sealed interface CreateUserError permits EmailTaken, InvalidEmail {}

public record EmailTaken(String email) implements CreateUserError {}
public record InvalidEmail(String email) implements CreateUserError {}

public Result<User, CreateUserError> createUser(String email) {
    if (!email.contains("@")) {
        return new Err<>(new InvalidEmail(email));
    }
    if (userRepo.existsByEmail(email)) {
        return new Err<>(new EmailTaken(email));
    }
    return new Ok<>(userRepo.insert(new User(email)));
}
```

### Consumer — exhaustive switch, no default

```java
switch (createUser(email)) {
    case Ok<User, CreateUserError> ok -> redirectTo("/users/" + ok.value().id());
    case Err<User, CreateUserError> err -> switch (err.error()) {
        case InvalidEmail e -> render("invalid email: " + e.email());
        case EmailTaken e   -> render("already registered: " + e.email());
        // no default required — compiler enforces coverage
    };
}
```

Notes:

- Records are implicitly final; the sealed hierarchy is closed.
- If the hierarchy changes after compilation of a consumer, runtime throws `MatchException` — recompile consumers.
- Guarded patterns available: `case Ok<User, ?> o when o.value().isActive() -> ...`.

## Approach B: Vavr 0.11.0

Dependency:

```xml
<dependency>
    <groupId>io.vavr</groupId>
    <artifactId>vavr</artifactId>
    <version>0.11.0</version>
</dependency>
```

### Either — Right = success by convention

```java
Either<CreateUserError, User> result =
    isValid(email)
        ? Either.right(loadUser(email))
        : Either.left(new InvalidEmail(email));

String message = result
    .map(User::email)
    .getOrElse("fallback");
```

Right-biased: `map`, `flatMap`, `getOrElse` operate on the Right channel. Use `swap()` if you must flip.

### Try — wrapping throwing code

```java
Try<User> tried = Try.of(() -> userRepo.find(id))
    .recover(EntityNotFoundException.class, u -> User.anonymous());

tried.getOrElse(User.anonymous());
```

Caveats:

- Vavr **Match** (`Match(x).of(Case($(...), ...))`) has **no compile-time exhaustiveness checking** — the docs state this explicitly. Prefer the sealed-interface switch for exhaustive handling.
- `Either` is right-biased: `map`/`flatMap`/`filter` operate on the Right channel only. Use `swap()` to flip left/right when an API expects the opposite convention.

### Combining multiple results

No built-in zip; combine manually or via a small helper:

```java
static <A, B, E> Either<E, Pair<A, B>> zip(Either<E, A> a, Either<E, B> b) {
    return a.flatMap(x -> b.map(y -> Pair.of(x, y)));
}
```

Async results are out of scope here; they compose as `CompletableFuture<Either<E, T>>` (chain with `.thenCompose`).
