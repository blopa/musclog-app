import { validateAgainstSchema } from '../aiSchemaValidate';

const schema = {
  type: 'object',
  required: ['name', 'items'],
  properties: {
    name: { type: 'string' },
    count: { type: 'integer', minimum: 0, maximum: 10 },
    kind: { type: 'string', enum: ['a', 'b'] },
    note: { type: ['string', 'null'] },
    items: {
      type: 'array',
      minItems: 1,
      items: { type: 'object', required: ['grams'], properties: { grams: { type: 'number' } } },
    },
  },
};

describe('validateAgainstSchema', () => {
  it('accepts a conforming value', () => {
    expect(
      validateAgainstSchema(
        { name: 'x', count: 3, kind: 'a', note: null, items: [{ grams: 5 }] },
        schema
      )
    ).toEqual({ ok: true });
  });

  it('names the missing required field', () => {
    expect(validateAgainstSchema({ items: [{ grams: 1 }] }, schema)).toEqual({
      ok: false,
      path: 'name',
      message: 'missing',
    });
  });

  it('reports the path of a nested wrong type', () => {
    const result = validateAgainstSchema({ name: 'x', items: [{ grams: 'ten' }] }, schema);
    expect(result).toMatchObject({ ok: false, path: 'items[0].grams' });
  });

  it('checks enum, bounds and item counts', () => {
    expect(validateAgainstSchema({ name: 'x', kind: 'z', items: [{ grams: 1 }] }, schema).ok).toBe(
      false
    );
    expect(validateAgainstSchema({ name: 'x', count: 11, items: [{ grams: 1 }] }, schema).ok).toBe(
      false
    );
    expect(validateAgainstSchema({ name: 'x', items: [] }, schema).ok).toBe(false);
    expect(validateAgainstSchema({ name: 'x', count: 1.5, items: [{ grams: 1 }] }, schema).ok).toBe(
      false
    );
  });

  it('reads the Gemini dialect: upper-case types and nullable', () => {
    const gemini = {
      type: 'OBJECT',
      required: ['a'],
      properties: { a: { type: 'STRING', nullable: true } },
    };
    expect(validateAgainstSchema({ a: null }, gemini).ok).toBe(true);
    expect(validateAgainstSchema({ a: 3 }, gemini).ok).toBe(false);
  });

  it('lets unknown keywords, unknown types and extra keys through', () => {
    expect(validateAgainstSchema({ x: 1 }, { type: 'object', patternProperties: {} }).ok).toBe(
      true
    );
    expect(validateAgainstSchema(1, { type: 'mystery' }).ok).toBe(true);
    expect(validateAgainstSchema({ name: 'x', extra: 1, items: [{ grams: 1 }] }, schema).ok).toBe(
      true
    );
  });

  it('rejects non-JSON-object answers for object schemas', () => {
    expect(validateAgainstSchema('free text', schema).ok).toBe(false);
    expect(validateAgainstSchema(null, schema).ok).toBe(false);
    expect(validateAgainstSchema([], schema).ok).toBe(false);
  });
});
