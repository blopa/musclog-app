import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UserMetricDataModal } from '@/components/modals/DataLogModal';
import { StatStrip, type StatStripItem } from '@/components/StatStrip';
import { useCircadianBurn } from '@/hooks/useCircadianBurn';
import { useDailySteps } from '@/hooks/useDailySteps';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { computeEnergyBalance } from '@/utils/energyBalance';

import { buildDailyStatCells, type StatTone } from './dailyHomeStats';

type DailyHomeFooterProps = {
  date: Date;
  /** The user's whole-day expenditure. Split across the day here — see `useCircadianBurn`. */
  tdee: number;
  /**
   * Energy eaten today, or `null` when the user tracks no calorie goal (intuitive-eating
   * mode, or no goal set), in which case the energy half of the strip is not shown.
   *
   * Passed in rather than read here: the home screen already subscribes to today's
   * nutrition for the summary card, and a second `useDailyNutritionSummary` would run the
   * day's log query and its per-log decryption twice for one integer.
   */
  consumedKcal: null | number;
};

/**
 * The compact stat strip under the daily summary card: today's step count and, when the
 * user tracks calories, how the day's energy is balancing out.
 *
 * It renders as discrete labelled cells rather than a sentence ("Burned 2781 · Eaten 0
 * · 2781 kcal under") so the numbers line up in a scannable row and the day's verdict
 * can carry its meaning in color. `buildDailyStatCells` owns which cells appear and
 * which one is tinted; `StatStrip` draws them.
 *
 * Everything the strip shows is derived here rather than on the home screen, including
 * the metric history the step count opens — the screen supplies only the two facts it
 * already holds (the day and the user's TDEE) plus the calories it already subscribes to.
 */
export function DailyHomeFooter({ consumedKcal, date, tdee }: DailyHomeFooterProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const [isMetricHistoryVisible, setIsMetricHistoryVisible] = useState(false);

  const steps = useDailySteps(date);
  // Burned so far today, not the whole day's TDEE: under a "Burned" label the full-day
  // figure reads as energy already spent, which at 8am it is not.
  const { burned: burnedSoFar } = useCircadianBurn(tdee);

  const energyBalance =
    consumedKcal === null
      ? null
      : computeEnergyBalance({
          burnedKcal: Math.round(burnedSoFar),
          consumedKcal,
        });

  const cells = buildDailyStatCells({ energyBalance, steps });

  const toneColor: Record<StatTone, string> = {
    neutral: theme.colors.text.primary,
    good: theme.colors.status.success,
    caution: theme.colors.status.warning,
  };

  const items: StatStripItem[] = cells.map((cell) => {
    const label = t(cell.labelKey);
    const value = formatInteger(cell.value);

    // Steps is the one cell that goes anywhere, and this component already knows that —
    // it draws the walking icon on the same line. A generic `interactive` flag on the
    // cell said "some cell might be tappable" while the handler here was still hardcoded
    // to steps, so it carried none of the information it looked like it carried.
    const isSteps = cell.key === 'steps';

    return {
      key: cell.key,
      value,
      unit: cell.showsUnit ? t('home.dailyStats.kcal') : undefined,
      label,
      valueColor: toneColor[cell.tone],
      icon: isSteps ? (
        <MaterialIcons
          color={theme.colors.accent.primary}
          name="directions-walk"
          size={13}
          style={{ marginRight: 3 }}
        />
      ) : undefined,
      onPress: isSteps ? () => setIsMetricHistoryVisible(true) : undefined,
      accessibilityLabel: isSteps ? `${label}: ${value}` : undefined,
    };
  });

  return (
    <>
      <StatStrip
        className="mt-3"
        items={items}
        palette={{
          background: theme.colors.background.card,
          border: theme.colors.border.light,
          label: theme.colors.text.tertiary,
          unit: theme.colors.text.tertiary,
        }}
      />

      {/* Metric history, opened from the steps stat. */}
      <UserMetricDataModal
        visible={isMetricHistoryVisible}
        onClose={() => setIsMetricHistoryVisible(false)}
        metricType="daily_steps"
      />
    </>
  );
}
