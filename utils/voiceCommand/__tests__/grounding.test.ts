import { isFoodSaid, isMostlySaid } from '@/utils/voiceCommand/grounding';

describe('isFoodSaid', () => {
  it.each([
    ['banana', 'I had a banana for breakfast'],
    ['maçã', 'comi uma maca no almoço'],
    ['maca', 'comi uma maçã'],
    ['ei', 'ik heb een ei gegeten'],
    ['яблоко', 'Я съел Яблоко'],
    ['Apfel kuchen', 'Ich hatte Apfelkuchen'],
    ['egg', 'two eggs please'],
    ['eggs', 'an egg'],
    ['bananas', 'one banana'],
    ['protein shake', 'log a shake'],
  ])('%s is said in "%s"', (food, transcript) => {
    expect(isFoodSaid(food, transcript)).toBe(true);
  });

  it.each([
    ['banana', 'What did I eat yesterday?'],
    ['ate', 'I had a pomegranate'],
    ['ei', 'ik heb een gegeten'],
    ['', 'anything'],
    ['   ', 'anything'],
    ['банан', 'Привет, меня зовут Павел'],
  ])('%s is not said in "%s"', (food, transcript) => {
    expect(isFoodSaid(food, transcript)).toBe(false);
  });
});

describe('isMostlySaid', () => {
  it.each([
    ['my knee hurt today', 'Note that my knee hurt today'],
    ['buy more oats', 'take a note buy more oats'],
    // Four of five words said: exactly the 80% line.
    ['buy oats milk eggs tonight', 'buy oats milk eggs'],
  ])('"%s" is mostly said in "%s"', (text, transcript) => {
    expect(isMostlySaid(text, transcript)).toBe(true);
  });

  it.each([
    // Three of five words said: under the line.
    ['buy oats milk eggs tonight', 'buy oats milk'],
    ['completely invented sentence', 'I had oats'],
    ['   ', 'anything'],
    ['', 'anything'],
  ])('"%s" is not mostly said in "%s"', (text, transcript) => {
    expect(isMostlySaid(text, transcript)).toBe(false);
  });
});
