---
name: chordsheetjs-paragraph-type-behavior
description: Documented paragraph type quirks for chordsheetjs v15 that affect compile.ts test design
metadata:
  type: project
---

Key behaviors discovered while writing tests for `compile.ts`:

**Known paragraph types:** `verse`, `chorus`, `bridge`, `tab`, `indeterminate`, `none`, `grid`, `abc`. The empty string `''` in `SKIP_PARAGRAPH_TYPES` is a defensive guard — no known input produces it.

**`none` type:** Emitted for orphaned chord lines that appear AFTER `{end_of_verse}` (or any section end) with no enclosing section tag. Requires a blank line between the orphaned content and the next section tag — without that blank line, chordsheetjs merges the orphan with the next section tag into a single `indeterminate` paragraph, swallowing the named section.

**`indeterminate` type:** Emitted when chord/lyric content and a section directive appear in the same paragraph (no separating blank line). Also emitted for bare chord lines with no section tag at all.

**Blank line inside a named section:** A blank line inside `{start_of_bridge}...{end_of_bridge}` causes chordsheetjs to split the paragraph at the blank, emitting two separate paragraphs of type `bridge`. Both become separate `Section` objects in the bundle, each with their own `sectionIdx`.

**`[*|]` bar markers:** Crash chordsheetjs v15 at parse time. `normalizeSource()` strips them with `/\[\*\|?\]/g` before parsing. `[*]` (no pipe) is also matched by the same regex.

**Space-only lines before section directives:** Without `normalizeSource()`, a line of spaces/tabs before `{start_of_verse}` causes chordsheetjs to merge the directive into the preceding paragraph as type `indeterminate`, which is then skipped by `SKIP_PARAGRAPH_TYPES`. The regex `^[ \t]+$/gm` in `normalizeSource()` converts these to blank lines so the parser sees a clean paragraph boundary.

**How to apply:** When writing tests for `compile.ts`, use blank-line separators around section directives deliberately. Document in test comments when a blank line is semantically required by chordsheetjs.
