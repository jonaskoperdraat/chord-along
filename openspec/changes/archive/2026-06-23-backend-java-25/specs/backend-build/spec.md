## ADDED Requirements

### Requirement: Backend compiles and runs on Java 25
The backend SHALL compile and start successfully when the local JDK is Java 25.

#### Scenario: Dev server starts on Java 25
- **WHEN** `./mvnw quarkus:dev` is run with a Java 25 JDK
- **THEN** the Quarkus dev server SHALL start without compilation errors or JVM compatibility warnings
