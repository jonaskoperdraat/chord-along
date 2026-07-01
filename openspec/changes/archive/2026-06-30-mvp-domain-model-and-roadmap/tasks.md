## 1. TranscriptionBundle sourceHash

- [x] 1.1 Add `sourceHash` field to the `TranscriptionBundle` TypeScript type in `frontend/src/types/transcriptionBundle.ts`
- [x] 1.2 Compute SHA-256 of the UTF-8 source string in `compile()` (`frontend/src/compiler/compile.ts`) and include it in the returned bundle
- [x] 1.3 Update the fixture generator (`frontend/scripts/gen-fixture.mjs`) to include `sourceHash` in the generated `sample.bundle.json`
- [x] 1.4 Add Vitest unit tests for `sourceHash`: present, 64-char hex, stable for same input, changes on any source change

## 2. Sync specs into main openspec/specs

- [x] 2.1 Sync `specs/domain-model` delta into `openspec/specs/domain-model/spec.md` (run `openspec sync-specs` or apply manually)
- [x] 2.2 Sync `specs/use-cases` delta into `openspec/specs/use-cases/spec.md`
- [x] 2.3 Sync `specs/auth` delta into `openspec/specs/auth/spec.md`
- [x] 2.4 Sync `specs/roadmap` delta into `openspec/specs/roadmap/spec.md`
- [x] 2.5 Merge `specs/transcription-bundle-schema` delta into `openspec/specs/transcription-bundle-schema/spec.md` (adds the sourceHash requirement to the existing spec)

## 3. PlantUML rendering setup

- [x] 3.1 Document PlantUML rendering setup in `CLAUDE.md` under a new "Diagram tooling" section: VS Code extension (`jebbs.plantuml`), local PlantUML server or plantuml.com online renderer
- [x] 3.2 Add a `.vscode/extensions.json` recommendation for `jebbs.plantuml` so new contributors are prompted to install it
