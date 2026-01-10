import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { MoreVertical, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { StartWorkoutButton } from './StartWorkoutButton';

type FeaturedWorkoutCardProps = {
  name: string;
  lastCompleted: string;
  exerciseCount: number;
  duration: string;
  image: ImageSourcePropType;
  onStart?: () => void;
  onMore?: () => void;
  onArchive?: () => void;
  variant?: 'featured' | 'standard';
};

export function WorkoutCard({
  name,
  lastCompleted,
  exerciseCount,
  duration,
  image,
  onStart,
  onMore,
  // TODO: implement standard variant
  variant = 'featured',
}: FeaturedWorkoutCardProps) {
  const { t } = useTranslation();

  return (
    <View
      className="rounded-3xl border-2 bg-bg-overlay p-5"
      style={{ borderColor: theme.colors.border.blue }}>
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-1">
          <View className="mb-3 inline-flex flex-row items-center gap-1.5 self-start rounded-full bg-accent-primary/20 px-3 py-1">
            <Clock size={theme.iconSize.xs} color={theme.colors.accent.primary} />
            <Text className="text-xs font-bold uppercase text-accent-primary">{lastCompleted}</Text>
          </View>
          <Text className="mb-2 text-2xl font-bold text-text-primary">{name}</Text>
          <Text className="text-sm text-text-secondary">
            {exerciseCount} {t('workouts.exercises')} • {duration}
          </Text>
        </View>
        <View
          className="ml-4 h-20 w-20 overflow-hidden rounded-2xl"
          style={{ backgroundColor: theme.colors.background.iconDark }}>
          <Image source={image} className="h-full w-full opacity-70" resizeMode="cover" />
        </View>
      </View>

      <View className="flex-row gap-3">
        <StartWorkoutButton variant="primary" onPress={onStart} />
        <Pressable
          className="w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: theme.colors.background.iconDark }}
          onPress={onMore}>
          <MoreVertical size={theme.iconSize.sm} color={theme.colors.text.secondary} />
        </Pressable>
      </View>
    </View>
  );
}
