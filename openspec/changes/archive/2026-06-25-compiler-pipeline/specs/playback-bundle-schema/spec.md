## REMOVED Requirements

### Requirement: Playback bundle structure
**Reason**: Superseded by the separated `TranscriptionBundle` + `SyncPlayData`
model (see `transcription-bundle-schema` spec). The old combined format embedded
timestamps inside slots and maintained a parallel `events[]` index. This coupling
prevented multiple syncs from sharing a single transcription artifact and made
CDN caching of transcription structure impractical.
**Migration**: Replace `PlayBundle` with `TranscriptionBundle` (structure) and
`SyncPlayData` (timing). The player joins them at runtime via `occurrenceIdx`.
See `transcription-bundle-schema` spec for the new shapes.

### Requirement: Hand-crafted fixture
**Reason**: Replaced by a split fixture: `sample.bundle.json` (transcription
structure) and `sample.sync-play.json` (timestamps), exercising the real
two-artifact load path.
**Migration**: Delete `sample.play.json`; create `sample.bundle.json` containing
the existing `lines[]` with `occurrenceIdx` annotations, and `sample.sync-play.json`
containing the existing `events[]` timestamps as a flat `timestamps[]` array.

### Requirement: Version field
**Reason**: Moved to `TranscriptionBundle.version` in the new schema.
**Migration**: No behaviour change; the version field and warning semantics are
preserved in `transcription-bundle-schema` spec.
