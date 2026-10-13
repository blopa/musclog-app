import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LockScreen } from '@/components/lock/LockScreen';
import { useAppLock } from '@/context/AppLockContext';

/** Covers the whole app while "lock the whole app" is on and the device has not authenticated. */
export function AppLockOverlay() {
  const { t } = useTranslation();
  const { isLocked } = useAppLock();

  if (!isLocked('app')) {
    return null;
  }

  return (
    <View
      className="bg-background-primary absolute inset-0"
      style={{ zIndex: 9999, elevation: 9999 }}
      accessibilityViewIsModal
    >
      <LockScreen title={t('cycle.lock.appTitle')} description={t('cycle.lock.appDescription')} />
    </View>
  );
}
