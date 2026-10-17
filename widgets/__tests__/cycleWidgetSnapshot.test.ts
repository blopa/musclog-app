import type { CycleTimeline } from '@/utils/cycle/cycleTimeline';
import type { CyclePeriodDto } from '@/utils/cycle/types';

import {
  buildCycleWidgetSnapshot,
  CYCLE_WIDGET_URL,
  type CycleWidgetInputs,
  cycleWidgetNeedsRecords,
  effectiveCycleWidgetStyle,
  expiredCycleWidgetSnapshot,
} from '../cycleWidgetSnapshot';
import { INITIAL_WIDGET_PALETTE } from '../widgetSnapshot';

const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => new Date(2026, 9, 17 + offset).getTime();

const translate = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

function timeline(overrides: Partial<CycleTimeline['prediction']> = {}): CycleTimeline {
  return {
    elapsedDay: 14,
    prediction: {
      state: 'upcoming',
      mostLikely: day(14),
      earliest: day(12),
      latest: day(16),
      daysLate: 0,
      ...overrides,
    },
    segments: null,
    currentPhase: null,
    fertileEstimate: null,
    cycleLength: 28,
  };
}

const inputs = (
  overrides: Partial<CycleWidgetInputs> & { timeline?: CycleTimeline } = {}
): CycleWidgetInputs => ({
  lockScopes: [],
  style: 'detailed',
  cycle: { timeline: overrides.timeline ?? timeline(), activePeriod: null },
  ...overrides,
});

const build = (value: CycleWidgetInputs) =>
  buildCycleWidgetSnapshot({
    inputs: value,
    palette: INITIAL_WIDGET_PALETTE,
    locale: 'en-US',
    translate,
  });

// Everything a person could read off the home screen. Nothing in it may say what the widget is.
const visibleText = (s: ReturnType<typeof build>) =>
  [s.title, s.value, s.caption, s.detail].join(' ');

describe('effectiveCycleWidgetStyle', () => {
  it.each([['cycle'], ['app'], ['workout', 'cycle']] as const)(
    'forces the neutral style when the cycle is behind a lock (%s)',
    (...lockScopes) => {
      for (const style of ['discreet', 'subtle', 'detailed'] as const) {
        expect(effectiveCycleWidgetStyle(lockScopes, style)).toBe('discreet');
        expect(cycleWidgetNeedsRecords(lockScopes, style)).toBe(false);
      }
    }
  );

  it('follows the chosen style with no lock', () => {
    expect(effectiveCycleWidgetStyle([], 'subtle')).toBe('subtle');
    expect(cycleWidgetNeedsRecords([], 'discreet')).toBe(false);
    expect(cycleWidgetNeedsRecords([], 'subtle')).toBe(true);
  });

  it('ignores locks on the other areas: they do not protect the cycle', () => {
    const others = ['workout', 'nutrition', 'progress'] as const;
    expect(effectiveCycleWidgetStyle(others, 'subtle')).toBe('subtle');
    expect(cycleWidgetNeedsRecords(others, 'detailed')).toBe(true);
  });
});

describe('buildCycleWidgetSnapshot', () => {
  it('shows nothing about the cycle in the discreet style, even with data to show', () => {
    const snapshot = build(inputs({ style: 'discreet' }));
    expect(snapshot.value).toBe('');
    expect(snapshot.detail).toBe('');
    expect(snapshot.title).toBe('Musclog');
    expect(snapshot.caption).toBe('widgets.cycle.privateCaption');
    expect(snapshot.url).toBe(CYCLE_WIDGET_URL);
  });

  it.each(['cycle', 'app'] as const)(
    'stays neutral under the %s lock whatever the style',
    (scope) => {
      const snapshot = build(inputs({ lockScopes: [scope], style: 'detailed' }));
      expect(snapshot.value).toBe('');
      expect(visibleText(snapshot)).not.toMatch(/14|Likely|late/);
    }
  );

  it('shows only the day number in the subtle style', () => {
    const snapshot = build(inputs({ style: 'subtle' }));
    expect(snapshot).toMatchObject({ title: 'Musclog', value: '14', caption: 'widgets.cycle.day' });
    expect(snapshot.detail).toBe('');
  });

  it('adds the estimated range in the detailed style', () => {
    const snapshot = build(inputs({ style: 'detailed' }));
    expect(snapshot.title).toBe('widgets.cycle.title');
    expect(snapshot.value).toBe('14');
    expect(snapshot.detail).toContain('cycle.prediction.likelyRange');
    expect(snapshot.detail).toContain('Oct 29');
    expect(snapshot.detail).toContain('Nov 2');
  });

  it('uses the single-date wording when the range is one day', () => {
    const snapshot = build(inputs({ timeline: timeline({ earliest: day(14), latest: day(14) }) }));
    expect(snapshot.detail).toContain('cycle.prediction.likelyDate');
  });

  it('states how late it is, neutrally', () => {
    const snapshot = build(inputs({ timeline: timeline({ state: 'late', daysLate: 3 }) }));
    expect(snapshot.detail).toBe('cycle.late.title:{"count":3}');
  });

  it.each(['hidden', 'insufficient', 'suppressed'] as const)(
    'has no estimate line while predictions are %s',
    (state) => {
      const snapshot = build(
        inputs({ timeline: timeline({ state, earliest: null, latest: null, mostLikely: null }) })
      );
      expect(snapshot.value).toBe('14');
      expect(snapshot.detail).toBe('');
    }
  );

  it('does not announce the next period while one is going', () => {
    const period = { startDate: day(-2) } as CyclePeriodDto;
    const snapshot = build({
      lockScopes: [],
      style: 'detailed',
      cycle: { timeline: timeline(), activePeriod: period },
    });
    expect(snapshot.value).toBe('14');
    expect(snapshot.detail).toBe('');
  });

  it.each([
    ['no active cycle', null],
    ['no logged period', { timeline: { ...timeline(), elapsedDay: null }, activePeriod: null }],
  ])('asks to open the app with %s', (_name, cycle) => {
    const snapshot = build({ lockScopes: [], style: 'detailed', cycle });
    expect(snapshot.value).toBe('');
    expect(snapshot.caption).toBe('widgets.refresh');
  });

  it('localizes the day count', () => {
    const snapshot = buildCycleWidgetSnapshot({
      inputs: inputs({ style: 'subtle', timeline: { ...timeline(), elapsedDay: 14 } }),
      palette: INITIAL_WIDGET_PALETTE,
      locale: 'ar-EG',
      translate,
    });
    expect(snapshot.value).toBe('١٤');
  });
});

describe('expiredCycleWidgetSnapshot', () => {
  it('drops yesterday’s day count and estimate', () => {
    const expired = expiredCycleWidgetSnapshot(build(inputs()));
    expect(expired).toMatchObject({
      title: 'Musclog',
      value: '',
      detail: '',
      caption: 'widgets.refresh',
    });
    expect(DAY).toBeGreaterThan(0);
  });

  it('leaves a snapshot that shows nothing alone', () => {
    const neutral = build(inputs({ style: 'discreet' }));
    expect(expiredCycleWidgetSnapshot(neutral)).toBe(neutral);
  });
});
