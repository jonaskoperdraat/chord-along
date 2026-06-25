import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChordDisplay from '../components/ChordDisplay.vue'
import type { TranscriptionBundle, Section, Occurrence } from '../types/transcriptionBundle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBundle(sections: Section[], occurrences: Occurrence[]): TranscriptionBundle {
  return {
    source: { kind: 'youtube', videoId: 'test', offsetSec: 0 },
    version: 1,
    metadata: {},
    sections,
    occurrences,
  }
}

function progressBarWidth(
  wrapper: ReturnType<typeof mount>,
  sectionIdx: number,
  lineIdx: number,
  slotIdx: number,
): string {
  const sections = wrapper.findAll('.section')
  const lines = sections[sectionIdx].findAll('.line')
  const slots = lines[lineIdx].findAll('.slot')
  const bar = slots[slotIdx].find('.progress-bar')
  return (bar.element as HTMLElement).style.width
}

// ---------------------------------------------------------------------------
// segmentMap — territory and fill fraction tests
// ---------------------------------------------------------------------------

describe('ChordDisplay segmentMap', () => {
  // ── single event, single slot ─────────────────────────────────────────────

  it('assigns fillStart=0 and fillEnd=1 for a single-slot territory with a single occurrence', () => {
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'G', text: 'go', occurrenceIdx: 0 }] }] }],
      [{ occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'G' }],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: 0, activeProgress: 0.5 },
    })

    // fillStart=0, fillEnd=1, progress=0.5 → local=(0.5-0)/(1-0)=0.5 → 50%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('50%')
  })

  // ── two consecutive chord slots on the same line ──────────────────────────

  it('gives each of two adjacent chord-slot occurrences its own exclusive territory', () => {
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'G', text: 'a', occurrenceIdx: 0 }, { chord: 'D', text: 'b', occurrenceIdx: 1 }] }] }],
      [
        { occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, sectionIdx: 0, lineIdx: 0, slotIdx: 1, chord: 'D' },
      ],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 1 },
    })

    // Slot 0 is in occ 0's territory (only slot) → fillStart=0, fillEnd=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    // Slot 1 belongs to occ 1, not the active occ 0 → 0%
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('shows 0% on the first slot when the second occurrence slot is active', () => {
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'G', text: 'a', occurrenceIdx: 0 }, { chord: 'D', text: 'b', occurrenceIdx: 1 }] }] }],
      [
        { occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, sectionIdx: 0, lineIdx: 0, slotIdx: 1, chord: 'D' },
      ],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 1 }, activeEventIdx: 1, activeProgress: 0.5 },
    })

    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('50%')
  })

  // ── chord slot + text-only continuation on same line ─────────────────────

  it('includes a following text-only slot in the preceding chord occurrence territory with correct fractions', () => {
    // charLen slot0 = max(len("B"), len("graph"), 1) = 5
    // charLen slot1 = max(0, len(" every time"), 1) = 11
    // total = 16; slot0: [0, 5/16]; slot1: [5/16, 1]
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'B', text: 'graph', occurrenceIdx: 0 }, { text: ' every time' }] }] }],
      [{ occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'B' }],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 0.3125 },
    })

    // slot0: local=(0.3125-0)/(0.3125-0)=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    // slot1: local=(0.3125-0.3125)/(1-0.3125)=0 → 0%
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('fills the text-only slot proportionally when activeProgress is mid-way through its fill range', () => {
    // slot1: fillStart=5/16, fillEnd=1; midpoint=(5/16+1)/2=0.65625
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'B', text: 'graph', occurrenceIdx: 0 }, { text: ' every time' }] }] }],
      [{ occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'B' }],
    )

    const activeProgress = (5 / 16 + 1) / 2
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress },
    })

    // slot1: local=(0.65625-0.3125)/(1-0.3125)=0.5 → 50%
    const bar1 = wrapper.findAll('.section')[0].findAll('.line')[0].findAll('.slot')[1].find('.progress-bar')
    expect((bar1.element as HTMLElement).style.width).toBe('50%')
  })

  // ── cross-line territory within a section ─────────────────────────────────

  it('spans a chord occurrence territory across a line break when the next slot is text-only on the next line', () => {
    // Section 0, Line 0: [Am] (chord only) → occ 0
    // Section 0, Line 1: [text:"cont"][chord:"G"] → occ 1 at slotIdx 1
    // territory of occ 0: sec0-line0-slot0 + sec0-line1-slot0
    // charLen = max(2,0,1)=2 and max(0,4,1)=4; total=6
    const bundle = makeBundle(
      [{
        lines: [
          { slots: [{ chord: 'Am', occurrenceIdx: 0 }] },
          { slots: [{ text: 'cont' }, { chord: 'G', occurrenceIdx: 1 }] },
        ],
      }],
      [
        { occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'Am' },
        { occurrenceIdx: 1, sectionIdx: 0, lineIdx: 1, slotIdx: 1, chord: 'G' },
      ],
    )

    const activeProgress = 2 / 6
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress },
    })

    // sec0-line0-slot0: fillStart=0, fillEnd=2/6 → local=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    // sec0-line1-slot0: fillStart=2/6, fillEnd=1 → local=0 → 0%
    expect(progressBarWidth(wrapper, 0, 1, 0)).toBe('0%')
    // sec0-line1-slot1 belongs to occ 1 → 0%
    expect(progressBarWidth(wrapper, 0, 1, 1)).toBe('0%')
  })

  // ── last occurrence territory extends to end of bundle ────────────────────

  it('extends the last occurrence territory to every remaining slot in the bundle', () => {
    // Single occurrence at (0,0,0) → territory spans all 4 slots across 2 lines
    const bundle = makeBundle(
      [{ lines: [
        { slots: [{ chord: 'A', occurrenceIdx: 0 }, { chord: 'B' }] },
        { slots: [{ chord: 'C' }, { chord: 'D' }] },
      ]}],
      [{ occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'A' }],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 1 },
    })

    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('100%')
    expect(progressBarWidth(wrapper, 0, 1, 0)).toBe('100%')
    expect(progressBarWidth(wrapper, 0, 1, 1)).toBe('100%')
  })
})

// ---------------------------------------------------------------------------
// slotProgressWidth — helper function via DOM
// ---------------------------------------------------------------------------

describe('ChordDisplay slotProgressWidth', () => {
  it('returns 0% for all slots when activeEventIdx is null', () => {
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'G', occurrenceIdx: 0 }, { chord: 'D', occurrenceIdx: 1 }] }] }],
      [
        { occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, sectionIdx: 0, lineIdx: 0, slotIdx: 1, chord: 'D' },
      ],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: null, activeProgress: 0.5 },
    })

    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('returns 0% for a slot that has no occurrence coverage', () => {
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'X', occurrenceIdx: 0 }] }] }],
      [], // no occurrences → segmentMap is empty
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: 0, activeProgress: 0.5 },
    })

    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
  })

  it('returns 0% for a slot whose territory belongs to a different occurrence than the active one', () => {
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'G', occurrenceIdx: 0 }, { chord: 'D', occurrenceIdx: 1 }] }] }],
      [
        { occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'G' },
        { occurrenceIdx: 1, sectionIdx: 0, lineIdx: 0, slotIdx: 1, chord: 'D' },
      ],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 1 }, activeEventIdx: 1, activeProgress: 0.5 },
    })

    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('0%')
  })

  it('returns 0% when activeProgress is below the slot fillStart', () => {
    // slot0: [0, 0.5]; slot1: [0.5, 1] — both charLen=1
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'A', occurrenceIdx: 0 }, { text: 'b' }] }] }],
      [{ occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'A' }],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 0.2 },
    })

    // slot1: local=max(0,(0.2-0.5)/(1-0.5))=0 → 0%
    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('0%')
  })

  it('returns the correct percentage when activeProgress is within the slot fill range', () => {
    // slot0: [0, 0.5]; slot1: [0.5, 1]; activeProgress=0.75 → slot1 local=0.5
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'A', occurrenceIdx: 0 }, { text: 'b' }] }] }],
      [{ occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'A' }],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 0.75 },
    })

    expect(progressBarWidth(wrapper, 0, 0, 1)).toBe('50%')
  })

  it('clamps to 100% when activeProgress exceeds the slot fillEnd', () => {
    const bundle = makeBundle(
      [{ lines: [{ slots: [{ chord: 'A', occurrenceIdx: 0 }, { text: 'b' }] }] }],
      [{ occurrenceIdx: 0, sectionIdx: 0, lineIdx: 0, slotIdx: 0, chord: 'A' }],
    )

    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { sectionIdx: 0, lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 0.9 },
    })

    // slot0: local=min(1,(0.9-0)/(0.5-0))=min(1,1.8)=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0, 0)).toBe('100%')
  })
})
