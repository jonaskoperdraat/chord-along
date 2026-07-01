## Why

The roadmap spec currently locks Phase 1 into a plain `<textarea>` for ChordPro
input, with the switch to CodeMirror 6 deferred to the Phase 4 backlog
("Syntax-aware ChordPro editor"). CLAUDE.md's tech stack section already names
CodeMirror 6 as the editor component (required later for §6.1 in-session
position mapping via its changeset model), so a plain textarea in Phase 1 is a
throwaway component that will be discarded rather than extended. Building on
CodeMirror from Phase 1 — without syntax highlighting or autocompletion —
gets the real editor surface in place from day one and avoids a rewrite when
Phase 4 adds highlighting/autocompletion on top of it.

## What Changes

- Phase 1 deliverable changes from "Plain-textarea ChordPro editor" to a
  CodeMirror 6 editor used as a plain text surface: no syntax highlighting,
  no autocompletion, no synced preview scroll. Those remain Phase 4 items.
- The "Phase 1 editor is a plain textarea" scenario is replaced with a
  scenario describing a CodeMirror 6 editor with no highlighting/autocomplete
  in this phase.
- Phase 4 backlog item "Syntax-aware ChordPro editor" is reworded: it no
  longer replaces a textarea, it *adds* highlighting/autocompletion/synced
  scroll to the CodeMirror 6 instance already in place since Phase 1.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `roadmap`: Phase 1 editor deliverable and scenario change from plain
  textarea to CodeMirror 6 (no highlighting/autocompletion yet); Phase 4
  backlog item reworded to describe adding highlighting/autocompletion to the
  existing CodeMirror instance rather than replacing a textarea.

## Impact

- `openspec/specs/roadmap/spec.md`: Phase 1 deliverables bullet, Phase 1
  scenario, Phase 4 backlog item.
- `frontend/`: Phase 1 implementation will add a CodeMirror 6 dependency and
  a basic editor component (plain text, no language extensions) instead of a
  `<textarea>`. No implementation work in this change — spec only.
