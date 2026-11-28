/**
 * How the numbers of a spoken sentence are read, in every bundled language: other scripts' digits,
 * and the small number words a recognizer may write instead of digits. Pure; no Unicode property
 * escapes (Hermes), so accents are folded through NFD and the combining-mark range. Every word table
 * is folded the same way as the sentence, so it is written the way it is spelled.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Start of each non-ASCII decimal digit block (Arabic-Indic, Extended, Devanagari, full-width). */
const DIGIT_BASES = [0x0660, 0x06f0, 0x0966, 0xff10];

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

/** The text with ASCII digits and decimal separators. */
export function toAsciiDigits(text: string): string {
  return text.split('').map(toAsciiChar).join('');
}

/** Lowercase with accents removed: the form the word tables are compared in. */
export function foldSpoken(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}

/** A set of words, written as spelled and held folded. */
export function spokenWords(words: string): ReadonlySet<string> {
  return new Set(foldSpoken(words).split(/\s+/).filter(Boolean));
}

/**
 * One to nineteen and the tens, in the ten bundled languages. The article forms of "one" are in
 * `ARTICLE_WORDS` instead. Left out on purpose: "mil" (a thousand in Spanish and Portuguese, a mile
 * in Polish and Turkish).
 */
const NUMBER_WORDS: Record<number, string> = {
  1: 'one eins jeden jedna jedno jedną jednej один одна одно одну bir',
  1.5: 'anderthalb eineinhalb anderhalf półtora półtorej полтора полторы',
  2: 'two zwei zwo twee dos dois duas deux due dwa dwie dwóch два две iki',
  3: 'three drei drie tres três trois tre trzy trzech три üç',
  4: 'four vier cuatro quatro quatre quattro cztery czterech четыре dört',
  5: 'five fünf vijf cinco cinq cinque pięć пять beş',
  6: 'six sechs zes seis sei sześć шесть altı',
  7: 'seven sieben zeven siete sete sept sette siedem семь yedi',
  8: 'eight acht ocho oito huit otto osiem восемь sekiz',
  9: 'nine neun negen nueve nove neuf dziewięć девять dokuz',
  10: 'ten zehn tien diez dez dix dieci dziesięć десять on',
  11: 'eleven elf once onze undici jedenaście одиннадцать',
  12: 'twelve zwölf twaalf doce doze douze dodici dwanaście двенадцать',
  13: 'thirteen dreizehn dertien trece treze treize tredici trzynaście тринадцать',
  14: 'fourteen vierzehn veertien catorce catorze quatorze quattordici czternaście четырнадцать',
  15: 'fifteen fünfzehn vijftien quince quinze quindici piętnaście пятнадцать',
  16: 'sixteen sechzehn zestien dieciséis dezesseis dezasseis seize sedici szesnaście шестнадцать',
  17: 'seventeen siebzehn zeventien diecisiete dezessete dezassete diciassette siedemnaście семнадцать',
  18: 'eighteen achtzehn achttien dieciocho dezoito diciotto osiemnaście восемнадцать',
  19: 'nineteen neunzehn negentien diecinueve dezenove dezanove diciannove dziewiętnaście девятнадцать',
  20: 'twenty zwanzig twintig veinte vinte vingt venti dwadzieścia двадцать yirmi',
  30: 'thirty dreißig dreissig dertig treinta trinta trente trenta trzydzieści тридцать otuz',
  40: 'forty vierzig veertig cuarenta quarenta quarante quaranta czterdzieści сорок kırk',
  50: 'fifty fünfzig vijftig cincuenta cinquenta cinquante cinquanta pięćdziesiąt пятьдесят elli',
  60: 'sixty sechzig zestig sesenta sessenta soixante sessanta sześćdziesiąt шестьдесят altmış',
  70: 'seventy siebzig zeventig setenta settanta siedemdziesiąt семьдесят yetmiş',
  80: 'eighty achtzig tachtig ochenta oitenta ottanta osiemdziesiąt восемьдесят seksen',
  90: 'ninety neunzig negentig noventa novanta dziewięćdziesiąt девяносто doksan',
};

const NUMBER_BY_WORD = new Map<string, number>(
  Object.entries(NUMBER_WORDS).flatMap(([value, words]) =>
    [...spokenWords(words)].map((word) => [word, Number(value)] as const)
  )
);

/** The number a folded word names, or null. */
export function numberWordValue(word: string): number | null {
  return NUMBER_BY_WORD.get(word) ?? null;
}

/** "a" and "an", which count as one only in front of a unit ("an hour"). */
export const ARTICLE_WORDS = spokenWords(
  'a an ein eine einen einem einer een un une uno una um uma'
);

/** A half of what follows ("half an hour"), or what is added ("one and a half"). */
export const HALF_WORDS = spokenWords(
  'half halb halbe halben halbes halve medio media meio meia demi demie mezzo mezza mezz pół половина половиной пол yarım buçuk'
);

/** The words that join the parts of one quantity ("an hour and a half"). */
export const CONNECTOR_WORDS = spokenWords('and und en y e et i и с ve plus');
