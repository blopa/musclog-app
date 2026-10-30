import { differenceInYears } from 'date-fns';

import {
  ageFromBirthDate,
  CONTRACT_ENUMS,
  contractDocumentSchema,
  crossFieldWarnings,
  estimateBirthDateFromAge,
  FIELD_KEYS,
  hasRequiredAnswers,
  isCompleteAnswers,
  KNOWN_DOCUMENT_KEYS,
  missingRequiredFields,
  normalizeAnswers,
  pickAnswers,
  REQUIRED_FIELDS,
  sanitizeDraft,
} from '@/utils/aiOnboarding/contract';
import { BREAK_LENGTHS } from '@/utils/comeback/comebackState';
import { BODY_FAT_MAX, BODY_FAT_MIN } from '@/utils/nutritionCalculator';
import { TRAINING_LOCATIONS } from '@/utils/onboardingTraining';

const today = new Date(2026, 9, 30);

const valid = {
  schema: 'musclog-onboarding',
  version: 1,
  units: 'metric',
  gender: 'female',
  birthDate: '1995-04-12',
  height: { value: 170, unit: 'cm' },
  weight: { value: 65, unit: 'kg' },
  liftingExperience: 'intermediate',
  activityLevel: 3,
  fitnessGoal: 'hypertrophy',
  weightGoal: 'maintain',
};

describe('normalizeAnswers', () => {
  it('accepts a complete document and normalizes it to metric', () => {
    const { draft, issues, warnings } = normalizeAnswers(valid, today);

    expect(issues).toEqual([]);
    expect(warnings).toEqual([]);
    expect(draft).toEqual({
      units: 'metric',
      gender: 'female',
      birthDate: '1995-04-12',
      heightCm: 170,
      weightKg: 65,
      liftingExperience: 'intermediate',
      activityLevel: 3,
      fitnessGoal: 'hypertrophy',
      weightGoal: 'maintain',
    });
    expect(isCompleteAnswers(draft)).toBe(true);
  });

  it('converts pounds, inches and feet+inches to kilograms and centimetres', () => {
    expect(
      normalizeAnswers(
        { weight: { value: 150, unit: 'lb' }, height: { value: 68, unit: 'in' } },
        today
      ).draft
    ).toMatchObject({ weightKg: 68, heightCm: 172.7 });
    expect(
      normalizeAnswers({ height: { feet: 5, inches: 11, unit: 'ft_in' } }, today).draft.heightCm
    ).toBe(180.3);
  });

  it('keeps valid fields when another one is invalid', () => {
    const { draft, issues } = normalizeAnswers(
      { ...valid, gender: 'robot', activityLevel: 9, weight: { value: 'heavy', unit: 'kg' } },
      today
    );

    expect(draft.heightCm).toBe(170);
    expect(draft.gender).toBeUndefined();
    expect(draft.activityLevel).toBeUndefined();
    expect(issues).toEqual(
      expect.arrayContaining([
        { field: 'gender', code: 'invalid' },
        { field: 'activityLevel', code: 'outOfRange' },
        { field: 'weightKg', code: 'invalid' },
      ])
    );
  });

  it.each([
    [{ value: 99.9, unit: 'cm' }, 'outOfRange'],
    [{ value: 250.1, unit: 'cm' }, 'outOfRange'],
    [{ value: 100, unit: 'cm' }, null],
    [{ value: 250, unit: 'cm' }, null],
    [{ value: 170, unit: 'yards' }, 'invalid'],
    ['170', 'invalid'],
  ])('checks the height range for %j', (height, code) => {
    const { issues } = normalizeAnswers({ height }, today);

    expect(issues).toEqual(code ? [{ field: 'heightCm', code }] : []);
  });

  it.each([
    [29.9, 'outOfRange'],
    [30, null],
    [300, null],
    [300.1, 'outOfRange'],
  ])('checks the weight range at %s kg', (value, code) => {
    const { issues } = normalizeAnswers({ weight: { value, unit: 'kg' } }, today);

    expect(issues).toEqual(code ? [{ field: 'weightKg', code }] : []);
  });

  it('uses the shared body-fat bounds', () => {
    expect(normalizeAnswers({ bodyFatPercent: BODY_FAT_MIN }, today).issues).toEqual([]);
    expect(normalizeAnswers({ bodyFatPercent: BODY_FAT_MAX }, today).issues).toEqual([]);
    expect(normalizeAnswers({ bodyFatPercent: BODY_FAT_MIN - 1 }, today).issues).toEqual([
      { field: 'bodyFatPercent', code: 'outOfRange' },
    ]);
    expect(normalizeAnswers({ bodyFatPercent: BODY_FAT_MAX + 1 }, today).issues).toEqual([
      { field: 'bodyFatPercent', code: 'outOfRange' },
    ]);
    expect(normalizeAnswers({ bodyFatPercent: 'lean' }, today).issues).toEqual([
      { field: 'bodyFatPercent', code: 'invalid' },
    ]);
  });

  it('treats null and a missing key the same way: not answered', () => {
    const { draft, issues } = normalizeAnswers(
      { ...valid, bodyFatPercent: null, fullName: null, training: null },
      today
    );

    expect(issues).toEqual([]);
    expect(draft.bodyFatPercent).toBeUndefined();
    expect(draft.fullName).toBeUndefined();
  });

  it('returns an empty draft for non-objects', () => {
    expect(normalizeAnswers('nope', today)).toEqual({ draft: {}, issues: [], warnings: [] });
    expect(normalizeAnswers(null, today).draft).toEqual({});
    expect(normalizeAnswers([1, 2], today).draft).toEqual({});
  });

  describe('birthday and age', () => {
    it.each([
      ['2013-10-30', null],
      ['2013-10-31', 'outOfRange'],
      ['1925-10-31', null],
      ['1925-10-30', 'outOfRange'],
      ['2030-01-01', 'outOfRange'],
      ['2024-02-31', 'invalid'],
      ['12/04/1995', 'invalid'],
      [19950412, 'invalid'],
    ])('birthDate %s', (birthDate, code) => {
      const { issues } = normalizeAnswers({ birthDate }, today);

      expect(issues).toEqual(code ? [{ field: 'birthDate', code }] : []);
    });

    it('turns an age into an estimated birthday that reads back as that age', () => {
      const { draft, issues } = normalizeAnswers({ ageYears: 34 }, today);

      expect(issues).toEqual([]);
      expect(draft.dobEstimated).toBe(true);
      expect(differenceInYears(today, new Date(`${draft.birthDate}T00:00:00`))).toBe(34);
      expect(ageFromBirthDate(draft.birthDate!, today)).toBe(34);
    });

    it.each([
      [12, 'outOfRange'],
      [101, 'outOfRange'],
      [30.5, 'invalid'],
      ['thirty', 'invalid'],
    ])('rejects age %s', (ageYears, code) => {
      expect(normalizeAnswers({ ageYears }, today).issues).toEqual([{ field: 'birthDate', code }]);
    });

    it('prefers a real date over an age and flags a mismatch', () => {
      const { draft, warnings } = normalizeAnswers(
        { birthDate: '1995-04-12', ageYears: 50 },
        today
      );

      expect(draft.birthDate).toBe('1995-04-12');
      expect(draft.dobEstimated).toBeUndefined();
      expect(warnings).toEqual([{ code: 'dobAgeMismatch' }]);
      expect(normalizeAnswers({ birthDate: '1995-04-12', ageYears: 31 }, today).warnings).toEqual(
        []
      );
    });

    it('falls back to a usable age when the date is unusable, without a false issue', () => {
      const { draft, issues } = normalizeAnswers({ birthDate: 'soon', ageYears: 40 }, today);

      expect(draft.dobEstimated).toBe(true);
      expect(issues).toEqual([]);
    });
  });

  describe('name', () => {
    it('strips control characters, collapses spaces and caps the length', () => {
      expect(normalizeAnswers({ fullName: '  Ana\u0000 \n María  ' }, today).draft.fullName).toBe(
        'Ana María'
      );
      expect(normalizeAnswers({ fullName: 'x'.repeat(200) }, today).draft.fullName).toHaveLength(
        60
      );
    });

    it('drops a name that is empty after cleaning and flags a non-string', () => {
      expect(normalizeAnswers({ fullName: ' \u0000 ' }, today)).toEqual({
        draft: {},
        issues: [],
        warnings: [],
      });
      expect(normalizeAnswers({ fullName: 5 }, today).issues).toEqual([
        { field: 'fullName', code: 'invalid' },
      ]);
    });
  });

  describe('training', () => {
    it('reads the training section and the break length', () => {
      const { draft, issues } = normalizeAnswers(
        {
          training: {
            location: 'home',
            daysPerWeek: 4,
            autonomy: 'manual',
            comingBack: { breakLength: '1to3m' },
          },
        },
        today
      );

      expect(issues).toEqual([]);
      expect(draft).toEqual({
        trainingLocation: 'home',
        trainingDaysPerWeek: 4,
        trainingAutonomy: 'manual',
        breakLength: '1to3m',
      });
    });

    it('rejects values outside the shared training lists', () => {
      const { issues } = normalizeAnswers(
        {
          training: {
            location: 'moon',
            daysPerWeek: 7,
            autonomy: 'auto',
            comingBack: { breakLength: 'forever' },
          },
        },
        today
      );

      expect(issues).toEqual(
        expect.arrayContaining([
          { field: 'trainingLocation', code: 'invalid' },
          { field: 'trainingDaysPerWeek', code: 'invalid' },
          { field: 'trainingAutonomy', code: 'invalid' },
          { field: 'breakLength', code: 'invalid' },
        ])
      );
      expect(issues).toHaveLength(4);
    });

    it('flags a coming-back section that is not an object, and a non-object training', () => {
      expect(normalizeAnswers({ training: { comingBack: 'yes' } }, today).issues).toEqual([
        { field: 'breakLength', code: 'invalid' },
      ]);
      expect(normalizeAnswers({ training: 'gym' }, today).issues).toEqual([
        { field: 'trainingLocation', code: 'invalid' },
      ]);
    });

    it('keeps the enum tables in step with the app lists', () => {
      expect(CONTRACT_ENUMS.trainingLocation).toBe(TRAINING_LOCATIONS);
      expect(CONTRACT_ENUMS.breakLength).toBe(BREAK_LENGTHS);
    });
  });

  it('never lets __proto__ reach the draft', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "gender": "male"}');
    const { draft } = normalizeAnswers(hostile, today);

    expect(draft).toEqual({ gender: 'male' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('crossFieldWarnings', () => {
  it('flags a weight-loss focus that does not lose weight', () => {
    expect(crossFieldWarnings({ fitnessGoal: 'weight_loss', weightGoal: 'gain' })).toEqual([
      { code: 'weightGoalConflictsFocus' },
    ]);
    expect(crossFieldWarnings({ fitnessGoal: 'weight_loss', weightGoal: 'lose' })).toEqual([]);
    expect(crossFieldWarnings({ fitnessGoal: 'weight_loss' })).toEqual([]);
  });

  it('says a comeback starts at maintenance', () => {
    expect(crossFieldWarnings({ breakLength: 'over6m', weightGoal: 'lose' })).toEqual([
      { code: 'comebackStartsAtMaintenance' },
    ]);
    expect(crossFieldWarnings({ breakLength: 'over6m', weightGoal: 'maintain' })).toEqual([]);
  });

  it('flags measurements that do not fit one body', () => {
    expect(crossFieldWarnings({ heightCm: 250, weightKg: 30 })).toEqual([
      { code: 'unusualBodyMeasurements' },
    ]);
    expect(crossFieldWarnings({ heightCm: 100, weightKg: 300 })).toEqual([
      { code: 'unusualBodyMeasurements' },
    ]);
    expect(crossFieldWarnings({ heightCm: 170, weightKg: 70 })).toEqual([]);
  });
});

describe('missingRequiredFields', () => {
  it('lists every required field of an empty draft', () => {
    expect(missingRequiredFields({})).toEqual([...REQUIRED_FIELDS]);
  });

  it('asks for a location when other training answers exist without one', () => {
    const complete = normalizeAnswers(valid, today).draft;

    expect(missingRequiredFields({ ...complete, trainingDaysPerWeek: 3 })).toEqual([
      'trainingLocation',
    ]);
    expect(
      missingRequiredFields({ ...complete, trainingDaysPerWeek: 3, trainingLocation: 'gym' })
    ).toEqual([]);
    expect(isCompleteAnswers({ ...complete, breakLength: '1to3m' })).toBe(false);
    // The required-only check ignores training, which a saved profile never fully has.
    expect(hasRequiredAnswers({ ...complete, breakLength: '1to3m' })).toBe(true);
    expect(hasRequiredAnswers({ ...complete, heightCm: undefined })).toBe(false);
  });

  it('only names fields the draft can hold', () => {
    for (const field of REQUIRED_FIELDS) {
      expect(FIELD_KEYS).toContain(field);
    }
  });
});

describe('estimateBirthDateFromAge', () => {
  it('lands about half a year past the whole-year mark', () => {
    expect(estimateBirthDateFromAge(30, today)).toBe('1996-05-01');
  });
});

describe('sanitizeDraft', () => {
  it('round-trips a normalized draft', () => {
    const draft = normalizeAnswers(
      {
        ...valid,
        fullName: 'Ana',
        bodyFatPercent: 21,
        training: {
          location: 'gym',
          daysPerWeek: 4,
          autonomy: 'manual',
          comingBack: { breakLength: 'under1m' },
        },
      },
      today
    ).draft;

    expect(sanitizeDraft(draft, today)).toEqual(draft);
    expect(
      sanitizeDraft({ ...draft, birthDate: '1990-01-01', dobEstimated: true }, today)
    ).toMatchObject({
      dobEstimated: true,
    });
  });

  it('drops values that no longer validate and tolerates junk', () => {
    expect(sanitizeDraft({ heightCm: 5, gender: 'male' }, today)).toEqual({ gender: 'male' });
    expect(sanitizeDraft('junk', today)).toEqual({});
  });
});

describe('contractDocumentSchema (the schema handed to assistants)', () => {
  const document = {
    ...valid,
    ageYears: undefined,
    fullName: 'Ana',
    bodyFatPercent: 21,
    training: {
      location: 'gym',
      daysPerWeek: 4,
      autonomy: 'suggest',
      comingBack: { breakLength: '1to3m' },
    },
  };

  it('accepts what normalizeAnswers accepts, so the schema and the validator cannot drift', () => {
    expect(contractDocumentSchema.safeParse(document).success).toBe(true);
    expect(normalizeAnswers(document, today).issues).toEqual([]);
  });

  it.each([
    ['unknown key', { ...document, extra: 1 }],
    ['days outside the offered list', { ...document, training: { daysPerWeek: 7 } }],
    ['unknown unit', { ...document, weight: { value: 60, unit: 'stone' } }],
    ['wrong version', { ...document, version: 2 }],
  ])('rejects %s', (_label, bad) => {
    expect(contractDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts feet and inches', () => {
    expect(
      contractDocumentSchema.safeParse({
        ...document,
        height: { feet: 5, inches: 9, unit: 'ft_in' },
      }).success
    ).toBe(true);
  });
});

describe('activity level', () => {
  it.each([
    [0, 'outOfRange'],
    [6, 'outOfRange'],
    [2.5, 'invalid'],
    [7.5, 'invalid'],
    ['3', 'invalid'],
  ])('rejects %j as %s', (activityLevel, code) => {
    expect(normalizeAnswers({ activityLevel }, today).issues).toEqual([
      { field: 'activityLevel', code },
    ]);
  });
});

describe('KNOWN_DOCUMENT_KEYS', () => {
  it('is read from the schema, so a key added to the document is known at once', () => {
    expect(KNOWN_DOCUMENT_KEYS.top).toEqual(Object.keys(contractDocumentSchema.shape));
    expect(KNOWN_DOCUMENT_KEYS.top).toEqual(
      expect.arrayContaining(['height', 'weight', 'training'])
    );
    expect(KNOWN_DOCUMENT_KEYS.height).toEqual(
      expect.arrayContaining(['value', 'unit', 'feet', 'inches'])
    );
    expect(KNOWN_DOCUMENT_KEYS.weight).toEqual(['value', 'unit']);
    expect(KNOWN_DOCUMENT_KEYS.training).toEqual(
      expect.arrayContaining(['location', 'daysPerWeek', 'autonomy', 'comingBack'])
    );
    expect(KNOWN_DOCUMENT_KEYS.comingBack).toEqual(['breakLength']);
  });
});

describe('pickAnswers', () => {
  it('keeps only the named answers that are present', () => {
    expect(
      pickAnswers({ gender: 'male', heightCm: 180, units: undefined }, [
        'gender',
        'units',
        'weightKg',
      ])
    ).toEqual({ gender: 'male' });
  });
});
