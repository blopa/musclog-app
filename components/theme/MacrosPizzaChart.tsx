import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

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

  const total = protein + carbs + fats + fiber;
  const proteinPercentage = total > 0 ? (protein / total) * 100 : 0;
  const carbsPercentage = total > 0 ? (carbs / total) * 100 : 0;
  const fatsPercentage = total > 0 ? (fats / total) * 100 : 0;
  const fiberPercentage = total > 0 ? (fiber / total) * 100 : 0;

  // Calculate stroke-dasharray for each segment
  const circumference = 2 * Math.PI * 40; // radius is 40
  const proteinDashArray = (proteinPercentage / 100) * circumference;
  const carbsDashArray = (carbsPercentage / 100) * circumference;
  const fatsDashArray = (fatsPercentage / 100) * circumference;
  const fiberDashArray = (fiberPercentage / 100) * circumference;

  // Calculate stroke-dashoffset for each segment
  const proteinOffset = 0;
  const carbsOffset = -proteinDashArray;
  const fatsOffset = -(proteinDashArray + carbsDashArray);
  const fiberOffset = -(proteinDashArray + carbsDashArray + fatsDashArray);

  return (
    <View className="relative items-center justify-center" style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Background circle */}
        <Circle
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke={theme.colors.background.cardDark}
          strokeWidth="12"
        />
        {/* Protein (Indigo) */}
        <Circle
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke={theme.colors.macros.protein.bg}
          strokeWidth="12"
          strokeDasharray={`${proteinDashArray} ${circumference}`}
          strokeDashoffset={proteinOffset}
        />
        {/* Carbs (Emerald) */}
        <Circle
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke={theme.colors.macros.carbs.bg}
          strokeWidth="12"
          strokeDasharray={`${carbsDashArray} ${circumference}`}
          strokeDashoffset={carbsOffset}
        />
        {/* Fats (amber) */}
        <Circle
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke={theme.colors.macros.fat.bg}
          strokeWidth="12"
          strokeDasharray={`${fatsDashArray} ${circumference}`}
          strokeDashoffset={fatsOffset}
        />
        {/* Fiber (teal) */}
        {fiber > 0 && (
          <Circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={theme.colors.macros.fiber.bg}
            strokeWidth="12"
            strokeDasharray={`${fiberDashArray} ${circumference}`}
            strokeDashoffset={fiberOffset}
          />
        )}
      </Svg>
      <View className="absolute items-center">
        <Text className="text-[10px] font-bold uppercase text-text-secondary">
          {t('nutritionGoals.balance')}
        </Text>
        <Text className="text-lg font-bold text-text-primary">{t('nutritionGoals.optimal')}</Text>
      </View>
    </View>
  );
}
