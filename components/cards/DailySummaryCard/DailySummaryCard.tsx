import i18n from 'i18next';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import {
  calculateDailySummaryMetrics,
  getProgressBarColor,
  getStatusLabel,
  isNarrowLayout,
  MacroValue,
} from './utils';

export type WeeklyAverages = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
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
    fiber: MacroValue;
  };
  secondaryNutrients?: {
    alcohol?: number;
  };
  highlightThresholdStyle?: 'default' | 'none' | 'simple';
  menuButton?: React.ReactNode;
  intuitiveMode?: boolean;
  /**
   * 5-char binary string controlling which macros are shown.
   * Positions: 0=carbs, 1=protein, 2=fats, 3=fiber, 4=alcohol.
   * Defaults to '11111' (show all). Pass from useSettings().nutritionDisplay.
   */
  nutritionDisplay?: string;
  weeklyAverages?: WeeklyAverages;
};

export function DailySummaryCard({
  calories,
  macros,
  secondaryNutrients,
  highlightThresholdStyle = 'none',
  menuButton,
  intuitiveMode = false,
  nutritionDisplay = '11111',
  weeklyAverages,
}: DailySummaryCardProps) {
  const showCarbs = nutritionDisplay[0] !== '0';
  const showProtein = nutritionDisplay[1] !== '0';
  const showFats = nutritionDisplay[2] !== '0';
  const showFiber = nutritionDisplay[3] !== '0';
  const showAlcohol = nutritionDisplay[4] !== '0';
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, formatDecimal } = useFormatAppNumber();

  const [pageWidth, setPageWidth] = useState(windowWidth);
  const [currentPage, setCurrentPage] = useState(0);
  const hasWeeklyData = weeklyAverages != null;

  // Calculate enabled macros count (excluding alcohol since it's displayed separately)
  const enabledMacrosCount = [showCarbs, showProtein, showFats, showFiber].filter(Boolean).length;

  const [isNarrowProtein, isNarrowCarbs, isNarrowFats, isNarrowFiber] = isNarrowLayout(
    i18n.resolvedLanguage ?? i18n.language,
    windowWidth,
    macros
      ? {
          protein: macros.protein.value,
          carbs: macros.carbs.value,
          fats: macros.fats.value,
          fiber: macros.fiber.value,
        }
      : undefined,
    macros
      ? {
          protein: macros.protein.goal,
          carbs: macros.carbs.goal,
          fats: macros.fats.goal,
          fiber: macros.fiber.goal,
        }
      : undefined,
    enabledMacrosCount
  );
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
    fiberProgress,
    fiberStatus,
  } = calculateDailySummaryMetrics(calories, macros);


  const dailyMacroItems = macros
    ? [
        ...(showProtein
          ? [
              {
                label: isNarrowProtein
                  ? t('dailySummaryCard.proteinShort')
                  : t('dailySummaryCard.protein'),
                value: macros.protein.value,
                goal: macros.protein.goal,
                progress: proteinProgress,
                status: proteinStatus,
              },
            ]
          : []),
        ...(showCarbs
          ? [
              {
                label: isNarrowCarbs
                  ? t('dailySummaryCard.carbsShort')
                  : t('dailySummaryCard.carbs'),
                value: macros.carbs.value,
                goal: macros.carbs.goal,
                progress: carbsProgress,
                status: carbsStatus,
              },
            ]
          : []),
        ...(showFats
          ? [
              {
                label: isNarrowFats
                  ? t('dailySummaryCard.fatsShort')
                  : t('dailySummaryCard.fats'),
                value: macros.fats.value,
                goal: macros.fats.goal,
                progress: fatsProgress,
                status: fatsStatus,
              },
            ]
          : []),
        ...(showFiber && macros.fiber.goal > 0
          ? [
              {
                label: isNarrowFiber
                  ? t('dailySummaryCard.fiberShort')
                  : t('dailySummaryCard.fiber'),
                value: macros.fiber.value,
                goal: macros.fiber.goal,
                progress: fiberProgress,
                status: fiberStatus,
              },
            ]
          : []),
      ]
    : [];

  const weeklyMacroItems =
    macros && weeklyAverages
      ? [
          ...(showProtein
            ? [
                {
                  label: isNarrowProtein
                    ? t('dailySummaryCard.proteinShort')
                    : t('dailySummaryCard.protein'),
                  value: weeklyAverages.protein,
                },
              ]
            : []),
          ...(showCarbs
            ? [
                {
                  label: isNarrowCarbs
                    ? t('dailySummaryCard.carbsShort')
                    : t('dailySummaryCard.carbs'),
                  value: weeklyAverages.carbs,
                },
              ]
            : []),
          ...(showFats
            ? [
                {
                  label: isNarrowFats
                    ? t('dailySummaryCard.fatsShort')
                    : t('dailySummaryCard.fats'),
                  value: weeklyAverages.fats,
                },
              ]
            : []),
          ...(showFiber && macros.fiber.goal > 0
            ? [
                {
                  label: isNarrowFiber
                    ? t('dailySummaryCard.fiberShort')
                    : t('dailySummaryCard.fiber'),
                  value: weeklyAverages.fiber,
                },
              ]
            : []),
        ]
      : [];

  return (
    <GenericCard variant="default" size="lg" backgroundVariant="colorful-gradient">
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== pageWidth) setPageWidth(w);
        }}
        style={{ overflow: 'hidden' }}
      >
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={hasWeeklyData}
          scrollEventThrottle={16}
          onScroll={(e) => {
            if (pageWidth > 0) {
              const page = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
              if (page !== currentPage) setCurrentPage(page);
            }
          }}
        >
          {/* Page 1 — Today */}
          <View style={{ width: pageWidth }} className="gap-4 p-5">
            {/* Main calorie section */}
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-start gap-1">
                  <Text
                    className="text-5xl font-extrabold tracking-tighter text-text-on-colorful"
                    style={intuitiveMode ? blurFilter(8) : undefined}
                  >
                    {intuitiveMode ? '00' : formatInteger(Math.round(calories.consumed))}
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
                      {`/ ${formatInteger(Math.round(calories.goal))}`}
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
                  {intuitiveMode ? (
                    <View className="flex-row items-center gap-1">
                      <Text
                        className="text-xs font-bold"
                        style={{ color: theme.colors.overlay.onColorful90, ...blurFilter(5) }}
                      >
                        {'00'}
                      </Text>
                      <Text
                        className="text-xs font-bold"
                        style={{ color: theme.colors.overlay.onColorful90 }}
                      >
                        {t('dailySummaryCard.remaining')}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      className="text-xs font-bold"
                      style={{ color: theme.colors.overlay.onColorful90 }}
                    >
                      {calories.remaining >= 0
                        ? `${formatInteger(Math.round(calories.remaining))} ${t('dailySummaryCard.remaining')}`
                        : `${formatInteger(Math.round(Math.abs(calories.remaining)))} ${t('dailySummaryCard.over')}`}
                    </Text>
                  )}
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
                      width: intuitiveMode ? '0%' : `${Math.min(calorieProgress, 100)}%`,
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
                  {intuitiveMode ? '' : `${formatInteger(Math.round(calorieProgress))}%`}
                </Text>
              </View>
            </View>

            {/* Macros grid */}
            {dailyMacroItems.length > 0 ? (
              <View className="flex-row gap-2 pt-1">
                {dailyMacroItems.map((macro) => (
                  <View key={macro.label} className="flex-1 gap-1.5">
                    <View className="flex-row items-end justify-between">
                      <Text
                        className="font-bold uppercase"
                        numberOfLines={1}
                        style={{
                          fontSize: theme.typography.fontSize.xxs,
                          color: theme.colors.overlay.onColorful70,
                          flexShrink: 1,
                        }}
                      >
                        {macro.label}
                      </Text>
                      {highlightThresholds && macro.status === 'reached' ? (
                        <CheckCircle2
                          size={16}
                          color={theme.colors.status.success}
                          strokeWidth={2.5}
                        />
                      ) : null}
                      {highlightThresholds && macro.status === 'exceeded' ? (
                        <AlertCircle
                          size={16}
                          color={theme.colors.status.warning}
                          strokeWidth={2.5}
                        />
                      ) : null}
                      {!highlightThresholds || macro.status === 'not-reached' ? (
                        <View className="flex-row items-baseline">
                          <Text
                            className="text-xs font-bold"
                            style={{
                              color: showColoredIndicators
                                ? getProgressBarColor(macro.status, theme)
                                : theme.colors.text.onColorful,
                              ...(intuitiveMode ? blurFilter(4) : {}),
                            }}
                          >
                            {intuitiveMode ? '0' : formatDecimal(macro.value, 1)}
                          </Text>
                          <Text
                            className="text-xs font-normal"
                            style={{
                              color: showColoredIndicators
                                ? getProgressBarColor(macro.status, theme)
                                : theme.colors.text.onColorful,
                            }}
                          >
                            {`/${t('common.weightFormatG', { value: formatInteger(Math.round(macro.goal)) })}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      className="h-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: theme.colors.overlay.black60 }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: intuitiveMode ? '0%' : `${Math.min(macro.progress, 100)}%`,
                          backgroundColor: showColoredIndicators
                            ? getProgressBarColor(macro.status, theme)
                            : theme.colors.overlay.onColorful90,
                        }}
                      />
                    </View>
                    <Text
                      className="text-left text-xs"
                      style={{ color: theme.colors.overlay.onColorful70 }}
                    >
                      {intuitiveMode ? '' : `${formatInteger(Math.round(macro.progress))}%`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Alcohol */}
            {showAlcohol && secondaryNutrients && (secondaryNutrients.alcohol ?? 0) > 0 ? (
              <View
                className="flex-row items-center justify-start pt-2"
                style={{
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.overlay.white30,
                  marginTop: theme.spacing.margin.xs,
                }}
              >
                <Text
                  className="font-medium"
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.overlay.white70,
                  }}
                >
                  {t('dailySummaryCard.alcoholLabel')}
                </Text>
                <Text
                  className="ml-1.5 font-semibold"
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.text.onColorful,
                    ...(intuitiveMode ? blurFilter(4) : {}),
                  }}
                >
                  {t('dailySummaryCard.alcohol')}{' '}
                  {t('common.weightFormatG', {
                    value: intuitiveMode ? 0 : formatDecimal(secondaryNutrients.alcohol ?? 0, 1),
                  })}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Page 2 — Weekly Average */}
          {hasWeeklyData ? (
            <View style={{ width: pageWidth }} className="gap-5 p-5">
              {/* Header */}
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold uppercase tracking-wider"
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.onColorful,
                  }}
                >
                  {t('dailySummaryCard.weeklyAvg')}
                </Text>
                {menuButton ? menuButton : null}
              </View>

              {/* Average calorie number */}
              <View className="flex-row items-end gap-2">
                <Text
                  className="text-5xl font-extrabold tracking-tighter text-text-on-colorful"
                  style={intuitiveMode ? blurFilter(8) : undefined}
                >
                  {intuitiveMode ? '00' : formatInteger(Math.round(weeklyAverages!.calories))}
                </Text>
                <Text
                  className="mb-1.5 font-bold uppercase"
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    color: theme.colors.overlay.onColorful70,
                  }}
                >
                  {t('dailySummaryCard.kcal')}
                </Text>
              </View>

              {/* Macros pill */}
              {weeklyMacroItems.length > 0 ? (
                <View
                  className="flex-row justify-around rounded-2xl px-2 py-3"
                  style={{ backgroundColor: theme.colors.background.black30 }}
                >
                  {weeklyMacroItems.map((macro) => (
                    <View key={macro.label} className="items-center gap-1">
                      <Text
                        className="font-bold uppercase"
                        style={{
                          fontSize: theme.typography.fontSize.xxs,
                          color: theme.colors.overlay.onColorful70,
                        }}
                      >
                        {macro.label}
                      </Text>
                      <View className="flex-row items-baseline">
                        <Text
                          className="font-bold text-text-on-colorful"
                          style={{
                            fontSize: theme.typography.fontSize.xl,
                            ...(intuitiveMode ? blurFilter(4) : {}),
                          }}
                        >
                          {intuitiveMode ? '0' : formatDecimal(macro.value, 1)}
                        </Text>
                        <Text
                          className="font-normal"
                          style={{
                            fontSize: theme.typography.fontSize.sm,
                            color: theme.colors.overlay.onColorful70,
                          }}
                        >
                          g
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* Pagination dots */}
        {hasWeeklyData ? (
          <View className="flex-row justify-center gap-1.5 pb-3">
            {[0, 1].map((i) => (
              <View
                key={i}
                style={{
                  width: currentPage === i ? 16 : 6,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: theme.colors.text.onColorful,
                  opacity: currentPage === i ? 1 : 0.4,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </GenericCard>
  );
}
