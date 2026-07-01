## Context

The current `TranscriptionBundle` models song content as a flat `sections: Section[]`, where every `Line` must live inside a named section (verse/chorus/bridge). The compiler drops all paragraphs not wrapped in a section directive. This means chord-only lines between sections (e.g. `[E] [*|] [B] [*|] [G] [*|] [A]` between a chorus and the next verse) are silently lost.

Separately, the compiler carries a wrong comment: it says chordsheetjs v15 "crashes" when `[*content]` annotations appear. It does not crash — it stores the annotation content in `.annotation`, not `.chords`. The pre-processing workaround (`[__ANNOTn__]` placeholders) exists because our compiler loop only reads `item.chords`. This can be fixed properly.

These two issues point at the same root cause: the data model is under-expressive relative to what ChordPro actually encodes.

## Goals / Non-Goals

**Goals:**
- Model song content as a tree rooted at a single root `Section`; its `body[]` holds named `Section` blocks and inter-section `Line` blocks, so all content is addressable uniformly.
- Rename `Slot` → `Segment` and add an `annotation?` field alongside `chord?` and `text?`, mirroring chordsheetjs's own AST distinction.
- Remove the `[__ANNOTn__]` pre-processing hack; read `item.annotation` directly from the chordsheetjs AST.
- Fix the misleading comment in `compile.ts` and `gen-fixture.mjs`.
- Update `Occurrence` addressing to work with the hierarchical body tree.

**Non-Goals:**
- Nested sections (ChordPro does not support them; the model supports it structurally but the compiler won't emit them in v1).
- Unrolling section references or repeats (still deferred to v2).
- Changing `SyncPlayData` format.
- Backend (Java) changes — the authoritative compiler in Quarkus is not yet implemented; these changes affect only the frontend TS compiler and fixture generator.

## Decisions

### Decision 1 — Type name for the recursive content node: `Block`

**Chosen: `Block`**

The node that can be either a `Line` or a container (`Section`) needs a union type name. Options considered:

| Name | Notes |
|------|-------|
| `Item` | Too generic (user's own objection) |
| `Node` | Tree-computing jargon; clashes with DOM |
| `Block` | Standard in document models (Markdown, Slate.js, ProseMirror); widely understood |
| `Stanza` | Musical/lyrical but confusingly close to "verse section" |
| `Entry` | Too generic |

`Block` is the right level of abstraction — it matches how document editors (ProseMirror, Slate) model "a block-level thing that is either a leaf or a container."

```typescript
type Block = Line | Section

type Section = {
  kind:    'section'
  label?:  string          // absent on the root section
  type?:   string          // 'verse' | 'chorus' | 'bridge' | …; absent on root
  body:    Block[]
}

type Line = {
  kind:     'line'
  segments: Segment[]
}
```

The `kind` discriminant is required for type narrowing without `instanceof`.

`TranscriptionBundle.body` is always a single root `Section` (no `label`, no `type`), not a `Block[]`. All named sections and inter-section lines are direct children of `root.body[]`. This means there is exactly one entry point into the content tree, rendering always starts at `bundle.body`, and the occurrence `path` navigates within `bundle.body.body[]`.

### Decision 2 — Type name for line sub-units: `Segment`

**Chosen: `Segment`**

Replaces `Slot`. Options:

| Name | Notes |
|------|-------|
| `Slot` | Current; does not suggest it can carry an annotation |
| `Cell` | Grid metaphor; doesn't fit lyric/chord concept |
| `Span` | HTML-flavoured; commonly means "inline range" |
| `Token` | Parser jargon; implies atomic lexeme |
| `Segment` | Neutral; "a piece of a line"; widely used in typesetting |

```typescript
type Segment = {
  text?:         string
  chord?:        string   // a real harmony chord → gets occurrenceIdx
  annotation?:   string   // display-only marker ([*|], etc.) → no occurrenceIdx
  occurrenceIdx?: number  // present only when chord is set
}
```

`chord` and `annotation` are semantically two kinds of above-the-lyrics marker. The `*` prefix in ChordPro (`[*|]`) is exactly this distinction: a chord-row symbol with no harmonic meaning. Keeping them as separate optional fields (rather than collapsing into one `marker` union) preserves ergonomics — most code only cares about one or the other.

### Decision 3 — Occurrence addressing: `path: number[]` into root section

**Chosen: path array into `bundle.body.body[]` (the root section's children)**

With a hierarchical body tree, the old `(sectionIdx, lineIdx, slotIdx)` triple no longer unambiguously addresses a segment. Options:

| Approach | Notes |
|----------|-------|
| `sectionIdx?: number; lineIdx: number; segmentIdx: number` | Nullable sectionIdx for top-level lines; pragmatic but leaks tree structure into a flat triple |
| `path: number[]; segmentIdx: number` | Navigate root section's children by successive array indices |
| Flat line array alongside body | Denormalise; doubles storage but simplifies player |

**Path array is the right call.** With the root section established (Decision 1), the path always navigates within `bundle.body.body[]`. In v1 the path is always length 1 (line directly under root) or length 2 (line inside a named section under root). A helper `resolveLine(root, path)` encapsulates the traversal. The player's `isActive` comparison switches from `sectionIdx:lineIdx:slotIdx` to a path string `path.join(',') + ':' + segmentIdx`.

```typescript
type Occurrence = {
  occurrenceIdx: number
  path:          number[]   // navigation into bundle.body.body[] by successive indices
  segmentIdx:    number     // index within the resolved Line's segments[]
  chord:         string
  anchorWord?:   string
}
```

Helper (lives in a shared util):
```typescript
function resolveLine(root: Section, path: number[]): Line {
  let blocks: Block[] = root.body
  for (let i = 0; i < path.length - 1; i++) {
    blocks = (blocks[path[i]] as Section).body
  }
  return blocks[path[path.length - 1]] as Line
}
```

### Decision 4 — Remove `[__ANNOTn__]` pre-processing

**Chosen: read `item.annotation` directly**

The pre-processing extracted `[*content]` before chordsheetjs parsed the source, replacing it with `[__ANNOT0__]` so the content would appear in `item.chords`. Now that we know `item.annotation` is the correct field, the placeholder substitution is unnecessary. The compiler loop becomes:

```typescript
const chord      = item.chords     || undefined
const annotation = item.annotation || undefined
const text       = item.lyrics     ?? undefined
```

The space-only line normalisation (step 2 of `prepareSource`) remains — it's a real fix for a real chordsheetjs paragraph-type misclassification and is unrelated to annotations.

### Decision 5 — Relax section filtering; emit inter-section lines into root body

Currently `SKIP_PARAGRAPH_TYPES = new Set(['tab', 'indeterminate', 'none', ''])` drops everything outside a named section. Under the new model all content lives inside the root section, so the filtering changes:

- `'tab'` — still dropped (guitar tab blocks are not chord/lyric content).
- `'indeterminate'`, `'none'`, `''` — emitted as `Line` blocks directly into the root section's `body[]` when they carry at least one chord or annotation segment. Empty paragraphs are still dropped.

Named section paragraphs (`'verse'`, `'chorus'`, `'bridge'`, etc.) become `Section` blocks inside the root body, containing their own `Line` children.

In practice the Nickelback fixture has `[E] [*|] [B] [*|] [G] [*|] [A]` between sections (type `'none'`). After this change it becomes a `Line` in the root body, visible to the player and tappable.

## Risks / Trade-offs

- **Breaking change to `TranscriptionBundle`** — All consumers (`ChordDisplay.vue`, `usePlaybackEngine.ts`, tests, fixture JSON) must migrate simultaneously. Mitigated by the fact that the entire codebase is in one repo and the fixture is regenerated by script.
- **Player traversal complexity** — The segmentMap build loop in `ChordDisplay.vue` is currently a straightforward triple-nested walk. With the path model it needs a tree traversal. Mitigated by the `resolveLine` helper; for v1 the path is always ≤ 2 levels.
- **`gen-fixture.mjs` drift** — The fixture generator duplicates compile logic in plain JS. Any type changes must be mirrored there. Noted in comments; a future task could DRY this with `vite-node`.

## Migration Plan

1. Update types in `transcriptionBundle.ts` (`Block`, `Section` with root convention, `Line`, `Segment`, updated `Occurrence` with path addressing).
2. Rewrite `compile.ts` — drop annotation pre-processing, emit root `Section` wrapping all content, fix comment.
3. Mirror changes in `gen-fixture.mjs`.
4. Run `node scripts/gen-fixture.mjs` to regenerate `sample.bundle.json`.
5. Update `ChordDisplay.vue` and `usePlaybackEngine.ts` to use `bundle.body` (root section), `segments[]`, and path-based addressing.
6. Update and/or rewrite unit tests.

No rollback strategy required — all changes are in-repo FE only, no deployed artefacts affected.

## Resolved Questions

- **Root section**: `TranscriptionBundle.body` is a single root `Section` (no label, no type) that contains everything. Inter-section lines sit directly in `root.body[]` alongside named sections. Rendering always starts at `bundle.body`.
- **Annotation type**: `Segment.annotation` carries the raw string content as-is (e.g. `"|"` for `[*|]`). No structured annotation types in v1; the display layer renders it verbatim in the chord row.
