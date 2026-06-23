## Why

The backend currently targets Java 17. Java 25 is the next LTS release and brings language improvements (pattern matching, records, sealed classes fully settled) that make the codebase more expressive. Moving to the latest LTS now keeps the project current and avoids falling further behind.

## What Changes

- Bump `maven.compiler.release` from `17` to `25` in `pom.xml`
- Update the `<release>` setting in the `maven-compiler-plugin` configuration to `25`
- Verify Quarkus 3.17.4 supports Java 25 (or bump Quarkus if a newer version is required)

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- None

## Impact

- `backend/pom.xml` — compiler release version updated
- Local JDK: Java 25 must be installed and `JAVA_HOME` pointed at it
- No API or behavioral changes
