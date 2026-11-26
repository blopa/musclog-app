import { TriangleAlert } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { clearFatalError, getFatalError, subscribeFatalError } from '@/utils/fatalErrorStore';

/**
 * What a release build shows after an uncaught JS error, instead of closing (see
 * `utils/fatalErrorStore.ts`). The error has already gone to Sentry by the time it is shown, when
 * crash reports are on. Restarting is the only way on: whatever was running when it threw may have
 * stopped half way, so the app is not trusted to carry on.
 *
 * Drawn at the app's root AND inside `components/theme/Modal`, like `AppLockOverlay`: a native
 * modal is its own window, and an error while one was open would otherwise show behind it. Kept
 * light for that reason; the reload code is required on press only.
 */
export function FatalErrorOverlay() {
  const fatal = useSyncExternalStore(subscribeFatalError, getFatalError, getFatalError);

  if (!fatal) {
    return null;
  }

  return <FatalErrorScreen />;
}

function restartAfterFatalError(): void {
  clearFatalError();
  // Inline require keeps expo-router and expo-updates out of every modal's import graph.
  const { reloadApp } = require('@/utils/app') as typeof import('@/utils/app');

  void reloadApp();
}

function FatalErrorScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      className="absolute inset-0 items-center justify-center gap-4 p-6"
      style={{ zIndex: 10000, elevation: 10000, backgroundColor: theme.colors.background.primary }}
      accessibilityViewIsModal
    >
      <TriangleAlert size={theme.iconSize.xl} color={theme.colors.text.secondary} />
      <Text
        className="text-center text-xl font-semibold text-text-primary"
        accessibilityRole="header"
      >
        {t('errors.somethingWentWrong')}
      </Text>
      <Button
        label={t('errors.reload')}
        onPress={restartAfterFatalError}
        variant="accent"
        // Button defaults to alignSelf: 'flex-start', which beats the parent's items-center.
        style={{ alignSelf: 'center' }}
      />
    </View>
  );
}
