import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../theme';
import { GradientText } from './GradientText';

export function RestOverTitle() {
  return (
    <View className="mx-auto max-w-xs gap-3">
      <View className="flex-row flex-wrap items-center justify-center">
        <Text className="text-4xl font-extrabold leading-tight tracking-tight text-white">
          Rest time is{' '}
        </Text>
        <GradientText
          colors={theme.colors.gradients.restOverTitle}
          style={{
            fontSize: theme.typography.fontSize['4xl'],
            fontWeight: theme.typography.fontWeight.extrabold,
            letterSpacing: -0.5,
          }}>
          over!
        </GradientText>
      </View>
      <Text className="text-center text-lg font-medium text-white/70">
        Time to go! Next set is up.
      </Text>
    </View>
  );
}
