import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { ONBOARDING_COMPLETED } from '@/constants/misc';

export const CONFETTI_INTERACTIONS_KEY = 'confetti_interactions_state';

export enum ConfettiActivity {
  ONBOARDING_COMPLETED = 'onboarding_completed',
  FIRST_NUTRITION_LOG = 'first_nutrition_log',
  FIRST_MANUAL_NUTRITION_GOAL = 'first_manual_nutrition_goal',
  FIRST_FITNESS_GOAL = 'first_fitness_goal',
  FIRST_WORKOUT_CREATED = 'first_workout_created',
  FIRST_MEAL_CREATED = 'first_meal_created',
  ONBOARDING_CONFIRMED = 'onboarding_confirmed',
}

export const ALL_CONFETTI_ACTIVITIES = Object.values(ConfettiActivity);

const ONBOARDING_ACTIVITIES = new Set([
  ConfettiActivity.ONBOARDING_COMPLETED,
  ConfettiActivity.ONBOARDING_CONFIRMED,
]);

interface ConfettiInteractionsContextType {
  completeActivity: (activity: ConfettiActivity) => Promise<boolean>;
}

const ConfettiInteractionsContext = createContext<ConfettiInteractionsContextType | undefined>(
  undefined
);

export const useConfettiInteractions = () => {
  const context = useContext(ConfettiInteractionsContext);
  if (!context) {
    throw new Error('useConfettiInteractions must be used within a ConfettiInteractionsProvider');
  }
  return context;
};

export const ConfettiInteractionsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // null = not yet loaded; Set = loaded (may be empty = all done)
  const pendingRef = useRef<Set<string> | null>(null);
  const isMountedRef = useRef(true);
  const [loadStateGate] = useState(() => {
    let resolve!: () => void;

    return {
      promise: new Promise<void>((promiseResolve) => {
        resolve = promiseResolve;
      }),
      resolve,
    };
  });

  useEffect(() => {
    isMountedRef.current = true;

    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(CONFETTI_INTERACTIONS_KEY);

        if (stored === null) {
          // Key absent: either an existing user who predates this feature, or all activities done.
          // Distinguish by checking if onboarding was already completed.
          const onboardingDone = await AsyncStorage.getItem(ONBOARDING_COMPLETED);
          if (onboardingDone === 'true') {
            // Existing user upgrading without the seeded key: give them all non-onboarding
            // activities so they can still receive confetti for first workout/meal/goal etc.
            const pending = new Set(
              ALL_CONFETTI_ACTIVITIES.filter((a) => !ONBOARDING_ACTIVITIES.has(a as ConfettiActivity))
            );
            pendingRef.current = pending;
            await AsyncStorage.setItem(CONFETTI_INTERACTIONS_KEY, JSON.stringify([...pending]));
          } else {
            // Fresh install that finished seeding (all activities done) or no activities remain.
            pendingRef.current = new Set();
          }

          return;
        }

        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          // New format: array of pending activity strings.
          const pending = new Set<string>(parsed);

          // If onboarding is already done, onboarding confetti should not be pending.
          const onboardingDone = await AsyncStorage.getItem(ONBOARDING_COMPLETED);
          if (onboardingDone === 'true') {
            let changed = false;
            for (const a of ONBOARDING_ACTIVITIES) {
              if (pending.has(a)) {
                pending.delete(a);
                changed = true;
              }
            }

            if (changed) {
              if (pending.size === 0) {
                await AsyncStorage.removeItem(CONFETTI_INTERACTIONS_KEY);
              } else {
                await AsyncStorage.setItem(CONFETTI_INTERACTIONS_KEY, JSON.stringify([...pending]));
              }
            }
          }

          pendingRef.current = pending;
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Old format: { [activity]: true } dict of *completed* activities.
          // Migrate: pending = all activities NOT marked true in the old dict.
          const completed = new Set(
            Object.entries(parsed as Record<string, unknown>)
              .filter(([, v]) => v === true)
              .map(([k]) => k)
          );
          const pending = new Set(ALL_CONFETTI_ACTIVITIES.filter((a) => !completed.has(a)));
          pendingRef.current = pending;

          if (pending.size === 0) {
            await AsyncStorage.removeItem(CONFETTI_INTERACTIONS_KEY);
          } else {
            await AsyncStorage.setItem(CONFETTI_INTERACTIONS_KEY, JSON.stringify([...pending]));
          }
        } else {
          pendingRef.current = new Set();
        }
      } catch (e) {
        console.error('Failed to load confetti interactions state', e);
        pendingRef.current = new Set();
      } finally {
        loadStateGate.resolve();
      }
    };

    void loadState();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadStateGate]);

  const completeActivity = useCallback(
    async (activity: ConfettiActivity): Promise<boolean> => {
      await loadStateGate.promise;

      const pending = pendingRef.current;

      // Fast path: nothing pending.
      if (!pending || pending.size === 0 || !pending.has(activity)) {
        return false;
      }

      pending.delete(activity);

      try {
        if (pending.size === 0) {
          await AsyncStorage.removeItem(CONFETTI_INTERACTIONS_KEY);
        } else {
          await AsyncStorage.setItem(CONFETTI_INTERACTIONS_KEY, JSON.stringify([...pending]));
        }
      } catch (e) {
        console.error('Failed to save confetti interactions state', e);
      }

      return true;
    },
    [loadStateGate]
  );

  return (
    <ConfettiInteractionsContext.Provider value={{ completeActivity }}>
      {children}
    </ConfettiInteractionsContext.Provider>
  );
};
