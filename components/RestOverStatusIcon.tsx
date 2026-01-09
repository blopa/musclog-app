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
          backgroundColor: 'rgba(41, 224, 142, 0.2)',
          transform: [{ scale: glowAnim }],
        }}
      />
      <View
        className="relative z-10 h-24 w-24 items-center justify-center rounded-full border"
        style={{
          backgroundColor: theme.colors.background.cardDark,
          borderColor: 'rgba(41, 224, 142, 0.2)',
          shadowColor: theme.colors.accent.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 10,
        }}>
        <Dumbbell size={48} color={theme.colors.accent.primary} strokeWidth={1.5} />
      </View>
      {/* Red Alert Badge */}
      <View
        className="absolute -right-1 -top-1 z-20 h-8 w-8 items-center justify-center rounded-full border-4"
        style={{
          backgroundColor: theme.colors.status.error,
          borderColor: theme.colors.background.primary,
        }}>
        <AlertCircle size={16} color={theme.colors.text.white} strokeWidth={3} />
      </View>
    </View>
  );
}
