<script setup lang="ts">
import { computed } from 'vue'
import type { PlayBundle } from '../types/playBundle'
import type { ActiveEvent } from '../composables/usePlaybackEngine'

const props = defineProps<{
  bundle: PlayBundle
  activeEvent: ActiveEvent | null
  activeEventIdx: number | null
  activeProgress: number
}>()

function isActive(lineIdx: number, slotIdx: number): boolean {
  return (
    props.activeEvent !== null &&
    props.activeEvent.lineIdx === lineIdx &&
    props.activeEvent.slotIdx === slotIdx
  )
}

interface SegmentInfo {
  eventIdx: number
  fillStart: number
  fillEnd: number
}

const segmentMap = computed<Map<string, SegmentInfo>>(() => {
  const map = new Map<string, SegmentInfo>()
  const { events, lines } = props.bundle

  for (let i = 0; i < events.length; i++) {
    const startLine = events[i].lineIdx
    const startSlot = events[i].slotIdx
    const nextEvent = events[i + 1] ?? null

    // Collect all slots in this chord's territory
    const segments: Array<{ lineIdx: number; slotIdx: number; charLen: number }> = []
    let lineIdx = startLine
    let slotIdx = startSlot

    while (true) {
      if (nextEvent && lineIdx === nextEvent.lineIdx && slotIdx === nextEvent.slotIdx) break
      if (lineIdx >= lines.length) break

      const slot = lines[lineIdx].slots[slotIdx]
      const charLen = Math.max(slot.chord?.length ?? 0, slot.text?.length ?? 0, 1)
      segments.push({ lineIdx, slotIdx, charLen })

      slotIdx++
      if (slotIdx >= lines[lineIdx].slots.length) {
        lineIdx++
        slotIdx = 0
      }
    }

    const totalChars = segments.reduce((sum, s) => sum + s.charLen, 0)
    let cumulative = 0
    for (const seg of segments) {
      map.set(`${seg.lineIdx}:${seg.slotIdx}`, {
        eventIdx: i,
        fillStart: cumulative / totalChars,
        fillEnd: (cumulative + seg.charLen) / totalChars,
      })
      cumulative += seg.charLen
    }
  }

  return map
})

function slotProgressWidth(lineIdx: number, slotIdx: number): string {
  if (props.activeEventIdx === null) return '0%'
  const info = segmentMap.value.get(`${lineIdx}:${slotIdx}`)
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
      v-for="(line, lineIdx) in bundle.lines"
      :key="lineIdx"
      class="line"
    >
      <div
        v-if="line.section"
        class="section-label"
      >
        {{ line.section }}
      </div>
      <div class="slots">
        <div
          v-for="(slot, slotIdx) in line.slots"
          :key="slotIdx"
          class="slot"
          :class="{ active: isActive(lineIdx, slotIdx) }"
        >
          <span class="chord">{{ slot.chord ?? ' ' }}</span>
          <div class="progress-bar" :style="{ width: slotProgressWidth(lineIdx, slotIdx) }" />
          <span class="lyric">{{ slot.text ?? ' ' }}</span>
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
  gap: 1rem;
}

.section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #888;
  margin-bottom: 0.25rem;
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
