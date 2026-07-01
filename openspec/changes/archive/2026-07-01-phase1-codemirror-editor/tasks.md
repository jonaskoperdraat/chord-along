## 1. Spec update

- [x] 1.1 Verify the delta spec at `specs/roadmap/spec.md` correctly modifies the Phase 1 deliverables bullet, the Phase 1 editor scenario, and the Phase 4 backlog item (no stray "plain textarea" wording left anywhere in `openspec/specs/`)
- [x] 1.2 Confirm no other spec or doc (e.g. `openspec/specs/chord-sync-design.md`) contradicts CodeMirror 6 being the Phase 1 editor
- [ ] 1.3 Archive this change (`/opsx:archive`) to sync the delta into `openspec/specs/roadmap/spec.md`

## 2. Phase 1 implementation (when Phase 1 work begins)

- [ ] 2.1 Add CodeMirror 6 packages (`@codemirror/state`, `@codemirror/view`, and a minimal setup such as `codemirror`'s `basicSetup`) to `frontend/package.json`
- [ ] 2.2 Build a `ChordProEditor.vue` component wrapping an `EditorView` with plain-text-only extensions (no language/highlighting/autocompletion) and a string `v-model` binding
- [ ] 2.3 Wire the editor component into the transcription create/edit flow, feeding its content into `compile.ts` on save exactly as the textarea did
- [ ] 2.4 Confirm cursor/selection state is preserved on external content updates (e.g. loading a different transcription) without unwanted resets
