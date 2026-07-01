## ADDED Requirements

### Requirement: Phase 0 — Compiler pipeline (complete)

Phase 0 establishes the core compilation pipeline and player prototype. It is
complete as of the initial implementation.

Delivered:
- ChordPro source → `TranscriptionBundle` compiler (`compile.ts`, TypeScript)
- `TranscriptionBundle` and `SyncPlayData` type specifications
- Vue 3 / Vite frontend scaffold
- YouTube embed player
- Chord display component with sync playback (binary search on timestamps)
- Fixture-based demo (Photograph by Nickelback)

#### Scenario: Phase 0 is considered complete

- **WHEN** the project state is evaluated against Phase 0 deliverables
- **THEN** all items listed above SHALL be present and functional

### Requirement: Phase 1 — Platform core

Phase 1 delivers user authentication, transcription persistence, and a browsable
public repository. No sync authoring or playback in this phase.

Deliverables:
- Clerk integration (Google + Spotify providers)
- User and UserIdentity entity provisioning on first login
- Transcription CRUD API endpoints (Quarkus)
- Plain-textarea ChordPro editor in the frontend (compiled by `compile.ts` on save; source + bundle sent to BE)
- Browse transcriptions page (public, no login required)
- View transcription page (rendered chord sheet, public)
- Account deletion flow (sentinel user pattern)

Phase 1 is complete when a logged-in user can create a transcription, and any
visitor can browse and view it rendered.

#### Scenario: Phase 1 browse is public

- **WHEN** a Guest visits the transcription list
- **THEN** the system SHALL render the list without requiring login

#### Scenario: Phase 1 create requires login

- **WHEN** a Guest attempts to create a transcription
- **THEN** the system SHALL redirect to the Clerk login flow

#### Scenario: Phase 1 editor is a plain textarea

- **WHEN** a logged-in user opens the transcription editor
- **THEN** the system SHALL present a plain textarea for ChordPro input; no syntax highlighting is required in this phase

### Requirement: Phase 2 — Sync authoring

Phase 2 delivers the tap-to-sync workflow. A logged-in user can attach an audio
source to a transcription and tap through chord occurrences to create a sync.

Deliverables:
- Audio source attachment UI (YouTube video ID + offset)
- Guided tap UI: system highlights the next chord occurrence, each tap timestamps it and advances the cursor
- Re-tap from occurrence N: recover from a mis-tap without restarting
- AnchorSidecar persistence (source + computed sourceHash stored on BE)
- SyncPlayData derivation from AnchorSidecar on request
- Stale sync detection: if `AnchorSidecar.sourceHash` diverges from the current `TranscriptionBundle.sourceHash`, the sync is flagged as stale

Phase 2 is complete when a logged-in user can tap a full sync and save it.

#### Scenario: Tap UI highlights next occurrence

- **WHEN** a sync session is in progress
- **THEN** the UI SHALL highlight the next unsynced chord occurrence and wait for the user's tap

#### Scenario: Each tap advances the cursor

- **WHEN** the user taps (Space or touch)
- **THEN** the current occurrence receives the current playback timestamp and the cursor advances to the next occurrence

#### Scenario: Re-tap is available

- **WHEN** the user selects "Re-tap from here" at occurrence N
- **THEN** all timestamps from occurrence N onward SHALL be cleared and the tap session SHALL resume from N

#### Scenario: Saved sync stores anchor sidecar

- **WHEN** the user saves a completed tap session
- **THEN** a `Sync` row and an `AnchorSidecar` row SHALL be persisted with `sourceHash` set to the current `TranscriptionBundle.sourceHash`

### Requirement: Phase 3 — Play along

Phase 3 delivers the full play-along experience and community sync discovery.

Deliverables:
- Sync picker on transcription view (shows all syncs with author, date, like count)
- Player loads `SyncPlayData` + `TranscriptionBundle` and highlights chords in sync with the audio source
- Stale sync warning in the player (shown before playback if the sync is stale)
- Like / unlike transcriptions and syncs (login required)
- Incremental Spotify playback scope prompt

Phase 3 completes the MVP. After Phase 3 the platform supports the full flow:
browse → view → pick sync → play along.

#### Scenario: Player highlights correct chord at current timestamp

- **WHEN** playback is active and the current time falls between `timestamps[i]` and `timestamps[i+1]`
- **THEN** the segment resolved by `occurrences[i]` SHALL be highlighted and all others SHALL be unhighlighted

#### Scenario: Stale sync shown with warning

- **WHEN** a user selects a stale sync (sourceHash mismatch)
- **THEN** the player SHALL display a visible warning before playback begins

#### Scenario: Like requires login

- **WHEN** a Guest attempts to like a transcription or sync
- **THEN** the system SHALL prompt for login before recording the like

### Requirement: Phase 4 — Post-MVP backlog

Phase 4 items are explicitly out of scope for the MVP and SHALL NOT block Phase 3
delivery. They are recorded here for roadmap visibility.

Items:
- Java authoritative compiler: port `compile.ts` to Quarkus so the backend compiles bundles independently of the frontend. Replaces the Phase 1 "FE compiles on save" workaround.
- Rebase algorithm: when a transcription is edited, map stale `AnchorSidecar` anchor tuples to positions in the new `TranscriptionBundle` to recover sync data without re-tapping.
- Spotify Web Playback SDK: use the Spotify access token (with playback scopes) to control audio playback directly from the browser for Spotify-sourced syncs.
- Syntax-aware ChordPro editor: replace the plain textarea with a CodeMirror 6 editor featuring syntax highlighting, autocompletion, and synced scroll to a rendered preview.
- Content moderation: flags, takedowns, and quality signals for community syncs.
- Additional audio sources: Spotify track ID as audio source (distinct from Spotify login).

#### Scenario: Phase 4 items do not block MVP

- **WHEN** Phase 3 is complete
- **THEN** the platform SHALL be considered MVP-complete regardless of Phase 4 item status
