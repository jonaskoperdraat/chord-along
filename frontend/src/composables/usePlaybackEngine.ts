import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { PlayBundle, BundleEvent } from '../types/playBundle'

export interface ActiveEvent {
  lineIdx: number
  slotIdx: number
}

function binarySearchEvent(events: BundleEvent[], time: number): ActiveEvent | null {
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
  if (result === -1) return null
  return { lineIdx: events[result].lineIdx, slotIdx: events[result].slotIdx }
}

// YT.PlayerState.PLAYING = 1
const YT_PLAYING = 1

export function usePlaybackEngine(
  bundle: PlayBundle,
  getCurrentTime: () => number,
  playerState: Ref<number>,
) {
  const activeEvent = ref<ActiveEvent | null>(null)
  let rafId: number | null = null

  function tick() {
    const time = getCurrentTime() + (bundle.source.offsetSec ?? 0)
    activeEvent.value = binarySearchEvent(bundle.events, time)
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

  return { activeEvent }
}
