---
name: composable-testing-pattern
description: withSetup helper and rAF mock strategy for testing Vue composables with lifecycle hooks
metadata:
  type: project
---

## Problem

Vue composables that call `onUnmounted`, `watch`, etc. must run inside an active component context. Calling them bare in a test triggers `[Vue warn]: onUnmounted is called when there is no active component instance`.

## withSetup Helper

```typescript
import { defineComponent, createApp } from 'vue'

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
```

Call `unmount()` at the end of each test to clean up.

## rAF Mock Strategy for usePlaybackEngine

`usePlaybackEngine` uses `requestAnimationFrame` for its tick loop. The composable:
1. Listens on `playerState` (watch, not immediate) → calls `start()` when `=== 1`
2. `start()` calls `requestAnimationFrame(tick)`
3. `tick()` runs logic then re-registers itself with `requestAnimationFrame`
4. `stop()` calls `cancelAnimationFrame(rafId)` and sets `rafId = null`

**Key insight:** The `watch` on `playerState` is NOT immediate, so setting `playerState.value = 1` before composable creation does nothing. Always set it AFTER `withSetup` and then `await nextTick()` before calling `runTick()`.

```typescript
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
```

**Usage pattern:**
```typescript
const { runTick } = setupRafMocks()
const playerState = ref(0)
const { result, unmount } = withSetup(() => usePlaybackEngine(bundle, () => time, playerState))
playerState.value = 1   // trigger watch → start() → rAF registered
await nextTick()         // flush Vue scheduler
runTick()               // fire one tick → refs updated
// assert on result.*
unmount()
```

**Stop behavior:** `cancelAnimationFrame` sets `lastCallback = null`. After stop, `runTick()` is a no-op. Verify stop by counting `rafSpy.mock.calls.length` before and after the spurious `runTick()`.

## ChordDisplay SFC: testing via DOM

`segmentMap` and `slotProgressWidth` are internal to `<script setup>` and not exposed. Test them by mounting the component and reading `element.style.width` on `.progress-bar` elements. Helper:

```typescript
function progressBarWidth(wrapper, lineIdx, slotIdx): string {
  const lines = wrapper.findAll('.line')
  const slots = lines[lineIdx].findAll('.slot')
  const bar = slots[slotIdx].find('.progress-bar')
  return (bar.element as HTMLElement).style.width
}
```
