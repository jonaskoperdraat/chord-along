## Why

The backend runs Quarkus 3.17.4. Quarkus 3.33 is the next LTS release, bringing security patches, Java 25 certification, and dependency updates. Staying on an LTS keeps the project on a supported, stable baseline.

## What Changes

- Bump `quarkus.platform.version` from `3.17.4` to `3.33` in `backend/pom.xml`
- Verify the app compiles, starts, and all tests pass after the upgrade

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- None

## Impact

- `backend/pom.xml` — `quarkus.platform.version` property updated
- All Quarkus-managed dependency versions will move with the BOM bump
- No API or behavioral changes expected
