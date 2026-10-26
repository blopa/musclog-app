import { Archive, Clock, Dumbbell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { StartWorkoutButton } from '@/components/StartWorkoutButton';
import { Button } from '@/components/theme/Button';
import { MenuButton } from '@/components/theme/MenuButton';
import { useTheme } from '@/hooks/useTheme';
import { WORKOUT_ICON_MAP, type WorkoutIconName } from '@/utils/workoutIconUtils';

import { GenericCard } from './GenericCard';

type FeaturedWorkoutCardProps = {
  name: string;
  lastCompleted?: string;
  lastCompletedTimestamp?: number;
  exerciseCount: number;
  duration?: string;
  icon?: string;
  onStart?: () => void;
  /** Tapping the card body previews the workout (targets, last time) without starting it. */
  onPress?: () => void;
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
  icon,
  onStart,
  onPress,
  onMore,
  onArchive,
  variant = 'featured',
}: FeaturedWorkoutCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const IconComponent =
    icon && Object.hasOwn(WORKOUT_ICON_MAP, icon)
      ? WORKOUT_ICON_MAP[icon as WorkoutIconName]
      : Dumbbell;

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
    <GenericCard variant="flat">
      <View className="p-4">
        {/* Only the heading previews: a pressable card wrapping the Start button let one tap
            fire both on web, opening the preview on top of the session it had just started. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onPress ? t('workouts.previewWorkout', { name }) : undefined}
          disabled={!onPress}
          onPress={onPress}
          className="mb-3 flex-row items-center gap-3"
          testID="workout-card-preview"
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-control"
            style={{ backgroundColor: theme.colors.background.iconDark }}
          >
            <IconComponent size={theme.iconSize.md} color={theme.colors.text.secondary} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-base font-semibold text-text-primary" numberOfLines={2}>
              {name}
            </Text>
            <View className="mt-0.5 flex-row flex-wrap items-center gap-x-1.5">
              <Text className="text-sm tabular-nums text-text-secondary">
                {exerciseCount} {t('workouts.exercises')}
                {duration ? ` · ${duration}` : null}
              </Text>
              {formattedLastCompleted ? (
                <View className="flex-row items-center gap-1">
                  <Clock size={theme.iconSize.xs} color={theme.colors.accent.primary} />
                  <Text className="text-sm text-accent-primary">{formattedLastCompleted}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>

        {variant === 'featured' ? (
          <View className="flex-row gap-2">
            <StartWorkoutButton variant="primary" onPress={onStart} />
            <MenuButton size="sm" onPress={onMore} className="w-14" />
          </View>
        ) : (
          <View className="flex-row gap-2">
            {onArchive ? (
              <Button
                label={t('workouts.archive')}
                icon={Archive}
                variant="secondary"
                size="sm"
                width="auto"
                onPress={onArchive}
              />
            ) : null}
            <StartWorkoutButton variant="secondary" onPress={onStart} />
            <MenuButton size="sm" onPress={onMore} className="ml-auto w-14" />
          </View>
        )}
      </View>
    </GenericCard>
  );
}
