## ADDED Requirements

### Requirement: Chord and lyric rendering
The display SHALL render a playback bundle's `lines[]` as a chord sheet: each line shows chord names above the corresponding lyric text, matching standard ChordPro display conventions. Slots without a chord show only text; slots without text show only the chord.

#### Scenario: Line with chords and lyrics renders correctly
- **WHEN** a line contains slots with both `chord` and `text` fields
- **THEN** chord names appear visually above their associated lyric text

#### Scenario: Lyric-only slot renders without chord row
- **WHEN** a slot has `text` but no `chord`
- **THEN** no chord label is shown for that slot

#### Scenario: Section label is displayed
- **WHEN** a line has a `section` field (e.g., `"verse1"`)
- **THEN** the section label is shown above that line

### Requirement: Active slot highlight
The display SHALL highlight the currently active slot (the one whose chord is currently sounding) based on the playback engine's current event. Exactly one slot SHALL be highlighted at a time during playback; no slot is highlighted when playback has not started or has ended.

#### Scenario: Active slot is visually distinct
- **WHEN** the playback engine reports an active event at `(lineIdx, slotIdx)`
- **THEN** the slot at that position is rendered with a distinct highlight style

#### Scenario: No highlight before playback starts
- **WHEN** the playback position is before the first event's timestamp
- **THEN** no slot is highlighted

#### Scenario: Highlight advances with playback
- **WHEN** the playback position moves past an event's timestamp
- **THEN** the highlight moves to that event's slot and the previous slot loses its highlight

### Requirement: Playback engine integration
The display SHALL consume a reactive `activeEvent` (containing `lineIdx` and `slotIdx`, or null) provided by the playback engine. The display component MUST NOT contain timer logic or directly interact with the YouTube player.

#### Scenario: Display reacts to activeEvent changes
- **WHEN** the `activeEvent` reactive value changes
- **THEN** the displayed highlight updates on the next render frame without a full component remount
