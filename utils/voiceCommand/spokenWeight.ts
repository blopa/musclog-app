/**
 * Reads the body weight a spoken sentence names, so a voice command is checked against what was
 * actually said rather than what the model wrote. Pure: no React Native, no database.
 */
import type { VoiceWeightUnit } from '@/utils/voiceCommand/types';
import { parseImportNumber } from '@/utils/workoutImport/parseNumber';

export type SpokenWeight = { value: number; unit: VoiceWeightUnit | null };

/** Words that name kilograms, matched by prefix so "kilos" and "kilogramos" both count. */
const KG_PREFIXES = ['kg', 'kilo', 'quilo', 'chilo', 'chili', 'кг', 'кило'];

/** Words that name pounds, matched by prefix. */
const LB_PREFIXES = ['lb', 'pound', 'libr', 'libbr', 'livre', 'funt', 'фунт'];

/**
 * Kilometres start with "kilo" too, so these prefixes are never a unit. Turkish "kilom" (my weight)
 * shares the spelling, and the sentence is then read as having no unit rather than as kilograms.
 */
const NOT_A_UNIT_PREFIXES = ['kilom', 'quilom'];

/**
 * German "Pfund" and Dutch "pond" are deliberately not listed: colloquially they mean 500 g, not a
 * pound, so a weight said that way is read with no unit.
 */

/** Words about weighing oneself, accents folded, matched by prefix. */
const WEIGHING_PREFIXES = [
  'weigh',
  'peso',
  'pesa',
  'poids',
  'pese',
  'wieg',
  'gewicht',
  'weeg',
  'waga',
  'waze',
  'tarti',
  'kilom',
  'kiloy',
  'вес',
  'вешу',
];

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Start of each non-ASCII decimal digit block (Arabic-Indic, Extended, Devanagari, full-width). */
const DIGIT_BASES = [0x0660, 0x06f0, 0x0966, 0xff10];

/** A run of digits with an optional decimal part, either separator. */
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

/** A clock time such as 8:30, which is not a weight. */
const CLOCK_TIME_PATTERN = /\d{1,2}:\d{2}/g;

/** A word: Latin with diacritics, or Cyrillic. Explicit ranges, since Hermes has no \p{L}. */
const WORD_PATTERN = /[a-zÀ-ɏЀ-ӿ]+/g;

type Figure = { value: number; start: number; end: number };
type Word = { text: string; start: number; end: number };

/** Maps one character to ASCII where it is another script's digit or a decimal separator. */
function toAsciiChar(ch: string): string {
  const code = ch.charCodeAt(0);
  for (const base of DIGIT_BASES) {
    if (code >= base && code <= base + 9) {
      return String.fromCharCode(0x30 + code - base);
    }
  }

  // Arabic decimal separator and full-width full stop read as a point, full-width comma as a comma.
  if (code === 0x066b || code === 0xff0e) {
    return '.';
  }

  if (code === 0xff0c) {
    return ',';
  }

  return ch;
}

/** ASCII digits, lowercase, and clock times removed (they are not weights). */
function normalizeTranscript(transcript: string): string {
  const ascii = transcript.split('').map(toAsciiChar).join('').toLowerCase();
  return ascii.replace(CLOCK_TIME_PATTERN, ' ');
}

/** Every number in the text, with its position. Cells that do not parse are skipped. */
function figuresIn(text: string): Figure[] {
  const pattern = new RegExp(NUMBER_PATTERN.source, 'g');
  const figures: Figure[] = [];
  let match = pattern.exec(text);
  while (match) {
    const value = parseImportNumber(match[0]);
    if (value !== null) {
      figures.push({ value, start: match.index, end: match.index + match[0].length });
    }

    match = pattern.exec(text);
  }

  return figures;
}

/** Every word in the text, in order, with its position. */
function wordsIn(text: string): Word[] {
  const pattern = new RegExp(WORD_PATTERN.source, 'g');
  const words: Word[] = [];
  let match = pattern.exec(text);
  while (match) {
    words.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    match = pattern.exec(text);
  }

  return words;
}

/** The unit a single word names, or null when it names none. */
function unitOf(word: string): VoiceWeightUnit | null {
  if (NOT_A_UNIT_PREFIXES.some((prefix) => word.startsWith(prefix))) {
    return null;
  }

  if (KG_PREFIXES.some((prefix) => word.startsWith(prefix))) {
    return 'kg';
  }

  if (LB_PREFIXES.some((prefix) => word.startsWith(prefix))) {
    return 'lb';
  }

  return null;
}

/**
 * The weight and its unit as said, or null when there is no number or two different numbers (then
 * it is not known which one is the weight). The unit is the first word right after the number,
 * else the word right before it.
 */
export function readSpokenWeight(transcript: string): SpokenWeight | null {
  const text = normalizeTranscript(transcript);
  const figures = figuresIn(text);
  if (figures.length === 0) {
    return null;
  }

  const [first] = figures;
  if (figures.some((figure) => figure.value !== first.value)) {
    return null;
  }

  const words = wordsIn(text);
  const after = words.find((word) => word.start >= first.end);
  const before = words.filter((word) => word.end <= first.start).pop();
  const unit = (after && unitOf(after.text)) || (before && unitOf(before.text)) || null;

  return { value: first.value, unit };
}

/**
 * Whether the sentence is about a body weight: it names a unit next to the number or uses a word for
 * weighing. A lone number ("I'm 30") is an age or a count, not a weigh-in.
 */
export function mentionsBodyWeight(transcript: string): boolean {
  if (readSpokenWeight(transcript)?.unit) {
    return true;
  }

  const folded = normalizeTranscript(transcript).normalize('NFD').replace(COMBINING_MARKS, '');

  return wordsIn(folded).some((word) =>
    WEIGHING_PREFIXES.some((prefix) => word.text.startsWith(prefix))
  );
}
