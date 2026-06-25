## Why

The current `TranscriptionBundle` uses a flat `sections[]` structure that silently drops any ChordPro content not wrapped in a named section directive (verse/chorus/bridge), and the compiler carries a wrong comment claiming chordsheetjs crashes on `[*content]` annotations — it doesn't crash, it just puts the content in a different field. Together these two issues make the data model both lossy and misleading.

## What Changes

- **Fix misleading comment** in `compile.ts` and `gen-fixture.mjs`: replace the wrong "crashes" claim with the accurate explanation that chordsheetjs stores `[*content]` in `.annotation`, not `.chords`, so the pre-processing workaround exists to bridge that gap.
- **Remove the pre-processing hack** (`ANNOT_RE` / `[__ANNOTn__]` substitution): instead read `item.annotation` directly from the chordsheetjs AST item alongside `item.chords`. This is cleaner and correct.
- **BREAKING: Rename `sections[]` → `body: Block[]`** in `TranscriptionBundle`, where `Block = Line | Section`. A `Section` holds `body: Block[]` (recursive); a `Line` holds `segments: Segment[]`.
- **BREAKING: Rename `Slot` → `Segment`**, adding an `annotation?` field for display-only markers (bar lines, etc.) that sit in the chord row but carry no `occurrenceIdx`.
- **Relax section filtering**: the compiler currently drops every paragraph not wrapped in a named section directive (`SKIP_PARAGRAPH_TYPES` covers `'none'`, `'indeterminate'`, `'tab'`, `''`). Under the new model, `'tab'` and intentionally-blank paragraphs are still dropped, but chord/annotation-bearing lines between sections are emitted as top-level `Line` blocks in `body[]`.
- **Update `Occurrence` addressing**: replace the current `sectionIdx / lineIdx / slotIdx` triple with a `path: number[]` into `body[]` plus `segmentIdx`, making addressing correct for both top-level lines and section-nested lines without requiring special-cased null indices.

## Capabilities

### New Capabilities

_(none — this change refines existing capabilities)_

### Modified Capabilities

- `transcription-bundle-schema`: **BREAKING** structural changes — `sections[]` becomes `body: Block[]`, `Slot` becomes `Segment` with an `annotation` field, `Occurrence` uses path-based addressing.
- `chordpro-parser`: annotation handling changes from pre-processing hack to direct `.annotation` field read; section filtering is relaxed to include top-level chord lines.

## Impact

- `frontend/src/types/transcriptionBundle.ts` — new `Block`, `Segment`, updated `Occurrence` types; remove `Section`/`Slot` or alias for migration.
- `frontend/src/compiler/compile.ts` — remove `prepareSource` annotation extraction; read `item.annotation`; emit `Line` blocks at top level; update occurrence path construction.
- `frontend/scripts/gen-fixture.mjs` — same compiler logic mirroring; fix comment.
- `frontend/src/__tests__/` — compiler tests need updating for new type shapes.
- `frontend/src/fixtures/sample.bundle.json` — must be regenerated after compiler change.
- `frontend/src/components/` — any component iterating `bundle.sections` must switch to `bundle.body` with block-type discrimination.
- `openspec/specs/transcription-bundle-schema/spec.md` and `openspec/specs/chordpro-parser/spec.md` — delta specs capture requirement changes.
