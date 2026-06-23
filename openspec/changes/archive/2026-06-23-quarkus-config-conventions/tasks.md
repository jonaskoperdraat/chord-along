## 1. Migrate Quarkus config to YAML

- [x] 1.1 Create `backend/src/main/resources/application.yml` with all settings from `application.properties` translated to YAML format, including `quarkus.jackson.serialization-inclusion: non-null`
- [x] 1.2 Delete `backend/src/main/resources/application.properties`

## 2. Remove JacksonConfig Java bean

- [x] 2.1 Delete `backend/src/main/java/nl/jonaskoperdraat/chordalong/JacksonConfig.java`

## 3. Document backend conventions in CLAUDE.md

- [x] 3.1 Add a **Backend conventions** section to `CLAUDE.md` documenting: prefer `application.yml` over `application.properties`, and prefer properties-based configuration over Java config beans when the framework supports it
