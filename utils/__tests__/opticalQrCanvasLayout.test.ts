/**
 * The sizing rule both QR canvases share.
 *
 * The invariant under test is not "the code is about the right size" — it is that every module
 * gets the SAME number of device pixels. A fractional scale is invisible on screen and shows up
 * only as a receiver that mysteriously will not decode, so it is pinned here.
 */

import { qrCanvasLayout } from '@/utils/optical/qrCanvasLayout';

describe('qrCanvasLayout', () => {
  it('gives every module a whole number of device pixels', () => {
    // Deliberately awkward: a 3x density and a budget that divides into nothing round.
    const { scale, sizeDp } = qrCanvasLayout(89, 393, 3);

    expect(Number.isInteger(scale)).toBe(true);
    expect(sizeDp * 3).toBeCloseTo(89 * scale);
  });

  it('never exceeds the budget it was given', () => {
    for (const rasterSize of [77, 89, 105, 121, 133, 157]) {
      for (const density of [1, 2, 2.75, 3]) {
        const { sizeDp } = qrCanvasLayout(rasterSize, 380, density);

        expect(sizeDp).toBeLessThanOrEqual(380);
      }
    }
  });

  it('falls back to one device pixel per module when the budget is too small', () => {
    // A 157-module `max` frame in a 100 dp slot cannot fit at any integer scale; drawing it
    // smaller than 1 px per module is not renderable, so it overflows rather than blurring.
    const { scale } = qrCanvasLayout(157, 100, 1);

    expect(scale).toBe(1);
  });

  it('treats a missing raster as zero-sized rather than dividing by it', () => {
    expect(qrCanvasLayout(0, 380, 3)).toEqual({ scale: 1, sizeDp: 0 });
  });
});
