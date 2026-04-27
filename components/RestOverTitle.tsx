import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { GradientText } from './GradientText';

export function RestOverTitle() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View className="mx-auto max-w-xs gap-3">
      <View className="flex-row flex-wrap items-center justify-center">
        <Text className="text-4xl leading-tight font-extrabold tracking-tight text-white">
          {t('restOver.restTimeIs')}{' '}
        </Text>
        <GradientText
          colors={theme.colors.gradients.restOverTitle}
          style={{
            fontSize: theme.typography.fontSize['4xl'],
            fontWeight: theme.typography.fontWeight.extrabold,
            letterSpacing: theme.typography.letterSpacing.tight,
          }}
        >
          {t('restOver.over')}
        </GradientText>
      </View>
      <Text className="text-center text-lg font-medium text-white/70">
        {t('restOver.timeToGo')}
      </Text>
    </View>
  );
}
