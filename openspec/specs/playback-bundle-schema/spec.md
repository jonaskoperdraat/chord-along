## Requirements

> **Superseded**: The `PlayBundle` format (`.play.json`) has been replaced by the
> separated `TranscriptionBundle` + `SyncPlayData` model. See
> `transcription-bundle-schema` spec. The old combined format embedded timestamps
> inside slots and maintained a parallel `events[]` index. The player now joins
> the two artifacts at runtime via `occurrenceIdx`.
