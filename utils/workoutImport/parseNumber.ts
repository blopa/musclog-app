/**
 * Cell readers for numbers, durations and unit words. Pure: no React Native, no database.
 */

// Product limits: values above these are a broken cell, not a heavy lift.
/** Heaviest load a single set may carry (kg). */
export const MAX_IMPORT_WEIGHT_KG = 1000;
/** Most reps a single set may record. */
export const MAX_IMPORT_REPS = 1000;
/** Longest single distance a set may record (m). */
export const MAX_IMPORT_DISTANCE_M = 1_000_000;
/** Longest duration a set or whole workout may record (s). */
export const MAX_IMPORT_SET_SECONDS = 86_400;

export const LB_TO_KG = 0.45359237;

const MAX_CELL_LENGTH = 64;

const PLAIN_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const GROUPED_COMMA_DOT = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;
const GROUPED_DOT_COMMA = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d*)?$/;
const GROUPED_COMMAS = /^[+-]?\d{1,3}(?:,\d{3})+$/;
const GROUPED_DOTS = /^[+-]?\d{1,3}(?:\.\d{3})+$/;

/**
 * A decimal comma (`102,5`) or decimal point (`102.5`). Thousands separators
 * are read only when they are unambiguous: both separators present, or
 * repeated (`1,234,567`, `1.234.567`). A lone `1,234` is a decimal comma.
 */
export function parseImportNumber(cell: string | null | undefined): number | null {
  if (typeof cell !== 'string') {
    return null;
  }

  const text = cell.trim();
  if (text === '' || text.length > MAX_CELL_LENGTH) {
    return null;
  }

  const commas = countChar(text, ',');
  const dots = countChar(text, '.');
  let normalized: string;

  if (commas > 0 && dots > 0) {
    if (text.lastIndexOf('.') > text.lastIndexOf(',')) {
      if (!GROUPED_COMMA_DOT.test(text)) {
        return null;
      }

      normalized = text.split(',').join('');
    } else {
      if (!GROUPED_DOT_COMMA.test(text)) {
        return null;
      }

      normalized = text.split('.').join('').replace(',', '.');
    }
  } else if (commas > 1) {
    if (!GROUPED_COMMAS.test(text)) {
      return null;
    }

    normalized = text.split(',').join('');
  } else if (dots > 1) {
    if (!GROUPED_DOTS.test(text)) {
      return null;
    }

    normalized = text.split('.').join('');
  } else {
    normalized = text.replace(',', '.');
  }

  if (!PLAIN_NUMBER.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * A time cell in seconds: `HH:MM:SS`, `MM:SS`, `1h 5m`, `52m`, `45s`, or bare
 * seconds. Returns the raw value; the caller applies the sanity limits.
 */
export function parseImportSeconds(cell: string | null | undefined): number | null {
  if (typeof cell !== 'string') {
    return null;
  }

  const text = cell.trim();
  if (text === '' || text.length > MAX_CELL_LENGTH) {
    return null;
  }

  const clock = CLOCK_TIME.exec(text);
  if (clock) {
    const first = Number(clock[1]);
    const second = Number(clock[2]);
    if (clock[3] === undefined) {
      return second > 59 ? null : first * 60 + second;
    }

    const third = Number(clock[3]);
    return second > 59 || third > 59 ? null : first * 3600 + second * 60 + third;
  }

  const compound = COMPOUND_TIME.exec(text);
  if (compound && (compound[1] || compound[2] || compound[3])) {
    return (
      Number(compound[1] ?? 0) * 3600 + Number(compound[2] ?? 0) * 60 + Number(compound[3] ?? 0)
    );
  }

  return parseImportNumber(text);
}

const CLOCK_TIME = /^(\d{1,4}):(\d{1,2})(?::(\d{1,2}))?$/;
const COMPOUND_TIME = /^(?:(\d{1,6})\s*h)?\s*(?:(\d{1,6})\s*m)?\s*(?:(\d{1,6})\s*s)?$/i;

/** Lowercase words with every non-alphanumeric run as one space. */
export function foldUnitText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const WEIGHT_UNITS = new Map<string, 'kg' | 'lbs'>([
  ['kg', 'kg'],
  ['kgs', 'kg'],
  ['kilo', 'kg'],
  ['kilos', 'kg'],
  ['kilogram', 'kg'],
  ['kilograms', 'kg'],
  ['lb', 'lbs'],
  ['lbs', 'lbs'],
  ['pound', 'lbs'],
  ['pounds', 'lbs'],
]);

/** The unit a weight cell names (kg or lbs), or null when it names neither. */
export function weightUnitFromText(text: string): 'kg' | 'lbs' | null {
  return WEIGHT_UNITS.get(foldUnitText(text)) ?? null;
}

const DISTANCE_FACTORS = new Map<string, number>([
  ['m', 1],
  ['meter', 1],
  ['meters', 1],
  ['metre', 1],
  ['metres', 1],
  ['km', 1000],
  ['kms', 1000],
  ['kilometer', 1000],
  ['kilometers', 1000],
  ['kilometre', 1000],
  ['kilometres', 1000],
  ['mi', 1609.344],
  ['mile', 1609.344],
  ['miles', 1609.344],
  ['ft', 0.3048],
  ['foot', 0.3048],
  ['feet', 0.3048],
  ['yd', 0.9144],
  ['yard', 0.9144],
  ['yards', 0.9144],
]);

/** Metres per unit, or null when the text names no distance unit. */
export function distanceUnitFactor(text: string): number | null {
  return DISTANCE_FACTORS.get(foldUnitText(text)) ?? null;
}

/** RPE: blank, zero or junk is not rated; above 10 is capped to 10. */
export function parseRpe(cell: string | null | undefined): number | null {
  const value = parseImportNumber(cell);
  if (value === null || value < 1) {
    return null;
  }

  return Math.min(value, 10);
}

function countChar(text: string, char: string): number {
  let count = 0;
  for (let k = 0; k < text.length; k++) {
    if (text[k] === char) {
      count++;
    }
  }

  return count;
}
