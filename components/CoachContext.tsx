import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { CoachModal } from './modals/CoachModal';

type CoachContextType = {
  openCoach: () => void;
};

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  const openCoach = useCallback(() => setIsVisible(true), []);

  return (
    <CoachContext.Provider value={{ openCoach }}>
      {children}
      {isVisible ? <CoachModal visible={isVisible} onClose={() => setIsVisible(false)} /> : null}
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
