export interface YoutubeSource {
  kind: 'youtube'
  videoId: string
  offsetSec: number
}

export interface SpotifySource {
  kind: 'spotify'
  trackId: string
  offsetSec: number
}

export type SourceDescriptor = YoutubeSource | SpotifySource

export interface Segment {
  text?: string
  chord?: string
  /** Display-only marker from a ChordPro [*content] annotation (e.g. "|"). Never gets an occurrenceIdx. */
  annotation?: string
  /** Index into TranscriptionBundle.occurrences[]. Present only on segments that carry a chord. */
  occurrenceIdx?: number
}

export interface Line {
  kind: 'line'
  segments: Segment[]
}

export interface Section {
  kind: 'section'
  /** Absent on the root section. */
  label?: string
  /** 'verse' | 'chorus' | 'bridge' | … Absent on the root section. */
  type?: string
  body: Block[]
}

export type Block = Line | Section

export interface Occurrence {
  /** Sequential index in the unrolled chord sequence. Matches the position in SyncPlayData.timestamps[]. */
  occurrenceIdx: number
  /**
   * Navigation path into bundle.body.body[] by successive array indices.
   * Length 1: bundle.body.body[path[0]] is the Line.
   * Length 2: (bundle.body.body[path[0]] as Section).body[path[1]] is the Line.
   */
  path: number[]
  /** Index into the resolved Line's segments[]. */
  segmentIdx: number
  chord: string
  /**
   * First lyric word directly following this chord (punctuation stripped).
   * Used as a disambiguation key during sync rebase when the same chord name
   * appears multiple times — see chord-sync-design.md §6.2.
   */
  anchorWord?: string
}

export interface BundleMetadata {
  title?: string
  artist?: string
  key?: string
  capo?: string
}

export interface TranscriptionBundle {
  source: SourceDescriptor
  version: number
  metadata: BundleMetadata
  /** Root section — always present, never has a label or type. All song content lives here. */
  body: Section
  occurrences: Occurrence[]
}

export interface SyncPlayData {
  /**
   * The TranscriptionBundle.version this sync was produced against.
   * The player uses this to detect a stale sync (bundle version changed since
   * the sync was tapped) and prompt the user to re-tap or update.
   */
  transcriptionVersion?: number
  /**
   * Parallel array to TranscriptionBundle.occurrences[]: timestamps[i] is the
   * audio start time (seconds) for occurrences[i]. Binary-searched at playback
   * time to find the current chord.
   */
  timestamps: number[]
}
