/**
 * Sender pacing and frame-cache sizing.
 *
 * These guard two things that were got wrong on real hardware:
 *   - an fps floor that reported a rate the device could not reach, which combined with a
 *     `setInterval` display loop to back the event loop up permanently;
 *   - a cache too small to loop safely, which would deadlock a receiver at ~98%.
 */

import {
  OPTICAL_FRAME_CACHE_MAX_BYTES,
  OPTICAL_FRAME_CACHE_MULTIPLIER,
  OPTICAL_MAX_DISPLAY_FPS,
  planFrameCache,
  suggestedFpsForFrameCost,
} from '@/utils/optical/bench';
import { expectedFountainOverhead } from '@/utils/optical/progress';

describe('suggestedFpsForFrameCost', () => {
  it('never proposes a rate the device cannot sustain', () => {
    // The bug this replaces: a floor of 4 meant a 320 ms frame was told to run at 250 ms.
    for (const frameMs of [10, 40, 81, 123, 175, 228, 321, 900, 1000]) {
      const fps = suggestedFpsForFrameCost(frameMs);
      expect(fps).toBeGreaterThanOrEqual(1);
      expect(1000 / fps).toBeGreaterThanOrEqual(frameMs);
    }
  });

  it('bottoms out at 1 fps, which means "too slow, drop the density"', () => {
    // Below one frame a second the floor stops being achievable. That is deliberate: the number
    // is a target for a self-scheduling loop that degrades gracefully, and a preset this slow is
    // one the caller should be steering away from rather than quoting a rate for.
    expect(suggestedFpsForFrameCost(5000)).toBe(1);
    expect(suggestedFpsForFrameCost(60_000)).toBe(1);
  });

  it('matches the rates measured on a 2018 mid-range phone', () => {
    // Moto Z3 Play, Hermes, release build — the numbers the design is calibrated against.
    expect(suggestedFpsForFrameCost(81)).toBe(10); // tiny / v16
    expect(suggestedFpsForFrameCost(123)).toBe(7); // compact / v20
    expect(suggestedFpsForFrameCost(175)).toBe(4); // standard / v24
    expect(suggestedFpsForFrameCost(321)).toBe(2); // max / v33
  });

  it('caps at the rate a camera can actually decode', () => {
    // Running far ahead of the receiver just shows frames nobody reads.
    expect(suggestedFpsForFrameCost(0)).toBe(OPTICAL_MAX_DISPLAY_FPS);
    expect(suggestedFpsForFrameCost(1)).toBe(OPTICAL_MAX_DISPLAY_FPS);
    expect(suggestedFpsForFrameCost(0.01)).toBe(OPTICAL_MAX_DISPLAY_FPS);
  });

  it('is monotonic in frame cost', () => {
    let previous = Infinity;
    for (const frameMs of [1, 10, 50, 100, 200, 400, 800]) {
      const fps = suggestedFpsForFrameCost(frameMs);
      expect(fps).toBeLessThanOrEqual(previous);
      previous = fps;
    }
  });
});

describe('planFrameCache', () => {
  it('caches enough distinct frames to loop without deadlocking a receiver', () => {
    // A receiver that has seen every frame the cache holds and still cannot peel is stuck at
    // ~98% forever. The ETA model clamps overhead at 1.6, but decimen's measured p90 reaches
    // ~2.2 at small k, so the cache has to clear the ETA model's own worst case by a real margin.
    for (const k of [1, 5, 25, 65, 200]) {
      const plan = planFrameCache(k, 121);
      expect(plan.loopSafe).toBe(true);
      expect(plan.frames).toBeGreaterThan(k * expectedFountainOverhead(k));
      expect(plan.frames).toBeGreaterThanOrEqual(Math.ceil(k * 2));
    }
  });

  it('uses the configured multiplier when memory is not the limit', () => {
    expect(planFrameCache(65, 121).frames).toBe(Math.ceil(65 * OPTICAL_FRAME_CACHE_MULTIPLIER));
  });

  it('refuses to cache at all rather than cache too little', () => {
    // The important case. A half-sized cache is WORSE than none: looping it deadlocks the
    // receiver, whereas generating live is merely slower and always correct.
    const plan = planFrameCache(100_000, 149);
    expect(plan).toEqual({ frames: 0, loopSafe: false });
  });

  it('stays inside its memory budget whenever it does cache', () => {
    for (const [k, moduleCount] of [
      [65, 121],
      [200, 89],
      [500, 105],
      [5000, 177],
    ] as const) {
      const plan = planFrameCache(k, moduleCount);
      if (plan.frames > 0) {
        expect(plan.frames * moduleCount * moduleCount).toBeLessThanOrEqual(
          OPTICAL_FRAME_CACHE_MAX_BYTES
        );
      }
    }
  });

  it('handles a degenerate module count without dividing by zero', () => {
    expect(planFrameCache(1, 0).frames).toBeGreaterThanOrEqual(0);
    expect(planFrameCache(1, 10_000)).toEqual({ frames: 0, loopSafe: false });
  });
});
