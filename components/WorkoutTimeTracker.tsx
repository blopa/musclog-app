import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useSessionTotalTime } from '../hooks/useSessionTotalTime';
import { useTheme } from '../hooks/useTheme';
import { formatDuration } from '../utils/workout';
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

  return (
    <View className="flex-row items-center justify-between p-4">
      <Pressable className="h-12 w-12 items-center justify-center" onPress={onClose}>
        <X size={theme.iconSize.xl} color={theme.colors.text.primary} />
      </Pressable>
      <View className="items-center">
        <Text className="text-5xl font-bold tracking-tight text-text-primary">
          {formatDuration(time.hours, time.minutes, time.seconds)}
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
