import { useCallback, useState } from 'react';

import { ConfettiActivity, useConfettiInteractions } from '@/context/ConfettiInteractionsContext';

export function useConfettiTrigger() {
  const { completeActivity, completedActivities } = useConfettiInteractions();
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(
    (activity: ConfettiActivity, delay?: number) => {
      const isFirst = !completedActivities[activity];
      completeActivity(activity);
      if (isFirst) {
        const activate = () => {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        };
        if (delay) {
          setTimeout(activate, delay);
        } else {
          activate();
        }
      }
    },
    [completeActivity, completedActivities]
  );

  return { triggerConfetti, showConfetti };
}
