import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { Clock, Archive } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { isToday, isYesterday } from 'date-fns';
import { theme } from '../../theme';
import { StartWorkoutButton } from '../StartWorkoutButton';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import { GenericCard } from './GenericCard';

type FeaturedWorkoutCardProps = {
  name: string;
  lastCompleted?: string;
  lastCompletedTimestamp?: number;
  exerciseCount: number;
  duration?: string;
  image: ImageSourcePropType;
  onStart?: () => void;
  onMore?: () => void;
  onArchive?: () => void;
  variant?: 'featured' | 'standard';
};

export function WorkoutCard({
  name,
  lastCompleted,
  lastCompletedTimestamp,
  exerciseCount,
  duration,
  image,
  onStart,
  onMore,
  onArchive,
  variant = 'featured',
}: FeaturedWorkoutCardProps) {
  const { t } = useTranslation();

  // Format lastCompleted with translations if timestamp is available
  const formatLastCompleted = (): string | undefined => {
    if (lastCompletedTimestamp) {
      const date = new Date(lastCompletedTimestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return t('common.today');
      } else if (diffDays === 1) {
        return t('common.yesterday');
      } else if (diffDays < 7) {
        return t('common.daysAgo', { count: diffDays });
      } else if (diffDays < 14) {
        return t('common.oneWeekAgo');
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return t('common.weeksAgo', { count: weeks });
      } else {
        const months = Math.floor(diffDays / 30);
        return t('common.monthsAgo', { count: months });
      }
    }
    // Fallback to provided string if no timestamp
    return lastCompleted;
  };

  const formattedLastCompleted = formatLastCompleted();

  return (
    <GenericCard variant="default" size="lg">
      <View className="p-5">
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1">
            {formattedLastCompleted && (
              <View className="mb-3 inline-flex flex-row items-center gap-1.5 self-start rounded-full bg-accent-primary/20 px-3 py-1">
                <Clock size={theme.iconSize.xs} color={theme.colors.accent.primary} />
                <Text className="text-xs font-bold uppercase text-accent-primary">
                  {formattedLastCompleted}
                </Text>
              </View>
            )}
            <Text className="mb-2 text-2xl font-bold text-text-primary">{name}</Text>
            <Text className="text-sm text-text-secondary">
              {exerciseCount} {t('workouts.exercises')}
              {duration && ` • ${duration}`}
            </Text>
          </View>
          <View
            className="ml-4 h-20 w-20 overflow-hidden rounded-2xl"
            style={{ backgroundColor: theme.colors.background.iconDark }}
          >
            <Image source={image} className="h-full w-full opacity-70" resizeMode="cover" />
          </View>
        </View>

        {variant === 'featured' ? (
          <View className="flex-row gap-3">
            <StartWorkoutButton variant="primary" onPress={onStart} />
            <MenuButton size="sm" onPress={onMore} className="w-14" />
          </View>
        ) : (
          <View className="flex-row gap-3">
            <Button
              label={t('workouts.archive')}
              icon={Archive}
              variant="secondary"
              size="sm"
              width="auto"
              onPress={onArchive}
            />
            <StartWorkoutButton variant="secondary" onPress={onStart} />
            <MenuButton size="sm" onPress={onMore} className="ml-auto w-14" />
          </View>
        )}
      </View>
    </GenericCard>
  );
}
