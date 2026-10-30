import {
  type AnswerFormatters,
  choiceLabel,
  FIELD_CHOICES,
  FIELD_LABEL_KEYS,
  formatAnswer,
  OPTIONAL_FIELDS,
  REVIEW_SECTIONS,
} from '@/components/aiOnboarding/fieldChoices';
import { CONTRACT_ENUMS, FIELD_KEYS, REQUIRED_FIELDS } from '@/utils/aiOnboarding/contract';

const t = (key: string) => `«${key}»`;
const base: AnswerFormatters = {
  t,
  units: 'metric',
  formatDecimal: (value, digits = 0) => value.toFixed(digits),
  formatDate: (iso) => `date:${iso}`,
};

describe('tables', () => {
  it('name every answer once, and show every answer in some section', () => {
    expect(Object.keys(FIELD_LABEL_KEYS).sort()).toEqual([...FIELD_KEYS].sort());
    expect(REVIEW_SECTIONS.flatMap((section) => section.fields).sort()).toEqual(
      [...FIELD_KEYS].sort()
    );
  });

  it('treat exactly the non-required answers as optional', () => {
    for (const field of FIELD_KEYS) {
      expect(OPTIONAL_FIELDS.has(field)).toBe(
        !(REQUIRED_FIELDS as readonly string[]).includes(field)
      );
    }
  });

  it('offer exactly the values the contract accepts for each choice field', () => {
    const contractValues: Record<string, readonly (string | number)[]> = {
      ...CONTRACT_ENUMS,
      activityLevel: [1, 2, 3, 4, 5],
      trainingDaysPerWeek: [2, 3, 4, 5],
    };
    for (const [field, choices] of Object.entries(FIELD_CHOICES)) {
      // Same set; the screens order them the way people read them (lose, maintain, gain).
      expect(choices!.map((choice) => choice.value).sort()).toEqual(
        [...contractValues[field]].sort()
      );
    }
  });
});

describe('formatAnswer', () => {
  it('is null for an unanswered field', () => {
    expect(formatAnswer('gender', {}, base)).toBeNull();
  });

  it('shows measurements in the person’s units', () => {
    expect(formatAnswer('weightKg', { weightKg: 70 }, base)).toBe('70.0 kg');
    expect(formatAnswer('heightCm', { heightCm: 180 }, base)).toBe('180.0 cm');
    const imperial = { ...base, units: 'imperial' as const };
    expect(formatAnswer('weightKg', { weightKg: 70 }, imperial)).toMatch(/^154\.\d lbs$/);
    expect(formatAnswer('heightCm', { heightCm: 177.8 }, imperial)).toBe('70.0 in');
  });

  it('formats body fat, name and birthday, flagging an estimated birthday', () => {
    expect(formatAnswer('bodyFatPercent', { bodyFatPercent: 18.5 }, base)).toBe('18.5 %');
    expect(formatAnswer('fullName', { fullName: 'Ana' }, base)).toBe('Ana');
    expect(formatAnswer('birthDate', { birthDate: '1990-01-01' }, base)).toBe('date:1990-01-01');
    expect(formatAnswer('birthDate', { birthDate: '1990-01-01', dobEstimated: true }, base)).toBe(
      'date:1990-01-01 («aiOnboarding.review.estimatedFromAge»)'
    );
  });

  it('uses the guided screens’ labels for choices', () => {
    expect(formatAnswer('gender', { gender: 'female' }, base)).toBe(
      '«onboarding.quickPreferences.female»'
    );
    expect(formatAnswer('activityLevel', { activityLevel: 4 }, base)).toBe(
      '«onboarding.personalizedExperience.veryActive»'
    );
    expect(formatAnswer('trainingDaysPerWeek', { trainingDaysPerWeek: 4 }, base)).toBe('4');
  });

  it('falls back to the raw value for a choice it does not list', () => {
    expect(formatAnswer('gender', { gender: 'x' as never }, base)).toBe('x');
  });
});

describe('choiceLabel', () => {
  it('prefers a translation key, then literal text, then the value', () => {
    expect(choiceLabel({ value: 1, labelKey: 'k' }, t)).toBe('«k»');
    expect(choiceLabel({ value: 1, labelText: 'one' }, t)).toBe('one');
    expect(choiceLabel({ value: 1 }, t)).toBe('1');
  });
});
