import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../../hooks/useTheme';
import { GenericCard } from '../GenericCard';
import {
  calculateDailySummaryMetrics,
  getProgressBarColor,
  getStatusLabel,
  MacroValue,
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
  menuButton?: React.ReactNode;
};

export function DailySummaryCard({
  calories,
  macros,
  highlightThresholdStyle = 'none',
  menuButton,
}: DailySummaryCardProps) {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const { t } = useTranslation();

  const isNarrow = windowWidth < 380;
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
        {/* Main calorie section */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-start gap-1">
              <Text className="text-5xl font-extrabold tracking-tighter text-text-on-colorful">
                {calories.consumed}
              </Text>

              <View className="flex-col">
                <Text
                  className="font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.overlay.onColorful70,
                    marginTop: theme.spacing.margin.md,
                  }}
                >
                  {`/ ${calories.goal}`}
                </Text>
                <Text
                  className="font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.overlay.onColorful70,
                  }}
                >
                  {t('dailySummaryCard.kcal')}
                </Text>
              </View>
            </View>

            {/* Status icon for calories */}
            {highlightThresholds && calorieStatus === 'reached' ? (
              <CheckCircle2 size={24} color={theme.colors.status.success} strokeWidth={2.5} />
            ) : null}
            {highlightThresholds && calorieStatus === 'exceeded' ? (
              <AlertCircle size={24} color={theme.colors.status.warning} strokeWidth={2.5} />
            ) : null}
            {menuButton ? menuButton : null}
          </View>

          {/* Progress bar */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-xs font-bold"
                style={{ color: theme.colors.overlay.onColorful90 }}
              >
                {calories.remaining >= 0
                  ? `${calories.remaining} ${t('dailySummaryCard.remaining', 'remaining')}`
                  : `${Math.abs(calories.remaining)} ${t('dailySummaryCard.over', 'over')}`}
              </Text>
              {highlightThresholds && calorieStatus !== 'not-reached' ? (
                <Text
                  className="text-xs font-bold"
                  style={{
                    color: getProgressBarColor(calorieStatus, theme),
                  }}
                >
                  {getStatusLabel(calorieStatus, t)}
                </Text>
              ) : null}
            </View>
            <View
              className="h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: theme.colors.overlay.black60 }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(calorieProgress, 100)}%`,
                  backgroundColor: showColoredIndicators
                    ? getProgressBarColor(calorieStatus, theme)
                    : theme.colors.text.onColorful,
                }}
              />
            </View>
            <Text
              className="text-left text-xs"
              style={{ color: theme.colors.overlay.onColorful70 }}
            >
              {Math.round(calorieProgress)}%
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
                    color: theme.colors.overlay.onColorful70,
                  }}
                >
                  {isNarrow
                    ? t('dailySummaryCard.proteinShort')
                    : t('dailySummaryCard.protein')}
                </Text>
                {highlightThresholds && proteinStatus === 'reached' ? (
                  <CheckCircle2 size={16} color={theme.colors.status.success} strokeWidth={2.5} />
                ) : null}
                {highlightThresholds && proteinStatus === 'exceeded' ? (
                  <AlertCircle size={16} color={theme.colors.status.warning} strokeWidth={2.5} />
                ) : null}
                {!highlightThresholds || proteinStatus === 'not-reached' ? (
                  <Text
                    className="text-xs"
                    style={{
                      color: showColoredIndicators
                        ? getProgressBarColor(proteinStatus, theme)
                        : theme.colors.text.onColorful,
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
                      ? getProgressBarColor(proteinStatus, theme)
                      : theme.colors.overlay.onColorful90,
                  }}
                />
              </View>
              <Text
                className="text-left text-xs"
                style={{ color: theme.colors.overlay.onColorful70 }}
              >
                {Math.round(proteinProgress)}%
              </Text>
            </View>

            {/* Carbs */}
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-end justify-between">
                <Text
                  className="font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.overlay.onColorful70,
                  }}
                >
                  {isNarrow
                    ? t('dailySummaryCard.carbsShort')
                    : t('dailySummaryCard.carbs')}
                </Text>
                {highlightThresholds && carbsStatus === 'reached' ? (
                  <CheckCircle2 size={16} color={theme.colors.status.success} strokeWidth={2.5} />
                ) : null}
                {highlightThresholds && carbsStatus === 'exceeded' ? (
                  <AlertCircle size={16} color={theme.colors.status.warning} strokeWidth={2.5} />
                ) : null}
                {!highlightThresholds || carbsStatus === 'not-reached' ? (
                  <Text
                    className="text-xs"
                    style={{
                      color: showColoredIndicators
                        ? getProgressBarColor(carbsStatus, theme)
                        : theme.colors.text.onColorful,
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
                      ? getProgressBarColor(carbsStatus, theme)
                      : theme.colors.overlay.onColorful90,
                  }}
                />
              </View>
              <Text
                className="text-left text-xs"
                style={{ color: theme.colors.overlay.onColorful70 }}
              >
                {Math.round(carbsProgress)}%
              </Text>
            </View>

            {/* Fats */}
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-end justify-between">
                <Text
                  className="font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.overlay.onColorful70,
                  }}
                >
                  {isNarrow
                    ? t('dailySummaryCard.fatsShort')
                    : t('dailySummaryCard.fats')}
                </Text>
                {highlightThresholds && fatsStatus === 'reached' ? (
                  <CheckCircle2 size={16} color={theme.colors.status.success} strokeWidth={2.5} />
                ) : null}
                {highlightThresholds && fatsStatus === 'exceeded' ? (
                  <AlertCircle size={16} color={theme.colors.status.warning} strokeWidth={2.5} />
                ) : null}
                {!highlightThresholds || fatsStatus === 'not-reached' ? (
                  <Text
                    className="text-xs"
                    style={{
                      color: showColoredIndicators
                        ? getProgressBarColor(fatsStatus, theme)
                        : theme.colors.text.onColorful,
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
                      ? getProgressBarColor(fatsStatus, theme)
                      : theme.colors.overlay.onColorful90,
                  }}
                />
              </View>
              <Text
                className="text-left text-xs"
                style={{ color: theme.colors.overlay.onColorful70 }}
              >
                {Math.round(fatsProgress)}%
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </GenericCard>
  );
}
