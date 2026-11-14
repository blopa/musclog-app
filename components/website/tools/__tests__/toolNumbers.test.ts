import { isInRange, isWholeInRange, parseToolNumber } from '../toolNumbers';

describe('parseToolNumber', () => {
  it.each([
    ['100', 100],
    ['62.5', 62.5],
    ['62,5', 62.5],
    [' 62 , 5 ', 62.5],
    ['.5', 0.5],
    ['0', 0],
  ])('reads %j as %p', (text, expected) => {
    expect(parseToolNumber(text)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '-5', '1.2.3', '1e3', '1,000.5', null, undefined])(
    'refuses %j',
    (text) => {
      expect(parseToolNumber(text as string | null | undefined)).toBeNull();
    }
  );
});

describe('range guards', () => {
  it('accepts a whole number only inside the range', () => {
    expect(isWholeInRange(5, 1, 10)).toBe(true);
    expect(isWholeInRange(5.5, 1, 10)).toBe(false);
    expect(isWholeInRange(11, 1, 10)).toBe(false);
    expect(isWholeInRange(null, 1, 10)).toBe(false);
  });

  it('accepts any finite number inside the range', () => {
    expect(isInRange(5.5, 1, 10)).toBe(true);
    expect(isInRange(0.5, 1, 10)).toBe(false);
    expect(isInRange(null, 1, 10)).toBe(false);
  });
});
