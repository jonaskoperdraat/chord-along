## ADDED Requirements

### Requirement: TranscriptionBundle carries a sourceHash field

Every `TranscriptionBundle` SHALL carry a `sourceHash` field containing the
SHA-256 hash (hex-encoded, lower-case) of the UTF-8 ChordPro source text from
which the bundle was compiled. This field is the key used to detect stale syncs:
if `AnchorSidecar.sourceHash` does not equal the current bundle's `sourceHash`,
the sync was tapped against an older version of the transcription.

```typescript
type TranscriptionBundle = {
  source:      SourceDescriptor
  version:     number
  sourceHash:  string            // SHA-256 of UTF-8 source, hex lower-case — NEW
  metadata:    { title?: string, artist?: string, key?: string, capo?: string }
  body:        Section
  occurrences: Occurrence[]
}
```

#### Scenario: sourceHash is present on every compiled bundle

- **WHEN** `compile()` is called with any valid ChordPro source string
- **THEN** the returned `TranscriptionBundle` SHALL include a `sourceHash` field that is a 64-character lower-case hex string

#### Scenario: sourceHash changes when source changes

- **WHEN** two bundles are compiled from source strings that differ by at least one character
- **THEN** their `sourceHash` values SHALL differ

#### Scenario: sourceHash is stable for identical source

- **WHEN** the same source string is compiled twice
- **THEN** both resulting bundles SHALL have identical `sourceHash` values

#### Scenario: sourceHash uses SHA-256 of UTF-8 bytes

- **WHEN** the source string `"[G]Hello"` is compiled
- **THEN** `sourceHash` SHALL equal the lower-case hex SHA-256 of the UTF-8 encoding of `"[G]Hello"`
