import React, { useEffect, useRef } from 'react';
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
    <View className="w-full flex-col items-center gap-4 rounded-xl bg-white/5 p-10">
      <ActivityIndicator
        size={size}
        color={theme.colors.accent.primary}
        style={{ transform: [{ scale: size === 'large' ? 1.2 : 1 }] }}
      />
      {message && <Text className="text-sm font-medium text-accent-primary">{message}</Text>}
    </View>
  );
}
