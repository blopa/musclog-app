import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { ProgressMetric } from '../ProgressMetric';
import { GenericCard } from './GenericCard';

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
};

export function DailySummaryCard({ calories, activity, macros }: DailySummaryCardProps) {
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
    <GenericCard variant="default" size="lg" backgroundVariant="colorful-gradient">
      <View className="p-6">
        <View className="mb-6 flex-row items-start justify-between">
          <Text
            className="text-sm font-semibold tracking-wide"
            style={{ color: theme.colors.overlay.white90 }}
          >
            {t('home.dailySummary.title')}
          </Text>
          <View
            className="rounded-full px-4 py-1.5"
            style={{ backgroundColor: theme.colors.overlay.white50 }}
          >
            <Text
              className="font-bold"
              style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs }}
            >
              {t('common.today')}
            </Text>
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
        {macros ? (
          <View className="mt-6 flex-row gap-3">
            {macroData.map((macro) => (
              <View
                key={macro.key}
                className="flex-1 items-center rounded-2xl px-2.5 py-3"
                style={{ backgroundColor: theme.colors.background.white20 }}
              >
                <Text
                  className="mb-1 text-xs font-bold uppercase"
                  style={{ color: theme.colors.text.primary }}
                >
                  {macro.label}
                  <Text className="ml-1 font-normal" style={{ color: theme.colors.text.primary }}>
                    {macro.percent}%
                  </Text>
                </Text>
                <View
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: theme.colors.overlay.white50 }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: theme.colors.text.primary,
                      width: `${macro.percent}%`,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </GenericCard>
  );
}
