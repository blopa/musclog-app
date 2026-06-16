import { Flame, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type WeeklyStreakCardProps = {
  workoutsThisWeek: number;
  weeklyGoal?: number | null;
  streakDays: number;
  streakLabel: string;
  bestStreakDays: number;
  bestStreakLabel: string;
  onCreateWorkoutGoalPress?: () => void;
};

export function WeeklyStreakCard({
  workoutsThisWeek,
  weeklyGoal,
  streakDays,
  streakLabel,
  bestStreakDays,
  bestStreakLabel,
  onCreateWorkoutGoalPress,
}: WeeklyStreakCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const dots =
    weeklyGoal != null && weeklyGoal > 0
      ? Array.from({ length: weeklyGoal }, (_, index) => index < workoutsThisWeek)
      : [];
  const footerSlotStyle = { height: 34 };

  return (
    <GenericCard variant="default">
      <View className="flex-row items-stretch">
        {/* Workouts this week */}
        <View className="flex-1 justify-between px-4 py-3.5">
          <View>
            <View className="flex-row items-center gap-2">
              <Flame
                size={theme.iconSize['3xl']}
                color={theme.colors.status.warning}
                fill={theme.colors.status.warning}
              />
              <Text
                className="font-extrabold leading-none"
                style={{
                  color: theme.colors.status.warning,
                  fontSize: theme.typography.fontSize['40'],
                }}
              >
                {formatInteger(workoutsThisWeek)}
              </Text>
            </View>
            <Text
              className="mt-0.5 text-sm font-bold leading-tight text-text-primary"
              numberOfLines={2}
            >
              {t('weeklyStreakCard.workoutsThisWeek')}
            </Text>
          </View>
          {dots.length > 0 ? (
            <View className="mt-2 flex-row items-center gap-1.5" style={footerSlotStyle}>
              {dots.map((filled, index) => (
                <View
                  className="h-2 w-2 rounded-full"
                  key={index}
                  style={{
                    backgroundColor: filled
                      ? theme.colors.status.warning
                      : theme.colors.background.white10,
                  }}
                />
              ))}
            </View>
          ) : onCreateWorkoutGoalPress ? (
            <View className="mt-2 justify-center" style={footerSlotStyle}>
              <Button
                label={t('weeklyStreakCard.setWeeklyGoal')}
                onPress={onCreateWorkoutGoalPress}
                size="xs"
                variant="secondary"
                width="full"
              />
            </View>
          ) : (
            <View className="mt-2" style={footerSlotStyle} />
          )}
        </View>

        {/* Divider */}
        <View className="my-3.5 w-px" style={{ backgroundColor: theme.colors.border.default }} />

        {/* Streak */}
        <View className="flex-1 justify-between px-4 py-3.5">
          <View>
            <Text
              className="font-extrabold leading-none"
              style={{
                color: theme.colors.accent.primary,
                fontSize: theme.typography.fontSize['40'],
              }}
            >
              {formatInteger(streakDays)}
            </Text>
            <Text className="mt-0.5 text-sm font-bold leading-tight text-text-primary">
              {t('weeklyStreakCard.dayStreak')}
            </Text>
            <Text
              className="mt-px text-xs font-semibold"
              numberOfLines={1}
              style={{ color: theme.colors.accent.primary }}
            >
              {streakLabel}
            </Text>
          </View>

          <View
            className="mt-2 flex-row items-center gap-1.5 rounded-lg px-2.5"
            style={{
              ...footerSlotStyle,
              backgroundColor: theme.colors.background.white5,
              borderColor: theme.colors.border.default,
              borderWidth: theme.borderWidth.thin,
            }}
          >
            <Trophy size={theme.iconSize.sm} color={theme.colors.status.amber} />
            <Text
              className="min-w-0 flex-1 text-xs font-medium text-text-secondary"
              numberOfLines={1}
            >
              {bestStreakLabel}
            </Text>
            <Text className="text-xs font-bold text-text-primary" numberOfLines={1}>
              {t('weeklyStreakCard.days', { value: formatInteger(bestStreakDays) })}
            </Text>
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
