import { ref, watch, onUnmounted, toValue } from 'vue'
import type { Ref, MaybeRef } from 'vue'
import type { TranscriptionBundle, SyncPlayData } from '../types/transcriptionBundle'

export interface ActiveEvent {
  path: number[]
  segmentIdx: number
}

function binarySearchTimestampIdx(timestamps: number[], time: number): number {
  let lo = 0
  let hi = timestamps.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (timestamps[mid] <= time) {
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

/**
 * Drives chord-highlight playback by binary-searching syncPlay timestamps on
 * each animation frame and resolving the current occurrence to a (lineIdx, slotIdx).
 *
 * bundle and syncPlay are intentionally separate refs: a single transcription
 * bundle is shared across all syncs, so swapping to a different sync (different
 * timestamps) is a client-side operation that never requires re-fetching the bundle
 * (see chord-sync-design.md §4 and §5b).
 *
 * The RAF loop runs only while the YouTube player is in PLAYING state; it is
 * cancelled on component unmount.
 */
export function usePlaybackEngine(
  bundleMaybeRef: MaybeRef<TranscriptionBundle | null>,
  syncPlayMaybeRef: MaybeRef<SyncPlayData | null>,
  getCurrentTime: () => number,
  playerState: Ref<number>,
) {
  const activeEvent = ref<ActiveEvent | null>(null)
  const activeEventIdx = ref<number | null>(null)
  const activeProgress = ref<number>(0)
  let rafId: number | null = null

  function tick() {
    const bundle = toValue(bundleMaybeRef)
    const syncPlay = toValue(syncPlayMaybeRef)
    if (!bundle || !syncPlay) {
      rafId = requestAnimationFrame(tick)
      return
    }
    const time = getCurrentTime() + (bundle.source.offsetSec ?? 0)
    const idx = binarySearchTimestampIdx(syncPlay.timestamps, time)
    if (idx === -1) {
      activeEvent.value = null
      activeEventIdx.value = null
      activeProgress.value = 0
    } else {
      const occ = bundle.occurrences[idx]
      activeEvent.value = { path: occ.path, segmentIdx: occ.segmentIdx }
      activeEventIdx.value = idx
      const nextT = syncPlay.timestamps[idx + 1]
      const currT = syncPlay.timestamps[idx]
      activeProgress.value = nextT !== undefined
        ? Math.min(1, (time - currT) / (nextT - currT))
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
