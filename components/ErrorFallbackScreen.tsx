import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { NotificationService } from '@/services/NotificationService';
import { captureMessage } from '@/utils/sentry';

type ErrorFallbackScreenProps = {
  error: unknown;
  resetError?: () => void;
  errorInfo?: any;
};

export function ErrorFallbackScreen({ error, resetError, errorInfo }: ErrorFallbackScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(__DEV__); // Show details by default in development

  useEffect(() => {
    NotificationService.dismissActiveWorkoutNotification();
  }, []);

  const handleReload = useCallback(() => {
    captureMessage('User requested reload after error');
    if (resetError) {
      resetError();
    } else {
      router.replace('/');
    }
  }, [resetError, router]);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : null;
  const componentStack = errorInfo?.componentStack;

  return (
    <View className="flex-1 items-center justify-center bg-bg-primary p-6">
      <Text className="mb-2 text-center text-xl font-semibold text-text-primary">
        {t('errors.somethingWentWrong')}
      </Text>
      <Text className="mb-4 text-center text-sm text-text-secondary">{errorMessage}</Text>

      {__DEV__ ? (
        <View className="mb-4 w-full">
          <Pressable
            onPress={() => setShowDetails(!showDetails)}
            className="mb-2 rounded bg-bg-secondary p-2"
          >
            <Text className="text-center text-sm text-text-primary">
              {showDetails ? t('common.hide') : t('common.show')} {t('common.debugDetails')}
            </Text>
          </Pressable>

          {showDetails ? (
            <ScrollView className="max-h-64 w-full rounded bg-bg-secondary p-3">
              <Text className="mb-2 font-mono text-xs text-text-primary">
                {t('common.errorMessage')}: {errorMessage}
              </Text>

              {errorStack ? (
                <Text className="mb-2 font-mono text-xs text-text-primary">
                  {t('common.errorStack')}:{errorStack}
                </Text>
              ) : null}

              {componentStack ? (
                <Text className="mb-2 font-mono text-xs text-text-primary">
                  {t('common.componentStack')}:{componentStack}
                </Text>
              ) : null}

              <Text className="font-mono text-xs text-text-primary">
                {t('common.userAgent')}:{' '}
                {typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A'}
              </Text>
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={handleReload}
        className="rounded-lg bg-accent-primary px-6 py-3 active:opacity-80"
      >
        <Text className="text-base font-semibold text-white">{t('errors.reload')}</Text>
      </Pressable>
    </View>
  );
}
