import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { ONBOARDING_COMPLETED } from '@/constants/misc';

const STORAGE_KEY = 'confetti_interactions_state';

export enum ConfettiActivity {
  ONBOARDING_COMPLETED = 'onboarding_completed',
  FIRST_NUTRITION_LOG = 'first_nutrition_log',
  FIRST_MANUAL_NUTRITION_GOAL = 'first_manual_nutrition_goal',
  FIRST_FITNESS_GOAL = 'first_fitness_goal',
  FIRST_WORKOUT_CREATED = 'first_workout_created',
  FIRST_MEAL_CREATED = 'first_meal_created',
  ONBOARDING_CONFIRMED = 'onboarding_confirmed',
}

interface ConfettiInteractionsContextType {
  completedActivities: Record<string, boolean>;
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
  const [completedActivities, setCompletedActivities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let state = stored ? JSON.parse(stored) : {};

        // If onboarding was already completed before this feature was added,
        // mark it as confirmed so we don't show confetti to existing users.
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_COMPLETED);
        if (onboardingDone === 'true' && !state[ConfettiActivity.ONBOARDING_CONFIRMED]) {
          state = { ...state, [ConfettiActivity.ONBOARDING_CONFIRMED]: true };
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }

        setCompletedActivities(state);
      } catch (e) {
        console.error('Failed to load confetti interactions state', e);
      }
    };
    loadState();
  }, []);

  const completeActivity = useCallback(
    async (activity: ConfettiActivity): Promise<boolean> => {
      if (completedActivities[activity]) {
        return false;
      }

      const newState = { ...completedActivities, [activity]: true };
      setCompletedActivities(newState);

      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error('Failed to save confetti interactions state', e);
      }

      return true;
    },
    [completedActivities]
  );

  return (
    <ConfettiInteractionsContext.Provider value={{ completedActivities, completeActivity }}>
      {children}
    </ConfettiInteractionsContext.Provider>
  );
};
