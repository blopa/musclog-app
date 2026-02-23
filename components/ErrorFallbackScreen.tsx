import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

type ErrorFallbackScreenProps = {
  error: unknown;
  resetError?: () => void;
};

export function ErrorFallbackScreen({ error, resetError }: ErrorFallbackScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();

  const handleReload = useCallback(() => {
    Sentry.captureMessage('User requested reload after error');
    if (resetError) {
      resetError();
    } else {
      router.replace('/');
    }
  }, [resetError, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        {t('errors.somethingWentWrong', 'Something went wrong')}
      </Text>
      <Text style={[styles.message, { color: theme.colors.text.secondary }]}>
        {error instanceof Error
          ? error.message
          : t('errors.genericDescription', 'An unexpected error occurred.')}
      </Text>
      <Pressable
        onPress={handleReload}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.accent.primary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={styles.buttonText}>{t('errors.reload', 'Reload')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
