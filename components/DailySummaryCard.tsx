import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { ProgressMetric } from './ProgressMetric';

type DailySummaryCardProps = {
  calories: {
    consumed: number;
    remaining: number;
    goal: number;
  };
  activity: {
    minutes: number;
    goal: number;
  };
  gradientColors: readonly [string, string, ...string[]];
};

export function DailySummaryCard({ calories, activity, gradientColors }: DailySummaryCardProps) {
  const { t } = useTranslation();

  // Calculate progress percentages
  const caloriesProgress = (calories.consumed / calories.goal) * 100;
  const activityProgress = (activity.minutes / activity.goal) * 100;

  return (
    <View className="mx-6 mb-6">
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: theme.borderRadius['2xl'], padding: theme.spacing.padding.xl }}>
        <View className="mb-6 flex-row items-start justify-between">
          <Text className="text-sm font-semibold tracking-wide" style={{ color: theme.colors.overlay.white80 }}>
            {t('home.dailySummary.title')}
          </Text>
          <View
            className="rounded-full px-4 py-1.5"
            style={{ backgroundColor: theme.colors.overlay.white30 }}>
            <Text className="text-xs font-medium text-text-primary">{t('common.today')}</Text>
          </View>
        </View>

        <View className="flex-row gap-8">
          <ProgressMetric
            value={calories.consumed}
            unit={t('common.kcal')}
            progress={caloriesProgress}
            bottomText={`${calories.remaining} ${t('common.remaining')}`}
            formatValue={(v) => v.toLocaleString()}
          />
          <ProgressMetric
            value={activity.minutes}
            unit={t('common.min')}
            progress={activityProgress}
            bottomText={`${t('common.goal')}: ${activity.goal} ${t('common.min')}`}
          />
        </View>
      </LinearGradient>
    </View>
  );
}
