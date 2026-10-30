import exercisesData from '@/data/exercisesData.json';

import {
  BODYWEIGHT_REP_CEILING_OPTIONS,
  DEFAULT_BODYWEIGHT_REP_CEILING,
  defaultRepCeilingFor,
  resolveRepCeiling,
  storedRepCeiling,
  WHOLE_BODY_REP_CEILING,
} from '../bodyweightRepCeiling';

type CatalogueRow = { __exerciseName: string; equipmentType: string; loadMultiplier: number };

const bodyweight = (exercisesData as CatalogueRow[]).filter(
  (row) => row.equipmentType === 'bodyweight'
);
const named = (pattern: RegExp) => bodyweight.filter((row) => pattern.test(row.__exerciseName));

describe('defaultRepCeilingFor', () => {
  it('stops whole-body pulls and dips at 15, where a belt or harder variation takes over', () => {
    const pullsAndDips = named(/^(pull-?ups?|chin-up|parallel bar dip|ring dips|muscle up)$/i);
    expect(pullsAndDips.length).toBeGreaterThanOrEqual(5);
    for (const row of pullsAndDips) {
      expect(defaultRepCeilingFor(row.loadMultiplier)).toBe(WHOLE_BODY_REP_CEILING);
    }
  });

  it('lets push-ups and leg raises keep climbing to 25', () => {
    const lighter = named(/^(pushups|push-up wide|hanging leg raise)$/i);
    expect(lighter.length).toBeGreaterThanOrEqual(2);
    for (const row of lighter) {
      expect(defaultRepCeilingFor(row.loadMultiplier)).toBe(DEFAULT_BODYWEIGHT_REP_CEILING);
    }
  });

  it('falls back to the general default when the multiplier is unknown', () => {
    expect(defaultRepCeilingFor(undefined)).toBe(DEFAULT_BODYWEIGHT_REP_CEILING);
    expect(defaultRepCeilingFor(null)).toBe(DEFAULT_BODYWEIGHT_REP_CEILING);
  });

  it('only ever returns a value the picker offers', () => {
    for (const row of bodyweight) {
      expect(BODYWEIGHT_REP_CEILING_OPTIONS).toContain(defaultRepCeilingFor(row.loadMultiplier));
    }
  });
});

describe('stored ceilings', () => {
  it('offers low ceilings for hard movements, not only 25 and up', () => {
    expect(BODYWEIGHT_REP_CEILING_OPTIONS).toEqual(expect.arrayContaining([10, 12, 15, 20]));
  });

  it('keeps an explicit pick that equals a default, and drops values this build does not offer', () => {
    expect(storedRepCeiling(25)).toBe(25);
    expect(storedRepCeiling(27)).toBeUndefined();
    expect(storedRepCeiling('25')).toBeUndefined();
  });

  it('resolves the pick first, then the movement default', () => {
    expect(resolveRepCeiling(30, WHOLE_BODY_REP_CEILING)).toBe(30);
    expect(resolveRepCeiling(undefined, WHOLE_BODY_REP_CEILING)).toBe(15);
    expect(resolveRepCeiling(99, DEFAULT_BODYWEIGHT_REP_CEILING)).toBe(25);
  });
});
