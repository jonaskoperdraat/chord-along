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

export interface Slot {
  chord?: string
  text?: string
  /** Index into TranscriptionBundle.occurrences[]. Present only on slots that carry a chord. */
  occurrenceIdx?: number
}

export interface Line {
  slots: Slot[]
}

export interface Section {
  label?: string
  lines: Line[]
}

export interface Occurrence {
  /** Sequential index in the unrolled chord sequence. Matches the position in SyncPlayData.timestamps[]. */
  occurrenceIdx: number
  /** Index into TranscriptionBundle.sections[]. */
  sectionIdx: number
  /** Index into TranscriptionBundle.sections[sectionIdx].lines[]. */
  lineIdx: number
  /** Index into TranscriptionBundle.sections[sectionIdx].lines[lineIdx].slots[]. */
  slotIdx: number
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
  sections: Section[]
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
