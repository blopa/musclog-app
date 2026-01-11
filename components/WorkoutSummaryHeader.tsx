import React from 'react';
import { Text } from 'react-native';
import { GradientText } from './GradientText';
import { theme } from '../theme';

export function WorkoutSummaryHeader() {
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
        You Crushed It!
      </GradientText>

      {/* Subtitle */}
      <Text className="mb-10 text-center text-sm font-medium text-text-secondary">
        Workout feedback submitted successfully.
      </Text>
    </>
  );
}
