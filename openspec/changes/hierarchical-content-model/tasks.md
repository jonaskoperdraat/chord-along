## 1. TypeScript Types

- [x] 1.1 In `frontend/src/types/transcriptionBundle.ts`: add `Block`, `Section` (with `kind: 'section'`), `Line` (with `kind: 'line'`), and `Segment` (with `chord?`, `annotation?`, `text?`, `occurrenceIdx?`) types; update `Occurrence` to use `path: number[]` and `segmentIdx: number` instead of `sectionIdx/lineIdx/slotIdx`; replace `TranscriptionBundle.sections: Section[]` with `body: Section` (a single root section, always present, no label or type); remove the old `Section` and `Slot` types
- [x] 1.2 Add `resolveLine(root: Section, path: number[]): Line` utility to a shared util file (e.g. `frontend/src/utils/bundleUtils.ts`); path navigates `root.body[]` by successive indices

## 2. Compiler (`compile.ts`)

- [x] 2.1 Fix the misleading comment in `prepareSource`: remove the "crashes" claim; explain that `[*content]` goes into `item.annotation` (not `item.chords`), so without pre-processing annotation content would be silently dropped
- [x] 2.2 Remove the `[__ANNOTn__]` extraction from `prepareSource` (keep the space-only line normalisation); remove `ANNOT_RE` and the `annotations[]` array
- [x] 2.3 Rewrite the compile loop to: read `item.annotation` alongside `item.chords`; emit `annotation` segments for non-empty `item.annotation`; skip segments where both `chords` and `annotation` are absent/empty
- [x] 2.4 Emit top-level `Line` blocks (not inside a `Section`) for paragraphs whose `type` is `'none'`, `'indeterminate'`, or `''` but which contain at least one chord or annotation segment; keep dropping `'tab'` paragraphs and paragraphs with no content
- [x] 2.5 Replace `sections: Section[]` output with `body: Section` (a single root section); build named `Section` children and inter-section `Line` children inside `root.body[]`
- [x] 2.6 Update `Occurrence` construction to use `path` (e.g. `[i]` for a line that is `root.body[i]`, `[i, j]` for a line inside a named section at `root.body[i]`) and `segmentIdx` instead of the old triple

## 3. Fixture Generator (`gen-fixture.mjs`)

- [x] 3.1 Mirror all changes from tasks 2.1–2.6 in `frontend/scripts/gen-fixture.mjs` (plain JS version of the compiler)
- [x] 3.2 Run `node scripts/gen-fixture.mjs` from `frontend/` and verify it produces a valid `sample.bundle.json` with `body[]` containing sections and at least one top-level `Line` block (for the `[E] [*|] [B]` interlude lines in the Nickelback fixture)

## 4. Player Components

- [x] 4.1 Update `frontend/src/composables/usePlaybackEngine.ts`: replace `{ sectionIdx, lineIdx, slotIdx }` active event with `{ path: number[], segmentIdx: number }`; use `resolveLine` to navigate occurrences
- [x] 4.2 Update `frontend/src/components/ChordDisplay.vue`: replace the `bundle.sections` iteration with iteration over `bundle.body.body` (root section's children) using `block.kind` discrimination; replace the `slots` iteration with `segments`; update the `segmentMap` key and `isActive` comparison to use path + segmentIdx; render `Line` blocks directly and `Section` blocks as labelled containers

## 5. Tests

- [x] 5.1 Update existing compiler unit tests in `frontend/src/__tests__/` to use the new type shapes (`body[]`, `segments[]`, path-based occurrence addressing)
- [x] 5.2 Add test: a ChordPro source with a chord-only line between two named sections produces a top-level `Line` block in `body[]` for that line
- [x] 5.3 Add test: `[*|]` on a line produces a `Segment` with `annotation: "|"` and no `occurrenceIdx`
- [x] 5.4 Add test: `[*]` (bare asterisk) produces no segment

## 6. Spec Sync

- [x] 6.1 Run `/opsx:sync` to merge the delta specs (`transcription-bundle-schema` and `chordpro-parser`) into `openspec/specs/`
