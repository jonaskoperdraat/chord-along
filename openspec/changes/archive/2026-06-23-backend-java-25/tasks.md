## 1. Update compiler version in pom.xml

- [x] 1.1 Change `<maven.compiler.release>17</maven.compiler.release>` to `<maven.compiler.release>25</maven.compiler.release>` in `backend/pom.xml`
- [x] 1.2 Change `<release>17</release>` to `<release>25</release>` inside the `maven-compiler-plugin` configuration in `backend/pom.xml`

## 2. Verify compatibility

- [x] 2.1 Run `./mvnw quarkus:dev` (from `backend/`) with a Java 25 JDK and confirm the dev server starts cleanly; if it fails due to Quarkus incompatibility, bump `quarkus.platform.version` to the first version that supports Java 25 and document the version chosen
- [x] 2.2 Run `./mvnw test` and confirm all tests pass
