import type { StartSetAdjustment } from '@/utils/setAdjustment';

import {
  START_ADJUSTMENT_MESSAGE_KEYS,
  startAdjustmentMessageKey,
} from '../startAdjustmentMessage';

const adjustment = (overrides: Partial<StartSetAdjustment>): StartSetAdjustment => ({
  cause: 'progression',
  field: 'weight',
  from: 60,
  to: 65,
  plan: { weightKg: 60, reps: 8 },
  last: { weightKg: 62, reps: 8, averageRepsInReserve: 4 },
  now: { weightKg: 65, reps: 8 },
  ...overrides,
});

describe('startAdjustmentMessageKey', () => {
  it('words a load-only progression, a reps-only progression and a combined one differently', () => {
    expect(startAdjustmentMessageKey(adjustment({}))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.progressionWeight
    );
    expect(
      startAdjustmentMessageKey(adjustment({ field: 'reps', now: { weightKg: 60, reps: 9 } }))
    ).toBe(START_ADJUSTMENT_MESSAGE_KEYS.progressionReps);
    // The top of a reps-first range: more load AND the reps start over.
    expect(startAdjustmentMessageKey(adjustment({ now: { weightKg: 65, reps: 6 } }))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.progressionWeightReps
    );
  });

  // The regression: a plan of 8 reps, last time 10, deloaded in weight. The reps card was marked
  // "adjusted" (10 ≠ the plan's 8) beside a sentence that only talked about weight.
  it('mentions the reps whenever they moved relative to the plan, for every cause', () => {
    const repsMoved = { now: { weightKg: 65, reps: 10 } };
    expect(startAdjustmentMessageKey(adjustment({ cause: 'deload', ...repsMoved }))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.deloadWeightReps
    );
    expect(startAdjustmentMessageKey(adjustment({ cause: 'repeat', ...repsMoved }))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.repeatWeightReps
    );
    expect(startAdjustmentMessageKey(adjustment({ cause: 'progression', ...repsMoved }))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.progressionWeightReps
    );
  });

  it('keeps the shorter sentence when only the weight moved', () => {
    expect(startAdjustmentMessageKey(adjustment({ cause: 'deload' }))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.deload
    );
    expect(startAdjustmentMessageKey(adjustment({ cause: 'repeat' }))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.repeatWeight
    );
  });

  it('words a repeat by what it replaced in the plan', () => {
    expect(startAdjustmentMessageKey(adjustment({ cause: 'repeat', field: 'reps' }))).toBe(
      START_ADJUSTMENT_MESSAGE_KEYS.repeatReps
    );
  });

  it('falls back to the reps sentence for a deload that rounded back onto the plan weight', () => {
    expect(
      startAdjustmentMessageKey(
        adjustment({ cause: 'deload', field: 'reps', now: { weightKg: 60, reps: 10 } })
      )
    ).toBe(START_ADJUSTMENT_MESSAGE_KEYS.repeatReps);
  });

  it('agrees with the marker: a sentence mentions reps exactly when adjustedFields marks them', () => {
    const { adjustedFields } = require('@/utils/setAdjustment');
    const repsKeys: string[] = [
      START_ADJUSTMENT_MESSAGE_KEYS.progressionWeightReps,
      START_ADJUSTMENT_MESSAGE_KEYS.progressionReps,
      START_ADJUSTMENT_MESSAGE_KEYS.deloadWeightReps,
      START_ADJUSTMENT_MESSAGE_KEYS.repeatWeightReps,
      START_ADJUSTMENT_MESSAGE_KEYS.repeatReps,
    ];
    for (const cause of ['progression', 'deload', 'repeat'] as const) {
      for (const field of ['weight', 'reps'] as const) {
        for (const reps of [8, 10]) {
          const a = adjustment({
            cause,
            field,
            now: { weightKg: field === 'weight' ? 65 : 60, reps },
          });
          if (!adjustedFields(a).weight && !adjustedFields(a).reps) continue;
          expect(repsKeys.includes(startAdjustmentMessageKey(a))).toBe(adjustedFields(a).reps);
        }
      }
    }
  });

  it('only ever returns keys the locale files define', () => {
    // Loaded from the real English file: a renamed or removed key would fail here, not in the app.
    const en = require('../../../lang/locales/en-us/workoutSession.json').workoutSession.adjustment;
    for (const key of Object.values(START_ADJUSTMENT_MESSAGE_KEYS)) {
      const leaf = key.replace('workoutSession.adjustment.', '');
      expect(en[leaf]).toEqual(expect.any(String));
    }
  });
});
