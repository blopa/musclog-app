import { useCallback, useState } from 'react';

import { ConfettiActivity, useConfettiInteractions } from '@/context/ConfettiInteractionsContext';

export function useConfettiTrigger() {
  const { completeActivity, completedActivities } = useConfettiInteractions();
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(
    (activity: ConfettiActivity) => {
      const isFirst = !completedActivities[activity];
      completeActivity(activity);
      if (isFirst) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    },
    [completeActivity, completedActivities]
  );

  return { triggerConfetti, showConfetti };
}
