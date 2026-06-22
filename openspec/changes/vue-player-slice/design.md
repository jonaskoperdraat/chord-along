## Context

This is the first code added to chord-along. There is no existing frontend; we are establishing the project scaffold and the first real feature: a chord/lyric display synchronized to a YouTube audio source via a hand-crafted `*.play.json` fixture.

The playback bundle schema defined here becomes the contract the future compiler must satisfy — getting it right matters more than the UI polish at this stage.

## Goals / Non-Goals

**Goals:**
- Scaffold `frontend/` with Vue 3 + Vite + TypeScript, ready for future feature slices
- Define and lock in the `*.play.json` schema (lines, slots, events index)
- Produce a working player: YouTube plays, chords highlight in sync

**Non-Goals:**
- No backend, no API calls
- No ChordPro authoring or editing
- No tap capture or compilation
- No persistence or routing beyond a single player page
- No mobile/responsive polish

## Decisions

### D1: Project layout — mono-repo with `frontend/` subdirectory

`frontend/` holds the Vite + Vue 3 project. The repo root remains language-agnostic. When the Quarkus backend arrives it lands in `backend/`. No workspace tooling at the root yet — add it when both are present.

### D2: Vue 3 Composition API, `<script setup>` throughout

No Options API. Composition API gives better TypeScript inference and aligns with where the Vue ecosystem is heading. `<script setup>` is the idiomatic form.

### D3: Playback bundle schema — events index is mandatory

The design notes propose the events index as optional ("optionally bake a flat sorted index"). We make it **mandatory** in the schema from day one. Rationale: the player always needs O(log n) lookup; walking the tree on every animation frame is a footgun. Implicit end-times (next `t` in the events index) remain the rule — the player computes them client-side.

```
PlayBundle
├── source   { kind: "youtube", videoId: string, offsetSec: number }
├── version  number
├── lines[]  { section?: string, slots[]: { chord?: string, text?: string, t?: number } }
└── events[] { t: number, lineIdx: number, slotIdx: number }   ← mandatory, sorted asc
```

`events[]` contains only slots that have a `t` (i.e., chord-change moments). Slots without `t` are lyric-only continuations; they inherit the previous event's chord highlight.

### D4: YouTube IFrame API — script-tag injection, single global instance

The YouTube IFrame API loads via `<script src="https://www.youtube.com/iframe_api">` and calls a global `onYouTubeIframeAPIReady` callback. We inject the script once on app mount and expose the player instance via a composable (`useYouTubePlayer`). There is exactly one player per page in this slice; no pooling needed.

The composable owns the player lifecycle (create, destroy on unmount) and exposes:
- `currentTime(): number` — polls `player.getCurrentTime()`
- `playerState: Ref<YT.PlayerState>`
- `seek(t: number)`, `play()`, `pause()`

### D5: Playback engine — `requestAnimationFrame` loop, binary search

A `requestAnimationFrame` loop in a composable (`usePlaybackEngine`) polls `currentTime()` each frame and binary-searches `events[]` for the active event. Polling on rAF (~60 Hz) is fine for chord-level sync; chords don't change faster than a few per second.

Binary search: find the last event with `e.t <= currentTime`. That event's `lineIdx`/`slotIdx` is the active slot. Before the first event, no slot is highlighted.

`usePlaybackEngine` emits a reactive `activeEvent: Ref<{ lineIdx, slotIdx } | null>` that the display component consumes.

### D6: Display component — pure rendering, no playback logic

`ChordDisplay.vue` receives `bundle: PlayBundle` and `activeEvent` as props/inject. It renders lines and slots; the currently active slot gets a CSS highlight class. No timer, no YouTube awareness.

This separation means the display is testable without a real YouTube player.

## Risks / Trade-offs

- **YouTube IFrame API global callback** — the API fires `window.onYouTubeIframeAPIReady` once and never again. If the composable mounts after that callback fires (e.g., HMR), it will never initialize. Mitigation: check `window.YT` on mount; if already loaded, initialize directly without waiting for the callback.
- **`*.play.json` schema is a hard contract** — future compiler must produce exactly this format. Breaking changes here mean updating both compiler and player. Mitigation: version field in the bundle (`version: number`); player can gate on it when schemas diverge.
- **Hand-crafted fixture accuracy** — timestamps in the fixture will be approximate. The goal is "good enough to feel playable," not frame-perfect. The fixture is replaced by compiled output in a later slice.
