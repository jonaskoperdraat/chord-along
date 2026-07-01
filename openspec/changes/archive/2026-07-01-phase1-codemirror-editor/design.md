## Context

Phase 1 needs a working ChordPro input surface. The roadmap spec currently
calls for a plain `<textarea>`, with a swap to CodeMirror 6 pushed to the
Phase 4 backlog once highlighting/autocompletion are ready. CLAUDE.md already
commits the project to CodeMirror 6 as the editor component, specifically
because its changeset model gives in-session position mapping (mark-riding)
for free — the mechanism the design spec's §6.1 edit-resilience path depends
on. Building the textarea first means throwing it away in Phase 4 instead of
extending it.

## Goals / Non-Goals

**Goals:**
- Phase 1 ships a CodeMirror 6 `EditorView` as the ChordPro input surface,
  using only `@codemirror/state` + `@codemirror/view` (basic setup / minimal
  extensions) — no language package.
- Editor behaves as a plain text box: typing, cursor movement, selection,
  copy/paste, undo/redo all work as expected; content is compiled by
  `compile.ts` on save exactly as a textarea's `.value` would be today.

**Non-Goals:**
- No ChordPro syntax highlighting (no Lezer grammar, no `@codemirror/language`
  usage beyond defaults) — still Phase 4.
- No autocompletion — still Phase 4.
- No synced-scroll to a rendered preview — still Phase 4.
- No changes to the compiler pipeline, sync/tap workflow, or backend API.

## Decisions

- **Adopt CodeMirror 6 in Phase 1, not Phase 4.** Alternative considered:
  keep the Phase 1 textarea and defer to Phase 4 as originally planned.
  Rejected because the textarea would be discarded rather than built upon,
  and CodeMirror 6 is already a locked-in dependency (CLAUDE.md, chord-sync
  design §6.1) — deferring it just relocates unavoidable work later without
  benefit.
- **No language extension in Phase 1.** Use CodeMirror's default/basic setup
  only. Adding the Lezer-based ChordPro grammar (mentioned as an
  investigation item — `chordbook/editor` on GitHub) is left to Phase 4 so
  this change stays scoped to swapping the editing surface, not the grammar.
- **Extraction into a reusable component now.** The Phase 1 implementation
  should wrap the `EditorView` in its own Vue component (e.g.
  `ChordProEditor.vue`) with a `v-model`-style string binding, so Phase 4 can
  add extensions (highlighting, autocompletion) without touching call sites.

## Risks / Trade-offs

- [CodeMirror 6's API surface is larger than a textarea, adding Phase 1
  implementation time] → Mitigation: minimal setup only (`basicSetup` from
  `codemirror` package or a hand-picked small extension list); no custom
  grammar or theming required this phase.
- [Two-way binding between Vue reactivity and CodeMirror's own state/transactions
  needs care to avoid cursor jumps on external updates] → Mitigation: only
  push updates into the editor on true external changes (e.g. loading a
  different transcription), not on every keystroke echo.
