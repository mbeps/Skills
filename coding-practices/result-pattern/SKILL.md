---
name: result-pattern
description: Use when handling predictable domain errors without exceptions, wanting compile-time exhaustive error handling, or designing service-layer error contracts in Java/Python/TypeScript.
---

# Result Pattern

## Overview

Errors become first-class return values via sum types (`Ok(T) | Err(E)`) instead of thrown exceptions. The type system forces callers to handle both outcomes, making failure paths visible in signatures and checkable at compile time.

## When to use / not use

**Use for:** expected domain failures (validation, not-found, insufficient funds), service-layer contracts, anywhere a caller must decide what failure means.

**Not for:** programmer errors (null derefs, broken invariants), truly unexpected bugs, unrecoverable states — those stay as exceptions/panics. Don't wrap framework control-flow throws (see pitfalls).

## Core pattern

A two-variant sum type; consumers narrow on the variant and handle each case exhaustively:

```ts
type Result<TSuccess, TError> = [TError, null] | [null, TSuccess]; // tuple form; object form below

function parseAge(input: string): Result<number, string> {
  const n = Number(input);
  return Number.isInteger(n) && n >= 0
    ? [null, n]
    : [`not a non-negative integer: ${input}`, null];
}

const r = parseAge("42");
if (r[0] === null) console.log(r[1]);
else console.error(r[0]);

// Alternative one-liner: object form `{ ok: true; value: T } | { ok: false; error: E }`
```

## Language quick-reference

| Language | Zero-dependency | Library | Reference |
|---|---|---|---|
| TypeScript | Discriminated union / tuple + a `never` exhaustiveness check | neverthrow v8.x | [typescript.md](typescript.md) |
| Java 21+ | Sealed interface + records + pattern switch | Vavr Either/Try | [java.md](java.md) |
| Python 3.12+ | Dataclasses + `Literal` tag + `match` | rustedpy/result (archived) | [python.md](python.md) |

## Common mistakes

- Wrapping Next.js `redirect()`/`notFound()` in try/catch or Result helpers — they throw internally for navigation; you'll swallow control flow.
- Mixing tuple orderings (`[value, err]` vs `[err, value]`) across a codebase — pick one.
- Mapping thrown values without typing them — caught values are `unknown`; convert via an error factory.
- `unwrap()` in production paths — it panics/raises; reserve for tests.
- Using Results for bugs — exceptions still belong to unexpected states.

## References

- [typescript.md](typescript.md) — zero-dep unions and neverthrow
- [java.md](java.md) — sealed interfaces and Vavr
- [python.md](python.md) — typing-based results
- [references.md](references.md) — canonical docs and history
