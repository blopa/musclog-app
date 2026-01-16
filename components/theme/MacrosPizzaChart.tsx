import React from 'react';
import { View, Text } from 'react-native';
import { PolarChart, Pie } from 'victory-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

type MacroColor =
  | typeof theme.colors.macros.protein.bg
  | typeof theme.colors.macros.carbs.bg
  | typeof theme.colors.macros.fat.bg
  | typeof theme.colors.macros.fiber.bg;
type MacroDatum = { value: number; color: MacroColor; label: string };

type MacrosPizzaChartProps = {
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  size?: number;
  showInsight?: boolean;
};

export function MacrosPizzaChart({
  protein,
  carbs,
  fats,
  fiber = 0,
  size = theme.size['48'],
  showInsight = true,
}: MacrosPizzaChartProps) {
  const { t } = useTranslation();

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
    <View className="relative items-center justify-center" style={{ width: size, height: size }}>
      <View style={{ width: size, height: size }}>
        <PolarChart<MacroDatum, 'label', 'value', 'color'>
          data={data}
          colorKey="color"
          valueKey="value"
          labelKey="label">
          <Pie.Chart innerRadius={size * 0.38} />
        </PolarChart>
      </View>

      {showInsight ? (
        <View className="absolute items-center">
          <Text className="text-[10px] font-bold uppercase text-text-secondary">
            {t('nutritionGoals.balance')}
          </Text>
          <Text className="text-lg font-bold text-text-primary">{t('nutritionGoals.optimal')}</Text>
        </View>
      ) : undefined}
    </View>
  );
}
