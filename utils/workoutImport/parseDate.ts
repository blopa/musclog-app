/**
 * Import date cells. Wall-clock text stays exactly as written (never through
 * UTC). A zoned timestamp is an instant, converted to the device's local day.
 * `now` is injected so the future-date check is deterministic in tests.
 */

const MAX_DATE_CELL_LENGTH = 80;
const EARLIEST_IMPORT_YEAR = 1900;
const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
/** The widest real-world UTC offset. */
const MAX_ZONE_OFFSET_HOURS = 14;

export type ParsedDateText =
  | { zoned: false; ms: number; day: string; startMinutes: number | null }
  | { zoned: true; ms: number };

export type ImportDateResult =
  | { kind: 'ok'; day: string; startMinutes: number | null }
  | { kind: 'badDate' }
  | { kind: 'futureDate' };

/**
 * A time at the end of the cell, after a separator (space, `T` or comma).
 * Groups: hour, minute, second, am/pm, zone. Anchored, with bounded quantifiers.
 */
const TIME_TAIL =
  /(?:^|[\sT,])(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d{1,9})?)?(?:\s*([ap])\.?\s*m\.?)?(?:\s*(z|utc|[+-]\d{2}:?\d{2}))?$/i;
const ISO_DATE = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/;
const NUMERIC_DATE = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})$/;
const ZONE_OFFSET = /^([+-])(\d{2}):?(\d{2})$/;

interface YearMonthDay {
  year: number;
  month: number;
  day: number;
}

interface TimeOfDay {
  hour: number;
  minute: number;
  second: number;
  zone: string | null;
}

/** Month names and abbreviations (accents and dots folded away) for the bundled languages. */
const MONTH_WORDS: readonly (readonly [number, readonly string[]])[] = [
  [
    1,
    [
      'jan',
      'janv',
      'january',
      'janvier',
      'janeiro',
      'januar',
      'januari',
      'gennaio',
      'enero',
      'ene',
      'gen',
    ],
  ],
  [
    2,
    [
      'feb',
      'febr',
      'fev',
      'fevr',
      'february',
      'fevrier',
      'febrero',
      'fevereiro',
      'februar',
      'februari',
      'febbraio',
    ],
  ],
  [3, ['mar', 'marzo', 'march', 'mars', 'marco', 'marz', 'maerz', 'maart', 'mrt']],
  [4, ['apr', 'april', 'avr', 'avril', 'abr', 'abril', 'aprile']],
  [5, ['may', 'mai', 'mayo', 'maio', 'mei', 'maggio', 'mag']],
  [6, ['jun', 'june', 'juin', 'junio', 'junho', 'juni', 'giu', 'giugno']],
  [7, ['jul', 'july', 'juil', 'juillet', 'julio', 'julho', 'juli', 'luglio', 'lug']],
  [8, ['aug', 'august', 'aout', 'agosto', 'ago', 'augustus', 'augusto']],
  [9, ['sep', 'sept', 'september', 'septembre', 'septiembre', 'setembro', 'set', 'settembre']],
  [
    10,
    ['oct', 'october', 'octobre', 'octubre', 'outubro', 'oktober', 'okt', 'ott', 'ottobre', 'out'],
  ],
  [11, ['nov', 'november', 'novembre', 'noviembre', 'novembro']],
  [
    12,
    ['dec', 'december', 'decembre', 'dez', 'dezember', 'dezembro', 'dic', 'diciembre', 'dicembre'],
  ],
];

const MONTH_BY_WORD = new Map<string, number>();
for (const [month, words] of MONTH_WORDS) {
  for (const word of words) {
    MONTH_BY_WORD.set(word, month);
  }
}

const ACCENT_FOLDS: readonly (readonly [RegExp, string])[] = [
  [/[àáâãäå]/g, 'a'],
  [/[èéêë]/g, 'e'],
  [/[ìíîï]/g, 'i'],
  [/[òóôõö]/g, 'o'],
  [/[ùúûü]/g, 'u'],
  [/ç/g, 'c'],
  [/ñ/g, 'n'],
  [/ß/g, 'ss'],
];

/** Parses a date cell's text without a reference time. Null when it is not a date. */
export function parseDateText(cell: string): ParsedDateText | null {
  if (typeof cell !== 'string') {
    return null;
  }

  const text = cell.trim();
  if (text === '' || text.length > MAX_DATE_CELL_LENGTH) {
    return null;
  }

  const tail = TIME_TAIL.exec(text);
  const datePart = (tail ? text.slice(0, tail.index) : text).replace(/[\s,]+$/, '');
  const ymd = parseDatePart(datePart);
  if (!ymd) {
    return null;
  }

  if (!tail) {
    return wallClock(ymd, null);
  }

  const time = readTime(tail);
  if (!time) {
    return null;
  }

  if (time.zone === null) {
    return wallClock(ymd, time);
  }

  const offset = zoneOffsetMinutes(time.zone);
  if (offset === null) {
    return null;
  }

  const wallMs = Date.UTC(ymd.year, ymd.month - 1, ymd.day, time.hour, time.minute, time.second);
  return { zoned: true, ms: wallMs - offset * MS_PER_MINUTE };
}

/**
 * The local day and minute of an import cell, or why it was rejected. A
 * wall-clock time keeps its written day and minute; a zoned one is converted
 * to this device's local clock. Anything more than a day in the future is
 * rejected.
 */
export function parseImportDate(cell: string, now: Date): ImportDateResult {
  const parsed = parseDateText(cell);
  if (!parsed) {
    return { kind: 'badDate' };
  }

  if (parsed.zoned) {
    if (parsed.ms > now.getTime() + MS_PER_DAY) {
      return { kind: 'futureDate' };
    }

    const local = new Date(parsed.ms);
    return {
      kind: 'ok',
      day: formatDay(local.getFullYear(), local.getMonth() + 1, local.getDate()),
      startMinutes: local.getHours() * 60 + local.getMinutes(),
    };
  }

  const nowWallMs = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes()
  );
  if (parsed.ms > nowWallMs + MS_PER_DAY) {
    return { kind: 'futureDate' };
  }

  return { kind: 'ok', day: parsed.day, startMinutes: parsed.startMinutes };
}

function wallClock(ymd: YearMonthDay, time: TimeOfDay | null): ParsedDateText {
  const hour = time?.hour ?? 0;
  const minute = time?.minute ?? 0;
  const second = time?.second ?? 0;
  return {
    zoned: false,
    ms: Date.UTC(ymd.year, ymd.month - 1, ymd.day, hour, minute, second),
    day: formatDay(ymd.year, ymd.month, ymd.day),
    startMinutes: time ? hour * 60 + minute : null,
  };
}

function readTime(match: RegExpExecArray): TimeOfDay | null {
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  const meridiem = match[4]?.toLowerCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }

    hour = (hour % 12) + (meridiem === 'p' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }

  if (minute > 59 || second > 59) {
    return null;
  }

  return { hour, minute, second, zone: match[5] ?? null };
}

function zoneOffsetMinutes(zone: string): number | null {
  const lower = zone.toLowerCase();
  if (lower === 'z' || lower === 'utc') {
    return 0;
  }

  const match = ZONE_OFFSET.exec(lower);
  if (!match) {
    return null;
  }

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > MAX_ZONE_OFFSET_HOURS || minutes > 59) {
    return null;
  }

  const magnitude = hours * 60 + minutes;
  return match[1] === '-' ? -magnitude : magnitude;
}

function parseDatePart(part: string): YearMonthDay | null {
  const iso = ISO_DATE.exec(part);
  if (iso) {
    return checkedYmd(Number(iso[1]), Number(iso[3]), Number(iso[4]));
  }

  const numeric = NUMERIC_DATE.exec(part);
  if (numeric) {
    return dayFirstUnlessImpossible(Number(numeric[1]), Number(numeric[3]), Number(numeric[4]));
  }

  return parseWordDate(part);
}

/** Spreadsheet dates are day-first when ambiguous; a part above 12 settles the order. */
function dayFirstUnlessImpossible(
  first: number,
  second: number,
  year: number
): YearMonthDay | null {
  if (second > 12 && first <= 12) {
    return checkedYmd(year, first, second);
  }

  return checkedYmd(year, second, first);
}

function parseWordDate(part: string): YearMonthDay | null {
  const tokens = foldWord(part)
    .replace(/\./g, ' ')
    .split(/[\s,]+/)
    .filter((token) => token !== '' && token !== 'de' && token !== 'del');
  if (tokens.length !== 3) {
    return null;
  }

  let month: number | null = null;
  let year: number | null = null;
  let day: number | null = null;
  for (const token of tokens) {
    const named = MONTH_BY_WORD.get(token);
    if (named !== undefined) {
      if (month !== null) {
        return null;
      }

      month = named;
    } else if (/^\d{4}$/.test(token)) {
      year = Number(token);
    } else if (/^\d{1,2}$/.test(token)) {
      day = Number(token);
    } else {
      return null;
    }
  }

  if (month === null || year === null || day === null) {
    return null;
  }

  return checkedYmd(year, month, day);
}

function foldWord(text: string): string {
  let folded = text.toLowerCase();
  for (const [pattern, replacement] of ACCENT_FOLDS) {
    folded = folded.replace(pattern, replacement);
  }

  return folded;
}

function checkedYmd(year: number, month: number, day: number): YearMonthDay | null {
  if (year < EARLIEST_IMPORT_YEAR || month < 1 || month > 12 || day < 1) {
    return null;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function formatDay(year: number, month: number, day: number): string {
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
