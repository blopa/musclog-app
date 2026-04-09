import { useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { useSettings } from '@/hooks/useSettings';

import { AINotConfiguredModal } from './modals/AINotConfiguredModal';
import { CoachModal } from './modals/CoachModal';
import MyMealsModal from './modals/MyMealsModal';

type CoachContextType = {
  openCoach: () => void;
};

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAiConfigured } = useSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [isNotConfiguredVisible, setIsNotConfiguredVisible] = useState(false);
  const [isMyMealsVisible, setIsMyMealsVisible] = useState(false);

  const openCoach = useCallback(() => {
    if (isAiConfigured) {
      setIsVisible(true);
    } else {
      setIsNotConfiguredVisible(true);
    }
  }, [isAiConfigured]);

  const openMyMealsFromCoach = useCallback(() => {
    setIsMyMealsVisible(true);
  }, []);

  const handleCloseMyMeals = useCallback(() => setIsMyMealsVisible(false), []);

  return (
    <CoachContext.Provider value={{ openCoach }}>
      {children}
      {isVisible ? (
        <CoachModal
          visible={isVisible}
          onClose={() => setIsVisible(false)}
          onOpenMyMeals={openMyMealsFromCoach}
        />
      ) : null}
      <AINotConfiguredModal
        visible={isNotConfiguredVisible}
        onClose={() => setIsNotConfiguredVisible(false)}
        onOpenAISettings={() => {
          setIsNotConfiguredVisible(false);
          router.navigate('/settings');
        }}
      />
      <MyMealsModal visible={isMyMealsVisible} onClose={handleCloseMyMeals} />
    </CoachContext.Provider>
  );
}

export function useCoach() {
  const context = useContext(CoachContext);
  if (context === undefined) {
    throw new Error('useCoach must be used within a CoachProvider');
  }
  return context;
}
