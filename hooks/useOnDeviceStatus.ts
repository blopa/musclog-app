import { useEffect, useSyncExternalStore } from 'react';

import {
  getOnDeviceStatusSnapshot,
  refreshOnDeviceStatus,
  subscribeOnDeviceStatus,
} from '@/services/localModels/onDeviceStatusStore';
import type { OnDeviceStatus } from '@/utils/onDeviceStatus';

/**
 * On-device AI's status. Like `usePremium`, it requests nothing on mount unless `refresh` says
 * the screen shows it: a component that only reads the state costs no system call.
 */
export function useOnDeviceStatus({ refresh = false }: { refresh?: boolean } = {}): OnDeviceStatus {
  useEffect(() => {
    if (refresh) {
      void refreshOnDeviceStatus();
    }
  }, [refresh]);

  return useSyncExternalStore(
    subscribeOnDeviceStatus,
    getOnDeviceStatusSnapshot,
    getOnDeviceStatusSnapshot
  );
}
