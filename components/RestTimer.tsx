import { Activity } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { DEFAULT_REST_SECONDS } from '@/constants/restTimer';
import { useTheme } from '@/hooks/useTheme';
import type { RestPhase } from '@/utils/restTimer';

type RestTimerProps = {
  restTime: number; // in seconds
  rotationAnim: Animated.Value;
  initialRestTime?: number; // Initial rest time for progress calculation
  /** Where the countdown is: resting, in the last seconds ("get ready"), or finished. */
  phase?: RestPhase;
};

// The digits are sized from the ring, not fixed: on a wide screen they grow with it instead of
// leaving a small number in a big circle. The ring is square, so its width is its diameter.
const DIGITS_PER_RING_WIDTH = 0.26;

export function RestTimer({
  restTime,
  rotationAnim,
  initialRestTime,
  phase = 'resting',
}: RestTimerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [ringWidth, setRingWidth] = useState(0);
  const digitsSize =
    ringWidth > 0
      ? Math.round(ringWidth * DIGITS_PER_RING_WIDTH)
      : Number(theme.typography.fontSize['7xl']);

  // Colour alone cannot carry this: the phase is also a word, and is announced to screen readers.
  const phaseColor = {
    resting: theme.colors.accent.secondary,
    getReady: theme.colors.status.warning,
    done: theme.colors.status.success,
  }[phase];
  const phaseLabel = {
    resting: t('restTimer.resting'),
    getReady: t('restTimer.getReady'),
    done: t('restTimer.go'),
  }[phase];

  const formatTime = (value: number) => String(value).padStart(2, '0');
  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${formatTime(mins)}:${formatTime(secs)}`;
  };

  // Calculate progress for circular ring (0 to 1)
  const totalRestTime = initialRestTime || DEFAULT_REST_SECONDS;
  const progress = totalRestTime > 0 ? Math.max(0, Math.min(1, restTime / totalRestTime)) : 0;
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
      onLayout={(event) => setRingWidth(event.nativeEvent.layout.width)}
      accessibilityRole="timer"
      accessibilityLabel={t('restTimer.a11yRemaining', { time: formatRestTime(restTime) })}
    >
      {/* Background glow */}
      <View className="absolute inset-4 overflow-hidden rounded-full">
        <View
          style={{
            flex: 1,
            borderRadius: theme.borderRadius.full,
            backgroundColor: theme.colors.accent.primary10,
          }}
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
            stroke={phaseColor}
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
          className="font-bold tabular-nums leading-none text-text-primary"
          style={{ fontSize: digitsSize }}
        >
          {formatRestTime(restTime)}
        </Text>
        <View className="mt-2 flex-row items-center gap-2">
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Activity size={theme.iconSize.lg} color={phaseColor} />
          </Animated.View>
          {/* A polite live region: spoken when the phase changes, not every second. */}
          <Text
            className="text-lg font-semibold"
            style={{ color: phase === 'resting' ? theme.colors.text.secondary : phaseColor }}
            accessibilityLiveRegion="polite"
            testID="rest-phase-label"
          >
            {phaseLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
