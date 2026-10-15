import { DEFAULT_REST_SECONDS } from '@/constants/restTimer';
import { readSetting, SETTINGS } from '@/constants/settingDefinitions';
import { DEFAULT_WORKOUT_AUTONOMY } from '@/constants/settings';

describe('SETTINGS', () => {
  it('keeps the defaults the service and the context each used to spell out', () => {
    expect({
      cycleShowPredictions: SETTINGS.cycleShowPredictions.defaultValue,
      cycleShowFertility: SETTINGS.cycleShowFertility.defaultValue,
      cycleNotificationStyle: SETTINGS.cycleNotificationStyle.defaultValue,
      appLockMode: SETTINGS.appLockMode.defaultValue,
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
      appLockMode: 'off',
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
