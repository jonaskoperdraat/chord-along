# Chord File Editor & Audio Synchronization — Design Notes

> Status: **draft / reasoning** — input for later spec-driven development.
> Scope: a tool to author chord files (ChordPro), synchronize them to an audio
> source (initially YouTube) via tapping, and serve fast playback.

---

## 1. Framing: this is a compiler pipeline

The cleanest mental model for the whole system is a **compiler**. Three of the
user's instincts — sync separate from source, fast-to-serve playback, mapping
metadata kept apart — map exactly onto the three artifacts of such a pipeline:

| Compiler concept | Our artifact | Role |
|---|---|---|
| Source code | ChordPro file | Human-authored, portable, the editable truth |
| Compiled output | Playback bundle | Denormalized, immutable per version, read-optimized |
| Source map | Binding sidecar | Reconciles source ↔ playback across edits |

We lean into this separation **deliberately and early**, because it is the
expensive thing to retrofit later. The *intelligence* layered on top can come
incrementally.

---

## 2. The core problem, stated precisely

> **Maintain a stable identity for each chord _occurrence_ across edits.**

A timestamp does not really point at a character offset or a chord name. It
points at *"this specific strum — the 5th chord event in the performance."*
Everything about edit-resilience reduces to: **can we still recognize that
occurrence after the text changed?**

This problem has two regimes that want different tools (see §6).

---

## 3. Terminology

- **Occurrence** — a single chord event in the performance (the unit a timestamp
  binds to). Distinct from a chord *name*, which repeats constantly.
- **Performed / unrolled sequence** — the chord timeline as actually played,
  after expanding repeats (`x4`) and section references (`{chorus}`). All sync
  logic operates on this, **not** the literal source order.
- **Slot** — a `(chord?, text?)` pair in a rendered line; the unit playback
  iterates over.
- **Compile step** — source + sync → playback bundle. The only place that
  resolves IDs to positions, unrolls repeats, and bakes end times.

---

## 4. The three artifacts

### 4.1 Source — `*.chordpro`
Plain ChordPro. **No sync data.** Also the import/export unit. Portability is a
priority (see open question §9.1).

### 4.2 Playback bundle — `*.play.json`
Compiled, denormalized, tiny, **immutable per version**, cache-forever. The read
path never touches anything heavier than this.

```json
{
  "source": { "kind": "youtube", "videoId": "…", "offsetSec": 0 },
  "version": 7,
  "lines": [
    { "section": "verse1", "slots": [
      { "chord": "Am", "text": "Look at", "t": 1.23 },
      { "chord": "C",  "text": " this",   "t": 2.05 },
      { "text": " photograph" }
    ]}
  ]
}
```

- **End times are implicit** — the next slot bearing a `t`. Computed client-side.
- For fast "what chord is playing now?", optionally bake a flat sorted index so
  the player binary-searches instead of walking the tree:
  ```json
  "events": [ { "t": 1.23, "lineIdx": 0, "slotIdx": 0 }, … ]
  ```
- Version + content-address or number the output (`song.play.v7.json`) for
  CDN/cache friendliness.

### 4.3 Binding sidecar — `*.sync.json`
The **source map**. Edit-time only; **never served to the player**. Holds the
heavy write-side data that keeps timestamps glued to occurrences across edits.

```json
{
  "source": { "kind": "youtube", "videoId": "…", "offsetSec": 0 },
  "sourceHash": "sha256:…",
  "occurrences": [
    { "id": "o1", "chord": "Am", "anchorWord": "Look", "line": 0, "char": 0, "t": 1.23 }
  ]
}
```

- `sourceHash` detects drift from the source file.
- **v1 collapse:** for a first version that skips re-binding, this reduces to
  `{ "source", "sourceHash", "taps": [1.23, 2.05, …] }`. The richer
  `occurrences[]` form is derivable later — natural migration, no breaking change.

---

## 5. Capture model: tapping

Tapping produces an **ordinal** mapping: tap *i* = occurrence *i* in performance
order. So **first capture needs no identity machinery** — just zip `taps[]`
against the unrolled chord sequence.

Consequence: all binding complexity lives in **re-editing**, not in capture. The
MVP sync file can be nothing more than timestamps + a source hash.

**Important subtlety (affects the data model even in v1):** the tapped sequence
is the **performed/unrolled** sequence. With `{chorus}` references or `x4`
repeats, one source token expands to many occurrences with different timestamps.
Define "the chord sequence" as the unrolled timeline **everywhere** — capture,
binding, playback.

> Easiest v1 scope: require fully inline ChordPro; treat repeat/reference
> expansion as v2.

---

## 6. Edit-resilience: two regimes

### 6.1 Within an editing session — *position mapping*
We have the edit operations themselves. CodeMirror 6 solves this natively: every
edit is a changeset, and anchored marks ride along automatically. Attach each
timestamp to an editor **mark** →
- insert before a chord → its mark shifts,
- delete across it → it's removed,
- **"nudge a chord slightly to better match the song" becomes free and
  real-time.**

This alone covers most of the desired UX, and is a strong reason to pick
**CodeMirror over a generic highlighter.**

### 6.2 Across sessions / external edits — *sequence alignment*
We only have old text + new text, no operations. Fall back to sequence alignment
(Myers / Needleman–Wunsch): parse both into ordered occurrence lists, diff, carry
timestamps across matched pairs.

**Pitfall:** chord names repeat (a song is mostly `G C D`). Don't align on chord
name alone. Key each token on `(chord, anchored-lyric-word, section)` — two `G`s
become distinguishable when one sits over "love" and one over "you."

The alignment engine can be **deferred entirely** (tapping gives the easy case
for free, §5).

---

## 7. Roadmap

Fix the **separation** now (cheap conceptually, costly to retrofit); layer the
**intelligence** in over time.

### v1
- CodeMirror editor with ChordPro highlighting.
- YouTube IFrame capture.
- Ordinal tap → `taps[] + sourceHash`.
- Compile to playback bundle.
- Edits to a synced source either invalidate or naive-ordinal-remap, with
  unsynced chords **visibly flagged**.

### v1.5
- Live position-mapping via editor marks → in-session nudging keeps timestamps
  glued. Big UX payoff, small effort.

### v2
- Cross-session alignment for robust re-binding.
- Repeat/reference unrolling.

---

## 8. Capture details to bake in early

These shape the sync model, so decide them up front even if implemented later:

- **Offset is small, variable-sign, and calibratable — do NOT hardcode a
  constant.** The earlier "~100–200 ms late" assumption was wrong. Two regimes:
  - *Anticipatory* (predictable, on-beat changes the user has entrained to):
    well-documented **negative mean asynchrony** — taps land a few tens of ms
    *early*. For real music this is small (~40 ms early; one study: −43 ms for
    music vs −65 ms for metronome). Smaller than a metronome, i.e. fairly
    accurate — matching intuition.
  - *Reactive* (unfamiliar song, syncopated/irregular changes): user reacts
    rather than anticipates → simple-reaction-time *lag* (~150 ms range), i.e.
    late.
  - Magnitude also varies with tempo, training, and individual.
  - **Design takeaway:** model offset as a small, **user-adjustable calibration**
    defaulting to ~0 (optionally a tiny negative nudge), per-song overridable.
    Never assume a fixed correction.
  - Refs: Repp 2005 SMS review; Repp & Su 2013; music-vs-metronome NMA
    (PMC12083085).
- **Re-tap from chord N** *(confirmed — wanted)* — a mistake shouldn't cost the
  whole song. Move the capture cursor back to N and resume.
- **Guided / prompted capture** *(confirmed — preferred model)* — the system
  drives a cursor through the *known* unrolled chord sequence: the **next chord
  is highlighted**, each tap timestamps the highlighted chord and advances to the
  next. Consequences:
  - The ordinal mapping (tap *i* → occurrence *i*) is enforced **by
    construction**, not inferred — reinforces §5 ("no identity machinery at
    capture"). Can never produce more taps than chords; a missing tap just means
    capture stopped early.
  - **Mis-taps surface as you go**: if you mistime or miss a change, the
    highlighted chord stops matching what you hear. No need to visualize taps or
    diff counts at the tail — the highlight *is* the feedback surface.
  - Complementary mechanisms: *guided cursor = how you notice drift*;
    *re-tap-from-N = how you recover*.
  - **Minor open point:** missed change → cursor falls behind the music.
    Re-tap-from-N covers this. An optional "skip/advance without recording"
    affordance is the only alternative; likely not worth the complexity. _TBD,
    low priority._

---

## 9. Resolved decisions

### 9.1 Source purity — **RESOLVED: pure ChordPro**
The source stays **strictly pure ChordPro**. No annotated dialect, no inline
occurrence IDs. Rationale: a second dialect is a maintenance and portability cost,
and inline IDs make a mess for the user editing the file.

**Implication:** occurrence identity lives **entirely in the sidecar** (§4.3).
Re-binding (§6.2) is therefore an inference problem against pure text — it must
recover identity from `(chord, anchor-word, section, ordinal)`, never from an ID
embedded in the source. This is the harder engineering path, accepted knowingly
in exchange for a clean source file. The §6.1 in-session mark approach softens
this for the common edit case.

### 9.2 Source descriptor — **RESOLVED: polymorphic from day one**
The `source` descriptor is **polymorphic from the start** so the playback schema
never churns as new providers land.

- **v1:** YouTube only — chosen purely because it's the easiest, most open to
  integrate.
- **Eventual target:** Spotify (the preferred experience) once its harder, less
  open integration is worth tackling.
- **Others:** local file, SoundCloud, etc.

The discriminator is `source.kind`; everything provider-specific hangs off it:
```json
{ "kind": "youtube", "videoId": "…", "offsetSec": 0 }
{ "kind": "spotify", "trackId": "…", "offsetSec": 0 }
{ "kind": "file",    "uri": "…",     "offsetSec": 0 }
```
**Design rule:** sync timestamps are stored relative to a normalized track
timeline + `offsetSec`, **not** tied to a provider's player quirks — so the same
sync mapping can in principle be re-pointed at a different source of the same
recording.

---

## 10. Open area: multi-author sync, ownership & moderation

> Not a v1 concern, but it shapes the data model, so it's parked here explicitly.

The system is **multi-author by nature**. Two independent contributions exist and
should be separable:

1. A user supplies a **ChordPro file** (possibly with their own sync).
2. A *different* user supplies **their own sync** to someone else's chord file.

Because source and sync are already separate artifacts (§4), this is a natural
fit — but it raises governance questions with no v1 answer yet:

- **Identity & attribution.** A sync is authored *against a specific source
  version* (we already carry `sourceHash`). A sidecar likely needs an `author`
  and a stable reference to *which* chord file + version it binds to.
- **Canonical selection.** When multiple syncs exist for one song, which is
  "the" one? Curated-canonical, votes, per-user default, or just "all of them,
  pick in UI"?
- **Edit permissions.** Who may edit the source vs. fork it? Who may attach a
  sync? Owner-only source edits with open sync contribution is one plausible
  default.
- **Moderation.** Is it needed at all at first? If user-generated content is
  shared publicly, eventually yes (spam, mis-syncs, copyright). Keep the hook in
  mind; don't build it in v1.
- **Forking.** Editing someone's source probably means *forking* it (new
  identity), which interacts with how existing syncs follow or detach.

**Data-model implication to keep in mind now:** treat a song as a small graph —
`source` (versioned, owned) ← many `sync` sidecars (versioned, owned, each
pinned to a source version) — rather than a single owned blob. Even if v1 only
ever stores one source + one sync, modeling them as separable, individually
attributable records avoids a painful migration later.

---

## 11. Decisions log

| # | Decision | Choice | Date | Notes |
|---|---|---|---|---|
| 1 | Source purity (§9.1) | **Pure ChordPro; IDs in sidecar only** | 2026-06-22 | Accepts harder re-binding |
| 2 | Source descriptor (§9.2) | **Polymorphic from day one** | 2026-06-22 | YouTube v1; Spotify eventual |
| 3 | Editor (CodeMirror?) | _leaning yes_ | | §6.1 |
| 4 | v1 unroll scope | _inline-only_ | | §5 |
| 5 | Song as source+sync graph (§10) | _leaning yes (model now, defer features)_ | | Multi-author |
| 6 | Canonical sync selection (§10) | _TBD_ | | Post-v1 |
| 7 | Moderation (§10) | _TBD — hook in mind, not built_ | | Post-v1 |
