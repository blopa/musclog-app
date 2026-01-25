import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { MenuButton } from './theme/MenuButton';
import { useSessionTotalTime } from '../hooks/useSessionTotalTime';

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
  const { t } = useTranslation();
  const time = useSessionTotalTime({ startTime, initialTime });

  const formatTime = (value: number) => String(value).padStart(2, '0');

  return (
    <View className="flex-row items-center justify-between p-4">
      <Pressable className="h-12 w-12 items-center justify-center" onPress={onClose}>
        <X size={theme.iconSize.xl} color={theme.colors.text.primary} />
      </Pressable>
      <View className="items-center">
        <Text className="text-5xl font-bold tracking-tight text-text-primary">
          {formatTime(time.hours)}:{formatTime(time.minutes)}:{formatTime(time.seconds)}
        </Text>
        <Text className="mt-1 text-sm font-semibold tracking-wider text-accent-primary">
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
