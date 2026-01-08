import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { Archive, MoreVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { StartWorkoutButton } from './StartWorkoutButton';

type WorkoutCardProps = {
  name: string;
  lastCompleted: string;
  exerciseCount: number;
  duration: string;
  image: ImageSourcePropType;
  onStart?: () => void;
  onArchive?: () => void;
  onMore?: () => void;
};

export function WorkoutCard({
  name,
  lastCompleted,
  exerciseCount,
  duration,
  image,
  onStart,
  onArchive,
  onMore,
}: WorkoutCardProps) {
  const { t } = useTranslation();

  return (
    <View className="rounded-3xl border border-border-light bg-bg-overlay p-5">
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-2 text-sm" style={{ color: theme.colors.text.gray500 }}>
            {t('workouts.last')}: {lastCompleted}
          </Text>
          <Text className="mb-2 text-2xl font-bold text-text-primary">{name}</Text>
          <Text className="text-sm text-text-secondary">
            {exerciseCount} {t('workouts.exercises')} • {duration}
          </Text>
        </View>
        <View
          className="ml-4 h-20 w-20 overflow-hidden rounded-2xl"
          style={{ backgroundColor: theme.colors.background.iconDark }}>
          <Image source={image} className="h-full w-full" resizeMode="cover" />
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <Pressable className="flex-row items-center gap-2" onPress={onArchive}>
          <Archive size={theme.iconSize.sm} color={theme.colors.text.secondary} />
          <Text className="text-sm text-text-secondary">{t('workouts.archive')}</Text>
        </Pressable>
        <StartWorkoutButton variant="secondary" onPress={onStart} />
        {onMore && (
          <Pressable
            className="w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: theme.colors.background.iconDark }}
            onPress={onMore}>
            <MoreVertical size={theme.iconSize.sm} color={theme.colors.text.secondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
