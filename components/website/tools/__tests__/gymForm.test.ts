import { defaultGymSnapshot } from '@/utils/gym';
import { platesPerSide } from '@/utils/plateCalculator';

import {
  defaultGymForm,
  gymFromForm,
  parseStoredGymForm,
  parseStoredUnits,
  serializeGymForm,
} from '../gymForm';

describe('gymFromForm', () => {
  it.each(['metric', 'imperial'] as const)(
    'turns the default %s form into the app default gym',
    (units) => {
      const gym = gymFromForm(defaultGymForm(units), units)!;
      const expected = defaultGymSnapshot(units);
      expect(gym.barWeightKg).toBeCloseTo(expected.barWeightKg, 6);
      expect(gym.plates).toHaveLength(expected.plates.length);
      gym.plates.forEach((plate, index) => {
        expect(plate.weightKg).toBeCloseTo(expected.plates[index].weightKg, 6);
        expect(plate.count).toBe(expected.plates[index].count);
      });
    }
  );

  it('stores pairs as a plate count of twice the pairs and drops plates set to 0', () => {
    const form = defaultGymForm('metric');
    form.pairs['20'] = '0';
    form.pairs['15'] = '1';
    const gym = gymFromForm(form, 'metric')!;
    expect(gym.plates.find((plate) => plate.weightKg === 20)).toBeUndefined();
    expect(gym.plates.find((plate) => plate.weightKg === 15)?.count).toBe(2);
  });

  it('feeds the app plate maths: one pair each of 20, 15 and 10 makes 25 a side as 15 + 10', () => {
    const form = defaultGymForm('metric');
    form.pairs = { '25': '0', '20': '1', '15': '1', '10': '1', '5': '0', '2.5': '0', '1.25': '0' };
    const gym = gymFromForm(form, 'metric')!;
    const load = platesPerSide(70, gym);
    expect(load.platesPerSide).toEqual([
      { weightKg: 15, count: 1 },
      { weightKg: 10, count: 1 },
    ]);
  });

  it.each([
    ['empty bar', { barWeight: '' }],
    ['text bar', { barWeight: 'abc' }],
    ['huge bar', { barWeight: '500' }],
  ])('returns null for an unusable %s', (_label, patch) => {
    expect(gymFromForm({ ...defaultGymForm('metric'), ...patch }, 'metric')).toBeNull();
  });

  it('returns null for a fractional or empty pair count', () => {
    const fractional = defaultGymForm('metric');
    fractional.pairs['20'] = '1.5';
    expect(gymFromForm(fractional, 'metric')).toBeNull();
    const empty = defaultGymForm('metric');
    empty.pairs['20'] = '';
    expect(gymFromForm(empty, 'metric')).toBeNull();
  });

  it('allows a bar of 0', () => {
    expect(
      gymFromForm({ ...defaultGymForm('metric'), barWeight: '0' }, 'metric')?.barWeightKg
    ).toBe(0);
  });
});

describe('stored forms', () => {
  it('round-trips a form', () => {
    const form = defaultGymForm('imperial');
    expect(parseStoredGymForm(serializeGymForm(form), 'imperial')).toEqual(form);
  });

  it.each([null, '', 'not json', '[]', '{"barWeight":5}', '{"barWeight":"20","pairs":{}}'])(
    'ignores %j',
    (raw) => {
      expect(parseStoredGymForm(raw, 'metric')).toBeNull();
    }
  );

  it('ignores a form saved for the other unit system', () => {
    expect(parseStoredGymForm(serializeGymForm(defaultGymForm('imperial')), 'metric')).toBeNull();
  });

  it('reads only the two unit systems', () => {
    expect(parseStoredUnits('imperial')).toBe('imperial');
    expect(parseStoredUnits('kg')).toBeNull();
    expect(parseStoredUnits(null)).toBeNull();
  });
});
