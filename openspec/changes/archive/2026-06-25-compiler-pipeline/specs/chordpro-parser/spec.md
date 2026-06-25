## ADDED Requirements

### Requirement: Parse chord-lyric lines
The parser SHALL recognise lines containing ChordPro chord annotations in the
form `[ChordName]` interleaved with lyric text, and split each such line into an
ordered list of slots. Each slot SHALL carry the chord name (if any) and the text
run that follows it (if any). A chord annotation with no following text produces a
slot with `chord` only; a text run before the first chord on a line produces a
lyric-only slot.

#### Scenario: Mixed chord-and-lyric line is split into slots
- **WHEN** a line is `[Am]Look at this [C]photograph`
- **THEN** the parser produces two slots: `{ chord: "Am", text: "Look at this " }` and `{ chord: "C", text: "photograph" }`

#### Scenario: Leading text before first chord
- **WHEN** a line is `The [G]sun goes [D]down`
- **THEN** the parser produces three slots: `{ text: "The " }`, `{ chord: "G", text: "sun goes " }`, `{ chord: "D", text: "down" }`

#### Scenario: Chord-only slot at end of line
- **WHEN** a line ends with a bare chord annotation such as `[Am]words [C]`
- **THEN** the final slot has `chord: "C"` and no `text` field (or empty text)

#### Scenario: Lyric-only line produces a single lyric slot
- **WHEN** a line contains no chord annotations
- **THEN** the parser produces a single slot with `text` equal to the full line content and no `chord`

### Requirement: Anchor word extraction
For every chord slot, the parser SHALL extract the `anchorWord` as the first
non-whitespace word from the slot's `text` run. If the text run is absent or
contains only whitespace, `anchorWord` SHALL be `undefined`.

#### Scenario: Anchor word is extracted from following text
- **WHEN** a slot is `{ chord: "Am", text: "Look at this " }`
- **THEN** `anchorWord` is `"Look"`

#### Scenario: No anchor when chord has no following text
- **WHEN** a slot has a chord but no text (or only whitespace)
- **THEN** `anchorWord` is `undefined`

### Requirement: Section directives
The parser SHALL recognise ChordPro section directives (`{verse}`, `{verse:Label}`,
`{chorus}`, `{bridge}`, `{tab}`, `{end_of_verse}`, `{end_of_chorus}`, etc.) and
attach the current section label to subsequent lines until the next section
directive. Lines before any section directive have no section label.

#### Scenario: Section label is attached to following lines
- **WHEN** a `{verse: Verse 1}` directive precedes chord-lyric lines
- **THEN** those lines carry `section: "Verse 1"` until the next section directive

#### Scenario: Lines before any directive have no section
- **WHEN** chord-lyric lines appear before any section directive
- **THEN** those lines have no `section` field

### Requirement: Metadata directives
The parser SHALL recognise standard ChordPro metadata directives — `{title:}`,
`{artist:}`, `{key:}`, `{capo:}` — and return them as a structured metadata map
on the parse output. Unknown directives SHALL be silently ignored.

#### Scenario: Title and artist are extracted
- **WHEN** the source contains `{title: Photograph}` and `{artist: Nickelback}`
- **THEN** the parse output's metadata map contains `{ title: "Photograph", artist: "Nickelback" }`

#### Scenario: Unknown directives do not cause errors
- **WHEN** the source contains a directive not in the recognised set
- **THEN** the parser ignores it and continues without throwing

### Requirement: Blank lines and comments
The parser SHALL skip blank lines and ChordPro comment lines (lines starting with
`#`). They SHALL produce no slots and no directives in the output.

#### Scenario: Blank lines are skipped
- **WHEN** the source contains consecutive blank lines between sections
- **THEN** the parse output contains no empty slot lists corresponding to those lines

#### Scenario: Comment lines are skipped
- **WHEN** a line begins with `#`
- **THEN** that line is not reflected in the parse output

### Requirement: v1 scope — inline only
The parser SHALL NOT attempt to expand section references (`{chorus}` as a
playback reference) or repeat markers (`x4`). These constructs SHALL be treated
as section directives (labels only) in v1. Unrolling is deferred to v2.

#### Scenario: Repeat marker is not expanded
- **WHEN** the source contains a `{chorus}` reference with no inline content
- **THEN** the parser treats it as a section boundary, not a content insertion point
