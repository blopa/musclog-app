import { getMealObservationFunctions } from '../prompts';
import { formatMealObservation, parseMealObservation } from '../mealObservation';

jest.mock('@/database/services/AiCustomPromptService', () => ({
  AiCustomPromptService: { getActivePrompts: jest.fn(), getMemoriesForPrompt: jest.fn() },
}));

describe('parseMealObservation', () => {
  it('reads tolerantly', () => {
    const obs = parseMealObservation({
      mealCount: '2',
      items: [
        { name: ' Rice ', portion: 'a fist', preparation: '', confidence: 'weird' },
        { name: 'Egg', portion: 'two', preparation: 'fried', confidence: 'high' },
        'junk',
        null,
        { portion: 'no name' },
      ],
      scaleCues: ['plate', 5, ''],
    });

    expect(obs?.mealCount).toBe(2);
    expect(obs?.items).toEqual([
      { name: 'Rice', portion: 'a fist', confidence: 'medium' },
      { name: 'Egg', portion: 'two', preparation: 'fried', confidence: 'high' },
    ]);
    expect(obs?.items[0]).not.toHaveProperty('preparation');
    expect(obs?.scaleCues).toEqual(['plate']);
    expect(obs?.addedFats).toEqual([]);
  });

  it('defaults and clamps mealCount', () => {
    const items = [{ name: 'a', portion: 'b', confidence: 'low' }];

    expect(parseMealObservation({ items })?.mealCount).toBe(1);
    expect(parseMealObservation({ items, mealCount: 99 })?.mealCount).toBe(10);
    expect(parseMealObservation({ items, mealCount: 'x' })?.mealCount).toBe(1);
  });

  it('caps lengths', () => {
    const obs = parseMealObservation({
      items: Array.from({ length: 30 }, (_, i) => ({
        name: `f${i}`.padEnd(300, 'x'),
        portion: 'p',
      })),
      extras: Array.from({ length: 30 }, (_, i) => `e${i}`),
    });

    expect(obs?.items).toHaveLength(20);
    expect(obs?.items[0].name).toHaveLength(120);
    expect(obs?.extras).toHaveLength(10);
  });

  it('returns null when no item survives', () => {
    expect(parseMealObservation({ items: [] })).toBeNull();
    expect(parseMealObservation({ items: ['x'] })).toBeNull();
    expect(parseMealObservation('nope')).toBeNull();
    expect(parseMealObservation(null)).toBeNull();
  });
});

describe('formatMealObservation', () => {
  it('wraps the notes in markers and has no angle brackets or grams', () => {
    const text = formatMealObservation({
      mealCount: 1,
      items: [
        { name: 'Rice <b>', portion: 'a fist > ok', preparation: 'steamed', confidence: 'low' },
      ],
      scaleCues: ['small plate'],
      addedFats: ['olive oil <drizzle>'],
      extras: [],
      uncertain: ['butter'],
    });

    expect(text).toContain('--- FIRST LOOK ---');
    expect(text).toContain('--- END OF FIRST LOOK ---');
    expect(text).toContain('Rice');
    expect(text).not.toMatch(/[<>]/);
    expect(text).not.toMatch(/gram/i);
  });
});

describe('getMealObservationFunctions', () => {
  it('requires every property at every object level', () => {
    const walk = (schema: any) => {
      if (schema?.type === 'object') {
        expect([...(schema.required ?? [])].sort()).toEqual(Object.keys(schema.properties).sort());
        Object.values(schema.properties).forEach(walk);
      }

      if (schema?.type === 'array') {
        walk(schema.items);
      }
    };
    const [fn] = getMealObservationFunctions() as any[];

    expect(fn.name).toBe('observeMeal');
    walk(fn.parameters);
  });
});
