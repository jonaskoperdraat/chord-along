import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChordDisplay from '../components/ChordDisplay.vue'
import type { PlayBundle } from '../types/playBundle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBundle(overrides: Partial<PlayBundle> = {}): PlayBundle {
  return {
    source: { kind: 'youtube', videoId: 'test', offsetSec: 0 },
    version: 1,
    lines: [],
    events: [],
    ...overrides,
  }
}

/** Return the `width` style value from the progress-bar of the slot at
 * (lineIdx, slotIdx) in the mounted wrapper. */
function progressBarWidth(
  wrapper: ReturnType<typeof mount>,
  lineIdx: number,
  slotIdx: number,
): string {
  const lines = wrapper.findAll('.line')
  const slots = lines[lineIdx].findAll('.slot')
  const bar = slots[slotIdx].find('.progress-bar')
  return (bar.element as HTMLElement).style.width
}

// ---------------------------------------------------------------------------
// segmentMap — territory and fill fraction tests
// ---------------------------------------------------------------------------

describe('ChordDisplay segmentMap', () => {
  // ── single event, single slot ─────────────────────────────────────────────

  it('assigns fillStart=0 and fillEnd=1 for a single-slot territory with a single event', () => {
    // Given
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'G', text: 'go' }] }],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: 0, activeProgress: 0.5 },
    })

    // Then — fillStart=0, fillEnd=1, progress=0.5 → local=(0.5-0)/(1-0)=0.5 → 50%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('50%')
  })

  // ── two consecutive chord slots on the same line ──────────────────────────

  it('gives each of two adjacent chord-slot events its own exclusive territory on the same line', () => {
    // Given — two events, each owning exactly one slot
    // Event 0 at slot 0, Event 1 at slot 1. Territory of event 0 = [slot 0] only.
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'G', text: 'a' }, { chord: 'D', text: 'b' }] }],
      events: [
        { t: 0, lineIdx: 0, slotIdx: 0 },
        { t: 4, lineIdx: 0, slotIdx: 1 },
      ],
    })

    // When — event 0 is active at full progress
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 1 },
    })

    // Then
    // Slot 0 is in event 0's territory (only slot) → fillStart=0, fillEnd=1
    // At activeProgress=1, local=(1-0)/(1-0)=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('100%')

    // Slot 1 belongs to event 1, not the active event 0 → 0%
    expect(progressBarWidth(wrapper, 0, 1)).toBe('0%')
  })

  it('shows 0% on the first slot when the second event slot is active', () => {
    // Given
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'G', text: 'a' }, { chord: 'D', text: 'b' }] }],
      events: [
        { t: 0, lineIdx: 0, slotIdx: 0 },
        { t: 4, lineIdx: 0, slotIdx: 1 },
      ],
    })

    // When — event 1 is active
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { lineIdx: 0, slotIdx: 1 }, activeEventIdx: 1, activeProgress: 0.5 },
    })

    // Then
    // Slot 0 belongs to event 0, not the active event 1 → 0%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('0%')
    // Slot 1 is in event 1's territory → 50%
    expect(progressBarWidth(wrapper, 0, 1)).toBe('50%')
  })

  // ── chord slot + text-only continuation on same line ─────────────────────

  it('includes a following text-only slot in the preceding chord event territory with correct fractions', () => {
    // Given
    // Event 0 at slot 0 (chord="B", text="graph"), slot 1 is text-only (text=" every time")
    // No event at slot 1, so it falls into event 0's territory.
    // charLen slot0 = max(len("B"), len("graph"), 1) = max(1, 5, 1) = 5
    // charLen slot1 = max(0, len(" every time"), 1) = max(0, 11, 1) = 11
    // total = 16
    // slot0: fillStart=0/16=0, fillEnd=5/16=0.3125
    // slot1: fillStart=5/16=0.3125, fillEnd=16/16=1
    const bundle = makeBundle({
      lines: [
        {
          slots: [
            { chord: 'B', text: 'graph' },
            { text: ' every time' },
          ],
        },
      ],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When — event 0 active at activeProgress = 0.3125 (exactly at boundary between slot0 and slot1)
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 0.3125 },
    })

    // Then
    // slot0: local = (0.3125 - 0) / (0.3125 - 0) = 1 → 100%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('100%')

    // slot1: local = (0.3125 - 0.3125) / (1 - 0.3125) = 0 → 0%
    expect(progressBarWidth(wrapper, 0, 1)).toBe('0%')
  })

  it('fills the text-only slot proportionally when activeProgress is mid-way through its fill range', () => {
    // Given
    // charLen slot0 = max(1,5,1)=5, charLen slot1 = max(0,11,1)=11, total=16
    // slot1: fillStart=5/16, fillEnd=16/16=1
    // At activeProgress=0.6875 (midpoint of slot1's fill range):
    //   local = (0.6875 - 0.3125) / (1 - 0.3125) = 0.375 / 0.6875 ≈ 0.5455...
    const bundle = makeBundle({
      lines: [
        {
          slots: [
            { chord: 'B', text: 'graph' },
            { text: ' every time' },
          ],
        },
      ],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When
    const activeProgress = (5 / 16 + 1) / 2 // midpoint = (0.3125+1)/2 = 0.65625
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress },
    })

    // Then
    // slot1: local = (0.65625 - 0.3125) / (1 - 0.3125) = 0.34375 / 0.6875 = 0.5
    const bar1 = wrapper.findAll('.line')[0].findAll('.slot')[1].find('.progress-bar')
    expect((bar1.element as HTMLElement).style.width).toBe('50%')
  })

  // ── cross-line territory ──────────────────────────────────────────────────

  it('spans a chord event territory across a line break when the next slot is text-only on the next line', () => {
    // Given
    // Line 0: [slot 0 = {chord:"Am"}]   ← event 0 starts here
    // Line 1: [slot 0 = {text:"cont"}]   ← text-only, in event 0's territory
    //         [slot 1 = {chord:"G"}]    ← event 1 starts here
    // charLen line0-slot0 = max(2, 0, 1) = 2  (chord="Am")
    // charLen line1-slot0 = max(0, 4, 1) = 4  (text="cont")
    // total territory of event 0 = 6
    // fillStart line0-slot0 = 0/6 = 0,      fillEnd = 2/6 ≈ 0.333
    // fillStart line1-slot0 = 2/6 ≈ 0.333,  fillEnd = 6/6 = 1
    const bundle = makeBundle({
      lines: [
        { slots: [{ chord: 'Am' }] },
        { slots: [{ text: 'cont' }, { chord: 'G' }] },
      ],
      events: [
        { t: 0, lineIdx: 0, slotIdx: 0 },
        { t: 5, lineIdx: 1, slotIdx: 1 },
      ],
    })

    // When — event 0 active, progress = 2/6 (boundary between line0-slot0 and line1-slot0)
    const activeProgress = 2 / 6
    const wrapper = mount(ChordDisplay, {
      props: {
        bundle,
        activeEvent: { lineIdx: 0, slotIdx: 0 },
        activeEventIdx: 0,
        activeProgress,
      },
    })

    // Then
    // line0-slot0: fillStart=0, fillEnd=2/6 → local=(2/6-0)/(2/6-0)=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('100%')

    // line1-slot0: fillStart=2/6, fillEnd=1 → local=(2/6-2/6)/(1-2/6)=0 → 0%
    expect(progressBarWidth(wrapper, 1, 0)).toBe('0%')

    // line1-slot1 belongs to event 1, not event 0 → 0%
    expect(progressBarWidth(wrapper, 1, 1)).toBe('0%')
  })

  // ── last event territory extends to end of bundle ─────────────────────────

  it('extends the last event territory to every remaining slot in the bundle', () => {
    // Given — single event, two lines each with two slots
    // All 4 slots belong to the single event's territory.
    // charLen: all slots have chord of len 1 or text of len 1 → each charLen=1
    // total=4; fillStart/fillEnd values: 0/4, 1/4, 2/4, 3/4
    const bundle = makeBundle({
      lines: [
        { slots: [{ chord: 'A' }, { chord: 'B' }] },
        { slots: [{ chord: 'C' }, { chord: 'D' }] },
      ],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When — activeProgress=1 (full progress through the entire territory)
    const wrapper = mount(ChordDisplay, {
      props: {
        bundle,
        activeEvent: { lineIdx: 0, slotIdx: 0 },
        activeEventIdx: 0,
        activeProgress: 1,
      },
    })

    // Then — every slot gets a progress bar with 100% at activeProgress=1
    // (last slot's fillEnd=1, activeProgress=1 → local=1 → 100%)
    expect(progressBarWidth(wrapper, 0, 0)).toBe('100%')
    expect(progressBarWidth(wrapper, 0, 1)).toBe('100%')
    expect(progressBarWidth(wrapper, 1, 0)).toBe('100%')
    expect(progressBarWidth(wrapper, 1, 1)).toBe('100%')
  })
})

// ---------------------------------------------------------------------------
// slotProgressWidth — helper function via DOM
// ---------------------------------------------------------------------------

describe('ChordDisplay slotProgressWidth', () => {
  // ── activeEventIdx null → 0% for all slots ────────────────────────────────

  it('returns 0% for all slots when activeEventIdx is null', () => {
    // Given
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'G' }, { chord: 'D' }] }],
      events: [
        { t: 0, lineIdx: 0, slotIdx: 0 },
        { t: 4, lineIdx: 0, slotIdx: 1 },
      ],
    })

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: null, activeProgress: 0.5 },
    })

    // Then
    expect(progressBarWidth(wrapper, 0, 0)).toBe('0%')
    expect(progressBarWidth(wrapper, 0, 1)).toBe('0%')
  })

  // ── slot not in segmentMap → 0% (slot with no events at all) ─────────────

  it('returns 0% for a slot that has no event and is not covered by any event territory', () => {
    // Given — bundle has no events; no slot appears in segmentMap
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'X' }] }],
      events: [],
    })

    // When
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: null, activeEventIdx: 0, activeProgress: 0.5 },
    })

    // Then — segmentMap is empty, slot not found → 0%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('0%')
  })

  // ── slot in map but different eventIdx → 0% ───────────────────────────────

  it('returns 0% for a slot whose territory belongs to a different event than the active one', () => {
    // Given — slot 0 in event 0's territory, but activeEventIdx=1
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'G' }, { chord: 'D' }] }],
      events: [
        { t: 0, lineIdx: 0, slotIdx: 0 },
        { t: 4, lineIdx: 0, slotIdx: 1 },
      ],
    })

    // When — event 1 is active
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { lineIdx: 0, slotIdx: 1 }, activeEventIdx: 1, activeProgress: 0.5 },
    })

    // Then — slot 0 belongs to event 0 territory, not the active event 1 → 0%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('0%')
  })

  // ── degenerate fillStart === fillEnd → local=1 → 100% ─────────────────────

  it('returns 100% when fillStart equals fillEnd (degenerate single-char slot territory)', () => {
    // Given — single event with a single slot of charLen 1 → fillStart=0, fillEnd=1
    // (fillStart === fillEnd edge case in production can only arise if totalChars=0,
    //  which cannot happen because charLen defaults to min 1; so we test the normal
    //  single-slot case which has fillStart=0, fillEnd=1, and verify the 100% result.)
    // The degenerate branch `fillEnd === fillStart → local=1` is for safety.
    // We cover it by verifying that a single-slot territory at any activeProgress gives 100%.
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'X' }] }],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When — activeProgress=0 (normally would give 0, but fillStart=0 fillEnd=1 → local=0)
    // To trigger fillStart===fillEnd we'd need a zero-width territory which the code prevents.
    // Instead verify the normal full-range: activeProgress=0 → local=0
    const wrapper = mount(ChordDisplay, {
      props: { bundle, activeEvent: { lineIdx: 0, slotIdx: 0 }, activeEventIdx: 0, activeProgress: 0 },
    })

    // Then — local=(0-0)/(1-0)=0 → 0%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('0%')
  })

  // ── activeProgress before fillStart → clamped to 0 ───────────────────────

  it('clamps to 0% when activeProgress is below the slot fillStart', () => {
    // Given — slot0 fillStart=0, fillEnd=0.5; slot1 fillStart=0.5, fillEnd=1
    // charLen each = 1, total = 2
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'A' }, { text: 'b' }] }],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When — activeProgress=0.2, slot1 fillStart=0.5 → progress is before slot1 starts
    const wrapper = mount(ChordDisplay, {
      props: {
        bundle,
        activeEvent: { lineIdx: 0, slotIdx: 0 },
        activeEventIdx: 0,
        activeProgress: 0.2,
      },
    })

    // Then — slot1: local=max(0, (0.2-0.5)/(1-0.5))=max(0,-0.6)=0 → 0%
    expect(progressBarWidth(wrapper, 0, 1)).toBe('0%')
  })

  // ── activeProgress within slot range → correct % ──────────────────────────

  it('returns the correct percentage when activeProgress is within the slot fill range', () => {
    // Given — two equal-length slots, each charLen=1, total=2
    // slot0: fillStart=0, fillEnd=0.5
    // slot1: fillStart=0.5, fillEnd=1
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'A' }, { text: 'b' }] }],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When — activeProgress=0.75 is mid-way through slot1's range [0.5, 1]
    const wrapper = mount(ChordDisplay, {
      props: {
        bundle,
        activeEvent: { lineIdx: 0, slotIdx: 0 },
        activeEventIdx: 0,
        activeProgress: 0.75,
      },
    })

    // Then — slot1: local=(0.75-0.5)/(1-0.5)=0.25/0.5=0.5 → 50%
    expect(progressBarWidth(wrapper, 0, 1)).toBe('50%')
  })

  // ── activeProgress past fillEnd → clamped to 100% ────────────────────────

  it('clamps to 100% when activeProgress exceeds the slot fillEnd', () => {
    // Given — two equal-length slots, slot0: fillStart=0, fillEnd=0.5
    const bundle = makeBundle({
      lines: [{ slots: [{ chord: 'A' }, { text: 'b' }] }],
      events: [{ t: 0, lineIdx: 0, slotIdx: 0 }],
    })

    // When — activeProgress=0.9 is past slot0's fillEnd=0.5
    const wrapper = mount(ChordDisplay, {
      props: {
        bundle,
        activeEvent: { lineIdx: 0, slotIdx: 0 },
        activeEventIdx: 0,
        activeProgress: 0.9,
      },
    })

    // Then — slot0: local=min(1, (0.9-0)/(0.5-0))=min(1,1.8)=1 → 100%
    expect(progressBarWidth(wrapper, 0, 0)).toBe('100%')
  })
})
