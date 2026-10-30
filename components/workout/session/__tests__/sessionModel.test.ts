import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import {
  serializeProgressionRule,
  serializeSessionProgression,
} from '@/utils/progressionRuleSchema';
import { serializeSetPrescription } from '@/utils/setPrescription';

import { buildSessionBlocks, canRevertStartAdjustment, guidanceStateFor } from '../sessionModel';

const set = (fields: Partial<EnrichedWorkoutLogSet>): EnrichedWorkoutLogSet =>
  ({
    id: fields.id ?? 's',
    logExerciseId: 'le-1',
    exerciseId: 'bench',
    setOrder: 1,
    weight: 60,
    reps: 10,
    repsInReserve: 0,
    partials: 0,
    completionStatus: 'planned',
    setType: 'normal',
    isSkipped: false,
    ...fields,
  }) as EnrichedWorkoutLogSet;

describe('buildSessionBlocks', () => {
  it('numbers working sets within each exercise, not across the workout', () => {
    const blocks = buildSessionBlocks([
      set({ id: 'a1', setOrder: 1 }),
      set({ id: 'a2', setOrder: 2 }),
      set({ id: 'b0', setOrder: 3, logExerciseId: 'le-2', exerciseId: 'row', setType: 'warmup' }),
      set({ id: 'b1', setOrder: 4, logExerciseId: 'le-2', exerciseId: 'row' }),
    ]);
    expect(blocks.map((block) => block.rows.map((row) => row.workingNumber))).toEqual([
      [1, 2],
      [null, 1],
    ]);
    expect(blocks[1].workingCount).toBe(1);
  });

  it('focuses the first planned set and counts resolved ones', () => {
    const [block] = buildSessionBlocks([
      set({ id: 'a1', setOrder: 1, completionStatus: 'performed' }),
      set({ id: 'a2', setOrder: 2, completionStatus: 'skipped' }),
      set({ id: 'a3', setOrder: 3 }),
    ]);
    expect(block.focus.id).toBe('a3');
    expect(block.doneCount).toBe(2);
  });

  it('focuses the last set once every set is resolved', () => {
    const [block] = buildSessionBlocks([
      set({ id: 'a1', setOrder: 1, completionStatus: 'performed' }),
      set({ id: 'a2', setOrder: 2, completionStatus: 'performed' }),
    ]);
    expect(block.focus.id).toBe('a2');
  });
});

describe('guidanceStateFor', () => {
  const gym = {
    barWeightKg: 20,
    plates: [{ weightKg: 20, count: 4 }],
    weightIncrementKg: 2.5,
  } as never;
  const ruled = serializeProgressionRule({ type: 'double_progression', repMin: 8, repMax: 12 });

  it('says "Needs attention" when the target cannot be built on the gym bar', () => {
    const [block] = buildSessionBlocks([set({ weight: 63, progressionJson: ruled })]);
    expect(guidanceStateFor(block, { equipmentType: 'barbell', gym })).toBe('attention');
  });

  it('names the user’s own rule', () => {
    const [block] = buildSessionBlocks([set({ weight: 60, progressionJson: ruled })]);
    expect(guidanceStateFor(block, { equipmentType: 'barbell', gym: null })).toBe('rule');
  });

  it('is still learning a percentage rule that has no training max yet', () => {
    const rule = serializeProgressionRule({
      type: 'percentage',
      reps: 5,
      percentOfTrainingMax: 80,
      trainingMaxPercent: 90,
    });
    const [learning] = buildSessionBlocks([set({ progressionJson: rule })]);
    expect(guidanceStateFor(learning, { gym: null })).toBe('learning');

    const withTm = serializeSessionProgression(
      { type: 'percentage', reps: 5, percentOfTrainingMax: 80, trainingMaxPercent: 90 },
      { trainingMaxKg: 100 }
    );
    const [known] = buildSessionBlocks([set({ progressionJson: withTm })]);
    expect(guidanceStateFor(known, { gym: null })).toBe('rule');
  });

  it('separates a suggestion with history from one still learning', () => {
    const withHistory = serializeSetPrescription({
      plan: { weightKg: 60, reps: 10 },
      recommendation: { weightKg: 62.5, reps: 10 },
      previous: { weightKg: 60, reps: 10 },
    });
    const [suggested] = buildSessionBlocks([set({ prescriptionJson: withHistory })]);
    expect(guidanceStateFor(suggested, { gym: null })).toBe('suggested');
    const [fresh] = buildSessionBlocks([set({})]);
    expect(guidanceStateFor(fresh, { gym: null })).toBe('learning');
  });

  it('calls last time’s targets "same as last time", not a suggestion', () => {
    const unchanged = serializeSetPrescription({
      plan: { weightKg: 60, reps: 10 },
      recommendation: { weightKg: 60, reps: 10 },
      previous: { weightKg: 60, reps: 10 },
    });
    const [holding] = buildSessionBlocks([set({ prescriptionJson: unchanged })]);
    expect(guidanceStateFor(holding, { gym: null })).toBe('holding');
  });
});

describe('canRevertStartAdjustment', () => {
  const lighterWeek = serializeSetPrescription({
    established: true,
    plan: { weightKg: 0, reps: 10 },
    recommendation: { weightKg: 0, reps: 10 },
    planRepsInReserve: 1,
    droppedSetIds: ['gone'],
  });

  it('offers undo for a bodyweight lighter week that only removed a set', () => {
    const [block] = buildSessionBlocks([set({ id: 'a1', prescriptionJson: lighterWeek })]);
    expect(block.focus.adjustment).toBeUndefined();
    expect(canRevertStartAdjustment(block)).toBe(true);
  });

  it('offers nothing when no adjustment was made', () => {
    const [block] = buildSessionBlocks([set({ id: 'a1' })]);
    expect(canRevertStartAdjustment(block)).toBe(false);
  });
});
