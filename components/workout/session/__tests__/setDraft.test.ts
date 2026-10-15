import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';

import {
  draftFromSet,
  linkEffortPatch,
  liveWeightKg,
  reconcileWeightDraft,
  setDraftProblem,
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

describe('setDraftProblem', () => {
  const draft = (weight: string, reps: string) => ({ weight, reps });

  it('accepts a set that can be saved as typed, bodyweight (0) included', () => {
    expect(setDraftProblem(draft('62.5', '8'), 'en-US')).toBeNull();
    expect(setDraftProblem(draft('62,5', '8'), 'nl-NL')).toBeNull();
    expect(setDraftProblem(draft('0', '12'), 'en-US')).toBeNull();
  });

  it('refuses an emptied reps field instead of saving a performed set of 0 reps', () => {
    expect(setDraftProblem(draft('60', ''), 'en-US')).toBe('reps');
    expect(setDraftProblem(draft('60', '  '), 'en-US')).toBe('reps');
    // Number('') is 0: this is exactly what used to reach the writer.
    expect(valuesFromDraft(draft('60', ''), 'metric', 'en-US', false).reps).toBe(0);
  });

  it('refuses zero, fractional and absurd reps: a set not done is skipped, not completed', () => {
    expect(setDraftProblem(draft('60', '0'), 'en-US')).toBe('reps');
    expect(setDraftProblem(draft('60', '8.5'), 'en-US')).toBe('reps');
    expect(setDraftProblem(draft('60', '1000'), 'en-US')).toBe('reps');
  });

  it('names the weight when it is empty, unreadable or negative', () => {
    expect(setDraftProblem(draft('', '8'), 'en-US')).toBe('weight');
    expect(setDraftProblem(draft('abc', '8'), 'en-US')).toBe('weight');
    expect(setDraftProblem(draft('-5', '8'), 'en-US')).toBe('weight');
    // Dutch writes 62,5; the lenient parser reads "62.5" there as 625, so it must not pass.
    expect(setDraftProblem(draft('62.5', '8'), 'nl-NL')).toBe('weight');
  });
});

describe('linkEffortPatch', () => {
  it('fills RPE from reps in reserve and back, so the two can never disagree', () => {
    expect(linkEffortPatch({ rir: '2' }, 'en-US')).toEqual({ rir: '2', rpe: '8' });
    expect(linkEffortPatch({ rpe: '8.5' }, 'en-US')).toEqual({ rpe: '8.5', rir: '1.5' });
    expect(linkEffortPatch({ rpe: '8,5' }, 'nl-NL')).toEqual({ rpe: '8,5', rir: '1,5' });
    expect(linkEffortPatch({ rir: '0' }, 'en-US')).toEqual({ rir: '0', rpe: '10' });
  });

  it('clears both when either is cleared: unrated, never half-rated', () => {
    expect(linkEffortPatch({ rir: '' }, 'en-US')).toEqual({ rir: '', rpe: '' });
    expect(linkEffortPatch({ rpe: '' }, 'en-US')).toEqual({ rpe: '', rir: '' });
  });

  it('leaves a value still being typed, and unrelated patches, alone', () => {
    expect(linkEffortPatch({ rpe: '1.' }, 'de-DE')).toEqual({ rpe: '1.' });
    expect(linkEffortPatch({ rpe: '12' }, 'en-US')).toEqual({ rpe: '12' });
    expect(linkEffortPatch({ weight: '60' }, 'en-US')).toEqual({ weight: '60' });
  });
});

describe('effort recorded as RPE alone', () => {
  it('still rates the set for progression, which runs on reps in reserve', () => {
    const values = valuesFromDraft({ weight: '60', reps: '8', rpe: '8' }, 'metric', 'en-US', false);
    expect(values).toMatchObject({ difficultyLevel: 8, repsInReserve: 2 });
  });

  it('prefers reps in reserve when both are present', () => {
    const values = valuesFromDraft(
      { weight: '60', reps: '8', rir: '1', rpe: '8' },
      'metric',
      'en-US',
      false
    );
    expect(values.repsInReserve).toBe(1);
  });
});

describe('liveWeightKg with a stamped draft', () => {
  it('reads the draft in the unit it was typed in after the user switches units', () => {
    const typed = {
      weight: '100',
      reps: '8',
      weightUnits: 'metric' as const,
      weightLocale: 'en-US',
    };
    expect(liveWeightKg(set(), typed, 'imperial', 'en-US')).toBe(100);
  });
});
