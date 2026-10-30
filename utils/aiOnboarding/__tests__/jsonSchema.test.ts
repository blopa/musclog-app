import {
  CONTRACT_MAJOR,
  CONTRACT_SCHEMA_ID,
  FIELD_KEYS,
  REQUIRED_FIELDS,
} from '@/utils/aiOnboarding/contract';
import { buildContractJsonSchema } from '@/utils/aiOnboarding/jsonSchema';

type Schema = {
  $id: string;
  required: string[];
  properties: Record<string, { const?: unknown; enum?: string[] }>;
  anyOf: { required: string[] }[];
  additionalProperties: boolean;
};

describe('buildContractJsonSchema', () => {
  const schema = buildContractJsonSchema() as unknown as Schema;

  it('pins the schema id and version as constants', () => {
    expect(schema.properties.schema).toEqual({ const: CONTRACT_SCHEMA_ID });
    expect(schema.properties.version).toEqual({ const: CONTRACT_MAJOR });
    expect(schema.$id).toBe(`https://musclog.app/schemas/onboarding/v${CONTRACT_MAJOR}.json`);
  });

  it('requires the answers every path must collect', () => {
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'schema',
        'version',
        'units',
        'gender',
        'height',
        'weight',
        'liftingExperience',
        'activityLevel',
        'fitnessGoal',
        'weightGoal',
      ])
    );
    // birthDate and ageYears are an either/or, expressed as anyOf rather than two requireds.
    expect(schema.required).not.toContain('birthDate');
    expect(schema.anyOf).toEqual([{ required: ['birthDate'] }, { required: ['ageYears'] }]);
  });

  it('forbids stray keys in the document an assistant writes', () => {
    expect(schema.additionalProperties).toBe(false);
  });

  it('lists the enum values the app accepts', () => {
    expect(schema.properties.gender.enum).toEqual(['male', 'female', 'other']);
    expect(schema.properties.fitnessGoal.enum).toContain('weight_loss');
  });

  it('covers every required draft field through a document property', () => {
    const documentFor: Record<string, string> = {
      heightCm: 'height',
      weightKg: 'weight',
      birthDate: 'birthDate',
    };
    for (const field of REQUIRED_FIELDS) {
      expect(schema.properties[documentFor[field] ?? field]).toBeDefined();
    }

    expect(FIELD_KEYS.length).toBeGreaterThan(REQUIRED_FIELDS.length);
  });
});
