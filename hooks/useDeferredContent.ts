import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Returns `false` on the first render, then `true` after pending interactions
 * (e.g. navigation animations) complete.
 *
 * Use this to wrap heavy screen content so the navigation transition isn't
 * blocked by mounting expensive component trees. The screen renders a
 * lightweight skeleton first, then swaps in the real content once the
 * animation has finished.
 */
export function useDeferredContent(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  return isReady;
}
