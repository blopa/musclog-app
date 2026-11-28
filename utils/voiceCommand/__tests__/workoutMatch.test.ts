import { matchWorkoutsBySpeech, namesNoWorkout } from '@/utils/voiceCommand/workoutMatch';

const workout = (name: string, templateId = name) => ({ templateId, name, plans: [] });

describe('workout matching', () => {
  it('requires a one-letter name to follow the preceding name word', () => {
    const workouts = [workout('Workout A')];
    expect(matchWorkoutsBySpeech(workouts, 'start a workout')).toEqual([]);
    expect(matchWorkoutsBySpeech(workouts, 'start workout A')).toEqual([
      { templateId: 'Workout A', name: 'Workout A' },
    ]);
  });

  it('matches spoken numbers adjacent to the previous name word', () => {
    const workouts = [workout('Day 2')];
    expect(matchWorkoutsBySpeech(workouts, 'start day two')).toEqual([
      { templateId: 'Day 2', name: 'Day 2' },
    ]);
    expect(matchWorkoutsBySpeech(workouts, 'two exercises then start day')).toEqual([]);
  });

  it.each(['two', 'zwei', 'twee', 'dos', 'dois', 'deux', 'due', 'dwa', 'два', 'iki'])(
    'reads the spoken number %s in a workout name',
    (number) => {
      expect(matchWorkoutsBySpeech([workout('Day 2')], `start day ${number}`)).toHaveLength(1);
    }
  );

  it('does not confuse a workout named Dos with a spoken number', () => {
    expect(matchWorkoutsBySpeech([workout('Dos')], 'start two')).toEqual([]);
    expect(matchWorkoutsBySpeech([workout('Dos')], 'start dos')).toHaveLength(1);
  });

  it.each([
    ['start my workout', 'en'],
    ['starte mein training', 'de'],
    ['start mijn training', 'nl'],
    ['empieza mi entrenamiento', 'es'],
    ['inicia meu treino', 'pt'],
    ['commence mon entraînement', 'fr'],
    ['inizia il mio allenamento', 'it'],
    ['zacznij mój trening', 'pl'],
    ['начни мою тренировку', 'ru'],
    ['antrenmanımı başlat', 'tr'],
  ])('recognizes an unnamed workout in %s (%s)', (said) => {
    expect(namesNoWorkout(said)).toBe(true);
    expect(matchWorkoutsBySpeech([workout('Workout A')], said)).toEqual([]);
  });

  it('returns the longest name, preserves ties, and matches a named plan', () => {
    const workouts = [workout('Push'), workout('Push Day', '1'), workout('Push Day', '2')];
    expect(matchWorkoutsBySpeech(workouts, 'start push day').map((x) => x.templateId)).toEqual([
      '1',
      '2',
    ]);
    const planned = [{ ...workout('Day 2'), plans: [{ planId: 'p', planName: 'Strong plan' }] }];
    expect(matchWorkoutsBySpeech(planned, 'start strong plan day two')[0]).toMatchObject({
      planId: 'p',
    });
  });
});
