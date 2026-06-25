import { ChordProParser, ChordLyricsPair } from 'chordsheetjs'
import type {
  TranscriptionBundle,
  Section,
  Line,
  Slot,
  Occurrence,
  SourceDescriptor,
} from '../types/transcriptionBundle'

const BUNDLE_VERSION = 1

// chordsheetjs reports these paragraph types as non-section content (commentary,
// blank separators, guitar tabs). Skip them entirely — only named section types
// (verse, chorus, bridge, …) produce a Section in the output.
const SKIP_PARAGRAPH_TYPES = new Set(['tab', 'indeterminate', 'none', ''])

// Extracts the first lyric word of a slot, used as the anchor that disambiguates
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
// Step 1 — ChordPro [*CONTENT] annotations: chordsheetjs v15 does not
//   implement the * prefix correctly. It crashes with "Cannot read properties
//   of undefined (reading 'length')" whenever a [*CONTENT] annotation (with
//   non-empty content) appears alongside real chords on the same line. We
//   extract every [*CONTENT] occurrence up-front, replace each with a safe
//   placeholder [__ANNOTn__], and return the content strings so the compiler
//   can emit display-only annotation slots without occurrenceIdx.
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

export function compile(
  source: string,
  sourceDescriptor: SourceDescriptor = { kind: 'youtube', videoId: '', offsetSec: 0 },
): TranscriptionBundle {
  if (sourceDescriptor.kind === 'youtube' && !sourceDescriptor.videoId) {
    console.warn('[chord-along] compile(): youtube sourceDescriptor has an empty videoId — the player will not load a video')
  }
  const { normalized, annotations } = prepareSource(source)
  // chopFirstWord: false keeps leading lyric text on the first chord-lyric pair
  // rather than splitting it into a standalone prefix item. Without this,
  // "Look at this [E]photograph" would produce a bare "Look at this" token
  // before the first chord, which doesn't match our Slot model.
  const song = new ChordProParser().parse(normalized, { chopFirstWord: false })

  const sections: Section[] = []
  const occurrences: Occurrence[] = []
  let occurrenceIdx = 0

  for (const paragraph of song.bodyParagraphs) {
    if (SKIP_PARAGRAPH_TYPES.has(paragraph.type)) continue

    const label = sectionLabel(paragraph.label, paragraph.type)
    const sectionLines: Line[] = []
    const sectionIdx = sections.length

    for (const songLine of paragraph.lines) {
      const slots: Slot[] = []
      let hasContent = false

      for (const item of songLine.items) {
        if (!(item instanceof ChordLyricsPair)) continue
        const chord = item.chords || undefined
        const text = item.lyrics ?? undefined
        hasContent = true

        if (chord) {
          const annotMatch = chord.match(ANNOT_RE)
          if (annotMatch) {
            // ChordPro [*CONTENT] annotation — display text only, not a sync
            // occurrence. Shown in the chord row like a chord name but never
            // highlighted and needs no timestamp.
            const display = annotations[parseInt(annotMatch[1])]
            if (display) {
              const slot: Slot = { chord: display }
              if (text !== undefined) slot.text = text
              slots.push(slot)
            }
          } else {
            const slot: Slot = { chord, occurrenceIdx }
            if (text !== undefined) slot.text = text
            slots.push(slot)
            occurrences.push({
              occurrenceIdx,
              sectionIdx,
              lineIdx: sectionLines.length,
              slotIdx: slots.length - 1,
              chord,
              anchorWord: anchorWord(text),
            })
            occurrenceIdx++
          }
        } else {
          const slot: Slot = {}
          if (text !== undefined) slot.text = text
          slots.push(slot)
        }
      }

      if (hasContent && slots.length > 0) {
        sectionLines.push({ slots })
      }
    }

    if (sectionLines.length > 0) {
      const section: Section = { lines: sectionLines }
      if (label) section.label = label
      sections.push(section)
    }
  }

  return {
    source: sourceDescriptor,
    version: BUNDLE_VERSION,
    metadata: {
      title: song.title ?? undefined,
      artist: firstString(song.artist),
      key: song.key ?? undefined,
      capo: firstString(song.capo),
    },
    sections,
    occurrences,
  }
}
