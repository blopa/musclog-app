import {
  defaultBarWeightKg,
  defaultPlates,
  defaultWeightIncrementKg,
  isEquipmentAvailable,
  parseEquipment,
  parsePlates,
  serializeEquipment,
  serializePlates,
  snapshotFromGymRow,
} from '../gym';
import { kgToDisplay } from '../unitConversion';

describe('parsePlates', () => {
  it('keeps valid plates, heaviest first', () => {
    expect(
      parsePlates(
        JSON.stringify([
          { weightKg: 5, count: 4 },
          { weightKg: 20, count: 6 },
        ])
      )
    ).toEqual([
      { weightKg: 20, count: 6 },
      { weightKg: 5, count: 4 },
    ]);
  });

  it('drops anything that is not a usable plate instead of throwing', () => {
    expect(
      parsePlates(
        JSON.stringify([
          { weightKg: -5, count: 2 },
          { weightKg: 0, count: 2 },
          { weightKg: 10, count: 0 },
          { weightKg: 'heavy', count: 2 },
          { weightKg: 10 },
          null,
          { weightKg: 15, count: 2.9 },
        ])
      )
    ).toEqual([{ weightKg: 15, count: 2 }]);
  });

  it('merges duplicate weights', () => {
    expect(
      parsePlates(
        JSON.stringify([
          { weightKg: 10, count: 2 },
          { weightKg: 10, count: 4 },
        ])
      )
    ).toEqual([{ weightKg: 10, count: 6 }]);
  });

  it.each([null, undefined, '', 'not json', '{}', '"x"', '42'])('returns [] for %p', (raw) => {
    expect(parsePlates(raw as string)).toEqual([]);
  });
});

describe('parseEquipment', () => {
  it('keeps known equipment once and ignores the rest', () => {
    expect(parseEquipment(JSON.stringify(['barbell', 'barbell', 'jetpack', 7, 'cable']))).toEqual([
      'barbell',
      'cable',
    ]);
    expect(parseEquipment('garbage')).toEqual([]);
  });

  it('round-trips through serialize', () => {
    expect(parseEquipment(serializeEquipment(['dumbbell', 'cable']))).toEqual([
      'dumbbell',
      'cable',
    ]);
    expect(parsePlates(serializePlates([{ weightKg: 2.5, count: 4 }]))).toEqual([
      { weightKg: 2.5, count: 4 },
    ]);
  });
});

describe('snapshotFromGymRow', () => {
  const row = {
    id: 'g1',
    name: 'Home',
    barWeightKg: 15,
    platesJson: JSON.stringify([{ weightKg: 10, count: 4 }]),
    weightIncrementKg: 1,
    equipmentJson: JSON.stringify(['barbell']),
    weightUnit: 'lbs',
  };

  it('parses a row', () => {
    expect(snapshotFromGymRow(row)).toEqual({
      id: 'g1',
      name: 'Home',
      barWeightKg: 15,
      plates: [{ weightKg: 10, count: 4 }],
      weightIncrementKg: 1,
      equipment: ['barbell'],
      weightUnit: 'lbs',
    });
  });

  it('falls back to defaults for unusable numbers and units', () => {
    const snapshot = snapshotFromGymRow({
      ...row,
      barWeightKg: Number.NaN,
      weightIncrementKg: 0,
      weightUnit: 'stone',
    });
    expect(snapshot.barWeightKg).toBe(20);
    expect(snapshot.weightIncrementKg).toBe(2.5);
    expect(snapshot.weightUnit).toBeUndefined();
  });

  it('allows a bar of zero', () => {
    expect(snapshotFromGymRow({ ...row, barWeightKg: 0 }).barWeightKg).toBe(0);
  });
});

describe('isEquipmentAvailable', () => {
  const gym = { equipment: ['barbell', 'dumbbell'] as const } as any;

  it('restricts nothing without a gym', () => {
    expect(isEquipmentAvailable('cable', null)).toBe(true);
    expect(isEquipmentAvailable('cable', undefined)).toBe(true);
  });

  it('checks the gym equipment, but bodyweight and other need nothing', () => {
    expect(isEquipmentAvailable('barbell', gym)).toBe(true);
    expect(isEquipmentAvailable('cable', gym)).toBe(false);
    expect(isEquipmentAvailable('bodyweight', gym)).toBe(true);
    expect(isEquipmentAvailable('other', gym)).toBe(true);
  });
});

describe('defaults', () => {
  it('uses kilogram plates and a 20 kg bar for metric users', () => {
    expect(defaultBarWeightKg('metric')).toBe(20);
    expect(defaultWeightIncrementKg('metric')).toBe(2.5);
    expect(defaultPlates('metric').map((plate) => plate.weightKg)).toEqual([
      25, 20, 15, 10, 5, 2.5, 1.25,
    ]);
  });

  it('uses pound plates and the 45 lb bar for imperial users', () => {
    expect(kgToDisplay(defaultBarWeightKg('imperial'), 'imperial')).toBeCloseTo(45, 2);
    expect(kgToDisplay(defaultWeightIncrementKg('imperial'), 'imperial')).toBeCloseTo(5, 2);
    expect(
      defaultPlates('imperial').map((plate) => Math.round(kgToDisplay(plate.weightKg, 'imperial')))
    ).toEqual([45, 35, 25, 10, 5, 3]);
  });
});
