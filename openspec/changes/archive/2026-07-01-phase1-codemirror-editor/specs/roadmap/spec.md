## MODIFIED Requirements

### Requirement: Phase 1 — Platform core

Phase 1 delivers user authentication, transcription persistence, and a browsable
public repository. No sync authoring or playback in this phase.

Deliverables:
- Clerk integration (Google + Spotify providers)
- User and UserIdentity entity provisioning on first login
- Transcription CRUD API endpoints (Quarkus)
- CodeMirror 6 ChordPro editor in the frontend, used as a plain text surface
  (no syntax highlighting, no autocompletion in this phase); compiled by
  `compile.ts` on save, source + bundle sent to BE
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

#### Scenario: Phase 1 editor is CodeMirror without highlighting

- **WHEN** a logged-in user opens the transcription editor
- **THEN** the system SHALL present a CodeMirror 6 editor for ChordPro input,
  with no syntax highlighting or autocompletion required in this phase

### Requirement: Phase 4 — Post-MVP backlog

Phase 4 items are explicitly out of scope for the MVP and SHALL NOT block Phase 3
delivery. They are recorded here for roadmap visibility.

Items:
- Java authoritative compiler: port `compile.ts` to Quarkus so the backend compiles bundles independently of the frontend. Replaces the Phase 1 "FE compiles on save" workaround.
- Rebase algorithm: when a transcription is edited, map stale `AnchorSidecar` anchor tuples to positions in the new `TranscriptionBundle` to recover sync data without re-tapping.
- Spotify Web Playback SDK: use the Spotify access token (with playback scopes) to control audio playback directly from the browser for Spotify-sourced syncs.
- Syntax-aware ChordPro editor: extend the CodeMirror 6 editor already in place since Phase 1 with syntax highlighting, autocompletion, and synced scroll to a rendered preview.
- Content moderation: flags, takedowns, and quality signals for community syncs.
- Additional audio sources: Spotify track ID as audio source (distinct from Spotify login).

#### Scenario: Phase 4 items do not block MVP

- **WHEN** Phase 3 is complete
- **THEN** the platform SHALL be considered MVP-complete regardless of Phase 4 item status
