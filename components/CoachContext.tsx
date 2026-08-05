import { useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { useSettings } from '@/hooks/useSettings';

import { AINotConfiguredModal } from './modals/AINotConfiguredModal';
import { CoachModal } from './modals/CoachModal';
import MyMealsModal from './modals/MyMealsModal';

export type OpenCoachOptions = {
  /** Seeds the chat composer without sending (e.g. "Track this" from a note). */
  composerText?: string;
  /** One of the CHAT_INTENTION constants; armed when the coach opens. */
  intention?: string;
};

type CoachContextType = {
  /**
   * Never pass this straight to an `onPress` handler — React Native supplies a
   * `GestureResponderEvent` as the first argument, which would be read as `options`.
   * Wrap it: `() => openCoach()`.
   */
  openCoach: (options?: OpenCoachOptions) => void;
};

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAiConfigured } = useSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [isNotConfiguredVisible, setIsNotConfiguredVisible] = useState(false);
  const [isMyMealsVisible, setIsMyMealsVisible] = useState(false);
  const [openOptions, setOpenOptions] = useState<OpenCoachOptions | null>(null);

  const openCoach = useCallback(
    (options?: OpenCoachOptions) => {
      setOpenOptions(options ?? null);
      if (isAiConfigured) {
        setIsVisible(true);
      } else {
        // CoachModal never mounts here, so no intention is armed for an unconfigured user.
        setIsNotConfiguredVisible(true);
      }
    },
    [isAiConfigured]
  );

  const closeCoach = useCallback(() => {
    setIsVisible(false);
    setOpenOptions(null);
  }, []);

  const openMyMealsFromCoach = useCallback(() => {
    setIsMyMealsVisible(true);
  }, []);

  const handleCloseMyMeals = useCallback(() => setIsMyMealsVisible(false), []);

  const contextValue = useMemo(() => ({ openCoach }), [openCoach]);

  return (
    <CoachContext.Provider value={contextValue}>
      {children}
      {isVisible ? (
        <CoachModal
          visible={isVisible}
          onClose={closeCoach}
          onOpenMyMeals={openMyMealsFromCoach}
          initialComposerText={openOptions?.composerText}
          initialIntention={openOptions?.intention}
        />
      ) : null}
      <AINotConfiguredModal
        visible={isNotConfiguredVisible}
        onClose={() => setIsNotConfiguredVisible(false)}
        onOpenAISettings={() => {
          setIsNotConfiguredVisible(false);
          router.navigate('/app/settings');
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
