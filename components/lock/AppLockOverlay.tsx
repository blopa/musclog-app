import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LockScreen } from '@/components/lock/LockScreen';
import { useOptionalAppLock } from '@/context/AppLockContext';
import { useTheme } from '@/hooks/useTheme';

/**
 * Covers whatever it is drawn over:
 * - with "lock the whole app" on and no authentication yet, the lock screen;
 * - with any lock on while the app is in the background, a blank privacy cover, so the app
 *   switcher's snapshot shows no records;
 * - while the lock settings are still loading with nothing mirrored, the same blank cover — the
 *   whole app may be locked, but prompting would ask everyone without a lock to authenticate.
 *
 * Rendered once at the root AND inside every native Modal (`components/theme/Modal`): a Modal is
 * its own native window above the root view, so the root overlay alone could never cover a sheet
 * that was open when the app locked.
 */
export function AppLockOverlay() {
  const { t } = useTranslation();
  const theme = useTheme();
  const lock = useOptionalAppLock();
  if (!lock) {
    return null;
  }

  const locked = lock.isLocked('app');
  if (!locked && !lock.obscured) {
    return null;
  }

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      style={{ zIndex: 9999, elevation: 9999, backgroundColor: theme.colors.background.primary }}
      accessibilityViewIsModal
    >
      {locked && !lock.pending ? (
        <LockScreen title={t('cycle.lock.appTitle')} description={t('cycle.lock.appDescription')} />
      ) : (
        <Lock size={32} color={theme.colors.text.tertiary} />
      )}
    </View>
  );
}
