import {
  clampScale,
  clampTranslation,
  DOUBLE_TAP_SCALE,
  doubleTapTargetScale,
  fitContain,
  isAtRest,
  MAX_SCALE,
  maxTranslation,
  shouldDismissOnSwipe,
  zoomAroundPoint,
} from '../zoomableImageMath';

const viewport = { width: 400, height: 800 };
const content = { width: 400, height: 300 }; // a landscape photo fitted to the width

describe('clampScale', () => {
  it('stays within 1x to 5x and survives garbage', () => {
    expect(clampScale(0.3)).toBe(1);
    expect(clampScale(2.2)).toBe(2.2);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('maxTranslation', () => {
  it('allows no panning while the image is smaller than the viewport on that axis', () => {
    // 400x300 at 1x in a 400x800 viewport: nothing to pan either way.
    expect(maxTranslation(1, viewport, content)).toEqual({ x: 0, y: 0 });
    // 2x: 800 wide in a 400 viewport = 200 of slack each side; 600 tall in 800 = still none.
    expect(maxTranslation(2, viewport, content)).toEqual({ x: 200, y: 0 });
  });

  it('lets the scaled edge meet the viewport edge and no further', () => {
    // 4x: 1600 wide -> 600 each side; 1200 tall in 800 -> 200 each side.
    expect(maxTranslation(4, viewport, content)).toEqual({ x: 600, y: 200 });
  });
});

describe('clampTranslation', () => {
  it('pulls a drag back inside the bounds on every side', () => {
    expect(clampTranslation({ x: 900, y: -900 }, 4, viewport, content)).toEqual({
      x: 600,
      y: -200,
    });
    expect(clampTranslation({ x: -50, y: 10 }, 4, viewport, content)).toEqual({ x: -50, y: 10 });
  });

  it('locks panning at rest', () => {
    expect(clampTranslation({ x: 40, y: 40 }, 1, viewport, content)).toEqual({ x: 0, y: 0 });
  });
});

describe('zoomAroundPoint', () => {
  const rest = { scale: 1, translation: { x: 0, y: 0 } };

  it('keeps the point under the finger fixed on screen', () => {
    const focal = { x: 100, y: -50 };
    const next = zoomAroundPoint(rest, 3, focal, viewport, { width: 400, height: 800 });

    // Image point under the focal before: (focal - t) / s = focal. After: (focal - t') / s'.
    const imagePointAfter = {
      x: (focal.x - next.translation.x) / next.scale,
      y: (focal.y - next.translation.y) / next.scale,
    };
    expect(imagePointAfter.x).toBeCloseTo(focal.x, 6);
    expect(imagePointAfter.y).toBeCloseTo(focal.y, 6);
  });

  it('zooming at the center never moves the image', () => {
    const next = zoomAroundPoint(rest, 2, { x: 0, y: 0 }, viewport, content);
    expect(next.translation).toEqual({ x: 0, y: 0 });
  });

  it('clamps the translation it computes, so a corner tap cannot show empty space', () => {
    const next = zoomAroundPoint(rest, 2, { x: 200, y: 0 }, viewport, content);
    // Unclamped it would be x = -200; the bound at 2x is 200, so -200 is exactly the edge.
    expect(next.translation.x).toBe(-200);
    const far = zoomAroundPoint(rest, 2, { x: 5000, y: 0 }, viewport, content);
    expect(far.translation.x).toBe(-200);
  });

  it('clamps the requested scale', () => {
    expect(zoomAroundPoint(rest, 50, { x: 0, y: 0 }, viewport, content).scale).toBe(MAX_SCALE);
    expect(
      zoomAroundPoint(
        { scale: 3, translation: { x: 0, y: 0 } },
        0.2,
        { x: 0, y: 0 },
        viewport,
        content
      ).scale
    ).toBe(1);
  });

  it('keeps an existing pan when zooming further in around the same point', () => {
    const start = { scale: 2, translation: { x: -100, y: 0 } };
    const next = zoomAroundPoint(start, 4, { x: 50, y: 0 }, viewport, content);
    const before = (50 - start.translation.x) / start.scale;
    const after = (50 - next.translation.x) / next.scale;
    expect(after).toBeCloseTo(before, 6);
  });
});

describe('doubleTapTargetScale', () => {
  it('zooms in from rest and back out from zoomed', () => {
    expect(doubleTapTargetScale(1)).toBe(DOUBLE_TAP_SCALE);
    expect(doubleTapTargetScale(1.01)).toBe(DOUBLE_TAP_SCALE); // pinch that ended a hair above 1
    expect(doubleTapTargetScale(2.5)).toBe(1);
    expect(doubleTapTargetScale(5)).toBe(1);
  });
});

describe('isAtRest / shouldDismissOnSwipe', () => {
  it('only closes on a long downward swipe while fitted', () => {
    expect(shouldDismissOnSwipe(200, 1)).toBe(true);
    expect(shouldDismissOnSwipe(50, 1)).toBe(false);
    expect(shouldDismissOnSwipe(-200, 1)).toBe(false);
    // While zoomed, dragging down is panning, not closing.
    expect(shouldDismissOnSwipe(400, 2)).toBe(false);
    expect(isAtRest(1.019)).toBe(true);
    expect(isAtRest(1.05)).toBe(false);
  });
});

describe('fitContain', () => {
  it('fits by the limiting side and keeps the aspect ratio', () => {
    expect(fitContain({ width: 4000, height: 3000 }, { width: 400, height: 800 })).toEqual({
      width: 400,
      height: 300,
    });
    expect(fitContain({ width: 1000, height: 4000 }, { width: 400, height: 800 })).toEqual({
      width: 200,
      height: 800,
    });
  });

  it('falls back to the viewport for an image of unknown size', () => {
    expect(fitContain({ width: 0, height: 0 }, viewport)).toEqual(viewport);
  });
});
