import AsyncStorage from '@react-native-async-storage/async-storage';

import { NotificationService } from '@/services/NotificationService';
import {
  clearActiveWorkoutLogId,
  clearRestTimerEndAt,
  getActiveWorkoutLogId,
  getDismissedInsights,
  getRestTimerEndAt,
  hasActiveWorkout,
  pruneWorkoutInsights,
  setActiveWorkoutLogId,
  setInsightDismissed,
  setRestTimerEndAt,
} from '@/utils/activeWorkoutStorage';

jest.mock('@/services/NotificationService', () => ({
  NotificationService: {
    dismissActiveWorkoutNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

const ACTIVE_WORKOUT_KEY = 'active_workout_log_id';
const INSIGHTS_KEY = (id: string) => `workout_insights_${id}`;
const REST_TIMER_END_AT_KEY = 'rest_timer_end_at';
const REST_TIMER_WORKOUT_KEY = 'rest_timer_workout_log_id';

const mockDismissNotification =
  NotificationService.dismissActiveWorkoutNotification as jest.MockedFunction<
    typeof NotificationService.dismissActiveWorkoutNotification
  >;

describe('activeWorkoutStorage', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockDismissNotification.mockResolvedValue(undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('active workout id', () => {
    it('round-trips the active workout log id', async () => {
      await setActiveWorkoutLogId('log-1');

      await expect(getActiveWorkoutLogId()).resolves.toBe('log-1');
      await expect(hasActiveWorkout()).resolves.toBe(true);
    });

    it('reports no active workout when nothing is stored', async () => {
      await expect(getActiveWorkoutLogId()).resolves.toBeNull();
      await expect(hasActiveWorkout()).resolves.toBe(false);
    });

    it('resolves null (not a throw) when the read fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage offline'));

      await expect(getActiveWorkoutLogId()).resolves.toBeNull();
    });

    it('rethrows when persisting the active workout fails', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

      await expect(setActiveWorkoutLogId('log-1')).rejects.toThrow('disk full');
    });
  });

  describe('clearActiveWorkoutLogId', () => {
    // The id and its insight key are removed in one multiRemove so a concurrent read can
    // never observe "no active workout, but insights for it still dismissed".
    it('removes the id and the workout-scoped insight key in a single atomic multiRemove', async () => {
      await setActiveWorkoutLogId('log-1');
      await setInsightDismissed('log-1', 'hormonal');
      jest.clearAllMocks();

      await clearActiveWorkoutLogId();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        ACTIVE_WORKOUT_KEY,
        INSIGHTS_KEY('log-1'),
      ]);
      await expect(getActiveWorkoutLogId()).resolves.toBeNull();
      await expect(AsyncStorage.getItem(INSIGHTS_KEY('log-1'))).resolves.toBeNull();
    });

    it('only removes the active workout key when no workout is active', async () => {
      await clearActiveWorkoutLogId();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([ACTIVE_WORKOUT_KEY]);
    });

    it('dismisses the active workout notification only after storage has been cleared', async () => {
      await setActiveWorkoutLogId('log-1');
      const order: string[] = [];
      (AsyncStorage.multiRemove as jest.Mock).mockImplementationOnce(async () => {
        order.push('multiRemove');
      });
      mockDismissNotification.mockImplementationOnce(async () => {
        order.push('dismiss');
      });

      await clearActiveWorkoutLogId();

      expect(order).toEqual(['multiRemove', 'dismiss']);
    });

    it('rethrows when the atomic removal fails', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

      await expect(clearActiveWorkoutLogId()).rejects.toThrow('disk full');
      expect(mockDismissNotification).not.toHaveBeenCalled();
    });
  });

  describe('dismissed insights', () => {
    it('round-trips a dismissed insight and merges a second one into the same record', async () => {
      await setInsightDismissed('log-1', 'hormonal');
      await expect(getDismissedInsights('log-1')).resolves.toEqual({ hormonal: true });

      await setInsightDismissed('log-1', 'fueling');
      await expect(getDismissedInsights('log-1')).resolves.toEqual({
        hormonal: true,
        fueling: true,
      });
    });

    it('returns an empty object when the workout has no dismissals yet', async () => {
      await expect(getDismissedInsights('log-unknown')).resolves.toEqual({});
    });

    // Corrupt JSON (a half-written value, a schema change) must degrade to "nothing dismissed"
    // rather than blowing up the workout screen that renders the insight cards.
    it('returns an empty object when the stored JSON is unparseable', async () => {
      await AsyncStorage.setItem(INSIGHTS_KEY('log-1'), '{not json');

      await expect(getDismissedInsights('log-1')).resolves.toEqual({});
    });

    it('keeps dismissals scoped per workout', async () => {
      await setInsightDismissed('log-1', 'hormonal');

      await expect(getDismissedInsights('log-2')).resolves.toEqual({});
    });

    // Dismissing an insight is a cosmetic preference: a storage failure must not bubble up
    // into the tap handler.
    it('swallows a write failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

      await expect(setInsightDismissed('log-1', 'hormonal')).resolves.toBeUndefined();
    });
  });

  describe('rest timer', () => {
    it('round-trips the rest timer end timestamp for its owning workout', async () => {
      await setRestTimerEndAt('log-1', 1_700_000_000_000);

      await expect(getRestTimerEndAt('log-1')).resolves.toBe(1_700_000_000_000);
      await expect(AsyncStorage.getItem(REST_TIMER_END_AT_KEY)).resolves.toBe('1700000000000');
      await expect(AsyncStorage.getItem(REST_TIMER_WORKOUT_KEY)).resolves.toBe('log-1');
    });

    // A timer left behind by a previous workout must not leak into the next one, otherwise
    // the new workout opens with a phantom (or already-expired) rest countdown.
    it('returns null when the stored timer belongs to a different workout', async () => {
      await setRestTimerEndAt('log-1', 1_700_000_000_000);

      await expect(getRestTimerEndAt('log-2')).resolves.toBeNull();
    });

    it('returns null when no timer is stored', async () => {
      await expect(getRestTimerEndAt('log-1')).resolves.toBeNull();
    });

    it('clears both the timestamp and its owner so neither can be re-read', async () => {
      await setRestTimerEndAt('log-1', 1_700_000_000_000);
      await clearRestTimerEndAt();

      await expect(getRestTimerEndAt('log-1')).resolves.toBeNull();
      await expect(AsyncStorage.getItem(REST_TIMER_END_AT_KEY)).resolves.toBeNull();
      await expect(AsyncStorage.getItem(REST_TIMER_WORKOUT_KEY)).resolves.toBeNull();
    });

    it('swallows read and write failures', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
      await expect(setRestTimerEndAt('log-1', 1)).resolves.toBeUndefined();

      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage offline'));
      await expect(getRestTimerEndAt('log-1')).resolves.toBeNull();

      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
      await expect(clearRestTimerEndAt()).resolves.toBeUndefined();
    });
  });

  describe('pruneWorkoutInsights', () => {
    it('removes orphaned insight keys but keeps the active workout’s', async () => {
      await setActiveWorkoutLogId('log-active');
      await setInsightDismissed('log-active', 'hormonal');
      await setInsightDismissed('log-old-1', 'fueling');
      await setInsightDismissed('log-old-2', 'hormonal');

      await pruneWorkoutInsights();

      await expect(getDismissedInsights('log-active')).resolves.toEqual({ hormonal: true });
      await expect(getDismissedInsights('log-old-1')).resolves.toEqual({});
      await expect(getDismissedInsights('log-old-2')).resolves.toEqual({});
    });

    it('removes every insight key when no workout is active', async () => {
      await setInsightDismissed('log-old-1', 'fueling');

      await pruneWorkoutInsights();

      await expect(getDismissedInsights('log-old-1')).resolves.toEqual({});
    });

    it('leaves unrelated AsyncStorage keys untouched', async () => {
      await AsyncStorage.setItem('some_other_key', 'keep-me');
      await setInsightDismissed('log-old-1', 'fueling');

      await pruneWorkoutInsights();

      await expect(AsyncStorage.getItem('some_other_key')).resolves.toBe('keep-me');
    });

    it('does not issue a multiRemove when there is nothing to prune', async () => {
      await pruneWorkoutInsights();

      expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    });

    it('swallows failures — pruning is best-effort housekeeping', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValueOnce(new Error('storage offline'));

      await expect(pruneWorkoutInsights()).resolves.toBeUndefined();
    });
  });
});
