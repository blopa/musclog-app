import { Trophy } from 'lucide-react-native';
import { Fragment } from 'react';
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
  bestStreakDays: number;
  bestStreakLabel: string;
  onCreateWorkoutGoalPress?: () => void;
};

export function WeeklyStreakCard({
  workoutsThisWeek,
  weeklyGoal,
  streakDays,
  bestStreakDays,
  bestStreakLabel,
  onCreateWorkoutGoalPress,
}: WeeklyStreakCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const hasWorkoutGoal = weeklyGoal != null && weeklyGoal > 0;
  const dots = hasWorkoutGoal
    ? Array.from({ length: weeklyGoal }, (_, index) => index < workoutsThisWeek)
    : [];
  const bestStreakDaysLabel = t('weeklyStreakCard.days', {
    value: formatInteger(bestStreakDays),
  });
  const dotSize = 16;

  const workoutsThisWeekText = (
    <Text
      className="font-medium text-text-primary"
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.78}
      style={{
        fontSize: theme.typography.fontSize.xl,
        lineHeight: 26,
      }}
    >
      <Text className="font-extrabold">{formatInteger(workoutsThisWeek)}</Text>
      {` ${t('weeklyStreakCard.workoutsThisWeek')}`}
    </Text>
  );

  return (
    <GenericCard variant="default" containerStyle={theme.shadows.lg}>
      <View className="flex-row items-stretch" style={{ minHeight: 126 }}>
        <View className="flex-1 justify-center px-5 py-4">
          {!hasWorkoutGoal && onCreateWorkoutGoalPress ? (
            <View className="mt-2 justify-center">
              <Button
                label={t('weeklyStreakCard.setWeeklyGoal')}
                onPress={onCreateWorkoutGoalPress}
                size="sm"
                variant="accent"
                width="full"
              />
            </View>
          ) : (
            <>
              {workoutsThisWeekText}

              {hasWorkoutGoal ? (
                <View className="mt-4 h-6 flex-row items-center">
                  {dots.map((filled, index) => (
                    <Fragment key={index}>
                      {index > 0 ? (
                        <View
                          className="flex-1"
                          style={{
                            backgroundColor: filled
                              ? theme.colors.status.emerald30
                              : theme.colors.background.white10,
                            height: theme.borderWidth.thin,
                          }}
                        />
                      ) : null}
                      <View
                        style={{
                          width: dotSize,
                          height: dotSize,
                          borderRadius: dotSize / 2,
                          backgroundColor: filled
                            ? theme.colors.accent.primary
                            : theme.colors.background.white10,
                          shadowColor: theme.colors.accent.primary,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: filled ? 0.45 : 0,
                          shadowRadius: filled ? 8 : 0,
                          elevation: filled ? 3 : 0,
                        }}
                      />
                    </Fragment>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>

        <View className="my-5 w-px" style={{ backgroundColor: theme.colors.border.default }} />

        <View className="flex-1 justify-center px-4 py-4">
          <View className="flex-row items-baseline gap-1.5">
            <Text
              className="font-extrabold text-text-primary"
              numberOfLines={1}
              style={{
                flexShrink: 0,
                fontSize: theme.typography.fontSize['4xl'],
                lineHeight: 40,
              }}
            >
              {formatInteger(streakDays)}
            </Text>
            <Text
              className="min-w-0 flex-1 font-extrabold text-text-primary"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{
                fontSize: theme.typography.fontSize.xl,
                lineHeight: 25,
              }}
            >
              {t('weeklyStreakCard.dayStreak')}
            </Text>
          </View>

          <View className="mt-3 h-8 flex-row items-center gap-1.5">
            <Trophy
              size={theme.iconSize.lg}
              color={theme.colors.accent.primary}
              fill={theme.colors.accent.primary}
              strokeWidth={theme.strokeWidth.medium}
            />
            <View
              className="min-w-0 flex-1 flex-row items-center rounded-md px-2.5"
              style={{
                height: 30,
                backgroundColor: theme.colors.status.emerald20,
              }}
            >
              <Text
                className="min-w-0 flex-1 text-text-secondary"
                numberOfLines={1}
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                }}
              >
                {bestStreakLabel}:
              </Text>
              <Text
                className="ml-1 font-bold text-text-primary"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  flexShrink: 0,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {bestStreakDaysLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
