// Which figures in an AI-written text the data it was given does not hold. Pure and
// relative-import-only. Used by the insight fact-check (High and Tokenmaxxing thinking levels) to
// tell the corrector what to look at and to judge whether its correction is better: a figure the
// data holds (or a rounding of one) is grounded; one it does not hold may still be a correct sum or
// average, so this is a list to check, not a verdict.

/** Dates, times and ISO stamps: figures that are not quantities. */
const NOT_QUANTITIES = [
  /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/g,
  /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}\b/g,
];

/**
 * A run of digits with grouping and decimal marks of any of the app's locales. Only no-break spaces
 * group (what `Intl` writes in French or Russian): a plain space would join "2 100 g portions".
 */
const FIGURE = /\d+(?:[.,\u00a0\u202f]\d{3})*(?:[.,]\d+)?/g;

/** Small whole numbers are counts ("3 workouts", "2 meals") far more often than data. */
const MAX_COUNTING_NUMBER = 10;

function isYear(value: number, written: string): boolean {
  return /^\d{4}$/.test(written) && value >= 1900 && value <= 2100;
}

/**
 * Every value a written figure can mean: "1,234" is 1234 in English and 1.234 in German, "72,5" is
 * 72.5, "1 234,5" is 1234.5. A figure is grounded when any of its readings matches any reading of a
 * data figure, so the ambiguity never makes a correct figure look invented.
 */
function readingsOf(written: string): number[] {
  const values = new Set<number>();
  const compact = written.replace(/[\u00a0\u202f]/g, '');
  const add = (text: string) => {
    const value = Number(text);
    if (Number.isFinite(value)) {
      values.add(value);
    }
  };

  // Comma as grouping, dot as decimal; then dot as grouping, comma as decimal.
  add(compact.replace(/,/g, ''));
  add(compact.replace(/\./g, '').replace(',', '.'));
  // A lone separator may be a decimal mark either way ("72,5", "72.5").
  if (/^\d+[.,]\d+$/.test(compact)) {
    add(compact.replace(',', '.'));
  }

  return [...values];
}

function figuresIn(text: string): { written: string; readings: number[] }[] {
  let cleaned = text;
  for (const pattern of NOT_QUANTITIES) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  return [...cleaned.matchAll(FIGURE)].map((match) => {
    const written = match[0].trim();
    return { written, readings: readingsOf(written) };
  });
}

/** `figure` equals `data` or a rounding of it (to a whole number or one decimal), within 1%. */
function matches(figure: number, data: number): boolean {
  const roundingSlack = Number.isInteger(figure) ? 0.5 : 0.05;
  return Math.abs(figure - data) <= Math.max(0.01 * Math.abs(data), roundingSlack);
}

/**
 * The figures in `text` that do not appear in `data`, as they were written, each listed once.
 * Counting numbers up to ten, years, dates and times are never listed.
 */
export function ungroundedFigures(text: string, data: string): string[] {
  const known = figuresIn(data).flatMap((figure) => figure.readings);
  const listed: string[] = [];

  for (const figure of figuresIn(text)) {
    const [first] = figure.readings;
    if (first === undefined) {
      continue;
    }

    const isCount = figure.readings.some(
      (value) => Number.isInteger(value) && value <= MAX_COUNTING_NUMBER
    );
    if (isCount || isYear(first, figure.written)) {
      continue;
    }

    const grounded = figure.readings.some((value) => known.some((data) => matches(value, data)));
    if (!grounded && !listed.includes(figure.written)) {
      listed.push(figure.written);
    }
  }

  return listed;
}
