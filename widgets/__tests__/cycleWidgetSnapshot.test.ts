import {
  buildCycleWidgetSnapshot,
  CYCLE_WIDGET_URL,
  type CycleWidgetInputs,
  cycleWidgetMayShowDay,
  expiredCycleWidgetSnapshot,
} from '../cycleWidgetSnapshot';
import { INITIAL_WIDGET_PALETTE } from '../widgetSnapshot';

const translate = (key: string) => key;

const build = (inputs: CycleWidgetInputs, locale = 'en-US') =>
  buildCycleWidgetSnapshot({ inputs, palette: INITIAL_WIDGET_PALETTE, locale, translate });

describe('cycleWidgetMayShowDay', () => {
  it.each([[['cycle']], [['app']], [['workout', 'cycle']]] as const)(
    'hides the day under a lock that protects the cycle (%j)',
    (lockScopes) => {
      expect(cycleWidgetMayShowDay(lockScopes)).toBe(false);
    }
  );

  it('shows the day with no lock, whatever the notification wording is', () => {
    expect(cycleWidgetMayShowDay([])).toBe(true);
  });

  it('ignores locks on the other areas: they do not protect the cycle', () => {
    expect(cycleWidgetMayShowDay(['workout', 'nutrition', 'progress'])).toBe(true);
  });
});

describe('buildCycleWidgetSnapshot', () => {
  it('shows the day count by default', () => {
    expect(build({ lockScopes: [], elapsedDay: 14 })).toMatchObject({
      state: 'day',
      title: 'Musclog',
      value: '14',
      caption: 'widgets.cycle.day',
      url: CYCLE_WIDGET_URL,
    });
  });

  it.each(['cycle', 'app'] as const)('stays private under the %s lock', (scope) => {
    const snapshot = build({ lockScopes: [scope], elapsedDay: 14 });
    expect(snapshot).toMatchObject({ state: 'private', value: '' });
    expect(snapshot.caption).toBe('widgets.cycle.privateCaption');
    expect(`${snapshot.title} ${snapshot.caption}`).not.toMatch(/14/);
  });

  it('asks to open the app with no logged period', () => {
    expect(build({ lockScopes: [], elapsedDay: null })).toMatchObject({
      state: 'stale',
      value: '',
      caption: 'widgets.refresh',
    });
  });

  it('localizes the day count', () => {
    expect(build({ lockScopes: [], elapsedDay: 14 }, 'ar-EG').value).toBe('١٤');
  });
});

describe('expiredCycleWidgetSnapshot', () => {
  it('drops yesterday’s day count', () => {
    expect(expiredCycleWidgetSnapshot(build({ lockScopes: [], elapsedDay: 14 }))).toMatchObject({
      state: 'stale',
      value: '',
      caption: 'widgets.refresh',
    });
  });

  it('leaves a snapshot that shows no day alone', () => {
    const neutral = build({ lockScopes: ['cycle'], elapsedDay: null });
    expect(expiredCycleWidgetSnapshot(neutral)).toBe(neutral);
  });
});
