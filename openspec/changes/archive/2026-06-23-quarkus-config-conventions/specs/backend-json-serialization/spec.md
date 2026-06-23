## ADDED Requirements

### Requirement: Null fields excluded from JSON responses
The backend API SHALL omit null-valued fields from all JSON responses. This reduces payload size and avoids exposing optional-field semantics to clients as explicit `null` literals.

#### Scenario: Response with optional fields absent
- **WHEN** a backend resource has optional fields that are not set
- **THEN** those fields SHALL be absent from the JSON response body, not serialized as `null`
