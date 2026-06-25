## Context

The player currently loads a single hand-crafted `sample.play.json` fixture that
mixes transcription structure (`lines[]`, `events[]`) with timing data in one
blob. The new data model (chord-sync-design.md §4) separates these concerns:
`TranscriptionBundle` carries structure only, `SyncPlayData` carries timing only,
and the player joins them at runtime.

This change introduces the TypeScript compiler pipeline that makes that separation
real: a ChordPro parser that produces `TranscriptionBundle`, and an updated player
that consumes both artifacts separately.

## Goals / Non-Goals

**Goals:**
- A pure TypeScript `compile(source: string): TranscriptionBundle` function in
  `frontend/src/compiler/`.
- `TranscriptionBundle` and `SyncPlayData` TypeScript types replacing the old
  `PlayBundle` type.
- Player, playback engine, and chord display updated to accept the new types.
- Fixture migrated: `sample.bundle.json` + `sample.sync-play.json` replacing the
  combined `sample.play.json`.
- Full unit test coverage of the parser on edge cases.

**Non-Goals:**
- Authoritative Java backend compiler (separate change).
- ChordPro repeat/reference unrolling (v2 scope).
- Lezer grammar / CodeMirror syntax highlighting (editor change).
- Tap capture UI.
- Anchor-based rebase engine.

## Decisions

### 1. Use chordsheetjs, not a hand-rolled parser

[chordsheetjs](https://github.com/martijnversluis/chordsheetjs) (v15, typed) is a
mature ChordPro parser that handles the full spec: chord-lyric pairs, section
directives, metadata, comments, blank lines. Using it eliminates a significant
block of error-prone tokenisation work.

Our compiler becomes a thin **mapping layer**: call `ChordProParser.parse()`,
then walk the resulting `Song` to produce our `TranscriptionBundle`. The library
object model maps cleanly:

```
chordsheetjs                    →  our model
────────────────────────────────────────────────────
Song.bodyParagraphs             →  sections
  Paragraph.label               →  Line.section
  Paragraph.lines               →  Line[]
    Line.items (ChordLyricsPair) → Slot[]
      .chords                   →  Slot.chord
      .lyrics                   →  Slot.text
Song.title / .artist / .key     →  TranscriptionBundle.metadata
```

We parse with `chopFirstWord: false` (non-default) so each `ChordLyricsPair`
carries the full lyric text following the chord — letting us extract `anchorWord`
from the first word of `.lyrics` in one step without merging split pairs.

Note: `Song.expandedBodyParagraphs` expands inline `{chorus}` references — this
is the v2 unrolling hook; we use `bodyParagraphs` in v1.

### 2. Compiler module structure

The compiler directory is thin:

```
frontend/src/compiler/
  index.ts       // public API: export { compile }
  compile.ts     // compile(source): TranscriptionBundle — calls chordsheetjs, maps output
```

No separate `parser.ts` needed; the heavy lifting is delegated to the library.
`compile()` is a pure function: string in, `TranscriptionBundle` out.

### 3. `occurrenceIdx` on the slot, flat `occurrences[]` as index

Each chord slot carries `occurrenceIdx: number`. A parallel flat array
`occurrences[]` maps `occurrenceIdx → (lineIdx, slotIdx, chord, anchorWord)`.
The player binary-searches `SyncPlayData.timestamps` to find the current
`occurrenceIdx`, then resolves the visual position from `occurrences[]` without
walking the line tree.

Alternative considered: store only the flat index and have the player walk the
tree. Rejected — `occurrenceIdx` on the slot lets `ChordDisplay` highlight
correctly without a reverse-lookup, and the flat array is the fast search path.

### 4. Anchor word extraction at parse time

When the parser sees `[Am]this photograph`, it captures `"this"` as the
`anchorWord` for the Am occurrence. This is the first non-whitespace word of the
text run immediately following the chord bracket. It costs nothing at parse time
and populates the field the rebase engine will need — no separate "extract
anchors" step later.

If a chord has no following text (e.g., trailing `[A]` at end of line),
`anchorWord` is `undefined`.

### 5. Fixture migrated to two files

`sample.play.json` → `sample.bundle.json` + `sample.sync-play.json`.

Splitting them makes the architectural separation tangible and exercises the
exact code path the real authoring flow will use. `PlayerView` loads both and
passes them separately — making the join explicit in code, not hidden in the type.

### 6. `usePlaybackEngine` signature

Old: `(bundle: Ref<PlayBundle | null>, currentTime, playerState)`

New: `(bundle: Ref<TranscriptionBundle | null>, syncPlay: Ref<SyncPlayData | null>, currentTime, playerState)`

The engine binary-searches `syncPlay.timestamps` (replacing the `events[]` walk),
resolves `(lineIdx, slotIdx)` from `bundle.occurrences[i]`. The `activeEvent`
return shape is unchanged — `ChordDisplay` still receives `{ lineIdx, slotIdx }`.

## Risks / Trade-offs

**chordsheetjs output shape may drift across major versions** — the library is
on v15 and has breaking changes in its history. → Pin the version in
`package.json`; upgrade deliberately. Our mapping layer isolates consumers from
the library's internal types.

**`chopFirstWord: false` changes default behaviour** — other chordsheetjs users
default to `true`. → Not a risk for us since we own the only call site; document
the option explicitly in the compile function.

**Fixture split breaks any external references to `sample.play.json`** → Backend
currently loads `fixtures/sample.play.json` from classpath. The backend fixture
is a separate file (`backend/src/main/resources/fixtures/sample.play.json`) and
is not touched by this frontend change. No risk.

## Open Questions

- Should `SyncPlayData` carry a `transcriptionVersion` field from day one (for
  stale-sync detection), or defer until the backend persistence layer lands?
  Leaning toward including it as an optional field — zero cost now, useful later.
