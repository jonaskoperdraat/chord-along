<script setup lang="ts">
import type { PlayBundle } from '../types/playBundle'
import type { ActiveEvent } from '../composables/usePlaybackEngine'

const props = defineProps<{
  bundle: PlayBundle
  activeEvent: ActiveEvent | null
}>()

function isActive(lineIdx: number, slotIdx: number): boolean {
  return (
    props.activeEvent !== null &&
    props.activeEvent.lineIdx === lineIdx &&
    props.activeEvent.slotIdx === slotIdx
  )
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
          <span class="chord">{{ slot.chord ?? ' ' }}</span>
          <span class="lyric">{{ slot.text ?? ' ' }}</span>
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

.lyric {
  font-size: 1rem;
  color: #e8e8e8;
  white-space: pre;
}
</style>
