## Why

The compiler pipeline and core data types are implemented, but there is no formal documentation of the domain entities, user-facing capabilities, authentication strategy, or phased delivery plan. Without this foundation, planning and prioritising MVP work is ad-hoc and the intended data model is scattered across prose design notes rather than an authoritative spec.

## What Changes

- Introduce a `domain-model` spec that formally captures all persistent entities, their relationships, and the stored-vs-derived distinction using a PlantUML class diagram.
- Introduce a `use-cases` spec that defines the three actor roles (Guest, User, Author) and maps them to capabilities via a PlantUML use case diagram.
- Introduce an `auth` spec that documents the authentication strategy (Clerk, Google + Spotify providers), the User entity and identity linking model, incremental Spotify playback scope flow, and the account-deletion anonymisation policy.
- Introduce a `roadmap` spec that captures the four MVP phases from current state to full play-along functionality, plus the post-MVP backlog.

## Capabilities

### New Capabilities

- `domain-model`: Persistent entity definitions (User, Transcription, Sync, AnchorSidecar, Like), derived artifact contracts (TranscriptionBundle, SyncPlayData), entity relationships, and the stored/derived boundary.
- `use-cases`: Actor roles (Guest, User, Author) and their capabilities across browsing, authoring, sync creation, playback, and rating.
- `auth`: Managed auth via Clerk with Google and Spotify providers; identity-only scopes at login; incremental Spotify playback scopes; User and UserIdentity entity design; sentinel-user pattern for account deletion.
- `roadmap`: Four phased delivery plan — Phase 0 (done: compiler pipeline), Phase 1 (platform core: auth + transcription CRUD), Phase 2 (sync authoring: tapping UI + anchor sidecar), Phase 3 (play along: sync picker + player), Phase 4 (post-MVP: rebase, Java compiler, Spotify playback).

### Modified Capabilities

- `transcription-bundle-schema`: Add `sourceHash` field to `TranscriptionBundle`. The hash is the key used for stale-sync detection (AnchorSidecar.sourceHash compared against the current bundle's hash). No other requirement changes.

## Impact

- `openspec/specs/` — four new capability spec directories created.
- `openspec/specs/transcription-bundle-schema/spec.md` — minor addition of `sourceHash` field requirement.
- No frontend or backend code changes in this change; specs only.
- Downstream changes (Phase 1–3 implementation) will reference these specs as their requirement source.
