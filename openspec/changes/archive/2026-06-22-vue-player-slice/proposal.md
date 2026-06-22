## Why

The core purpose of chord-along is playing along with music using synchronized chord sheets. Before building authoring or capture tools, we need to validate that the playback experience — chords highlighting in time with a YouTube audio source — actually feels good to use. This slice establishes the frontend scaffold and the player as the foundation everything else builds on.

## What Changes

- Scaffold the Vue 3 / Vite / TypeScript frontend project under `frontend/`
- Introduce a hand-crafted `*.play.json` fixture for one song (validates the playback bundle schema)
- Implement a YouTube IFrame player component (wraps the YouTube IFrame API)
- Implement a chord/lyric display that highlights the current slot in sync with the playing audio
- Playback engine: timer loop polling the YouTube player's current time, binary-searching the events index to find the active slot

## Capabilities

### New Capabilities

- `frontend-scaffold`: Vue 3 + Vite + TypeScript project structure under `frontend/`, including dev tooling (ESLint, Prettier) and routing stub.
- `playback-bundle-schema`: Definition and validation of the `*.play.json` format — lines, slots, events index — plus a hand-crafted fixture for one song.
- `youtube-player`: Component wrapping the YouTube IFrame API; exposes current playback time, play/pause state, and seek.
- `chord-display-player`: Component that renders lines/slots from a playback bundle and highlights the current slot based on playback time. Uses the events index for O(log n) lookup.

### Modified Capabilities

## Impact

- Creates `frontend/` directory; no backend changes
- Introduces the YouTube IFrame API as an external dependency (script-tag injection)
- The `*.play.json` schema established here is the contract the future compiler must produce — changes to it are breaking for the player
