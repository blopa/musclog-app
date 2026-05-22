import { useCallback, useState } from 'react';

import { ConfettiActivity, useConfettiInteractions } from '@/context/ConfettiInteractionsContext';

export function useConfettiTrigger() {
  const { completeActivity } = useConfettiInteractions();
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(
    (activity: ConfettiActivity, delay?: number) => {
      completeActivity(activity).then((isFirst) => {
        if (!isFirst) {
          return;
        }

        const activate = () => {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        };
        if (delay) {
          setTimeout(activate, delay);
        } else {
          activate();
        }
      });
    },
    [completeActivity]
  );

  return { triggerConfetti, showConfetti };
}
