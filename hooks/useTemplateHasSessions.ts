import { useEffect, useState } from 'react';

import { WorkoutService } from '@/database/services/WorkoutService';

/**
 * Whether a workout template has been completed at least once. False while the answer loads, when
 * there is no template, or when the lookup fails. The answer is stored with the template it was
 * computed for, so switching templates never briefly shows the previous one's.
 */
export function useTemplateHasSessions(templateId: string | undefined, enabled: boolean): boolean {
  const [result, setResult] = useState<{ templateId: string; hasSessions: boolean } | null>(null);

  useEffect(() => {
    if (!enabled || !templateId) {
      return;
    }

    let live = true;
    WorkoutService.hasCompletedSessions(templateId)
      .catch(() => false)
      .then((hasSessions) => {
        if (live) {
          setResult({ templateId, hasSessions });
        }
      });

    return () => {
      live = false;
    };
  }, [enabled, templateId]);

  return !!templateId && result?.templateId === templateId && result.hasSessions;
}
