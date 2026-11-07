import {
  LB_TO_KG,
  MAX_IMPORT_REPS,
  MAX_IMPORT_SET_SECONDS,
  MAX_IMPORT_WEIGHT_KG,
  distanceUnitFactor,
  parseImportNumber,
  parseImportSeconds,
  parseRpe,
  weightUnitFromText,
} from '../parseNumber';

describe('parseImportNumber', () => {
  it('reads decimal points and decimal commas', () => {
    expect(parseImportNumber('102.5')).toBe(102.5);
    expect(parseImportNumber('102,5')).toBe(102.5);
    expect(parseImportNumber(' 8 ')).toBe(8);
  });

  it('reads thousands separators only when they are unambiguous', () => {
    expect(parseImportNumber('1,234.5')).toBe(1234.5);
    expect(parseImportNumber('1.234,5')).toBe(1234.5);
    expect(parseImportNumber('1,234,567')).toBe(1234567);
    expect(parseImportNumber('1.234.567')).toBe(1234567);
    // A lone comma is a decimal comma, so 1,234 is 1.234 rather than a guess.
    expect(parseImportNumber('1,234')).toBe(1.234);
  });

  it('rejects blanks, text, NaN and Infinity', () => {
    expect(parseImportNumber('')).toBeNull();
    expect(parseImportNumber('   ')).toBeNull();
    expect(parseImportNumber('abc')).toBeNull();
    expect(parseImportNumber('12kg')).toBeNull();
    expect(parseImportNumber('NaN')).toBeNull();
    expect(parseImportNumber('Infinity')).toBeNull();
    expect(parseImportNumber('1e400')).toBeNull();
    expect(parseImportNumber('1,2,3.4,5')).toBeNull();
    expect(parseImportNumber(undefined)).toBeNull();
  });

  it('returns negatives so the caller can flag them', () => {
    expect(parseImportNumber('-5')).toBe(-5);
  });

  it('refuses very long cells without backtracking', () => {
    expect(parseImportNumber('1'.repeat(100000))).toBeNull();
    expect(parseImportNumber('1,'.repeat(50000) + 'x')).toBeNull();
  });

  it('keeps the product limits as named constants', () => {
    expect(MAX_IMPORT_WEIGHT_KG).toBe(1000);
    expect(MAX_IMPORT_REPS).toBe(1000);
    expect(MAX_IMPORT_SET_SECONDS).toBe(86400);
    expect(LB_TO_KG).toBe(0.45359237);
  });
});

describe('parseImportSeconds', () => {
  it('reads clock forms and bare seconds', () => {
    expect(parseImportSeconds('1:05:30')).toBe(3930);
    expect(parseImportSeconds('05:30')).toBe(330);
    expect(parseImportSeconds('45')).toBe(45);
  });

  it('reads Strong-style compound durations', () => {
    expect(parseImportSeconds('1h 5m')).toBe(3900);
    expect(parseImportSeconds('52m')).toBe(3120);
    expect(parseImportSeconds('45s')).toBe(45);
    expect(parseImportSeconds('1h5m30s')).toBe(3930);
  });

  it('rejects impossible clock parts and text', () => {
    expect(parseImportSeconds('1:75')).toBeNull();
    expect(parseImportSeconds('1:05:99')).toBeNull();
    expect(parseImportSeconds('soon')).toBeNull();
    expect(parseImportSeconds('')).toBeNull();
  });
});

describe('unit words', () => {
  it('maps weight words', () => {
    expect(weightUnitFromText('kgs')).toBe('kg');
    expect(weightUnitFromText('Kg')).toBe('kg');
    expect(weightUnitFromText('lb')).toBe('lbs');
    expect(weightUnitFromText('LBS')).toBe('lbs');
    expect(weightUnitFromText('stone')).toBeNull();
    expect(weightUnitFromText('')).toBeNull();
  });

  it('maps distance words to metres per unit', () => {
    expect(distanceUnitFactor('km')).toBe(1000);
    expect(distanceUnitFactor('meters')).toBe(1);
    expect(distanceUnitFactor('mi')).toBe(1609.344);
    expect(distanceUnitFactor('Miles')).toBe(1609.344);
    expect(distanceUnitFactor('ft')).toBe(0.3048);
    expect(distanceUnitFactor('yd')).toBe(0.9144);
    expect(distanceUnitFactor('')).toBeNull();
    expect(distanceUnitFactor('unit')).toBeNull();
  });
});

describe('parseRpe', () => {
  it('treats blank, zero and junk as not rated', () => {
    expect(parseRpe('')).toBeNull();
    expect(parseRpe('0')).toBeNull();
    expect(parseRpe('junk')).toBeNull();
    expect(parseRpe('0.5')).toBeNull();
    expect(parseRpe('-3')).toBeNull();
  });

  it('caps above 10 and keeps the valid range', () => {
    expect(parseRpe('9.5')).toBe(9.5);
    expect(parseRpe('1')).toBe(1);
    expect(parseRpe('10')).toBe(10);
    expect(parseRpe('11')).toBe(10);
    expect(parseRpe('42')).toBe(10);
  });
});
