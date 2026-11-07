import {
  formatAppDecimal,
  formatAppGroupedInteger,
  formatAppInteger,
  formatAppRoundedDecimal,
} from '@/utils/formatAppNumber';

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

describe('formatAppGroupedInteger', () => {
  it("groups thousands by locale, for a screen's one large figure", () => {
    expect(formatAppGroupedInteger('en-US', 74333)).toBe('74,333');
    expect(formatAppGroupedInteger('de-DE', 74333)).toBe('74.333');
  });

  it('rounds to a whole number', () => {
    expect(formatAppGroupedInteger('en-US', 1234.6)).toBe('1,235');
  });
});
