import { buildCycleHistory } from '../cycleHistory';
import { computeInsights, isNearPeriodStart, MIN_INSIGHT_CYCLES } from '../cycleInsights';
import type { CyclePeriodInput } from '../types';

const day = (n: number) => new Date(2024, 0, 1 + n).getTime();
const period = (n: number, dur = 5): CyclePeriodInput => ({
  startDate: day(n),
  endDate: day(n + dur - 1),
  endKind: 'logged',
});
const periods = [period(0), period(28), period(56), period(84)];
const history = (p = periods) => buildCycleHistory(p);
const symptomLog = (n: number, key: string) => ({
  date: day(n),
  symptoms: [{ key, severity: 2 as const }],
  pain: null,
  noSymptoms: false,
});

describe('computeInsights', () => {
  it('produces nothing from fewer than three cycles', () => {
    const two = [period(0), period(28)];
    expect(
      computeInsights({
        periods: two,
        history: history(two),
        dayLogs: [symptomLog(0, 'cramps'), symptomLog(28, 'cramps')],
      })
    ).toEqual([]);
    expect(MIN_INSIGHT_CYCLES).toBe(3);
  });

  it('reports a symptom near the start of most cycles, with the days behind it', () => {
    const logs = [
      symptomLog(0, 'cramps'),
      symptomLog(28, 'cramps'),
      symptomLog(57, 'cramps'),
      symptomLog(84, 'acne'),
    ];
    const insights = computeInsights({ periods, history: history(), dayLogs: logs });
    const cramps = insights.find((i) => i.id === 'symptom:cramps')!;
    expect(cramps.params).toMatchObject({ hits: 3, total: 4, symptom: 'cramps' });
    expect(cramps.evidence.days).toEqual([day(0), day(28), day(57)]);
  });

  it('does not count a cycle with nothing logged as a miss', () => {
    const logs = [symptomLog(0, 'cramps'), symptomLog(28, 'cramps'), symptomLog(56, 'cramps')];
    const insight = computeInsights({ periods, history: history(), dayLogs: logs }).find(
      (i) => i.id === 'symptom:cramps'
    )!;
    expect(insight.params).toMatchObject({ hits: 3, total: 3 });
  });

  it('stays quiet when the symptom is not frequent enough', () => {
    const logs = [
      symptomLog(0, 'cramps'),
      symptomLog(28, 'acne'),
      symptomLog(56, 'acne'),
      symptomLog(84, 'acne'),
    ];
    expect(
      computeInsights({ periods, history: history(), dayLogs: logs }).some(
        (i) => i.id === 'symptom:cramps'
      )
    ).toBe(false);
  });

  it('flags a cycle much longer than the person usually has', () => {
    const p = [period(0), period(28), period(56), period(84), period(130)];
    const insight = computeInsights({ periods: p, history: history(p), dayLogs: [] }).find(
      (i) => i.kind === 'cycle_length'
    )!;
    expect(insight.params).toMatchObject({ length: 46, typical: 28, direction: 'longer' });
  });

  it('flags workouts that were lighter near the start of most periods, with their ids', () => {
    const workouts = periods.flatMap((p, i) => [
      { id: `near${i}`, date: p.startDate, volume: 500 },
      { id: `a${i}`, date: p.startDate + 8 * 86_400_000, volume: 1000 },
      { id: `b${i}`, date: p.startDate + 12 * 86_400_000, volume: 1100 },
      { id: `c${i}`, date: p.startDate + 16 * 86_400_000, volume: 1000 },
    ]);
    const insight = computeInsights({ periods, history: history(), dayLogs: [], workouts }).find(
      (i) => i.kind === 'workout_near_start'
    )!;
    expect(insight.params).toMatchObject({ hits: 4, total: 4 });
    expect(insight.evidence.workoutIds).toEqual(['near0', 'near1', 'near2', 'near3']);
  });

  it('does not flag workouts that were not lighter', () => {
    const workouts = periods.flatMap((p, i) => [
      { id: `near${i}`, date: p.startDate, volume: 1000 },
      { id: `a${i}`, date: p.startDate + 8 * 86_400_000, volume: 1000 },
      { id: `b${i}`, date: p.startDate + 12 * 86_400_000, volume: 1000 },
      { id: `c${i}`, date: p.startDate + 16 * 86_400_000, volume: 1000 },
    ]);
    expect(
      computeInsights({ periods, history: history(), dayLogs: [], workouts }).some(
        (i) => i.kind === 'workout_near_start'
      )
    ).toBe(false);
  });
});

describe('isNearPeriodStart', () => {
  it('is true within two days of a logged or predicted start, and false otherwise', () => {
    expect(isNearPeriodStart([day(10)], null, day(11))).toBe(true);
    expect(isNearPeriodStart([day(10)], null, day(13))).toBe(false);
    expect(isNearPeriodStart([day(10)], day(30), day(29))).toBe(true);
    expect(isNearPeriodStart([], null, day(1))).toBe(false);
  });
});

it('finds symptoms a week before bleeding using recorded periods, not predicted phases', () => {
  const logs = [symptomLog(23, 'migraine'), symptomLog(51, 'migraine'), symptomLog(79, 'migraine')];
  const insight = computeInsights({ periods, history: history(), dayLogs: logs }).find(
    (i) => i.kind === 'recurring_preperiod_symptom'
  );
  expect(insight?.params).toMatchObject({ symptom: 'migraine', hits: 3, total: 3 });
  expect(insight?.evidence.days).toEqual([day(23), day(51), day(79)]);
  expect(
    computeInsights({ periods, history: history(), dayLogs: logs.slice(1) }).some(
      (i) => i.kind === 'recurring_preperiod_symptom'
    )
  ).toBe(false);
});

it('finds personal sleep and energy differences only with sufficient recorded comparisons', () => {
  const logs = [0, 28, 56].flatMap((start) => [
    { ...symptomLog(start, 'fatigue'), energy: 1, observations: { sleepHours: 6 } },
    ...[5, 6, 7].map((offset) => ({
      ...symptomLog(start + offset, 'fatigue'),
      energy: 4,
      observations: { sleepHours: 8 },
    })),
  ]);
  const insights = computeInsights({ periods, history: history(), dayLogs: logs });
  expect(insights.find((i) => i.kind === 'energy_near_start')?.params).toEqual({
    hits: 3,
    total: 3,
  });
  expect(insights.find((i) => i.kind === 'sleep_near_start')?.evidence.days).toContain(day(7));
  expect(
    computeInsights({ periods, history: history(), dayLogs: logs.slice(0, 8) }).some(
      (i) => i.kind === 'sleep_near_start'
    )
  ).toBe(false);
});
