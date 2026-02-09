import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { VictoryPie } from 'victory';

import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';

type MacroColor =
  | Theme['colors']['macros']['protein']['bg']
  | Theme['colors']['macros']['carbs']['bg']
  | Theme['colors']['macros']['fat']['bg']
  | Theme['colors']['macros']['fiber']['bg'];

type MacroDatum = { value: number; color: MacroColor; x: string };

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
  size,
  showInsight = true,
}: MacrosPizzaChartProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const sizeFinal = theme.size['48'];

  const data: MacroDatum[] = [
    { x: 'P', value: protein, color: theme.colors.macros.protein.bg as MacroColor },
    { x: 'C', value: carbs, color: theme.colors.macros.carbs.bg as MacroColor },
    { x: 'F', value: fats, color: theme.colors.macros.fat.bg as MacroColor },
    ...(fiber > 0
      ? [{ x: 'f', value: fiber, color: theme.colors.macros.fiber.bg as MacroColor }]
      : []),
  ].filter((d) => d.value > 0);

  // If all values are 0, show a placeholder background circle
  if (data.length === 0) {
    data.push({ x: 'empty', value: 1, color: theme.colors.macros.protein.bg as MacroColor });
  }

  return (
    <View
      className="relative items-center justify-center"
      style={{ width: sizeFinal, height: sizeFinal }}
    >
      <VictoryPie
        standalone={true}
        width={sizeFinal}
        height={sizeFinal}
        padding={0}
        data={data}
        y="value"
        x="x"
        innerRadius={sizeFinal * 0.38}
        labels={() => null} // Disable default labels
        colorScale={data.map((d) => d.color)}
        style={{
          data: {
            stroke: 'transparent',
            strokeWidth: theme.strokeWidth.none,
          },
        }}
      />

      {showInsight ? (
        <View className="absolute items-center">
          <Text
            className="font-bold uppercase text-text-secondary"
            style={{ fontSize: theme.typography.fontSize.xs }}
          >
            {t('nutritionGoals.balance')}
          </Text>
          <Text className="text-lg font-bold text-text-primary">{t('nutritionGoals.optimal')}</Text>
        </View>
      ) : null}
    </View>
  );
}
