import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { roundToDecimalPlaces } from '../../utils/roundDecimal';
import { MacrosPizzaChart } from '../theme/MacrosPizzaChart';
import { GenericCard } from './GenericCard';

type FoodInfoCardProps = {
  food: {
    name: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    source?: 'openfood' | 'usda' | 'local' | 'ai';
  };
};

const getSourceText = (source: 'openfood' | 'usda' | 'ai', t: (key: string) => string): string => {
  switch (source) {
    case 'openfood':
      return t('food.foodDetails.sourceOpenFood');
    case 'usda':
      return t('food.foodDetails.sourceUsda');
    case 'ai':
      return t('food.foodDetails.sourceAi');
    default:
      return '';
  }
};

export function FoodInfoCard({ food }: FoodInfoCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [macroViewIndex, setMacroViewIndex] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate macro percentages for legend
  const totalMacros = food.protein + food.carbs + food.fat;
  const proteinPercent = totalMacros > 0 ? (food.protein / totalMacros) * 100 : 0;
  const carbsPercent = totalMacros > 0 ? (food.carbs / totalMacros) * 100 : 0;
  const fatPercent = totalMacros > 0 ? (food.fat / totalMacros) * 100 : 0;

  return (
    <GenericCard variant="highlighted" backgroundVariant="gradient">
      <View className="relative z-10 p-5">
        {/* Header */}
        <View className="mb-6 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="mb-1 text-2xl font-bold text-text-primary">{food.name}</Text>
            <Text className="text-sm text-text-secondary">{food.category}</Text>
            {food.source === 'openfood' || food.source === 'usda' || food.source === 'ai' ? (
              <Text className="mt-1 text-xs text-text-tertiary opacity-50">
                {getSourceText(food.source, t)}
              </Text>
            ) : null}
          </View>
          <View className="items-end">
            <Text className="text-4xl font-black tracking-tight text-accent-primary">
              {roundToDecimalPlaces(food.calories)}
            </Text>
            <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('food.common.kcal')}
            </Text>
          </View>
        </View>

        {/* Macro Views - Swipeable */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width > 0 && width !== scrollViewWidth) {
              setScrollViewWidth(width);
            }
          }}
          onMomentumScrollEnd={(e) => {
            const pageWidth = e.nativeEvent.layoutMeasurement.width;
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / pageWidth);
            setMacroViewIndex(index);
          }}
          onScroll={(e) => {
            const pageWidth = e.nativeEvent.layoutMeasurement.width;
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / pageWidth);
            if (index !== macroViewIndex && index >= 0 && index <= 1) {
              setMacroViewIndex(index);
            }
          }}
          scrollEventThrottle={16}
          className="mb-4"
        >
          {/* Grid View */}
          <View className="flex-none" style={{ width: scrollViewWidth || '100%' }}>
            <View className="mb-2 flex-row gap-3">
              <View className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3">
                <View className="absolute bottom-0 left-0 h-1 w-full bg-indigo-500 opacity-50" />
                <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {windowWidth < 380 ? t('food.macros.proteinShort') : t('food.macros.protein')}
                </Text>
                <Text className="text-xl font-bold text-text-primary">
                  {roundToDecimalPlaces(food.protein)}g
                </Text>
              </View>
              <View className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3">
                <View className="absolute bottom-0 left-0 h-1 w-full bg-emerald-500 opacity-50" />
                <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {windowWidth < 380 ? t('food.macros.carbsShort') : t('food.macros.carbs')}
                </Text>
                <Text className="text-xl font-bold text-text-primary">
                  {roundToDecimalPlaces(food.carbs)}g
                </Text>
              </View>
              <View className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3">
                <View className="absolute bottom-0 left-0 h-1 w-full bg-yellow-500 opacity-50" />
                <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {windowWidth < 380 ? t('food.macros.fatShort') : t('food.macros.fat')}
                </Text>
                <Text className="text-xl font-bold text-text-primary">
                  {roundToDecimalPlaces(food.fat)}g
                </Text>
              </View>
            </View>
          </View>

          {/* Circular Chart View */}
          <View className="flex-none" style={{ width: scrollViewWidth || '100%' }}>
            <View className="flex-row items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-3">
              <View className="h-24 w-24 flex-none">
                <MacrosPizzaChart
                  protein={food.protein}
                  carbs={food.carbs}
                  fats={food.fat}
                  size={theme.size['20']}
                  showInsight={false}
                />
              </View>
              <View className="flex-1 gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-indigo-500" />
                    <Text className="text-xs text-text-secondary">
                      {t('food.macros.protein')} ({Math.round(proteinPercent)}%)
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-text-primary">
                    {roundToDecimalPlaces(food.protein)}g
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-yellow-500" />
                    <Text className="text-xs text-text-secondary">
                      {t('food.macros.fat')} ({Math.round(fatPercent)}%)
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-text-primary">
                    {roundToDecimalPlaces(food.fat)}g
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-emerald-500" />
                    <Text className="text-xs text-text-secondary">
                      {t('food.macros.carbs')} ({Math.round(carbsPercent)}%)
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-text-primary">
                    {roundToDecimalPlaces(food.carbs)}g
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Pagination Dots */}
        <View className="flex-row justify-center gap-1.5">
          <View
            className="h-1.5 rounded-full"
            style={{
              width: theme.spacing.padding['1half'],
              backgroundColor:
                macroViewIndex === 0 ? theme.colors.text.primary : theme.colors.text.primary20,
            }}
          />
          <View
            className="h-1.5 rounded-full"
            style={{
              width: theme.spacing.padding['1half'],
              backgroundColor:
                macroViewIndex === 1 ? theme.colors.text.primary : theme.colors.text.primary20,
            }}
          />
        </View>
      </View>
    </GenericCard>
  );
}
