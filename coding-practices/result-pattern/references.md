# References

## Canonical documentation

| Resource                                  | URL                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Rust std `Result`                         | https://doc.rust-lang.org/std/result/                                                                      |
| neverthrow                                | https://github.com/supermacro/neverthrow                                                                   |
| neverthrow wiki                           | https://github.com/supermacro/neverthrow/wiki                                                              |
| eslint-plugin-neverthrow                  | https://github.com/mdbetancourt/eslint-plugin-neverthrow                                                   |
| Vavr docs (Either §3.3.4, Try §3.3.2)     | https://docs.vavr.io/                                                                                      |
| Vavr javadoc 0.11.0                       | https://static.javadoc.io/io.vavr/vavr/0.11.0/                                                             |
| Java 21 pattern-matching switch (JEP 441) | https://docs.oracle.com/en/java/javase/21/language/pattern-matching-switch-expressions-and-statements.html |
| Python `typing` docs                      | https://docs.python.org/3/library/typing.html                                                              |
| rustedpy/result (archived)                | https://github.com/rustedpy/result                                                                         |
| Railway-Oriented Programming              | https://fsharpforfunandprofit.com/rop/                                                                     |
| Against Railway-Oriented Programming      | https://fsharpforfunandprofit.com/posts/against-railway-oriented-programming/                              |

## Brief history

The Result pattern descends from ML family languages (OCaml/SML), where `result` and `option` sum types made failure an ordinary value. Haskell generalized it as `Either` (with `Maybe` for absence), establishing the monadic chaining style (`>>=` / bind). Scala and Vavr carried it to the JVM. Rust mainstreamed it in a systems language: `Result<T, E>` is built into std, annotated `#[must_use]` so ignoring it is a compiler warning, and `?` makes propagation ergonomic. Fittingly, the first Rust compiler (2010) was itself written in OCaml before self-hosting. Scott Wlaschin's "Railway-Oriented Programming" (NDC 2014) popularized the two-track mental model for the Either monad — while cautioning against applying it indiscriminately.
