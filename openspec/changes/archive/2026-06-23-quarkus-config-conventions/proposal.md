## Why

Quarkus configuration currently uses two mechanisms where one would do: a Java `JacksonConfig` class sets Jackson's serialization inclusion, even though Quarkus supports this via a property. A properties-over-code convention and a consistent YAML config format should be established and codified in CLAUDE.md so future work stays consistent.

## What Changes

- Migrate `backend/src/main/resources/application.properties` → `application.yml`
- Replace `JacksonConfig.java` (Java `ObjectMapperCustomizer` bean) with the equivalent `quarkus.jackson.serialization-inclusion` property in the YAML config
- Delete `JacksonConfig.java`
- Add a **Backend conventions** section to `CLAUDE.md` documenting these two rules

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- None

## Impact

- `backend/src/main/resources/application.properties` — deleted, replaced by `application.yml`
- `backend/src/main/java/nl/jonaskoperdraat/chordalong/JacksonConfig.java` — deleted
- `CLAUDE.md` — new Backend conventions section added
