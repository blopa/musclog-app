import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { buildCycleHistory } from '../cycleHistory';
import { computePredictionStats } from '../cycleStats';
import { buildPhaseSegments, computeCycleTimeline, phaseAtDay } from '../cycleTimeline';
import type { CyclePeriodInput } from '../types';

const D = MS_PER_SOLAR_DAY;
const BASE = Date.UTC(2024, 0, 1);
const day = (n: number) => BASE + n * D;
const periodsAt = (...starts: number[]): CyclePeriodInput[] =>
  starts.map((s) => ({ startDate: day(s), endDate: day(s + 4), endKind: 'logged' }));

describe('buildCycleHistory', () => {
  it('keeps long cycles visible instead of dropping them', () => {
    const history = buildCycleHistory(periodsAt(0, 70, 140, 210, 280));
    expect(history.filter((e) => e.lengthDays === 70)).toHaveLength(4);
    expect(history.filter((e) => e.status === 'used')).toHaveLength(4);
  });

  it('flags a too-short interval and a possibly missed period with reasons', () => {
    const history = buildCycleHistory(periodsAt(0, 28, 40, 68, 96, 152, 180));
    const byStart = (n: number) => history.find((e) => e.start === day(n))!;
    expect(byStart(28)).toMatchObject({ status: 'excluded', reason: 'too_short' });
    expect(byStart(96)).toMatchObject({ status: 'excluded', reason: 'possible_missed_period' });
    expect(byStart(0).status).toBe('used');
    expect(byStart(180).status).toBe('in_progress');
  });

  it('does not flag long cycles without other cycles to compare against', () => {
    const history = buildCycleHistory(periodsAt(0, 55, 112));
    expect(history.filter((e) => e.status === 'excluded')).toHaveLength(0);
  });

  it('honours a user exclusion', () => {
    const periods = periodsAt(0, 28, 56);
    periods[0].excludedFromStats = true;
    expect(buildCycleHistory(periods)[0]).toMatchObject({
      status: 'excluded',
      reason: 'user_excluded',
    });
  });

  it('does not count estimated or unknown ends as known durations', () => {
    const periods: CyclePeriodInput[] = [
      { startDate: day(0), endDate: day(4), endKind: 'estimated' },
      { startDate: day(28), endDate: null, endKind: 'unknown' },
    ];
    expect(buildCycleHistory(periods).map((e) => e.durationKnown)).toEqual([false, false]);
  });
});

describe('computePredictionStats', () => {
  it('has no confidence without periods', () => {
    expect(computePredictionStats([]).confidence).toBe('none');
  });

  it('does not report high confidence for four starts 70 days apart', () => {
    const stats = computePredictionStats(buildCycleHistory(periodsAt(0, 70, 140, 210)));
    expect(stats.medianLength).toBe(70);
    expect(stats.usableCount).toBe(3);
    expect(stats.confidence).not.toBe('high');
  });

  it('reaches high confidence with enough regular cycles', () => {
    const stats = computePredictionStats(buildCycleHistory(periodsAt(0, 28, 56, 85, 113, 141)));
    expect(stats.confidence).toBe('high');
    expect(stats.variability).toBe('regular');
  });

  it('lowers confidence as cycles vary', () => {
    const variable = computePredictionStats(buildCycleHistory(periodsAt(0, 24, 58, 86, 120, 144)));
    expect(variable.variability).toBe('variable');
    expect(variable.confidence).toBe('moderate');
    const wild = computePredictionStats(buildCycleHistory(periodsAt(0, 24, 64, 92, 137, 167)));
    expect(wild.variability).toBe('highly_variable');
    expect(wild.confidence).toBe('low');
  });

  it('averages only logged durations and reports what it used', () => {
    const stats = computePredictionStats(buildCycleHistory(periodsAt(0, 28, 56)), {
      avgPeriodDuration: 7,
    });
    expect(stats.avgPeriodDuration).toBe(5);
    expect(stats.basis).toMatchObject({ used: 2, excluded: 0 });
  });

  it('falls back to the configured length with a single period', () => {
    const stats = computePredictionStats(buildCycleHistory(periodsAt(0)), { avgCycleLength: 32 });
    expect(stats.medianLength).toBe(32);
    expect(stats.confidence).toBe('low');
  });
});

describe('computeCycleTimeline', () => {
  const periods = periodsAt(0, 28, 56);
  const stats = computePredictionStats(buildCycleHistory(periods));

  it('counts elapsed days without wrapping when no new period is logged', () => {
    const tl = computeCycleTimeline(periods, stats, { today: day(56 + 40) });
    expect(tl.elapsedDay).toBe(41);
    expect(tl.prediction.state).toBe('late');
    expect(tl.prediction.daysLate).toBeGreaterThan(0);
    expect(tl.segments).toBeNull();
    expect(tl.currentPhase).toBeNull();
    expect(tl.fertileEstimate).toBeNull();
  });

  it('moves from upcoming to window as the period approaches', () => {
    expect(computeCycleTimeline(periods, stats, { today: day(60) }).prediction.state).toBe(
      'upcoming'
    );
    expect(computeCycleTimeline(periods, stats, { today: day(56 + 28) }).prediction.state).toBe(
      'window'
    );
  });

  it('hides predictions on request while still counting days', () => {
    const tl = computeCycleTimeline(periods, stats, { today: day(60), showPredictions: false });
    expect(tl.prediction.state).toBe('hidden');
    expect(tl.elapsedDay).toBe(5);
    expect(tl.segments).toBeNull();
  });

  it('only exposes a fertile estimate when enabled', () => {
    const on = computeCycleTimeline(periods, stats, { today: day(62), showFertility: true });
    const off = computeCycleTimeline(periods, stats, { today: day(62), showFertility: false });
    expect(on.fertileEstimate).not.toBeNull();
    expect(off.fertileEstimate).toBeNull();
  });

  it('is insufficient before any period is logged', () => {
    const tl = computeCycleTimeline([], computePredictionStats([]), { today: day(0) });
    expect(tl.prediction.state).toBe('insufficient');
    expect(tl.elapsedDay).toBeNull();
  });

  it('keeps the wheel segments and the current phase on one layout for every day', () => {
    for (let n = 56; n < 56 + 28; n++) {
      const tl = computeCycleTimeline(periods, stats, { today: day(n) });
      if (!tl.segments || !tl.currentPhase) {
        continue;
      }

      const offset = n - 56;
      const segment = tl.segments.find(
        (s) => offset >= s.startDay && offset < s.startDay + s.length
      );
      expect(segment?.key).toBe(tl.currentPhase);
    }
  });
});

describe('buildPhaseSegments', () => {
  it.each([15, 21, 28, 35, 60])('tiles a %i day cycle exactly', (length) => {
    const segments = buildPhaseSegments(length, 5);
    expect(segments.reduce((sum, s) => sum + s.length, 0)).toBe(length);
    expect(segments.every((s) => s.length >= 0)).toBe(true);
    expect(segments[0].length).toBeGreaterThanOrEqual(1);
    segments.reduce((expected, s) => {
      expect(s.startDay).toBe(expected);
      return expected + s.length;
    }, 0);
  });
});

describe('phaseAtDay', () => {
  const periods = periodsAt(0, 30);
  const stats = computePredictionStats(buildCycleHistory(periods));

  it('is null before the first period and menstrual during it', () => {
    expect(phaseAtDay(periods, stats, day(-1))).toBeNull();
    expect(phaseAtDay(periods, stats, day(2))).toBe('menstrual');
  });

  it('uses the real cycle length once a later period is logged', () => {
    expect(phaseAtDay(periods, stats, day(29))).toBe('luteal');
  });
});

describe('context exclusion and suppression', () => {
  it('excludes cycles that start inside a hormonal context, with the reason', () => {
    const periods = periodsAt(0, 28, 56, 84);
    const history = buildCycleHistory(periods, (start) =>
      start >= day(28) ? 'hormonal_context' : null
    );
    expect(history.filter((e) => e.reason === 'hormonal_context')).toHaveLength(2);
    expect(computePredictionStats(history).usableCount).toBe(1);
  });

  it('reports a suppressed prediction without losing the elapsed day count', () => {
    const periods = periodsAt(0, 28);
    const stats = computePredictionStats(buildCycleHistory(periods));
    const tl = computeCycleTimeline(periods, stats, { today: day(40), suppressed: true });
    expect(tl.prediction.state).toBe('suppressed');
    expect(tl.elapsedDay).toBe(13);
    expect(tl.segments).toBeNull();
  });
});

describe('daylight-saving safety', () => {
  // Local midnights spanning the autumn clock change in most northern zones. Where the machine
  // running the tests observes DST this fails if a date is computed as start + N * 24h; in a zone
  // without DST it still pins that every predicted date lands on a local midnight.
  const localDay = (y: number, m: number, d: number) => new Date(y, m, d).getTime();
  const starts = [localDay(2026, 7, 5), localDay(2026, 8, 2), localDay(2026, 8, 30)];
  const periods: CyclePeriodInput[] = starts.map((s) => ({
    startDate: s,
    endDate: s + 4 * D,
    endKind: 'logged' as const,
  }));
  const stats = computePredictionStats(buildCycleHistory(periods));

  it('puts the predicted range and fertile window on local midnights', () => {
    const tl = computeCycleTimeline(periods, stats, {
      today: localDay(2026, 9, 14),
      showFertility: true,
    });
    const instants = [
      tl.prediction.earliest,
      tl.prediction.mostLikely,
      tl.prediction.latest,
      tl.fertileEstimate?.start,
      tl.fertileEstimate?.end,
    ];
    for (const instant of instants) {
      expect(instant).not.toBeNull();
      expect(new Date(instant!).getHours()).toBe(0);
    }
  });
});
