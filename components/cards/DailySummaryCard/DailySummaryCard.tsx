import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle } from 'lucide-react-native';
import { theme } from '../../../theme';
import { GenericCard } from '../GenericCard';
import {
  MacroValue,
  getProgressBarColor,
  getStatusLabel,
  calculateDailySummaryMetrics,
} from './utils';

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
  highlightThresholdStyle?: 'default' | 'none' | 'simple';
};

export function DailySummaryCard({
  calories,
  macros,
  highlightThresholdStyle = 'simple',
}: DailySummaryCardProps) {
  const { t } = useTranslation();
  const highlightThresholds = highlightThresholdStyle === 'default';
  const showColoredIndicators =
    highlightThresholdStyle === 'default' || highlightThresholdStyle === 'simple';

  const {
    calorieProgress,
    calorieStatus,
    proteinProgress,
    proteinStatus,
    carbsProgress,
    carbsStatus,
    fatsProgress,
    fatsStatus,
  } = calculateDailySummaryMetrics(calories, macros);

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
          <View className="flex-row items-baseline justify-between">
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

            {/* Status icon for calories */}
            {highlightThresholds && calorieStatus === 'reached' ? (
              <CheckCircle2 size={24} color="#22c55e" strokeWidth={2.5} />
            ) : null}
            {highlightThresholds && calorieStatus === 'exceeded' ? (
              <AlertCircle size={24} color="#f97316" strokeWidth={2.5} />
            ) : null}
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
                  backgroundColor: showColoredIndicators
                    ? getProgressBarColor(calorieStatus)
                    : theme.colors.text.primary,
                }}
              />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold" style={{ color: theme.colors.overlay.white90 }}>
                {calories.remaining >= 0
                  ? `${calories.remaining} ${t('dailySummaryCard.remaining', 'remaining')}`
                  : `${Math.abs(calories.remaining)} ${t('dailySummaryCard.over', 'over')}`}
              </Text>
              {highlightThresholds && calorieStatus !== 'not-reached' ? (
                <Text
                  className="text-xs font-bold"
                  style={{
                    color: getProgressBarColor(calorieStatus),
                  }}
                >
                  {getStatusLabel(calorieStatus, t)}
                </Text>
              ) : null}
            </View>
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
                {highlightThresholds && proteinStatus === 'reached' ? (
                  <CheckCircle2 size={16} color="#22c55e" strokeWidth={2.5} />
                ) : null}
                {highlightThresholds && proteinStatus === 'exceeded' ? (
                  <AlertCircle size={16} color="#f97316" strokeWidth={2.5} />
                ) : null}
                {!highlightThresholds || proteinStatus === 'not-reached' ? (
                  <Text
                    className="text-xs"
                    style={{
                      color: showColoredIndicators
                        ? getProgressBarColor(proteinStatus)
                        : theme.colors.text.primary,
                    }}
                  >
                    <Text style={{ fontWeight: '700' }}>{macros.protein.value}</Text>
                    <Text style={{ fontWeight: '400' }}>{`/${macros.protein.goal}g`}</Text>
                  </Text>
                ) : null}
              </View>
              <View
                className="h-1 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.colors.overlay.black60 }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(proteinProgress, 100)}%`,
                    backgroundColor: showColoredIndicators
                      ? getProgressBarColor(proteinStatus)
                      : theme.colors.overlay.white90,
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
                {highlightThresholds && carbsStatus === 'reached' ? (
                  <CheckCircle2 size={16} color="#22c55e" strokeWidth={2.5} />
                ) : null}
                {highlightThresholds && carbsStatus === 'exceeded' ? (
                  <AlertCircle size={16} color="#f97316" strokeWidth={2.5} />
                ) : null}
                {!highlightThresholds || carbsStatus === 'not-reached' ? (
                  <Text
                    className="text-xs"
                    style={{
                      color: showColoredIndicators
                        ? getProgressBarColor(carbsStatus)
                        : theme.colors.text.primary,
                    }}
                  >
                    <Text style={{ fontWeight: '700' }}>{macros.carbs.value}</Text>
                    <Text style={{ fontWeight: '400' }}>{`/${macros.carbs.goal}g`}</Text>
                  </Text>
                ) : null}
              </View>
              <View
                className="h-1 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.colors.overlay.black60 }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(carbsProgress, 100)}%`,
                    backgroundColor: showColoredIndicators
                      ? getProgressBarColor(carbsStatus)
                      : theme.colors.overlay.white90,
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
                {highlightThresholds && fatsStatus === 'reached' ? (
                  <CheckCircle2 size={16} color="#22c55e" strokeWidth={2.5} />
                ) : null}
                {highlightThresholds && fatsStatus === 'exceeded' ? (
                  <AlertCircle size={16} color="#f97316" strokeWidth={2.5} />
                ) : null}
                {!highlightThresholds || fatsStatus === 'not-reached' ? (
                  <Text
                    className="text-xs"
                    style={{
                      color: showColoredIndicators
                        ? getProgressBarColor(fatsStatus)
                        : theme.colors.text.primary,
                    }}
                  >
                    <Text style={{ fontWeight: '700' }}>{macros.fats.value}</Text>
                    <Text style={{ fontWeight: '400' }}>{`/${macros.fats.goal}g`}</Text>
                  </Text>
                ) : null}
              </View>
              <View
                className="h-1 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.colors.overlay.black60 }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(fatsProgress, 100)}%`,
                    backgroundColor: showColoredIndicators
                      ? getProgressBarColor(fatsStatus)
                      : theme.colors.overlay.white90,
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
