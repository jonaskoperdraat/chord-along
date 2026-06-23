## 1. Bump Quarkus version

- [x] 1.1 Change `<quarkus.platform.version>3.17.4</quarkus.platform.version>` to `<quarkus.platform.version>3.33.2</quarkus.platform.version>` in `backend/pom.xml`

## 2. Verify the upgrade

- [x] 2.1 Run `mvn compile` from `backend/` and fix any compilation errors caused by breaking changes between 3.17 and 3.33
- [x] 2.2 Run `mvn test` and confirm all tests pass
