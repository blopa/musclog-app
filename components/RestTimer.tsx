import { LinearGradient } from 'expo-linear-gradient';
import { Activity } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Animated, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { theme } from '../theme';

type RestTimerProps = {
  restTime: number; // in seconds
  rotationAnim: Animated.Value;
  initialRestTime?: number; // Initial rest time for progress calculation
};

export function RestTimer({ restTime, rotationAnim, initialRestTime }: RestTimerProps) {
  const { t } = useTranslation();

  const formatTime = (value: number) => String(value).padStart(2, '0');
  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${formatTime(mins)}:${formatTime(secs)}`;
  };

  // Calculate progress for circular ring (0 to 1)
  const totalRestTime = initialRestTime || 90; // Use provided initial time or default to 90
  const progress = totalRestTime > 0 ? Math.max(0, Math.min(1, 1 - restTime / totalRestTime)) : 0;
  const circumference = 2 * Math.PI * 46; // radius = 46
  const strokeDashoffset = circumference * (1 - progress);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      className="relative aspect-square w-full items-center justify-center"
      style={{ maxWidth: theme.maxWidth['400'] }}
    >
      {/* Background glow */}
      <View className="absolute inset-4 overflow-hidden rounded-full">
        <LinearGradient
          colors={[theme.colors.accent.primary20, theme.colors.status.purple20]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: theme.borderRadius.full }}
        />
      </View>

      {/* SVG Circular Progress */}
      <View className="h-full w-full items-center justify-center">
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          {/* Background circle */}
          <Circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={theme.colors.border.accent}
            strokeOpacity={theme.colors.opacity.medium}
            strokeWidth={theme.strokeWidth.thick}
          />
          {/* Progress circle */}
          <Circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={theme.colors.accent.secondary}
            strokeWidth={theme.strokeWidth.thick}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            opacity={1}
          />
        </Svg>
      </View>

      {/* Timer Text */}
      <View className="absolute inset-0 items-center justify-center">
        <Text
          className="font-bold tabular-nums leading-none tracking-tighter text-text-primary"
          style={{ fontSize: theme.typography.fontSize['7xl'] }}
        >
          {formatRestTime(restTime)}
        </Text>
        <View className="mt-2 flex-row items-center gap-2">
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Activity size={theme.iconSize.lg} color={theme.colors.text.secondary} />
          </Animated.View>
          <Text className="text-lg font-medium tracking-wide text-text-secondary">
            {t('restTimer.resting')}
          </Text>
        </View>
      </View>
    </View>
  );
}
