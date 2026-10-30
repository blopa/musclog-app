import { DEFAULT_REST_SECONDS } from '@/constants/restTimer';
import { readSetting, SETTINGS } from '@/constants/settingDefinitions';
import { DEFAULT_WORKOUT_AUTONOMY } from '@/constants/settings';

describe('SETTINGS', () => {
  it('keeps the defaults the service and the context each used to spell out', () => {
    expect({
      cycleShowPredictions: SETTINGS.cycleShowPredictions.defaultValue,
      cycleShowFertility: SETTINGS.cycleShowFertility.defaultValue,
      cycleNotificationStyle: SETTINGS.cycleNotificationStyle.defaultValue,
      appLockScopes: SETTINGS.appLockScopes.defaultValue,
      workoutAutonomy: SETTINGS.workoutAutonomy.defaultValue,
      autoStartRestTimer: SETTINGS.autoStartRestTimer.defaultValue,
      restTimerHaptics: SETTINGS.restTimerHaptics.defaultValue,
      defaultRestSeconds: SETTINGS.defaultRestSeconds.defaultValue,
      activeGymId: SETTINGS.activeGymId.defaultValue,
      showHomeSteps: SETTINGS.showHomeSteps.defaultValue,
      workoutView: SETTINGS.workoutView.defaultValue,
      reviewWeekday: SETTINGS.reviewWeekday.defaultValue,
      notificationsWeeklyReview: SETTINGS.notificationsWeeklyReview.defaultValue,
    }).toEqual({
      cycleShowPredictions: true,
      cycleShowFertility: false,
      cycleNotificationStyle: 'discreet',
      appLockScopes: [],
      workoutAutonomy: DEFAULT_WORKOUT_AUTONOMY,
      autoStartRestTimer: true,
      restTimerHaptics: true,
      defaultRestSeconds: DEFAULT_REST_SECONDS,
      activeGymId: null,
      showHomeSteps: true,
      workoutView: 'guided',
      reviewWeekday: 1,
      notificationsWeeklyReview: false,
    });
  });

  it('gives every setting its own storage key', () => {
    const types = Object.values(SETTINGS).map((setting) => setting.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('reads stored values the way the old getters did, unknown ones as the default', () => {
    const map = new Map([
      [SETTINGS.autoStartRestTimer.type, 'false'],
      [SETTINGS.workoutView.type, 'something-newer'],
      [SETTINGS.reviewWeekday.type, '9'],
      [SETTINGS.activeGymId.type, ''],
      [SETTINGS.defaultRestSeconds.type, 'abc'],
    ]);
    expect(readSetting(map, SETTINGS.autoStartRestTimer)).toBe(false);
    expect(readSetting(map, SETTINGS.workoutView)).toBe('guided');
    expect(readSetting(map, SETTINGS.reviewWeekday)).toBe(1);
    expect(readSetting(map, SETTINGS.activeGymId)).toBeNull();
    expect(readSetting(map, SETTINGS.defaultRestSeconds)).toBe(DEFAULT_REST_SECONDS);
    expect(readSetting(new Map(), SETTINGS.restTimerHaptics)).toBe(true);
  });

  it('refuses to store a value that must never be stored', () => {
    expect(() => SETTINGS.reviewWeekday.serialize(7)).toThrow('Invalid weekday');
    expect(SETTINGS.reviewWeekday.serialize(0)).toBe('0');
    expect(SETTINGS.activeGymId.serialize(null)).toBe('');
  });
});

describe('rest alert settings', () => {
  it('defaults to the behaviour the timer always had', () => {
    expect(SETTINGS.restAlertSound.defaultValue).toBe('on');
    expect(SETTINGS.restHapticStrength.defaultValue).toBe('standard');
    expect(SETTINGS.restHeadsUpSeconds.defaultValue).toBe(10);
  });

  it('reads anything unrecognized as the default, since rows can come from a newer build', () => {
    expect(SETTINGS.restAlertSound.parse('loud')).toBe('on');
    expect(SETTINGS.restHapticStrength.parse('')).toBe('standard');
    expect(SETTINGS.restHeadsUpSeconds.parse('45')).toBe(10);
    expect(SETTINGS.restHeadsUpSeconds.parse('')).toBe(10);
  });

  it('round-trips every offered choice, including a heads-up of zero', () => {
    expect(SETTINGS.restAlertSound.parse('off')).toBe('off');
    expect(SETTINGS.restHapticStrength.parse('strong')).toBe('strong');
    for (const seconds of [0, 10, 20, 30] as const) {
      expect(
        SETTINGS.restHeadsUpSeconds.parse(SETTINGS.restHeadsUpSeconds.serialize(seconds))
      ).toBe(seconds);
    }
  });
});

describe('appLockScopes', () => {
  const { parse, serialize } = SETTINGS.appLockScopes;

  it('reads the pre-per-area values unchanged', () => {
    expect(parse('off')).toEqual([]);
    expect(parse('')).toEqual([]);
    expect(parse('cycle')).toEqual(['cycle']);
    expect(parse('app')).toEqual(['app']);
  });

  it('round-trips a list in canonical order, dropping unknown and repeated names', () => {
    expect(serialize(['progress', 'cycle', 'cycle', 'workout'])).toBe('cycle,workout,progress');
    expect(parse('progress,nonsense,nutrition,progress')).toEqual(['nutrition', 'progress']);
    expect(parse(serialize(['nutrition', 'workout']))).toEqual(['workout', 'nutrition']);
  });
});
