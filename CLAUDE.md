# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**chord-along** is a web tool for authoring ChordPro chord files and synchronizing them to an audio source (YouTube v1; Spotify eventual) via tapping. The architecture is a **compiler pipeline**:

- **Source** (`*.chordpro`) — human-authored, pure ChordPro, no sync data embedded.
- **Binding sidecar** (`*.sync.json`) — the source map; edit-time only, never served. Holds timestamps keyed to chord occurrences (a `taps[]` array + `sourceHash` in v1).
- **Playback bundle** (`*.play.json`) — compiled, denormalized, immutable per version, read-optimized. The player only ever touches this.

The compile step is the only place that resolves identities to positions, unrolls repeats, and bakes end times. See `openspec/specs/chord-sync-design.md` for full design rationale, decisions log, and roadmap.

## Status

This repository is a freshly scaffolded project — there is **no application source code, build system, or tests yet**, and no commits on `main`. What exists so far is tooling for a spec-driven development workflow (OpenSpec) and an IntelliJ IDEA module definition (`chord-along.iml`, a language-agnostic `GENERAL_MODULE`).

When adding the first real code, also add the corresponding build/lint/test commands to this file.

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
