---
name: compiler-pipeline-patterns
description: Recurring documentation and testability patterns observed in the chord-along compiler pipeline (frontend TypeScript side)
metadata:
  type: project
---

The compiler pipeline (ChordPro source → TranscriptionBundle + SyncPlayData) lives in `frontend/src/compiler/`.

**Established patterns to maintain:**
- `compile()` is a pure function: (source string, SourceDescriptor) → TranscriptionBundle. No side effects; easy to unit-test in isolation.
- `usePlaybackEngine` takes `bundle` and `syncPlay` as *separate* refs by design — swapping syncs at runtime should not require a bundle re-fetch. This is a non-obvious architectural choice documented in chord-sync-design.md §4/§5b.
- `occurrences[]` is parallel to `SyncPlayData.timestamps[]` by ordinal — `timestamps[i]` maps to `occurrences[i]`. This invariant is load-bearing for binary search in `usePlaybackEngine`.

**Recurring documentation gaps (fixed once; watch for recurrence):**
- `chopFirstWord: false` in chordsheetjs parse options — needs comment explaining why or new developers will remove it.
- `SKIP_PARAGRAPH_TYPES` set (formerly `NON_SECTION_TYPES`) — non-obvious that chordsheetjs emits 'none'/'indeterminate'/'' for untagged paragraphs. Consequence: bare chord lines outside named sections produce NO output (silently dropped). Now documented in compile.ts.
- `normalizeSource()` — works around two chordsheetjs v15 bugs: (1) `[*|]`/`[*]` bar markers crash the parser, (2) space-only lines cause section directives to merge into the preceding indeterminate paragraph. These bugs are commented in both compile.ts and gen-fixture.mjs.
- `firstString()` helper — chordsheetjs returns some metadata as string|string[]; the helper is glue code, not domain logic.
- `anchorWord` on Occurrence — needs cross-reference to §6.2 rebase use; without it looks like dead data.
- `SyncPlayData.transcriptionVersion` — needs explanation that it is a stale-sync detector, not a migration key.
- `gen-fixture.mjs` duplicates compile logic in plain JS because it runs outside Vite/TypeScript. This is now documented in the script header.

**Testability note:** `compile()` now has comprehensive unit tests (sections 3.1–3.15 in compile.test.ts) including coverage of `normalizeSource` preprocessing, `SKIP_PARAGRAPH_TYPES`, anchorWord edge cases, and multi-section end-to-end structure. The `ChordDisplay` `segmentMap` territory-walk is also tested (ChordDisplay.test.ts). Test suite as of 2026-06-25: 61 tests passing across 3 test files.

**Known chordsheetjs quirk (documented in tests):** An orphaned chord line between `{end_of_section}` and `{start_of_next_section}` — with no blank line separator — causes chordsheetjs to merge the orphan AND the following section directive into one `indeterminate` paragraph, silently dropping the entire following section. A blank line between orphan and the next directive prevents this.

**Default parameter risk:** `compile(source)` defaults `sourceDescriptor` to `{ kind: 'youtube', videoId: '', offsetSec: 0 }`. Empty videoId is silently accepted and would produce a broken player. Caller validation or a required parameter is worth considering.

**Fixture generation workflow (documented in CLAUDE.md as of 2026-06-25):** Edit `sample.chordpro` → run `node scripts/gen-fixture.mjs` → open `http://localhost:5173/tap.html` and tap spacebar to capture timestamps → paste into `sample.sync-play.json`.

**Why:** Documented after the first compiler pipeline audit (2026-06-24). The two-ref separation and the chopFirstWord option are the most likely things to be misunderstood or reverted by a future developer.

**How to apply:** When reviewing changes to `compile.ts`, `usePlaybackEngine.ts`, or `transcriptionBundle.ts`, verify these invariants and comments are still present. When a new sync-switching feature is added, remind the developer that the two-ref design makes this a client-side swap.
