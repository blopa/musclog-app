import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { EnergyBalance } from '@/utils/energyBalance';

import { buildDailyStatCells, type DailyStatCell, type StatTone } from './dailyHomeStats';

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
 * which one is tinted; this component only draws them.
 */
export function DailyHomeFooter({ steps, onStepsPress, energyBalance }: DailyHomeFooterProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const cells = buildDailyStatCells({ steps, energyBalance });

  if (cells.length === 0) {
    return null;
  }

  const toneColor: Record<StatTone, string> = {
    neutral: theme.colors.text.primary,
    good: theme.colors.status.success,
    caution: theme.colors.status.warning,
  };

  const renderCell = (cell: DailyStatCell) => {
    const body = (
      <View className="flex-1 items-center justify-center px-1 py-2.5">
        <View className="flex-row items-center">
          {cell.key === 'steps' ? (
            <MaterialIcons
              name="directions-walk"
              size={13}
              color={theme.colors.accent.primary}
              style={{ marginRight: 3 }}
            />
          ) : null}
          <Text
            className="text-[15px] font-semibold"
            style={{ color: toneColor[cell.tone] }}
            numberOfLines={1}
          >
            {formatInteger(cell.value)}
          </Text>
          {cell.showsUnit ? (
            <Text
              className="ml-1 text-[10px] font-medium"
              style={{ color: theme.colors.text.tertiary }}
            >
              {t('home.dailyStats.kcal')}
            </Text>
          ) : null}
        </View>
        <Text
          className="mt-1 text-[10px] font-semibold uppercase"
          style={{ color: theme.colors.text.tertiary, letterSpacing: 0.7 }}
          numberOfLines={1}
        >
          {t(`home.dailyStats.${cell.labelKey}`)}
        </Text>
      </View>
    );

    if (!cell.interactive) {
      return body;
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(`home.dailyStats.${cell.labelKey}`)}: ${formatInteger(cell.value)}`}
        className="flex-1 flex-row"
        onPress={onStepsPress}
      >
        {body}
      </Pressable>
    );
  };

  return (
    <View
      className="mt-3 flex-row items-stretch overflow-hidden rounded-2xl"
      style={{
        backgroundColor: theme.colors.background.card,
        borderColor: theme.colors.border.light,
        borderWidth: 1,
      }}
    >
      {cells.map((cell, index) => (
        <View key={cell.key} className="flex-1 flex-row items-stretch">
          {index > 0 ? (
            <View className="my-2.5 w-px" style={{ backgroundColor: theme.colors.border.light }} />
          ) : null}
          {renderCell(cell)}
        </View>
      ))}
    </View>
  );
}
