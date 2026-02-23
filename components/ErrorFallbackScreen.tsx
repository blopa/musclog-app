import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

type ErrorFallbackScreenProps = {
  error: unknown;
  resetError?: () => void;
};

export function ErrorFallbackScreen({ error, resetError }: ErrorFallbackScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const handleReload = useCallback(() => {
    Sentry.captureMessage('User requested reload after error');
    if (resetError) {
      resetError();
    } else {
      router.replace('/');
    }
  }, [resetError, router]);

  return (
    <View className="flex-1 items-center justify-center bg-bg-primary p-6">
      <Text className="mb-2 text-center text-xl font-semibold text-text-primary">
        {t('errors.somethingWentWrong', 'Something went wrong')}
      </Text>
      <Text className="mb-6 text-center text-sm text-text-secondary">
        {error instanceof Error
          ? error.message
          : t('errors.genericDescription', 'An unexpected error occurred.')}
      </Text>
      <Pressable
        onPress={handleReload}
        className="rounded-lg bg-accent-primary px-6 py-3 active:opacity-80"
      >
        <Text className="text-base font-semibold text-white">{t('errors.reload', 'Reload')}</Text>
      </Pressable>
    </View>
  );
}
