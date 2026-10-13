import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LockScreen } from '@/components/lock/LockScreen';
import { useAppLock } from '@/context/AppLockContext';

/**
 * Wraps a cycle screen. With "cycle area" lock on it shows the lock instead of the content, so
 * reproductive records never render until the device has authenticated.
 */
export function CycleLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isLocked } = useAppLock();

  if (isLocked('cycle')) {
    return (
      <LockScreen
        title={t('cycle.lock.cycleTitle')}
        description={t('cycle.lock.cycleDescription')}
      />
    );
  }

  return <>{children}</>;
}
