/**
 * Does a chat message mention pain or an injury? The on-device coach's safeguard (`utils/coachAI.ts`)
 * asks this of the person's latest message, in any of the app's ten languages.
 *
 * Pure and deliberately simple: a list of words and short phrases per language, matched on whole
 * words of the lowercased message. It errs on the side of answering "yes" (a false yes only adds a
 * safety line or gives the careful fixed reply), but it does not fold accents: Polish "ból" folded
 * to "bol" is Turkish for "plenty" ("bol protein"), so unaccented spellings people really type are
 * listed on their own instead. Ordinary muscle soreness ("sore", "Muskelkater") is not on the list.
 * No Unicode property escapes (Hermes), so words are split on a fixed set of separators.
 */

type PainTerms = {
  /** Whole words. */
  words: readonly string[];
  /** Word beginnings, for languages where the word changes its ending a lot. */
  prefixes?: readonly string[];
  /** Two or more words in a row, written with single spaces and no punctuation. */
  phrases?: readonly string[];
};

export const PAIN_TERMS: Readonly<Record<string, PainTerms>> = {
  en: {
    words: [
      'pain',
      'pains',
      'painful',
      'hurt',
      'hurts',
      'hurting',
      'injury',
      'injuries',
      'injured',
      'sprain',
      'sprained',
      'strained',
      'tendinitis',
      'tendonitis',
      'ache',
      'aches',
      'aching',
      'achy',
    ],
    phrases: ['pulled a muscle', 'pulled my', 'tweaked my', 'twisted my'],
  },
  es: {
    words: [
      'dolor',
      'dolores',
      'duele',
      'duelen',
      'dolía',
      'dolió',
      'lesión',
      'lesion',
      'lesiones',
      'lesionado',
      'lesionada',
      'lesioné',
      'lastimé',
      'lastimado',
      'lastimada',
      'esguince',
      'torcedura',
      'torcí',
    ],
  },
  pt: {
    words: [
      'dor',
      'dores',
      'dói',
      'doi',
      'doem',
      'doeu',
      'doendo',
      'lesão',
      'lesao',
      'lesões',
      'lesionado',
      'lesionada',
      'lesionei',
      'machuquei',
      'machucado',
      'machucada',
      'entorse',
      'torci',
      'distensão',
    ],
  },
  nl: {
    words: [
      'pijn',
      'pijnlijk',
      'pijnlijke',
      'blessure',
      'blessures',
      'geblesseerd',
      'verrekt',
      'verstuikt',
      'verzwikt',
    ],
    phrases: ['doet zeer', 'doen zeer'],
  },
  de: {
    words: [
      'schmerz',
      'schmerzen',
      'schmerzt',
      'schmerzhaft',
      'verletzung',
      'verletzungen',
      'verletzt',
      'zerrung',
      'verstaucht',
      'verstauchung',
      // "tut weh", also split up: "Mein Knie tut beim Kniebeugen weh".
      'weh',
      'wehtun',
      'wehgetan',
    ],
  },
  fr: {
    words: [
      'douleur',
      'douleurs',
      'douloureux',
      'douloureuse',
      'blessure',
      'blessures',
      'blessé',
      'blessée',
      'entorse',
      'tendinite',
    ],
    phrases: ['j ai mal', 'fait mal', 'font mal'],
  },
  it: {
    words: [
      'dolore',
      'dolori',
      'doloroso',
      'dolorosa',
      'infortunio',
      'infortunato',
      'infortunata',
      'lesione',
      'lesioni',
      'distorsione',
      'stiramento',
    ],
    phrases: ['fa male', 'fanno male', 'mi sono fatto male', 'mi sono fatta male'],
  },
  pl: {
    words: [
      'ból',
      'bólu',
      'bóle',
      'boli',
      'bolą',
      'bolało',
      'bolesny',
      'bolesne',
      'kontuzja',
      'kontuzji',
      'kontuzję',
      'kontuzjowany',
      'kontuzjowana',
      'uraz',
      'urazu',
      'naciągnięty',
      'skręcona',
      'skręcony',
    ],
  },
  ru: {
    words: [
      'боль',
      'боли',
      'болей',
      'болью',
      'болит',
      'болят',
      'болело',
      'болели',
      'больно',
      'ушиб',
      'вывих',
      'растяжение',
      'потянул',
      'потянула',
    ],
    prefixes: ['травм'],
  },
  tr: {
    words: ['acıyor', 'aciyor', 'incindi', 'burkuldu', 'yaralandım', 'yaralandim'],
    prefixes: ['ağrı', 'ağri', 'agri', 'sakatl'],
  },
};

/** Everything that is not part of a word, in the scripts the app's languages use. */
const SEPARATORS = /[\s.,;:!?¿¡'"’‘“”„«»()[\]{}<>/\\|*_~`+=#@%^&$€£-]+/;

const WORDS = new Set<string>();
const PREFIXES: string[] = [];
const PHRASES: string[] = [];
for (const terms of Object.values(PAIN_TERMS)) {
  terms.words.forEach((word) => WORDS.add(word));
  PREFIXES.push(...(terms.prefixes ?? []));
  PHRASES.push(...(terms.phrases ?? []).map((phrase) => ` ${phrase} `));
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().split(SEPARATORS).filter(Boolean);
}

/** True when the message names pain or an injury in one of the app's languages. */
export function mentionsPainOrInjury(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }

  const words = wordsOf(text);
  if (words.some((word) => WORDS.has(word) || PREFIXES.some((prefix) => word.startsWith(prefix)))) {
    return true;
  }

  const joined = ` ${words.join(' ')} `;

  return PHRASES.some((phrase) => joined.includes(phrase));
}
