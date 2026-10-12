import {
  defaultProgressionRule,
  parseProgressionRule,
  planRuleChanges,
  resolveTrainingMax,
  serializeSessionProgression,
  type HistorySession,
  type ProgressionRule,
} from '../progressionRules';
import { projectExerciseProgression } from '../progressionProjection';
import { parseSetPrescription, serializeSetPrescription } from '../setPrescription';

const step = { incrementKg: 2.5, roundLoad: (kg: number) => Math.round(kg / 2.5) * 2.5 };
const planned = [1, 2, 3].map((n) => ({ id: String(n), weight: 60, reps: 8 }));
const history = (reps: number[], weight = 60, complete = true): HistorySession => ({
  sets: reps.map((reps) => ({ weightKg: weight, reps, repsInReserve: 0, rirRecorded: false })),
  allPrescribedSetsPerformed: complete,
  rule: null,
  state: null,
});
const project = (rule: ProgressionRule, sessions: HistorySession[] = []) =>
  projectExerciseProgression({
    planned,
    rule,
    history: sessions,
    step,
    automatic: false,
    progressionMode: 'weight_first',
    isCompound: true,
    isBodyweight: false,
  });

describe('explicit progression projections', () => {
  it('adds a rep to each corresponding set', () =>
    expect(
      project(defaultProgressionRule('double_progression'), [history([10, 9, 8])]).sets.map(
        (s) => s.reps
      )
    ).toEqual([11, 10, 9]));
  it('adds one load step and resets only after all prescribed sets reach the top', () => {
    expect(
      project(defaultProgressionRule('double_progression'), [history([12, 12, 12])]).sets[0]
    ).toMatchObject({ weight: 62.5, reps: 8 });
    expect(
      project(defaultProgressionRule('double_progression'), [history([12, 12], 60, false)]).sets[0]
        .weight
    ).toBe(60);
  });
  it('drops one step when none reaches the bottom', () =>
    expect(
      project(defaultProgressionRule('double_progression'), [history([6, 7, 5])]).sets[0]
    ).toMatchObject({ weight: 57.5, reps: 8 }));
  it('prescribes first-session reps and loadable back-offs without inventing evidence', () => {
    expect(project(defaultProgressionRule('linear')).sets[0]).toMatchObject({
      weight: 60,
      reps: 5,
    });
    expect(
      project(defaultProgressionRule('top_set_backoff')).sets.map((s) => [s.weight, s.reps])
    ).toEqual([
      [60, 4],
      [50, 8],
      [50, 8],
    ]);
  });
  it('counts misses at the same load and restarts the streak after a load change', () => {
    const rule = defaultProgressionRule('linear');
    expect(project(rule, [history([5, 5, 5])]).sets[0].weight).toBe(62.5);
    expect(
      project(rule, [history([4, 4, 4]), history([4, 4, 4]), history([4, 4, 4])]).sets[0].weight
    ).toBe(55);
    expect(
      project(rule, [history([4, 4, 4]), history([4, 4, 4], 65), history([4, 4, 4])]).sets[0].weight
    ).toBe(60);
    expect(project(rule, [history([5], 60, false)]).sets[0].weight).toBe(60);
  });
  it('progresses the top set independently of back-off reps', () =>
    expect(
      project(defaultProgressionRule('top_set_backoff'), [history([6, 8, 8])]).sets.map((s) => [
        s.weight,
        s.reps,
      ])
    ).toEqual([
      [62.5, 4],
      [52.5, 8],
      [52.5, 8],
    ]));
  it('persists a TM and advances it without estimating from submaximal work', () => {
    const rule = {
      ...defaultProgressionRule('percentage'),
      type: 'percentage' as const,
      reps: 5,
      percentOfTrainingMax: 80,
      trainingMaxPercent: 90,
      trainingMaxKg: 100,
    };
    const first = project(rule);
    expect(first.sets[0].weight).toBe(80);
    const past = { ...history([5, 5, 5], 80), rule, state: first.state };
    expect(resolveTrainingMax(rule, [past], step)?.trainingMaxKg).toBe(102.5);
    expect(
      resolveTrainingMax(rule, [{ ...past, allPrescribedSetsPerformed: false }], step)
        ?.trainingMaxKg
    ).toBe(100);
    expect(parseProgressionRule(serializeSessionProgression(rule, first.state))).toEqual(rule);
  });
  it('starts new carried state after a method or explicit TM reset', () => {
    const rule = {
      type: 'percentage' as const,
      reps: 5,
      percentOfTrainingMax: 80,
      trainingMaxPercent: 90,
      trainingMaxKg: 100,
      resetAt: 2,
    };
    const past = {
      ...history([5, 5, 5], 80),
      rule: { ...rule, resetAt: 1 },
      state: { trainingMaxKg: 120 },
    };
    expect(resolveTrainingMax(rule, [past], step)?.trainingMaxKg).toBe(100);
  });
  it('keeps automatic targets when guidance is disabled, while explicit rules still run', () => {
    const input = {
      planned,
      history: [history([12, 12, 12])],
      step,
      automatic: false,
      progressionMode: 'weight_first' as const,
      isCompound: true,
      isBodyweight: false,
    };
    expect(projectExerciseProgression({ ...input, rule: null }).sets).toEqual(planned);
    expect(
      projectExerciseProgression({ ...input, rule: defaultProgressionRule('double_progression') })
        .sets[0].weight
    ).toBe(62.5);
  });
  it('does not derive an automatic deload from missing RIR', () =>
    expect(
      projectExerciseProgression({
        planned,
        history: [history([8, 8, 8])],
        step,
        automatic: true,
        rule: null,
        progressionMode: 'weight_first',
        isCompound: true,
        isBodyweight: false,
      }).sets
    ).toEqual(planned));
  it('retains original targets and undo across serialization', () => {
    const prescription = {
      established: true,
      plan: { weightKg: 60, reps: 8 },
      recommendation: { weightKg: 62.5, reps: 8 },
      override: 'plan' as const,
    };
    expect(parseSetPrescription(serializeSetPrescription(prescription))).toEqual(prescription);
  });
  it('rejects invalid imported rules and prescriptions', () => {
    expect(parseProgressionRule('{"type":"linear","reps":0}')).toBeNull();
    expect(parseSetPrescription('{"plan":{}}')).toBeNull();
    expect(
      planRuleChanges(defaultProgressionRule('percentage'), planned, [], step).state
    ).toBeNull();
  });
});
