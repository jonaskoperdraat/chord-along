## MODIFIED Requirements

### Requirement: TranscriptionBundle structure
A `TranscriptionBundle` SHALL conform to the following shape:

```typescript
{
  source:      SourceDescriptor
  version:     number
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

## REMOVED Requirements

### Requirement: (implicit) sections[] is the top-level content array
**Reason**: Replaced by `body: Section` (a single root section containing all content). The flat `sections[]` array could not represent content between section directives.
**Migration**: Replace all `bundle.sections` access with iteration over `bundle.body.body`; filter for `block.kind === 'section'` where section-specific behavior is needed.
