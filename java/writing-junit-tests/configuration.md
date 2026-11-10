# Configuration

## Gradle (Kotlin DSL)

Pin one JUnit version through the BOM. Match the version already in the project.

```kotlin
val junitVersion = "5.14.3"

dependencies {
    testImplementation(platform("org.junit:junit-bom:$junitVersion"))
    testImplementation("org.junit.jupiter:junit-jupiter")       // api + params + engine
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
}
```

Use the `junit-jupiter` aggregate to get `@ParameterizedTest`. If the build lists only `junit-jupiter-api`, `junit-jupiter-engine`, and `junit-platform-launcher`, the params artifact is missing. Add `testImplementation("org.junit.jupiter:junit-jupiter-params:$junitVersion")` after confirming the dependency change.

**Repo note:** `build.gradle.kts` in `013756-markdowntomessagemlconverter` declares only api, engine, and launcher. `@ParameterizedTest` is therefore unavailable there until the params artifact is added.

## Maven

```xml
<dependency>
  <groupId>org.junit.jupiter</groupId>
  <artifactId>junit-jupiter</artifactId>
  <version>5.14.3</version>
  <scope>test</scope>
</dependency>
```

Surefire 3.x discovers the JUnit Platform automatically when Jupiter is on the test classpath.

## Spring Boot

`spring-boot-starter-test` brings JUnit Jupiter (including params), Mockito, AssertJ, Hamcrest, and Spring Test. The Spring Boot BOM manages versions, so omit explicit versions.

## Parameter names in display names

Parameter names (`{argumentsWithNames}`, `firstName = "Jane"`) need the `-parameters` compiler flag:

```kotlin
tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.add("-parameters")
}
```

## junit-platform.properties

Place at `src/test/resources/junit-platform.properties`. Keep parallel execution off until isolation is proven.

```properties
junit.jupiter.execution.parallel.enabled = false
junit.jupiter.params.argumentCountValidation = strict
junit.jupiter.params.displayname.default = {index}
```

- `junit.jupiter.execution.parallel.enabled`: parallel execution switch. Enable only with `@ResourceLock` on shared resources (see `advanced-patterns.md`).
- `junit.jupiter.params.argumentCountValidation = strict`: fails when a source supplies more arguments than the method declares.
- `junit.jupiter.testinstance.lifecycle.default`: changes the default from `per_method`. Leave it unset. A changed default makes IDE and CI behaviour diverge.

System properties override the file. Gradle can pass them with `systemProperty("junit.jupiter.execution.parallel.enabled", "true")` inside `tasks.test`.

## Tag filtering

```kotlin
tasks.test {
    useJUnitPlatform {
        includeTags("unit")
        // excludeTags("slow")
    }
}
```

Tag classes or methods with `@Tag("unit")`.

## Running tests

| Goal             | Command                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| One class        | `./gradlew test --tests "com.example.pricing.DiscountCalculatorTest"`                       |
| One method       | `./gradlew test --tests "com.example.pricing.DiscountCalculatorTest.rejectsNegativeAmount"` |
| Wildcard         | `./gradlew test --tests "*DiscountCalculatorTest"`                                          |
| Maven, one class | `mvn -Dtest=DiscountCalculatorTest test`                                                    |

Reports: `build/reports/tests/test/index.html` and `build/test-results/test/*.xml`.

## JaCoCo coverage gate (Gradle)

```kotlin
plugins {
    jacoco
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
}

tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.jacocoTestReport)
    violationRules {
        rule {
            limit {
                counter = "BRANCH"
                value = "COVEREDRATIO"
                minimum = "0.80".toBigDecimal()
            }
        }
    }
}

// The verification task is not wired into `check` by default.
tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}
```

Rules:

- Ratio limits must be in the range 0.0 to 1.0. Write `0.80`, not `80`. Maven also accepts `80%`, Gradle uses `BigDecimal`.
- `BRANCH` is a stronger gate than `LINE`. Gate on both when the team wants it.
- Gradle's `jacocoTestCoverageVerification` is not a dependency of `check`. Wire it explicitly, as above, or the gate never fails the build.
- JaCoCo reports only the first violated rule.
- Lombok-generated members carry `@Generated`, which JaCoCo ignores. Do not write tests for generated getters, builders, or `equals`.

## Sources

- JUnit configuration parameters: https://docs.junit.org/current/running-tests/configuration-parameters.html
- Gradle JaCoCo plugin: https://docs.gradle.org/current/userguide/jacoco_plugin.html
- JaCoCo check rules: https://www.jacoco.org/jacoco/trunk/doc/check-mojo.html

