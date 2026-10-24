import { describeMarkers, calendarMarkers } from '../calendarMarkers';
import type { CycleTimeline } from '../cycleTimeline';
import type { CycleDayLogDto } from '../types';

const day = (n: number) => new Date(2024, 5, n).getTime();
const log = (n: number, extra: Partial<CycleDayLogDto>): CycleDayLogDto => ({
  id: String(n),
  date: day(n),
  timezone: '+00:00',
  bleeding: null,
  symptoms: [],
  noSymptoms: false,
  pain: null,
  energy: null,
  note: '',
  ...extra,
});
const timeline = (state: string, over: Partial<CycleTimeline> = {}): CycleTimeline => ({
  elapsedDay: 3,
  prediction: {
    state: state as never,
    mostLikely: day(26),
    earliest: day(25),
    latest: day(27),
    daysLate: 0,
  },
  segments: null,
  currentPhase: null,
  fertileEstimate: null,
  cycleLength: 28,
  ...over,
});
const periods = [{ startDate: day(1), endDate: day(4), endKind: 'logged' as const }];

describe('calendarMarkers', () => {
  const at = (tl: CycleTimeline | null, dayLogs: CycleDayLogDto[] = []) =>
    calendarMarkers({ periods, dayLogs, timeline: tl, today: day(10) });

  it('marks logged period days and nothing else outside it', () => {
    const m = at(null);
    expect(m(day(2)).period).toBe(true);
    expect(m(day(5)).period).toBe(false);
  });

  it('keeps logged bleeding distinct from the period and from an observation', () => {
    const m = at(null, [
      log(2, { bleeding: 'heavy' }),
      log(8, { symptoms: [{ key: 'a', severity: 1 }] }),
      log(9, { bleeding: 'none' }),
    ]);
    expect(m(day(2)).bleeding).toBe('heavy');
    expect(m(day(8))).toMatchObject({ bleeding: null, observation: true });
    expect(m(day(9)).bleeding).toBeNull();
  });

  it('shows the predicted window only for a prediction the screen stands behind', () => {
    expect(at(timeline('upcoming'))(day(26)).predicted).toBe(true);
    expect(at(timeline('upcoming'))(day(28)).predicted).toBe(false);
    for (const state of ['late', 'hidden', 'suppressed', 'insufficient']) {
      expect(at(timeline(state))(day(26)).predicted).toBe(false);
    }
  });

  it('never shows a logged day as predicted', () => {
    const m = at(timeline('window'), [log(26, { bleeding: 'light' })]);
    expect(m(day(26))).toMatchObject({ bleeding: 'light', predicted: false });
  });

  it('shows the fertile estimate only when the timeline carries one', () => {
    const tl = timeline('upcoming', { fertileEstimate: { start: day(14), end: day(19) } });
    expect(at(tl)(day(15)).fertile).toBe(true);
    expect(at(timeline('upcoming'))(day(15)).fertile).toBe(false);
  });

  it('stops an open period at today instead of running forever', () => {
    const open = calendarMarkers({
      periods: [{ startDate: day(8), endDate: null, endKind: 'open' }],
      dayLogs: [],
      timeline: null,
      today: day(10),
    });
    expect(open(day(10)).period).toBe(true);
    expect(open(day(12)).period).toBe(false);
  });
});

describe('describeMarkers', () => {
  it('lists the facts first and says "logged bleeding" instead of repeating the period', () => {
    expect(
      describeMarkers({
        period: true,
        bleeding: 'medium',
        predicted: false,
        fertile: false,
        observation: true,
      })
    ).toEqual([{ kind: 'bleeding', level: 'medium' }, { kind: 'observation' }]);
    expect(
      describeMarkers({
        period: true,
        bleeding: null,
        predicted: false,
        fertile: false,
        observation: false,
      })
    ).toEqual([{ kind: 'period' }]);
  });
});
