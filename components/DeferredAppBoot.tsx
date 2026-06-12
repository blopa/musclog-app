import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';

import { captureBootException } from '@/utils/bootErrorReporting';

/**
 * Loads DB-heavy boot code after the first React commit so the native splash
 * does not wait on WatermelonDB/SQLite module initialization.
 */
export function DeferredAppBoot() {
  const [Boot, setBoot] = useState<ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;

    import('@/components/AppBoot')
      .then((mod) => {
        if (mounted) {
          setBoot(() => mod.AppBoot);
        }
      })
      .catch((err) => captureBootException(err, 'AppBoot.deferredLoad'));

    return () => {
      mounted = false;
    };
  }, []);

  return Boot ? <Boot /> : null;
}
