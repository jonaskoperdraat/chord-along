## Why

The player currently consumes a hand-crafted fixture in a combined format that mixes transcription structure with timing data. Before the tap capture UI or any real authoring flow can exist, we need a parser that turns ChordPro source text into a structured `TranscriptionBundle` — the foundation every downstream piece depends on.

## What Changes

- Introduce a TypeScript ChordPro parser (`frontend/src/compiler/`) that tokenises inline ChordPro text into `lines[]` and a flat `occurrences[]` index (the unrolled chord sequence).
- Define the `TranscriptionBundle` TypeScript type replacing the old combined `PlayBundle` shape: structure lives here, timestamps do not.
- Update the existing fixture and player to consume the new `TranscriptionBundle` schema — timestamps in `occurrences[]` are absent; a co-loaded `SyncPlayData` (flat `timestamps[]`) will supply them.
- Retire the old `events[]`-embedded-in-bundle approach; the player now binary-searches `SyncPlayData.timestamps` and resolves position via `occurrenceIdx` on each slot.
- Update `usePlaybackEngine` to accept `TranscriptionBundle` + `SyncPlayData` as separate inputs.

## Capabilities

### New Capabilities

- `chordpro-parser`: Parse inline ChordPro text into a structured `TranscriptionBundle`. Handles chord annotations (`[Am]`), lyric text, section directives (`{verse:}`, `{chorus:}`, etc.), and metadata directives (`{title:}`, `{artist:}`, `{key:}`, `{capo:}`). v1 scope: inline-only, no repeat/reference unrolling.
- `transcription-bundle-schema`: The shape of the derived transcription artifact — `lines[]` (with `occurrenceIdx` on chord slots) and a flat `occurrences[]` index mapping ordinal → `(lineIdx, slotIdx, chord, anchorWord?)`. Paired with `SyncPlayData` (`timestamps[]`) at runtime; the two are never merged into a single blob.

### Modified Capabilities

- `playback-bundle-schema`: The old combined schema (timestamps embedded in slots, `events[]` index) is superseded. This spec is updated to reflect the separated model: `TranscriptionBundle` carries structure only; `SyncPlayData` carries timing only.
- `chord-display-player`: The player composable and component are updated to accept `TranscriptionBundle` + `SyncPlayData` as separate props/inputs rather than a single `PlayBundle`.

## Impact

- `frontend/src/types/playBundle.ts` — replaced by `frontend/src/types/transcriptionBundle.ts` (+ `syncPlayData.ts`)
- `frontend/src/compiler/` — new directory; `compile.ts` (mapping layer over chordsheetjs), `index.ts`
- `chordsheetjs` — new npm dependency (v15, typed)
- `frontend/src/composables/usePlaybackEngine.ts` — updated signatures
- `frontend/src/components/ChordDisplay.vue` — updated prop types
- `frontend/src/views/PlayerView.vue` — loads bundle and a stub `SyncPlayData` derived from the fixture
- `frontend/src/fixtures/sample.play.json` — migrated to new schema (split into `sample.bundle.json` + `sample.sync-play.json`, or restructured in place)
- `frontend/src/__tests__/` — new parser unit tests; updated engine tests
- `openspec/specs/playback-bundle-schema/spec.md` — updated to reflect new model
- `openspec/specs/chord-display-player/spec.md` — updated prop contract
- No backend changes in this slice (Java authoritative compiler is a future change)
