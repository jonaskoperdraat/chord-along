## Context

The backend is a Quarkus 3.17.4 app compiled at Java 17. Java 25 is the next LTS (released September 2025). The change is purely a compiler version bump — no source code changes are expected since the codebase uses only Java 17-compatible constructs. The main risk is Quarkus compatibility: older Quarkus versions may not declare support for Java 25.

## Goals / Non-Goals

**Goals:**
- Compile and run the backend on Java 25
- Update `pom.xml` so `mvn package` and `./mvnw quarkus:dev` work on a Java 25 JDK

**Non-Goals:**
- Adopting Java 25 language features (records, sealed classes, pattern matching) — that is future work
- Changing any runtime behavior or API surface

## Decisions

**Bump compiler release to 25 in two places** — `pom.xml` sets `maven.compiler.release` as a property (used by default) and also overrides `<release>` explicitly inside the `maven-compiler-plugin` config. Both must be updated to avoid the plugin config silently overriding the property.

**Verify Quarkus compatibility before bumping** — Quarkus 3.x has been testing against EA builds of upcoming Java releases. If `./mvnw quarkus:dev` or tests fail after the compiler bump, the Quarkus BOM version may need to be raised to a release that officially certifies Java 25. Check the [Quarkus compatibility matrix](https://quarkus.io/blog/) or release notes at that point.

## Risks / Trade-offs

- [Low] Quarkus 3.17.4 may not officially certify Java 25 → Mitigation: run `./mvnw quarkus:dev` and `./mvnw test` after the bump; if they fail, raise the `quarkus.platform.version` property to the first version that supports Java 25.
- [None] No API or behavioral risk — this is a build-tooling change only.
