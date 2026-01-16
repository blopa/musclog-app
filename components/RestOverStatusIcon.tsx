import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Dumbbell, AlertCircle } from 'lucide-react-native';
import { theme } from '../theme';

export function RestOverStatusIcon() {
  const glowAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim]);

  return (
    <View className="relative mb-4 items-center justify-center">
      <Animated.View
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: theme.colors.status.emerald20,
          transform: [{ scale: glowAnim }],
        }}
      />
      <View
        className="relative z-10 h-24 w-24 items-center justify-center rounded-full border"
        style={{
          backgroundColor: theme.colors.background.cardDark,
          borderColor: theme.colors.status.emerald20,
          shadowColor: theme.colors.accent.primary,
          shadowOffset: theme.shadowOffset.zero,
          shadowOpacity: theme.shadowOpacity.medium,
          shadowRadius: theme.shadowRadius.xl,
          elevation: theme.elevation['2xl'],
        }}>
        <Dumbbell
          size={theme.iconSize['5xl']}
          color={theme.colors.accent.primary}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>
      {/* Red Alert Badge */}
      <View
        className="absolute -right-1 -top-1 z-20 h-8 w-8 items-center justify-center rounded-full border-4"
        style={{
          backgroundColor: theme.colors.status.error,
          borderColor: theme.colors.background.primary,
        }}>
        <AlertCircle
          size={theme.iconSize.sm}
          color={theme.colors.text.white}
          strokeWidth={theme.borderWidth.thick}
        />
      </View>
    </View>
  );
}
