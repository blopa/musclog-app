import { useEffect, useState } from 'react';

import { isCloudAiBlockedForAge } from '@/services/aiAccess';

/** True once the stored birthday is read and says the person is under 18. Re-read when `enabled`. */
export function useCloudAiBlockedForAge(enabled: boolean): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    isCloudAiBlockedForAge()
      .then((value) => {
        if (!cancelled) {
          setBlocked(value);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return blocked;
}
