import { roundToDecimalPlaces } from './roundDecimal';

/**
 * Decimal separator for numeric input/display for the given locale (comma vs dot).
 * Uses Intl so it stays aligned with `toLocaleString` / user expectations.
 */
export function getDecimalSeparator(locale: string): ',' | '.' {
  try {
    const parts = new Intl.NumberFormat(locale, { useGrouping: false }).formatToParts(1.1);
    const dec = parts.find((p) => p.type === 'decimal');
    return dec?.value === ',' ? ',' : '.';
  } catch {
    return '.';
  }
}

/**
 * Keeps digits and a single locale decimal separator, with at most `maxFractionDigits`
 * fractional digits. Normalizes a leading separator to `0,` / `0.` as needed.
 */
export function sanitizeLocalizedDecimalInput(
  raw: string,
  decimalSeparator: ',' | '.',
  maxFractionDigits = 2
): string {
  const sep = decimalSeparator === ',' ? ',' : '.';
  const sepRe = sep === ',' ? ',' : '\\.';
  const allowed = new RegExp(`[^0-9${sepRe}]`, 'g');
  const s = raw.replace(allowed, '');

  const first = s.indexOf(decimalSeparator);
  if (first === -1) {
    return s;
  }

  const intPart = s.slice(0, first).replace(new RegExp(sepRe, 'g'), '');
  const rest = s.slice(first + 1).replace(new RegExp(sepRe, 'g'), '');
  const fracPart = rest.slice(0, maxFractionDigits);

  if (fracPart.length === 0 && s.endsWith(decimalSeparator)) {
    const out = intPart + decimalSeparator;
    return out.startsWith(decimalSeparator) ? `0${out}` : out;
  }

  let out = fracPart.length > 0 ? intPart + decimalSeparator + fracPart : intPart;
  if (out.startsWith(decimalSeparator)) {
    out = `0${out}`;
  }

  return out;
}

/**
 * Parses a string entered with the locale decimal separator into a number (JS float).
 * Strips the other symbol when it is used as a thousands separator in pasted values.
 * Supports an optional leading minus (e.g. stepper / signed input).
 */
export function parseLocalizedDecimalString(
  value: string,
  decimalSeparator: ',' | '.',
  maxFractionDigits = 2
): number {
  const s = value.trim();
  if (!s || s === '-') {
    return 0;
  }

  const negative = s.startsWith('-');
  const unsigned = negative ? s.slice(1).trim() : s;
  if (!unsigned) {
    return 0;
  }

  let normalized: string;
  if (decimalSeparator === ',') {
    normalized = unsigned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = unsigned.replace(/,/g, '');
  }

  let n = parseFloat(normalized);
  if (Number.isNaN(n)) {
    return 0;
  }

  if (negative) {
    n = -Math.abs(n);
  }

  return roundToDecimalPlaces(n, maxFractionDigits);
}

/**
 * Optional leading minus, then same rules as {@link sanitizeLocalizedDecimalInput}.
 * Used by steppers when `maxFractionDigits` &gt; 0.
 */
export function sanitizeLocalizedSignedDecimalInput(
  raw: string,
  decimalSeparator: ',' | '.',
  maxFractionDigits = 1
): string {
  if (raw === '') {
    return '';
  }

  const trimmed = raw.trim();
  const neg = trimmed.startsWith('-');
  const body = neg ? trimmed.slice(1) : trimmed;
  const sanitized = sanitizeLocalizedDecimalInput(body, decimalSeparator, maxFractionDigits);
  if (!neg) {
    return sanitized;
  }

  if (sanitized === '') {
    return '-';
  }

  return `-${sanitized}`;
}

/** Digits only — for integer steppers (sets, reps, rest seconds). */
export function sanitizeLocalizedIntegerInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

/**
 * A non-negative number written exactly as the locale writes it ("62,5" with a comma separator,
 * "62.5" with a dot), or `null` for anything else — including an empty string.
 *
 * {@link parseLocalizedDecimalString} is lenient on purpose: it reads "" and "abc" as 0 and treats
 * the other separator as grouping, so "62.5" becomes 625 for a comma locale. That is right for a
 * field being typed and wrong for deciding whether a value may be SAVED. Validation uses this.
 */
export function parseStrictLocalizedNumber(
  text: string | undefined,
  decimalSeparator: ',' | '.'
): number | null {
  const trimmed = (text ?? '').trim();
  const pattern = decimalSeparator === ',' ? /^\d+(,\d+)?$/ : /^\d+(\.\d+)?$/;
  return pattern.test(trimmed) ? Number(trimmed.replace(',', '.')) : null;
}
