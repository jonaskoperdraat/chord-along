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

// Matches SKIP_PARAGRAPH_TYPES in compile.ts — only named section types
// (verse, chorus, bridge, …) produce sections in the output. Tab blocks,
// commentary, blank separators, and any paragraph not wrapped in a section
// directive are silently dropped.
const SKIP_PARAGRAPH_TYPES = new Set(['tab', 'indeterminate', 'none', ''])

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
// Step 1: extract [*CONTENT] annotations before chordsheetjs sees them.
// chordsheetjs v15 crashes when [*CONTENT] with non-empty content appears
// alongside real chords on the same line ("Cannot read properties of undefined
// (reading 'length')"). Replace each with a safe placeholder; compile the
// annotation display text separately.
const annotations = []
const ANNOT_RE = /^__ANNOT(\d+)__$/
const extracted = rawSource.replace(/\[\*([^\]]*)\]/g, (_, content) => {
  const idx = annotations.length
  annotations.push(content)
  return `[__ANNOT${idx}__]`
})
// Step 2: space-only lines — same as compile.ts normalizeSource().
const source = extracted.replace(/^[ \t]+$/gm, '')
const song = new ChordProParser().parse(source, { chopFirstWord: false })

const sections = []
const occurrences = []
let occurrenceIdx = 0

for (const paragraph of song.bodyParagraphs) {
  if (SKIP_PARAGRAPH_TYPES.has(paragraph.type)) continue

  const label = sectionLabel(paragraph.label, paragraph.type)
  const sectionLines = []
  const sectionIdx = sections.length

  for (const songLine of paragraph.lines) {
    const slots = []
    let hasContent = false

    for (const item of songLine.items) {
      if (!(item instanceof ChordLyricsPair)) continue
      const chord = item.chords || undefined
      const text = item.lyrics ?? undefined
      hasContent = true

      if (chord) {
        const annotMatch = chord.match(ANNOT_RE)
        if (annotMatch) {
          const display = annotations[parseInt(annotMatch[1])]
          if (display) {
            const slot = { chord: display }
            if (text !== undefined) slot.text = text
            slots.push(slot)
          }
        } else {
          const slot = { chord, occurrenceIdx }
          if (text !== undefined) slot.text = text
          slots.push(slot)
          const occ = {
            occurrenceIdx,
            sectionIdx,
            lineIdx: sectionLines.length,
            slotIdx: slots.length - 1,
            chord,
          }
          const anchor = anchorWord(text)
          if (anchor !== undefined) occ.anchorWord = anchor
          occurrences.push(occ)
          occurrenceIdx++
        }
      } else {
        const slot = {}
        if (text !== undefined) slot.text = text
        slots.push(slot)
      }
    }

    if (hasContent && slots.length > 0) {
      sectionLines.push({ slots })
    }
  }

  if (sectionLines.length > 0) {
    const section = { lines: sectionLines }
    if (label) section.label = label
    sections.push(section)
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
  sections,
  occurrences,
}

// Remove undefined fields for clean JSON
const bundleJson = JSON.parse(JSON.stringify(bundle))
writeFileSync(join(fixturesDir, 'sample.bundle.json'), JSON.stringify(bundleJson, null, 2))
console.log(`sample.bundle.json: ${sections.length} sections, ${occurrences.length} occurrences`)

// Placeholder sync-play: one timestamp per occurrence, 0 seconds apart
// Replace with real timestamps from the tap utility
const syncPlay = {
  transcriptionVersion: 1,
  timestamps: Array(occurrences.length).fill(0),
}
writeFileSync(join(fixturesDir, 'sample.sync-play.json'), JSON.stringify(syncPlay, null, 2))
console.log(`sample.sync-play.json: ${occurrences.length} placeholder timestamps`)
