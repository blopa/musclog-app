import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type MacroValue = {
  value: number;
  goal: number;
};

type DailySummaryCardProps = {
  calories: {
    consumed: number;
    remaining: number;
    goal: number;
  };
  macros?: {
    protein: MacroValue;
    carbs: MacroValue;
    fats: MacroValue;
  };
};

export function DailySummaryCard({ calories, macros }: DailySummaryCardProps) {
  const { t } = useTranslation();

  // Calculate progress percentages
  const calorieProgress = (calories.consumed / calories.goal) * 100;
  const proteinProgress = macros ? (macros.protein.value / macros.protein.goal) * 100 : 0;
  const carbsProgress = macros ? (macros.carbs.value / macros.carbs.goal) * 100 : 0;
  const fatsProgress = macros ? (macros.fats.value / macros.fats.goal) * 100 : 0;

  return (
    <GenericCard variant="default" size="lg" backgroundVariant="colorful-gradient">
      <View className="gap-4 p-5">
        {/* Header with title and badge */}
        <View className="flex-row items-center justify-between">
          <Text
            className="font-medium uppercase tracking-wider"
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.overlay.white70,
            }}
          >
            {t('dailySummaryCard.dailySummary', 'Daily Summary')}
          </Text>
          <View
            className="rounded px-2 py-0.5 backdrop-blur-md"
            style={{
              backgroundColor: theme.colors.overlay.white20,
              borderColor: theme.colors.overlay.white50,
              borderWidth: theme.borderWidth.thin,
            }}
          >
            <Text
              className="font-bold uppercase tracking-tighter"
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
              }}
            >
              {t('dailySummaryCard.today', 'Today')}
            </Text>
          </View>
        </View>

        {/* Main calorie section */}
        <View className="gap-3">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-5xl font-extrabold tracking-tighter text-text-primary">
              {calories.consumed.toLocaleString()}
            </Text>
            <Text
              className="font-bold uppercase"
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.overlay.white70,
              }}
            >
              {t('dailySummaryCard.kcal', 'Kcal')}
            </Text>
          </View>

          {/* Progress bar */}
          <View className="gap-1.5">
            <View
              className="h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: theme.colors.overlay.black60 }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(calorieProgress, 100)}%`,
                  backgroundColor: theme.colors.text.primary,
                }}
              />
            </View>
            <Text className="text-xs font-bold" style={{ color: theme.colors.overlay.white90 }}>
              {calories.remaining} {t('dailySummaryCard.remaining', 'remaining')}
            </Text>
          </View>
        </View>

        {/* Macros grid */}
        {macros ? (
          <View className="flex-row gap-3 pt-1">
            {/* Protein */}
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-end justify-between">
                <Text
                  className="font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.overlay.white70,
                  }}
                >
                  {t('dailySummaryCard.protein', 'Prot')}
                </Text>
                <Text className="text-xs font-bold text-text-primary">
                  {macros.protein.value}/{macros.protein.goal}g
                </Text>
              </View>
              <View
                className="h-1 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.colors.overlay.black60 }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(proteinProgress, 100)}%`,
                    backgroundColor: theme.colors.overlay.white90,
                  }}
                />
              </View>
            </View>

            {/* Carbs */}
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-end justify-between">
                <Text
                  className="font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.overlay.white70,
                  }}
                >
                  {t('dailySummaryCard.carbs', 'Carb')}
                </Text>
                <Text className="text-xs font-bold text-text-primary">
                  {macros.carbs.value}/{macros.carbs.goal}g
                </Text>
              </View>
              <View
                className="h-1 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.colors.overlay.black60 }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(carbsProgress, 100)}%`,
                    backgroundColor: theme.colors.overlay.white90,
                  }}
                />
              </View>
            </View>

            {/* Fats */}
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-end justify-between">
                <Text
                  className="font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.overlay.white70,
                  }}
                >
                  {t('dailySummaryCard.fats', 'Fat')}
                </Text>
                <Text className="text-xs font-bold text-text-primary">
                  {macros.fats.value}/{macros.fats.goal}g
                </Text>
              </View>
              <View
                className="h-1 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.colors.overlay.black60 }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(fatsProgress, 100)}%`,
                    backgroundColor: theme.colors.overlay.white90,
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </GenericCard>
  );
}
