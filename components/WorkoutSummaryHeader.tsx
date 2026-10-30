import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function WorkoutSummaryHeader() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <>
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          textAlign: 'center',
          marginBottom: theme.spacing.padding.sm,
        }}
      >
        {t('workoutSummary.youCrushedIt')}
      </Text>

      {/* Subtitle */}
      <Text className="mb-10 text-center text-sm font-medium text-text-secondary">
        {t('workoutSummary.workoutSaved')}
      </Text>
    </>
  );
}
