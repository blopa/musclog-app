import { LinearGradient } from 'expo-linear-gradient';
import { Star, Trophy } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function WorkoutSummaryTrophy() {
  const theme = useTheme();
  const floatAnim = useRef(new Animated.Value(0)).current;
  const star1Anim = useRef(new Animated.Value(1)).current;
  const star2Anim = useRef(new Animated.Value(1)).current;
  const star3Anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Floating animation for trophy
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Star pulse animations
    const createStarPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createStarPulse(star1Anim, 0).start();
    createStarPulse(star2Anim, 400).start();
    createStarPulse(star3Anim, 800).start();
  }, [floatAnim, star1Anim, star2Anim, star3Anim]);

  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <Animated.View
      className="relative mb-8"
      style={{
        transform: [{ translateY: floatTranslateY }],
      }}
    >
      <View
        className="relative z-10 h-32 w-32 items-center justify-center rounded-full border"
        style={{
          backgroundColor: theme.colors.status.indigo10,
          borderColor: theme.colors.background.white5,
          shadowColor: theme.colors.accent.primary,
          shadowOffset: theme.shadowOffset.zero,
          shadowOpacity: theme.shadowOpacity.light,
          shadowRadius: theme.shadowRadius['2xl'],
          elevation: theme.elevation['3xl'],
        }}
      >
        <LinearGradient
          colors={[theme.colors.status.indigo10, theme.colors.status.emerald10]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 128,
            overflow: 'hidden',
          }}
        />
        <Trophy
          size={theme.size['16']}
          color={theme.colors.accent.primary}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>

      {/* Stars */}
      <Animated.View
        className="absolute -right-2 -top-2"
        style={{
          transform: [{ scale: star1Anim }, { rotate: '12deg' }],
        }}
      >
        <Star
          size={theme.iconSize.lg}
          color={theme.colors.status.amber}
          fill={theme.colors.status.amber}
        />
      </Animated.View>
      <Animated.View
        className="absolute -bottom-1 -left-4"
        style={{
          transform: [{ scale: star2Anim }, { rotate: '-12deg' }],
        }}
      >
        <Star
          size={theme.iconSize.md}
          color={theme.colors.accent.primary}
          fill={theme.colors.accent.primary}
        />
      </Animated.View>
      <Animated.View
        className="absolute -left-2 top-0"
        style={{
          transform: [{ scale: star3Anim }, { rotate: '-45deg' }],
        }}
      >
        <Star
          size={theme.iconSize.sm}
          color={theme.colors.status.indigoLight}
          fill={theme.colors.status.indigoLight}
        />
      </Animated.View>
    </Animated.View>
  );
}
