import { BODY_FIGURE_WIDTH, bodyFigureScale } from '@/utils/bodyFigureScale';

describe('bodyFigureScale', () => {
  it('keeps the requested scale until the width is known', () => {
    expect(bodyFigureScale(null, 1, 32)).toBe(1);
    expect(bodyFigureScale(0, 0.95, 24)).toBe(0.95);
  });

  it('keeps the requested scale when the pair already fits', () => {
    expect(bodyFigureScale(2 * BODY_FIGURE_WIDTH + 32, 1, 32)).toBe(1);
    expect(bodyFigureScale(900, 0.95, 24)).toBe(0.95);
  });

  it('shrinks the figures so both fit a phone, never drawing them wider than the room', () => {
    const scale = bodyFigureScale(296, 1, 32);
    expect(scale).toBe(0.66);
    expect(2 * BODY_FIGURE_WIDTH * scale + 32).toBeLessThanOrEqual(296);
  });

  it('stops at a minimum so a very narrow card still shows readable muscles', () => {
    expect(bodyFigureScale(100, 1, 32)).toBe(0.4);
  });
});
