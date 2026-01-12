import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { ProgressMetric } from '../ProgressMetric';

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
  macros?: {
    protein: { value: number; goal: number };
    carbs: { value: number; goal: number };
    fats: { value: number; goal: number };
  };
  gradientColors: readonly [string, string, ...string[]];
};

export function DailySummaryCard({
  calories,
  activity,
  macros,
  gradientColors,
}: DailySummaryCardProps) {
  const { t } = useTranslation();

  // Calculate progress percentages
  const caloriesProgress = (calories.consumed / calories.goal) * 100;
  const activityProgress = (activity.minutes / activity.goal) * 100;

  // Macros progress
  const macroData = macros
    ? [
        {
          key: 'protein',
          label: t('home.macros.proteinLabel', 'PROTEIN'),
          value: macros.protein.value,
          goal: macros.protein.goal,
          percent: Math.round((macros.protein.value / macros.protein.goal) * 100),
        },
        {
          key: 'carbs',
          label: t('home.macros.carbsLabel', 'CARBS'),
          value: macros.carbs.value,
          goal: macros.carbs.goal,
          percent: Math.round((macros.carbs.value / macros.carbs.goal) * 100),
        },
        {
          key: 'fats',
          label: t('home.macros.fatsLabel', 'FATS'),
          value: macros.fats.value,
          goal: macros.fats.goal,
          percent: Math.round((macros.fats.value / macros.fats.goal) * 100),
        },
      ]
    : [];

  return (
    <View className="mb-6 w-full">
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: theme.borderRadius['2xl'], padding: theme.spacing.padding.xl }}>
        <View className="mb-6 flex-row items-start justify-between">
          <Text
            className="text-sm font-semibold tracking-wide"
            style={{ color: theme.colors.overlay.white80 }}>
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

        {/* Macros Row */}
        {macros && (
          <View className="mt-6 flex-row gap-3">
            {macroData.map((macro) => (
              <View
                key={macro.key}
                className="flex-1 items-center rounded-2xl px-2.5 py-3"
                style={{ backgroundColor: theme.colors.background.white10 }}>
                <Text className="mb-1 text-xs font-bold uppercase text-text-primary">
                  {macro.label}
                  <Text className="ml-1 font-normal text-text-primary">{macro.percent}%</Text>
                </Text>
                <View
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: theme.colors.overlay.white30 }}>
                  <View
                    className="h-full rounded-full bg-text-primary"
                    style={{ width: `${macro.percent}%` }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
