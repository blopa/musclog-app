import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';

import {
  draftFromSet,
  liveWeightKg,
  reconcileWeightDraft,
  stampWeightPatch,
  stepInput,
  valuesFromDraft,
} from '../setDraft';

const set = (fields: Partial<EnrichedWorkoutLogSet> = {}) =>
  ({
    id: 's',
    weight: 62.5,
    reps: 8,
    repsInReserve: 0,
    partials: 0,
    completionStatus: 'planned',
    ...fields,
  }) as EnrichedWorkoutLogSet;

describe('draftFromSet', () => {
  it('shows the set in the locale’s decimal separator and the exercise’s unit', () => {
    expect(draftFromSet(set(), 'metric', 'nl-NL').weight).toBe('62,5');
    expect(draftFromSet(set(), 'metric', 'en-US').weight).toBe('62.5');
    expect(draftFromSet(set({ weight: 100 }), 'imperial', 'en-US').weight).toBe('220.5');
  });

  it('leaves effort empty for an unrated set rather than showing a 0 that reads as failure', () => {
    expect(draftFromSet(set({ rirRecorded: false }), 'metric', 'en-US').rir).toBe('');
    expect(draftFromSet(set({ rirRecorded: true, repsInReserve: 0 }), 'metric', 'en-US').rir).toBe(
      '0'
    );
    // Legacy performed sets carry no flag; their stored value is shown as it always was.
    expect(
      draftFromSet(set({ completionStatus: 'performed', repsInReserve: 2 }), 'metric', 'en-US').rir
    ).toBe('2');
  });
});

describe('valuesFromDraft', () => {
  it('parses comma decimals and stores kilograms', () => {
    const values = valuesFromDraft(
      { weight: '62,5', reps: '8', rir: '', rpe: '', partials: '0' },
      'metric',
      'nl-NL',
      true
    );
    expect(values).toMatchObject({ weight: 62.5, reps: 8, manual: true });
    expect(values.repsInReserve).toBeUndefined();
  });

  it('converts pounds back to kilograms', () => {
    const { weight } = valuesFromDraft({ weight: '135', reps: '5' }, 'imperial', 'en-US', false);
    expect(weight).toBeCloseTo(61.235, 2);
  });

  it('keeps a deliberate zero RIR as a rating', () => {
    expect(
      valuesFromDraft({ weight: '60', reps: '5', rir: '0' }, 'metric', 'en-US', false).repsInReserve
    ).toBe(0);
  });
});

describe('stepInput', () => {
  it('steps without floating-point noise and never below zero', () => {
    expect(stepInput('62.5', 2.5, 'en-US', 1)).toBe('65');
    expect(stepInput('0.1', 0.2, 'en-US', 1)).toBe('0.3');
    expect(stepInput('1', -2.5, 'en-US', 1)).toBe('0');
    expect(stepInput('', 1, 'en-US', 0)).toBe('1');
  });

  it('reads and writes the locale’s separator', () => {
    expect(stepInput('62,5', 1.25, 'nl-NL', 2)).toBe('63,75');
  });
});

describe('liveWeightKg', () => {
  it('prefers the typed draft over the saved weight, in the exercise’s unit and locale', () => {
    expect(liveWeightKg(set({ weight: 62.5 }), { weight: '80' }, 'metric', 'en-US')).toBe(80);
    expect(liveWeightKg(set({ weight: 62.5 }), { weight: '72,5' }, 'metric', 'nl-NL')).toBe(72.5);
    expect(liveWeightKg(set({ weight: 62.5 }), { weight: '100' }, 'imperial', 'en-US')).toBeCloseTo(
      45.36,
      1
    );
  });

  it('falls back to the saved weight without a draft or with an unparseable one', () => {
    expect(liveWeightKg(set({ weight: 62.5 }), undefined, 'metric', 'en-US')).toBe(62.5);
    expect(liveWeightKg(set({ weight: 62.5 }), { reps: '5' }, 'metric', 'en-US')).toBe(62.5);
    expect(liveWeightKg(set({ weight: 62.5 }), { weight: '' }, 'metric', 'en-US')).toBe(62.5);
  });
});

describe('typed weights across a unit switch', () => {
  it('stamps only patches that carry a weight', () => {
    expect(stampWeightPatch({ reps: '8' }, 'metric', 'en-US')).toEqual({ reps: '8' });
    expect(stampWeightPatch({ weight: '105' }, 'metric', 'en-US')).toEqual({
      weight: '105',
      weightUnits: 'metric',
      weightLocale: 'en-US',
    });
  });

  it('keeps a typed 105 kg at 105 kg after switching to imperial', () => {
    const draft = {
      weight: '105',
      reps: '5',
      weightUnits: 'metric',
      weightLocale: 'en-US',
    } as const;
    const patch = reconcileWeightDraft(draft, 'imperial', 'en-US')!;

    expect(patch.weight).toBe('231.5');
    expect(valuesFromDraft({ ...draft, ...patch }, 'imperial', 'en-US', true).weight).toBeCloseTo(
      105,
      0
    );
  });

  it('re-reads the decimal separator when only the locale changes', () => {
    const draft = {
      weight: '62,5',
      reps: '5',
      weightUnits: 'metric',
      weightLocale: 'nl-NL',
    } as const;
    expect(reconcileWeightDraft(draft, 'metric', 'en-US')?.weight).toBe('62.5');
  });

  it('leaves current and unstamped drafts alone', () => {
    expect(
      reconcileWeightDraft(
        { weight: '60', weightUnits: 'metric', weightLocale: 'en-US' },
        'metric',
        'en-US'
      )
    ).toBeNull();
    expect(reconcileWeightDraft({ weight: '60' }, 'imperial', 'en-US')).toBeNull();
  });
});
