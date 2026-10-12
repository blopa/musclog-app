import type { GymSnapshot } from '../gym';
import { defaultBarWeightKg, defaultPlates } from '../gym';
import { nearestLoadableKg, platesPerSide, roundToLoadable } from '../plateCalculator';
import { displayToKg, kgToDisplay } from '../unitConversion';

const commercial = { barWeightKg: 20, plates: defaultPlates('metric') };

const sumOfSide = (load: ReturnType<typeof platesPerSide>) =>
  load.platesPerSide.reduce((sum, plate) => sum + plate.weightKg * plate.count, 0);
const plateCount = (load: ReturnType<typeof platesPerSide>) =>
  load.platesPerSide.reduce((sum, plate) => sum + plate.count, 0);

describe('platesPerSide', () => {
  it('loads an exact weight with the fewest plates', () => {
    const load = platesPerSide(100, commercial);
    expect(sumOfSide(load)).toBeCloseTo(40);
    expect(plateCount(load)).toBe(2);
    expect(load.loadedKg).toBe(100);
    expect(load.remainderKg).toBe(0);
    expect(load.belowBar).toBe(false);
  });

  it('puts one plate on each side for a single-plate load', () => {
    expect(platesPerSide(60, commercial).platesPerSide).toEqual([{ weightKg: 20, count: 1 }]);
  });

  it('loads the empty bar with no plates', () => {
    expect(platesPerSide(20, commercial)).toMatchObject({
      platesPerSide: [],
      loadedKg: 20,
      remainderKg: 0,
      belowBar: false,
    });
  });

  it('says so when the target is lighter than the bar', () => {
    expect(platesPerSide(15, commercial)).toEqual({
      platesPerSide: [],
      loadedKg: 20,
      remainderKg: -5,
      belowBar: true,
    });
  });

  it('reports how far short a target falls when the smallest plate is too big', () => {
    // 0.5 kg a side is below the 1.25 kg plate.
    expect(platesPerSide(21, commercial)).toMatchObject({
      platesPerSide: [],
      loadedKg: 20,
      remainderKg: 1,
    });
  });

  it('uses the smallest plate for fractional loads', () => {
    expect(platesPerSide(22.5, commercial)).toMatchObject({
      platesPerSide: [{ weightKg: 1.25, count: 1 }],
      loadedKg: 22.5,
      remainderKg: 0,
    });
  });

  // Greedy takes the 20 and is stuck 5 short; the exact answer is 15 + 10.
  it('finds the exact load when a greedy choice would miss it', () => {
    const limited = {
      barWeightKg: 20,
      plates: [
        { weightKg: 20, count: 2 },
        { weightKg: 15, count: 2 },
        { weightKg: 10, count: 2 },
      ],
    };
    expect(platesPerSide(70, limited)).toEqual({
      platesPerSide: [
        { weightKg: 15, count: 1 },
        { weightKg: 10, count: 1 },
      ],
      loadedKg: 70,
      remainderKg: 0,
      belowBar: false,
    });
  });

  it('never uses more plates than the gym owns, and plates only load in pairs', () => {
    const load = platesPerSide(120, {
      barWeightKg: 20,
      plates: [
        { weightKg: 20, count: 2 },
        { weightKg: 15, count: 2 },
        { weightKg: 10, count: 2 },
      ],
    });
    // 20 + 15 + 10 = 45 a side is all there is.
    expect(load.loadedKg).toBe(110);
    expect(load.remainderKg).toBe(10);

    // Three plates make one pair and a spare that cannot be loaded symmetrically.
    expect(
      platesPerSide(100, { barWeightKg: 20, plates: [{ weightKg: 20, count: 3 }] })
    ).toMatchObject({
      platesPerSide: [{ weightKg: 20, count: 1 }],
      loadedKg: 60,
      remainderKg: 40,
    });
  });

  it('handles a gym with no plates at all', () => {
    expect(platesPerSide(80, { barWeightKg: 20, plates: [] })).toMatchObject({
      platesPerSide: [],
      loadedKg: 20,
    });
  });

  it('loads 135 lb with the 45 lb bar and a pair of 45s', () => {
    const gym = { barWeightKg: defaultBarWeightKg('imperial'), plates: defaultPlates('imperial') };
    const load = platesPerSide(displayToKg(225, 'imperial'), gym);

    expect(load.platesPerSide).toHaveLength(1);
    expect(load.platesPerSide[0].count).toBe(2); // 2 × 45 lb a side
    expect(kgToDisplay(load.loadedKg, 'imperial')).toBeCloseTo(225, 0);
  });

  it('is safe on a non-finite target', () => {
    expect(platesPerSide(Number.NaN, commercial).belowBar).toBe(true);
  });
});

describe('nearestLoadableKg', () => {
  it('snaps to the closest load, rounding a tie down', () => {
    expect(nearestLoadableKg(101, commercial)).toBe(100);
    expect(nearestLoadableKg(101.5, commercial)).toBe(102.5);
    expect(nearestLoadableKg(100, commercial)).toBe(100);
  });

  it('never goes below the bar', () => {
    expect(nearestLoadableKg(5, commercial)).toBe(20);
  });

  it('can go above the target when that is closer', () => {
    expect(nearestLoadableKg(22, commercial)).toBe(22.5);
  });
});

describe('roundToLoadable', () => {
  const gym: GymSnapshot = {
    id: 'g',
    name: 'Home',
    barWeightKg: 20,
    plates: defaultPlates('metric'),
    weightIncrementKg: 2.5,
    equipment: ['barbell', 'dumbbell'],
  };

  it('keeps the long-standing whole-kilogram rounding when there is no gym', () => {
    expect(roundToLoadable(82.6, 'barbell', null)).toBe(83);
    expect(roundToLoadable(82.4, 'dumbbell', undefined)).toBe(82);
  });

  it('snaps a barbell to what the plates can make', () => {
    expect(roundToLoadable(101.5, 'barbell', gym)).toBe(102.5);
    expect(roundToLoadable(101.5, 'smith_machine', gym)).toBe(102.5);
  });

  it('snaps everything else to the gym increment', () => {
    expect(roundToLoadable(13.7, 'dumbbell', gym)).toBe(12.5);
    expect(roundToLoadable(14, 'dumbbell', gym)).toBe(15);
    expect(roundToLoadable(17.4, 'cable', { ...gym, weightIncrementKg: 5 })).toBe(15);
  });

  it('falls back to the increment for a barbell in a gym with no plates', () => {
    expect(roundToLoadable(82, 'barbell', { ...gym, plates: [] })).toBe(82.5);
  });

  it('returns 0 for nothing to load', () => {
    expect(roundToLoadable(0, 'barbell', gym)).toBe(0);
    expect(roundToLoadable(-3, 'dumbbell', gym)).toBe(0);
    expect(roundToLoadable(Number.NaN, 'dumbbell', gym)).toBe(0);
  });
});
