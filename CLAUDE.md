# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**chord-along** is a web tool for authoring ChordPro chord files and synchronizing them to an audio source (YouTube v1; Spotify eventual) via tapping. The architecture is a **compiler pipeline**:

- **Source** (`*.chordpro`) — human-authored, pure ChordPro, no sync data embedded.
- **Binding sidecar** (`*.sync.json`) — the source map; edit-time only, never served. Holds timestamps keyed to chord occurrences (a `taps[]` array + `sourceHash` in v1).
- **Playback bundle** (`*.play.json`) — compiled, denormalized, immutable per version, read-optimized. The player only ever touches this.

The compile step is the only place that resolves identities to positions, unrolls repeats, and bakes end times. See `openspec/specs/chord-sync-design.md` for full design rationale, decisions log, and roadmap.

## Tech stack

- **Frontend:** Vue 3, Vite, TypeScript — lives in `frontend/`
- **Backend:** Java, Quarkus — lives in `backend/`
- **Editor component:** CodeMirror 6 (changeset model required for §6.1 in-session position mapping)
- **Compilation** runs in both FE (TypeScript, for live preview without roundtrips) and BE (Java, authoritative output)

## Running locally

**Frontend:**
```bash
cd frontend
npm install   # first time only
npm run dev   # → http://localhost:5173
```

Opens the chord player with a Photograph (Nickelback) fixture. The YouTube embed loads automatically; hit play and watch chords highlight in sync.

**Fixture generation** (run after editing `frontend/src/fixtures/sample.chordpro`):
```bash
cd frontend
node scripts/gen-fixture.mjs   # rewrites sample.bundle.json + placeholder sample.sync-play.json
```

To capture real timestamps for the sync file, open `/tap.html` in the running Vite dev server (`http://localhost:5173/tap.html`), play the video, and press `Space` on each chord change. Copy the resulting JSON array into the `timestamps` field of `sample.sync-play.json`.

**Backend:**
```bash
cd backend
./mvnw quarkus:dev   # → http://localhost:8080
```

Starts the Quarkus dev server with hot reload. The API is available at `http://localhost:8080`; the OpenAPI spec at `http://localhost:8080/q/openapi`.

## Commands

```bash
# Frontend — run from frontend/
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # Type-check + production build → frontend/dist/
npm run lint     # ESLint
npm run test     # Vitest unit tests

# Backend — run from backend/
./mvnw quarkus:dev   # Dev server with hot reload → http://localhost:8080
./mvnw test          # Run tests
./mvnw package       # Production build → target/quarkus-app/
```

## Backend conventions

- Prefer `application.yml` over `application.properties` for Quarkus config.
- Prefer properties-based configuration over Java `@Singleton` config beans whenever the framework supports it (e.g., `quarkus.jackson.serialization-inclusion: non-null` instead of an `ObjectMapperCustomizer` class).

## Development workflow: OpenSpec (spec-driven)

This project is configured to develop changes through OpenSpec (`openspec` CLI, v1.4.1) using the `spec-driven` schema (`openspec/config.yaml`). The intended flow is: **propose → apply → archive**. Each step has a Claude skill and a matching `/opsx:*` slash command:

- `openspec-propose` (`/opsx:propose`) — create a change and generate its artifacts: `proposal.md` (what & why), `design.md` (how), `tasks.md` (implementation steps).
- `openspec-apply-change` (`/opsx:apply`) — implement the tasks in a change.
- `openspec-archive-change` (`/opsx:archive`) — finalize a completed change.
- `openspec-sync-specs` (`/opsx:sync`) — sync a change's delta specs into the main specs without archiving.
- `openspec-explore` (`/opsx:explore`) — think through an idea before committing to a change.

Prefer driving work through these skills rather than editing OpenSpec artifacts by hand, so the CLI's state tracking stays consistent.

### Useful OpenSpec commands

```bash
openspec list --json                      # list active changes
openspec new change "<kebab-name>"         # scaffold a new change
openspec status --change "<name>" --json   # schema, planning scope, edit constraints
openspec instructions apply --change "<name>" --json   # context files + task progress
```

### Layout

- `openspec/config.yaml` — schema selection and shared project context / per-artifact rules. **Fill in the `context:` block as soon as tech stack and domain decisions are made** — it is injected into every AI prompt when generating artifacts, so an empty context produces generic output.
- `openspec/changes/` — active changes; `openspec/changes/archive/` holds completed ones.
- `openspec/specs/` — main specifications (synced from change deltas).
