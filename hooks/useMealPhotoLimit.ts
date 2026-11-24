import { useEffect, useState } from 'react';

import AiService from '@/services/AiService';
import { MAX_MEAL_PHOTOS, photoLimit } from '@/utils/mealPhotoDraft';

/**
 * How many photos one AI meal estimate may carry right now: at most `MAX_MEAL_PHOTOS`, held to what
 * the provider takes. Musclog Iron advertises its limit in `/v1/config` (one photo when the Worker
 * does not say); every other provider takes the maximum. Re-read each time the camera opens, so a
 * provider change in settings applies without a restart, and never blocks the camera: until it is
 * read, or when it cannot be, the answer is the safe one-photo limit for Musclog Iron and the
 * maximum for the rest.
 */
export function useMealPhotoLimit(active: boolean): number {
  const [limit, setLimit] = useState(MAX_MEAL_PHOTOS);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    const read = async () => {
      try {
        const config = await AiService.getAiConfig();
        if (config?.provider === 'hosted') {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const hostedImage: typeof import('@/utils/hostedImage') = require('@/utils/hostedImage');
          const providerMax = await hostedImage.loadHostedMaxImages();
          if (!cancelled) {
            setLimit(photoLimit(providerMax));
          }

          return;
        }

        if (!cancelled) {
          setLimit(photoLimit(undefined));
        }
      } catch {
        if (!cancelled) {
          setLimit(photoLimit(undefined));
        }
      }
    };

    void read();

    return () => {
      cancelled = true;
    };
  }, [active]);

  return limit;
}
