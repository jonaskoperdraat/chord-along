---
name: chordsheetjs-paragraph-type-behavior
description: Documented paragraph type quirks for chordsheetjs v15 that affect compile.ts test design
metadata:
  type: project
---

Key behaviors discovered while writing tests for `compile.ts`:

**Known paragraph types:** `verse`, `chorus`, `bridge`, `tab`, `indeterminate`, `none`, `grid`, `abc`. The empty string `''` in `INLINE_PARAGRAPH_TYPES` is a defensive guard — no known input produces it.

**Current paragraph classification in compile.ts (post-refactor):**
- `SKIP_PARAGRAPH_TYPES = Set(['tab'])` — tab paragraphs only; all others are processed.
- `INLINE_PARAGRAPH_TYPES = Set(['none', 'indeterminate', ''])` — these emit top-level Line blocks into `body.body[]` rather than named Section blocks. Text-only lines within these paragraphs are still dropped (only chord/annotation-bearing lines are emitted).

**`none` type:** Emitted for orphaned chord lines that appear AFTER `{end_of_verse}` (or any section end) with no enclosing section tag. These now emit as top-level `Line` blocks in `body.body[]` (previously skipped). Their occurrences have `path` of length 1. Requires a blank line between the orphaned content and the next section tag — without that blank line, chordsheetjs merges the orphan with the next section tag into a single `indeterminate` paragraph, swallowing the named section.

**`indeterminate` type:** Emitted when chord/lyric content and a section directive appear in the same paragraph (no separating blank line), or for bare chord lines with no section tag at all. Now emitted as top-level Line blocks (previously skipped).

**Blank line inside a named section:** A blank line inside `{start_of_bridge}...{end_of_bridge}` causes chordsheetjs to split the paragraph at the blank, emitting two separate paragraphs of type `bridge`. Both become separate `Section` objects in `body.body[]` with consecutive `path[0]` indices.

**`[*CONTENT]` annotations:** Compiler pre-extracts them via `prepareSource()`, replaces each with `[__ANNOTn__]`, then emits the content string as a `Segment` with `annotation: content` (no `chord`, no `occurrenceIdx`). Bare `[*]` (empty content) produces NO segment at all. The crash that triggered this in chordsheetjs v15 is in `combinableChordLyricsPairs` where `item.chords` is undefined for annotation items.

**Space-only lines before section directives:** Without `prepareSource()`, a line of spaces/tabs before `{start_of_verse}` causes chordsheetjs to merge the directive into the preceding paragraph as type `indeterminate`. The regex `^[ \t]+$/gm` in `prepareSource()` converts these to blank lines so the parser sees a clean paragraph boundary.

**How to apply:** When writing tests for `compile.ts`, use blank-line separators around section directives deliberately. Document in test comments when a blank line is semantically required by chordsheetjs. Use the `getSection(result, idx)` / `getLine(result, sectionRootIdx, lineIdx)` / `getTopLevelLine(result, idx)` helpers defined in `compile.test.ts`. Verify that inline paragraphs (none/indeterminate) produce top-level `Line` blocks, not Sections.
