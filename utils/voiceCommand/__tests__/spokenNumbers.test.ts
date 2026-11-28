import {
  ARTICLE_WORDS,
  CONNECTOR_WORDS,
  foldSpoken,
  HALF_WORDS,
  numberWordValue,
  toAsciiDigits,
} from '@/utils/voiceCommand/spokenNumbers';

describe('toAsciiDigits', () => {
  it('turns Arabic-Indic digits into ASCII', () => {
    expect(toAsciiDigits('٣٠ دقيقة')).toBe('30 دقيقة');
  });

  it('turns Extended Arabic-Indic digits into ASCII', () => {
    expect(toAsciiDigits('۵ km')).toBe('5 km');
  });

  it('turns full-width digits into ASCII', () => {
    // Only digits are mapped: a full-width letter is left as it is.
    expect(toAsciiDigits('５０００ ｍ')).toBe('5000 ｍ');
  });

  it('turns the full-width comma into an ASCII comma and the Arabic decimal separator into a point', () => {
    expect(toAsciiDigits('５，５')).toBe('5,5');
    expect(toAsciiDigits('٥٫٥')).toBe('5.5');
  });

  it('leaves ordinary text alone', () => {
    expect(toAsciiDigits('5,5 km')).toBe('5,5 km');
  });
});

describe('numberWordValue', () => {
  it.each([
    ['en', 'three', 3],
    ['en', 'twenty', 20],
    ['de', 'dreißig', 30],
    ['de', 'fünf', 5],
    ['nl', 'vijftien', 15],
    ['nl', 'zeven', 7],
    ['es', 'veinte', 20],
    ['es', 'dieciséis', 16],
    ['pt-BR', 'trinta', 30],
    ['pt-BR', 'doze', 12],
    ['fr', 'soixante', 60],
    ['fr', 'quinze', 15],
    ['it', 'quaranta', 40],
    ['it', 'sedici', 16],
    ['pl', 'dwadzieścia', 20],
    ['pl', 'siedem', 7],
    ['ru', 'двадцать', 20],
    ['ru', 'одиннадцать', 11],
    ['tr', 'yirmi', 20],
    ['tr', 'beş', 5],
  ])('reads a %s number word %s', (_language, word, value) => {
    expect(numberWordValue(foldSpoken(word))).toBe(value);
  });

  it('reads an unlisted word as no number', () => {
    expect(numberWordValue(foldSpoken('kilometer'))).toBeNull();
  });
});

describe('word tables', () => {
  it('holds a half word in each Latin and Cyrillic language', () => {
    for (const word of [
      'half', // en
      'halb', // de
      'halve', // nl
      'media', // es
      'meia', // pt
      'demi', // fr
      'mezza', // it
      'pół', // pl
      'половина', // ru
      'yarım', // tr
    ]) {
      expect(HALF_WORDS.has(foldSpoken(word))).toBe(true);
    }
  });

  it('holds an article in each Latin language that has one', () => {
    for (const word of [
      'an', // en
      'eine', // de
      'een', // nl
      'una', // es
      'uma', // pt
      'une', // fr
      'uno', // it
    ]) {
      expect(ARTICLE_WORDS.has(foldSpoken(word))).toBe(true);
    }
  });

  it('holds a connector in each Latin and Cyrillic language', () => {
    for (const word of [
      'and', // en
      'und', // de
      'en', // nl
      'y', // es
      'e', // pt
      'et', // fr
      'i', // pl
      'и', // ru
      've', // tr
    ]) {
      expect(CONNECTOR_WORDS.has(foldSpoken(word))).toBe(true);
    }
  });
});
