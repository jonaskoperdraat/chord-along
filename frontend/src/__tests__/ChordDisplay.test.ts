import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChordDisplay from '../components/ChordDisplay.vue'
import type { TranscriptionBundle, Block, Occurrence } from '../types/transcriptionBundle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBundle(blocks: Block[], occurrences: Occurrence[]): TranscriptionBundle {
  return {
    source: { kind: 'youtube', videoId: 'test', offsetSec: 0 },
    version: 1,
    metadata: {},
    body: { kind: 'section', body: blocks },
    occurrences,
  }
}

// Navigate to a progress-bar inside a named section in the rendered DOM.
// sectionIdx indexes into the named .section elements; lineIdx and segmentIdx
// index within that section's .line and .slot children.
function progressBarWidth(
  wrapper: ReturnType<typeof mount>,
  sectionIdx: number,
  lineIdx: number,
  segmentIdx: number,
): string {
  const sections = wrapper.findAll('.section')
  const lines = sections[sectionIdx].findAll('.line')
  const slots = lines[lineIdx].findAll('.slot')
  const bar = slots[segmentIdx].find('.progress-bar')
  return (bar.element as HTMLElement).style.width
}

// ---------------------------------------------------------------------------
// segmentMap — territory and fill fraction tests
// ---------------------------------------------------------------------------

describe('ChordDisplay segmentMap', () => {
  // ── single event, single segment ─────────────────────────────────────────

  it('assigns fillStart=0 and fillEnd=1 for a single-segment territory with a single occurrence', () => {
    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [{ chord: 'G', text: 'go', occurrenceIdx: 0 }] },
      ]}],
      [{ occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'G' }],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: 0, activeProgress: 0.5 },
    })

    // Then — fillStart=0, fillEnd=1, progress=0.5 → local=0.5 → 50%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('50%')
  })

  // ── two consecutive chord segments on the same line ───────────────────────

  it('gives each of two adjacent chord-segment occurrences its own exclusive territory', () => {
    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [
          { chord: 'G', text: 'a', occurrenceIdx: 0 },
          { chord: 'D', text: 'b', occurrenceIdx: 1 },
        ]},
      ]}],
      [
        { occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, path: [0, 0], segmentIdx: 1, chord: 'D' },
      ],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress: 1 },
    })

    // Then — segment 0 is in occ 0's territory → fillEnd=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    // segment 1 belongs to occ 1, not the active occ 0 → 0%
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('shows 0% on the first segment when the second occurrence is active', () => {
    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [
          { chord: 'G', text: 'a', occurrenceIdx: 0 },
          { chord: 'D', text: 'b', occurrenceIdx: 1 },
        ]},
      ]}],
      [
        { occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, path: [0, 0], segmentIdx: 1, chord: 'D' },
      ],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 1 }, activeEventIdx: 1, activeProgress: 0.5 },
    })

    // Then
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('50%')
  })

  // ── chord segment + text-only continuation on same line ──────────────────

  it('includes a following text-only segment in the preceding chord occurrence territory with correct fractions', () => {
    // charLen seg0 = max(len("B"), len("graph"), 1) = 5
    // charLen seg1 = max(0, len(" every time"), 1) = 11
    // total = 16; seg0: [0, 5/16]; seg1: [5/16, 1]

    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [
          { chord: 'B', text: 'graph', occurrenceIdx: 0 },
          { text: ' every time' },
        ]},
      ]}],
      [{ occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'B' }],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress: 0.3125 },
    })

    // Then — seg0: local=(0.3125-0)/(0.3125-0)=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    // seg1: local=(0.3125-0.3125)/(1-0.3125)=0 → 0%
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('fills the text-only segment proportionally when activeProgress is mid-way through its fill range', () => {
    // seg1: fillStart=5/16, fillEnd=1; midpoint=(5/16+1)/2=0.65625

    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [
          { chord: 'B', text: 'graph', occurrenceIdx: 0 },
          { text: ' every time' },
        ]},
      ]}],
      [{ occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'B' }],
    )
    const activeProgress = (5 / 16 + 1) / 2

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress },
    })

    // Then — seg1: local=(0.65625-0.3125)/(1-0.3125)=0.5 → 50%
    const bar1 = wrapper.findAll('.section')[0].findAll('.line')[0].findAll('.slot')[1].find('.progress-bar')
    expect((bar1.element as HTMLElement).style.width).toBe('50%')
  })

  // ── cross-line territory within a section ─────────────────────────────────

  it('spans a chord occurrence territory across a line break when the next segment is text-only on the next line', () => {
    // Line 0: [Am] (chord only) → occ 0; path=[0,0], segmentIdx=0
    // Line 1: [text:"cont"][chord:"G"] → occ 1; path=[0,1], segmentIdx=1
    // territory of occ 0: [0,0]:0 + [0,1]:0
    // charLen = max(2,0,1)=2 and max(0,4,1)=4; total=6

    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [{ chord: 'Am', occurrenceIdx: 0 }] },
        { kind: 'line', segments: [{ text: 'cont' }, { chord: 'G', occurrenceIdx: 1 }] },
      ]}],
      [
        { occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'Am' },
        { occurrenceIdx: 1, path: [0, 1], segmentIdx: 1, chord: 'G' },
      ],
    )
    const activeProgress = 2 / 6

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress },
    })

    // Then — [0,0]:0: fillStart=0, fillEnd=2/6 → local=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    // [0,1]:0: fillStart=2/6, fillEnd=1 → local=0 → 0%
    expect(progressBarWidth(wrapper, 0, 1, 0)).toBe('0%')
    // [0,1]:1 belongs to occ 1 → 0%
    expect(progressBarWidth(wrapper, 0, 1, 1)).toBe('0%')
  })

  // ── last occurrence territory extends to end of bundle ────────────────────

  it('extends the last occurrence territory to every remaining segment in the bundle', () => {
    // Single occurrence at [0,0]:0 → territory spans all 4 segments across 2 lines

    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [{ chord: 'A', occurrenceIdx: 0 }, { chord: 'B' }] },
        { kind: 'line', segments: [{ chord: 'C' }, { chord: 'D' }] },
      ]}],
      [{ occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'A' }],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress: 1 },
    })

    // Then — all 4 segments are in occ 0's territory and activeProgress=1 → 100% each
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('100%')
    expect(progressBarWidth(wrapper, 0, 1, 0)).toBe('100%')
    expect(progressBarWidth(wrapper, 0, 1, 1)).toBe('100%')
  })
})

// ---------------------------------------------------------------------------
// segmentProgressWidth — helper function via DOM
// ---------------------------------------------------------------------------

describe('ChordDisplay slotProgressWidth', () => {
  it('returns 0% for all segments when activeEventIdx is null', () => {
    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [
          { chord: 'G', occurrenceIdx: 0 },
          { chord: 'D', occurrenceIdx: 1 },
        ]},
      ]}],
      [
        { occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, path: [0, 0], segmentIdx: 1, chord: 'D' },
      ],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: null, activeProgress: 0.5 },
    })

    // Then
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('returns 0% for a segment that has no occurrence coverage', () => {
    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [{ chord: 'X', occurrenceIdx: 0 }] },
      ]}],
      [], // no occurrences → segmentMap is empty
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: 0, activeProgress: 0.5 },
    })

    // Then
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
  })

  it('returns 0% for a segment whose territory belongs to a different occurrence than the active one', () => {
    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [
          { chord: 'G', occurrenceIdx: 0 },
          { chord: 'D', occurrenceIdx: 1 },
        ]},
      ]}],
      [
        { occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, path: [0, 0], segmentIdx: 1, chord: 'D' },
      ],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 1 }, activeEventIdx: 1, activeProgress: 0.5 },
    })

    // Then
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
  })

  it('returns 0% when activeProgress is below the segment fillStart', () => {
    // seg0: [0, 0.5]; seg1: [0.5, 1] — both charLen=1

    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [{ chord: 'A', occurrenceIdx: 0 }, { text: 'b' }] },
      ]}],
      [{ occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'A' }],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress: 0.2 },
    })

    // Then — seg1: local=max(0,(0.2-0.5)/(1-0.5))=0 → 0%
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('returns the correct percentage when activeProgress is within the segment fill range', () => {
    // seg0: [0, 0.5]; seg1: [0.5, 1]; activeProgress=0.75 → seg1 local=0.5

    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [{ chord: 'A', occurrenceIdx: 0 }, { text: 'b' }] },
      ]}],
      [{ occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'A' }],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress: 0.75 },
    })

    // Then
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('50%')
  })

  it('clamps to 100% when activeProgress exceeds the segment fillEnd', () => {
    // Given
    const bundle = makeBundle(
      [{ kind: 'section', body: [
        { kind: 'line', segments: [{ chord: 'A', occurrenceIdx: 0 }, { text: 'b' }] },
      ]}],
      [{ occurrenceIdx: 0, path: [0, 0], segmentIdx: 0, chord: 'A' }],
    )

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { path: [0, 0], segmentIdx: 0 }, activeEventIdx: 0, activeProgress: 0.9 },
    })

    // Then — seg0: local=min(1,(0.9-0)/(0.5-0))=min(1,1.8)=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
  })
})
