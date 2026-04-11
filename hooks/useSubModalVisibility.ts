import { useEffect, useState } from 'react';

/**
 * Drop-in replacement for `useState(false)` when controlling a sub-modal's visibility.
 *
 * Automatically resets to `false` whenever the parent modal's `visible` prop becomes
 * `false`. This prevents "ghost modals" — native Modal windows that stay open after the
 * parent closes, silently intercepting all touch events on subsequent renders.
 *
 * Usage:
 *   // Instead of:
 *   const [isDetailsVisible, setIsDetailsVisible] = useState(false);
 *
 *   // Write:
 *   const [isDetailsVisible, setIsDetailsVisible] = useSubModalVisibility(visible);
 *
 * The second element is a standard React setState setter — it works exactly like the one
 * returned by useState, so no call-sites need to change.
 */
export function useSubModalVisibility(
  parentVisible: boolean
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!parentVisible) {
      setIsVisible(false);
    }
  }, [parentVisible]);

  return [isVisible, setIsVisible];
}
