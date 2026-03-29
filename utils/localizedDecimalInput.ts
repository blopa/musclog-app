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
 */
export function parseLocalizedDecimalString(
  value: string,
  decimalSeparator: ',' | '.',
  maxFractionDigits = 2
): number {
  const s = value.trim();
  if (!s) {
    return 0;
  }

  let normalized: string;
  if (decimalSeparator === ',') {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/,/g, '');
  }

  const n = parseFloat(normalized);
  if (Number.isNaN(n)) {
    return 0;
  }
  return roundToDecimalPlaces(n, maxFractionDigits);
}
