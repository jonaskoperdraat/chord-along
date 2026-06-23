## MODIFIED Requirements

### Requirement: Backend compiles and runs on Java 25
The backend SHALL compile and start successfully when the local JDK is Java 25 or newer, using Quarkus 3.33 (LTS).

#### Scenario: Dev server starts on Java 25 with Quarkus 3.33
- **WHEN** `mvn quarkus:dev` is run with a Java 25+ JDK and Quarkus 3.33
- **THEN** the Quarkus dev server SHALL start without compilation errors or JVM compatibility warnings
