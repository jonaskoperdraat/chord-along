## 1. Frontend scaffold

- [x] 1.1 Scaffold Vue 3 + Vite + TypeScript project in `frontend/` (`npm create vite@latest frontend -- --template vue-ts`)
- [x] 1.2 Add ESLint with `eslint-plugin-vue` and `@typescript-eslint`, add Prettier; verify `npm run lint` passes
- [x] 1.3 Strip Vite boilerplate (default counter component, styles, logos); leave a clean `App.vue` shell
- [x] 1.4 Add `npm run lint` and `npm run build` scripts to `frontend/package.json`; update `CLAUDE.md` with dev commands

## 2. Playback bundle schema and fixture

- [x] 2.1 Define TypeScript types for the playback bundle in `frontend/src/types/playBundle.ts` (`PlayBundle`, `Line`, `Slot`, `Event`, `YoutubeSource`)
- [x] 2.2 Hand-craft `frontend/src/fixtures/sample.play.json` for one song (minimum: one verse + one chorus, timestamps accurate enough to play along)
- [x] 2.3 Add a bundle version guard utility: logs a console warning if `bundle.version` is not a recognized value

## 3. YouTube player composable

- [x] 3.1 Create `frontend/src/composables/useYouTubePlayer.ts`: inject the IFrame API script once on first call, handle the `window.onYouTubeIframeAPIReady` callback; if `window.YT` already exists, initialize directly
- [x] 3.2 Expose `createPlayer(elementId, videoId)` that returns `{ currentTime, playerState, play, pause, seek }`
- [x] 3.3 Ensure the player instance is destroyed on composable unmount (no dangling IFrame)

## 4. Playback engine composable

- [x] 4.1 Create `frontend/src/composables/usePlaybackEngine.ts`: accepts `bundle: PlayBundle` and a YouTube player ref; starts a `requestAnimationFrame` loop when the video is playing
- [x] 4.2 Implement binary search over `bundle.events` to find the last event with `t <= currentTime`; expose result as `activeEvent: Ref<{ lineIdx: number, slotIdx: number } | null>`
- [x] 4.3 Stop the rAF loop when the component unmounts or the video is paused/ended

## 5. Chord display component

- [x] 5.1 Create `frontend/src/components/ChordDisplay.vue`: accepts `bundle: PlayBundle` and `activeEvent` as props; renders all lines and slots
- [x] 5.2 Render chord names above lyric text per slot; show section label above each line that has a `section` field
- [x] 5.3 Apply a highlight CSS class to the active slot; ensure no slot is highlighted when `activeEvent` is null

## 6. Player page wiring

- [x] 6.1 Create `frontend/src/views/PlayerView.vue`: loads `sample.play.json`, mounts the YouTube player composable, mounts the playback engine composable, passes `activeEvent` to `ChordDisplay`
- [x] 6.2 Wire `App.vue` to render `PlayerView` on the root route (no router needed — direct render is fine for this slice)
- [x] 6.3 Smoke test: open `npm run dev`, confirm video loads, chords scroll and highlight in sync with audio
