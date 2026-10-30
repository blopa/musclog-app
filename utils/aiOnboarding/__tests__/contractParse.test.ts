import { MAX_CONTRACT_BYTES } from '@/utils/aiOnboarding/contract';
import {
  extractJsonCandidate,
  parseContractText,
  utf8ByteLength,
} from '@/utils/aiOnboarding/contractParse';

const today = new Date(2026, 9, 30);

const doc = {
  schema: 'musclog-onboarding',
  version: 1,
  units: 'imperial',
  gender: 'male',
  ageYears: 41,
  height: { feet: 5, inches: 10, unit: 'ft_in' },
  weight: { value: 180, unit: 'lb' },
  liftingExperience: 'beginner',
  activityLevel: 2,
  fitnessGoal: 'weight_loss',
  weightGoal: 'lose',
};

describe('extractJsonCandidate', () => {
  it('passes plain JSON through', () => {
    expect(extractJsonCandidate('  {"a":1}  ')).toBe('{"a":1}');
  });

  it('prefers a fenced block, with or without a language tag', () => {
    expect(extractJsonCandidate('Here:\n```json\n{"a": 1}\n```\nDone')).toBe('{"a": 1}');
    expect(extractJsonCandidate('```\n{"a": {"b": 2}} trailing\n```')).toBe('{"a": {"b": 2}}');
  });

  it('finds the first balanced object in prose, ignoring braces in strings', () => {
    expect(extractJsonCandidate('Sure! {"a":"}{\\"","b":{"c":1}} thanks {"x":1}')).toBe(
      '{"a":"}{\\"","b":{"c":1}}'
    );
  });

  it('returns null when there is nothing object-shaped', () => {
    expect(extractJsonCandidate('')).toBeNull();
    expect(extractJsonCandidate('no json here')).toBeNull();
    expect(extractJsonCandidate('{"unterminated": 1')).toBeNull();
  });

  it('hands an unparseable fenced body on so the caller reports notJson', () => {
    expect(extractJsonCandidate('```\nnot an object\n```')).toBe('not an object');
  });
});

describe('utf8ByteLength', () => {
  it('counts one to four bytes per character', () => {
    expect(utf8ByteLength('a')).toBe(1);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
  });
});

describe('parseContractText', () => {
  it('parses a document and keeps what is valid', () => {
    const result = parseContractText(JSON.stringify(doc), today);

    expect(result).toMatchObject({ ok: true, issues: [], droppedKeys: [] });
    if (result.ok) {
      expect(result.draft).toMatchObject({
        units: 'imperial',
        heightCm: 177.8,
        weightKg: 81.6,
        dobEstimated: true,
      });
    }
  });

  it('reads a document wrapped in a code fence and prose', () => {
    expect(
      parseContractText(`Here you go:\n\`\`\`json\n${JSON.stringify(doc)}\n\`\`\``, today).ok
    ).toBe(true);
  });

  it('lists unknown keys, top level and nested, and applies none of them', () => {
    const result = parseContractText(
      JSON.stringify({
        ...doc,
        favouriteFood: 'rice',
        height: { ...doc.height, extra: 1 },
        training: { location: 'gym', mood: 'ok', comingBack: { breakLength: '1to3m', why: 'x' } },
      }),
      today
    );

    expect(result.ok && result.droppedKeys).toEqual([
      'favouriteFood',
      'height.extra',
      'training.mood',
      'training.comingBack.why',
    ]);
    expect(result.ok && Object.keys(result.draft)).not.toContain('favouriteFood');
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['not json at all', 'notJson'],
    ['{"broken":', 'notJson'],
    ['[1,2,3]', 'notAnObject'],
    ['"a string"', 'notAnObject'],
    ['{"schema":"something-else","version":1}', 'wrongSchema'],
    ['{"version":1}', 'wrongSchema'],
    ['{"schema":"musclog-onboarding","version":2}', 'newerVersion'],
    ['{"schema":"musclog-onboarding","version":2.1}', 'newerVersion'],
    ['{"schema":"musclog-onboarding","version":0}', 'invalidVersion'],
    ['{"schema":"musclog-onboarding","version":"1"}', 'invalidVersion'],
    ['{"schema":"musclog-onboarding"}', 'invalidVersion'],
  ])('refuses %j as %s', (text, error) => {
    expect(parseContractText(text, today)).toEqual({ ok: false, error });
  });

  it('accepts a minor version of the same major and ignores the fraction', () => {
    expect(parseContractText('{"schema":"musclog-onboarding","version":1.4}', today).ok).toBe(true);
  });

  it('refuses a top-level array', () => {
    expect(parseContractText('```\n[1]\n```', today)).toEqual({ ok: false, error: 'notAnObject' });
  });

  it('measures the size limit in bytes, not characters', () => {
    const filler = '€'.repeat(Math.floor(MAX_CONTRACT_BYTES / 3) + 1);

    expect(filler.length).toBeLessThan(MAX_CONTRACT_BYTES);
    expect(parseContractText(filler, today)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('reports the issues of an otherwise valid document', () => {
    const result = parseContractText(JSON.stringify({ ...doc, activityLevel: 11 }), today);

    expect(result.ok && result.issues).toEqual([{ field: 'activityLevel', code: 'outOfRange' }]);
  });

  it('lists a __proto__ key as ignored instead of applying it', () => {
    const result = parseContractText(
      '{"schema":"musclog-onboarding","version":1,"__proto__":{"x":1}}',
      today
    );

    expect(result.ok && result.droppedKeys).toEqual(['__proto__']);
  });
});
