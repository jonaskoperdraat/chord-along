## Context

The backend uses Quarkus via its BOM (`quarkus-bom`), so a single property (`quarkus.platform.version`) drives all Quarkus extension versions. The current version is 3.17.4; the target is 3.33 (LTS). The project uses `quarkus-rest-jackson`, `quarkus-arc`, and the `quarkus-maven-plugin` — all managed by the BOM, so no individual extension versions need to be touched.

## Goals / Non-Goals

**Goals:**
- Single-property version bump to 3.33
- Confirm compilation, dev server startup, and test suite pass on the new version

**Non-Goals:**
- Adopting new Quarkus 3.x features or APIs
- Changing any extension set or configuration

## Decisions

**Single BOM property bump** — `quarkus.platform.version` controls the BOM import and the `quarkus-maven-plugin` version in one place. No other version references need changing.

**Verify with full build** — LTS upgrades can introduce breaking changes in extension behaviour (e.g., changed defaults, removed deprecated APIs). Running `mvn test` after the bump is the minimum bar; if there are test failures, investigate before marking the task done.

## Risks / Trade-offs

- [Low] Breaking API changes between 3.17 and 3.33 could require source fixes → Mitigation: inspect compiler errors and Quarkus migration guides if `mvn compile` fails.
- [Low] Changed extension defaults (e.g. serialisation, CORS handling) could silently affect behaviour → Mitigation: confirm existing tests pass and manually verify the API response against the OpenAPI spec if tests are sparse.
