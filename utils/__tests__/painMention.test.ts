import { mentionsPainOrInjury } from '../painMention';

describe('mentionsPainOrInjury', () => {
  it.each([
    'I hurt my knee, should I squat?',
    'My knee hurts when I squat, what should I do?',
    'My lower back hurts when I deadlift. Should I keep going?',
    'My shoulder hurts on bench press, can I push through it?',
    'I sprained my ankle yesterday. Can I still go for a run today?',
    'Sharp pain in my elbow when I do curls. Any tips?',
    'My wrist hurts doing push-ups, what can I do instead?',
    'Meu joelho dói quando agacho, o que faço?',
    'Me duele la rodilla al hacer sentadillas, ¿qué hago?',
    'Mijn knie doet pijn als ik squat, wat moet ik doen?',
    'Mein Knie tut beim Kniebeugen weh, was soll ich tun?',
    "J'ai mal au genou quand je fais des squats, que faire ?",
    'Mi fa male il ginocchio quando faccio squat, cosa faccio?',
    'Boli mnie kolano przy przysiadach, co robić?',
    'Болит колено при приседаниях, что делать?',
    'Squat yaparken dizim ağrıyor, ne yapmalıyım?',
    'I think I pulled a muscle',
    'Получил травму плеча',
  ])('is true for %s', (text) => {
    expect(mentionsPainOrInjury(text)).toBe(true);
  });

  it.each([
    'How much protein should I eat per day?',
    'Thanks!',
    'Günde bol protein yemeliyim',
    'Сколько белка нужно, больше или меньше?',
    "I'm painting my room",
    'My legs are sore after leg day',
    'Quanta proteína devo comer por dia?',
    'Dziękuję bardzo!',
    'Wat kan ik het beste eten na het trainen?',
    '',
    null,
  ])('is false for %s', (text) => {
    expect(mentionsPainOrInjury(text)).toBe(false);
  });
});
