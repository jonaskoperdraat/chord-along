import { ref, watch, onUnmounted, toValue } from 'vue'
import type { Ref, MaybeRef } from 'vue'
import type { PlayBundle, BundleEvent } from '../types/playBundle'

export interface ActiveEvent {
  lineIdx: number
  slotIdx: number
}

function binarySearchEventIdx(events: BundleEvent[], time: number): number {
  let lo = 0
  let hi = events.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (events[mid].t <= time) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

// YT.PlayerState.PLAYING = 1
const YT_PLAYING = 1

export function usePlaybackEngine(
  bundleMaybeRef: MaybeRef<PlayBundle | null>,
  getCurrentTime: () => number,
  playerState: Ref<number>,
) {
  const activeEvent = ref<ActiveEvent | null>(null)
  const activeEventIdx = ref<number | null>(null)
  const activeProgress = ref<number>(0)
  let rafId: number | null = null

  function tick() {
    const bundle = toValue(bundleMaybeRef)
    if (!bundle) {
      rafId = requestAnimationFrame(tick)
      return
    }
    const time = getCurrentTime() + (bundle.source.offsetSec ?? 0)
    const idx = binarySearchEventIdx(bundle.events, time)
    if (idx === -1) {
      activeEvent.value = null
      activeEventIdx.value = null
      activeProgress.value = 0
    } else {
      const ev = bundle.events[idx]
      activeEvent.value = { lineIdx: ev.lineIdx, slotIdx: ev.slotIdx }
      activeEventIdx.value = idx
      const next = bundle.events[idx + 1]
      activeProgress.value = next
        ? Math.min(1, (time - ev.t) / (next.t - ev.t))
        : 1
    }
    rafId = requestAnimationFrame(tick)
  }

  function start() {
    if (rafId === null) rafId = requestAnimationFrame(tick)
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  watch(playerState, (state) => {
    if (state === YT_PLAYING) {
      start()
    } else {
      stop()
    }
  })

  onUnmounted(stop)

  return { activeEvent, activeEventIdx, activeProgress }
}
