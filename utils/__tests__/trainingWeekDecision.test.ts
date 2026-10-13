import {
  isDecisionLive,
  parseTrainingDecisionSnapshot,
  serializeTrainingDecisionSnapshot,
  type TrainingDecisionSnapshot,
} from '@/utils/trainingWeekDecision';

const snapshot: TrainingDecisionSnapshot = {
  decision: 'lighter',
  recommended: 'progress',
  reasons: [{ code: 'repeatedDeloads', count: 2 }],
  goals: [
    { kind: 'consistency', goalId: 'g1', target: 4, done: 3, status: 'missed' },
    {
      kind: '1rm',
      goalId: 'g2',
      exerciseId: 'e1',
      exerciseName: 'Bench Press',
      status: 'behind',
      projectedDate: 1_800_000_000_000,
    },
  ],
  window: { from: 1000, until: 5000 },
};

describe('training decision snapshot', () => {
  it('round-trips', () => {
    expect(parseTrainingDecisionSnapshot(serializeTrainingDecisionSnapshot(snapshot))).toEqual(
      snapshot
    );
  });

  it.each([
    ['empty', undefined],
    ['not json', '{nope'],
    ['unknown decision', JSON.stringify({ ...snapshot, decision: 'skip' })],
    ['missing window', JSON.stringify({ ...snapshot, window: undefined })],
    ['inverted window', JSON.stringify({ ...snapshot, window: { from: 5, until: 5 } })],
  ])('treats %s as no decision', (_label, raw) => {
    expect(parseTrainingDecisionSnapshot(raw)).toBeNull();
  });

  it('drops an unreadable verdict or reason without losing the decision', () => {
    const parsed = parseTrainingDecisionSnapshot(
      JSON.stringify({
        ...snapshot,
        goals: [snapshot.goals[0], { kind: '1rm', goalId: 'x' }],
        reasons: [{ code: 'nonsense' }, { code: 'noWorkouts' }],
      })
    );
    expect(parsed?.decision).toBe('lighter');
    expect(parsed?.goals).toEqual([snapshot.goals[0]]);
    expect(parsed?.reasons).toEqual([{ code: 'noWorkouts' }]);
  });

  it('is live only inside its window', () => {
    expect(isDecisionLive(snapshot, 999)).toBe(false);
    expect(isDecisionLive(snapshot, 1000)).toBe(true);
    expect(isDecisionLive(snapshot, 4999)).toBe(true);
    expect(isDecisionLive(snapshot, 5000)).toBe(false);
  });
});
