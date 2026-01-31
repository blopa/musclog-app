import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { theme } from '../theme';
import { GradientText } from './GradientText';

export function WorkoutSummaryHeader() {
  const { t } = useTranslation();
  return (
    <>
      <GradientText
        colors={theme.colors.gradients.celebrationGlow}
        style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.extrabold,
          textAlign: 'center',
          letterSpacing: theme.typography.letterSpacing.tight,
          marginBottom: theme.spacing.padding.sm,
        }}
      >
        {t('workoutSummary.youCrushedIt')}
      </GradientText>

      {/* Subtitle */}
      <Text className="mb-10 text-center text-sm font-medium text-text-secondary">
        {t('workoutSummary.feedbackSubmitted')}
      </Text>
    </>
  );
}
