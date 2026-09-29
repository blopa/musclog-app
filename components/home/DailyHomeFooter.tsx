import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';

import { StatStrip, type StatStripItem } from '@/components/StatStrip';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { EnergyBalance } from '@/utils/energyBalance';

import { buildDailyStatCells, type StatTone } from './dailyHomeStats';

type DailyHomeFooterProps = {
  steps: null | number;
  onStepsPress: () => void;
  energyBalance: EnergyBalance | null;
};

/**
 * The compact stat strip under the daily summary card: today's step count and, when the
 * user tracks calories, how the day's energy is balancing out.
 *
 * It renders as discrete labelled cells rather than a sentence ("Burned 2781 · Eaten 0
 * · 2781 kcal under") so the numbers line up in a scannable row and the day's verdict
 * can carry its meaning in color. `buildDailyStatCells` owns which cells appear and
 * which one is tinted; `StatStrip` draws them.
 */
export function DailyHomeFooter({ energyBalance, onStepsPress, steps }: DailyHomeFooterProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const cells = buildDailyStatCells({ energyBalance, steps });

  const toneColor: Record<StatTone, string> = {
    neutral: theme.colors.text.primary,
    good: theme.colors.status.success,
    caution: theme.colors.status.warning,
  };

  const items: StatStripItem[] = cells.map((cell) => {
    const label = t(`home.dailyStats.${cell.labelKey}`);
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
      onPress: isSteps ? onStepsPress : undefined,
      accessibilityLabel: isSteps ? `${label}: ${value}` : undefined,
    };
  });

  return (
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
  );
}
