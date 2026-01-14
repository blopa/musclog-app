import React from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GradientText } from './GradientText';
import { theme } from '../theme';

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
          letterSpacing: -0.5,
          marginBottom: theme.spacing.padding.sm,
        }}>
        {t('workoutSummary.youCrushedIt')}
      </GradientText>

      {/* Subtitle */}
      <Text className="mb-10 text-center text-sm font-medium text-text-secondary">
        {t('workoutSummary.feedbackSubmitted')}
      </Text>
    </>
  );
}
