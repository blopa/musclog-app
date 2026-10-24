import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCK_AREA_COPY } from '@/components/lock/lockAreas';
import { LockScreen } from '@/components/lock/LockScreen';
import type { AppLockArea } from '@/constants/settings';
import { useAppLock } from '@/context/AppLockContext';

type AreaLockGateProps = {
  /** The area(s) this screen shows records from; a screen mixing two asks for the first locked. */
  area: AppLockArea | readonly AppLockArea[];
  children: ReactNode;
};

/**
 * Wraps a screen of one lockable area. While that area's lock is on and the device has not
 * authenticated it shows the lock instead of the content, so the records never render first.
 * The screen's chrome (navigation) stays outside it, which is what lets someone who cancels the
 * prompt still leave. Locking the whole app is the root overlay's job, not this component's.
 */
export function AreaLockGate({ area, children }: AreaLockGateProps) {
  const { t } = useTranslation();
  const { isLocked } = useAppLock();
  const areas = typeof area === 'string' ? [area] : area;
  const locked = areas.find((candidate) => isLocked(candidate));

  if (locked) {
    const copy = LOCK_AREA_COPY[locked];

    return <LockScreen title={t(copy.lockedTitleKey)} description={t(copy.lockedDescriptionKey)} />;
  }

  return <>{children}</>;
}
