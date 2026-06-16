import { Flame, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type WeeklyStreakCardProps = {
  workoutsThisWeek: number;
  weeklyGoal?: number;
  streakDays: number;
  streakLabel: string;
  bestStreakDays: number;
  bestStreakLabel: string;
};

export function WeeklyStreakCard({
  workoutsThisWeek,
  weeklyGoal = 6,
  streakDays,
  streakLabel,
  bestStreakDays,
  bestStreakLabel,
}: WeeklyStreakCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const dots = Array.from({ length: weeklyGoal }, (_, index) => index < workoutsThisWeek);

  return (
    <GenericCard variant="default">
      <View className="flex-row items-stretch">
        {/* Workouts this week */}
        <View className="flex-1 flex-row items-center gap-3 p-5">
          <Flame
            size={theme.iconSize['4xl']}
            color={theme.colors.status.warning}
            fill={theme.colors.status.warning}
          />
          <View className="flex-1">
            <Text
              className="font-extrabold leading-none"
              style={{
                color: theme.colors.status.warning,
                fontSize: theme.typography.fontSize['5xl'],
              }}
            >
              {formatInteger(workoutsThisWeek)}
            </Text>
            <Text className="mt-1 text-base font-bold leading-tight text-text-primary">
              {t('weeklyStreakCard.workoutsThisWeek')}
            </Text>
            <View className="mt-3 flex-row gap-1.5">
              {dots.map((filled, index) => (
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  key={index}
                  style={{
                    backgroundColor: filled
                      ? theme.colors.status.warning
                      : theme.colors.background.white10,
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Divider */}
        <View className="my-5 w-px" style={{ backgroundColor: theme.colors.border.default }} />

        {/* Streak */}
        <View className="flex-1 p-5">
          <Text
            className="font-extrabold leading-none"
            style={{
              color: theme.colors.accent.primary,
              fontSize: theme.typography.fontSize['5xl'],
            }}
          >
            {formatInteger(streakDays)}
          </Text>
          <Text className="mt-1 text-base font-bold leading-tight text-text-primary">
            {t('weeklyStreakCard.dayStreak')}
          </Text>
          <Text
            className="mt-0.5 text-sm font-semibold"
            style={{ color: theme.colors.accent.primary }}
          >
            {streakLabel}
          </Text>

          <View
            className="mt-3 flex-row items-center gap-2 rounded-xl p-2.5"
            style={{
              backgroundColor: theme.colors.background.white5,
              borderColor: theme.colors.border.default,
              borderWidth: theme.borderWidth.thin,
            }}
          >
            <Trophy size={theme.iconSize.lg} color={theme.colors.status.amber} />
            <View className="flex-1">
              <Text className="text-xs font-medium text-text-secondary">{bestStreakLabel}</Text>
              <Text className="text-sm font-bold text-text-primary">
                {t('weeklyStreakCard.days', { value: formatInteger(bestStreakDays) })}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
