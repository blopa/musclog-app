import { readSpokenActivity, readSpokenCardio } from '@/utils/voiceCommand/spokenCardio';

/** One real sentence per shape, in each bundled language. */
const SENTENCES = [
  {
    language: 'en',
    distance: 'I ran 5 km in 30 minutes',
    halfHour: 'I walked for half an hour',
    hourAndHalf: 'I walked for an hour and a half',
    walk: 'I went for a walk',
    run: 'I went for a run',
  },
  {
    language: 'de',
    distance: 'Ich bin 5 Kilometer in 30 Minuten gelaufen',
    halfHour: 'Ich bin eine halbe Stunde gegangen',
    hourAndHalf: 'Ich bin anderthalb Stunden gegangen',
    walk: 'Ich bin spazieren gegangen',
    run: 'Ich bin gelaufen',
  },
  {
    language: 'nl',
    distance: 'Ik ben 5 km hardgelopen in 30 minuten',
    halfHour: 'Ik heb een halfuur gewandeld',
    hourAndHalf: 'Ik heb anderhalf uur gewandeld',
    walk: 'Ik ben gaan wandelen',
    run: 'Ik ben gaan hardlopen',
  },
  {
    language: 'es',
    distance: 'Corrí 5 kilómetros en 30 minutos',
    halfHour: 'Caminé media hora',
    hourAndHalf: 'Caminé una hora y media',
    walk: 'Fui a caminar',
    run: 'Fui a correr',
  },
  {
    language: 'pt-BR',
    distance: 'Corri 5 quilômetros em 30 minutos',
    halfHour: 'Caminhei meia hora',
    hourAndHalf: 'Caminhei uma hora e meia',
    walk: 'Fui caminhar',
    run: 'Fui correr',
  },
  {
    language: 'fr',
    distance: "J'ai couru 5 kilomètres en 30 minutes",
    halfHour: "J'ai marché une demi-heure",
    hourAndHalf: "J'ai marché une heure et demie",
    walk: 'Je suis allé me promener',
    run: 'Je vais courir',
  },
  {
    language: 'it',
    distance: 'Ho corso 5 chilometri in 30 minuti',
    halfHour: "Ho camminato per mezz'ora",
    hourAndHalf: "Ho camminato per un'ora e mezza",
    walk: 'Sono andato a camminare',
    run: 'Ho corso',
  },
  {
    language: 'pl',
    distance: 'Biegłem 5 kilometrów w 30 minut',
    halfHour: 'Szedłem pół godziny',
    hourAndHalf: 'Szedłem półtorej godziny',
    walk: 'Spacerowałem po parku',
    run: 'Biegałem po parku',
  },
  {
    language: 'ru',
    distance: 'Я пробежал 5 километров за 30 минут',
    halfHour: 'Я прошёл полчаса',
    hourAndHalf: 'Я гулял полтора часа',
    walk: 'Я гулял в парке',
    run: 'Я бегал по парку',
  },
  {
    language: 'tr',
    distance: '5 kilometre 30 dakika koştum',
    halfHour: 'Yarım saat yürüdüm',
    hourAndHalf: 'Bir buçuk saat yürüdüm',
    walk: 'Yürüyüşe çıktım',
    run: 'Koştum',
  },
] as const;

describe('readSpokenCardio in every bundled language', () => {
  it.each(SENTENCES.map((s) => [s.language, s] as const))(
    '%s: a distance and a duration',
    (_language, s) => {
      expect(readSpokenCardio(s.distance, 'metric')).toEqual({
        distanceM: 5000,
        durationS: 1800,
        measured: true,
      });
    }
  );

  it.each(SENTENCES.map((s) => [s.language, s] as const))(
    '%s: a half hour or an hour and a half',
    (_language, s) => {
      expect(readSpokenCardio(s.halfHour, 'metric').durationS).toBe(1800);
      expect(readSpokenCardio(s.hourAndHalf, 'metric').durationS).toBe(5400);
    }
  );

  it.each(SENTENCES.map((s) => [s.language, s] as const))(
    '%s: a walk and a run',
    (_language, s) => {
      expect(readSpokenActivity(s.walk)).toBe('walk');
      expect(readSpokenActivity(s.run)).toBe('run');
    }
  );
});

describe('readSpokenCardio units and the account unit', () => {
  it('reads a bare number in the imperial account as miles', () => {
    expect(readSpokenCardio('I ran 5', 'imperial')).toEqual({
      distanceM: expect.any(Number),
      durationS: null,
      measured: false,
    });
    expect(readSpokenCardio('I ran 5', 'imperial').distanceM).toBeCloseTo(8046.72, 2);
  });

  it('reads "5k" as five kilometres in the imperial account', () => {
    expect(readSpokenCardio('I ran 5k', 'imperial')).toEqual({
      distanceM: 5000,
      durationS: null,
      measured: true,
    });
  });

  it('lets a said unit win over the account: 3 miles on a metric account', () => {
    expect(readSpokenCardio('ran 3 miles', 'metric').distanceM).toBeCloseTo(4828.032, 3);
  });

  it('reads a decimal comma', () => {
    expect(readSpokenCardio('5,5 km', 'metric').distanceM).toBe(5500);
  });

  it('reads a thousands comma in metres', () => {
    expect(readSpokenCardio('1,000 meters', 'metric').distanceM).toBe(1000);
  });

  it('adds a compound distance: 5 km 200 m', () => {
    expect(readSpokenCardio('5 km 200 m', 'metric').distanceM).toBe(5200);
  });

  it('reads "1 hour 20" as 80 minutes and "1h30" as 90 minutes', () => {
    expect(readSpokenCardio('1 hour 20', 'metric').durationS).toBe(4800);
    expect(readSpokenCardio('1h30', 'metric').durationS).toBe(5400);
  });

  it('reads a clock as hours, minutes and seconds', () => {
    expect(readSpokenCardio('1:05:00', 'metric').durationS).toBe(3900);
    expect(readSpokenCardio('25:43', 'metric').durationS).toBe(1543);
    expect(readSpokenCardio('30:00', 'metric').durationS).toBe(1800);
  });

  it('reads an hour and a half', () => {
    expect(readSpokenCardio('an hour and a half', 'metric').durationS).toBe(5400);
  });

  it('reads number words', () => {
    expect(readSpokenCardio('twenty five minutes', 'metric').durationS).toBe(1500);
  });
});

describe('readSpokenCardio does not read these as amounts', () => {
  it('ignores a time of day but keeps the duration', () => {
    expect(readSpokenCardio('I left at 7:30 and ran for 45 minutes', 'metric')).toEqual({
      distanceM: null,
      durationS: 2700,
      measured: true,
    });
  });

  it.each([
    ['de', 'Ich bin um 7 Uhr gelaufen'],
    ['fr', 'Je suis parti à 7 heures'],
    ['es', 'Salí a las 7'],
    ['pt-BR', 'Saí às 7 horas'],
    ['it', 'Sono uscito alle 7'],
    ['nl', 'Ik ging om 7 uur'],
    ['pl', 'Wyszedłem o 7'],
    ['ru', 'Я вышел в 7 часов'],
    ['tr', "Saat 7'de koştum"],
  ])('%s: a time of day gives no duration or distance', (_language, sentence) => {
    expect(readSpokenCardio(sentence, 'metric')).toEqual({
      distanceM: null,
      durationS: null,
      measured: false,
    });
  });

  it.each(['5:30 per km', '12 km/h', '12 km per hour for 30 minutes'])(
    'ignores a pace or a speed in "%s"',
    (sentence) => {
      expect(readSpokenCardio(sentence, 'metric').distanceM).toBeNull();
    }
  );

  it('reads the duration of "12 km per hour for 30 minutes"', () => {
    expect(readSpokenCardio('12 km per hour for 30 minutes', 'metric').durationS).toBe(1800);
  });

  it('ignores an ordinal', () => {
    expect(readSpokenCardio('on the 5th', 'metric')).toEqual({
      distanceM: null,
      durationS: null,
      measured: false,
    });
  });

  it('ignores a percentage', () => {
    expect(readSpokenCardio('10% faster', 'metric').distanceM).toBeNull();
  });

  it('gives nothing for two different distances', () => {
    expect(readSpokenCardio('ran 5 km then walked 2 km', 'metric').distanceM).toBeNull();
  });

  it('gives nothing when no number is said', () => {
    expect(readSpokenCardio('I went for a run', 'metric')).toEqual({
      distanceM: null,
      durationS: null,
      measured: false,
    });
  });

  it('never reads an unbuildable number word as its parts', () => {
    expect(readSpokenCardio('soixante quinze minutes', 'metric').durationS).toBeNull();
  });
});
