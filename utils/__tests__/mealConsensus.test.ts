import {
  consensusMeals,
  mealsAgree,
  mealStageIsSettled,
  normalizeIngredientName,
  observationIsUncertain,
} from '../mealConsensus';

const ing = (name: string, grams: number, kcal: number, extra = {}) => ({
  name,
  grams,
  kcal,
  protein: kcal / 10,
  carbs: 0,
  fat: 0,
  ...extra,
});
const meal = (ingredients: ReturnType<typeof ing>[]) => ({
  mealType: 'lunch' as const,
  mealName: 'Lunch',
  ingredients,
});

describe('normalizeIngredientName', () => {
  it('ignores case, accents and spacing', () => {
    expect(normalizeIngredientName('  Crème  Fraîche ')).toBe('creme fraiche');
  });
});

describe('consensusMeals', () => {
  it('returns a single sample unchanged', () => {
    const sample = { meals: [meal([ing('Rice', 100, 130)])] };
    expect(consensusMeals([sample])).toBe(sample);
  });

  it('keeps ingredients named by a strict majority and drops the rest', () => {
    const result = consensusMeals([
      { meals: [meal([ing('Rice', 100, 130), ing('Olive oil', 10, 90)])] },
      { meals: [meal([ing('rice', 100, 130), ing('Olive Oil', 10, 90), ing('Parsley', 2, 1)])] },
      { meals: [meal([ing('Rice', 100, 130)])] },
    ]);
    expect(result.meals[0].ingredients.map((i) => i.name)).toEqual(['Rice', 'Olive oil']);
  });

  it('needs both of two samples', () => {
    const result = consensusMeals([
      { meals: [meal([ing('Rice', 100, 130), ing('Butter', 5, 36)])] },
      { meals: [meal([ing('Rice', 100, 130)])] },
    ]);
    expect(result.meals[0].ingredients.map((i) => i.name)).toEqual(['Rice']);
  });

  it('takes the median grams and the median per-gram macros times it', () => {
    const result = consensusMeals([
      { meals: [meal([ing('Rice', 100, 100)])] },
      { meals: [meal([ing('Rice', 200, 400)])] },
      { meals: [meal([ing('Rice', 150, 150)])] },
    ]);
    const rice = result.meals[0].ingredients[0];
    // per gram: 1, 2, 1 -> 1; grams: 100, 200, 150 -> 150
    expect(rice.grams).toBe(150);
    expect(rice.kcal).toBe(150);
    expect(rice.protein).toBe(15);
  });

  it('keeps a foodId only when most occurrences agree on it', () => {
    const agreed = consensusMeals([
      { meals: [meal([ing('Rice', 100, 130, { foodId: 'a' })])] },
      { meals: [meal([ing('Rice', 100, 130, { foodId: 'a' })])] },
      { meals: [meal([ing('Rice', 100, 130)])] },
    ]);
    expect(agreed.meals[0].ingredients[0].foodId).toBe('a');

    const split = consensusMeals([
      { meals: [meal([ing('Rice', 100, 130, { foodId: 'a' })])] },
      { meals: [meal([ing('Rice', 100, 130, { foodId: 'b' })])] },
      { meals: [meal([ing('Rice', 100, 130)])] },
    ]);
    expect(split.meals[0].ingredients[0].foodId).toBeUndefined();
  });

  it('uses the most common meal count and ignores samples with another layout', () => {
    const one = { meals: [meal([ing('Rice', 100, 130)])] };
    const two = { meals: [meal([ing('Egg', 50, 70)]), meal([ing('Toast', 30, 80)])] };
    const result = consensusMeals([one, two, two]);
    expect(result.meals).toHaveLength(2);
    expect(result.meals[1].ingredients[0].name).toBe('Toast');
  });

  describe('with groups', () => {
    const names = (result: ReturnType<typeof consensusMeals>) =>
      result.meals[0].ingredients.map((i) => i.name);
    const rice = { meals: [meal([ing('Rice', 100, 130)])] };
    const riceButter = { meals: [meal([ing('Rice', 100, 130), ing('Butter', 5, 36)])] };

    it('keeps an ingredient that both samples of one look found (an oil the other look missed)', () => {
      const result = consensusMeals([riceButter, riceButter, rice, rice], [0, 0, 1, 1]);
      expect(names(result)).toEqual(['Rice', 'Butter']);
    });

    it('drops an ingredient only a single sample of four found', () => {
      expect(names(consensusMeals([riceButter, rice, rice, rice], [0, 0, 1, 1]))).toEqual(['Rice']);
      expect(names(consensusMeals([rice, rice, rice, riceButter], [0, 0, 1, 1]))).toEqual(['Rice']);
    });

    it('keeps an ingredient found once under each look', () => {
      const result = consensusMeals([riceButter, rice, riceButter, rice], [0, 0, 1, 1]);
      expect(names(result)).toEqual(['Rice', 'Butter']);
    });

    it('needs at least half of the answered samples: two of three, not one of three', () => {
      expect(names(consensusMeals([riceButter, rice, rice], [0, 0, 1]))).toEqual(['Rice']);
      expect(names(consensusMeals([riceButter, riceButter, rice], [0, 1, 1]))).toEqual([
        'Rice',
        'Butter',
      ]);
    });

    it('still takes the median grams and per-gram numbers of the samples that found it', () => {
      const withButter = (grams: number) => ({
        meals: [meal([ing('Rice', 100, 130), ing('Butter', grams, grams * 7.2)])],
      });
      const result = consensusMeals(
        [withButter(10), withButter(20), withButter(40), rice],
        [0, 0, 1, 1]
      );
      const butter = result.meals[0].ingredients.find((item) => item.name === 'Butter');

      expect(butter?.grams).toBe(20);
      expect(butter?.kcal).toBe(144);
    });

    it('falls back to the majority when fewer than 2 groups remain', () => {
      const result = consensusMeals([riceButter, riceButter, rice], [0, 0, 0]);
      expect(names(result)).toEqual(['Rice', 'Butter']);
    });

    it('filters by layout first and uses the groups that remain', () => {
      const two = { meals: [meal([ing('Egg', 50, 70)]), meal([ing('Toast', 30, 80)])] };
      // The only group-1 sample has another layout, so one group remains: majority rule.
      const result = consensusMeals([riceButter, riceButter, rice, two], [0, 0, 0, 1]);
      expect(result.meals).toHaveLength(1);
      expect(names(result)).toEqual(['Rice', 'Butter']);
    });

    it('matches the ungrouped result when no groups are given, which stays strictly more than half', () => {
      const samples = [riceButter, rice, riceButter, rice];
      expect(consensusMeals(samples)).toEqual(consensusMeals(samples, undefined));
      expect(names(consensusMeals(samples))).toEqual(['Rice']);
      // The same samples with two looks keep the half that found it.
      expect(names(consensusMeals(samples, [0, 0, 1, 1]))).toEqual(['Rice', 'Butter']);
    });
  });

  it('breaks a tie of counts with the first sample', () => {
    const one = { meals: [meal([ing('Rice', 100, 130)])] };
    const two = { meals: [meal([ing('Egg', 50, 70)]), meal([ing('Toast', 30, 80)])] };
    expect(consensusMeals([one, two]).meals).toHaveLength(1);
  });
});

describe('mealsAgree', () => {
  const one = (...ingredients: ReturnType<typeof ing>[]) => ({ meals: [meal(ingredients)] });

  it('agrees on the same ingredients and energy, ignoring grams, order and accents', () => {
    expect(
      mealsAgree(
        one(ing('Rice', 100, 130), ing('Crème fraîche', 20, 40)),
        one(ing('crème  FRAICHE', 35, 40), ing('rice', 90, 120))
      )
    ).toBe(true);
  });

  it('disagrees on a different number of meals', () => {
    expect(mealsAgree(one(ing('Rice', 100, 130)), { meals: [] })).toBe(false);
  });

  it('disagrees when an ingredient is missing or extra', () => {
    expect(
      mealsAgree(one(ing('Rice', 100, 130)), one(ing('Rice', 100, 130), ing('Oil', 5, 45)))
    ).toBe(false);
    expect(
      mealsAgree(one(ing('Rice', 100, 130), ing('Oil', 5, 45)), one(ing('Rice', 100, 130)))
    ).toBe(false);
  });

  it('disagrees when the energy is 20% apart', () => {
    expect(mealsAgree(one(ing('Rice', 100, 100)), one(ing('Rice', 100, 80)))).toBe(false);
  });

  it('agrees exactly at the boundary (15% of the larger total)', () => {
    expect(mealsAgree(one(ing('Rice', 100, 100)), one(ing('Rice', 100, 85)))).toBe(true);
  });

  it('uses a custom tolerance when given', () => {
    expect(mealsAgree(one(ing('Rice', 100, 100)), one(ing('Rice', 100, 80)), 0.25)).toBe(true);
  });

  it('agrees two meals of zero energy', () => {
    expect(mealsAgree(one(ing('Water', 0, 0)), one(ing('Water', 0, 0)))).toBe(true);
  });
});

describe('observationIsUncertain', () => {
  it('is true only when the look lists something uncertain', () => {
    expect(observationIsUncertain({ uncertain: [] })).toBe(false);
    expect(observationIsUncertain({ uncertain: ['the sauce'] })).toBe(true);
  });
});

describe('mealStageIsSettled', () => {
  const clear = { uncertain: [] };
  const sample = (kcal: number) => ({ meals: [meal([ing('Rice', 100, kcal)])] });

  it('never settles on zero or one sample', () => {
    expect(mealStageIsSettled({ samples: [], look: clear, rechecked: [] })).toBe(false);
    expect(mealStageIsSettled({ samples: [sample(130)], look: clear, rechecked: [false] })).toBe(
      false
    );
  });

  it('settles when two or more answered samples agree and the look is clear', () => {
    expect(
      mealStageIsSettled({
        samples: [sample(130), sample(128), sample(132)],
        look: clear,
        rechecked: [false, false, false],
      })
    ).toBe(true);
  });

  it('does not settle when the look is uncertain', () => {
    expect(
      mealStageIsSettled({
        samples: [sample(130), sample(130)],
        look: { uncertain: ['oil'] },
        rechecked: [false, false],
      })
    ).toBe(false);
  });

  it('does not settle when any sample needed the plausibility recheck', () => {
    expect(
      mealStageIsSettled({
        samples: [sample(130), sample(130)],
        look: clear,
        rechecked: [false, true],
      })
    ).toBe(false);
  });

  it('does not settle when a later sample disagrees with the first', () => {
    expect(
      mealStageIsSettled({
        samples: [sample(130), sample(130), sample(200)],
        look: clear,
        rechecked: [false, false, false],
      })
    ).toBe(false);
  });
});
