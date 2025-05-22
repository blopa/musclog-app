import { useState, useCallback, useEffect } from 'react';

type FocusState = 'idle' | 'focusing';

export const useWebTapToFocus = () => {
  const [focusState, setFocusState] = useState<FocusState>('idle');

  const handleTapToFocus = useCallback(() => {
    setFocusState('focusing');
  }, []);

  useEffect(() => {
    if (focusState === 'focusing') {
      const timer = setTimeout(() => {
        setFocusState('idle');
      }, 50); // Short delay to ensure state change is picked up
      return () => clearTimeout(timer);
    }
  }, [focusState]);

  return { focusState, handleTapToFocus };
};
