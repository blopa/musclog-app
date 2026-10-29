import { hidesContentToTheLeft, hidesContentToTheRight } from '../scrollOverflow';

describe('hidesContentToTheRight', () => {
  it('is true while chips extend past the right edge', () =>
    expect(hidesContentToTheRight(358, 409, 0)).toBe(true));

  it('is false once scrolled to the end, allowing for rounding', () => {
    expect(hidesContentToTheRight(358, 409, 51)).toBe(false);
    expect(hidesContentToTheRight(358, 409, 50)).toBe(false);
  });

  it('is false when everything fits, or before the first layout', () => {
    expect(hidesContentToTheRight(400, 380, 0)).toBe(false);
    expect(hidesContentToTheRight(0, 380, 0)).toBe(false);
  });
});

describe('hidesContentToTheLeft', () => {
  it('is true once the row has scrolled away from its start', () => {
    expect(hidesContentToTheLeft(51)).toBe(true);
    expect(hidesContentToTheLeft(3)).toBe(true);
  });

  it('is false at the start, allowing for rounding', () => {
    expect(hidesContentToTheLeft(0)).toBe(false);
    expect(hidesContentToTheLeft(2)).toBe(false);
  });
});
