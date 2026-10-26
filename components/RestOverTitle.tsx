import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function RestOverTitle() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View className="mx-auto max-w-xs gap-3">
      <View className="flex-row flex-wrap items-center justify-center">
        <Text className="text-4xl font-bold leading-tight text-text-primary">
          {t('restOver.restTimeIs')}{' '}
        </Text>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.fontSize['4xl'],
            fontWeight: theme.typography.fontWeight.bold,
          }}
        >
          {t('restOver.over')}
        </Text>
      </View>
      <Text className="text-center text-lg font-medium text-ink/70">{t('restOver.timeToGo')}</Text>
    </View>
  );
}
