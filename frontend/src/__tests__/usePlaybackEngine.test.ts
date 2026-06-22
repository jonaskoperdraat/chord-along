import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { defineComponent, createApp } from 'vue'
import { usePlaybackEngine } from '../composables/usePlaybackEngine'
import type { PlayBundle } from '../types/playBundle'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

/**
 * Runs a composable inside an active component context so that lifecycle hooks
 * (onUnmounted, watch) work correctly.  Returns the composable's return value
 * and an `unmount` function.
 */
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

function makeBundle(
  events: { t: number; lineIdx: number; slotIdx: number }[],
  offsetSec = 0,
): PlayBundle {
  return {
    source: { kind: 'youtube', videoId: 'test', offsetSec },
    version: 1,
    lines: [
      { slots: [{ chord: 'G' }, { chord: 'D' }, { chord: 'Em' }] },
      { slots: [{ chord: 'C' }, { chord: 'Am' }] },
    ],
    events,
  }
}

/**
 * Sets up mocks for requestAnimationFrame/cancelAnimationFrame before the
 * composable is created and returns a `runTick` helper that manually fires
 * one rAF frame.  The tick reschedules itself, so `lastCallback` is always
 * updated after each call.
 */
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
      lastCallback = null // clear before calling; cb will re-register
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
    // Given
    setupRafMocks()
    const bundle = makeBundle([{ t: 5, lineIdx: 0, slotIdx: 0 }])
    const playerState = ref(0) // not playing

    // When
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 0, playerState),
    )

    // Then
    expect(result.activeEvent.value).toBeNull()
    expect(result.activeEventIdx.value).toBeNull()
    expect(result.activeProgress.value).toBe(0)

    unmount()
  })

  // ── time before first event ───────────────────────────────────────────────

  it('sets activeEvent, activeEventIdx, and activeProgress to null/0 when time is before the first event', async () => {
    // Given
    const { runTick } = setupRafMocks()
    const bundle = makeBundle([{ t: 5, lineIdx: 0, slotIdx: 0 }])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 0, playerState), // time=0, first event at t=5
    )

    // When — start playback then run one tick
    playerState.value = 1 // YT_PLAYING
    await nextTick()
    runTick()

    // Then
    expect(result.activeEvent.value).toBeNull()
    expect(result.activeEventIdx.value).toBeNull()
    expect(result.activeProgress.value).toBe(0)

    unmount()
  })

  // ── time exactly on first event ───────────────────────────────────────────

  it('activates event 0 with progress 0 when time equals its timestamp exactly', async () => {
    // Given
    const { runTick } = setupRafMocks()
    const bundle = makeBundle([
      { t: 5, lineIdx: 0, slotIdx: 0 },
      { t: 10, lineIdx: 0, slotIdx: 1 },
    ])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 5, playerState), // time = event[0].t exactly
    )

    // When
    playerState.value = 1
    await nextTick()
    runTick()

    // Then — (5-5)/(10-5) = 0
    expect(result.activeEventIdx.value).toBe(0)
    expect(result.activeEvent.value).toEqual({ lineIdx: 0, slotIdx: 0 })
    expect(result.activeProgress.value).toBe(0)

    unmount()
  })

  // ── fractional progress between two events ────────────────────────────────

  it('computes the correct fractional activeProgress between two consecutive events', async () => {
    // Given
    const { runTick } = setupRafMocks()
    const bundle = makeBundle([
      { t: 5, lineIdx: 0, slotIdx: 0 },
      { t: 9, lineIdx: 0, slotIdx: 1 },
    ])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 7, playerState), // time=7, midpoint of [5,9]
    )

    // When
    playerState.value = 1
    await nextTick()
    runTick()

    // Then — (7-5)/(9-5) = 2/4 = 0.5
    expect(result.activeEventIdx.value).toBe(0)
    expect(result.activeProgress.value).toBeCloseTo(0.5)

    unmount()
  })

  // ── last event: progress always 1 ────────────────────────────────────────

  it('sets activeProgress to 1 for the last event because there is no next event', async () => {
    // Given
    const { runTick } = setupRafMocks()
    const bundle = makeBundle([
      { t: 2, lineIdx: 0, slotIdx: 0 },
      { t: 8, lineIdx: 0, slotIdx: 1 },
    ])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 8.5, playerState), // past the last event
    )

    // When
    playerState.value = 1
    await nextTick()
    runTick()

    // Then — idx=1 (last event, no next) → progress = 1
    expect(result.activeEventIdx.value).toBe(1)
    expect(result.activeProgress.value).toBe(1)

    unmount()
  })

  // ── progress clamps to 1 at the boundary ─────────────────────────────────

  it('clamps activeProgress to 1 when time equals the next event timestamp (Math.min guard)', async () => {
    // Given — time equals event[1].t exactly; binary search returns idx=1 (no next) → progress=1
    const { runTick } = setupRafMocks()
    const bundle = makeBundle([
      { t: 5, lineIdx: 0, slotIdx: 0 },
      { t: 10, lineIdx: 0, slotIdx: 1 },
    ])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 10, playerState),
    )

    // When
    playerState.value = 1
    await nextTick()
    runTick()

    // Then — binary search returns idx=1 (last event), no next → 1
    expect(result.activeEventIdx.value).toBe(1)
    expect(result.activeProgress.value).toBe(1)

    unmount()
  })

  // ── offsetSec applied before searching ───────────────────────────────────

  it('applies bundle.source.offsetSec to getCurrentTime before the binary search', async () => {
    // Given — offsetSec=3; getCurrentTime returns 2 → effective search time = 5
    const { runTick } = setupRafMocks()
    const bundle = makeBundle(
      [
        { t: 5, lineIdx: 0, slotIdx: 0 },
        { t: 10, lineIdx: 0, slotIdx: 1 },
      ],
      3, // offsetSec
    )
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 2, playerState), // 2+3=5 → hits event[0]
    )

    // When
    playerState.value = 1
    await nextTick()
    runTick()

    // Then — without offset t=2 < 5 → idx=-1; with offset t=5 → idx=0
    expect(result.activeEventIdx.value).toBe(0)

    unmount()
  })

  // ── activeEvent carries correct lineIdx/slotIdx ───────────────────────────

  it('sets activeEvent to the lineIdx and slotIdx of the resolved event', async () => {
    // Given
    const { runTick } = setupRafMocks()
    const bundle = makeBundle([
      { t: 1, lineIdx: 0, slotIdx: 0 },
      { t: 4, lineIdx: 1, slotIdx: 1 },
    ])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 6, playerState), // t=6 lands on event[1]
    )

    // When
    playerState.value = 1
    await nextTick()
    runTick()

    // Then
    expect(result.activeEvent.value).toEqual({ lineIdx: 1, slotIdx: 1 })

    unmount()
  })

  // ── stop prevents further rAF registration ────────────────────────────────

  it('stops scheduling rAF frames when playerState leaves PLAYING', async () => {
    // Given
    const { runTick, rafSpy } = setupRafMocks()
    const bundle = makeBundle([{ t: 0, lineIdx: 0, slotIdx: 0 }])
    const playerState = ref(0)
    const { result, unmount } = withSetup(() =>
      usePlaybackEngine(bundle, () => 1, playerState),
    )

    playerState.value = 1 // start
    await nextTick()
    runTick() // one tick fires, re-registers rAF

    expect(result.activeEventIdx.value).toBe(0) // sanity check: refs were set

    // When — pause
    playerState.value = 2
    await nextTick()

    const callCountAfterStop = rafSpy.mock.calls.length
    runTick() // the previously-captured callback was cancelled, so this is a no-op

    // Then — no new rAF registration after stop
    expect(rafSpy.mock.calls.length).toBe(callCountAfterStop)

    unmount()
  })
})
