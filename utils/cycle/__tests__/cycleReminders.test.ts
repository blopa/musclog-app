import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { planCycleReminders } from '../cycleReminders';
import type { CycleTimeline } from '../cycleTimeline';

const NOW = new Date(2024, 5, 1, 8).getTime();
const day = (n: number) => new Date(2024, 5, n).getTime();

const timeline = (over: Partial<CycleTimeline> & { state?: string } = {}): CycleTimeline => ({
  elapsedDay: 10,
  prediction: {
    state: (over.state ?? 'upcoming') as never,
    mostLikely: day(20),
    earliest: day(19),
    latest: day(21),
    daysLate: 0,
  },
  segments: [],
  currentPhase: 'follicular',
  fertileEstimate: null,
  cycleLength: 28,
  ...over,
});

describe('planCycleReminders', () => {
  it('reminds ahead of the earliest plausible start', () => {
    const [period] = planCycleReminders(timeline(), NOW);
    expect(period.kind).toBe('period-start');
    expect(period.date.getTime()).toBe(new Date(2024, 5, 17, 9).getTime());
  });

  it.each(['late', 'hidden', 'suppressed', 'insufficient'])('sends nothing when %s', (state) => {
    expect(planCycleReminders(timeline({ state }), NOW)).toEqual([]);
  });

  it('adds a fertile-window reminder only when an estimate exists', () => {
    expect(planCycleReminders(timeline(), NOW)).toHaveLength(1);
    const withFertile = planCycleReminders(
      timeline({ fertileEstimate: { start: day(10), end: day(16) } }),
      NOW
    );
    expect(withFertile.map((r) => r.kind)).toEqual(['period-start', 'fertile-window']);
  });

  it('drops reminders that are already in the past', () => {
    expect(planCycleReminders(timeline(), day(25))).toEqual([]);
    expect(MS_PER_SOLAR_DAY).toBeGreaterThan(0);
  });
});
