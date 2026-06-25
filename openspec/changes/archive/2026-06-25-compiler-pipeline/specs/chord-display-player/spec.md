## MODIFIED Requirements

### Requirement: Chord and lyric rendering
The display SHALL render a `TranscriptionBundle`'s `lines[]` as a chord sheet:
each line shows chord names above the corresponding lyric text, matching standard
ChordPro display conventions. Slots without a chord show only text; slots without
text show only the chord.

#### Scenario: Line with chords and lyrics renders correctly
- **WHEN** a line contains slots with both `chord` and `text` fields
- **THEN** chord names appear visually above their associated lyric text

#### Scenario: Lyric-only slot renders without chord row
- **WHEN** a slot has `text` but no `chord`
- **THEN** no chord label is shown for that slot

#### Scenario: Section label is displayed
- **WHEN** a line has a `section` field (e.g., `"Verse 1"`)
- **THEN** the section label is shown above that line

### Requirement: Active slot highlight
The display SHALL highlight the currently active slot based on the playback
engine's current `activeEvent`. The active slot is determined by
`(lineIdx, slotIdx)` resolved from the current `occurrenceIdx` via
`bundle.occurrences`. Exactly one slot SHALL be highlighted at a time during
playback; no slot is highlighted when playback has not started or has ended.

#### Scenario: Active slot is visually distinct
- **WHEN** the playback engine reports an active event at `(lineIdx, slotIdx)`
- **THEN** the slot at that position is rendered with a distinct highlight style

#### Scenario: No highlight before playback starts
- **WHEN** the playback position is before the first timestamp in `SyncPlayData`
- **THEN** no slot is highlighted

#### Scenario: Highlight advances with playback
- **WHEN** the playback position moves past a timestamp in `SyncPlayData.timestamps`
- **THEN** the highlight moves to the corresponding slot and the previous slot loses its highlight

### Requirement: Playback engine integration
The display SHALL consume a reactive `activeEvent` (containing `lineIdx` and
`slotIdx`, or null) provided by `usePlaybackEngine`. The engine SHALL accept
`TranscriptionBundle` and `SyncPlayData` as separate reactive inputs. The display
component MUST NOT contain timer logic or directly interact with the YouTube player.

#### Scenario: Display reacts to activeEvent changes
- **WHEN** the `activeEvent` reactive value changes
- **THEN** the displayed highlight updates on the next render frame without a full component remount

#### Scenario: Engine accepts bundle and syncPlay as separate inputs
- **WHEN** `usePlaybackEngine` is called with a `TranscriptionBundle` ref and a `SyncPlayData` ref
- **THEN** it returns a reactive `activeEvent` that correctly tracks the playback position
