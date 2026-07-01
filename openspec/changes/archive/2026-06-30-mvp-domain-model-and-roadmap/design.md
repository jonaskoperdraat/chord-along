## Context

The compiler pipeline and core data types (TranscriptionBundle, SyncPlayData) are implemented and have TypeScript specs. What is missing is a formal picture of the full domain: the entities that persist, the actors who use the system, the authentication strategy, and the phased delivery plan. These are documentation artifacts, not code changes — the only code impact is a minor addition to the TranscriptionBundle spec (sourceHash field).

## Goals / Non-Goals

**Goals:**
- Establish PlantUML-based specs for domain model, use cases, auth, and roadmap.
- Make the stored/derived boundary explicit in the domain model.
- Capture all resolved decisions from the MVP exploration session in durable spec files.
- Add `sourceHash` to the TranscriptionBundle spec to enable stale-sync detection.

**Non-Goals:**
- Backend schema migrations or API endpoint definitions (Phase 1 work).
- Frontend component design (Phase 1–3 work).
- The rebase algorithm or Java authoritative compiler (post-MVP).

## Decisions

### Decision: PlantUML for diagrams

PlantUML is used for all structural diagrams (class, use case, state, sequence) embedded as fenced code blocks in spec markdown files. Rationale: the author is experienced with PlantUML; the syntax is unambiguous enough for AI-assisted editing; diagrams are version-controllable and diffable as text. Trade-off: GitHub does not render PlantUML natively — use the `jebbs.plantuml` VS Code extension with a local PlantUML server or the online renderer at plantuml.com.

### Decision: Stored vs. derived encoded as stereotypes

In the domain model class diagram, `<<stored>>` marks entities persisted in the database and `<<derived>>` marks artifacts recomputed on demand (keyed by sourceHash). This makes the architectural boundary visible in the diagram without requiring a separate legend.

### Decision: sourceHash as the staleness seam

`TranscriptionBundle.sourceHash` is a hash of the ChordPro source text at compile time. `AnchorSidecar.sourceHash` is set to this value when a sync is tapped. After a transcription edit, the two hashes diverge, making stale syncs detectable by simple equality check. No rebase logic is required in MVP — stale syncs show a warning and playback is blocked or degraded. The hash is SHA-256 of the UTF-8 source text (hex-encoded, lower-case).

### Decision: Sentinel user for account deletion

A permanent `User` row with id `00000000-0000-0000-0000-000000000000` and displayName `Deleted User` is seeded at DB initialisation. On account deletion, all `Transcription.authorId` and `Sync.authorId` values are reassigned to this sentinel before the real user row and Clerk identity are deleted. Foreign keys remain non-nullable throughout. Likes are hard-deleted on account deletion (not reassigned).

### Decision: Roadmap captured as a spec, not a task list

The roadmap spec records delivery phases as normative requirements ("the platform SHALL support X before Y"). This makes it possible to reference roadmap phases from other specs and from implementation tasks without duplicating prose.

## Risks / Trade-offs

- [PlantUML rendering gap] GitHub and most markdown renderers do not display PlantUML blocks → Mitigation: document the VS Code plugin in CLAUDE.md or README; consider a CI step to render diagrams to SVG and commit them.
- [sourceHash collision] SHA-256 collisions are computationally infeasible for ChordPro files of any realistic size → no mitigation required.
- [Sentinel user visible in UI] The "Deleted User" placeholder must be handled in all display contexts (transcription card, sync attribution) → the domain-model spec captures this as a display requirement.
