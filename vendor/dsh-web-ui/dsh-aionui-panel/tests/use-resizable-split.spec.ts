/**
 * Ratio-mode split drag math: a pixel delta must be scaled by the container
 * width to move a percentage width, not added directly (which pins the pane
 * to the min/max clamp on a tiny drag).
 */
import { describe, expect, it } from 'vitest'
import { ratioWidthFromDelta } from '../src/client/hooks/useResizableSplit.ts'

describe('ratioWidthFromDelta', () => {
  it('scales a pixel delta into percentage points by the container width', () => {
    expect(ratioWidthFromDelta(50, 30, 800)).toBeCloseTo(53.75)
    expect(ratioWidthFromDelta(50, -30, 800)).toBeCloseTo(46.25)
  })

  it('moves more percentage points over a narrower container for the same pixel drag', () => {
    expect(ratioWidthFromDelta(50, 30, 400)).toBeCloseTo(57.5)
  })

  it('does not move when the container width is unknown', () => {
    expect(ratioWidthFromDelta(50, 30, 0)).toBe(50)
    expect(ratioWidthFromDelta(50, 30, -1)).toBe(50)
  })
})
