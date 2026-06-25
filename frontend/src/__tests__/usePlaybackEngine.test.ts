import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { defineComponent, createApp } from 'vue'
import { usePlaybackEngine } from '../composables/usePlaybackEngine'
import type { TranscriptionBundle, SyncPlayData } from '../types/transcriptionBundle'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

function withSetup<T>(composableFn: () => T): { result: T; unmount: () => void } {
  let result!: T
  const app = createApp(
    defineComponent({
      setup() {
        result = composableFn()
        return {}
      },
      template: '<div/>',
    }),
  )
  const root = document.createElement('div')
  app.mount(root)
  return { result, unmount: () => app.unmount() }
}

// 5 occurrences across 2 sections (3 in section 0, 2 in section 1)
function makeBundle(offsetSec = 0): TranscriptionBundle {
  return {
    source: { kind: 'youtube', videoId: 'test', offsetSec },
    version: 1,
    metadata: {},
    sections: [
      {
        lines: [
          { slots: [
            { chord: 'G', occurrenceIdx: 0 },
            { chord: 'D', occurrenceIdx: 1 },
            { chord: 'Em', occurrenceIdx: 2 },
          ]},
        ],
      },
      {
        lines: [
          { slots: [
            { chord: 'C', occurrenceIdx: 3 },
            { chord: 'Am', occurrenceIdx: 4 },
          ]},
        ],
      },
    ],
    occurrences: [
      { occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'G' },
      { occurrenceIdx: 1, sectionIdx: 0, lineIdx: 0, slotIdx: 1, chord: 'D' },
      { occurrenceIdx: 2, sectionIdx: 0, lineIdx: 0, slotIdx: 2, chord: 'Em' },
      { occurrenceIdx: 3, sectionIdx: 1, lineIdx: 0, slotIdx: 0, chord: 'C' },
      { occurrenceIdx: 4, sectionIdx: 1, lineIdx: 0, slotIdx: 1, chord: 'Am' },
    ],
  }
}

function makeSyncPlay(timestamps: number[]): SyncPlayData {
  return { timestamps }
}

function setupRafMocks() {
  let lastCallback: FrameRequestCallback | null = null

  const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    lastCallback = cb
    return 0
  })
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {
    lastCallback = null
  })

  function runTick(domTimestamp = 0) {
    if (lastCallback) {
      const cb = lastCallback
      lastCallback = null
      cb(domTimestamp)
    }
  }

  return { runTick, rafSpy }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePlaybackEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── initial state before first tick ──────────────────────────────────────

  it('initializes with activeEvent null, activeEventIdx null, and activeProgress 0 before playback starts', () => {
    setupRafMocks()
    const bundle = makeBundle()
    const syncPlay = makeSyncPlay([5])
    const playerState = ref(0)

    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 0, playerState),
    )

    expect(result.activeEvent.value).toBeNull()
    expect(result.activeEventIdx.value).toBeNull()
    expect(result.activeProgress.value).toBe(0)

    unmount()
  })

  // ── time before first timestamp ───────────────────────────────────────────

  it('sets activeEvent, activeEventIdx, and activeProgress to null/0 when time is before the first timestamp', async () => {
    const { runTick } = setupRafMocks()
    const bundle = makeBundle()
    const syncPlay = makeSyncPlay([5])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 0, playerState),
    )

    playerState.value = 1
    await nextTick()
    runTick()

    expect(result.activeEvent.value).toBeNull()
    expect(result.activeEventIdx.value).toBeNull()
    expect(result.activeProgress.value).toBe(0)

    unmount()
  })

  // ── time exactly on first timestamp ──────────────────────────────────────

  it('activates occurrence 0 with progress 0 when time equals its timestamp exactly', async () => {
    const { runTick } = setupRafMocks()
    const bundle = makeBundle()
    const syncPlay = makeSyncPlay([5, 10])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 5, playerState),
    )

    playerState.value = 1
    await nextTick()
    runTick()

    // (5-5)/(10-5) = 0
    expect(result.activeEventIdx.value).toBe(0)
    expect(result.activeEvent.value).toEqual({ sectionIdx: 0, lineIdx: 0, slotIdx: 0 })
    expect(result.activeProgress.value).toBe(0)

    unmount()
  })

  // ── fractional progress between two timestamps ────────────────────────────

  it('computes the correct fractional activeProgress between two consecutive timestamps', async () => {
    const { runTick } = setupRafMocks()
    const bundle = makeBundle()
    const syncPlay = makeSyncPlay([5, 9])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 7, playerState),
    )

    playerState.value = 1
    await nextTick()
    runTick()

    // (7-5)/(9-5) = 0.5
    expect(result.activeEventIdx.value).toBe(0)
    expect(result.activeProgress.value).toBeCloseTo(0.5)

    unmount()
  })

  // ── last timestamp: progress always 1 ────────────────────────────────────

  it('sets activeProgress to 1 for the last timestamp because there is no next timestamp', async () => {
    const { runTick } = setupRafMocks()
    const bundle = makeBundle()
    const syncPlay = makeSyncPlay([2, 8])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 8.5, playerState),
    )

    playerState.value = 1
    await nextTick()
    runTick()

    expect(result.activeEventIdx.value).toBe(1)
    expect(result.activeProgress.value).toBe(1)

    unmount()
  })

  // ── offsetSec applied before searching ───────────────────────────────────

  it('applies bundle.source.offsetSec to getCurrentTime before the binary search', async () => {
    const { runTick } = setupRafMocks()
    const bundle = makeBundle(3) // offsetSec=3
    const syncPlay = makeSyncPlay([5, 10])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 2, playerState), // 2+3=5 → hits idx 0
    )

    playerState.value = 1
    await nextTick()
    runTick()

    expect(result.activeEventIdx.value).toBe(0)

    unmount()
  })

  // ── activeEvent carries correct sectionIdx/lineIdx/slotIdx ───────────────

  it('sets activeEvent to the sectionIdx/lineIdx/slotIdx resolved from occurrences[]', async () => {
    const { runTick } = setupRafMocks()
    const bundle = makeBundle()
    const syncPlay = makeSyncPlay([1, 4])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 6, playerState), // lands on idx 1
    )

    playerState.value = 1
    await nextTick()
    runTick()

    // occurrences[1] = { sectionIdx: 0, lineIdx: 0, slotIdx: 1, chord: 'D' }
    expect(result.activeEvent.value).toEqual({ sectionIdx: 0, lineIdx: 0, slotIdx: 1 })

    unmount()
  })

  // ── stop prevents further rAF registration ────────────────────────────────

  it('stops scheduling rAF frames when playerState leaves PLAYING', async () => {
    const { runTick, rafSpy } = setupRafMocks()
    const bundle = makeBundle()
    const syncPlay = makeSyncPlay([0])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, syncPlay, () => 1, playerState),
    )

    playerState.value = 1
    await nextTick()
    runTick()

    expect(result.activeEventIdx.value).toBe(0)

    playerState.value = 2
    await nextTick()

    const callCountAfterStop = rafSpy.mock.calls.length
    runTick()

    expect(rafSpy.mock.calls.length).toBe(callCountAfterStop)

    unmount()
  })
})
