import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Pie, PolarChart } from 'victory-native';

import { useTheme } from '@/hooks/useTheme';
import { Theme } from '@/theme';

type MacroColor =
  | Theme['colors']['macros']['protein']['bg']
  | Theme['colors']['macros']['carbs']['bg']
  | Theme['colors']['macros']['fat']['bg']
  | Theme['colors']['macros']['fiber']['bg'];

type MacroDatum = { value: number; color: MacroColor; label: string };

type MacrosPizzaChartProps = {
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  size?: number;
  showInsight?: boolean;
  insightMessage?: {
    title: string;
    subtitle: string;
  };
};

export function MacrosPizzaChart({
  protein,
  carbs,
  fats,
  fiber = 0,
  size,
  showInsight = true,
  insightMessage,
}: MacrosPizzaChartProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const sizeFinal = size || theme.size['48'];

  const data: MacroDatum[] = [
    { value: protein, color: theme.colors.macros.protein.bg as MacroColor, label: 'protein' },
    { value: carbs, color: theme.colors.macros.carbs.bg as MacroColor, label: 'carbs' },
    { value: fats, color: theme.colors.macros.fat.bg as MacroColor, label: 'fats' },
    ...(fiber > 0
      ? [{ value: fiber, color: theme.colors.macros.fiber.bg as MacroColor, label: 'fiber' }]
      : []),
  ].filter((d) => d.value > 0);

  // If all values are 0, show a placeholder background circle with a valid macro color
  if (data.length === 0) {
    data.push({ value: 1, color: theme.colors.macros.protein.bg as MacroColor, label: 'empty' });
  }

  return (
    <View
      className="relative items-center justify-center"
      style={{ width: sizeFinal, height: sizeFinal }}
    >
      <View style={{ width: sizeFinal, height: sizeFinal }}>
        <PolarChart<MacroDatum, 'label', 'value', 'color'>
          data={data}
          colorKey="color"
          valueKey="value"
          labelKey="label"
        >
          <Pie.Chart innerRadius={sizeFinal * 0.38} />
        </PolarChart>
      </View>

      {showInsight ? (
        <View className="absolute items-center">
          <Text
            className="font-bold uppercase text-text-secondary"
            style={{ fontSize: theme.typography.fontSize.xs }}
          >
            {insightMessage?.title || t('nutritionGoals.balance')}
          </Text>
          <Text className="text-md font-bold text-text-primary">
            {insightMessage?.subtitle || t('nutritionGoals.optimal')}
          </Text>
        </View>
      ) : undefined}
    </View>
  );
}
