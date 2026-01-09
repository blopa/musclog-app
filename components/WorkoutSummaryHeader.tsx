import React from 'react';
import { Text } from 'react-native';
import { GradientText } from './GradientText';

export function WorkoutSummaryHeader() {
  return (
    <>
      <GradientText
        colors={['#c7d2fe', '#ffffff', '#a7f3d0']}
        style={{
          fontSize: 36,
          fontWeight: '800',
          textAlign: 'center',
          letterSpacing: -0.5,
          marginBottom: 8,
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
