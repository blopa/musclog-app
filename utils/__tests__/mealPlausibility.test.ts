import { ingredientMacroProblems, macroEnergyKcal } from '../mealPlausibility';

describe('macroEnergyKcal', () => {
  it('is 4 per protein and carb gram, 9 per fat gram and 2 per fiber gram', () => {
    expect(macroEnergyKcal({ kcal: 0, protein: 10, carbs: 20, fat: 3, fiber: 5, grams: 100 })).toBe(
      4 * 10 + 4 * 20 + 9 * 3 + 2 * 5
    );
  });

  it('counts fiber at 2 kcal per gram', () => {
    expect(macroEnergyKcal({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 50, grams: 100 })).toBe(
      100
    );
  });
});

describe('ingredientMacroProblems', () => {
  it('accepts a coherent chicken breast', () => {
    expect(
      ingredientMacroProblems({ kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, grams: 100 })
    ).toEqual([]);
  });

  it('accepts a coherent rice', () => {
    expect(
      ingredientMacroProblems({
        kcal: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4,
        grams: 100,
      })
    ).toEqual([]);
  });

  it('accepts pure olive oil', () => {
    expect(
      ingredientMacroProblems({ kcal: 884, protein: 0, carbs: 0, fat: 100, grams: 100 })
    ).toEqual([]);
  });

  it('accepts water with no energy and no macros', () => {
    expect(ingredientMacroProblems({ kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 250 })).toEqual(
      []
    );
  });

  it('accepts a tiny pinch of salt', () => {
    expect(ingredientMacroProblems({ kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 1 })).toEqual(
      []
    );
  });

  it('does not flag a rounded estimate within tolerance', () => {
    expect(
      ingredientMacroProblems({ kcal: 450, protein: 100, carbs: 0, fat: 0, grams: 200 })
    ).toEqual([]);
  });

  it.each([
    ['a negative value', { kcal: -1, protein: 0, carbs: 0, fat: 0, grams: 100 }],
    ['a NaN value', { kcal: NaN, protein: 0, carbs: 0, fat: 0, grams: 100 }],
    ['zero grams', { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }],
    ['negative grams', { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: -5 }],
  ])('reports only invalidValue for %s', (_label, ingredient) => {
    expect(ingredientMacroProblems(ingredient)).toEqual(['invalidValue']);
  });

  it('reports energy stated without macros', () => {
    expect(
      ingredientMacroProblems({ kcal: 200, protein: 0, carbs: 0, fat: 0, grams: 100 })
    ).toContain('energyWithoutMacros');
  });

  it('reports macros without stated energy', () => {
    expect(
      ingredientMacroProblems({ kcal: 0, protein: 20, carbs: 10, fat: 5, grams: 100 })
    ).toContain('macrosWithoutEnergy');
  });

  it('reports stated energy that the macros do not add up to', () => {
    expect(
      ingredientMacroProblems({ kcal: 500, protein: 10, carbs: 10, fat: 5, grams: 100 })
    ).toContain('energyMismatch');
  });

  it('reports macro mass heavier than the ingredient', () => {
    expect(
      ingredientMacroProblems({ kcal: 140, protein: 30, carbs: 50, fat: 30, grams: 100 })
    ).toContain('massExceedsGrams');
  });

  it('counts fiber toward macro mass', () => {
    expect(
      ingredientMacroProblems({ kcal: 80, protein: 0, carbs: 0, fat: 0, fiber: 100, grams: 50 })
    ).toContain('massExceedsGrams');
  });

  it('counts fiber toward computed energy', () => {
    expect(
      ingredientMacroProblems({ kcal: 100, protein: 0, carbs: 0, fat: 0, fiber: 50, grams: 100 })
    ).toEqual([]);
    expect(
      ingredientMacroProblems({ kcal: 20, protein: 0, carbs: 0, fat: 0, fiber: 50, grams: 100 })
    ).toContain('energyMismatch');
  });

  it('reports more energy per gram than pure fat has', () => {
    expect(
      ingredientMacroProblems({ kcal: 1200, protein: 0, carbs: 0, fat: 100, grams: 100 })
    ).toContain('impossibleDensity');
  });
});
