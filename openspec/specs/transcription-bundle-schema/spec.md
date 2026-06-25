## Requirements

### Requirement: TranscriptionBundle structure
A `TranscriptionBundle` SHALL conform to the following shape:

```typescript
{
  source:      SourceDescriptor           // polymorphic audio source
  version:     number                     // transcription version (integer, starts at 1)
  metadata:    { title?: string, artist?: string, key?: string, capo?: string }
  lines:       Line[]
  occurrences: Occurrence[]               // flat unrolled chord sequence
}

type Line = {
  section?:  string
  slots:     Slot[]
}

type Slot = {
  chord?:        string
  text?:         string
  occurrenceIdx?: number   // present only on chord-bearing slots
}

type Occurrence = {
  occurrenceIdx: number
  lineIdx:       number
  slotIdx:       number
  chord:         string
  anchorWord?:   string
}

type SourceDescriptor = { kind: "youtube"; videoId: string; offsetSec: number }
                      | { kind: "spotify"; trackId: string; offsetSec: number }
                      | { kind: "file";    uri: string;     offsetSec: number }
```

#### Scenario: Valid bundle is accepted by the player
- **WHEN** the player loads a `TranscriptionBundle` conforming to the schema above
- **THEN** the player renders lines and slots without errors

### Requirement: occurrences[] is the unrolled chord sequence
`occurrences[]` SHALL contain exactly one entry per chord-bearing slot in the
bundle, in the order they appear in the performed (unrolled) sequence. In v1
(inline-only ChordPro) this equals document order. `occurrenceIdx` values SHALL
be contiguous integers starting at 0.

#### Scenario: occurrenceIdx values are contiguous and zero-based
- **WHEN** a bundle is compiled from a valid ChordPro source
- **THEN** `occurrences[i].occurrenceIdx === i` for all `i`

#### Scenario: Every chord slot references its occurrence
- **WHEN** a slot in `lines[]` carries a `chord` field
- **THEN** it also carries an `occurrenceIdx` that matches exactly one entry in `occurrences[]`

### Requirement: SyncPlayData structure
A `SyncPlayData` object SHALL conform to:

```typescript
{
  transcriptionVersion?: number   // optional; enables stale-sync detection
  timestamps:            number[] // timestamps[i] = start time (seconds) for occurrences[i]
}
```

`timestamps.length` SHALL equal `bundle.occurrences.length` for a fully-tapped
sync. A partially-tapped sync may be shorter; missing entries mean those
occurrences have no timing yet.

#### Scenario: timestamps array length matches occurrences
- **WHEN** a sync is complete (all chords tapped)
- **THEN** `syncPlay.timestamps.length === bundle.occurrences.length`

#### Scenario: Partial sync is valid
- **WHEN** a sync session was interrupted before all chords were tapped
- **THEN** `syncPlay.timestamps.length < bundle.occurrences.length` is accepted without error

### Requirement: Player joins TranscriptionBundle and SyncPlayData at runtime
The player SHALL accept a `TranscriptionBundle` and a `SyncPlayData` as
independent inputs. It SHALL NOT require them to be pre-merged. The active
occurrence is determined by binary-searching `SyncPlayData.timestamps` for the
current playback position, yielding an `occurrenceIdx`, which is then resolved to
`(lineIdx, slotIdx)` via `bundle.occurrences`.

#### Scenario: Correct slot is highlighted for current time
- **WHEN** the playback position is between `timestamps[i]` and `timestamps[i+1]`
- **THEN** the slot at `(bundle.occurrences[i].lineIdx, bundle.occurrences[i].slotIdx)` is highlighted

#### Scenario: Switching sync does not reload the bundle
- **WHEN** the user selects a different `SyncPlayData` for the same `TranscriptionBundle`
- **THEN** only the `SyncPlayData` reference changes; the bundle is not re-fetched or re-parsed

### Requirement: Version field
Every `TranscriptionBundle` SHALL carry a `version` field (integer, starting at 1).
The player SHALL log a console warning (not throw) when it encounters a version it
does not recognise.

#### Scenario: Known version loads silently
- **WHEN** the player loads a bundle with a known `version`
- **THEN** no warning is logged

#### Scenario: Unknown version logs a warning
- **WHEN** the player loads a bundle with an unrecognised `version`
- **THEN** the player logs a console warning and attempts to render the bundle anyway
