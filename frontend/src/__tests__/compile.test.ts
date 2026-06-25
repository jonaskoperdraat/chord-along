import { describe, it, expect } from 'vitest'
import { compile } from '../compiler'
import type { YoutubeSource, SpotifySource } from '../types/transcriptionBundle'

// All tests that exercise chord-lyric content wrap the input in a section
// directive. The compiler skips indeterminate paragraphs (no section tag) to
// filter out ChordPro commentary text; real content lives inside sections.

const VERSE = (body: string) => `{start_of_verse}\n${body}\n{end_of_verse}`
const CHORUS = (body: string) => `{start_of_chorus}\n${body}\n{end_of_chorus}`

// ---------------------------------------------------------------------------
// 3.1 Chord-lyric pair mapping
// ---------------------------------------------------------------------------

describe('compile — chord-lyric slot mapping', () => {
  it('maps a mixed chord+lyric line to correct slots', () => {
    const result = compile(VERSE('[Am]Look at this [C]photograph'))
    expect(result.sections[0].lines[0].slots).toEqual([
      { chord: 'Am', text: 'Look at this ', occurrenceIdx: 0 },
      { chord: 'C', text: 'photograph', occurrenceIdx: 1 },
    ])
  })

  it('maps a lyric-only line to a single slot with no chord or occurrenceIdx', () => {
    const result = compile(VERSE('Just some words'))
    const slot = result.sections[0].lines[0].slots[0]
    expect(slot.chord).toBeUndefined()
    expect(slot.occurrenceIdx).toBeUndefined()
    expect(slot.text).toBe('Just some words')
  })

  it('produces a chord-only slot when the chord has no following text', () => {
    const result = compile(VERSE('[Am]words [C]'))
    const slots = result.sections[0].lines[0].slots
    const lastSlot = slots[slots.length - 1]
    expect(lastSlot.chord).toBe('C')
    expect(lastSlot.occurrenceIdx).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 3.2 Anchor word extraction
// ---------------------------------------------------------------------------

describe('compile — anchorWord extraction', () => {
  it('extracts the first word of the lyrics as anchorWord', () => {
    const result = compile(VERSE('[Am]Look at this'))
    expect(result.occurrences[0].anchorWord).toBe('Look')
  })

  it('returns undefined for anchorWord when the chord has no following text', () => {
    const result = compile(VERSE('[Am]'))
    expect(result.occurrences[0].anchorWord).toBeUndefined()
  })

  it('returns undefined for anchorWord when lyrics are whitespace only', () => {
    const result = compile(VERSE('[Am]   [C]next'))
    expect(result.occurrences[0].anchorWord).toBeUndefined()
    expect(result.occurrences[1].anchorWord).toBe('next')
  })
})

// ---------------------------------------------------------------------------
// 3.3 Section labels
// ---------------------------------------------------------------------------

describe('compile — section labels', () => {
  it('attaches the section label to the section, not repeated on each line', () => {
    const source = `{start_of_verse: Verse 1}
[Am]hello [C]world
[G]more words
{end_of_verse}`
    const result = compile(source)
    expect(result.sections[0].label).toBe('Verse 1')
    expect(result.sections[0].lines).toHaveLength(2)
  })

  it('skips indeterminate paragraphs — lines with no section directive produce no section', () => {
    const source = `[Am]no section yet

{start_of_chorus}
[G]chorus line
{end_of_chorus}`
    const result = compile(source)
    // The [Am] line is indeterminate → skipped; only the chorus produces a section
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].label).toBe('Chorus')
  })

  it('uses different section labels for different paragraphs', () => {
    const source = `{start_of_verse: Verse 1}
[Am]verse line
{end_of_verse}
{start_of_chorus}
[G]chorus line
{end_of_chorus}`
    const result = compile(source)
    expect(result.sections[0].label).toBe('Verse 1')
    expect(result.sections[1].label).toBe('Chorus')
  })
})

// ---------------------------------------------------------------------------
// 3.4 Metadata extraction
// ---------------------------------------------------------------------------

describe('compile — metadata extraction', () => {
  it('extracts title and artist from directives', () => {
    const source = `{title: Photograph}
{artist: Nickelback}
${VERSE('[Am]hello')}`
    const result = compile(source)
    expect(result.metadata.title).toBe('Photograph')
    expect(result.metadata.artist).toBe('Nickelback')
  })

  it('extracts key and capo', () => {
    const source = `{key: Am}
{capo: 2}
${VERSE('[Am]hello')}`
    const result = compile(source)
    expect(result.metadata.key).toBe('Am')
    expect(result.metadata.capo).toBe('2')
  })

  it('leaves metadata fields undefined when directives are absent', () => {
    const result = compile(VERSE('[Am]hello'))
    expect(result.metadata.title).toBeUndefined()
    expect(result.metadata.artist).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 3.5 occurrences[] contiguous, zero-based, covers all chord slots
// ---------------------------------------------------------------------------

describe('compile — occurrences[] index', () => {
  it('is contiguous and zero-based', () => {
    const source = VERSE('[Am]hello [C]world\n[G]more')
    const result = compile(source)
    result.occurrences.forEach((occ, i) => {
      expect(occ.occurrenceIdx).toBe(i)
    })
  })

  it('covers every chord-bearing slot and matches its sectionIdx/lineIdx/slotIdx', () => {
    const source = VERSE('[Am]hello [C]world\n[G]more')
    const result = compile(source)

    for (const occ of result.occurrences) {
      const slot = result.sections[occ.sectionIdx].lines[occ.lineIdx].slots[occ.slotIdx]
      expect(slot.chord).toBe(occ.chord)
      expect(slot.occurrenceIdx).toBe(occ.occurrenceIdx)
    }
  })

  it('lyric-only slots have no occurrenceIdx', () => {
    const result = compile(VERSE('words [Am]chords'))
    const slots = result.sections[0].lines[0].slots
    const lyricSlot = slots.find((s) => !s.chord)
    expect(lyricSlot?.occurrenceIdx).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 3.6 End-to-end: multi-section song
// ---------------------------------------------------------------------------

describe('compile — end-to-end multi-section', () => {
  it('compiles a two-section song to the correct TranscriptionBundle shape', () => {
    const source = `{title: Test Song}
{artist: Test Artist}
{start_of_verse: Verse 1}
[Am]Look at [C]this
{end_of_verse}
{start_of_chorus}
[G]Never [D]made it
{end_of_chorus}`

    const result = compile(source)

    expect(result.version).toBe(1)
    expect(result.metadata.title).toBe('Test Song')
    expect(result.metadata.artist).toBe('Test Artist')

    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].label).toBe('Verse 1')
    expect(result.sections[1].label).toBe('Chorus')

    expect(result.occurrences).toHaveLength(4)
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'C', 'G', 'D'])
    expect(result.occurrences.map((o) => o.occurrenceIdx)).toEqual([0, 1, 2, 3])
    expect(result.occurrences.map((o) => o.sectionIdx)).toEqual([0, 0, 1, 1])
    expect(result.occurrences.map((o) => o.lineIdx)).toEqual([0, 0, 0, 0])

    for (const occ of result.occurrences) {
      expect(result.sections[occ.sectionIdx].lines[occ.lineIdx].slots[occ.slotIdx].chord).toBe(occ.chord)
    }
  })
})

// ---------------------------------------------------------------------------
// 3.7 anchorWord edge cases
// ---------------------------------------------------------------------------

describe('compile — anchorWord edge cases', () => {
  it('returns undefined for anchorWord when lyrics are an empty string', () => {
    const result = compile(VERSE('[Am][C]word'))
    expect(result.occurrences[0].anchorWord).toBeUndefined()
  })

  it('returns undefined for anchorWord when lyrics consist entirely of punctuation', () => {
    const result = compile(VERSE('[Am]... [C]word'))
    expect(result.occurrences[0].anchorWord).toBeUndefined()
    expect(result.occurrences[1].anchorWord).toBe('word')
  })
})

// ---------------------------------------------------------------------------
// 3.8 Indeterminate paragraph skipping
// ---------------------------------------------------------------------------

describe('compile — indeterminate paragraph skipping', () => {
  it('produces no sections for a bare chord line with no section directive', () => {
    const result = compile('[Am]bare line')
    expect(result.sections).toHaveLength(0)
    expect(result.occurrences).toHaveLength(0)
  })

  it('capitalises the section type when no explicit label is given', () => {
    const result = compile(CHORUS('[G]sing it'))
    expect(result.sections[0].label).toBe('Chorus')
  })

  it('skips tab paragraphs', () => {
    const source = `{start_of_tab}
E|--0--2--|
{end_of_tab}
${VERSE('[Am]real content')}`
    const result = compile(source)
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].label).toBe('Verse')
  })
})

// ---------------------------------------------------------------------------
// 3.9 sourceDescriptor — default and custom
// ---------------------------------------------------------------------------

describe('compile — sourceDescriptor', () => {
  it('uses the default youtube sourceDescriptor when none is provided', () => {
    const result = compile(VERSE('[Am]hello'))
    const source = result.source as YoutubeSource
    expect(source.kind).toBe('youtube')
    expect(source.videoId).toBe('')
    expect(source.offsetSec).toBe(0)
  })

  it('embeds a custom sourceDescriptor verbatim in the bundle', () => {
    const descriptor: SpotifySource = { kind: 'spotify', trackId: 'abc123', offsetSec: 5 }
    const result = compile(VERSE('[Am]hello'), descriptor)
    expect(result.source).toEqual(descriptor)
  })
})

// ---------------------------------------------------------------------------
// 3.10 Empty source / no chord lines
// ---------------------------------------------------------------------------

describe('compile — empty or chord-free source', () => {
  it('returns empty sections and occurrences for an empty source string', () => {
    const result = compile('')
    expect(result.sections).toHaveLength(0)
    expect(result.occurrences).toHaveLength(0)
  })

  it('returns empty sections and occurrences for a source with only directives', () => {
    const source = `{title: Empty Song}
{artist: Nobody}`
    const result = compile(source)
    expect(result.sections).toHaveLength(0)
    expect(result.occurrences).toHaveLength(0)
    expect(result.metadata.title).toBe('Empty Song')
  })
})

// ---------------------------------------------------------------------------
// 3.11 Slot text field presence
// ---------------------------------------------------------------------------

describe('compile — slot text field', () => {
  it('omits the text field on a chord slot that has no following lyrics', () => {
    const result = compile(VERSE('[Am]words [C]'))
    const lastSlot = result.sections[0].lines[0].slots.at(-1)!
    expect(lastSlot.chord).toBe('C')
    expect(lastSlot.text === undefined || lastSlot.text === '').toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3.12 ChordPro [*CONTENT] annotation handling
// ---------------------------------------------------------------------------

describe('compile — [*CONTENT] annotation handling', () => {
  it('renders [*|] as a display-only "|" slot — not a chord occurrence', () => {
    // chordsheetjs crashes on [*CONTENT] alongside real chords. The compiler
    // pre-extracts annotations and emits them as chord-display slots with no
    // occurrenceIdx so they are never highlighted and need no timestamp.
    const source = VERSE('[Am]one [*|] [C]two')
    const result = compile(source)
    // Only the real chords are occurrences
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'C'])
    // The "|" annotation slot is present but has no occurrenceIdx
    const slots = result.sections[0].lines[0].slots
    const barSlot = slots.find((s) => s.chord === '|')
    expect(barSlot).toBeDefined()
    expect(barSlot?.occurrenceIdx).toBeUndefined()
  })

  it('renders [*Coda] as a display-only "Coda" annotation slot', () => {
    const source = VERSE('[Am]verse [*Coda] [G]end')
    const result = compile(source)
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'G'])
    const slots = result.sections[0].lines[0].slots
    const annotSlot = slots.find((s) => s.chord === 'Coda')
    expect(annotSlot).toBeDefined()
    expect(annotSlot?.occurrenceIdx).toBeUndefined()
  })

  it('occurrence indices are contiguous even when annotations are interleaved', () => {
    const source = VERSE('[G]a [*|] [D]b [*|] [Em]c [*|] [C]d')
    const result = compile(source)
    expect(result.occurrences.map((o) => o.chord)).toEqual(['G', 'D', 'Em', 'C'])
    expect(result.occurrences.map((o) => o.occurrenceIdx)).toEqual([0, 1, 2, 3])
  })
})

// ---------------------------------------------------------------------------
// 3.13 normalizeSource — space-only line normalization
// ---------------------------------------------------------------------------

describe('compile — normalizeSource: space-only line normalization', () => {
  it('treats a line of only spaces before a section directive as a blank separator, not paragraph content', () => {
    // Given
    // A space-only line immediately before {start_of_verse}. Without normalization
    // chordsheetjs merges the directive into the preceding paragraph and emits
    // type 'indeterminate' instead of 'verse', causing the section to be skipped.
    const source = `   \n{start_of_verse}\n[Am]hello\n{end_of_verse}`

    // When
    const result = compile(source)

    // Then
    // The verse section must survive — if normalization were absent it would be skipped.
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].label).toBe('Verse')
    expect(result.occurrences).toHaveLength(1)
    expect(result.occurrences[0].chord).toBe('Am')
  })

  it('normalizes a line consisting entirely of tabs to a blank separator', () => {
    // Given
    // Tabs-only line before a chorus directive.
    const source = `\t\t\n{start_of_chorus}\n[G]chorus\n{end_of_chorus}`

    // When
    const result = compile(source)

    // Then
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].label).toBe('Chorus')
  })

  it('normalizes mixed spaces and tabs on a line to a blank separator', () => {
    // Given
    const source = `  \t  \n{start_of_verse}\n[C]content\n{end_of_verse}`

    // When
    const result = compile(source)

    // Then
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].label).toBe('Verse')
  })
})

// ---------------------------------------------------------------------------
// 3.14 SKIP_PARAGRAPH_TYPES — 'none' type
// ---------------------------------------------------------------------------

describe('compile — SKIP_PARAGRAPH_TYPES: none type', () => {
  it('skips a "none"-typed paragraph produced by orphaned content after a section end', () => {
    // Given
    // A bare chord line after {end_of_verse} with no new section tag.
    // chordsheetjs emits this as type "none".
    const source = `{start_of_verse}
[Am]verse line
{end_of_verse}
[G]orphan line`

    // When
    const result = compile(source)

    // Then
    // Only the verse section survives; the orphaned line is skipped.
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].label).toBe('Verse')
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am'])
  })

  it('skips a "none"-typed paragraph and leaves occurrenceIdx contiguous', () => {
    // Given
    // Verse section followed by orphaned content (blank-line-separated), followed by chorus.
    // chordsheetjs requires a blank line between the orphaned line and the next section
    // tag; without it the two are merged into a single indeterminate paragraph.
    const source = `{start_of_verse}
[Am]verse
{end_of_verse}
[G]orphan

{start_of_chorus}
[D]chorus
{end_of_chorus}`

    // When
    const result = compile(source)

    // Then
    expect(result.sections).toHaveLength(2)
    // Occurrences should be Am (idx 0) and D (idx 1); G is skipped.
    expect(result.occurrences).toHaveLength(2)
    expect(result.occurrences[0].chord).toBe('Am')
    expect(result.occurrences[0].occurrenceIdx).toBe(0)
    expect(result.occurrences[1].chord).toBe('D')
    expect(result.occurrences[1].occurrenceIdx).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 3.15 Blank line inside a named section splits into two same-type sections
// ---------------------------------------------------------------------------

describe('compile — blank line inside a named section', () => {
  it('splits a bridge section at a blank line into two separate Bridge sections', () => {
    // Given
    // chordsheetjs treats a blank line inside {start_of_bridge}...{end_of_bridge}
    // as a paragraph break, emitting two paragraphs of type "bridge".
    // Both should appear as separate Section objects in the bundle.
    const source = `{start_of_bridge}
[Am]first part

[C]second part
{end_of_bridge}`

    // When
    const result = compile(source)

    // Then
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].label).toBe('Bridge')
    expect(result.sections[1].label).toBe('Bridge')
    expect(result.sections[0].lines).toHaveLength(1)
    expect(result.sections[1].lines).toHaveLength(1)
  })

  it('assigns correct sectionIdx values when a blank line splits a section', () => {
    // Given
    const source = `{start_of_bridge}
[Am]part one

[C]part two
{end_of_bridge}`

    // When
    const result = compile(source)

    // Then
    expect(result.occurrences).toHaveLength(2)
    expect(result.occurrences[0].chord).toBe('Am')
    expect(result.occurrences[0].sectionIdx).toBe(0)
    expect(result.occurrences[1].chord).toBe('C')
    expect(result.occurrences[1].sectionIdx).toBe(1)
  })

  it('assigns lineIdx 0 for the first line of each split section', () => {
    // Given
    const source = `{start_of_verse}
[Am]a

[C]b
{end_of_verse}`

    // When
    const result = compile(source)

    // Then
    // Each split section has exactly one line, so lineIdx must be 0 for both.
    expect(result.occurrences[0].lineIdx).toBe(0)
    expect(result.occurrences[1].lineIdx).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3.16 sectionIdx and lineIdx are section-relative across multi-line sections
// ---------------------------------------------------------------------------

describe('compile — sectionIdx and lineIdx across multi-line, multi-section songs', () => {
  it('lineIdx is relative to its own section, not the global line count', () => {
    // Given
    // Verse with two chord lines, then a chorus with two chord lines.
    // Occurrences in the chorus must have lineIdx 0 and 1 (section-relative),
    // not 2 and 3 (global).
    const source = `{start_of_verse}
[Am]verse line 1
[C]verse line 2
{end_of_verse}
{start_of_chorus}
[G]chorus line 1
[D]chorus line 2
{end_of_chorus}`

    // When
    const result = compile(source)

    // Then
    expect(result.occurrences).toHaveLength(4)
    // Am and C are in section 0
    expect(result.occurrences[0]).toMatchObject({ chord: 'Am', sectionIdx: 0, lineIdx: 0 })
    expect(result.occurrences[1]).toMatchObject({ chord: 'C', sectionIdx: 0, lineIdx: 1 })
    // G and D are in section 1, lineIdx resets to 0
    expect(result.occurrences[2]).toMatchObject({ chord: 'G', sectionIdx: 1, lineIdx: 0 })
    expect(result.occurrences[3]).toMatchObject({ chord: 'D', sectionIdx: 1, lineIdx: 1 })
  })

  it('occurrenceIdx is global and monotonically increasing across sections', () => {
    // Given
    const source = `{start_of_verse}
[Am]a
[C]b
{end_of_verse}
{start_of_chorus}
[G]c
[D]d
{end_of_chorus}`

    // When
    const result = compile(source)

    // Then
    expect(result.occurrences.map((o) => o.occurrenceIdx)).toEqual([0, 1, 2, 3])
  })

  it('each occurrence resolves back to the correct slot via its section/line/slot indices', () => {
    // Given
    // Multi-line verse and chorus with multiple chords per line.
    const source = `{start_of_verse}
[Am]hello [C]world
[G]foo [D]bar
{end_of_verse}
{start_of_chorus}
[Em]sing [B]it
{end_of_chorus}`

    // When
    const result = compile(source)

    // Then
    for (const occ of result.occurrences) {
      const slot = result.sections[occ.sectionIdx].lines[occ.lineIdx].slots[occ.slotIdx]
      expect(slot.chord).toBe(occ.chord)
      expect(slot.occurrenceIdx).toBe(occ.occurrenceIdx)
    }
  })
})
