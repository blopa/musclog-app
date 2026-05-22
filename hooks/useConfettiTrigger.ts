import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfettiActivity, useConfettiInteractions } from '@/context/ConfettiInteractionsContext';

export function useConfettiTrigger() {
  const { completeActivity } = useConfettiInteractions();
  const [showConfetti, setShowConfetti] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const clearTimeouts = useCallback(() => {
    if (triggerTimeoutRef.current) {
      clearTimeout(triggerTimeoutRef.current);
      triggerTimeoutRef.current = null;
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearTimeouts();
    };
  }, [clearTimeouts]);

  const triggerConfetti = useCallback(
    (activity: ConfettiActivity, delay?: number) => {
      completeActivity(activity).then((isFirst) => {
        if (!isFirst) {
          return;
        }

        const activate = () => {
          if (!isMountedRef.current) {
            return;
          }

          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
          }

          setShowConfetti(true);
          hideTimeoutRef.current = setTimeout(() => {
            hideTimeoutRef.current = null;
            if (isMountedRef.current) {
              setShowConfetti(false);
            }
          }, 5000);
        };

        if (!isMountedRef.current) {
          return;
        }

        if (triggerTimeoutRef.current) {
          clearTimeout(triggerTimeoutRef.current);
          triggerTimeoutRef.current = null;
        }

        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }

        if (delay) {
          triggerTimeoutRef.current = setTimeout(() => {
            triggerTimeoutRef.current = null;
            activate();
          }, delay);
        } else {
          activate();
        }
      });
    },
    [completeActivity]
  );

  return { triggerConfetti, showConfetti };
}
