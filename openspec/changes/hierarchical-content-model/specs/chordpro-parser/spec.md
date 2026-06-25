## MODIFIED Requirements

### Requirement: Parse chord-lyric lines
The parser SHALL recognise lines containing ChordPro chord annotations in the
form `[ChordName]` interleaved with lyric text, and split each such line into an
ordered list of segments. Each segment SHALL carry the chord name (if any), the
annotation text (if any), and the text run that follows (if any). A chord
annotation with no following text produces a segment with `chord` only; a text
run before the first chord on a line produces a text-only segment.

#### Scenario: Mixed chord-and-lyric line is split into segments
- **WHEN** a line is `[Am]Look at this [C]photograph`
- **THEN** the parser produces two segments: `{ chord: "Am", text: "Look at this " }` and `{ chord: "C", text: "photograph" }`

#### Scenario: Leading text before first chord
- **WHEN** a line is `The [G]sun goes [D]down`
- **THEN** the parser produces three segments: `{ text: "The " }`, `{ chord: "G", text: "sun goes " }`, `{ chord: "D", text: "down" }`

#### Scenario: Chord-only segment at end of line
- **WHEN** a line ends with a bare chord annotation such as `[Am]words [C]`
- **THEN** the final segment has `chord: "C"` and no `text` field (or empty text)

#### Scenario: Lyric-only line produces a single text segment
- **WHEN** a line contains no chord annotations
- **THEN** the parser produces a single segment with `text` equal to the full line content and no `chord`

### Requirement: Annotation segments
The parser SHALL recognise ChordPro `[*content]` annotation markers and emit them
as `Segment` entries with `annotation` set to the content text and no `chord` or
`occurrenceIdx`. These segments appear in the chord row during display but are
never sync occurrences. `[*]` (bare asterisk, no content) SHALL be ignored.

#### Scenario: Bar line annotation becomes an annotation segment
- **WHEN** a line contains `[E] [*|] [B]`
- **THEN** the parser produces three segments: `{ chord: "E" }`, `{ annotation: "|" }`, and `{ chord: "B" }`

#### Scenario: Named annotation becomes an annotation segment
- **WHEN** a line contains `[A] [*Fine] [D]`
- **THEN** the parser produces three segments: `{ chord: "A" }`, `{ annotation: "Fine" }`, and `{ chord: "D" }`

#### Scenario: Bare asterisk with no content is ignored
- **WHEN** a line contains `[A] [*] [D]`
- **THEN** `[*]` produces no segment; the line contains two chord segments for A and D

### Requirement: Top-level lines are included in output
The parser SHALL include chord-bearing and annotation-bearing lines that appear
outside any section directive. These lines are emitted as top-level `Line` blocks
in `body[]`, not discarded. Pure-commentary paragraphs (`{c:}` blocks) and guitar
tab blocks (`{start_of_tab}…{end_of_tab}`) are still excluded.

#### Scenario: Chord-only line between sections is emitted as top-level line
- **WHEN** a ChordPro source has `[E] [*|] [B]` between an `{end_of_chorus}` and a `{start_of_verse}`
- **THEN** the compiled body contains a top-level `Line` block with three segments for that line

#### Scenario: Tab blocks are still excluded
- **WHEN** a source contains a `{start_of_tab}…{end_of_tab}` block
- **THEN** that content produces no blocks in `body[]`

### Requirement: Anchor word extraction
For every chord segment, the parser SHALL extract the `anchorWord` as the first
non-whitespace word from the segment's `text` run. If the text run is absent or
contains only whitespace, `anchorWord` SHALL be `undefined`.

#### Scenario: Anchor word is extracted from following text
- **WHEN** a segment is `{ chord: "Am", text: "Look at this " }`
- **THEN** `anchorWord` is `"Look"`

#### Scenario: No anchor when chord has no following text
- **WHEN** a segment has a chord but no text (or only whitespace)
- **THEN** `anchorWord` is `undefined`

### Requirement: Section directives
The parser SHALL recognise ChordPro section directives (`{verse}`, `{verse:Label}`,
`{chorus}`, `{bridge}`, `{tab}`, `{end_of_verse}`, `{end_of_chorus}`, etc.) and
group subsequent lines as `Line` blocks inside a `Section` block in `body[]`.

#### Scenario: Section label is attached to enclosed lines
- **WHEN** a `{verse: Verse 1}` directive precedes chord-lyric lines before `{end_of_verse}`
- **THEN** those lines are emitted as a `Section` block with `label: "Verse 1"` and `type: "verse"` containing the lines as `Line` blocks in `body[]`

#### Scenario: Lines before any directive appear as top-level lines
- **WHEN** chord-lyric lines appear before any section directive
- **THEN** those lines appear as top-level `Line` blocks at the start of `body[]`
