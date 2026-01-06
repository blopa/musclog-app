import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { X, MoreVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type WorkoutTimeTrackerProps = {
  onClose?: () => void;
  onOptionsPress?: () => void;
  initialTime?: { hours: number; minutes: number; seconds: number };
};

export function WorkoutTimeTracker({
  onClose,
  onOptionsPress,
  initialTime = { hours: 0, minutes: 0, seconds: 0 },
}: WorkoutTimeTrackerProps) {
  const { t } = useTranslation();
  const [time, setTime] = useState(initialTime);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => {
        let newSeconds = prev.seconds + 1;
        let newMinutes = prev.minutes;
        let newHours = prev.hours;

        if (newSeconds >= 60) {
          newSeconds = 0;
          newMinutes += 1;
        }
        if (newMinutes >= 60) {
          newMinutes = 0;
          newHours += 1;
        }

        return { hours: newHours, minutes: newMinutes, seconds: newSeconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
      <Pressable className="h-12 w-12 items-center justify-center" onPress={onOptionsPress}>
        <MoreVertical size={theme.iconSize.lg} color={theme.colors.text.primary} />
      </Pressable>
    </View>
  );
}
