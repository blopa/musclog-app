import { getMealObservationFunctions } from '../mealPassPrompts';
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

  it('reads the scene, and treats "unknown" as no note', () => {
    const items = [{ name: 'Rice', portion: 'a fist', confidence: 'high' }];
    const obs = parseMealObservation({
      items,
      scene: '  A hand holding a regular-size plate with rice and curry, at a restaurant.  ',
      setting: 'restaurant',
      container: 'plate',
      containerSize: 'regular dinner plate, about 26 cm across',
    });

    expect(obs).toMatchObject({
      scene: 'A hand holding a regular-size plate with rice and curry, at a restaurant.',
      setting: 'restaurant',
      container: 'plate',
      containerSize: 'regular dinner plate, about 26 cm across',
    });

    const unknown = parseMealObservation({
      items,
      scene: 'Unknown',
      setting: 'unknown.',
      container: 'N/A',
      containerSize: '',
    });

    expect(unknown).toMatchObject({ scene: '', setting: '', container: '', containerSize: '' });
    expect(parseMealObservation({ items })).toMatchObject({ scene: '', setting: '' });
  });

  it('keeps a long scene up to 300 characters and other notes to 120', () => {
    const obs = parseMealObservation({
      items: [{ name: 'a', portion: 'b' }],
      scene: 's'.repeat(500),
      setting: 'x'.repeat(500),
    });

    expect(obs?.scene).toHaveLength(300);
    expect(obs?.setting).toHaveLength(120);
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
      scene: 'A hand holding a <b>plate</b> at a restaurant',
      setting: 'restaurant',
      container: 'plate',
      containerSize: 'about 26 cm across',
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

  it('puts the scene, setting and container before the foods', () => {
    const text = formatMealObservation({
      mealCount: 1,
      scene: 'A hand holding a regular-size plate with rice and curry, at a restaurant.',
      setting: 'restaurant',
      container: 'plate',
      containerSize: 'about 26 cm across',
      items: [{ name: 'Rice', portion: 'half the plate', confidence: 'high' }],
      scaleCues: [],
      addedFats: [],
      extras: [],
      uncertain: [],
    });

    expect(text).toContain('Scene: A hand holding a regular-size plate');
    expect(text).toContain('Setting: restaurant');
    expect(text).toContain('Container: plate (about 26 cm across)');
    expect(text.indexOf('Scene:')).toBeLessThan(text.indexOf('- Rice'));
    expect(text).toContain('judge how large each portion is');
  });

  it('leaves out the scene lines when there are none', () => {
    const text = formatMealObservation({
      mealCount: 1,
      scene: '',
      setting: '',
      container: '',
      containerSize: '',
      items: [{ name: 'Rice', portion: 'a fist', confidence: 'high' }],
      scaleCues: [],
      addedFats: [],
      extras: [],
      uncertain: [],
    });

    expect(text).not.toMatch(/Scene:|Setting:|Container/);
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
