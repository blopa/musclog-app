import { useEffect, useState } from 'react';

import { getFreeDiskBytes, type LocalModelStore } from '@/services/localModels/modelStore';
import { checkSpace, type LocalModelSelection } from '@/utils/localModels/install';

/**
 * Reads free disk bytes and checks whether the selected local model files fit.
 * Shared by `LocalModelCard` and the on-device AI onboarding options screen.
 */
export function useLocalModelSpace(
  store: LocalModelStore,
  selection: LocalModelSelection,
  refreshKey?: unknown
) {
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [space, setSpace] = useState(() => checkSpace(null, store.manifest, selection));

  useEffect(() => {
    let cancelled = false;
    void getFreeDiskBytes().then((bytes) => {
      if (!cancelled) {
        setFreeBytes(bytes);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void store.getSpaceCheck(selection).then((result) => {
      if (!cancelled) {
        setSpace(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [store, selection, refreshKey]);

  return { freeBytes, space };
}
