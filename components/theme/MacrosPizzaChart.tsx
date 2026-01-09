import React from 'react';
import { View, Text } from 'react-native';
import { PolarChart, Pie } from 'victory-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

type MacroColor = '#6366f1' | '#10b981' | '#f59e0b' | '#ec4899';
type MacroDatum = { value: number; color: MacroColor };

type MacrosPizzaChartProps = {
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  size?: number;
};

export function MacrosPizzaChart({
  protein,
  carbs,
  fats,
  fiber = 0,
  size = 192,
}: MacrosPizzaChartProps) {
  const { t } = useTranslation();

  const data: MacroDatum[] = [
    { value: protein, color: theme.colors.macros.protein.bg },
    { value: carbs, color: theme.colors.macros.carbs.bg },
    { value: fats, color: theme.colors.macros.fat.bg },
    ...(fiber > 0 ? [{ value: fiber, color: theme.colors.macros.fiber.bg }] : []),
  ].filter((d) => d.value > 0);

  // If all values are 0, show a placeholder background circle with a valid macro color
  if (data.length === 0) {
    data.push({ value: 1, color: theme.colors.macros.protein.bg });
  }

  return (
    <View className="relative items-center justify-center" style={{ width: size, height: size }}>
      <View style={{ width: size, height: size }}>
        <PolarChart<MacroDatum, never, 'value', 'color'>
          data={data}
          colorKey="color"
          valueKey="value"
          labelKey={undefined as never}>
          <Pie.Chart innerRadius={size * 0.38} />
        </PolarChart>
      </View>

      <View className="absolute items-center">
        <Text className="text-[10px] font-bold uppercase text-text-secondary">
          {t('nutritionGoals.balance')}
        </Text>
        <Text className="text-lg font-bold text-text-primary">{t('nutritionGoals.optimal')}</Text>
      </View>
    </View>
  );
}
