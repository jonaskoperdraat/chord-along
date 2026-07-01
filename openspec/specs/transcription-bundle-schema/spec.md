## Requirements

### Requirement: TranscriptionBundle structure
A `TranscriptionBundle` SHALL conform to the following shape:

```typescript
{
  source:      SourceDescriptor
  version:     number
  sourceHash:  string            // SHA-256 of UTF-8 source, hex lower-case
  metadata:    { title?: string, artist?: string, key?: string, capo?: string }
  body:        Section           // always the root section; no label or type
  occurrences: Occurrence[]
}

type Block = Section | Line

type Section = {
  kind:    'section'
  label?:  string                // absent on the root section
  type?:   string                // 'verse' | 'chorus' | 'bridge' | …; absent on root
  body:    Block[]
}

type Line = {
  kind:     'line'
  segments: Segment[]
}

type Segment = {
  text?:          string
  chord?:         string         // real harmony chord; occurrenceIdx also present when set
  annotation?:    string         // display-only raw string (e.g. "|"); no occurrenceIdx
  occurrenceIdx?: number         // present only when chord is set
}

type Occurrence = {
  occurrenceIdx: number
  path:          number[]        // navigation into bundle.body.body[] by successive array indices
  segmentIdx:    number          // index within the resolved Line's segments[]
  chord:         string
  anchorWord?:   string
}

type SourceDescriptor = { kind: "youtube"; videoId: string; offsetSec: number }
                      | { kind: "spotify"; trackId: string; offsetSec: number }
                      | { kind: "file";    uri: string;     offsetSec: number }
```

#### Scenario: Bundle always has a root section
- **WHEN** a bundle is compiled from any valid ChordPro source
- **THEN** `bundle.body.kind === 'section'` and `bundle.body.label === undefined` and `bundle.body.type === undefined`

#### Scenario: Named sections are children of root
- **WHEN** the source contains `{start_of_chorus}…{end_of_chorus}`
- **THEN** `bundle.body.body` contains a `Section` block with `kind: 'section'` and `type: 'chorus'`

#### Scenario: Inter-section lines are children of root
- **WHEN** the source contains chord-bearing lines between two named section directives
- **THEN** `bundle.body.body` contains `Line` blocks (with `kind: 'line'`) at those positions

#### Scenario: Discriminant field enables type narrowing
- **WHEN** iterating a section's `body[]`, a block has `kind === 'section'`
- **THEN** it is treated as a `Section` and its `.body[]` is rendered recursively

#### Scenario: Discriminant field enables type narrowing for lines
- **WHEN** iterating a section's `body[]`, a block has `kind === 'line'`
- **THEN** it is treated as a `Line` and its `.segments[]` are rendered

### Requirement: occurrences[] is the unrolled chord sequence
`occurrences[]` SHALL contain exactly one entry per chord-bearing segment in the
bundle, in the order they appear in the performed (unrolled) sequence. In v1
(inline-only ChordPro) this equals document order. `occurrenceIdx` values SHALL
be contiguous integers starting at 0.

#### Scenario: occurrenceIdx values are contiguous and zero-based
- **WHEN** a bundle is compiled from a valid ChordPro source
- **THEN** `occurrences[i].occurrenceIdx === i` for all `i`

#### Scenario: Every chord segment references its occurrence
- **WHEN** a segment in the content tree carries a `chord` field
- **THEN** it also carries an `occurrenceIdx` that matches exactly one entry in `occurrences[]`

### Requirement: Occurrence path addresses a Line in the root section's body
`Occurrence.path` SHALL be an array of non-negative integers that navigates into
`bundle.body.body[]` by successive array indices to resolve to the `Line`
containing the segment at `segmentIdx`. A path of length 1 addresses a direct
child `Line` of the root section; a path of length 2 addresses a `Line` inside a
named child `Section` of the root.

#### Scenario: Path of length 1 resolves to a root-level line
- **WHEN** `occ.path = [2]` and `bundle.body.body[2].kind === 'line'`
- **THEN** `(bundle.body.body[2] as Line).segments[occ.segmentIdx]` is the referenced segment

#### Scenario: Path of length 2 resolves to a line inside a named section
- **WHEN** `occ.path = [0, 1]` and `bundle.body.body[0].kind === 'section'`
- **THEN** `((bundle.body.body[0] as Section).body[1] as Line).segments[occ.segmentIdx]` is the referenced segment

### Requirement: Annotation segments carry no occurrenceIdx
A `Segment` with an `annotation` field and no `chord` field SHALL NOT carry an
`occurrenceIdx`. Such segments are display-only and are never highlighted during
playback.

#### Scenario: Bar line annotation is not a sync occurrence
- **WHEN** a ChordPro source contains `[*|]` (a bar line annotation)
- **THEN** the compiled bundle contains a `Segment` with `annotation: "|"` and no `occurrenceIdx`

#### Scenario: Annotation content is the raw string from the source
- **WHEN** a ChordPro source contains `[*Fine]`
- **THEN** the compiled bundle contains a `Segment` with `annotation: "Fine"` (verbatim)

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
`(path, segmentIdx)` via `bundle.occurrences`.

#### Scenario: Correct segment is highlighted for current time
- **WHEN** the playback position is between `timestamps[i]` and `timestamps[i+1]`
- **THEN** the segment at `resolveLine(bundle.body, bundle.occurrences[i].path).segments[bundle.occurrences[i].segmentIdx]` is highlighted

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

### Requirement: TranscriptionBundle carries a sourceHash field

Every `TranscriptionBundle` SHALL carry a `sourceHash` field containing the
SHA-256 hash (hex-encoded, lower-case) of the UTF-8 ChordPro source text from
which the bundle was compiled. This field is the key used to detect stale syncs:
if `AnchorSidecar.sourceHash` does not equal the current bundle's `sourceHash`,
the sync was tapped against an older version of the transcription.

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
