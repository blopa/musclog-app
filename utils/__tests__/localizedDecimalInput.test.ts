import {
  getDecimalSeparator,
  parseLocalizedDecimalString,
  sanitizeLocalizedDecimalInput,
  sanitizeLocalizedIntegerInput,
  sanitizeLocalizedSignedDecimalInput,
} from '@/utils/localizedDecimalInput';

describe('getDecimalSeparator', () => {
  it('returns dot or comma per Intl locale', () => {
    expect(getDecimalSeparator('en-US')).toBe('.');
    expect(getDecimalSeparator('de-DE')).toBe(',');
    expect(getDecimalSeparator('fr-FR')).toBe(',');
    expect(getDecimalSeparator('pt-BR')).toBe(',');
  });
});

describe('sanitizeLocalizedDecimalInput', () => {
  it('respects dot as decimal separator', () => {
    expect(sanitizeLocalizedDecimalInput('12.345', '.', 2)).toBe('12.34');
    expect(sanitizeLocalizedDecimalInput('0.5', '.', 2)).toBe('0.5');
    expect(sanitizeLocalizedDecimalInput('.', '.', 2)).toBe('0.');
  });

  it('respects comma as decimal separator', () => {
    expect(sanitizeLocalizedDecimalInput('12,345', ',', 2)).toBe('12,34');
    expect(sanitizeLocalizedDecimalInput('0,5', ',', 2)).toBe('0,5');
    expect(sanitizeLocalizedDecimalInput(',', ',', 2)).toBe('0,');
  });
});

describe('parseLocalizedDecimalString', () => {
  it('parses dot-locale strings', () => {
    expect(parseLocalizedDecimalString('12.34', '.')).toBe(12.34);
    expect(parseLocalizedDecimalString('1,234.5', '.')).toBe(1234.5);
  });

  it('parses comma-locale strings', () => {
    expect(parseLocalizedDecimalString('12,34', ',')).toBe(12.34);
    expect(parseLocalizedDecimalString('1.234,5', ',')).toBe(1234.5);
  });

  it('parses signed values', () => {
    expect(parseLocalizedDecimalString('-12.5', '.', 1)).toBe(-12.5);
    expect(parseLocalizedDecimalString('-12,5', ',', 1)).toBe(-12.5);
  });
});

describe('sanitizeLocalizedSignedDecimalInput', () => {
  it('keeps a lone minus while editing', () => {
    expect(sanitizeLocalizedSignedDecimalInput('-', '.', 1)).toBe('-');
  });

  it('combines minus with locale decimal body', () => {
    expect(sanitizeLocalizedSignedDecimalInput('-0,5', ',', 1)).toBe('-0,5');
  });
});

describe('sanitizeLocalizedIntegerInput', () => {
  it('strips non-digits', () => {
    expect(sanitizeLocalizedIntegerInput('12ab3')).toBe('123');
  });
});
