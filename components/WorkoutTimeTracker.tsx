import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { useSessionTotalTime } from '@/hooks/useSessionTotalTime';
import { useTheme } from '@/hooks/useTheme';
import { fitLineFontSize } from '@/utils/fitText';
import { formatDuration } from '@/utils/workout';

import { MenuButton } from './theme/MenuButton';

type WorkoutTimeTrackerProps = {
  onClose?: () => void;
  onOptionsPress?: () => void;
  startTime?: number; // Timestamp in milliseconds
  initialTime?: { hours: number; minutes: number; seconds: number };
};

export function WorkoutTimeTracker({
  onClose,
  onOptionsPress,
  startTime,
  initialTime = { hours: 0, minutes: 0, seconds: 0 },
}: WorkoutTimeTrackerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const time = useSessionTotalTime({ startTime, initialTime });
  // The clock is one line whatever the width: beside two 48px buttons a narrow phone at large text
  // has less room than "00:00:00" needs at the design size, so it shrinks to the slot it was given.
  const { fontScale } = useWindowDimensions();
  const [clockWidth, setClockWidth] = useState<number | null>(null);
  const clock = formatDuration(time.hours, time.minutes, time.seconds);
  const clockFontSize = fitLineFontSize(clock, clockWidth, {
    maxSize: theme.typography.fontSize['4xl'],
    minSize: theme.typography.fontSize['2xl'],
    fontScale,
  });

  return (
    <View className="flex-row items-center justify-between p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        className="h-12 w-12 items-center justify-center"
        onPress={onClose}
      >
        <X size={theme.iconSize.xl} color={theme.colors.text.primary} />
      </Pressable>
      <View
        className="min-w-0 flex-1 items-center"
        onLayout={(e) => setClockWidth(e.nativeEvent.layout.width)}
      >
        <Text
          className="font-bold tabular-nums text-text-primary"
          style={{ fontSize: clockFontSize }}
        >
          {clock}
        </Text>
        <Text className="mt-1 text-sm font-semibold text-accent-primary">
          {t('workoutSession.totalTime')}
        </Text>
      </View>
      <MenuButton
        size="lg"
        color={theme.colors.text.primary}
        onPress={onOptionsPress}
        className="h-12 w-12"
      />
    </View>
  );
}
