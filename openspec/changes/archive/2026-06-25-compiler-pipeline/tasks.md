## 1. Types

- [x] 1.1 Create `frontend/src/types/transcriptionBundle.ts` — define `TranscriptionBundle`, `Line`, `Slot`, `Occurrence`, `SourceDescriptor`, `SyncPlayData` TypeScript types
- [x] 1.2 Delete `frontend/src/types/playBundle.ts` and remove all imports of `PlayBundle`

## 2. Compiler

- [x] 2.1 Install `chordsheetjs` — `npm install chordsheetjs` in `frontend/`
- [x] 2.2 Create `frontend/src/compiler/compile.ts` — `compile(source: string): TranscriptionBundle`: call `new ChordProParser().parse(source, { chopFirstWord: false })`, walk `song.bodyParagraphs` to build `lines[]` with `occurrenceIdx` on chord slots, build flat `occurrences[]` with `anchorWord`, extract metadata from `song.title / .artist / .key / .capo`
- [x] 2.3 Create `frontend/src/compiler/index.ts` — re-export `compile` as the public API

## 3. Compiler unit tests

- [x] 3.1 Test mapping of chord-lyric pairs: mixed chord+lyric slot, lyric-only slot, chord-only trailing slot
- [x] 3.2 Test anchor word extraction: first word of lyrics present; whitespace-only or absent lyrics → `anchorWord` undefined
- [x] 3.3 Test section labels: `Paragraph.label` attached to all lines in paragraph; lines before any directive have no section
- [x] 3.4 Test metadata extraction: title, artist, key, capo populated in `metadata` map
- [x] 3.5 Test `occurrences[]` is contiguous, zero-based, and covers every chord-bearing slot in document order
- [x] 3.6 Test multi-section song end-to-end: compile a short ChordPro fixture and assert the full `TranscriptionBundle` shape

## 4. Fixture migration

- [x] 4.1 Add ChordPro source file `frontend/src/fixtures/sample.chordpro` (the Nickelback Photograph verse/chorus used in the existing fixture)
- [x] 4.2 Create `frontend/src/fixtures/sample.bundle.json` by compiling the source — `lines[]` with `occurrenceIdx` annotations, `occurrences[]` index, `source` descriptor, `version: 1`
- [x] 4.3 Create `frontend/src/fixtures/sample.sync-play.json` — `timestamps[]` array extracted from the existing `events[]` in `sample.play.json`, in occurrence order
- [x] 4.4 Delete `frontend/src/fixtures/sample.play.json`

## 5. Playback engine update

- [x] 5.1 Update `usePlaybackEngine` signature to accept `bundle: Ref<TranscriptionBundle | null>` and `syncPlay: Ref<SyncPlayData | null>` as separate inputs
- [x] 5.2 Replace `events[]` walk with binary search on `syncPlay.timestamps`; resolve `(lineIdx, slotIdx)` via `bundle.occurrences[occurrenceIdx]`
- [x] 5.3 Update `usePlaybackEngine` tests to use new input shape

## 6. Player and display wiring

- [x] 6.1 Update `PlayerView.vue` to load `sample.bundle.json` and `sample.sync-play.json` separately; pass both to `usePlaybackEngine`
- [x] 6.2 Update `ChordDisplay.vue` prop types from `PlayBundle` to `TranscriptionBundle`
- [x] 6.3 Update the API client usage in `PlayerView` (or stub it) to reflect that `getSongBundle` will eventually return `TranscriptionBundle` — for now, load from fixture directly

## 7. Smoke test

- [x] 7.1 Run `npm run dev`, load the player, verify chords highlight in sync with the Photograph fixture
- [x] 7.2 Run `npm run build` — no TypeScript errors
- [x] 7.3 Run `npm run lint` — no lint errors
