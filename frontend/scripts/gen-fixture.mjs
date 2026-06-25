// Generates sample.bundle.json and a placeholder sample.sync-play.json
// from the real Nickelback Photograph .chordpro fixture.
//
// Run after editing sample.chordpro:
//   node scripts/gen-fixture.mjs
// or:
//   npx vite-node scripts/gen-fixture.mjs
//
// Why this script exists instead of importing src/compiler/compile.ts directly:
// This is a plain Node.js script — it runs outside of Vite and cannot consume
// TypeScript source files. The compile logic is intentionally duplicated here
// in plain JS. If you change compile.ts, mirror the change here too.
//
// After running, paste the "timestamps" array from tap.html into
// sample.sync-play.json to produce a real sync. See CLAUDE.md for the full
// fixture-generation workflow.

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// chordsheetjs is an ESM module - import it directly
const { ChordProParser, ChordLyricsPair } = await import('chordsheetjs')

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../src/fixtures')

const BUNDLE_VERSION = 1

// 'tab' paragraphs (guitar tabs) are always skipped.
// 'none', 'indeterminate', and '' paragraphs produce top-level Line blocks
// only when they contain at least one chord or annotation segment.
// Matches SKIP_PARAGRAPH_TYPES / INLINE_PARAGRAPH_TYPES in compile.ts.
const SKIP_PARAGRAPH_TYPES = new Set(['tab'])
const INLINE_PARAGRAPH_TYPES = new Set(['none', 'indeterminate', ''])

function anchorWord(lyrics) {
  if (!lyrics) return undefined
  const word = lyrics.trimStart().split(/[\s,.'";!?]+/)[0]
  return word || undefined
}

function firstString(value) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function sectionLabel(label, type) {
  if (label) return label
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const rawSource = readFileSync(join(fixturesDir, 'sample.chordpro'), 'utf-8')

// Mirrors prepareSource() in compile.ts.
//
// Step 1 — [*CONTENT] annotations: chordsheetjs v15 crashes when a [*CONTENT]
// annotation with non-empty content appears alongside real chords on the same
// line with { chopFirstWord: false }. The crash is in combinableChordLyricsPairs
// which reads item.chords.length on an annotation item where chords is undefined.
// Extract each [*CONTENT] up-front, replace with [__ANNOTn__] placeholder.
//
// Step 2 — Space-only lines: chordsheetjs merges a section directive into the
// preceding paragraph when separated by whitespace-only lines (not blank lines),
// producing 'indeterminate' instead of the correct named type.
const annotations = []
const ANNOT_RE = /^__ANNOT(\d+)__$/
const extracted = rawSource.replace(/\[\*([^\]]*)\]/g, (_, content) => {
  const idx = annotations.length
  annotations.push(content)
  return `[__ANNOT${idx}__]`
})
const source = extracted.replace(/^[ \t]+$/gm, '')
const song = new ChordProParser().parse(source, { chopFirstWord: false })

const rootBody = []
const occurrences = []
let occurrenceIdx = 0

function buildSegments(songLine, makePath) {
  const segments = []
  const lineOccs = []
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
          const seg = { annotation: display }
          if (text !== undefined) seg.text = text
          segments.push(seg)
          hasChordOrAnnotation = true
        }
        // Empty annotation (bare [*]) → skip entirely.
      } else {
        const seg = { chord, occurrenceIdx }
        if (text !== undefined) seg.text = text
        segments.push(seg)
        const occ = {
          occurrenceIdx,
          path: makePath(lineOccs.length),
          segmentIdx: segments.length - 1,
          chord,
        }
        const anchor = anchorWord(text)
        if (anchor !== undefined) occ.anchorWord = anchor
        lineOccs.push(occ)
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
        occurrenceIdx -= lineOccs.length
      }
    }
  } else {
    const label = sectionLabel(paragraph.label, paragraph.type)
    const sectionRootIdx = rootBody.length
    const sectionBody = []

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
      const section = { kind: 'section', body: sectionBody }
      if (label) section.label = label
      if (paragraph.type) section.type = paragraph.type
      rootBody.push(section)
    }
  }
}

const bundle = {
  source: { kind: 'youtube', videoId: 'BB0DU4DoPP4', offsetSec: 0 },
  version: BUNDLE_VERSION,
  metadata: {
    title: song.title ?? undefined,
    artist: firstString(song.artist),
    key: song.key ?? undefined,
    capo: firstString(song.capo),
  },
  body: { kind: 'section', body: rootBody },
  occurrences,
}

// Remove undefined fields for clean JSON
const bundleJson = JSON.parse(JSON.stringify(bundle))
const sectionCount = rootBody.filter(b => b.kind === 'section').length
const topLevelLineCount = rootBody.filter(b => b.kind === 'line').length
writeFileSync(join(fixturesDir, 'sample.bundle.json'), JSON.stringify(bundleJson, null, 2))
console.log(`sample.bundle.json: ${sectionCount} named sections, ${topLevelLineCount} top-level lines, ${occurrences.length} occurrences`)

// Placeholder sync-play: one timestamp per occurrence, 0 seconds apart
// Replace with real timestamps from the tap utility
const syncPlay = {
  transcriptionVersion: 1,
  timestamps: Array(occurrences.length).fill(0),
}
writeFileSync(join(fixturesDir, 'sample.sync-play.json'), JSON.stringify(syncPlay, null, 2))
console.log(`sample.sync-play.json: ${occurrences.length} placeholder timestamps`)
