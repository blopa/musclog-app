import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { theme } from '../../theme';

type ProgressIndicatorProps = {
  message?: string;
  size?: 'small' | 'large';
};

export function ProgressIndicator({
  message = 'Loading...',
  size = 'large',
}: ProgressIndicatorProps) {
  return (
    <View className="w-full flex-col items-center gap-4 rounded-3xl border border-white/10 bg-transparent p-0" style={{ minHeight: 140, justifyContent: 'center' }}>
      <View className="w-full flex-col items-center justify-center rounded-3xl border border-white/20 bg-surface-dark/60 p-10" style={{ minHeight: 140 }}>
        <ActivityIndicator
          size={size}
          color={theme.colors.accent.primary}
          style={{ transform: [{ scale: size === 'large' ? 1.5 : 1 }] }}
        />
        {message && <Text className="text-lg font-medium text-accent-primary mt-6">{message}</Text>}
      </View>
    </View>
  );
}
