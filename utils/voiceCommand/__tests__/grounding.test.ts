import { isFoodSaid } from '@/utils/voiceCommand/grounding';

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
