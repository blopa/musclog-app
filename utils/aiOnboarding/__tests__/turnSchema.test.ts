import { FIELD_KEYS } from '@/utils/aiOnboarding/contract';
import {
  buildTurnJsonSchema,
  parseAiTurn,
  patchToDocument,
  TURN_PATCH_KEYS,
} from '@/utils/aiOnboarding/turnSchema';

const today = new Date(2026, 9, 30);

type Node = {
  type?: string | string[];
  nullable?: boolean;
  enum?: unknown[];
  properties?: Record<string, Node>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Node;
};

/** Every object in a schema, so a strict-mode rule can be checked at any depth. */
function objects(node: Node, found: Node[] = []): Node[] {
  if (node.type === 'object') {
    found.push(node);
    Object.values(node.properties ?? {}).forEach((child) => objects(child, found));
  }

  if (node.items) {
    objects(node.items, found);
  }

  return found;
}

describe('buildTurnJsonSchema', () => {
  it('openai: every object lists all its properties as required and forbids extras', () => {
    const schema = buildTurnJsonSchema('openai') as Node;

    for (const object of objects(schema)) {
      expect([...(object.required ?? [])].sort()).toEqual(
        Object.keys(object.properties ?? {}).sort()
      );
      expect(object.additionalProperties).toBe(false);
    }

    const patch = schema.properties!.patch;
    expect(Object.keys(patch.properties!)).toEqual(TURN_PATCH_KEYS);
  });

  it('openai: patch values may be null, and enums include null', () => {
    const patch = (buildTurnJsonSchema('openai') as Node).properties!.patch.properties!;

    expect(patch.fullName.type).toEqual(['string', 'null']);
    expect(patch.gender.enum).toEqual(['male', 'female', 'other', null]);
    expect(patch.activityLevel.type).toEqual(['integer', 'null']);
  });

  it('gemini: nullable fields, no additionalProperties', () => {
    const schema = buildTurnJsonSchema('gemini') as Node;
    const patch = schema.properties!.patch.properties!;

    expect(patch.gender).toMatchObject({ type: 'string', nullable: true });
    expect(JSON.stringify(schema)).not.toContain('additionalProperties');
    expect(schema.required).toEqual(['reply', 'patch', 'askedFields', 'readyForReview']);
  });

  it('on-device: the patch fields are optional and plain', () => {
    const patchNode = (buildTurnJsonSchema('on-device') as Node).properties!.patch;

    expect(patchNode.required).toBeUndefined();
    expect(patchNode.properties!.gender).toEqual(
      expect.not.objectContaining({ nullable: expect.anything() })
    );
  });

  it('lets the assistant name only fields the contract has', () => {
    const asked = (buildTurnJsonSchema('gemini') as Node).properties!.askedFields.items!;

    expect(asked.enum).toEqual([...FIELD_KEYS]);
  });
});

describe('patchToDocument', () => {
  it('rebuilds the contract shape from the flat patch', () => {
    expect(
      patchToDocument({
        heightCm: 180,
        weightValue: 170,
        weightUnit: 'lb',
        trainingLocation: 'home',
        breakLength: '1to3m',
        gender: null,
      })
    ).toEqual({
      fullName: undefined,
      units: undefined,
      gender: null,
      birthDate: undefined,
      ageYears: undefined,
      height: { value: 180, unit: 'cm' },
      weight: { value: 170, unit: 'lb' },
      bodyFatPercent: undefined,
      liftingExperience: undefined,
      activityLevel: undefined,
      fitnessGoal: undefined,
      weightGoal: undefined,
      training: {
        location: 'home',
        daysPerWeek: undefined,
        autonomy: undefined,
        comingBack: { breakLength: '1to3m' },
      },
    });
  });

  it('reads feet and inches, defaulting missing inches to zero', () => {
    expect(patchToDocument({ heightFeet: 6, heightInches: 2 }).height).toEqual({
      feet: 6,
      inches: 2,
      unit: 'ft_in',
    });
    expect(patchToDocument({ heightFeet: 6 }).height).toEqual({
      feet: 6,
      inches: 0,
      unit: 'ft_in',
    });
  });

  it('prefers centimetres when both forms are given, and omits empty sections', () => {
    expect(patchToDocument({ heightCm: 170, heightFeet: 5 }).height).toEqual({
      value: 170,
      unit: 'cm',
    });
    expect(patchToDocument({}).training).toBeUndefined();
    expect(patchToDocument({}).height).toBeUndefined();
  });
});

describe('parseAiTurn', () => {
  const turn = (patch: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
    reply: '  How tall are you?  ',
    patch,
    askedFields: ['heightCm'],
    readyForReview: false,
    ...extra,
  });

  it('accepts a valid turn and normalizes the patch', () => {
    const result = parseAiTurn(
      turn({ weightValue: 154.3, weightUnit: 'lb', gender: 'male' }),
      today
    );

    expect(result).toMatchObject({
      ok: true,
      reply: 'How tall are you?',
      draftPatch: { weightKg: 70, gender: 'male' },
      askedFields: ['heightCm'],
      readyForReview: false,
      rejected: [],
    });
  });

  it('rejects bad values one by one and reports them', () => {
    const result = parseAiTurn(
      turn({ heightCm: 900, gender: 'male', activityLevel: 'high' }),
      today
    );

    expect(result).toMatchObject({ ok: true, draftPatch: { gender: 'male' } });
    expect(result.ok && result.rejected).toEqual(
      expect.arrayContaining([
        { field: 'heightCm', code: 'outOfRange' },
        { field: 'activityLevel', code: 'invalid' },
      ])
    );
  });

  it('refuses a weight that has no unit instead of guessing', () => {
    const result = parseAiTurn(turn({ weightValue: 70 }), today);

    expect(result.ok && result.draftPatch.weightKg).toBeUndefined();
    expect(result.ok && result.rejected).toEqual([{ field: 'weightKg', code: 'invalid' }]);
  });

  it('treats null as "nothing new", never as an erase', () => {
    const result = parseAiTurn(turn({ gender: null, heightCm: null }), today);

    expect(result).toMatchObject({ ok: true, draftPatch: {}, rejected: [] });
  });

  it('filters unknown and repeated asked fields and caps them', () => {
    const result = parseAiTurn(
      turn(
        {},
        {
          askedFields: [
            'gender',
            'gender',
            'favouriteColour',
            'heightCm',
            'weightKg',
            'birthDate',
            'fullName',
          ],
        }
      ),
      today
    );

    expect(result.ok && result.askedFields).toEqual([
      'gender',
      'heightCm',
      'weightKg',
      'birthDate',
    ]);
    expect(parseAiTurn(turn({}, { askedFields: 'gender' }), today)).toMatchObject({
      askedFields: [],
    });
  });

  it('only treats readyForReview as true for a real boolean true', () => {
    expect(parseAiTurn(turn({}, { readyForReview: true }), today)).toMatchObject({
      readyForReview: true,
    });
    expect(parseAiTurn(turn({}, { readyForReview: 'yes' }), today)).toMatchObject({
      readyForReview: false,
    });
  });

  it('caps a long reply', () => {
    const result = parseAiTurn(turn({}, { reply: 'x'.repeat(5000) }), today);

    expect(result.ok && result.reply).toHaveLength(1200);
  });

  it.each([null, 'text', [], {}, { reply: '' }, { reply: '   ' }, { reply: 5 }])(
    'is not a turn: %j',
    (value) => {
      expect(parseAiTurn(value, today)).toEqual({ ok: false });
    }
  );

  it('tolerates a patch that is not an object', () => {
    expect(parseAiTurn(turn('nope' as never), today)).toMatchObject({ ok: true, draftPatch: {} });
  });
});
