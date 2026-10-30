import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { LOCK_AREA_COPY } from '@/components/lock/lockAreas';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { SETTINGS } from '@/constants/settingDefinitions';
import { APP_LOCK_SCOPES, type AppLockScope } from '@/constants/settings';
import { useAppLock } from '@/context/AppLockContext';
import { useSnackbar } from '@/context/SnackbarContext';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { canEnableAppLock } from '@/utils/appLock';
import { changeLockScope } from '@/utils/appLockScopeChange';
import { handleError } from '@/utils/handleError';

/**
 * One switch per lockable part of the app: the whole app, and the cycle, workout, nutrition and
 * progress areas on their own. Every change is itself behind the device credential, so someone
 * holding an unlocked phone cannot simply switch the lock off.
 */
export function AppLockSettings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { unlock } = useAppLock();
  const { appLockScopes } = useSettings();
  const wholeApp = appLockScopes.includes('app');

  const setScope = async (scope: AppLockScope, enabled: boolean) => {
    try {
      const result = await changeLockScope(scope, enabled, {
        canEnable: canEnableAppLock,
        unlock,
        read: () => SettingsService.get(SETTINGS.appLockScopes),
        write: (scopes) => SettingsService.set(SETTINGS.appLockScopes, scopes),
      });
      if (result === 'noCredential') {
        showSnackbar('error', t('lock.settings.noCredential'));
      }
    } catch (error) {
      handleError(error, 'AppLockSettings.setScope', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  const items = APP_LOCK_SCOPES.map((scope) => {
    const copy = LOCK_AREA_COPY[scope];
    const Icon = copy.icon;
    // The whole-app lock already asks before every area, so the individual switches are moot.
    const covered = wholeApp && scope !== 'app';

    return {
      key: scope,
      label: t(copy.labelKey),
      subtitle: covered ? t('lock.settings.coveredByApp') : t(copy.hintKey),
      icon: <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />,
      value: appLockScopes.includes(scope),
      disabled: covered,
      onValueChange: (enabled: boolean) => void setScope(scope, enabled),
    };
  });

  return (
    <View className="gap-3">
      <Text className="text-sm text-text-secondary">{t('lock.settings.hint')}</Text>
      <ToggleInput items={items} />
    </View>
  );
}
