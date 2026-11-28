/**
 * Reads the distance, the duration and the activity of a walk or run from what was said, in every
 * bundled language, so a voice command never takes a number from the model. A value is read only
 * when it is clearly one thing: two different distances, a time of day or a speed give nothing, and
 * the sheet then starts that field at zero. Pure: no React Native, no database.
 */
import type { Units } from '@/constants/settings';
import type { CardioActivity } from '@/utils/cardioEnergy';
import { displayDistanceToMeters } from '@/utils/unitConversion';
import {
  ARTICLE_WORDS,
  CONNECTOR_WORDS,
  foldSpoken,
  HALF_WORDS,
  numberWordValue,
  spokenWords,
  toAsciiDigits,
} from '@/utils/voiceCommand/spokenNumbers';
import {
  MAX_IMPORT_DISTANCE_M,
  MAX_IMPORT_SET_SECONDS,
  parseImportNumber,
  parseImportSeconds,
} from '@/utils/workoutImport/parseNumber';

export type SpokenCardio = {
  distanceM: number | null;
  durationS: number | null;
  /** A distance or a duration was said with its unit (a bare number does not count). */
  measured: boolean;
};

type Token = {
  /** Lowercase as said, accents kept: "à" (at) differs from "a" only by one. */
  raw: string;
  /** Folded, the form the word tables are written in. */
  word: string;
  start: number;
  end: number;
  kind: 'digits' | 'clock' | 'word' | 'symbol';
  /** What digits or a number word are worth. */
  value: number | null;
};

type Dimension = 'distance' | 'duration';

type Unit = { dimension: Dimension; factor: number };

/** One amount said with its unit, as the tokens it takes up. */
type Quantity = Unit & { amount: number; from: number; to: number };

const MILE_METERS = displayDistanceToMeters(1, 'imperial');

const UNIT_TABLE: [Unit, string][] = [
  [
    { dimension: 'distance', factor: 1000 },
    'km kms kilometer kilometern kilometers kilometre kilometres kilometertje kilometertjes kilómetro kilómetros quilómetro quilómetros quilômetro quilômetros chilometro chilometri kilometr kilometry kilometrów kilometra км километр километра километров километры',
  ],
  // Not "mil" or "mila": a thousand in Spanish, Portuguese and Italian.
  [
    { dimension: 'distance', factor: MILE_METERS },
    'mi mile miles meile meilen mijl mijlen milla millas milha milhas miglio miglia миля мили миль милю милей',
  ],
  [
    { dimension: 'distance', factor: 1 },
    'm meter metern meters metre metres mètre mètres metro metros metri metr metry metrów metra метр метра метров метры',
  ],
  [
    { dimension: 'duration', factor: 3600 },
    'h hr hrs hour hours stunde stunden std uur uren uurtje hora horas heure heures ora ore godzina godziny godzinę godzin godz час часа часов часу ч saat saatlik saatte',
  ],
  [
    { dimension: 'duration', factor: 60 },
    'min mins minute minutes minuten minuut minuutje minuutjes minuto minutos minuti minuta minuty minutę minut мин минута минуты минуту минут dakika dakikalık dakikada dk',
  ],
  [
    { dimension: 'duration', factor: 1 },
    's sec secs second seconds sekunde sekunden sek seconde secondes seconden segundo segundos seg secondo secondi sekunda sekundy sekundę sekund сек секунда секунды секунду секунд saniye sn',
  ],
];

const UNITS = new Map<string, Unit>(
  UNIT_TABLE.flatMap(([unit, words]) => [...spokenWords(words)].map((word) => [word, unit]))
);

/** One word that is a whole quantity. */
const WHOLE_WORDS = new Map<string, Unit & { amount: number }>([
  ['полчаса', { dimension: 'duration', factor: 3600, amount: 0.5 }],
  ['полкилометра', { dimension: 'distance', factor: 1000, amount: 0.5 }],
  ['halfuur', { dimension: 'duration', factor: 3600, amount: 0.5 }],
]);

/** The units after "on" that make it the Turkish ten and not the English preposition. */
const TURKISH_ONES = spokenWords('bir iki üç dört beş altı yedi sekiz dokuz');

/** A speed written as one word: the number before it is neither a distance nor a time. */
const SPEED_WORDS = spokenWords('kmh kph kmph mph');

/** "per", as in a pace or a speed ("5:30 per km", "12 km à l'heure"). Compared as said. */
const PER_WORDS = new Set(['/', 'per', 'pro', 'por', 'par', 'na', 'в', 'al', 'all', 'à', 'ogni']);
const PER_ARTICLES = new Set(['a', 'an', 'l', 'la', 'o']);

/** Before a number or a clock: a time of day, not an amount. Compared as said. */
const TIME_BEFORE = new Set('at um om las à às alle o в во saat godzinie godzina ore'.split(' '));
const TIME_AFTER = new Set(['am', 'pm', 'uhr']);

const WALK_WORDS = spokenWords(
  'walk walks walked walking hike hikes hiked hiking marche marcher marchais'
);
const RUN_WORDS = spokenWords('run runs ran running jog jogs jogged jogging');

/** Word starts, for the languages that inflect. */
const WALK_PREFIXES = [
  ...spokenWords(
    'camin andei andar andad anduv passeio passegg spazier wander gewander wandel gewandel gegang promen randon cammin spacer szed szł przeszed przeszł chodzi прогул гуля ходи прошел прошла шага yürü'
  ),
];
const RUN_PREFIXES = [
  ...spokenWords(
    'lauf gelauf jogg gejogg gejogd gerannt renn hardl hardgel gerend corri correr corrend corrid corsa corso couru courir course footing trot bieg pobieg przebieg бежа бега побежа пробеж пробега бег koştu koşu koşma koşa'
  ),
];

function tokenize(transcript: string): Token[] {
  const text = toAsciiDigits(transcript)
    .normalize('NFC')
    .toLowerCase()
    // "a.m." would otherwise read as one meter.
    .replace(/\b([ap])\.\s?m\b\.?/g, '$1m');
  const pattern = /(\d{1,3}(?::\d{2}){1,2})|(\d+(?:[.,]\d+)?)|([a-zß-ɏЀ-ӿ]+)|([/%])/g;
  const tokens: Token[] = [];
  let match = pattern.exec(text);
  while (match) {
    const [raw, clock, digits, word] = match;
    const folded = foldSpoken(raw);
    let kind: Token['kind'] = 'symbol';
    let value: number | null = null;
    if (clock) {
      kind = 'clock';
      value = parseImportSeconds(raw);
    } else if (digits) {
      kind = 'digits';
      value = parseImportNumber(raw);
    } else if (word) {
      kind = 'word';
      value = numberWordValue(folded);
    }

    tokens.push({ raw, word: folded, start: match.index, end: pattern.lastIndex, kind, value });
    match = pattern.exec(text);
  }

  return joinNumberWords(tokens);
}

function isNumberWord(token: Token | undefined): token is Token & { value: number } {
  return token?.kind === 'word' && token.value !== null;
}

function isConnector(token: Token | undefined): boolean {
  return token !== undefined && CONNECTOR_WORDS.has(token.word);
}

function isArticle(token: Token | undefined): boolean {
  return token !== undefined && ARTICLE_WORDS.has(token.word);
}

function isHalf(token: Token | undefined): boolean {
  return token !== undefined && HALF_WORDS.has(token.word);
}

/** The tens and the ones of one number said as two words, or null when they are not one number. */
function tensAndOnes(tokens: Token[], index: number): { value: number; length: number } | null {
  const tens = tokens[index];
  if (!isNumberWord(tens) || tens.value < 10 || tens.value % 10 !== 0) {
    return null;
  }

  const joined = isConnector(tokens[index + 1]);
  const at = index + (joined ? 2 : 1);
  const ones = tokens[at];
  // "vingt et un": an article is a one only after a joining word, and never before a half.
  const article = joined && isArticle(ones) && !isHalf(tokens[at + 1]);
  let value = article ? 1 : null;
  if (!article && isNumberWord(ones) && ones.value < 10 && Number.isInteger(ones.value)) {
    value = ones.value;
  }

  if (value === null || (tens.word === 'on' && !TURKISH_ONES.has(ones.word))) {
    return null;
  }

  return { value: tens.value + value, length: at - index + 1 };
}

/**
 * Joins "twenty five" into one number. Two number words that stay apart are a number this cannot
 * read ("soixante quinze"), so neither is worth anything.
 */
function joinNumberWords(tokens: Token[]): Token[] {
  const joined: Token[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const number = tensAndOnes(tokens, index);
    if (!number) {
      joined.push(tokens[index]);
      continue;
    }

    const last = tokens[index + number.length - 1];
    joined.push({ ...tokens[index], end: last.end, value: number.value });
    index += number.length - 1;
  }

  const unreadable = new Set<number>();
  for (let index = 1; index < joined.length; index += 1) {
    const [before, after] = [joined[index - 1], joined[index]];
    if (isNumberWord(before) && isNumberWord(after) && before.word !== 'on') {
      unreadable.add(index - 1).add(index);
    }
  }

  return joined.map((token, index) => (unreadable.has(index) ? { ...token, value: null } : token));
}

function unitOf(tokens: Token[], index: number): Unit | null {
  const token = tokens[index];
  if (token?.kind !== 'word') {
    return null;
  }

  // "5k" is five kilometres in every unit system; a lone "k" means nothing.
  if (token.word === 'k') {
    return tokens[index - 1]?.kind === 'digits' ? { dimension: 'distance', factor: 1000 } : null;
  }

  return UNITS.get(token.word) ?? null;
}

/** The index of the half added after a unit ("an hour and a half"), or null. */
function halfAfter(tokens: Token[], unitIndex: number): number | null {
  if (!isConnector(tokens[unitIndex + 1])) {
    return null;
  }

  const at = unitIndex + (isArticle(tokens[unitIndex + 2]) ? 3 : 2);
  if (!isHalf(tokens[at])) {
    return null;
  }

  // "... and half an hour" starts the next quantity.
  const next = at + (isArticle(tokens[at + 1]) ? 2 : 1);

  return next < tokens.length && unitOf(tokens, next) ? null : at;
}

/** The amount said in front of a unit, and the index of its first token. */
function amountBefore(tokens: Token[], unitIndex: number): { value: number; from: number } | null {
  const index = unitIndex - 1;
  const previous = tokens[index];
  if (!previous) {
    return null;
  }

  if (isHalf(previous)) {
    let at = index - (isArticle(tokens[index - 1]) ? 2 : 1);
    if (isConnector(tokens[at])) {
      at -= 1;
    }

    const whole = tokens[at];
    if (whole && whole.kind !== 'clock' && whole.value !== null) {
      return { value: whole.value + 0.5, from: at };
    }

    return { value: 0.5, from: isArticle(tokens[index - 1]) ? index - 1 : index };
  }

  if (isArticle(previous)) {
    return isHalf(tokens[index - 1]) ? { value: 0.5, from: index - 1 } : { value: 1, from: index };
  }

  return previous.kind !== 'clock' && previous.value !== null
    ? { value: previous.value, from: index }
    : null;
}

/** Whether what ends before `index` is a rate: a pace, or "per" followed by a unit. */
function isRate(tokens: Token[], index: number): boolean {
  if (tokens[index]?.word === 'pace') {
    return true;
  }

  if (!PER_WORDS.has(tokens[index]?.raw ?? '')) {
    return false;
  }

  let at = index + 1;
  while (PER_ARTICLES.has(tokens[at]?.raw ?? '')) {
    at += 1;
  }

  return unitOf(tokens, at) !== null;
}

function isTimeOfDay(tokens: Token[], from: number, to: number): boolean {
  const before = tokens[from - 1];
  const after = tokens[to + 1];

  return (
    (before !== undefined && TIME_BEFORE.has(before.raw)) ||
    (after !== undefined && TIME_AFTER.has(after.raw)) ||
    (after?.raw === 'o' && tokens[to + 2]?.raw === 'clock')
  );
}

/** "1,000 meters" is a thousand meters, though a comma elsewhere is a decimal point. */
function inUnit(token: Token, value: number, unit: Unit): number {
  const grouped = unit.factor === 1 && unit.dimension === 'distance';

  return grouped && /^\d{1,3}[.,]\d{3}$/.test(token.raw)
    ? Number(token.raw.replace(/[.,]/, ''))
    : value;
}

/** Every quantity said with its unit, in order; `used` collects the tokens that are spoken for. */
function quantitiesIn(tokens: Token[], used: Set<number>): Quantity[] {
  const found: Quantity[] = [];
  const take = (from: number, to: number) => {
    for (let index = from; index <= to; index += 1) {
      used.add(index);
    }
  };

  tokens.forEach((token, index) => {
    if (used.has(index)) {
      return;
    }

    if (token.kind === 'clock') {
      const rate = isRate(tokens, index + 1);
      take(index, index);
      if (!rate && !isTimeOfDay(tokens, index, index) && token.value !== null) {
        const amount = token.value;
        found.push({ dimension: 'duration', factor: 1, amount, from: index, to: index });
        // "30:00 minutes": the clock already says it.
        if (unitOf(tokens, index + 1)?.dimension === 'duration') {
          take(index + 1, index + 1);
        }
      }

      return;
    }

    if (SPEED_WORDS.has(token.word)) {
      take(Math.max(0, index - 1), index);

      return;
    }

    const whole = WHOLE_WORDS.get(token.word);
    if (whole) {
      take(index, index);
      found.push({ ...whole, from: index, to: index });

      return;
    }

    let unit = unitOf(tokens, index);
    if (!unit) {
      return;
    }

    const half = halfAfter(tokens, index);
    const before = amountBefore(tokens, index);
    // "час с половиной": the unit alone is one of it when a half is added.
    const amount = before ?? (half !== null ? { value: 1, from: index } : null);
    if (!amount) {
      return;
    }

    const to = half ?? index;
    // "1 h 30 m": after hours, "m" is minutes.
    const last = found.at(-1);
    if (token.word === 'm' && last?.factor === 3600 && joins(tokens, last.to, amount.from)) {
      unit = { dimension: 'duration', factor: 60 };
    }

    const rate = isRate(tokens, to + 1);
    const timeOfDay = unit.factor === 3600 && isTimeOfDay(tokens, amount.from, to);
    take(amount.from, to);
    if (!rate && !timeOfDay) {
      const value = inUnit(tokens[amount.from], amount.value, unit) + (half !== null ? 0.5 : 0);
      found.push({ ...unit, amount: value, from: amount.from, to });
    }
  });

  return found;
}

/** Only joining words between the two. */
function joins(tokens: Token[], end: number, start: number): boolean {
  return tokens.slice(end + 1, start).every(isConnector);
}

/**
 * The one total of a dimension: "5 km 200 m" and "1 hour 20 minutes" are one amount; two amounts
 * that differ say nothing. "1 hour 30" ends in minutes.
 */
function totalOf(
  tokens: Token[],
  quantities: Quantity[],
  dimension: Dimension,
  used: Set<number>
): number | null {
  const groups: { total: number; factor: number; to: number }[] = [];
  for (const quantity of quantities.filter((item) => item.dimension === dimension)) {
    const amount = quantity.amount * quantity.factor;
    const group = groups.at(-1);
    if (group && quantity.factor < group.factor && joins(tokens, group.to, quantity.from)) {
      group.total += amount;
      group.factor = quantity.factor;
      group.to = quantity.to;
    } else {
      groups.push({ total: amount, factor: quantity.factor, to: quantity.to });
    }
  }

  for (const group of dimension === 'duration' ? groups : []) {
    const at = group.to + (isConnector(tokens[group.to + 1]) ? 2 : 1);
    const minutes = tokens[at];
    const trailing =
      group.factor === 3600 &&
      !used.has(at) &&
      minutes?.kind !== 'clock' &&
      minutes?.value != null &&
      Number.isInteger(minutes.value) &&
      minutes.value < 60;
    if (trailing) {
      used.add(at);
      group.total += (minutes.value as number) * 60;
    }
  }

  const totals = [...new Set(groups.map((group) => group.total))];

  return totals.length === 1 ? totals[0] : null;
}

/** The one number said without a unit, which is a distance in the person's own unit. */
function bareNumber(tokens: Token[], used: Set<number>): number | null {
  const values = tokens.flatMap((token, index) => {
    if (token.kind !== 'digits' || used.has(index) || token.value === null) {
      return [];
    }

    const next = tokens[index + 1];
    // "5th", "2nd" and "10%" are not distances, nor is a rate.
    const attached = next?.kind === 'word' && next.start === token.end;
    const other = next?.raw === '%' || isRate(tokens, index + 1);

    return attached || other || isTimeOfDay(tokens, index, index) ? [] : [token.value];
  });
  const distinct = [...new Set(values)];

  return distinct.length === 1 ? distinct[0] : null;
}

function within(value: number | null, max: number): number | null {
  return value !== null && value > 0 && value <= max ? value : null;
}

/**
 * What was said about a walk or run. A unit said next to a number wins over the account's; a bare
 * number is a distance in the account's unit.
 */
export function readSpokenCardio(transcript: string, units: Units): SpokenCardio {
  const tokens = tokenize(transcript);
  const used = new Set<number>();
  const quantities = quantitiesIn(tokens, used);
  const seconds = totalOf(tokens, quantities, 'duration', used);
  const durationS = within(seconds === null ? null : Math.round(seconds), MAX_IMPORT_SET_SECONDS);
  const saidDistance = within(totalOf(tokens, quantities, 'distance', used), MAX_IMPORT_DISTANCE_M);
  let distanceM = saidDistance;
  if (!quantities.some((quantity) => quantity.dimension === 'distance')) {
    const bare = bareNumber(tokens, used);
    distanceM = within(
      bare === null ? null : displayDistanceToMeters(bare, units),
      MAX_IMPORT_DISTANCE_M
    );
  }

  return { distanceM, durationS, measured: saidDistance !== null || durationS !== null };
}

/** The activity the sentence names first, or null. */
export function readSpokenActivity(transcript: string): CardioActivity | null {
  for (const { word, kind } of tokenize(transcript)) {
    if (kind !== 'word') {
      continue;
    }

    if (RUN_WORDS.has(word) || RUN_PREFIXES.some((prefix) => word.startsWith(prefix))) {
      return 'run';
    }

    if (WALK_WORDS.has(word) || WALK_PREFIXES.some((prefix) => word.startsWith(prefix))) {
      return 'walk';
    }
  }

  return null;
}
