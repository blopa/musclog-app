import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { CYCLE_REMINDER_COPY, cycleReminderContent } from '../cycleReminderCopy';
import {
  CYCLE_REMINDER_KINDS,
  DEFAULT_CYCLE_REMINDERS,
  isPaused,
  isPillDay,
  isSnoozeStillValid,
  nextReminder,
  planCycleReminders,
} from '../cycleReminders';
import type { CycleTimeline } from '../cycleTimeline';
import type { CycleReminderPreferences } from '../types';

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

describe('planCycleReminders: opt-in reminders, pause and pill', () => {
  const kinds = (reminders: { kind: string }[]) => reminders.map((r) => r.kind);
  const prefs = (over: Partial<CycleReminderPreferences>) => ({
    ...DEFAULT_CYCLE_REMINDERS,
    ...over,
  });

  it('adds the due-day and the neutral "longer than usual" reminders only when chosen', () => {
    expect(kinds(planCycleReminders(timeline(), NOW))).toEqual(['period-start']);
    const all = planCycleReminders(timeline(), NOW, {
      preferences: prefs({ due: true, late: true }),
    });
    expect(kinds(all)).toEqual(['period-start', 'period-due', 'period-late']);
    // Due on the most likely day, "late" the day after the latest plausible start.
    expect(all[1].date.getTime()).toBe(new Date(2024, 5, 20, 9).getTime());
    expect(all[2].date.getTime()).toBe(new Date(2024, 5, 22, 9).getTime());
    expect(all[0].range).toEqual({ from: day(19), to: day(21) });
  });

  it('plans no prediction at all while the context suppresses it (pregnancy, a loss)', () => {
    const reminders = planCycleReminders(timeline({ state: 'suppressed' }), NOW, {
      preferences: prefs({ due: true, late: true, daily: true }),
    });
    expect(kinds(reminders)).toEqual(['daily-log']);
  });

  it('makes the daily check-in one repeating reminder at the chosen time', () => {
    const [daily] = planCycleReminders(null, NOW, {
      preferences: prefs({ period: false, daily: true, hour: 20, minute: 15 }),
    });
    expect(daily).toMatchObject({ kind: 'daily-log', repeatsDaily: true });
    expect(daily.date.getTime()).toBe(new Date(2024, 5, 1, 20, 15).getTime());
  });

  it('silences everything but the pill during a pause, and keeps one-shots after it ends', () => {
    const pill = {
      enabled: true,
      hour: 21,
      minute: 0,
      packStart: day(1),
      activeDays: 28,
      breakDays: 0,
    };
    const paused = planCycleReminders(timeline(), NOW, {
      preferences: prefs({ daily: true, pill, pause: { until: null } }),
    });
    expect(kinds(paused)).toEqual(['pill']);
    expect(isPaused(prefs({ pause: { until: null } }), NOW)).toBe(true);

    // A pause until the 18th keeps the reminder for the 19th-21st window (it fires on the 17th
    // otherwise, so it is dropped) — and drops a repeating check-in until the next reschedule.
    const until18 = planCycleReminders(timeline(), NOW, {
      preferences: prefs({ due: true, daily: true, pause: { until: day(18) } }),
    });
    expect(kinds(until18)).toEqual(['period-due']);
    expect(isPaused(prefs({ pause: { until: day(18) } }), day(19))).toBe(false);
  });

  it('skips the pill-free days of a 21 + 7 pack', () => {
    const schedule = {
      enabled: true,
      hour: 21,
      minute: 0,
      packStart: day(1),
      activeDays: 21,
      breakDays: 7,
    };
    expect(isPillDay(schedule, day(21))).toBe(true);
    expect(isPillDay(schedule, day(22))).toBe(false);
    expect(isPillDay(schedule, day(28))).toBe(false);
    expect(isPillDay(schedule, day(29))).toBe(true);

    const pills = planCycleReminders(null, NOW, {
      preferences: prefs({ period: false, pill: schedule }),
    });
    const pillDays = pills.map((r) => r.date.getDate());
    expect(pillDays).not.toContain(22);
    expect(pillDays).toContain(21);
    expect(pills.every((r) => r.date.getHours() === 21 && !r.repeatsDaily)).toBe(true);
  });

  it('reports the soonest reminder for the settings line', () => {
    const reminders = planCycleReminders(timeline(), NOW, {
      preferences: prefs({ due: true, daily: true }),
    });
    expect(nextReminder(reminders)?.kind).toBe('daily-log');
    expect(nextReminder([])).toBeNull();
  });
});

describe('cycleReminderContent', () => {
  const t = ((key: string, params?: Record<string, string>) =>
    params ? `${key}|${params.from}|${params.to}` : key) as never;

  it('says nothing about the topic in the private style, for every kind', () => {
    for (const kind of CYCLE_REMINDER_KINDS) {
      expect(cycleReminderContent({ kind }, 'discreet', t, 'en-US')).toEqual({
        title: 'notifications.types.cycleDiscreet.title',
        body: 'notifications.types.cycleDiscreet.body',
      });
    }
  });

  it('uses the range wording for a spread estimate and the single-day wording otherwise', () => {
    const spread = cycleReminderContent(
      { kind: 'period-start', range: { from: day(19), to: day(21) } },
      'detailed',
      t,
      'en-US'
    );
    expect(spread.body.startsWith('cycle.notifications.periodStart.bodyRange|')).toBe(true);
    const single = cycleReminderContent(
      { kind: 'period-start', range: { from: day(19), to: day(19) } },
      'detailed',
      t,
      'en-US'
    );
    expect(single.body.startsWith('cycle.notifications.periodStart.body|')).toBe(true);
  });

  it('declares wording for every reminder kind in all three styles', () => {
    for (const kind of CYCLE_REMINDER_KINDS) {
      expect(CYCLE_REMINDER_COPY[kind].detailedTitle).toMatch(/^cycle\.notifications\./);
      expect(CYCLE_REMINDER_COPY[kind].subtleBody).toMatch(/^cycle\.notifications\.subtle\./);
    }
  });
});

describe('isSnoozeStillValid', () => {
  const state = (over: Partial<Parameters<typeof isSnoozeStillValid>[1]> = {}) => ({
    timeline: timeline(),
    preferences: { ...DEFAULT_CYCLE_REMINDERS },
    nowMs: NOW,
    ...over,
  });

  it('keeps a snoozed estimate while the prediction it rests on is still shown', () => {
    expect(isSnoozeStillValid('period-start', state())).toBe(true);
    expect(
      isSnoozeStillValid('period-late', state({ timeline: timeline({ state: 'late' }) }))
    ).toBe(true);
  });

  it.each(['hidden', 'suppressed'])(
    'drops a snoozed estimate once the prediction is %s (a context change took it away)',
    (predictionState) => {
      expect(
        isSnoozeStillValid(
          'period-start',
          state({ timeline: timeline({ state: predictionState }) })
        )
      ).toBe(false);
    }
  );

  it('drops a snoozed estimate when there is no timeline at all', () => {
    expect(isSnoozeStillValid('period-due', state({ timeline: null }))).toBe(false);
  });

  it('needs the fertility opt-in for a snoozed fertile-window reminder', () => {
    expect(
      isSnoozeStillValid(
        'fertile-window',
        state({ preferences: { ...DEFAULT_CYCLE_REMINDERS, fertility: false } })
      )
    ).toBe(false);
    expect(isSnoozeStillValid('fertile-window', state())).toBe(true);
  });

  it('keeps a snoozed routine whatever the prediction says', () => {
    expect(isSnoozeStillValid('daily-log', state({ timeline: null }))).toBe(true);
    expect(isSnoozeStillValid('backup', state({ timeline: timeline({ state: 'hidden' }) }))).toBe(
      true
    );
  });

  it('lets a pause silence a snoozed reminder, except the pill', () => {
    const paused = { ...DEFAULT_CYCLE_REMINDERS, pause: { until: null } };
    expect(isSnoozeStillValid('daily-log', state({ preferences: paused }))).toBe(false);
    expect(isSnoozeStillValid('period-start', state({ preferences: paused }))).toBe(false);
    expect(isSnoozeStillValid('pill', state({ preferences: paused }))).toBe(true);
  });

  it('ignores a pause that has ended', () => {
    const ended = { ...DEFAULT_CYCLE_REMINDERS, pause: { until: NOW - 1 } };
    expect(isSnoozeStillValid('daily-log', state({ preferences: ended }))).toBe(true);
  });
});
