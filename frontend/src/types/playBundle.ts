export interface YoutubeSource {
  kind: 'youtube'
  videoId: string
  offsetSec: number
}

export type Source = YoutubeSource

export interface Slot {
  chord?: string
  text?: string
  t?: number
}

export interface Line {
  section?: string
  slots: Slot[]
}

export interface BundleEvent {
  t: number
  lineIdx: number
  slotIdx: number
}

export interface PlayBundle {
  source: Source
  version: number
  lines: Line[]
  events: BundleEvent[]
}
