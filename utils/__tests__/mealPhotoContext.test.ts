import { formatMealPhotoContext, mealPhotoContextFromDraft } from '../mealPhotoContext';
import { EMPTY_MEAL_PHOTO_DRAFT } from '../mealPhotoDraft';

describe('formatMealPhotoContext', () => {
  it('returns undefined when nothing is set', () => {
    expect(formatMealPhotoContext(null)).toBeUndefined();
    expect(formatMealPhotoContext(undefined)).toBeUndefined();
    expect(formatMealPhotoContext({ description: ' ', tags: [] })).toBeUndefined();
  });

  it('formats partial contexts', () => {
    expect(formatMealPhotoContext({ description: 'big bowl', tags: ['Vegan'] })).toBe(
      'User description: big bowl\nTags: Vegan'
    );
    expect(formatMealPhotoContext({ description: '', tags: [], origin: 'home' })).toBe(
      "Where it's from: home cooked"
    );
  });

  it('formats a full context', () => {
    expect(
      formatMealPhotoContext({
        name: 'Pad thai',
        description: 'with shrimp',
        tags: ['a', 'b'],
        origin: 'takeaway',
        addedFat: 'lots',
      })
    ).toBe(
      [
        'Meal name: Pad thai',
        'User description: with shrimp',
        "Where it's from: takeaway (takeaway portions are usually larger than home portions)",
        'Added fat (oil, butter): a lot',
        'Tags: a, b',
      ].join('\n')
    );
  });

  it('covers the other origins and fat levels', () => {
    expect(formatMealPhotoContext({ description: '', tags: [], origin: 'restaurant' })).toContain(
      'restaurant portions are usually larger'
    );
    expect(formatMealPhotoContext({ description: '', tags: [], origin: 'packaged' })).toContain(
      'packaged product'
    );
    expect(formatMealPhotoContext({ description: '', tags: [], addedFat: 'none' })).toContain(
      ': none'
    );
    expect(formatMealPhotoContext({ description: '', tags: [], addedFat: 'some' })).toContain(
      ': some'
    );
  });
});

describe('mealPhotoContextFromDraft', () => {
  it('trims strings', () => {
    const c = mealPhotoContextFromDraft({
      ...EMPTY_MEAL_PHOTO_DRAFT,
      name: ' x ',
      description: ' y ',
      tags: ['t'],
    });
    expect(c).toMatchObject({ name: 'x', description: 'y', tags: ['t'], origin: null });
  });
});
