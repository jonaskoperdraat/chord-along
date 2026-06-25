<script setup lang="ts">
import { computed } from 'vue'
import type { TranscriptionBundle, Section, Line } from '../types/transcriptionBundle'
import type { ActiveEvent } from '../composables/usePlaybackEngine'
import { resolveLine } from '../utils/bundleUtils'

const props = defineProps<{
  bundle: TranscriptionBundle
  activeEvent: ActiveEvent | null
  activeEventIdx: number | null
  activeProgress: number
}>()

function isActive(path: number[], segmentIdx: number): boolean {
  return (
    props.activeEvent !== null &&
    props.activeEvent.segmentIdx === segmentIdx &&
    props.activeEvent.path.length === path.length &&
    props.activeEvent.path.every((v, i) => v === path[i])
  )
}

interface SegmentInfo {
  eventIdx: number
  fillStart: number
  fillEnd: number
}

// segmentMap: for each chord occurrence i, compute the fill fraction
// [fillStart, fillEnd] for every segment in its "territory".
//
// A chord occurrence owns all segments from its own position up to (but not
// including) the next occurrence. The walk advances through segments within a
// line, then moves to the next line via occurrence paths.
//
// Fill fractions are proportional to character length so that a long lyric
// token consumes more of the progress bar than a short chord token.
//
// Annotation segments are display-only and are skipped in the segmentMap
// (they never get an active class or progress bar).
const segmentMap = computed<Map<string, SegmentInfo>>(() => {
  const map = new Map<string, SegmentInfo>()
  const { occurrences, body } = props.bundle

  for (let i = 0; i < occurrences.length; i++) {
    const occ = occurrences[i]
    const nextOcc = occurrences[i + 1] ?? null

    let path = [...occ.path]
    let segmentIdx = occ.segmentIdx

    const segments: Array<{ path: number[]; segmentIdx: number; charLen: number }> = []

    // Walk forward from this occurrence until we reach the next occurrence
    // or run off the end of the bundle.
    while (true) {
      // Check if we've reached the next occurrence's position
      if (
        nextOcc &&
        nextOcc.path.length === path.length &&
        nextOcc.path.every((v, j) => v === path[j]) &&
        segmentIdx === nextOcc.segmentIdx
      ) break

      // Try to resolve the current line; bail out if path is out of range
      let line: Line
      try {
        line = resolveLine(body, path)
      } catch {
        break
      }

      if (segmentIdx >= line.segments.length) {
        // Advance to next line: find the next occurrence after current path
        // by incrementing the last path index
        const nextPath = [...path]
        nextPath[nextPath.length - 1]++

        // Check if next path index is still valid
        let valid = false
        try {
          resolveLine(body, nextPath)
          valid = true
        } catch {
          // Try going up a level and advancing (for nested sections)
          if (nextPath.length > 1) {
            // Move to next section
            const outerPath = [nextPath[0] + 1]
            try {
              const outerBlock = body.body[outerPath[0]]
              if (outerBlock && outerBlock.kind === 'section') {
                // Descend into first line of next section
                const innerPath = [outerPath[0], 0]
                resolveLine(body, innerPath)
                nextPath.splice(0, nextPath.length, ...innerPath)
                valid = true
              } else if (outerBlock && outerBlock.kind === 'line') {
                nextPath.splice(0, nextPath.length, ...outerPath)
                valid = true
              }
            } catch {
              // out of bounds — stop
            }
          }
        }

        if (!valid) break
        path = nextPath
        segmentIdx = 0
        continue
      }

      const seg = line.segments[segmentIdx]
      // Skip annotation-only segments — they are display-only and never get active/progress
      if (!seg.annotation || seg.chord || seg.text) {
        const charLen = Math.max(seg.chord?.length ?? 0, seg.text?.length ?? 0, 1)
        segments.push({ path: [...path], segmentIdx, charLen })
      }

      segmentIdx++
    }

    const totalChars = segments.reduce((sum, s) => sum + s.charLen, 0)
    let cumulative = 0
    for (const seg of segments) {
      map.set(`${seg.path.join(',')}:${seg.segmentIdx}`, {
        eventIdx: i,
        fillStart: cumulative / totalChars,
        fillEnd: (cumulative + seg.charLen) / totalChars,
      })
      cumulative += seg.charLen
    }
  }

  return map
})

function segmentProgressWidth(path: number[], segmentIdx: number): string {
  if (props.activeEventIdx === null) return '0%'
  const info = segmentMap.value.get(`${path.join(',')}:${segmentIdx}`)
  if (!info || info.eventIdx !== props.activeEventIdx) return '0%'
  const { fillStart, fillEnd } = info
  const local =
    fillEnd === fillStart
      ? 1
      : Math.max(0, Math.min(1, (props.activeProgress - fillStart) / (fillEnd - fillStart)))
  return `${local * 100}%`
}

// Type guard helpers for the template
function isLine(block: unknown): block is Line {
  return (block as { kind: string }).kind === 'line'
}

function isSection(block: unknown): block is Section {
  return (block as { kind: string }).kind === 'section'
}
</script>

<template>
  <div class="chord-sheet">
    <template
      v-for="(block, blockIdx) in bundle.body.body"
      :key="blockIdx"
    >
      <!-- Top-level line (no enclosing named section) -->
      <div
        v-if="isLine(block)"
        class="line"
      >
        <div class="segments">
          <div
            v-for="(segment, segIdx) in block.segments"
            :key="segIdx"
            class="slot"
            :class="{ active: !segment.annotation && isActive([blockIdx], segIdx) }"
          >
            <span v-if="segment.chord" class="chord">{{ segment.chord }}</span>
            <span v-else-if="segment.annotation" class="chord annotation">{{ segment.annotation }}</span>
            <span v-else class="chord">&nbsp;</span>
            <div
              v-if="!segment.annotation"
              class="progress-bar"
              :style="{ width: segmentProgressWidth([blockIdx], segIdx) }"
            />
            <span class="lyric">{{ segment.text ?? ' ' }}</span>
          </div>
        </div>
      </div>

      <!-- Named section: render label + iterate its lines -->
      <div
        v-else-if="isSection(block)"
        class="section"
      >
        <div
          v-if="block.label"
          class="section-label"
        >
          {{ block.label }}
        </div>
        <template
          v-for="(innerBlock, innerIdx) in block.body"
          :key="innerIdx"
        >
          <div
            v-if="isLine(innerBlock)"
            class="line"
          >
            <div class="segments">
              <div
                v-for="(segment, segIdx) in innerBlock.segments"
                :key="segIdx"
                class="slot"
                :class="{ active: !segment.annotation && isActive([blockIdx, innerIdx], segIdx) }"
              >
                <span v-if="segment.chord" class="chord">{{ segment.chord }}</span>
                <span v-else-if="segment.annotation" class="chord annotation">{{ segment.annotation }}</span>
                <span v-else class="chord">&nbsp;</span>
                <div
                  v-if="!segment.annotation"
                  class="progress-bar"
                  :style="{ width: segmentProgressWidth([blockIdx, innerIdx], segIdx) }"
                />
                <span class="lyric">{{ segment.text ?? ' ' }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
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

.segments {
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

.chord.annotation {
  color: #888;
  font-weight: 400;
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
