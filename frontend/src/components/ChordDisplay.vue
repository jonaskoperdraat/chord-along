<script setup lang="ts">
import { computed } from 'vue'
import type { TranscriptionBundle } from '../types/transcriptionBundle'
import type { ActiveEvent } from '../composables/usePlaybackEngine'

const props = defineProps<{
  bundle: TranscriptionBundle
  activeEvent: ActiveEvent | null
  activeEventIdx: number | null
  activeProgress: number
}>()

function isActive(sectionIdx: number, lineIdx: number, slotIdx: number): boolean {
  return (
    props.activeEvent !== null &&
    props.activeEvent.sectionIdx === sectionIdx &&
    props.activeEvent.lineIdx === lineIdx &&
    props.activeEvent.slotIdx === slotIdx
  )
}

interface SegmentInfo {
  eventIdx: number
  fillStart: number
  fillEnd: number
}

// segmentMap: for each chord occurrence i, compute the fill fraction
// [fillStart, fillEnd] for every slot in its "territory".
//
// A chord occurrence owns all slots from its own position up to (but not
// including) the next occurrence. Because a song line can start mid-way
// through a section and slots are not confined to a single line, the walk
// advances through three nested coordinates: sectionIdx → lineIdx → slotIdx.
// When slotIdx overflows a line it resets to 0 and lineIdx advances; when
// lineIdx overflows a section it resets to 0 and sectionIdx advances.
// The last occurrence's territory extends to the very end of the bundle.
//
// Fill fractions are proportional to character length so that a long lyric
// token consumes more of the progress bar than a short chord token.
const segmentMap = computed<Map<string, SegmentInfo>>(() => {
  const map = new Map<string, SegmentInfo>()
  const { occurrences, sections } = props.bundle

  for (let i = 0; i < occurrences.length; i++) {
    const nextOcc = occurrences[i + 1] ?? null

    let sectionIdx = occurrences[i].sectionIdx
    let lineIdx = occurrences[i].lineIdx
    let slotIdx = occurrences[i].slotIdx

    const segments: Array<{ sectionIdx: number; lineIdx: number; slotIdx: number; charLen: number }> = []

    // Walk forward from this occurrence until we reach the next occurrence
    // or run off the end of the bundle.
    while (true) {
      if (nextOcc &&
          sectionIdx === nextOcc.sectionIdx &&
          lineIdx === nextOcc.lineIdx &&
          slotIdx === nextOcc.slotIdx) break
      if (sectionIdx >= sections.length) break

      const section = sections[sectionIdx]
      if (lineIdx >= section.lines.length) {
        console.warn('[chord-along] segmentMap: lineIdx out of bounds — bundle may be malformed', { sectionIdx, lineIdx, occurrenceIdx: i })
        break
      }

      const slot = section.lines[lineIdx].slots[slotIdx]
      const charLen = Math.max(slot.chord?.length ?? 0, slot.text?.length ?? 0, 1)
      segments.push({ sectionIdx, lineIdx, slotIdx, charLen })

      slotIdx++
      if (slotIdx >= section.lines[lineIdx].slots.length) {
        lineIdx++
        slotIdx = 0
      }
      if (lineIdx >= section.lines.length) {
        sectionIdx++
        lineIdx = 0
        slotIdx = 0
      }
    }

    const totalChars = segments.reduce((sum, s) => sum + s.charLen, 0)
    let cumulative = 0
    for (const seg of segments) {
      map.set(`${seg.sectionIdx}:${seg.lineIdx}:${seg.slotIdx}`, {
        eventIdx: i,
        fillStart: cumulative / totalChars,
        fillEnd: (cumulative + seg.charLen) / totalChars,
      })
      cumulative += seg.charLen
    }
  }

  return map
})

function slotProgressWidth(sectionIdx: number, lineIdx: number, slotIdx: number): string {
  if (props.activeEventIdx === null) return '0%'
  const info = segmentMap.value.get(`${sectionIdx}:${lineIdx}:${slotIdx}`)
  if (!info || info.eventIdx !== props.activeEventIdx) return '0%'
  const { fillStart, fillEnd } = info
  const local =
    fillEnd === fillStart
      ? 1
      : Math.max(0, Math.min(1, (props.activeProgress - fillStart) / (fillEnd - fillStart)))
  return `${local * 100}%`
}
</script>

<template>
  <div class="chord-sheet">
    <div
      v-for="(section, sectionIdx) in bundle.sections"
      :key="sectionIdx"
      class="section"
    >
      <div
        v-if="section.label"
        class="section-label"
      >
        {{ section.label }}
      </div>
      <div
        v-for="(line, lineIdx) in section.lines"
        :key="lineIdx"
        class="line"
      >
        <div class="slots">
          <div
            v-for="(slot, slotIdx) in line.slots"
            :key="slotIdx"
            class="slot"
            :class="{ active: isActive(sectionIdx, lineIdx, slotIdx) }"
          >
            <span class="chord">{{ slot.chord ?? ' ' }}</span>
            <div class="progress-bar" :style="{ width: slotProgressWidth(sectionIdx, lineIdx, slotIdx) }" />
            <span class="lyric">{{ slot.text ?? ' ' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chord-sheet {
  font-family: 'Courier New', Courier, monospace;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #888;
}

.slots {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.25rem;
}

.slot {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  transition: background 0.1s;
}

.slot.active {
  background: rgba(255, 220, 50, 0.18);
  outline: 1px solid rgba(255, 220, 50, 0.5);
}

.chord {
  font-weight: 700;
  font-size: 0.95rem;
  color: #f0c040;
  min-height: 1.2em;
  white-space: pre;
}

.slot.active .chord {
  color: #ffe066;
}

.progress-bar {
  height: 2px;
  background: #ffe066;
  min-width: 0;
  align-self: stretch;
}

.lyric {
  font-size: 1rem;
  color: #e8e8e8;
  white-space: pre;
}
</style>
