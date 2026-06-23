## Context

The backend has a `JacksonConfig.java` that implements `ObjectMapperCustomizer` solely to set `NON_NULL` serialization inclusion. Quarkus exposes `quarkus.jackson.serialization-inclusion` as a first-class property, making the Java bean unnecessary. Separately, the project uses `application.properties` while YAML (`application.yml`) is the preferred format for its readability and support for structured nesting. Neither change affects runtime behavior.

## Goals / Non-Goals

**Goals:**
- Replace `application.properties` with an equivalent `application.yml`
- Eliminate `JacksonConfig.java`; express the same setting via `quarkus.jackson.serialization-inclusion: non-null` in the YAML config
- Document both conventions in `CLAUDE.md` so they are applied consistently going forward

**Non-Goals:**
- Changing any configuration values or adding new settings
- Migrating frontend configuration
- Introducing environment-specific profile files

## Decisions

**YAML over properties format** — `application.yml` is chosen over `application.properties` because its hierarchical structure is more readable as the config grows and is widely idiomatic in the Quarkus ecosystem. Quarkus supports both equally, so there is no functional trade-off.

**Property over Java bean for Jackson config** — `quarkus.jackson.serialization-inclusion` is a supported Quarkus extension property that directly configures the shared `ObjectMapper`. Using it avoids a programmatic customizer that adds a class to maintain, is harder to discover, and requires understanding the CDI lifecycle. The property value `non-null` maps directly to `JsonInclude.Include.NON_NULL`.

## Risks / Trade-offs

- [Low] Typo in the YAML property name would silently fall back to the Quarkus default (include all fields). → Mitigated by verifying the serialized response still omits null fields after migration (existing API behavior is the test).
- [None] No rollback complexity — both files co-existing is not supported; deleting the old file and adding the new one is atomic from Quarkus's perspective (it looks for one or the other on startup).
