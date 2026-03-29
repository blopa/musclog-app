import { formatAppDecimal, formatAppInteger, formatAppRoundedDecimal } from '../formatAppNumber';

describe('formatAppNumber', () => {
  it('formats integers without thousands separators', () => {
    expect(formatAppInteger('en-US', 1234)).toBe('1234');
    expect(formatAppInteger('de-DE', 1234)).toBe('1234');
  });

  it('formats decimals with locale decimal separator', () => {
    expect(formatAppDecimal('en-US', 12.34, 2)).toBe('12.34');
    expect(formatAppDecimal('de-DE', 12.34, 2)).toContain(',');
  });

  it('rounds then formats with formatAppRoundedDecimal', () => {
    expect(formatAppRoundedDecimal('en-US', 12.345, 2)).toBe('12.35');
  });
});
