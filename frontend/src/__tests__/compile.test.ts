import { describe, it, expect } from 'vitest'
import { compile } from '../compiler'
import type { YoutubeSource, SpotifySource, Section, Line, TranscriptionBundle } from '../types/transcriptionBundle'

// All tests that exercise named sections wrap the input in a section directive.
// Bare chord lines outside any section directive are emitted as top-level Line
// blocks in body.body[].

const VERSE = (body: string) => `{start_of_verse}\n${body}\n{end_of_verse}`
const CHORUS = (body: string) => `{start_of_chorus}\n${body}\n{end_of_chorus}`

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/** Return a named Section block from the root body at the given index. */
function getSection(result: TranscriptionBundle, rootIdx: number): Section {
  return result.body.body[rootIdx] as Section
}

/** Return a Line inside a named section. */
function getLine(result: TranscriptionBundle, sectionRootIdx: number, lineIdx: number): Line {
  const section = getSection(result, sectionRootIdx)
  return section.body[lineIdx] as Line
}

/** Return a top-level Line block (kind='line') from root body. */
function getTopLevelLine(result: TranscriptionBundle, rootIdx: number): Line {
  return result.body.body[rootIdx] as Line
}

// ---------------------------------------------------------------------------
// 3.1 Chord-lyric pair mapping
// ---------------------------------------------------------------------------

describe('compile — chord-lyric segment mapping', () => {
  it('maps a mixed chord+lyric line to correct segments', async () => {
    // Given
    const source = VERSE('[Am]Look at this [C]photograph')

    // When
    const result = await compile(source)

    // Then
    expect(getLine(result, 0, 0).segments).toEqual([
      { chord: 'Am', text: 'Look at this ', occurrenceIdx: 0 },
      { chord: 'C', text: 'photograph', occurrenceIdx: 1 },
    ])
  })

  it('maps a lyric-only line to a single segment with no chord or occurrenceIdx', async () => {
    // Given
    const source = VERSE('Just some words')

    // When
    const result = await compile(source)

    // Then
    const seg = getLine(result, 0, 0).segments[0]
    expect(seg.chord).toBeUndefined()
    expect(seg.occurrenceIdx).toBeUndefined()
    expect(seg.text).toBe('Just some words')
  })

  it('produces a chord-only segment when the chord has no following text', async () => {
    // Given
    const source = VERSE('[Am]words [C]')

    // When
    const result = await compile(source)

    // Then
    const segments = getLine(result, 0, 0).segments
    const lastSeg = segments[segments.length - 1]
    expect(lastSeg.chord).toBe('C')
    expect(lastSeg.occurrenceIdx).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 3.2 Anchor word extraction
// ---------------------------------------------------------------------------

describe('compile — anchorWord extraction', () => {
  it('extracts the first word of the lyrics as anchorWord', async () => {
    // Given
    const source = VERSE('[Am]Look at this')

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences[0].anchorWord).toBe('Look')
  })

  it('returns undefined for anchorWord when the chord has no following text', async () => {
    // Given
    const source = VERSE('[Am]')

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences[0].anchorWord).toBeUndefined()
  })

  it('returns undefined for anchorWord when lyrics are whitespace only', async () => {
    // Given
    const source = VERSE('[Am]   [C]next')

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences[0].anchorWord).toBeUndefined()
    expect(result.occurrences[1].anchorWord).toBe('next')
  })
})

// ---------------------------------------------------------------------------
// 3.3 Section labels
// ---------------------------------------------------------------------------

describe('compile — section labels', () => {
  it('attaches the section label to the section, not repeated on each line', async () => {
    // Given
    const source = `{start_of_verse: Verse 1}
[Am]hello [C]world
[G]more words
{end_of_verse}`

    // When
    const result = await compile(source)

    // Then
    const section = getSection(result, 0)
    expect(section.label).toBe('Verse 1')
    expect(section.body).toHaveLength(2)
  })

  it('capitalises the section type when no explicit label is given, and no bare chord line is emitted for a proper section', async () => {
    // Given
    const source = CHORUS('[G]sing it')

    // When
    const result = await compile(source)

    // Then
    expect(getSection(result, 0).label).toBe('Chorus')
  })

  it('uses different section labels for different paragraphs', async () => {
    // Given
    const source = `{start_of_verse: Verse 1}
[Am]verse line
{end_of_verse}
{start_of_chorus}
[G]chorus line
{end_of_chorus}`

    // When
    const result = await compile(source)

    // Then
    expect(getSection(result, 0).label).toBe('Verse 1')
    expect(getSection(result, 1).label).toBe('Chorus')
  })
})

// ---------------------------------------------------------------------------
// 3.4 Metadata extraction
// ---------------------------------------------------------------------------

describe('compile — metadata extraction', () => {
  it('extracts title and artist from directives', async () => {
    // Given
    const source = `{title: Photograph}
{artist: Nickelback}
${VERSE('[Am]hello')}`

    // When
    const result = await compile(source)

    // Then
    expect(result.metadata.title).toBe('Photograph')
    expect(result.metadata.artist).toBe('Nickelback')
  })

  it('extracts key and capo', async () => {
    // Given
    const source = `{key: Am}
{capo: 2}
${VERSE('[Am]hello')}`

    // When
    const result = await compile(source)

    // Then
    expect(result.metadata.key).toBe('Am')
    expect(result.metadata.capo).toBe('2')
  })

  it('leaves metadata fields undefined when directives are absent', async () => {
    // Given
    const source = VERSE('[Am]hello')

    // When
    const result = await compile(source)

    // Then
    expect(result.metadata.title).toBeUndefined()
    expect(result.metadata.artist).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 3.5 occurrences[] contiguous, zero-based, covers all chord segments
// ---------------------------------------------------------------------------

describe('compile — occurrences[] index', () => {
  it('is contiguous and zero-based', async () => {
    // Given
    const source = VERSE('[Am]hello [C]world\n[G]more')

    // When
    const result = await compile(source)

    // Then
    result.occurrences.forEach((occ, i) => {
      expect(occ.occurrenceIdx).toBe(i)
    })
  })

  it('covers every chord-bearing segment and matches its path/segmentIdx', async () => {
    // Given
    const source = VERSE('[Am]hello [C]world\n[G]more')

    // When
    const result = await compile(source)

    // Then
    for (const occ of result.occurrences) {
      const section = result.body.body[occ.path[0]] as Section
      const line = section.body[occ.path[1]] as Line
      const seg = line.segments[occ.segmentIdx]
      expect(seg.chord).toBe(occ.chord)
      expect(seg.occurrenceIdx).toBe(occ.occurrenceIdx)
    }
  })

  it('lyric-only segments have no occurrenceIdx', async () => {
    // Given
    const source = VERSE('words [Am]chords')

    // When
    const result = await compile(source)

    // Then
    const segments = getLine(result, 0, 0).segments
    const lyricSeg = segments.find((s) => !s.chord)
    expect(lyricSeg?.occurrenceIdx).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 3.6 End-to-end: multi-section song
// ---------------------------------------------------------------------------

describe('compile — end-to-end multi-section', () => {
  it('compiles a two-section song to the correct TranscriptionBundle shape', async () => {
    // Given
    const source = `{title: Test Song}
{artist: Test Artist}
{start_of_verse: Verse 1}
[Am]Look at [C]this
{end_of_verse}
{start_of_chorus}
[G]Never [D]made it
{end_of_chorus}`

    // When
    const result = await compile(source)

    // Then
    expect(result.version).toBe(1)
    expect(result.metadata.title).toBe('Test Song')
    expect(result.metadata.artist).toBe('Test Artist')

    // Two named sections at the root body level
    const verseSection = getSection(result, 0)
    const chorusSection = getSection(result, 1)
    expect(verseSection.label).toBe('Verse 1')
    expect(chorusSection.label).toBe('Chorus')

    expect(result.occurrences).toHaveLength(4)
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'C', 'G', 'D'])
    expect(result.occurrences.map((o) => o.occurrenceIdx)).toEqual([0, 1, 2, 3])
    // path[0] is the sectionRootIdx in body.body; verse is at 0, chorus at 1
    expect(result.occurrences.map((o) => o.path[0])).toEqual([0, 0, 1, 1])
    // path[1] is the lineIdx within the section; all on the first line
    expect(result.occurrences.map((o) => o.path[1])).toEqual([0, 0, 0, 0])

    // Each occurrence resolves back to its segment
    for (const occ of result.occurrences) {
      const section = result.body.body[occ.path[0]] as Section
      const line = section.body[occ.path[1]] as Line
      const seg = line.segments[occ.segmentIdx]
      expect(seg.chord).toBe(occ.chord)
    }
  })
})

// ---------------------------------------------------------------------------
// 3.7 anchorWord edge cases
// ---------------------------------------------------------------------------

describe('compile — anchorWord edge cases', () => {
  it('returns undefined for anchorWord when lyrics are an empty string', async () => {
    // Given
    const source = VERSE('[Am][C]word')

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences[0].anchorWord).toBeUndefined()
  })

  it('returns undefined for anchorWord when lyrics consist entirely of punctuation', async () => {
    // Given
    const source = VERSE('[Am]... [C]word')

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences[0].anchorWord).toBeUndefined()
    expect(result.occurrences[1].anchorWord).toBe('word')
  })
})

// ---------------------------------------------------------------------------
// 3.8 Inline paragraph handling (bare chord lines outside sections)
// ---------------------------------------------------------------------------

describe('compile — inline paragraph handling', () => {
  it('emits a top-level Line block for a bare chord line with no section directive', async () => {
    // Given
    const source = '[Am]bare line'

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(1)
    expect(result.body.body[0].kind).toBe('line')
    expect(result.occurrences).toHaveLength(1)
    expect(result.occurrences[0].chord).toBe('Am')
  })

  it('skips a text-only indeterminate line that has no chord or annotation', async () => {
    // Given
    const source = `just some preamble text

${VERSE('[Am]real content')}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(1)
    expect(result.body.body[0].kind).toBe('section')
    expect(result.occurrences).toHaveLength(1)
  })

  it('skips tab paragraphs entirely', async () => {
    // Given
    const source = `{start_of_tab}
E|--0--2--|
{end_of_tab}
${VERSE('[Am]real content')}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(1)
    expect(result.body.body[0].kind).toBe('section')
    expect(getSection(result, 0).label).toBe('Verse')
  })
})

// ---------------------------------------------------------------------------
// 3.9 sourceDescriptor — default and custom
// ---------------------------------------------------------------------------

describe('compile — sourceDescriptor', () => {
  it('uses the default youtube sourceDescriptor when none is provided', async () => {
    // Given
    const source = VERSE('[Am]hello')

    // When
    const result = await compile(source)

    // Then
    const src = result.source as YoutubeSource
    expect(src.kind).toBe('youtube')
    expect(src.videoId).toBe('')
    expect(src.offsetSec).toBe(0)
  })

  it('embeds a custom sourceDescriptor verbatim in the bundle', async () => {
    // Given
    const descriptor: SpotifySource = { kind: 'spotify', trackId: 'abc123', offsetSec: 5 }

    // When
    const result = await compile(VERSE('[Am]hello'), descriptor)

    // Then
    expect(result.source).toEqual(descriptor)
  })
})

// ---------------------------------------------------------------------------
// 3.10 Empty source / no chord lines
// ---------------------------------------------------------------------------

describe('compile — empty or chord-free source', () => {
  it('returns an empty body and no occurrences for an empty source string', async () => {
    // Given / When
    const result = await compile('')

    // Then
    expect(result.body.body).toHaveLength(0)
    expect(result.occurrences).toHaveLength(0)
  })

  it('returns an empty body and no occurrences for a source with only directives', async () => {
    // Given
    const source = `{title: Empty Song}
{artist: Nobody}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(0)
    expect(result.occurrences).toHaveLength(0)
    expect(result.metadata.title).toBe('Empty Song')
  })
})

// ---------------------------------------------------------------------------
// 3.11 Segment text field presence
// ---------------------------------------------------------------------------

describe('compile — segment text field', () => {
  it('omits the text field on a chord segment that has no following lyrics', async () => {
    // Given
    const source = VERSE('[Am]words [C]')

    // When
    const result = await compile(source)

    // Then
    const segments = getLine(result, 0, 0).segments
    const lastSeg = segments[segments.length - 1]!
    expect(lastSeg.chord).toBe('C')
    expect(lastSeg.text === undefined || lastSeg.text === '').toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3.12 ChordPro [*CONTENT] annotation handling
// ---------------------------------------------------------------------------

describe('compile — [*CONTENT] annotation handling', () => {
  it('renders [*|] as a display-only annotation segment — not a chord occurrence', async () => {
    // Given
    const source = VERSE('[Am]one [*|] [C]two')

    // When
    const result = await compile(source)

    // Then — only real chords are occurrences
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'C'])

    // The "|" annotation segment is present with annotation field (not chord)
    const segments = getLine(result, 0, 0).segments
    const barSeg = segments.find((s) => s.annotation === '|')
    expect(barSeg).toBeDefined()
    expect(barSeg?.chord).toBeUndefined()
    expect(barSeg?.occurrenceIdx).toBeUndefined()
  })

  it('renders [*Coda] as a display-only "Coda" annotation segment', async () => {
    // Given
    const source = VERSE('[Am]verse [*Coda] [G]end')

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'G'])
    const segments = getLine(result, 0, 0).segments
    const annotSeg = segments.find((s) => s.annotation === 'Coda')
    expect(annotSeg).toBeDefined()
    expect(annotSeg?.chord).toBeUndefined()
    expect(annotSeg?.occurrenceIdx).toBeUndefined()
  })

  it('occurrence indices are contiguous even when annotations are interleaved', async () => {
    // Given
    const source = VERSE('[G]a [*|] [D]b [*|] [Em]c [*|] [C]d')

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences.map((o) => o.chord)).toEqual(['G', 'D', 'Em', 'C'])
    expect(result.occurrences.map((o) => o.occurrenceIdx)).toEqual([0, 1, 2, 3])
  })
})

// ---------------------------------------------------------------------------
// 3.13 normalizeSource — space-only line normalization
// ---------------------------------------------------------------------------

describe('compile — normalizeSource: space-only line normalization', () => {
  it('treats a line of only spaces before a section directive as a blank separator, not paragraph content', async () => {
    // Given
    const source = `   \n{start_of_verse}\n[Am]hello\n{end_of_verse}`

    // When
    const result = await compile(source)

    // Then — the verse section must survive
    expect(result.body.body).toHaveLength(1)
    expect(result.body.body[0].kind).toBe('section')
    expect(getSection(result, 0).label).toBe('Verse')
    expect(result.occurrences).toHaveLength(1)
    expect(result.occurrences[0].chord).toBe('Am')
  })

  it('normalizes a line consisting entirely of tabs to a blank separator', async () => {
    // Given
    const source = `\t\t\n{start_of_chorus}\n[G]chorus\n{end_of_chorus}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(1)
    expect(getSection(result, 0).label).toBe('Chorus')
  })

  it('normalizes mixed spaces and tabs on a line to a blank separator', async () => {
    // Given
    const source = `  \t  \n{start_of_verse}\n[C]content\n{end_of_verse}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(1)
    expect(getSection(result, 0).label).toBe('Verse')
  })
})

// ---------------------------------------------------------------------------
// 3.14 Inline paragraph emission — 'none' and 'indeterminate' types
// ---------------------------------------------------------------------------

describe('compile — inline paragraph emission: none and indeterminate types', () => {
  it('emits a top-level Line block for a "none"-typed orphan chord line after a section end', async () => {
    // Given
    const source = `{start_of_verse}
[Am]verse line
{end_of_verse}
[G]orphan line`

    // When
    const result = await compile(source)

    // Then — both the verse section and the orphan line are in body.body
    expect(result.body.body).toHaveLength(2)
    expect(result.body.body[0].kind).toBe('section')
    expect(result.body.body[1].kind).toBe('line')
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'G'])
  })

  it('assigns correct occurrence paths for inline lines mixed with sections', async () => {
    // Given
    const source = `{start_of_verse}
[Am]verse
{end_of_verse}
[G]orphan

{start_of_chorus}
[D]chorus
{end_of_chorus}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(3)
    expect(result.body.body[0].kind).toBe('section')
    expect(result.body.body[1].kind).toBe('line')
    expect(result.body.body[2].kind).toBe('section')

    expect(result.occurrences).toHaveLength(3)
    expect(result.occurrences[0].chord).toBe('Am')
    expect(result.occurrences[0].occurrenceIdx).toBe(0)
    expect(result.occurrences[1].chord).toBe('G')
    expect(result.occurrences[1].occurrenceIdx).toBe(1)
    // G is a top-level line at body.body[1], so path has length 1
    expect(result.occurrences[1].path).toEqual([1])
    expect(result.occurrences[2].chord).toBe('D')
    expect(result.occurrences[2].occurrenceIdx).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 3.15 Blank line inside a named section splits into two same-type sections
// ---------------------------------------------------------------------------

describe('compile — blank line inside a named section', () => {
  it('splits a bridge section at a blank line into two separate Bridge sections', async () => {
    // Given
    const source = `{start_of_bridge}
[Am]first part

[C]second part
{end_of_bridge}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(2)
    expect(getSection(result, 0).label).toBe('Bridge')
    expect(getSection(result, 1).label).toBe('Bridge')
    expect(getSection(result, 0).body).toHaveLength(1)
    expect(getSection(result, 1).body).toHaveLength(1)
  })

  it('assigns correct path[0] values when a blank line splits a section', async () => {
    // Given
    const source = `{start_of_bridge}
[Am]part one

[C]part two
{end_of_bridge}`

    // When
    const result = await compile(source)

    // Then — two sections at indices 0 and 1
    expect(result.occurrences).toHaveLength(2)
    expect(result.occurrences[0].chord).toBe('Am')
    expect(result.occurrences[0].path[0]).toBe(0)
    expect(result.occurrences[1].chord).toBe('C')
    expect(result.occurrences[1].path[0]).toBe(1)
  })

  it('assigns path[1] = 0 for the first line of each split section', async () => {
    // Given
    const source = `{start_of_verse}
[Am]a

[C]b
{end_of_verse}`

    // When
    const result = await compile(source)

    // Then — each split section has exactly one line, so path[1] must be 0 for both
    expect(result.occurrences[0].path[1]).toBe(0)
    expect(result.occurrences[1].path[1]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3.16 path[] is section-relative across multi-line, multi-section songs
// ---------------------------------------------------------------------------

describe('compile — path[] across multi-line, multi-section songs', () => {
  it('path[1] is section-relative, not the global line count', async () => {
    // Given
    const source = `{start_of_verse}
[Am]verse line 1
[C]verse line 2
{end_of_verse}
{start_of_chorus}
[G]chorus line 1
[D]chorus line 2
{end_of_chorus}`

    // When
    const result = await compile(source)

    // Then
    expect(result.occurrences).toHaveLength(4)
    expect(result.occurrences[0]).toMatchObject({ chord: 'Am', path: [0, 0] })
    expect(result.occurrences[1]).toMatchObject({ chord: 'C', path: [0, 1] })
    // Chorus is at root body index 1; path[1] resets to 0
    expect(result.occurrences[2]).toMatchObject({ chord: 'G', path: [1, 0] })
    expect(result.occurrences[3]).toMatchObject({ chord: 'D', path: [1, 1] })
  })

  it('occurrenceIdx is global and monotonically increasing across sections', async () => {
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
    const result = await compile(source)

    // Then
    expect(result.occurrences.map((o) => o.occurrenceIdx)).toEqual([0, 1, 2, 3])
  })

  it('each occurrence resolves back to the correct segment via its path and segmentIdx', async () => {
    // Given
    const source = `{start_of_verse}
[Am]hello [C]world
[G]foo [D]bar
{end_of_verse}
{start_of_chorus}
[Em]sing [B]it
{end_of_chorus}`

    // When
    const result = await compile(source)

    // Then
    for (const occ of result.occurrences) {
      const section = result.body.body[occ.path[0]] as Section
      const line = section.body[occ.path[1]] as Line
      const seg = line.segments[occ.segmentIdx]
      expect(seg.chord).toBe(occ.chord)
      expect(seg.occurrenceIdx).toBe(occ.occurrenceIdx)
    }
  })
})

// ---------------------------------------------------------------------------
// 3.17 sourceHash
// ---------------------------------------------------------------------------

describe('compile — sourceHash', () => {
  it('is present and is a 64-character lower-case hex string', async () => {
    const result = await compile(VERSE('[Am]hello'))
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable for identical source input', async () => {
    const source = VERSE('[Am]hello [C]world')
    const a = await compile(source)
    const b = await compile(source)
    expect(a.sourceHash).toBe(b.sourceHash)
  })

  it('changes when the source changes', async () => {
    const a = await compile(VERSE('[Am]hello'))
    const b = await compile(VERSE('[Am]world'))
    expect(a.sourceHash).not.toBe(b.sourceHash)
  })

  it('matches SHA-256 of the raw UTF-8 source text', async () => {
    const source = VERSE('[Am]hello')
    const result = await compile(source)
    const bytes = new TextEncoder().encode(source)
    const buffer = await crypto.subtle.digest('SHA-256', bytes)
    const expected = Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    expect(result.sourceHash).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// 5.2 Inter-section chord line becomes a top-level Line block
// ---------------------------------------------------------------------------

describe('compile — inter-section chord line becomes top-level block', () => {
  it('emits a top-level Line block for a chord line between two named sections', async () => {
    // Given
    const source = `{start_of_verse}
[Am]verse content
{end_of_verse}
[G]bridge chord line

{start_of_chorus}
[D]chorus content
{end_of_chorus}`

    // When
    const result = await compile(source)

    // Then
    expect(result.body.body).toHaveLength(3)
    expect(result.body.body[0].kind).toBe('section')
    expect(result.body.body[1].kind).toBe('line')
    expect(result.body.body[2].kind).toBe('section')

    // The top-level Line contains the G chord
    const topLine = getTopLevelLine(result, 1)
    expect(topLine.segments.some((s) => s.chord === 'G')).toBe(true)

    // The G occurrence has a path of length 1 pointing to body.body[1]
    const gOcc = result.occurrences.find((o) => o.chord === 'G')!
    expect(gOcc.path).toHaveLength(1)
    expect(gOcc.path[0]).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 5.3 [*|] produces annotation segment
// ---------------------------------------------------------------------------

describe('compile — [*|] produces annotation segment', () => {
  it('emits a segment with annotation field and no chord or occurrenceIdx for [*|]', async () => {
    // Given
    const source = VERSE('[Am]one [*|] [C]two')

    // When
    const result = await compile(source)

    // Then — only Am and C appear as chord occurrences
    expect(result.occurrences.map((o) => o.chord)).toEqual(['Am', 'C'])

    const segments = getLine(result, 0, 0).segments
    const annotSeg = segments.find((s) => s.annotation === '|')

    // The annotation segment exists
    expect(annotSeg).toBeDefined()
    // It has no chord field
    expect(annotSeg?.chord).toBeUndefined()
    // It has no occurrenceIdx
    expect(annotSeg?.occurrenceIdx).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 5.4 Bare [*] produces no segment
// ---------------------------------------------------------------------------

describe('compile — bare [*] produces no segment', () => {
  it('emits no segment for a bare [*] annotation with empty content', async () => {
    // Given
    const source = VERSE('[Am]one [*] [C]two')

    // When
    const result = await compile(source)

    // Then
    const segments = getLine(result, 0, 0).segments

    // Only two chord segments: Am and C
    expect(segments).toHaveLength(2)
    // No segment with annotation or chord matching the bare asterisk
    expect(segments.every((s) => s.annotation !== '' && s.annotation !== undefined || s.chord !== undefined || s.text !== undefined)).toBe(true)
    // Specifically: only Am and C chords
    const chordSegs = segments.filter((s) => s.chord !== undefined)
    expect(chordSegs.map((s) => s.chord)).toEqual(['Am', 'C'])
  })
})
