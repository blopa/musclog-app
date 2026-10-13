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
  it('holds the load after one session that missed the bottom of the range', () => {
    const projection = project(defaultProgressionRule('double_progression'), [history([6, 7, 5])]);
    expect(projection.sets.map((s) => [s.weight, s.reps])).toEqual([
      [60, 8],
      [60, 8],
      [60, 8],
    ]);
    // The plan already is the hold target, so nothing is rewritten — and nothing deloaded.
    expect(projection.changes).toEqual([]);
  });
  it('deloads by a tenth of the load when two sessions in a row missed the bottom', () => {
    expect(
      project(defaultProgressionRule('double_progression'), [
        history([6, 7, 5]),
        history([7, 6, 6]),
      ]).sets[0]
      // 60 kg - max(2.5 kg step, 10% = 6 kg) = 54 kg, snapped to the 2.5 kg step. A single 2.5 kg
      // step clears nothing on a barbell.
    ).toMatchObject({ weight: 55, reps: 8 });
    // A miss at a different load does not count towards the stall.
    expect(
      project(defaultProgressionRule('double_progression'), [
        history([6, 7, 5]),
        history([7, 6, 6], 65),
      ]).sets[0]
    ).toMatchObject({ weight: 60, reps: 8 });
  });
  it('deloads a top set only after two misses at the same load', () => {
    const rule = defaultProgressionRule('top_set_backoff');
    expect(project(rule, [history([3, 8, 8])]).sets[0]).toMatchObject({ weight: 60, reps: 4 });
    expect(project(rule, [history([3, 8, 8]), history([3, 8, 8])]).sets[0]).toMatchObject({
      weight: 55,
      reps: 4,
    });
  });
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
  it('does not derive an automatic deload from missing RIR, and progresses on reps alone', () => {
    const projection = projectExerciseProgression({
      planned,
      history: [history([8, 8, 8])],
      step,
      automatic: true,
      rule: null,
      progressionMode: 'weight_first',
      isCompound: true,
      isBodyweight: false,
    });
    // Unrated effort never lowers the load; the reps themselves earn one more rep, with a reason
    // that does not claim a reps-in-reserve figure nobody recorded.
    expect(projection.sets.every((set) => set.weight === 60)).toBe(true);
    expect(projection.sets.map((set) => set.reps)).toEqual([9, 9, 9]);
    expect(projection.changes[0].adjustment).toMatchObject({
      cause: 'progression',
      rule: { kind: 'range', outcome: 'add_reps' },
    });
  });
  it('anchors automatic reps_first on the plan and deloads only after two failed sessions', () => {
    const rated = (weight: number, reps: number, rir: number): HistorySession => ({
      sets: [{ weightKg: weight, reps, repsInReserve: rir, rirRecorded: true }],
      allPrescribedSetsPerformed: true,
      rule: null,
      state: null,
    });
    const auto = (sessions: HistorySession[], extra: Record<string, unknown> = {}) =>
      projectExerciseProgression({
        planned: [{ id: '1', weight: 100, reps: 5 }],
        history: sessions,
        step,
        automatic: true,
        rule: null,
        progressionMode: 'reps_first',
        isCompound: true,
        isBodyweight: false,
        ...extra,
      }).sets[0];
    expect(auto([rated(100, 7, 3)])).toEqual({ id: '1', weight: 102.5, reps: 5 });
    // An exercise added mid-session copies its plan from history, so the generic range applies.
    expect(auto([rated(100, 7, 3)], { plannedFromHistory: true })).toEqual({
      id: '1',
      weight: 100,
      reps: 8,
    });
    expect(auto([rated(100, 5, 0)])).toEqual({ id: '1', weight: 100, reps: 5 });
    expect(auto([rated(100, 5, 0), rated(100, 5, 0)])).toEqual({
      id: '1',
      weight: 90,
      reps: 5,
    });
  });
  it('never progresses cardio, mobility or stretching, whichever caller projects it', () => {
    for (const mechanicType of ['cardio', 'mobility', 'stretching']) {
      const projection = projectExerciseProgression({
        planned,
        history: [history([12, 12, 12])],
        step,
        automatic: true,
        rule: defaultProgressionRule('double_progression'),
        progressionMode: 'weight_first',
        isCompound: false,
        isBodyweight: false,
        mechanicType,
      });
      expect(projection.changes).toEqual([]);
      expect(projection.sets).toEqual(planned);
    }
  });
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

it('automatic progression does not move up after a session with unperformed prescribed sets', () => {
  const planned3 = [0, 1, 2].map((i) => ({ id: String(i), weight: 60, reps: 8 }));
  const projection = projectExerciseProgression({
    planned: planned3,
    history: [
      {
        sets: [{ weightKg: 60, reps: 8, repsInReserve: 3, rirRecorded: true, prescribedIndex: 0 }],
        allPrescribedSetsPerformed: false,
        rule: null,
        state: null,
      },
    ],
    step,
    automatic: true,
    rule: null,
    progressionMode: 'reps_first',
    isCompound: true,
    isBodyweight: false,
  });
  expect(projection.sets.map((set) => set.reps)).toEqual([8, 8, 8]);
  expect(projection.changes.every((change) => change.adjustment.cause !== 'progression')).toBe(
    true
  );
});

describe('automatic progression stall detection', () => {
  const rated = (reps: number[], weight = 60): HistorySession => ({
    sets: reps.map((rep) => ({
      weightKg: weight,
      reps: rep,
      repsInReserve: 1,
      rirRecorded: true,
    })),
    allPrescribedSetsPerformed: true,
    rule: null,
    state: null,
  });
  const automatic = (sessions: HistorySession[]) =>
    projectExerciseProgression({
      planned,
      rule: null,
      history: sessions,
      step,
      automatic: true,
      progressionMode: 'weight_first',
      isCompound: true,
      isBodyweight: false,
    });

  it('repeats the load after one session that missed the planned reps', () => {
    expect(automatic([rated([6, 6, 6])]).sets[0]).toMatchObject({ weight: 60 });
  });

  it('deloads once the session before also missed the planned reps at the same load', () => {
    expect(automatic([rated([6, 6, 6]), rated([7, 6, 6])]).changes[0]?.adjustment.cause).toBe(
      'deload'
    );
  });

  it('does not count a miss at a different load as a stall', () => {
    expect(
      automatic([rated([6, 6, 6]), rated([6, 6, 6], 65)]).changes[0]?.adjustment.cause
    ).not.toBe('deload');
  });
});
