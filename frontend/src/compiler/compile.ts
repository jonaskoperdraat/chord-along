import { ChordProParser, ChordLyricsPair } from 'chordsheetjs'
import type {
  TranscriptionBundle,
  Section,
  Line,
  Segment,
  Occurrence,
  SourceDescriptor,
} from '../types/transcriptionBundle'

const BUNDLE_VERSION = 1

// 'tab' paragraphs (guitar tabs) are always skipped.
// 'none', 'indeterminate', and '' paragraphs are not named sections but may
// carry chord/annotation content between section directives; lines from those
// paragraphs that contain at least one chord or annotation segment are emitted
// as top-level Line blocks directly into the root body. Text-only lines in
// non-section paragraphs (preamble comments, tuning notes, etc.) are still dropped.
const SKIP_PARAGRAPH_TYPES = new Set(['tab'])
const INLINE_PARAGRAPH_TYPES = new Set(['none', 'indeterminate', ''])

// Extracts the first lyric word of a segment, used as the anchor that disambiguates
// repeated chord names during sync rebase (see chord-sync-design.md §6.2).
// Punctuation is stripped so "love," and "love" resolve to the same anchor.
function anchorWord(lyrics: string | null | undefined): string | undefined {
  if (!lyrics) return undefined
  const word = lyrics.trimStart().split(/[\s,.'";!?]+/)[0]
  return word || undefined
}

// chordsheetjs returns some metadata fields (e.g. artist, capo) as string|string[].
// We always take the first value; multi-value directives are not meaningful here.
function firstString(value: string | string[] | null | undefined): string | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function sectionLabel(label: string | null, type: string): string | undefined {
  if (label) return label
  // Capitalise type name (e.g. "verse" → "Verse") when no explicit label is present.
  return type.charAt(0).toUpperCase() + type.slice(1)
}

// Prepares ChordPro source for chordsheetjs parsing. Returns the normalised
// source and a table of extracted annotation strings.
//
// Step 1 — ChordPro [*CONTENT] annotations: chordsheetjs v15 crashes when a
//   [*CONTENT] annotation with non-empty content appears alongside real chords
//   on the same line and the parser is invoked with { chopFirstWord: false }.
//   The crash occurs inside combinableChordLyricsPairs, which reads
//   itemA.chords.length on the annotation item — but for annotation items
//   chordsheetjs sets item.chords to undefined rather than a string, so the
//   property access throws. We extract every [*CONTENT] up-front, replace each
//   with a safe placeholder [__ANNOTn__] that parses as a normal chord name, and
//   return the content strings so the compiler can emit display-only Segments.
//
// Step 2 — Space-only lines: chordsheetjs merges a section directive into the
//   preceding paragraph when it is separated only by whitespace-only lines
//   (not blank lines), producing type 'indeterminate' instead of the correct
//   named type. Normalising to blank lines fixes this.
function prepareSource(source: string): { normalized: string; annotations: string[] } {
  const annotations: string[] = []
  const extracted = source.replace(/\[\*([^\]]*)\]/g, (_, content) => {
    const idx = annotations.length
    annotations.push(content)
    return `[__ANNOT${idx}__]`
  })
  const normalized = extracted.replace(/^[ \t]+$/gm, '')
  return { normalized, annotations }
}

const ANNOT_RE = /^__ANNOT(\d+)__$/

async function hashSource(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source)
  const buffer = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function compile(
  source: string,
  sourceDescriptor: SourceDescriptor = { kind: 'youtube', videoId: '', offsetSec: 0 },
): Promise<TranscriptionBundle> {
  if (sourceDescriptor.kind === 'youtube' && !sourceDescriptor.videoId) {
    console.warn('[chord-along] compile(): youtube sourceDescriptor has an empty videoId — the player will not load a video')
  }
  const { normalized, annotations } = prepareSource(source)
  // chopFirstWord: false keeps leading lyric text on the first chord-lyric pair
  // rather than splitting it into a standalone prefix item. Without this,
  // "Look at this [E]photograph" would produce a bare "Look at this" token
  // before the first chord, which doesn't match our Segment model.
  const song = new ChordProParser().parse(normalized, { chopFirstWord: false })

  const rootBody: (Section | Line)[] = []
  const occurrences: Occurrence[] = []
  let occurrenceIdx = 0

  function buildSegments(
    songLine: (typeof song.bodyParagraphs)[0]['lines'][0],
    makePath: (segmentCount: number) => number[],
  ): { segments: Segment[]; lineOccs: Occurrence[]; hasChordOrAnnotation: boolean } {
    const segments: Segment[] = []
    const lineOccs: Occurrence[] = []
    let hasChordOrAnnotation = false

    for (const item of songLine.items) {
      if (!(item instanceof ChordLyricsPair)) continue
      const chord = item.chords || undefined
      const text = item.lyrics ?? undefined

      if (chord) {
        const annotMatch = chord.match(ANNOT_RE)
        if (annotMatch) {
          const display = annotations[parseInt(annotMatch[1])]
          if (display) {
            // Non-empty [*CONTENT] annotation: display-only, no occurrenceIdx.
            const seg: Segment = { annotation: display }
            if (text !== undefined) seg.text = text
            segments.push(seg)
            hasChordOrAnnotation = true
          }
          // Empty annotation (bare [*]) → skip entirely.
        } else {
          const seg: Segment = { chord, occurrenceIdx }
          if (text !== undefined) seg.text = text
          segments.push(seg)
          lineOccs.push({
            occurrenceIdx,
            path: makePath(lineOccs.length),
            segmentIdx: segments.length - 1,
            chord,
            anchorWord: anchorWord(text),
          })
          occurrenceIdx++
          hasChordOrAnnotation = true
        }
      } else if (text !== undefined) {
        segments.push({ text })
      }
    }

    return { segments, lineOccs, hasChordOrAnnotation }
  }

  for (const paragraph of song.bodyParagraphs) {
    if (SKIP_PARAGRAPH_TYPES.has(paragraph.type)) continue

    if (INLINE_PARAGRAPH_TYPES.has(paragraph.type)) {
      // Non-section paragraph: emit lines with chord/annotation content into root body.
      // Text-only lines (preamble, tuning notes, etc.) are dropped.
      for (const songLine of paragraph.lines) {
        const rootIdx = rootBody.length
        const { segments, lineOccs, hasChordOrAnnotation } = buildSegments(
          songLine,
          () => [rootIdx],
        )
        if (hasChordOrAnnotation && segments.length > 0) {
          rootBody.push({ kind: 'line', segments })
          occurrences.push(...lineOccs)
        } else {
          // Roll back occurrenceIdx for any chord segments on a discarded line.
          occurrenceIdx -= lineOccs.length
        }
      }
    } else {
      // Named section paragraph: collect all lines into a Section block.
      const label = sectionLabel(paragraph.label, paragraph.type)
      const sectionRootIdx = rootBody.length
      const sectionBody: Line[] = []

      for (const songLine of paragraph.lines) {
        const lineIdx = sectionBody.length
        const { segments, lineOccs } = buildSegments(
          songLine,
          () => [sectionRootIdx, lineIdx],
        )
        if (segments.length > 0) {
          sectionBody.push({ kind: 'line', segments })
          occurrences.push(...lineOccs)
        }
      }

      if (sectionBody.length > 0) {
        const section: Section = { kind: 'section', body: sectionBody }
        if (label) section.label = label
        if (paragraph.type) section.type = paragraph.type
        rootBody.push(section)
      }
    }
  }

  return {
    source: sourceDescriptor,
    version: BUNDLE_VERSION,
    sourceHash: await hashSource(source),
    metadata: {
      title: song.title ?? undefined,
      artist: firstString(song.artist),
      key: song.key ?? undefined,
      capo: firstString(song.capo),
    },
    body: { kind: 'section', body: rootBody },
    occurrences,
  }
}
