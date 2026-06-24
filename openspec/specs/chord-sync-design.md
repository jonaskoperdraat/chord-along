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

## 4. The four artifacts

There are two **stored** artifacts (authoritative, never served directly to
the player) and two **derived** artifacts (regenerated on change,
CDN-cached, all the player ever fetches).

```
STORED                              DERIVED + CDN-CACHED
──────────────────────────────      ──────────────────────────────────────
source.chordpro                     transcription.bundle.json
  human-authored text                 parsed, unrolled structure
  no timestamps                       lines[] + occurrences[]
  the editable truth                  shared across all syncs

sync.anchors.json  (per sync)       sync.play.json  (per sync)
  rich anchor tuples                  flat timestamps array
  used only for rebase                trivially derived from anchors
  never served to player              tiny; what the player loads
```

The player joins the two derived artifacts at runtime. Switching syncs on the
transcription page is a client-side operation — swap the timestamps array,
no re-fetch of the transcription bundle.

### 4.1 Source — `source.chordpro`
Plain ChordPro. **No sync data.** Also the import/export unit. Portability is a
priority (see resolved decision §9.1).

### 4.2 Transcription bundle — `transcription.bundle.json`
Derived from the ChordPro source. **CDN-cached; regenerated when the source
changes.** One per transcription, shared across every sync that targets it.

```json
{
  "source": { "kind": "youtube", "videoId": "…", "offsetSec": 0 },
  "version": 3,
  "lines": [
    { "section": "verse1", "slots": [
      { "chord": "Am", "text": "Look at",     "occurrenceIdx": 0 },
      { "chord": "C",  "text": " this",       "occurrenceIdx": 1 },
      { "text":  " photograph" }
    ]}
  ],
  "occurrences": [
    { "occurrenceIdx": 0, "lineIdx": 0, "slotIdx": 0, "chord": "Am" },
    { "occurrenceIdx": 1, "lineIdx": 0, "slotIdx": 1, "chord": "C"  }
  ]
}
```

- `occurrences[]` is the **unrolled** chord sequence — after expanding repeats
  and section references. In v1 (inline-only ChordPro) it equals source order.
- Slots carry `occurrenceIdx` so the player can map from a live timestamp lookup
  back to its visual position without walking the tree.
- The player binary-searches `sync.play.json` timestamps to find the current
  `occurrenceIdx`, then resolves `(lineIdx, slotIdx)` from this index.
- Version the output URL (`/bundle/v3`) for CDN cache friendliness — old URLs
  stay valid indefinitely.

### 4.3 Sync — two forms

**Anchor form — `sync.anchors.json`** (stored; retrieved only for rebase)

```json
{
  "transcriptionVersion": 3,
  "source": { "kind": "youtube", "videoId": "…", "offsetSec": 0 },
  "entries": [
    { "ordinal": 0, "chord": "Am", "anchorWord": "Look", "section": "verse1", "t": 1.23 },
    { "ordinal": 1, "chord": "C",  "anchorWord": "this", "section": "verse1", "t": 2.05 }
  ]
}
```

- `transcriptionVersion` detects drift from the source; triggers rebase if
  the transcription has since been edited.
- The `(chord, anchorWord, section)` tuple is the identity key used during
  sequence alignment (§6.2). Two identical chord names in the same section
  become distinguishable by their lyric anchor.
- Never served to the player. Fetched only when the author tooling needs to
  rebase or re-edit timing.

**Playback form — `sync.play.json`** (derived; CDN-cached)

```json
{
  "transcriptionVersion": 3,
  "timestamps": [1.23, 2.05, 3.11, …]
}
```

- `timestamps[i]` is the start time for `occurrences[i]` in the transcription
  bundle — pure ordinal mapping.
- Trivially derived from the anchor form: sort entries by `ordinal`, pluck `t`.
- Regenerated whenever the anchor form changes (new tap session, rebase
  succeeds, manual timing edit).
- `transcriptionVersion` lets the player detect a stale sync (bundle and play
  versions disagree) and prompt the user.

---

## 5. Capture model: tapping

Tapping produces an **ordinal** mapping: tap *i* = occurrence *i* in performance
order. So **first capture needs no identity machinery** — just zip timestamps
against the unrolled chord sequence from the transcription bundle.

Consequence: all binding complexity lives in **re-editing**, not in capture. At
capture time the anchor form is populated directly: each tap advances a cursor
through `occurrences[]`, and the captured entry stores `(ordinal, chord,
anchorWord, section, t)` in one step — no post-processing needed.

**Important subtlety (affects the data model even in v1):** the tapped sequence
is the **performed/unrolled** sequence. With `{chorus}` references or `x4`
repeats, one source token expands to many occurrences with different timestamps.
Define "the chord sequence" as the unrolled timeline **everywhere** — capture,
binding, playback.

> Easiest v1 scope: require fully inline ChordPro; treat repeat/reference
> expansion as v2.

---

## 5b. Serving model and cache invalidation

**Player fetch pattern:**

```
page load
  ├─▶ GET /transcriptions/{id}/bundle     → transcription.bundle.json  (CDN)
  └─▶ GET /syncs/{id}/play                → sync.play.json             (CDN)
                                               (default: top-rated sync)

user switches sync
  └─▶ GET /syncs/{other-id}/play          → sync.play.json             (CDN)
      transcription bundle already in memory — no re-fetch

rebase / re-tap (author tooling only)
  └─▶ GET /syncs/{id}/anchors             → sync.anchors.json          (not CDN)
```

**Regeneration triggers:**

```
transcription edit
  └─▶ reparse ChordPro → new transcription.bundle.json (new version URL)
  └─▶ for each attached sync:
        align old anchor entries against new occurrences[]
        ├─ all map → reassign ordinals → new sync.play.json
        └─ any lost → bin sync, notify author

new sync tapped
  └─▶ store sync.anchors.json
  └─▶ derive sync.play.json → cache

manual timing edit
  └─▶ update sync.anchors.json
  └─▶ re-derive sync.play.json → cache
```

Cache invalidation is version-based: derived artifacts are addressed by version
number in the URL. Old URLs remain valid (clients holding them keep working);
new clients receive the new version. No CDN purge needed.

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
- ChordPro parser → transcription bundle (`lines[]` + `occurrences[]`).
- CodeMirror editor with ChordPro highlighting.
- YouTube IFrame tap capture → `sync.anchors.json` (with anchor tuples).
- Derive `sync.play.json` from anchors.
- Player fetches transcription bundle + sync.play.json separately; joins at runtime.
- Edits to a synced transcription attempt ordinal remap; unresolved chords
  **visibly flagged**, sync binned if too many are lost.

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
  whole song. Move the capture cursor back to N and resume. **Correction flow:**
  scrub the audio back past the chord(s) to fix, select the first chord to
  re-tap, then resume tapping forward from that point. No separate fine-tuning
  mode — correction IS tapping. No tap timeline or waveform is shown; the
  advancing chord highlight is the sole feedback surface.
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

## 10. Multi-author model: ownership, syncs & governance

The system is **multi-author by nature** with two independently-contributed
artifacts:

1. A user supplies a **transcription** (ChordPro source — their interpretation
   of the song).
2. A *different* user may supply **a sync** to someone else's transcription.

### 10.1 Ownership & attribution

- A transcription is **owned by its author**. Only the owner may edit it
  directly.
- **Anyone may attach a sync** to any transcription. The sync author is
  independent of the transcription author.
- A sync is pinned to a specific transcription version via `sourceHash`.

### 10.2 Canonical sync selection

No curated canonical. The **top-rated sync per audio source** (YouTube,
Spotify, …) surfaces naturally through ratings and appears as a deep-link badge
in the browse view. Users may always select a different sync from the
transcription page.

### 10.3 Forking vs. suggesting changes

To discourage unnecessary proliferation of transcriptions, two explicit paths:

**Suggest a change** (preferred path):
- A fork-with-intent-to-merge workflow, analogous to a pull request.
- On acceptance, the system attempts to **rebase all existing syncs** onto the
  updated transcription (sequence-align old ↔ new occurrences).
- If all occurrences map: rebased syncs carry over; original sync authors are
  notified of the outcome.
- If any occurrence is unmapped: the sync is **binned**; the original sync
  author is notified and may re-tap if desired.
- The suggestion contributor is **credited** on the transcription; sync
  ownership remains with the original authors.

**Fork** (own interpretation):
- Creates a new transcription with its own identity.
- **No syncs transfer.** This cost is intentional — it discourages trivial
  forks and keeps community sync effort consolidated.

### 10.4 Data-model implication

Model a "song" as a graph: `transcription` (versioned, owned) ← many `sync`
sidecars (versioned, each pinned to a transcription version, individually
owned). Even if v1 only ever stores one transcription + one sync, this
structure avoids a painful migration when multi-author features land.

### 10.5 Moderation

Deferred. Public user-generated content will eventually need spam and copyright
controls. The hook is in mind; nothing is built in v1.

---

## 11. Decisions log

| # | Decision | Choice | Date | Notes |
|---|---|---|---|---|
| 1 | Source purity (§9.1) | **Pure ChordPro; IDs in sidecar only** | 2026-06-22 | Accepts harder re-binding |
| 2 | Source descriptor (§9.2) | **Polymorphic from day one** | 2026-06-22 | YouTube v1; Spotify eventual |
| 3 | Editor (CodeMirror?) | _leaning yes_ | | §6.1 |
| 4 | v1 unroll scope | _inline-only_ | | §5 |
| 5 | Song as source+sync graph (§10) | **Yes — model now, defer features** | 2026-06-24 | §10.4 |
| 6 | Canonical sync selection (§10) | **Rating-based; top per source = badge** | 2026-06-24 | §10.2, §12.2 |
| 7 | Moderation (§10) | **Deferred — hook in mind, not built** | 2026-06-24 | §10.5 |
| 8 | Rating gate | **No gate; login + 1 vote/user/subject** | 2026-06-24 | §13.2 |
| 9 | Sync transfer on fork | **None — intentional friction** | 2026-06-24 | §10.3 |
| 10 | Sync rebase on suggestion | **Attempt rebase; bin on failure; notify** | 2026-06-24 | §10.3 |
| 11 | Song entity | **Computed grouping from tags — no entity** | 2026-06-24 | §12.1 |
| 12 | Tag storage | **ChordPro directives are authoritative; DB is read-only index** | 2026-06-24 | §12.3 |
| 13 | Tap correction model | **Scrub + re-select + re-tap; no fine-tune mode** | 2026-06-24 | §8 |
| 14 | Compiled artifact model | **No combined source+sync bundle; separate TranscriptionBundle and SyncData; player joins at runtime** | 2026-06-24 | §4 |
| 15 | SyncData forms | **Two forms: anchor form stored (never CDN), playback form derived and CDN-cached; anchors retrieved only for rebase** | 2026-06-24 | §4.3 |
| 16 | Transcription bundle | **Derived from ChordPro source; CDN-cached; contains `lines[]` + `occurrences[]` (unrolled); shared across all syncs** | 2026-06-24 | §4.2 |
| 17 | Cache invalidation | **Version-based URL addressing; no CDN purge; old URLs remain valid** | 2026-06-24 | §5b |

---

## 12. Discoverability & browse model

### 12.1 Entity model

Three primary citizens — **Transcription**, **Sync**, and **Tag**. "Song" is a
computed grouping, not a stored entity.

```
Transcription
  id · author · source (ChordPro) · fork_of? · rating

Sync
  id · transcription_id · source_kind · source_id
  author · taps[] · sourceHash · rating

Tag
  transcription_id · key (artist | title | key | capo | …) · value
```

**Song** in the browse view = all transcriptions sharing the same
`(normalized artist_tag, normalized title_tag)` pair. No Song entity is stored.

### 12.2 Browse structure

UG-style hierarchy driven entirely by tags:

```
[Artist: Ed Sheeran]
  Photograph               user1  ****   [YT ▶] [SP ▶]
  Photograph (A minor)     user2  ***    [YT ▶]

[Artist: Nickelback]
  Photograph               user3  ****   [YT ▶]
```

Each row is a transcription. The star rating is the **transcription rating**.
Each badge is the top-rated sync for that source — a deep-link to the
transcription page with that sync preselected.

### 12.3 Tag storage & normalization

Tags originate **in the ChordPro source file** using standard metadata
directives. The database is a **read-only search index** extracted from the
source — not a separate store that needs to stay in sync.

- **Required directives:** `{artist:}` and `{title:}` are mandatory fields on
  every transcription. The UI should enforce this at save time.
- **Supported directives:** `{key:}`, `{capo:}`, and any other standard
  ChordPro metadata directives are extracted and indexed.
- **Flow is unidirectional: source → DB.** The source file is the single
  authoritative tag store. The DB index is derived from it; nothing flows back.
- **On save:** extract directives from the source, update the DB index. If
  `artist` or `title` changed, **notify the user** — these changes affect how
  the transcription is grouped and surfaced in the browse view.
- **No export injection needed.** Tags are already in the file; exporting the
  ChordPro source exports the tags verbatim.
- **Normalization for grouping:** the browse-view grouping key
  `(artist, title)` is derived from lightly normalized tag values (case
  folding, whitespace trimming) so that minor variations in authoring don't
  scatter the same song across multiple groups. UI autocomplete on the
  directives reinforces convergence. Moderation as backstop.
- **No authoritative external song database.** Normalization plus UX nudges
  is expected to produce sufficient quality without external curation.

### 12.4 Transcription page

A single page combining playback and sync selection — no separate browse-vs-player
routes. The active sync is identified by a `?sync=<id>` query param (fully
deep-linkable). Users switch syncs without leaving the page, which promotes
discovery of alternative syncs and lowers the bar for adding their own.

On desktop, the sync list and chord display sit side by side. On mobile, the
player and chord display take centre stage; the sync list is accessible but
secondary (e.g. bottom drawer or collapsed panel).

---

## 13. Rating model

### 13.1 Two independent rating dimensions

| Dimension | Rates | Surfaced where |
|---|---|---|
| Transcription rating | Quality, completeness, chord selection | Main browse listing |
| Sync rating | Timing accuracy for the given audio source | Per-source badge |

Rated separately. A great transcription with a poor sync is still a great
transcription — and an invitation to add a better sync.

### 13.2 Constraints

- **Login required** to cast a vote. No anonymous ratings.
- **One vote per user per subject** (transcription or sync). No repeat voting.
- **No playthrough gate (v1).** Login + single-vote restriction is expected to
  produce sufficient signal quality without a mandatory playthrough requirement.
